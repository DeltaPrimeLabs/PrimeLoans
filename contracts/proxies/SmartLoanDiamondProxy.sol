// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./openzeppelinVirtual/BeaconProxyVirtual.sol";

/**
 * @dev This is a copy of OpenZeppelin BeaconProxy (https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/beacon/BeaconProxy.sol) contract.
 * The only difference is usage of overriding the ERC1967Upgrade._upgradeBeaconToAndCall and BeaconProxy._implementation() methods.
 */

contract SmartLoanDiamondProxy is BeaconProxyVirtual {
    constructor(address beacon, bytes memory data) payable BeaconProxyVirtual(beacon, data) {}

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable override {}

    /**
     * @dev Returns the current implementation address of the associated beacon.
     */
    function _implementation() internal view virtual override returns (address) {
        return IDiamondBeacon(_getBeacon()).implementation(msg.sig);
    }

    /**
     * @dev Perform beacon upgrade with additional setup call. Note: This upgrades the address of the beacon, it does
     * not upgrade the implementation contained in the beacon (see {UpgradeableBeacon-_setImplementation} for that).
     *
     * Emits a {BeaconUpgraded} event.
     */
    function _upgradeBeaconToAndCall(
        address newBeacon,
        bytes memory data,
        bool forceCall
    ) internal override {
        _setBeacon(newBeacon);
        emit BeaconUpgraded(newBeacon);
        if (data.length > 0 || forceCall) {
            // 0xc4d66de8 = initialize(address owner)
            Address.functionDelegateCall(IDiamondBeacon(newBeacon).implementation(0xc4d66de8), data);
        }
    }
}