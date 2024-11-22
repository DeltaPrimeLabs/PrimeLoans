// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: b5c62dcabdd9dc6577cb12be92681b37cadb26c9;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../lib/SolvencyMethods.sol";
import "../../interfaces/facets/arbitrum/IMiniChef.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../OnlyOwnerOrInsolvent.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IWrappedNativeToken.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract SushiSwapFacet is
    ReentrancyGuardKeccak,
    SolvencyMethods,
    OnlyOwnerOrInsolvent
{
    using TransferHelper for address payable;
    using TransferHelper for address;

    // MiniChefV2
    address private constant MINICHEF =
        0xF4d73326C13a4Fc5FD7A064217e12780e9Bd62c3;

    // Sushi Token
    address private constant SUSHI_TOKEN =
        0xd4d42F0b6DEF4CE0383636770eF773390d85c61A;

    // PUBLIC FUNCTIONS

    /**
     * Stakes USDT in Yield Yak protocol
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDT to be staked
     **/
    function sushiStakeDpxEthLp(
        uint256 amount
    ) public onlyOwner nonReentrant remainsSolvent {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: 0x0C1Cf6883efA1B496B01f654E247B9b419873054,
                symbol: "SUSHI_DPX_ETH_LP",
                identifier: "SUSHI_DPX_ETH_LP_AUTO",
                balanceSelector: this.sushiDpxEthLpBalance.selector,
                unstakeSelector: this.sushiUnstakeDpxEthLp.selector
            });
        _stakeToken(amount, position, 17);
    }

    /**
     * Unstakes USDT from Yield Yak protocol
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDT to be unstaked
     **/
    function sushiUnstakeDpxEthLp(
        uint256 amount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: 0x0C1Cf6883efA1B496B01f654E247B9b419873054,
                symbol: "SUSHI_DPX_ETH_LP",
                identifier: "SUSHI_DPX_ETH_LP_AUTO",
                balanceSelector: this.sushiDpxEthLpBalance.selector,
                unstakeSelector: this.sushiUnstakeDpxEthLp.selector
            });
        _unstakeToken(amount, minAmount, position, 17);
    }

    function sushiDpxEthLpBalance() public view returns (uint256 _stakedBalance) {
        return IMiniChef(MINICHEF).userInfo(17, address(this)).amount;
    }

    // ----- PRIVATE METHODS -----

    /**
     * Stakes {position.asset} token in the SushiSwap MiniChefV2
     * @dev This function uses the redstone-evm-connector
     * @param amount The amount of tokens to stake
     * @param position IStakingPositions.StakedPosition staking details
     * @param pid Pool ID
     **/
    function _stakeToken(
        uint256 amount,
        IStakingPositions.StakedPosition memory position,
        uint256 pid
    ) private recalculateAssetsExposure {
        IMiniChef miniChef = IMiniChef(MINICHEF);
        IERC20Metadata stakedToken = getERC20TokenInstance(position.symbol, false);
        uint256 initialReceiptTokenBalance = miniChef
            .userInfo(pid, address(this))
            .amount;

        amount = Math.min(stakedToken.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot stake 0 tokens");

        address(stakedToken).safeApprove(MINICHEF, 0);
        address(stakedToken).safeApprove(MINICHEF, amount);

        miniChef.deposit(pid, amount, address(this));

        DiamondStorageLib.addStakedPosition(position);

        if (stakedToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(position.symbol);
        }

        emit Staked(
            msg.sender,
            position.symbol,
            MINICHEF,
            amount,
            miniChef.userInfo(pid, address(this)).amount - initialReceiptTokenBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes {position.asset} token from the SushiSwap MiniChefV2
     * @dev This function uses the redstone-evm-connector
     * @param amount The amount of tokens to unstake
     * @param minAmount The minimum amount of tokens to unstake
     * @param position IStakingPositions.StakedPosition staking details
     * @param pid Pool ID
     **/
    function _unstakeToken(
        uint256 amount,
        uint256 minAmount,
        IStakingPositions.StakedPosition memory position,
        uint256 pid
    ) private recalculateAssetsExposure returns (uint256 unstaked) {
        IMiniChef miniChef = IMiniChef(MINICHEF);
        IERC20Metadata unstakedToken = getERC20TokenInstance(
            position.symbol,
            false
        );
        uint256 initialReceiptTokenBalance = miniChef
            .userInfo(pid, address(this))
            .amount;

        amount = Math.min(initialReceiptTokenBalance, amount);

        require(amount > 0, "Cannot unstake 0 tokens");

        uint256 balance = unstakedToken.balanceOf(address(this));

        miniChef.withdraw(pid, amount, address(this));

        uint256 newBalance = unstakedToken.balanceOf(address(this));

        require(newBalance >= balance + minAmount, "too little received");

        uint256 newReceiptTokenBalance = miniChef
            .userInfo(pid, address(this))
            .amount;

        // Add/remove owned tokens
        if (newReceiptTokenBalance == 0) {
            DiamondStorageLib.removeStakedPosition(position.identifier);
        }
        DiamondStorageLib.addOwnedAsset(position.symbol, address(unstakedToken));

        emit Unstaked(
            msg.sender,
            position.symbol,
            MINICHEF,
            newBalance - balance,
            initialReceiptTokenBalance - newReceiptTokenBalance,
            block.timestamp
        );

        _handleRewards(pid);

        return newBalance - balance;
    }

    function _handleRewards(uint256 pid) internal {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        IMiniChef miniChef = IMiniChef(MINICHEF);
        uint256 pendingSushi = miniChef.pendingSushi(pid, address(this));
        IRewarder rewarder = miniChef.rewarder(pid);
        address[] memory rewardTokens;
        if (address(rewarder) != address(0)) {
            (rewardTokens, ) = rewarder.pendingTokens(
                pid,
                address(this),
                pendingSushi
            );
        }

        miniChef.harvest(pid, address(this));

        bytes32 rewardTokenSymbol = tokenManager.tokenAddressToSymbol(SUSHI_TOKEN);
        if (
            rewardTokenSymbol != "" &&
            IERC20(SUSHI_TOKEN).balanceOf(address(this)) > 0
        ) {
            DiamondStorageLib.addOwnedAsset(rewardTokenSymbol, SUSHI_TOKEN);
        }

        uint256 rewardLength = rewardTokens.length;
        for (uint256 i; i != rewardLength; ++i) {
            address rewardToken = rewardTokens[i];
            rewardTokenSymbol = tokenManager.tokenAddressToSymbol(rewardToken);
            if (rewardTokenSymbol == "") {
                emit UnsupportedRewardToken(msg.sender, rewardToken, block.timestamp);
                continue;
            }
            if (IERC20(rewardToken).balanceOf(address(this)) > 0) {
                DiamondStorageLib.addOwnedAsset(rewardTokenSymbol, rewardToken);
            }
        }
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
     * @dev emitted when user stakes an asset
     * @param user the address executing staking
     * @param asset the asset that was staked
     * @param vault address of the vault token
     * @param depositTokenAmount how much of deposit token was staked
     * @param receiptTokenAmount how much of receipt token was received
     * @param timestamp of staking
     **/
    event Staked(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositTokenAmount,
        uint256 receiptTokenAmount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user unstakes an asset
     * @param user the address executing unstaking
     * @param vault address of the vault token
     * @param asset the asset that was unstaked
     * @param depositTokenAmount how much deposit token was received
     * @param receiptTokenAmount how much receipt token was unstaked
     * @param timestamp of unstaking
     **/
    event Unstaked(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositTokenAmount,
        uint256 receiptTokenAmount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user collects rewards in tokens that are not supported
     * @param user the address collecting rewards
     * @param asset reward token that was collected
     * @param timestamp of collecting rewards
     **/
    event UnsupportedRewardToken(
        address indexed user,
        address indexed asset,
        uint256 timestamp
    );
}
