// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/IPendingOwnableUpgradeable.sol";

abstract contract PendingOwnableUpgradeable is OwnableUpgradeable, IPendingOwnableUpgradeable {
    // keccak256("pending.owner.slot") = 0x63a0d9df49fae3f1b9d24f8dc819a568c429a1b11d0d8e9de63df53a0194acb2
    bytes32 private constant _PENDING_OWNER_SLOT = 0x63a0d9df49fae3f1b9d24f8dc819a568c429a1b11d0d8e9de63df53a0194acb2;

    event OwnershipTransferRequested(address indexed from, address indexed to);

    function __PendingOwnable_init() internal onlyInitializing {
        __Ownable_init();
    }

    function transferOwnership(address newOwner) public virtual override(OwnableUpgradeable, IPendingOwnableUpgradeable) onlyOwner {
        require(newOwner != address(0), "PendingOwnable: new owner is the zero address");
        _setPendingOwner(newOwner);
        emit OwnershipTransferRequested(owner(), newOwner);
    }

    function acceptOwnership() public virtual override {
        address pendingOwner = _getPendingOwner();
        require(msg.sender == pendingOwner, "PendingOwnable: caller is not the pending owner");
        _transferOwnership(pendingOwner);
        _setPendingOwner(address(0));
    }

    function pendingOwner() public view virtual override returns (address) {
        return _getPendingOwner();
    }

    function _getPendingOwner() internal view returns (address) {
        address pendingOwner;
        bytes32 slot = _PENDING_OWNER_SLOT;
        assembly {
            pendingOwner := sload(slot)
        }
        return pendingOwner;
    }

    function _setPendingOwner(address newOwner) private {
        bytes32 slot = _PENDING_OWNER_SLOT;
        assembly {
            sstore(slot, newOwner)
        }
    }
}