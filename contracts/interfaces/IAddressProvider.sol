// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAddressProvider {
    function getRecoveryContract() external view returns (address);
}
