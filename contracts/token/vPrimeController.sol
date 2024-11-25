// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IBorrowersRegistry.sol";
import "../interfaces/facets/IOwnershipFacet.sol";
import "../interfaces/IPool.sol";
import "../interfaces/ISPrime.sol";
import "./vPrime.sol";
import "../lib/uniswap-v3/FullMath.sol";

abstract contract vPrimeController is PendingOwnableUpgradeable, RedstoneConsumerNumericBase {
    ISPrime[] public whitelistedSPrimeContracts;
    ITokenManager public tokenManager;
    vPrime public vPrimeContract;
    IBorrowersRegistry public borrowersRegistry;
    bool public useOraclePrimeFeed;
    uint256 public constant BORROWER_YEARLY_V_PRIME_RATE = 1;
    uint256 public constant DEPOSITOR_YEARLY_V_PRIME_RATE = 5;
    uint256 public constant MAX_V_PRIME_VESTING_YEARS = 3;
    uint256 public constant V_PRIME_DETERIORATION_DAYS = 14;
    uint256 public constant V_PRIME_PAIR_RATIO = 10;
    uint256 public constant RS_PRICE_PRECISION_1e18_COMPLEMENT = 1e10;

    struct VPrimeCalculationsStruct {
        int256 vPrimeRate;
        uint256 vPrimeBalanceLimit;
        uint256 vPrimeBalanceAlreadyVested;
        uint256 userSPrimeDollarValueFullyVested;
        uint256 userSPrimeDollarValueNonVested;
        uint256 userDepositFullyVestedDollarValue;
        uint256 userDepositNonVestedDollarValue;
        uint256 primeAccountBorrowedDollarValue;
    }

    constructor() {
        _disableInitializers();
    }


    /* ========== INITIALIZER ========== */

    function initialize(ISPrime[] memory _whitelistedSPrimeContracts, ITokenManager _tokenManager, vPrime _vPrime, bool _useOraclePrimeFeed) external initializer {
        whitelistedSPrimeContracts = _whitelistedSPrimeContracts;
        tokenManager = _tokenManager;
        vPrimeContract = _vPrime;
        useOraclePrimeFeed = _useOraclePrimeFeed;
        __PendingOwnable_init();
    }


    /* ========== MUTATIVE EXTERNAL FUNCTIONS ========== */

    // Update vPrime snapshot for `userAddress`
    function updateVPrimeSnapshot(address userAddress) public {
        (int256 vPrimeRate, uint256 vPrimeBalanceLimit, uint256 alreadyVestedVPrimeBalance) = getUserVPrimeRateAndMaxCap(userAddress);

        // alreadyVestedVPrimeBalance > 0 mean that the already vested vPrime is higher than the current balance
        if(alreadyVestedVPrimeBalance > 0){
            vPrimeContract.adjustRateCapAndBalance(userAddress, vPrimeRate, vPrimeBalanceLimit, alreadyVestedVPrimeBalance);
        } else {
            vPrimeContract.adjustRateAndCap(userAddress, vPrimeRate, vPrimeBalanceLimit);
        }
    }

    function setUserNeedsUpdate(address userAddress) public onlyPoolOrSPrime {
        vPrimeContract.setUserNeedsUpdate(userAddress);
    }


    function updateVPrimeSnapshotsForAccounts(address[] memory accounts) public {
        for (uint i = 0; i < accounts.length; i++) {
            updateVPrimeSnapshot(accounts[i]);
        }
    }


    /* ========== SETTERS ========== */

    function getWhitelistedPools() public view returns (IPool[] memory) {
        bytes32[] memory poolsTokenSymbols = tokenManager.getAllPoolAssets();
        IPool[] memory whitelistedPools = new IPool[](poolsTokenSymbols.length);
        for (uint i = 0; i < poolsTokenSymbols.length; i++) {
            whitelistedPools[i] = IPool(tokenManager.getPoolAddress(poolsTokenSymbols[i]));
        }
        return whitelistedPools;
    }

    modifier onlyPoolOrSPrime() {
        IPool[] memory whitelistedPools = getWhitelistedPools();
        bool isPoolOrSPrime = false;
        for (uint i = 0; i < whitelistedPools.length; i++) {
            if (address(whitelistedPools[i]) == msg.sender) {
                isPoolOrSPrime = true;
                break;
            }
        }
        for(uint i = 0; i < whitelistedSPrimeContracts.length; i++){
            if (address(whitelistedSPrimeContracts[i]) == msg.sender) {
                isPoolOrSPrime = true;
                break;
            }
        }
        require(isPoolOrSPrime, "Only Pool or sPrime can call this function");
        _;
    }

    /**
    * @notice Updates the list of whitelisted sPrime contracts.
    * @dev Can only be called by the contract owner.
    * @param newWhitelistedSPrimeContracts An array of addresses representing the new list of whitelisted sPrime contracts.
    */
    function updateWhitelistedSPrimeContracts(ISPrime[] memory newWhitelistedSPrimeContracts) external onlyOwner {
        whitelistedSPrimeContracts = newWhitelistedSPrimeContracts;
        emit WhitelistedSPrimeContractsUpdated(newWhitelistedSPrimeContracts, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the token manager contract.
    * @dev Can only be called by the contract owner.
    * @param newTokenManager The address of the new token manager contract.
    */
    function updateTokenManager(ITokenManager newTokenManager) external onlyOwner {
        tokenManager = newTokenManager;
        emit TokenManagerUpdated(newTokenManager, msg.sender, block.timestamp);
    }

    // only owner setter for useOraclePriceFeed
    function setUseOraclePrimeFeed(bool _useOraclePrimeFeed) external onlyOwner {
        useOraclePrimeFeed = _useOraclePrimeFeed;
        emit UseOraclePrimeFeedUpdated(_useOraclePrimeFeed, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the borrowers registry contract.
    * @dev Can only be called by the contract owner.
    * @param newBorrowersRegistry The address of the new borrowers registry contract.
    */
    function updateBorrowersRegistry(IBorrowersRegistry newBorrowersRegistry) external onlyOwner {
        borrowersRegistry = newBorrowersRegistry;
    }



    /* ========== VIEW EXTERNAL FUNCTIONS ========== */

    function getPoolsPrices(IPool[] memory whitelistedPools) internal view returns (uint256[] memory) {
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        return getOracleNumericValuesFromTxMsg(poolsTokenSymbols);
    }

    function getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(address userAddress) public view returns (uint256 fullyVestedDollarValue, uint256 nonVestedDollarValue) {
        fullyVestedDollarValue = 0;
        nonVestedDollarValue = 0;
        IPool[] memory whitelistedPools = getWhitelistedPools();
        uint256[] memory prices = getPoolsPrices(whitelistedPools);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 fullyVestedBalance = whitelistedPools[i].getFullyVestedLockedBalance(userAddress);
            uint256 nonVestedBalance = IERC20(whitelistedPools[i]).balanceOf(userAddress) - fullyVestedBalance;

            uint256 _denominator = 10 ** whitelistedPools[i].decimals();
            fullyVestedDollarValue += FullMath.mulDiv(fullyVestedBalance, prices[i] * RS_PRICE_PRECISION_1e18_COMPLEMENT, _denominator);
            nonVestedDollarValue += FullMath.mulDiv(nonVestedBalance, prices[i] * RS_PRICE_PRECISION_1e18_COMPLEMENT, _denominator);
        }
        return (fullyVestedDollarValue, nonVestedDollarValue);
    }

    function getPrimeAccountBorrowedDollarValueAcrossWhitelistedPools(address userAddress) public view returns (uint256) {
        uint256 totalDollarValue = 0;

        address primeAccountAddress = borrowersRegistry.getLoanForOwner(userAddress);
        if(primeAccountAddress != address(0)){
            IPool[] memory whitelistedPools = getWhitelistedPools();
            bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
            for (uint i = 0; i < whitelistedPools.length; i++) {
                poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
            }
            uint256[] memory prices = getOracleNumericValuesFromTxMsg(poolsTokenSymbols);

            for (uint i = 0; i < whitelistedPools.length; i++) {
                uint256 poolBorrowedAmount = whitelistedPools[i].getBorrowed(primeAccountAddress);
                uint256 poolDollarValue = FullMath.mulDiv(poolBorrowedAmount, prices[i] * RS_PRICE_PRECISION_1e18_COMPLEMENT, 10 ** whitelistedPools[i].decimals());
                totalDollarValue += poolDollarValue;
            }
        }

        return totalDollarValue;
    }

    function getPrimeTokenPoolPrice(ISPrime sPrimeContract, uint256 tokenYPrice) public view returns (uint256) {
        if(useOraclePrimeFeed){
            bytes32 primeSymbol = "PRIME";
            uint256 primePrice = getOracleNumericValueFromTxMsg(primeSymbol);
            return primePrice * 1e8 / tokenYPrice; // both tokenYPrice and primePrice have 8 decimals
        } else {
            uint256 poolPrice = sPrimeContract.getPoolPrice(); // returns price with 8 decimals
            if(poolPrice * tokenYPrice / 1e8 > 13125 * 1e5){ // 13.125 with 8 decimals which comes from 10xinitialPrice MAX PRICE CAP before oracle feed will be ready
                poolPrice = 13125 * 1e13 / tokenYPrice; // 13125 * 1e5 * 1e8 / tokenYPrice
            }
            return poolPrice;
        }
    }

    function getUserSPrimeDollarValueVestedAndNonVested(address userAddress) public view returns (uint256 fullyVestedDollarValue, uint256 nonVestedDollarValue) {
        fullyVestedDollarValue = 0;
        nonVestedDollarValue = 0;
        for (uint i = 0; i < whitelistedSPrimeContracts.length; i++) {
            bytes32 sPrimeTokenYSymbol = tokenManager.tokenAddressToSymbol(address(whitelistedSPrimeContracts[i].getTokenY()));
            uint256 sPrimeTokenYDecimals = IERC20Metadata(address(whitelistedSPrimeContracts[i].getTokenY())).decimals();
            uint256 sPrimeTokenYPrice = getOracleNumericValueFromTxMsg(sPrimeTokenYSymbol);
            uint256 poolPrice = getPrimeTokenPoolPrice(whitelistedSPrimeContracts[i], sPrimeTokenYPrice);
            uint256 sPrimeBalance = IERC20Metadata(address(whitelistedSPrimeContracts[i])).balanceOf(userAddress);
            uint256 fullyVestedBalance = whitelistedSPrimeContracts[i].getFullyVestedLockedBalance(userAddress);
            uint256 nonVestedBalance = sPrimeBalance - fullyVestedBalance;
            uint256 userSPrimeValueInTokenY = whitelistedSPrimeContracts[i].getUserValueInTokenY(userAddress, poolPrice);
            if(sPrimeBalance > 0) {
                uint256 _denominator = sPrimeBalance * 10 ** sPrimeTokenYDecimals;
                fullyVestedDollarValue += FullMath.mulDiv(userSPrimeValueInTokenY, sPrimeTokenYPrice * RS_PRICE_PRECISION_1e18_COMPLEMENT * fullyVestedBalance, _denominator);
                nonVestedDollarValue += FullMath.mulDiv(userSPrimeValueInTokenY, sPrimeTokenYPrice * RS_PRICE_PRECISION_1e18_COMPLEMENT * nonVestedBalance, _denominator);
            }
        }
        return (fullyVestedDollarValue, nonVestedDollarValue);
    }

    /*
    * For every $10 deposited and $1 $sPRIME owned, your balance increases with 5 $vPRIME per year.
    * For every $10 borrowed and $1 $sPRIME owned, your balance increases with 1 $vPRIME per year.
    * Only full ${V_PRIME_PAIR_RATIO}-1 pairs can produce $vPRIME.
    */
    function getUserVPrimeRateAndMaxCap(address userAddress) public view returns (int256, uint256, uint256){
        VPrimeCalculationsStruct memory vPrimeCalculations = VPrimeCalculationsStruct({
            vPrimeRate: 0,
            vPrimeBalanceLimit: 0,
            vPrimeBalanceAlreadyVested: 0,
            userSPrimeDollarValueFullyVested: 0,
            userSPrimeDollarValueNonVested: 0,
            userDepositFullyVestedDollarValue: 0,
            userDepositNonVestedDollarValue: 0,
            primeAccountBorrowedDollarValue: 0
        });

        {
            (uint256 _userSPrimeDollarValueFullyVested, uint256 _userSPrimeDollarValueNonVested) = getUserSPrimeDollarValueVestedAndNonVested(userAddress);
            (uint256 _userDepositFullyVestedDollarValue, uint256 _userDepositNonVestedDollarValue) = getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(userAddress);
            uint256 _primeAccountBorrowedDollarValue = getPrimeAccountBorrowedDollarValueAcrossWhitelistedPools(userAddress);
            vPrimeCalculations.userSPrimeDollarValueFullyVested = _userSPrimeDollarValueFullyVested;
            vPrimeCalculations.userSPrimeDollarValueNonVested = _userSPrimeDollarValueNonVested;
            vPrimeCalculations.userDepositFullyVestedDollarValue = _userDepositFullyVestedDollarValue;
            vPrimeCalculations.userDepositNonVestedDollarValue = _userDepositNonVestedDollarValue;
            vPrimeCalculations.primeAccountBorrowedDollarValue = _primeAccountBorrowedDollarValue;
        }


        // How many pairs can be created based on the sPrime
        uint256 maxSPrimePairsCount = (vPrimeCalculations.userSPrimeDollarValueFullyVested + vPrimeCalculations.userSPrimeDollarValueNonVested) / 1e18;
        // How many pairs can be created based on the deposits
        uint256 maxDepositPairsCount = ((vPrimeCalculations.userDepositFullyVestedDollarValue + vPrimeCalculations.userDepositNonVestedDollarValue) / V_PRIME_PAIR_RATIO) / 1e18;
        // How many pairs can be created based on the borrowings
        uint256 maxBorrowerPairsCount = vPrimeCalculations.primeAccountBorrowedDollarValue / V_PRIME_PAIR_RATIO / 1e18;

        // How many sPrime-depositor pairs can be created
        uint256 maxSPrimeDepositorPairsCount = Math.min(maxSPrimePairsCount, maxDepositPairsCount);
        // How many sPrime-borrower pairs can be created taken into account sPrime used by sPrime-depositor pairs
        uint256 maxSPrimeBorrowerPairsCount = Math.min(maxSPrimePairsCount - maxSPrimeDepositorPairsCount, maxBorrowerPairsCount);

        // Increase vPrimeCalculations.vPrimeBalanceLimit and vPrimeCalculations.vPrimeBalanceAlreadyVested based on the sPrime-depositor pairs
        if(maxSPrimeDepositorPairsCount > 0){
            uint256 balanceLimitIncrease = maxSPrimeDepositorPairsCount * DEPOSITOR_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
            vPrimeCalculations.vPrimeBalanceLimit += balanceLimitIncrease;

            uint256 depositVestedPairsCount = Math.min(vPrimeCalculations.userDepositFullyVestedDollarValue / V_PRIME_PAIR_RATIO, vPrimeCalculations.userSPrimeDollarValueFullyVested) / 1e18;
            if(depositVestedPairsCount > 0){
                vPrimeCalculations.vPrimeBalanceAlreadyVested += balanceLimitIncrease * depositVestedPairsCount / maxSPrimeDepositorPairsCount;
            }
        }

        // Increase vPrimeCalculations.vPrimeBalanceLimit based on the sPrime-borrower pairs
        if(maxSPrimeBorrowerPairsCount > 0){
            vPrimeCalculations.vPrimeBalanceLimit += maxSPrimeBorrowerPairsCount * BORROWER_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
        }

        // Check current vPrime balance
        uint256 currentVPrimeBalance = vPrimeContract.balanceOf(userAddress);

        // If already vested vPrime balance is higher than the current balance, then the current balance should be replaced with the already vested balance
        bool balanceShouldBeReplaced = false;
        if(currentVPrimeBalance < vPrimeCalculations.vPrimeBalanceAlreadyVested){
            currentVPrimeBalance = vPrimeCalculations.vPrimeBalanceAlreadyVested;
            balanceShouldBeReplaced = true;
        }

        int256 vPrimeBalanceDelta = int256(vPrimeCalculations.vPrimeBalanceLimit) - int256(currentVPrimeBalance);
        if(vPrimeBalanceDelta < 0){
            vPrimeCalculations.vPrimeRate = vPrimeBalanceDelta / int256(V_PRIME_DETERIORATION_DAYS) / 1 days;
        } else {
            vPrimeCalculations.vPrimeRate = vPrimeBalanceDelta / int256(MAX_V_PRIME_VESTING_YEARS) / 365 days;
        }

        if(balanceShouldBeReplaced){
            return (vPrimeCalculations.vPrimeRate, vPrimeCalculations.vPrimeBalanceLimit, vPrimeCalculations.vPrimeBalanceAlreadyVested);
        } else {
            return (vPrimeCalculations.vPrimeRate, vPrimeCalculations.vPrimeBalanceLimit, 0);
        }
    }


    // EVENTS
    event WhitelistedSPrimeContractsUpdated(ISPrime[] newWhitelistedSPrimeContracts, address userAddress, uint256 timestamp);
    event TokenManagerUpdated(ITokenManager newTokenManager, address userAddress, uint256 timestamp);
    event UseOraclePrimeFeedUpdated(bool _useOraclePrimeFeed, address userAddress, uint256 timestamp);
}
