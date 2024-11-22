// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8c36e18a206b9e6649c00da51c54b92171ce3413;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "./lib/DiamondStorageLib.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";

/**
 * @title SmartLoanDiamondBeacon
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */

contract SmartLoanDiamondBeacon {
    constructor(address _contractOwner, address _diamondCutFacet) payable {
        DiamondStorageLib.setContractOwner(_contractOwner);
        DiamondStorageLib.setContractPauseAdmin(_contractOwner);

        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](3);
        functionSelectors[0] = IDiamondCut.diamondCut.selector;
        functionSelectors[1] = IDiamondCut.pause.selector;
        functionSelectors[2] = IDiamondCut.unpause.selector;
        cut[0] = IDiamondCut.FacetCut({
        facetAddress : _diamondCutFacet,
        action : IDiamondCut.FacetCutAction.Add,
        functionSelectors : functionSelectors
        });
        DiamondStorageLib.diamondCut(cut, address(0), "");

        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        // diamondCut(); unpause()
        ds.canBeExecutedWhenPaused[0x1f931c1c] = true;
        ds.canBeExecutedWhenPaused[0x3f4ba83a] = true;
    }

    function implementation() public view returns (address) {
        return address(this);
    }

    function canBeExecutedWhenPaused(bytes4 methodSig) external view returns (bool) {
        return DiamondStorageLib.getPausedMethodExemption(methodSig);
    }

    function setPausedMethodExemptions(bytes4[] memory methodSigs, bool[] memory values) public {
        DiamondStorageLib.enforceIsContractOwner();
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();

        for(uint i; i<methodSigs.length; i++){
            require(!(methodSigs[i] == 0x3f4ba83a && values[i] == false), "The unpause() method must be available during the paused state.");
            ds.canBeExecutedWhenPaused[methodSigs[i]] = values[i];
        }
    }

    function getStatus() public view returns(bool) {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        return ds._active;
    }

    function implementation(bytes4 funcSignature) public view notPausedOrUpgrading(funcSignature) returns (address) {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        // get facet from function selector
        address facet = ds.selectorToFacetAndPosition[funcSignature].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        // Execute external function from facet using delegatecall and return any value.
        return facet;
    }


    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        address facet = implementation(msg.sig);
        // Execute external function from facet using delegatecall and return any value.
        assembly {
        // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
        // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
        // get any return value
            returndatacopy(0, 0, returndatasize())
        // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return (0, returndatasize())
            }
        }
    }

    function proposeBeaconOwnershipTransfer(address _newOwner) external {
        DiamondStorageLib.enforceIsContractOwner();
        require(_newOwner != msg.sender, "Can't propose oneself as a contract owner");
        DiamondStorageLib.setProposedOwner(_newOwner);

        emit OwnershipProposalCreated(msg.sender, _newOwner);
    }

    function proposeBeaconPauseAdminOwnershipTransfer(address _newPauseAdmin) external {
        DiamondStorageLib.enforceIsPauseAdmin();
        require(_newPauseAdmin != msg.sender, "Can't propose oneself as a contract pauseAdmin");
        DiamondStorageLib.setProposedPauseAdmin(_newPauseAdmin);

        emit PauseAdminOwnershipProposalCreated(msg.sender, _newPauseAdmin);
    }

    function acceptBeaconOwnership() external {
        require(DiamondStorageLib.proposedOwner() == msg.sender, "Only a proposed user can accept ownership");
        DiamondStorageLib.setContractOwner(msg.sender);
        DiamondStorageLib.setProposedOwner(address(0));

        emit OwnershipProposalAccepted(msg.sender);
    }

    function acceptBeaconPauseAdminOwnership() external {
        require(DiamondStorageLib.proposedPauseAdmin() == msg.sender, "Only a proposed user can accept ownership");
        DiamondStorageLib.setContractPauseAdmin(msg.sender);
        DiamondStorageLib.setProposedPauseAdmin(address(0));

        emit PauseAdminOwnershipProposalAccepted(msg.sender);
    }

    modifier notPausedOrUpgrading(bytes4 funcSignature) {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        if(!ds._active){
            if(!ds.canBeExecutedWhenPaused[funcSignature]){
                revert("ProtocolUpgrade: paused.");
            }
        }
        _;
    }

    /**
     * @dev emitted after creating a pauseAdmin transfer proposal by the pauseAdmin
     * @param pauseAdmin address of the current pauseAdmin
     * @param proposed address of the proposed pauseAdmin
     **/
    event PauseAdminOwnershipProposalCreated(address indexed pauseAdmin, address indexed proposed);

    /**
     * @dev emitted after accepting a pauseAdmin transfer proposal by the new pauseAdmin
     * @param newPauseAdmin address of the new pauseAdmin
     **/
    event PauseAdminOwnershipProposalAccepted(address indexed newPauseAdmin);

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