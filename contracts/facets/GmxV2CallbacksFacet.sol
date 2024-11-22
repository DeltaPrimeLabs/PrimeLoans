// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../ReentrancyGuardKeccak.sol";
import "../lib/SolvencyMethods.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IWrappedNativeToken.sol";

import "../interfaces/gmx-v2/Deposit.sol";
import "../interfaces/gmx-v2/Withdrawal.sol";
import "../interfaces/gmx-v2/IRoleStore.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/gmx-v2/IDepositCallbackReceiver.sol";
import "../interfaces/gmx-v2/EventUtils.sol";
import "../interfaces/gmx-v2/IWithdrawalCallbackReceiver.sol";
import "../interfaces/gmx-v2/IGasFeeCallbackReceiver.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

abstract contract GmxV2CallbacksFacet is IDepositCallbackReceiver, IWithdrawalCallbackReceiver, IGasFeeCallbackReceiver, ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;
    using Deposit for Deposit.Props;
    using Withdrawal for Withdrawal.Props;

    // CONSTANTS
    bytes32 constant public CONTROLLER = keccak256(abi.encode("CONTROLLER"));

    // GMX contracts
    function getGmxV2RoleStore() internal pure virtual returns (address);

    // Mappings
    function marketToLongToken(address market) internal virtual pure returns (address);

    function marketToShortToken(address market) internal virtual pure returns (address);

    function isCallerAuthorized(address _caller) internal view returns (bool){
        IRoleStore roleStore = IRoleStore(getGmxV2RoleStore());
        if(roleStore.hasRole(_caller, CONTROLLER)){
            return true;
        }
        return false;
    }

    function wrapNativeToken() internal {
        uint256 balance = address(this).balance;
        if(balance > 0){
            IWrappedNativeToken nativeToken = IWrappedNativeToken(DeploymentConstants.getNativeToken());
            nativeToken.deposit{value : balance}();
            ITokenManager tokenManager = DeploymentConstants.getTokenManager();
            _increaseExposure(tokenManager, address(nativeToken), balance);
        }
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 receivedMarketTokens = eventData.uintItems.items[0].value;
        address gmToken = deposit.addresses.market;

        uint256 gmTokenBalance = IERC20Metadata(gmToken).balanceOf(address(this));
        // Add owned assets
        if( gmTokenBalance > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(gmToken), gmToken);
        }

        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            receivedMarketTokens * 1e18 / 10**IERC20Metadata(gmToken).decimals()
        );

        tokenManager.setPendingExposureToZero(tokenManager.tokenAddressToSymbol(gmToken), deposit.account());
        
        // Unfreeze account
        DiamondStorageLib.unfreezeAccount(msg.sender);

        emit DepositExecuted(
            msg.sender,
            deposit.addresses.market,
            receivedMarketTokens,
            deposit.numbers.executionFee
        );
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(deposit.addresses.market);
        address shortToken = marketToShortToken(deposit.addresses.market);


        // Add owned assets
        if(IERC20Metadata(longToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }

        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        if(deposit.numbers.initialLongTokenAmount > 0) {
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(longToken),
                deposit.numbers.initialLongTokenAmount * 1e18 / 10**IERC20Metadata(longToken).decimals()
            );
        }
        if(deposit.numbers.initialShortTokenAmount > 0) {
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(shortToken),
                deposit.numbers.initialShortTokenAmount * 1e18 / 10**IERC20Metadata(shortToken).decimals()
            );
        }

        tokenManager.setPendingExposureToZero(tokenManager.tokenAddressToSymbol(deposit.addresses.market), deposit.account());

        DiamondStorageLib.unfreezeAccount(msg.sender);
        emit DepositCancelled(
            msg.sender,
            deposit.addresses.market,
            deposit.numbers.executionFee
        );
    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(withdrawal.addresses.market);
        address shortToken = marketToShortToken(withdrawal.addresses.market);
        uint256 longOutputAmount = eventData.uintItems.items[0].value;
        uint256 shortOutputAmount = eventData.uintItems.items[1].value;

        // Add owned assets
        if(IERC20Metadata(longToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }
        
        if(longOutputAmount > 0) {
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(longToken),
                longOutputAmount * 1e18 / 10**IERC20Metadata(longToken).decimals()
            );
        }
        if(shortOutputAmount > 0) {
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(shortToken),
                shortOutputAmount * 1e18 / 10**IERC20Metadata(shortToken).decimals()
            );
        }

        tokenManager.setPendingExposureToZero(tokenManager.tokenAddressToSymbol(longToken), withdrawal.account());
        tokenManager.setPendingExposureToZero(tokenManager.tokenAddressToSymbol(shortToken), withdrawal.account());
        
        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        DiamondStorageLib.unfreezeAccount(msg.sender);
        emit WithdrawalExecuted(
            msg.sender,
            withdrawal.addresses.market,
            longOutputAmount,
            shortOutputAmount,
            withdrawal.numbers.executionFee
        );
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(withdrawal.addresses.market);
        address shortToken = marketToShortToken(withdrawal.addresses.market);
        
        // Add owned assets
        if(IERC20Metadata(withdrawal.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(withdrawal.addresses.market), withdrawal.addresses.market);
        }

        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(withdrawal.addresses.market),
            withdrawal.numbers.marketTokenAmount * 1e18 / 10**IERC20Metadata(withdrawal.addresses.market).decimals()
        );

        tokenManager.setPendingExposureToZero(tokenManager.tokenAddressToSymbol(longToken), withdrawal.account());
        tokenManager.setPendingExposureToZero(tokenManager.tokenAddressToSymbol(shortToken), withdrawal.account());

        DiamondStorageLib.unfreezeAccount(msg.sender);
        emit WithdrawalCancelled(
            msg.sender,
            withdrawal.addresses.market,
            withdrawal.numbers.executionFee
        );
    }

    function refundExecutionFee(bytes32 /* key */, EventUtils.EventLogData memory /* eventData */) external payable {
        wrapNativeToken();

        emit GasFeeRefunded(msg.value);
    }

    // MODIFIERS
    modifier onlyGmxV2Keeper() {
        require(isCallerAuthorized(msg.sender), "Must be a GMX V2 authorized Keeper");
        _;
    }

    /**
     * @dev emitted after depositing collateral to gm market
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param gmAmount amount of gm tokens received
     * @param executionFee amount of execution fee paid
    **/
    event DepositExecuted(address indexed accountAddress, address indexed market, uint256 gmAmount, uint256 executionFee);

    /**
     * @dev emitted after gm market deposit order was cancelled
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param executionFee amount of execution fee paid
    **/
    event DepositCancelled(address indexed accountAddress, address indexed market, uint256 executionFee);

    /**
     * @dev emitted after withdrawing collateral from gm market
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param longTokenAmount amount of long tokens received
     * @param shortTokenAmount amount of short tokens received
     * @param executionFee amount of execution fee paid
    **/
    event WithdrawalExecuted(address indexed accountAddress, address indexed market, uint256 longTokenAmount, uint256 shortTokenAmount, uint256 executionFee);

    /**
     * @dev emitted after gm market withdrawal order was cancelled
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param executionFee amount of execution fee paid
    **/
    event WithdrawalCancelled(address indexed accountAddress, address indexed market, uint256 executionFee);

    /**
     * @dev emitted after gmx execution fee is refunded
     * @param refundedFee amount of execution fee refunded
    **/
    event GasFeeRefunded(uint256 refundedFee);
}
