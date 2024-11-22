// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

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

    bytes32 private constant _NATIVE_TOKEN_SYMBOL = 'AVAX';

    address private constant _NATIVE_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x5133BBdfCCa3Eb4F739D599ee4eC45cBCD0E16c5;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0x12Bcb546bC60fF39F1Adfc7cE4605d5Bd6a6A876;

    address private constant _TOKEN_MANAGER_ADDRESS = 0xf090f16dEc8b6D24082Edd25B1C8D26f2bC86128;

    address private constant _ADDRESS_PROVIDER = 0xe039608E695D21aB11675EBBA00261A0e750526c;

    address private constant _FEES_TREASURY_ADDREESS = 0x764a9756994f4E6cd9358a6FcD924d566fC2e666;

    address private constant _STABILITY_POOL_ADDREESS = 0x6B9836D18978a2e865A935F12F4f958317DA4619;

    address private constant _FEES_REDISTRIBUTION_ADDREESS = 0x8995d790169023Ee4fF67621948EBDFe7383f59e;

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