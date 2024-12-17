// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/facets/avalanche/IWombatPool.sol";
import "../../interfaces/facets/avalanche/IWombatMaster.sol";
import "../../interfaces/facets/avalanche/IWombatRouter.sol";
import "../../interfaces/facets/avalanche/IRewarder.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/IWrappedNativeToken.sol";
import "../../lib/local/DeploymentConstants.sol";

contract WombatFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // Protocol addresses
    address private constant WOM_TOKEN = 0xa15E4544D141aa98C4581a1EA10Eb9048c3b3382;
    address private constant WOMBAT_ROUTER = 0x4A88C44B8D9B9f3F2BA4D97236F737CF03DF76CD;
    address private constant WOMBAT_MASTER = 0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b;
    address private constant SAVAX_AVAX_POOL = 0xE3Abc29B035874a9f6dCDB06f8F20d9975069D87;
    address private constant GGAVAX_AVAX_POOL = 0xBbA43749efC1bC29eA434d88ebaf8A97DC7aEB77;

    // LP token identifiers
    bytes32 private constant WOMBAT_ggAVAX_AVAX_LP_AVAX = "WOMBAT_ggAVAX_AVAX_LP_AVAX";
    bytes32 private constant WOMBAT_ggAVAX_AVAX_LP_ggAVAX = "WOMBAT_ggAVAX_AVAX_LP_ggAVAX";
    bytes32 private constant WOMBAT_sAVAX_AVAX_LP_AVAX = "WOMBAT_sAVAX_AVAX_LP_AVAX";
    bytes32 private constant WOMBAT_sAVAX_AVAX_LP_sAVAX = "WOMBAT_sAVAX_AVAX_LP_sAVAX";

    error RewardValidationFailed(address token, uint256 expected, uint256 actual);

    struct RewardSnapshot {
        address token;
        uint256 balanceBefore;
    }

    struct DepositVars {
        IERC20Metadata stakeToken;
        IERC20Metadata lpToken;
        uint256 amount;
        uint256 pid;
    }

    function depositSavaxToAvaxSavax(uint256 amount, uint256 minLpOut) external {
        _depositToken(
            "sAVAX",
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            SAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.sAvaxBalanceAvaxSavax.selector,
            this.withdrawSavaxFromAvaxSavax.selector
        );
    }

    function withdrawSavaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
            "sAVAX",
            "sAVAX",
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            SAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function sAvaxBalanceAvaxSavax()
    external
    view
    returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_sAVAX_AVAX_LP_sAVAX);
    }

    function depositGgavaxToAvaxGgavax(
        uint256 amount,
        uint256 minLpOut
    ) external {
        _depositToken(
            "ggAVAX",
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            GGAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.ggAvaxBalanceAvaxGgavax.selector,
            this.withdrawGgavaxFromAvaxGgavax.selector
        );
    }

    function withdrawGgavaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
            "ggAVAX",
            "ggAVAX",
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            GGAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function ggAvaxBalanceAvaxGgavax()
    external
    view
    returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_ggAVAX_AVAX_LP_ggAVAX);
    }

    function depositAvaxToAvaxSavax(uint256 amount, uint256 minLpOut) external {
        _depositNative(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            SAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.avaxBalanceAvaxSavax.selector,
            this.withdrawAvaxFromAvaxSavax.selector
        );
    }

    function withdrawAvaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
            "AVAX",
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            SAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function avaxBalanceAvaxSavax()
    external
    view
    returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_sAVAX_AVAX_LP_AVAX);
    }

    function depositAvaxToAvaxGgavax(uint256 amount, uint256 minLpOut) external {
        _depositNative(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            GGAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.avaxBalanceAvaxGgavax.selector,
            this.withdrawAvaxFromAvaxGgavax.selector
        );
    }

    function withdrawAvaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
            "AVAX",
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            GGAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function avaxBalanceAvaxGgavax()
    external
    view
    returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_ggAVAX_AVAX_LP_AVAX);
    }

    function withdrawSavaxFromAvaxSavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
            "AVAX",
            "sAVAX",
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            SAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function withdrawGgavaxFromAvaxGgavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
            "AVAX",
            "ggAVAX",
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            GGAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function withdrawAvaxFromAvaxSavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
            "sAVAX",
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            SAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function withdrawAvaxFromAvaxGgavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
            "ggAVAX",
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            GGAVAX_AVAX_POOL,
            amount,
            minOut
        );
    }

    function depositAndStakeAvaxSavaxLpSavax(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            amount,
            this.sAvaxBalanceAvaxSavax.selector,
            this.withdrawSavaxFromAvaxSavax.selector
        );
    }

    function depositAndStakeAvaxSavaxLpAvax(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            amount,
            this.avaxBalanceAvaxSavax.selector,
            this.withdrawAvaxFromAvaxSavax.selector
        );
    }

    function depositAvaxGgavaxLpGgavax(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            amount,
            this.ggAvaxBalanceAvaxGgavax.selector,
            this.withdrawGgavaxFromAvaxGgavax.selector
        );
    }

    function depositAndStakeAvaxGgavaxLpAvax(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            amount,
            this.avaxBalanceAvaxGgavax.selector,
            this.withdrawAvaxFromAvaxGgavax.selector
        );
    }

    function claimAllWombatRewards() external onlyOwner nonReentrant remainsSolvent {
        bytes32[4] memory lpAssets = [
                    WOMBAT_ggAVAX_AVAX_LP_AVAX,
                    WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
                    WOMBAT_sAVAX_AVAX_LP_AVAX,
                    WOMBAT_sAVAX_AVAX_LP_sAVAX
            ];

        for (uint256 i; i != 4; ++i) {
            IERC20Metadata lpToken = getERC20TokenInstance(lpAssets[i], false);
            uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));

            // Take reward token balance snapshots BEFORE withdrawal
            RewardSnapshot[] memory snapshots = _captureRewardSnapshots(pid);

            // Get pending rewards
            (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
                WOMBAT_MASTER
            ).withdraw(pid, 0);

            // Handle rewards with the snapshots taken before withdrawal
            handleRewards(pid, reward, additionalRewards, snapshots);
        }
    }

    function pendingRewardsForAvaxSavaxLpSavax()
    external
    view
    returns (
        address[] memory rewardTokenAddresses,
        uint256[] memory pendingRewards
    )
    {
        return _pendingRewardsForLp(WOMBAT_sAVAX_AVAX_LP_sAVAX);
    }

    function pendingRewardsForAvaxSavaxLpAvax()
    external
    view
    returns (
        address[] memory rewardTokenAddresses,
        uint256[] memory pendingRewards
    )
    {
        return _pendingRewardsForLp(WOMBAT_sAVAX_AVAX_LP_AVAX);
    }

    function pendingRewardsForAvaxGgavaxLpGgavax()
    external
    view
    returns (
        address[] memory rewardTokenAddresses,
        uint256[] memory pendingRewards
    )
    {
        return _pendingRewardsForLp(WOMBAT_ggAVAX_AVAX_LP_ggAVAX);
    }

    function pendingRewardsForAvaxGgavaxLpAvax()
    external
    view
    returns (
        address[] memory rewardTokenAddresses,
        uint256[] memory pendingRewards
    )
    {
        return _pendingRewardsForLp(WOMBAT_ggAVAX_AVAX_LP_AVAX);
    }

    function _pendingRewardsForLp(
        bytes32 lpAsset
    ) internal view returns (address[] memory, uint256[] memory) {
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));
        (
            uint256 pendingWomRewards,
            address[] memory rewardTokenAddresses_,
            ,
            uint256[] memory pendingRewards_
        ) = IWombatMaster(WOMBAT_MASTER).pendingTokens(pid, address(this));

        address[] memory rewardTokenAddresses = new address[](
            rewardTokenAddresses_.length + 1
        );
        uint256[] memory pendingRewards = new uint256[](pendingRewards_.length + 1);

        rewardTokenAddresses[0] = WOM_TOKEN;
        pendingRewards[0] = pendingWomRewards;

        for (uint256 i; i != rewardTokenAddresses_.length; ++i) {
            rewardTokenAddresses[i + 1] = rewardTokenAddresses_[i];
        }
        for (uint256 i; i != pendingRewards_.length; ++i) {
            pendingRewards[i + 1] = pendingRewards_[i];
        }

        return (rewardTokenAddresses, pendingRewards);
    }

    function _depositToken(
        bytes32 stakeAsset,
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minLpOut,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent noBorrowInTheSameBlock {
        DepositVars memory vars;
        vars.stakeToken = getERC20TokenInstance(stakeAsset, false);
        vars.lpToken = getERC20TokenInstance(lpAsset, false);
        vars.amount = Math.min(vars.stakeToken.balanceOf(address(this)), amount);

        require(_getAvailableBalance(stakeAsset) >= vars.amount, "Insufficient balance");
        require(vars.amount > 0, "Cannot deposit 0 tokens");

        address(vars.stakeToken).safeApprove(pool, 0);
        address(vars.stakeToken).safeApprove(pool, vars.amount);

        IWombatPool(pool).deposit(
            address(vars.stakeToken),
            vars.amount,
            minLpOut,
            address(this),
            block.timestamp,
            true
        );

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(vars.stakeToken), vars.amount);

        _addStakingPosition(vars.lpToken, lpAsset, balanceSelector, unstakeSelector);
    }

    struct TokensDetails {
        IERC20Metadata fromToken;
        IERC20Metadata toToken;
        IERC20Metadata lpToken;
    }

    function _withdrawToken(
        bytes32 fromAsset,
        bytes32 toAsset,
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minOut
    ) internal onlyOwnerOrInsolvent nonReentrant noBorrowInTheSameBlock returns (uint256 amountOut) {
        TokensDetails memory tokensDetails;
        tokensDetails.fromToken = getERC20TokenInstance(fromAsset, false);
        tokensDetails.toToken = getERC20TokenInstance(toAsset, false);
        tokensDetails.lpToken = getERC20TokenInstance(lpAsset, false);

        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(tokensDetails.lpToken));

        amount = Math.min(amount, getLpTokenBalance(lpAsset));
        require(amount > 0, "Cannot withdraw 0 tokens");

        RewardSnapshot[] memory snapshots = _captureRewardSnapshots(pid);

        (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
            WOMBAT_MASTER
        ).withdraw(pid, amount);

        address(tokensDetails.lpToken).safeApprove(pool, 0);
        address(tokensDetails.lpToken).safeApprove(pool, amount);

        if (fromAsset == toAsset) {
            amountOut = IWombatPool(pool).withdraw(
                address(tokensDetails.fromToken),
                amount,
                minOut,
                address(this),
                block.timestamp
            );
        } else {
            amountOut = IWombatPool(pool).withdrawFromOtherAsset(
                address(tokensDetails.fromToken),
                address(tokensDetails.toToken),
                amount,
                minOut,
                address(this),
                block.timestamp
            );
        }

        if (getLpTokenBalance(lpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(lpAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(tokensDetails.toToken), amountOut);
        handleRewards(pid, reward, additionalRewards, snapshots);
    }

    function _depositNative(
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minLpOut,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent noBorrowInTheSameBlock {
        IWrappedNativeToken wrapped = IWrappedNativeToken(
            DeploymentConstants.getNativeToken()
        );
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);

        amount = Math.min(wrapped.balanceOf(address(this)), amount);
        require(_getAvailableBalance(DeploymentConstants.getNativeTokenSymbol()) >= amount, "Insufficient balance");
        require(amount > 0, "Cannot deposit 0 tokens");

        wrapped.withdraw(amount);

        IWombatRouter(WOMBAT_ROUTER).addLiquidityNative{value: amount}(
            pool,
            minLpOut,
            address(this),
            block.timestamp,
            true
        );

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(wrapped), amount);

        _addStakingPosition(lpToken, lpAsset, balanceSelector, unstakeSelector);
    }

    struct TokensDetailsWithNative {
        IERC20Metadata fromToken;
        IERC20Metadata lpToken;
        IWrappedNativeToken wrapped;
    }

    function _withdrawNative(
        bytes32 fromAsset,
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minOut
    ) internal onlyOwnerOrInsolvent nonReentrant noBorrowInTheSameBlock returns (uint256 amountOut) {
        TokensDetailsWithNative memory tokensDetailsWithNative;
        tokensDetailsWithNative.fromToken = getERC20TokenInstance(fromAsset, false);
        tokensDetailsWithNative.lpToken = getERC20TokenInstance(lpAsset, false);
        tokensDetailsWithNative.wrapped = IWrappedNativeToken(
            DeploymentConstants.getNativeToken()
        );

        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(tokensDetailsWithNative.lpToken));

        amount = Math.min(amount, getLpTokenBalance(lpAsset));
        require(_getAvailableBalance(lpAsset) >= amount, "Insufficient balance");
        require(amount > 0, "Cannot withdraw 0 tokens");

        RewardSnapshot[] memory snapshots = _captureRewardSnapshots(pid);
        uint256 wrappedBalanceBefore = tokensDetailsWithNative.wrapped.balanceOf(address(this));

        (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
            WOMBAT_MASTER
        ).withdraw(pid, amount);

        address(tokensDetailsWithNative.lpToken).safeApprove(WOMBAT_ROUTER, 0);
        address(tokensDetailsWithNative.lpToken).safeApprove(WOMBAT_ROUTER, amount);

        if (fromAsset == bytes32("AVAX")) {
            amountOut = IWombatRouter(WOMBAT_ROUTER).removeLiquidityNative(
                pool,
                amount,
                minOut,
                address(this),
                block.timestamp
            );
        } else {
            amountOut = IWombatRouter(WOMBAT_ROUTER)
                .removeLiquidityFromOtherAssetAsNative(
                pool,
                address(tokensDetailsWithNative.fromToken),
                amount,
                minOut,
                address(this),
                block.timestamp
            );
        }

        require(address(this).balance >= amountOut, "Insufficient AVAX received");
        tokensDetailsWithNative.wrapped.deposit{value: amountOut}();

        uint256 wrappedBalanceAfter = tokensDetailsWithNative.wrapped.balanceOf(address(this));
        require(
            wrappedBalanceAfter >= wrappedBalanceBefore + amountOut,
            "Wrapped balance mismatch"
        );

        if (getLpTokenBalance(lpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(lpAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(tokensDetailsWithNative.wrapped), amountOut);
        handleRewards(pid, reward, additionalRewards, snapshots);
    }

    function _depositAndStakeWombatLP(
        bytes32 lpAsset,
        uint256 amount,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent noBorrowInTheSameBlock {
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);

        amount = Math.min(amount, lpToken.balanceOf(msg.sender));
        require(amount > 0, "Cannot deposit 0 tokens");

        address(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        address(lpToken).safeApprove(WOMBAT_MASTER, 0);
        address(lpToken).safeApprove(WOMBAT_MASTER, amount);

        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));

        IWombatMaster(WOMBAT_MASTER).deposit(pid, amount);

        _addStakingPosition(lpToken, lpAsset, balanceSelector, unstakeSelector);
    }


    function _addStakingPosition(
        IERC20Metadata lpToken,
        bytes32 lpAsset,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: address(lpToken),
            symbol: lpAsset,
            identifier: lpAsset,
            balanceSelector: balanceSelector,
            unstakeSelector: unstakeSelector
        });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _captureRewardSnapshots(uint256 pid) internal view returns (RewardSnapshot[] memory) {
        (, , address rewarder, , , , ) = IWombatMaster(WOMBAT_MASTER).poolInfo(pid);
        address boostedRewarder = IWombatMaster(WOMBAT_MASTER).boostedRewarders(pid);

        // Count total number of reward tokens
        uint256 totalRewards = 1; // WOM token

        address[] memory baseRewardTokens;
        if (rewarder != address(0)) {
            baseRewardTokens = IRewarder(rewarder).rewardTokens();
            totalRewards += baseRewardTokens.length;
        }

        address[] memory boostedRewardTokens;
        if (boostedRewarder != address(0)) {
            boostedRewardTokens = IRewarder(boostedRewarder).rewardTokens();
            totalRewards += boostedRewardTokens.length;
        }

        RewardSnapshot[] memory snapshots = new RewardSnapshot[](totalRewards);
        uint256 snapshotIndex = 0;

        // Capture WOM token balance
        snapshots[snapshotIndex++] = RewardSnapshot({
            token: WOM_TOKEN,
            balanceBefore: IERC20Metadata(WOM_TOKEN).balanceOf(address(this))
        });

        // Capture base rewarder token balances
        if (rewarder != address(0)) {
            for (uint256 i = 0; i < baseRewardTokens.length; i++) {
                snapshots[snapshotIndex++] = RewardSnapshot({
                    token: baseRewardTokens[i],
                    balanceBefore: IERC20Metadata(baseRewardTokens[i]).balanceOf(address(this))
                });
            }
        }

        // Capture boosted rewarder token balances
        if (boostedRewarder != address(0)) {
            for (uint256 i = 0; i < boostedRewardTokens.length; i++) {
                snapshots[snapshotIndex++] = RewardSnapshot({
                    token: boostedRewardTokens[i],
                    balanceBefore: IERC20Metadata(boostedRewardTokens[i]).balanceOf(address(this))
                });
            }
        }

        return snapshots;
    }

    function _captureRewarderSnapshots(
        address rewarder,
        RewardSnapshot[] memory snapshots,
        uint256 startIndex
    ) internal view returns (uint256) {
        address[] memory rewardTokens = IRewarder(rewarder).rewardTokens();
        uint256 index = startIndex;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            snapshots[index++] = RewardSnapshot({
                token: rewardTokens[i],
                balanceBefore: IERC20Metadata(rewardTokens[i]).balanceOf(address(this))
            });
        }

        return index;
    }

    function handleRewards(
        uint256 pid,
        uint256 reward,
        uint256[] memory additionalRewards,
        RewardSnapshot[] memory snapshots
    ) internal {
        (, , address rewarder, , , , ) = IWombatMaster(WOMBAT_MASTER).poolInfo(pid);
        address boostedRewarder = IWombatMaster(WOMBAT_MASTER).boostedRewarders(pid);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 snapshotIndex = 0;
        uint256 rewardStartIndex = 0;

        // Handle WOM rewards
        _handleWomRewards(reward, snapshots[snapshotIndex++], tokenManager);

        // Handle base rewarder
        if (rewarder != address(0)) {
            address[] memory baseRewardTokens = IRewarder(rewarder).rewardTokens();
            uint256 newSnapshotIndex = _handleRewarderRewards(
                rewarder,
                additionalRewards,
                rewardStartIndex,
                snapshots,
                snapshotIndex,
                tokenManager
            );
            rewardStartIndex += baseRewardTokens.length;
            snapshotIndex = newSnapshotIndex;
        }

        // Handle boosted rewarder
        if (boostedRewarder != address(0)) {
            address[] memory boostedRewardTokens = IRewarder(boostedRewarder).rewardTokens();

            _handleRewarderRewards(
                boostedRewarder,
                additionalRewards,
                rewardStartIndex,
                snapshots,
                snapshotIndex,
                tokenManager
            );
        }
    }

    function _handleWomRewards(
        uint256 reward,
        RewardSnapshot memory snapshot,
        ITokenManager tokenManager
    ) internal {
        if (reward == 0) return;

        uint256 actualReward = IERC20Metadata(WOM_TOKEN).balanceOf(address(this)) - snapshot.balanceBefore;

        if (actualReward < reward) {
            revert RewardValidationFailed(WOM_TOKEN, reward, actualReward);
        }

        if (tokenManager.isTokenAssetActive(WOM_TOKEN)) {
            _increaseExposure(tokenManager, WOM_TOKEN, actualReward);
        }
    }

    function _handleRewarderRewards(
        address rewarder,
        uint256[] memory additionalRewards,
        uint256 rewardStartIndex,
        RewardSnapshot[] memory snapshots,
        uint256 snapshotIndex,
        ITokenManager tokenManager
    ) internal returns (uint256) {
        address[] memory rewardTokens = IRewarder(rewarder).rewardTokens();

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (rewardStartIndex + i >= additionalRewards.length) {
                break;
            }

            address rewardToken = rewardTokens[i];
            uint256 pendingReward = additionalRewards[rewardStartIndex + i];

            if (pendingReward == 0) {
                snapshotIndex++;
                continue;
            }

            RewardSnapshot memory snapshot = snapshots[snapshotIndex++];
            uint256 actualReward = IERC20Metadata(rewardToken).balanceOf(address(this)) - snapshot.balanceBefore;

            if (actualReward < pendingReward) {
                revert RewardValidationFailed(rewardToken, pendingReward, actualReward);
            }

            if (tokenManager.isTokenAssetActive(rewardToken)) {
                _increaseExposure(tokenManager, rewardToken, actualReward);
            }
        }

        return snapshotIndex;
    }

    function getLpTokenBalance(bytes32 asset) internal view returns (uint256) {
        IERC20Metadata lpToken = getERC20TokenInstance(asset, false);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));
        IWombatMaster.UserInfo memory userInfo = IWombatMaster(WOMBAT_MASTER)
            .userInfo(pid, address(this));
        return userInfo.amount;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    receive() external payable {}
}