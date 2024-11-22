// SPDX-License-Identifier: MIT
// Modified version of Openzeppelin (OpenZeppelin Contracts v4.4.1 (security/ReentrancyGuard.sol)) ReentrancyGuard
// contract that uses keccak slots instead of the standard storage layout.

import {DiamondStorageLib} from "./lib/DiamondStorageLib.sol";
import "./lib/SolvencyMethods.sol";
import "./facets/SmartLoanLiquidationFacet.sol";

pragma solidity 0.8.17;

/**
 * @dev Enforces ownership only if there is no liquidation ongoing
 */
abstract contract OnlyOwnerOrInsolvent is SolvencyMethods {

    /**
     * @dev Enforces ownership only if there is no liquidation ongoing
     */
    modifier onlyOwnerOrInsolvent() {
        bool isWhitelistedLiquidator = SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender);

        if (isWhitelistedLiquidator) {
            require(!_isSolvent(), "Account is solvent");
        } else{
            DiamondStorageLib.enforceIsContractOwner();
        }

        _;

        if (!isWhitelistedLiquidator) {
            require(_isSolvent(), "Must stay solvent");
        }
    }

    modifier onlyOwnerNoStaySolventOrInsolventPayable() {
        bool isWhitelistedLiquidator = SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender);

        if (isWhitelistedLiquidator) {
            require(!_isSolventPayable(), "Account is solvent");
        } else{
            DiamondStorageLib.enforceIsContractOwner();
        }

        _;
    }
}
