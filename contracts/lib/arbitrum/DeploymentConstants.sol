// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8c36e18a206b9e6649c00da51c54b92171ce3413;
pragma solidity 0.8.17;

import "../../interfaces/ITokenManager.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

/**
 * DeploymentConstants
 * These constants are updated during test and prod deployments using JS scripts. Defined as constants
 * to decrease gas costs. Not meant to be updated unless really necessary.
 * BE CAREFUL WHEN UPDATING. CONSTANTS CAN BE USED AMONG MANY FACETS.
 **/
library DeploymentConstants {

    // Used for LiquidationBonus calculations
    uint256 private constant _PERCENTAGE_PRECISION = 1000;

    bytes32 private constant _NATIVE_TOKEN_SYMBOL = 'ETH';

    address private constant _NATIVE_ADDRESS = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x62Cf82FB0484aF382714cD09296260edc1DC0c6c;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20;

    address private constant _TOKEN_MANAGER_ADDRESS = 0x0a0D954d4b0F0b47a5990C0abd179A90fF74E255;

    address private constant _ADDRESS_PROVIDER = 0x6Aa0Fe94731aDD419897f5783712eBc13E8F3982;

    address private constant _FEES_TREASURY_ADDREESS = 0x764a9756994f4E6cd9358a6FcD924d566fC2e666;

    address private constant _STABILITY_POOL_ADDREESS = 0x6B9836D18978a2e865A935F12F4f958317DA4619;

    address private constant _FEES_REDISTRIBUTION_ADDREESS = 0x5e7d3d4F744378C2259bb6C52fbF247be473860D;

    //implementation-specific

    function getPercentagePrecision() internal pure returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    //blockchain-specific

    function getNativeTokenSymbol() internal pure returns (bytes32 symbol) {
        return _NATIVE_TOKEN_SYMBOL;
    }

    function getNativeToken() internal pure returns (address payable) {
        return payable(_NATIVE_ADDRESS);
    }

    //deployment-specific

    function getDiamondAddress() internal pure returns (address) {
        return _DIAMOND_BEACON_ADDRESS;
    }

    function getSmartLoansFactoryAddress() internal pure returns (address) {
        return _SMART_LOANS_FACTORY_ADDRESS;
    }

    function getTokenManager() internal pure returns (ITokenManager) {
        return ITokenManager(_TOKEN_MANAGER_ADDRESS);
    }

    function getAddressProvider() internal pure returns (address) {
        return _ADDRESS_PROVIDER;
    }

    function getTreasuryAddress() internal pure returns (address) {
        return _FEES_TREASURY_ADDREESS;
    }

    function getStabilityPoolAddress() internal pure returns (address) {
        return _STABILITY_POOL_ADDREESS;
    }

    function getFeesRedistributionAddress() internal pure returns (address) {
        return _FEES_REDISTRIBUTION_ADDREESS;
    }

    /**
    * Returns all owned assets keys
    **/
    function getAllOwnedAssets() internal view returns (bytes32[] memory result) {
        DiamondStorageLib.SmartLoanStorage storage sls = DiamondStorageLib.smartLoanStorage();
        return sls.ownedAssets._inner._keys._inner._values;
    }
}