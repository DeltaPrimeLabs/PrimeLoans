// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title DeltaPrime Address Provider
contract AddressProvider is OwnableUpgradeable {
    mapping(bytes32 => address) private addresses;

    bytes32 public constant RECOVERY_CONTRACT = "RECOVERY_CONTRACT";

    event RecoveryContractUpdated(address indexed rc);

    function initialize() external initializer {
        __Ownable_init();
    }

    /// @notice Set recovery contract address
    /// @param rc New recovery contract address
    function setRecoveryContract(address rc) external onlyOwner {
        _setAddress(RECOVERY_CONTRACT, rc);

        emit RecoveryContractUpdated(rc);
    }

    /// @notice Get recovery contract address
    function getRecoveryContract() external view returns (address) {
        return _getAddress(RECOVERY_CONTRACT);
    }

    /// @dev Set address
    /// @param key Key used to store address
    /// @param addr Address to set
    function _setAddress(bytes32 key, address addr) internal {
        addresses[key] = addr;
    }

    /// @dev Get address
    /// @param key Key used to get address
    function _getAddress(bytes32 key) internal view returns (address) {
        return addresses[key];
    }
}
