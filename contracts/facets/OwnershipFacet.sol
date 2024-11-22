
// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import { DiamondStorageLib } from "../lib/DiamondStorageLib.sol";
import "../SmartLoansFactory.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract OwnershipFacet {
    function proposeOwnershipTransfer(address _newOwner) external {
        DiamondStorageLib.enforceIsContractOwner();
        require(_newOwner != msg.sender, "Can't propose oneself as a contract owner");
        require(SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).getLoanForOwner(_newOwner) == address(0),
            "Can't propose an address that already has a loan");
        DiamondStorageLib.setProposedOwner(_newOwner);

        emit OwnershipProposalCreated(msg.sender, _newOwner);
    }

    function acceptOwnership() external {
        require(DiamondStorageLib.proposedOwner() == msg.sender, "Only a proposed user can accept ownership");
        DiamondStorageLib.setContractOwner(msg.sender);
        DiamondStorageLib.setProposedOwner(address(0));
        SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).changeOwnership(msg.sender);

        emit OwnershipProposalAccepted(msg.sender);
    }

    function owner() external view returns (address owner_) {
        owner_ = DiamondStorageLib.contractOwner();
    }

    function proposedOwner() external view returns (address proposedOwner_) {
        proposedOwner_ = DiamondStorageLib.proposedOwner();
    }

    function pauseAdmin() external view returns (address pauseAdmin) {
        pauseAdmin = DiamondStorageLib.pauseAdmin();
    }

    function proposedPauseAdmin() external view returns (address proposedPauseAdmin) {
        proposedPauseAdmin = DiamondStorageLib.proposedPauseAdmin();
    }

    /**
     * @dev emitted after creating a ownership transfer proposal by the owner
     * @param owner address of the current owner
     * @param proposed address of the proposed owner
     **/
    event OwnershipProposalCreated(address indexed owner, address indexed proposed);

    /**
     * @dev emitted after accepting a ownership transfer proposal by the new owner
     * @param newOwner address of the new owner
     **/
    event OwnershipProposalAccepted(address indexed newOwner);
}