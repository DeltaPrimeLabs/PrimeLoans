pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "../lib/SmartLoanLib.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import { LibDiamond } from "../lib/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../mock/WAVAX.sol";
import "../ERC20Pool.sol";


contract SmartLoanLogicFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /* ========== REDSTONE-EVM-CONNECTOR OVERRIDDEN FUNCTIONS ========== */

    /**
     * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
     **/
    function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
        return SmartLoanLib.getMaxBlockTimestampDelay();
    }

    /**
     * Override PriceAware method, addresses below belong to authorized signers of data feeds
     **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return SmartLoanLib.getRedstoneConfigManager().signerExists(_receivedSigner);
    }

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    function getAllOwnedAssets() external view returns (bytes32[] memory result) {
        return SmartLoanLib.getAllOwnedAssets();
    }

    function getAllAssetsBalances() public view returns (uint256[] memory) {
        PoolManager poolManager = SmartLoanLib.getPoolManager();

        bytes32[] memory assets = poolManager.getAllTokenAssets();
        uint256[] memory balances = new uint[](assets.length);
        for(uint256 i=0; i<assets.length; i++) {
            balances[i] = IERC20(poolManager.getAssetAddress(assets[i])).balanceOf(address(this));
        }
        return balances;
    }

    function getAllAssetsPrices() public view returns (uint256[] memory result) {
        PoolManager poolManager = SmartLoanLib.getPoolManager();

        bytes32[] memory assets = poolManager.getAllTokenAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        return prices;
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getMaxLiquidationBonus() public view virtual returns (uint256) {
        return SmartLoanLib.getMaxLiquidationBonus();
    }

    function getMaxLtv() public view virtual returns (uint256) {
        return SmartLoanLib.getMaxLtv();
    }

    function getPercentagePrecision() public view virtual returns (uint256) {
        return SmartLoanLib.getPercentagePrecision();
    }



    /**
     * Returns the balances of all assets owned by the Prime Account
     * It could be used as a helper method for UI
     **/
    function getOwnedAssetsBalances() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getAllOwnedAssets();
        uint256[] memory balances = new uint256[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            balances[i] = getBalance(assets[i]);
        }

        return balances;
    }

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) public view returns (uint256) {
        IERC20 token = IERC20(SmartLoanLib.getPoolManager().getAssetAddress(_asset));
        return token.balanceOf(address(this));
    }


    /**
     * Returns the prices of all assets owned by the Prime Account
     * It could be used as a helper method for UI
     * @dev This function uses the redstone-evm-connector
     **/
    function getOwnedAssetsPrices() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getAllOwnedAssets();

        return getPricesFromMsg(assets);
    }

    /* ========== MODIFIERS ========== */

    /**
    * Checks whether account is solvent (LTV lower than SmartLoanLib.getMaxLtv())
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;
        require(_isSolvent(), "The action may cause an account to become insolvent");
    }

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }
}