// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

interface IBeefyFinance {
    // -- Deposit/Withdraw underlying LP token --
    function depositAll() external;

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function withdrawAll() external;

    // ------------------------------------------

    // User's balance of the vault's token
    function balanceOf(address account) external view returns (uint256);

    // Vault's balance of the underlying token
    function balance() external view returns (uint256);

    // Total supply of the vault's token
    function totalSupply() external view returns (uint256);

    // Decimals of the vault's token
    function decimals() external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    // ---INTERFACE-----
    struct BeefyStakingDetails {
        address lpTokenAddress;
        address vaultAddress;
        bytes32 lpTokenSymbol;
        bytes32 vaultTokenSymbol;
        uint256 amount;
    }

}