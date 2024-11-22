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

    bytes32 private constant _NATIVE_TOKEN_SYMBOL = 'AVAX';

    address private constant _NATIVE_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D;

    address private constant _TOKEN_MANAGER_ADDRESS = 0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e;

    address private constant _ADDRESS_PROVIDER = address(0);

    address private constant _FEES_TREASURY_ADDREESS = 0x18C244c62372dF1b933CD455769f9B4DdB820F0C;

    address private constant _STABILITY_POOL_ADDREESS = 0x8Ac151296Ae72a8AeE01ECB33cd8Ad9842F2704f;

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