// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../TokenManager.sol";

contract MockTokenManager is TokenManager {
    address factoryAddress;

    function setFactoryAddress(address _newAddress) external {
        factoryAddress = _newAddress;
    }

    function getSmartLoansFactoryAddress() public view override returns (address) {
        return factoryAddress;
    }
}
