// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/facets/avalanche/IGMDFacet.sol";
import "../../interfaces/facets/IGMDVault.sol";
//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract GMDFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent{
    using TransferHelper for address;

    // CONSTANTS

    address private constant GMDVaultAddress = 0x5517c5F22177BcF7b320A2A5daF2334344eFb38C;

    // PUBLIC FUNCTIONS

    function gmdStakeUSDC(uint256 amountStaked, uint256 minSharesOut) public {
        IGMDFacet.StakingDetails memory position = IGMDFacet.StakingDetails({
            asset : 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E,
            receiptToken: 0x33f0a866d9024d44de2E0602f4C9B94755944B6F,
            symbol : "USDC",
            identifier : "gmdUSDC",
            amountStaked: amountStaked,
            minSharesOut: minSharesOut,
            pid: 0
        });
        gmdStakeToken(position);
    }

    function gmdStakeAVAX(uint256 amountStaked, uint256 minSharesOut) public {
        IGMDFacet.StakingDetails memory position = IGMDFacet.StakingDetails({
            asset : 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            receiptToken: 0x13AF25f924056d4D4668705C33aB9b70D505050e,
            symbol : "AVAX",
            identifier : "gmdWAVAX",
            amountStaked: amountStaked,
            minSharesOut: minSharesOut,
            pid: 1
        });
        gmdStakeToken(position);
    }

    function gmdStakeBTCb(uint256 amountStaked, uint256 minSharesOut) public {
        IGMDFacet.StakingDetails memory position = IGMDFacet.StakingDetails({
            asset : 0x152b9d0FdC40C096757F570A51E494bd4b943E50,
            receiptToken: 0x8fe3024351B9a51a3439183e940c2aF3994DD52F,
            symbol : "BTC",
            identifier : "gmdBTCb",
            amountStaked: amountStaked,
            minSharesOut: minSharesOut,
            pid: 2
        });
        gmdStakeToken(position);
    }

    function gmdStakeWETHe(uint256 amountStaked, uint256 minSharesOut) public {
        IGMDFacet.StakingDetails memory position = IGMDFacet.StakingDetails({
            asset : 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB,
            receiptToken: 0xE28c95e9EB0f6D16b05D265cAa4BcEE9E5C2e625,
            symbol : "ETH",
            identifier : "gmdWETHe",
            amountStaked: amountStaked,
            minSharesOut: minSharesOut,
            pid: 3
        });
        gmdStakeToken(position);
    }

    // PUBLIC FUNCTIONS

    function gmdUnstakeUSDC(uint256 amountUnstaked, uint256 minTokenOut) public {
        IGMDFacet.UnstakingDetails memory position = IGMDFacet.UnstakingDetails({
            asset : 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E,
            receiptToken: 0x33f0a866d9024d44de2E0602f4C9B94755944B6F,
            symbol : "USDC",
            identifier : "gmdUSDC",
            amountUnstaked: amountUnstaked,
            minTokenOut: minTokenOut,
            pid: 0
        });
        gmdUnstakeToken(position);
    }

    function gmdUnstakeAVAX(uint256 amountUnstaked, uint256 minTokenOut) public {
        IGMDFacet.UnstakingDetails memory position = IGMDFacet.UnstakingDetails({
            asset : 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            receiptToken: 0x13AF25f924056d4D4668705C33aB9b70D505050e,
            symbol : "AVAX",
            identifier : "gmdWAVAX",
            amountUnstaked: amountUnstaked,
            minTokenOut: minTokenOut,
            pid: 1
            });
        gmdUnstakeToken(position);
    }

    function gmdUnstakeBTCb(uint256 amountUnstaked, uint256 minTokenOut) public {
        IGMDFacet.UnstakingDetails memory position = IGMDFacet.UnstakingDetails({
            asset : 0x152b9d0FdC40C096757F570A51E494bd4b943E50,
            receiptToken: 0x8fe3024351B9a51a3439183e940c2aF3994DD52F,
            symbol : "BTC",
            identifier : "gmdBTCb",
            amountUnstaked: amountUnstaked,
            minTokenOut: minTokenOut,
            pid: 2
        });
        gmdUnstakeToken(position);
    }

    function gmdUnstakeWETHe(uint256 amountUnstaked, uint256 minTokenOut) public {
        IGMDFacet.UnstakingDetails memory position = IGMDFacet.UnstakingDetails({
        asset : 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB,
        receiptToken: 0xE28c95e9EB0f6D16b05D265cAa4BcEE9E5C2e625,
        symbol : "ETH",
        identifier : "gmdWETHe",
        amountUnstaked: amountUnstaked,
        minTokenOut: minTokenOut,
        pid: 3
        });
        gmdUnstakeToken(position);
    }

    // INTERNAL FUNCTIONS
    /**
    * Stakes token in GMD
    * @dev This function uses the redstone-evm-connector
    **/
    function gmdStakeToken(IGMDFacet.StakingDetails memory position) internal
    onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent {
        IGMDVault vault = IGMDVault(GMDVaultAddress);
        IERC20Metadata stakedToken = getERC20TokenInstance(position.symbol, false);
        IERC20Metadata receiptToken = IERC20Metadata(position.receiptToken);
        uint256 initialReceiptTokenBalance = receiptToken.balanceOf(address(this));

        uint256 amountStaked = Math.min(stakedToken.balanceOf(address(this)), position.amountStaked);
        require(amountStaked > 0, "Cannot stake 0 tokens");

        address(stakedToken).safeApprove(GMDVaultAddress, 0);
        address(stakedToken).safeApprove(GMDVaultAddress, amountStaked);

        vault.enter(amountStaked, position.pid);

        uint256 sharesReceived = receiptToken.balanceOf(address(this)) - initialReceiptTokenBalance;
        require(sharesReceived >= position.minSharesOut, "Insufficient shares output");

        DiamondStorageLib.addOwnedAsset(position.identifier, position.receiptToken);
        if (stakedToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(position.symbol);
        }

        emit Staked(
            msg.sender,
            position.symbol,
            address(position.receiptToken),
            amountStaked,
            sharesReceived,
            block.timestamp
        );
    }

    /**
    * Unstakes token from GMD
    * IMPORTANT: This method can be used by anyone when a loan is insolvent. This operation can be gas-costly, that is why
    * it may be necessary to perform it in a separate transaction to liquidation
    * @dev This function uses the redstone-evm-connector
    **/
    function gmdUnstakeToken(IGMDFacet.UnstakingDetails memory position) internal
    onlyOwnerOrInsolvent recalculateAssetsExposure nonReentrant {
        IGMDVault vault = IGMDVault(GMDVaultAddress);
        IERC20Metadata unstakedToken = getERC20TokenInstance(position.symbol, false);
        IERC20Metadata receiptToken = IERC20Metadata(position.receiptToken);

        uint256 amountUnstaked = Math.min(receiptToken.balanceOf(address(this)), position.amountUnstaked);
        require(amountUnstaked > 0, "Cannot unstake 0 tokens");

        uint256 initialUnstakedTokenBalance = unstakedToken.balanceOf(address(this));

        vault.leave(amountUnstaked, position.pid);

        uint256 receivedUnstakedToken = unstakedToken.balanceOf(address(this)) - initialUnstakedTokenBalance;
        require(receivedUnstakedToken >= position.minTokenOut, "Insufficient staked token output");

        if (receiptToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(position.identifier);
        }
        DiamondStorageLib.addOwnedAsset(position.symbol, address(unstakedToken));

        emit Unstaked(
            msg.sender,
            position.symbol,
            address(position.receiptToken),
            receivedUnstakedToken,
            amountUnstaked,
            block.timestamp
        );
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of receipt token
        * @param depositTokenAmount how much of deposit token was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of receipt token
        * @param depositTokenAmount how much deposit token was unstaked
        * @param receiptTokenAmount how much receipt token was redeemed
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);
}
