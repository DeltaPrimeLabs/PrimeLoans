// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.17;

interface IWrappedNativeToken {

    function balanceOf(address account) external view returns (uint);

    function deposit() external payable;

    function withdraw(uint wad) external;

    function totalSupply() external view returns (uint);

    function approve(address guy, uint wad) external returns (bool);

    function transfer(address dst, uint wad) external returns (bool);

    function transferFrom(address src, address dst, uint wad) external returns (bool);

}