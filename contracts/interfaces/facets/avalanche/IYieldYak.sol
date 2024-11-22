// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IYieldYak {
    function totalDeposits() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function withdraw(uint256 amount) external;

    function depositFor(address account) external payable;

    function depositFor(address account, uint256 amount) external;

    function deposit() external payable;

    function depositToken() external view returns (address);

    function deposit(uint256 amount) external;

    function decimals() external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    // ---INTERFACE-----
    struct YYStakingDetails {
        address tokenAddress;
        address vaultAddress;
        bytes32 tokenSymbol;
        bytes32 vaultTokenSymbol;
        uint256 amount;
    }
}