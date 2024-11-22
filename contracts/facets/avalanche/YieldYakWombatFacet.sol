// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/facets/avalanche/IWombatPool.sol";
import "../../interfaces/facets/avalanche/IYYWombatPool.sol";
import "../../interfaces/facets/avalanche/IWombatMaster.sol";
import "../../interfaces/facets/avalanche/IWombatRouter.sol";
import "../../interfaces/facets/avalanche/IRewarder.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/IWrappedNativeToken.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract YieldYakWombatFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    address public constant WOM_TOKEN =
        0xa15E4544D141aa98C4581a1EA10Eb9048c3b3382;
    address public constant WOMBAT_ROUTER =
        0x4A88C44B8D9B9f3F2BA4D97236F737CF03DF76CD;
    address public constant WOMBAT_MASTER =
        0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b;
    address public constant WOMBAT_sAVAX_AVAX_POOL =
        0xE3Abc29B035874a9f6dCDB06f8F20d9975069D87;
    address public constant WOMBAT_ggAVAX_AVAX_POOL =
        0xBbA43749efC1bC29eA434d88ebaf8A97DC7aEB77;

    bytes32 public constant WOMBAT_ggAVAX_AVAX_LP_AVAX =
        "WOMBAT_ggAVAX_AVAX_LP_AVAX";
    bytes32 public constant WOMBAT_ggAVAX_AVAX_LP_ggAVAX =
        "WOMBAT_ggAVAX_AVAX_LP_ggAVAX";
    bytes32 public constant WOMBAT_sAVAX_AVAX_LP_AVAX =
        "WOMBAT_sAVAX_AVAX_LP_AVAX";
    bytes32 public constant WOMBAT_sAVAX_AVAX_LP_sAVAX =
        "WOMBAT_sAVAX_AVAX_LP_sAVAX";

    bytes32 public constant YY_ggAVAX_AVAX_LP_AVAX = "YY_ggAVAX_AVAX_LP_AVAX";
    bytes32 public constant YY_ggAVAX_AVAX_LP_ggAVAX = "YY_ggAVAX_AVAX_LP_ggAVAX";
    bytes32 public constant YY_sAVAX_AVAX_LP_AVAX = "YY_sAVAX_AVAX_LP_AVAX";
    bytes32 public constant YY_sAVAX_AVAX_LP_sAVAX = "YY_sAVAX_AVAX_LP_sAVAX";

    function depositSavaxToAvaxSavaxYY(
        uint256 amount,
        uint256 minLpOut
    ) external {
        _depositToken(
            "sAVAX",
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            YY_sAVAX_AVAX_LP_sAVAX,
            WOMBAT_sAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.sAvaxBalanceAvaxSavaxYY.selector,
            this.withdrawSavaxFromAvaxSavaxYY.selector
        );
    }

    function withdrawSavaxFromAvaxSavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
                "sAVAX",
                "sAVAX",
                WOMBAT_sAVAX_AVAX_LP_sAVAX,
                YY_sAVAX_AVAX_LP_sAVAX,
                WOMBAT_sAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function sAvaxBalanceAvaxSavaxYY()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(YY_sAVAX_AVAX_LP_sAVAX);
    }

    function depositGgavaxToAvaxGgavaxYY(
        uint256 amount,
        uint256 minLpOut
    ) external {
        _depositToken(
            "ggAVAX",
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            YY_ggAVAX_AVAX_LP_ggAVAX,
            WOMBAT_ggAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.ggAvaxBalanceAvaxGgavaxYY.selector,
            this.withdrawGgavaxFromAvaxGgavaxYY.selector
        );
    }

    function withdrawGgavaxFromAvaxGgavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
                "ggAVAX",
                "ggAVAX",
                WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
                YY_ggAVAX_AVAX_LP_ggAVAX,
                WOMBAT_ggAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function ggAvaxBalanceAvaxGgavaxYY()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(YY_ggAVAX_AVAX_LP_ggAVAX);
    }

    function depositAvaxToAvaxSavaxYY(uint256 amount, uint256 minLpOut) external {
        _depositNative(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            YY_sAVAX_AVAX_LP_AVAX,
            WOMBAT_sAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.avaxBalanceAvaxSavaxYY.selector,
            this.withdrawAvaxFromAvaxSavaxYY.selector
        );
    }

    function withdrawAvaxFromAvaxSavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
                "AVAX",
                WOMBAT_sAVAX_AVAX_LP_AVAX,
                YY_sAVAX_AVAX_LP_AVAX,
                WOMBAT_sAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function avaxBalanceAvaxSavaxYY()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(YY_sAVAX_AVAX_LP_AVAX);
    }

    function depositAvaxToAvaxGgavaxYY(
        uint256 amount,
        uint256 minLpOut
    ) external {
        _depositNative(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            YY_ggAVAX_AVAX_LP_AVAX,
            WOMBAT_ggAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.avaxBalanceAvaxGgavaxYY.selector,
            this.withdrawAvaxFromAvaxGgavaxYY.selector
        );
    }

    function withdrawAvaxFromAvaxGgavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
                "AVAX",
                WOMBAT_ggAVAX_AVAX_LP_AVAX,
                YY_ggAVAX_AVAX_LP_AVAX,
                WOMBAT_ggAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function avaxBalanceAvaxGgavaxYY()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(YY_ggAVAX_AVAX_LP_AVAX);
    }

    function withdrawSavaxFromAvaxSavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
                "AVAX",
                "sAVAX",
                WOMBAT_sAVAX_AVAX_LP_AVAX,
                YY_sAVAX_AVAX_LP_AVAX,
                WOMBAT_sAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function withdrawGgavaxFromAvaxGgavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
                "AVAX",
                "ggAVAX",
                WOMBAT_ggAVAX_AVAX_LP_AVAX,
                YY_ggAVAX_AVAX_LP_AVAX,
                WOMBAT_ggAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function withdrawAvaxFromAvaxSavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
                "sAVAX",
                WOMBAT_sAVAX_AVAX_LP_sAVAX,
                YY_sAVAX_AVAX_LP_sAVAX,
                WOMBAT_sAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function withdrawAvaxFromAvaxGgavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
                "ggAVAX",
                WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
                YY_ggAVAX_AVAX_LP_ggAVAX,
                WOMBAT_ggAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function depositAndStakeAvaxSavaxLpSavaxYY(uint256 amount) external {
        _depositAndStakeWombatLPYY(
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            YY_sAVAX_AVAX_LP_sAVAX,
            amount,
            this.sAvaxBalanceAvaxSavaxYY.selector,
            this.unstakeAndWithdrawAvaxSavaxLpSavaxYY.selector
        );
    }

    function unstakeAndWithdrawAvaxSavaxLpSavaxYY(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return
            _unstakeAndWithdrawWombatLP(
                WOMBAT_sAVAX_AVAX_LP_sAVAX,
                YY_sAVAX_AVAX_LP_sAVAX,
                amount
            );
    }

    function depositAndStakeAvaxSavaxLpAvaxYY(uint256 amount) external {
        _depositAndStakeWombatLPYY(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            YY_sAVAX_AVAX_LP_AVAX,
            amount,
            this.avaxBalanceAvaxSavaxYY.selector,
            this.unstakeAndWithdrawAvaxSavaxLpAvaxYY.selector
        );
    }

    function unstakeAndWithdrawAvaxSavaxLpAvaxYY(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return
            _unstakeAndWithdrawWombatLP(
                WOMBAT_sAVAX_AVAX_LP_AVAX,
                YY_sAVAX_AVAX_LP_AVAX,
                amount
            );
    }

    function depositAvaxGgavaxLpGgavaxYY(uint256 amount) external {
        _depositAndStakeWombatLPYY(
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            YY_ggAVAX_AVAX_LP_ggAVAX,
            amount,
            this.ggAvaxBalanceAvaxGgavaxYY.selector,
            this.unstakeAndWithdrawAvaxGgavaxLpGgavaxYY.selector
        );
    }

    function unstakeAndWithdrawAvaxGgavaxLpGgavaxYY(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return
            _unstakeAndWithdrawWombatLP(
                WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
                YY_ggAVAX_AVAX_LP_ggAVAX,
                amount
            );
    }

    function depositAndStakeAvaxGgavaxLpAvaxYY(uint256 amount) external {
        _depositAndStakeWombatLPYY(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            YY_ggAVAX_AVAX_LP_AVAX,
            amount,
            this.avaxBalanceAvaxGgavaxYY.selector,
            this.unstakeAndWithdrawAvaxGgavaxLpAvaxYY.selector
        );
    }

    function unstakeAndWithdrawAvaxGgavaxLpAvaxYY(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return
            _unstakeAndWithdrawWombatLP(
                WOMBAT_ggAVAX_AVAX_LP_AVAX,
                YY_ggAVAX_AVAX_LP_AVAX,
                amount
            );
    }

    function migrateAvaxSavaxLpSavaxFromWombatToYY() external {
        _migrate(
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            YY_sAVAX_AVAX_LP_sAVAX,
            this.sAvaxBalanceAvaxSavaxYY.selector,
            this.withdrawSavaxFromAvaxSavaxYY.selector
        );
    }

    function migrateAvaxGgavaxLpGgavaxFromWombatToYY() external {
        _migrate(
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            YY_ggAVAX_AVAX_LP_ggAVAX,
            this.ggAvaxBalanceAvaxGgavaxYY.selector,
            this.withdrawGgavaxFromAvaxGgavaxYY.selector
        );
    }

    function migrateAvaxSavaxLpAvaxFromWombatToYY() external {
        _migrate(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            YY_sAVAX_AVAX_LP_AVAX,
            this.avaxBalanceAvaxSavaxYY.selector,
            this.withdrawAvaxFromAvaxSavaxYY.selector
        );
    }

    function migrateAvaxGgavaxLpAvaxFromWombatToYY() external {
        _migrate(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            YY_ggAVAX_AVAX_LP_AVAX,
            this.avaxBalanceAvaxGgavaxYY.selector,
            this.withdrawAvaxFromAvaxGgavaxYY.selector
        );
    }

    function _depositToken(
        bytes32 stakeAsset,
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        address wombatPool,
        uint256 amount,
        uint256 minLpOut,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata stakeToken = getERC20TokenInstance(stakeAsset, false);
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);

        amount = Math.min(stakeToken.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot deposit 0 tokens");

        address(stakeToken).safeApprove(wombatPool, 0);
        address(stakeToken).safeApprove(wombatPool, amount);

        IWombatPool(wombatPool).deposit(
            address(stakeToken),
            amount,
            minLpOut,
            address(this),
            block.timestamp,
            false
        );

        uint256 wombatLpAmount = wombatLpToken.balanceOf(address(this));

        address(wombatLpToken).safeApprove(yyLpToken, 0);
        address(wombatLpToken).safeApprove(yyLpToken, wombatLpAmount);

        IYYWombatPool(yyLpToken).deposit(wombatLpAmount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(stakeToken), amount);

        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(wombatLpToken),
                symbol: wombatLpAsset,
                identifier: yyLpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _withdrawToken(
        bytes32 fromAsset,
        bytes32 toAsset,
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        address pool,
        uint256 amount,
        uint256 minOut
    ) internal onlyOwnerOrInsolvent nonReentrant returns (uint256 amountOut) {
        IERC20Metadata fromToken = getERC20TokenInstance(fromAsset, false);
        IERC20Metadata toToken = getERC20TokenInstance(toAsset, false);
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);

        amount = Math.min(amount, IERC20Metadata(yyLpToken).balanceOf(address(this)));
        require(amount > 0, "Cannot withdraw 0 tokens");

        IYYWombatPool(yyLpToken).withdraw(amount);

        uint256 wombatLpAmount = wombatLpToken.balanceOf(address(this));

        address(wombatLpToken).safeApprove(pool, 0);
        address(wombatLpToken).safeApprove(pool, wombatLpAmount);

        if (fromAsset == toAsset) {
            amountOut = IWombatPool(pool).withdraw(
                address(fromToken),
                wombatLpAmount,
                minOut,
                address(this),
                block.timestamp
            );
        } else {
            amountOut = IWombatPool(pool).withdrawFromOtherAsset(
                address(fromToken),
                address(toToken),
                wombatLpAmount,
                minOut,
                address(this),
                block.timestamp
            );
        }

        if (getLpTokenBalance(yyLpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(yyLpAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(toToken), amountOut);
    }

    function _depositNative(
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        address pool,
        uint256 amount,
        uint256 minLpOut,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IWrappedNativeToken wrapped = IWrappedNativeToken(
            DeploymentConstants.getNativeToken()
        );
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);

        amount = Math.min(wrapped.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot deposit 0 tokens");

        wrapped.withdraw(amount);

        IWombatRouter(WOMBAT_ROUTER).addLiquidityNative{value: amount}(
            pool,
            minLpOut,
            address(this),
            block.timestamp,
            false
        );

        uint256 wombatLpAmount = wombatLpToken.balanceOf(address(this));

        address(wombatLpToken).safeApprove(yyLpToken, 0);
        address(wombatLpToken).safeApprove(yyLpToken, wombatLpAmount);

        IYYWombatPool(yyLpToken).deposit(wombatLpAmount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(wrapped), amount);

        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(wombatLpToken),
                symbol: wombatLpAsset,
                identifier: yyLpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _withdrawNative(
        bytes32 fromAsset,
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        address pool,
        uint256 amount,
        uint256 minOut
    ) internal onlyOwnerOrInsolvent nonReentrant returns (uint256 amountOut) {
        IERC20Metadata fromToken = getERC20TokenInstance(fromAsset, false);
        IWrappedNativeToken wrapped = IWrappedNativeToken(
            DeploymentConstants.getNativeToken()
        );
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);

        amount = Math.min(amount, IERC20Metadata(yyLpToken).balanceOf(address(this)));
        require(amount > 0, "Cannot withdraw 0 tokens");

        IYYWombatPool(yyLpToken).withdraw(amount);

        uint256 wombatLpAmount = wombatLpToken.balanceOf(address(this));

        address(wombatLpToken).safeApprove(WOMBAT_ROUTER, 0);
        address(wombatLpToken).safeApprove(WOMBAT_ROUTER, wombatLpAmount);

        if (fromAsset == bytes32("AVAX")) {
            amountOut = IWombatRouter(WOMBAT_ROUTER).removeLiquidityNative(
                pool,
                wombatLpAmount,
                minOut,
                address(this),
                block.timestamp
            );
        } else {
            amountOut = IWombatRouter(WOMBAT_ROUTER)
                .removeLiquidityFromOtherAssetAsNative(
                    pool,
                    address(fromToken),
                    wombatLpAmount,
                    minOut,
                    address(this),
                    block.timestamp
                );
        }

        wrapped.deposit{value: amountOut}();

        if (getLpTokenBalance(yyLpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(yyLpAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(wrapped), amountOut);
    }

    function _depositAndStakeWombatLPYY(
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        uint256 amount,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);

        amount = Math.min(amount, wombatLpToken.balanceOf(msg.sender));
        require(amount > 0, "Cannot deposit 0 tokens");

        address(wombatLpToken).safeTransferFrom(msg.sender, address(this), amount);

        address(wombatLpToken).safeApprove(yyLpToken, 0);
        address(wombatLpToken).safeApprove(yyLpToken, amount);

        IYYWombatPool(yyLpToken).deposit(amount);

        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(wombatLpToken),
                symbol: wombatLpAsset,
                identifier: yyLpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _unstakeAndWithdrawWombatLP(
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        uint256 amount
    )
        internal
        onlyOwner
        nonReentrant
        remainsSolvent
        canRepayDebtFully
        returns (uint256 amountOut)
    {
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);

        amount = Math.min(amount, IERC20Metadata(yyLpToken).balanceOf(address(this)));
        require(amount > 0, "Cannot withdraw 0 tokens");

        IYYWombatPool(yyLpToken).withdraw(amount);

        address(wombatLpToken).safeTransfer(
            msg.sender,
            wombatLpToken.balanceOf(address(this))
        );

        if (getLpTokenBalance(yyLpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(yyLpAsset);
        }

        return amount;
    }

    function _migrate(
        bytes32 wombatLpAsset,
        bytes32 yyLpAsset,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata wombatLpToken = getERC20TokenInstance(wombatLpAsset, false);
        address yyLpToken = _getYRT(yyLpAsset);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(
            address(wombatLpToken)
        );

        IWombatMaster.UserInfo memory userInfo = IWombatMaster(WOMBAT_MASTER)
            .userInfo(pid, address(this));
        uint256 wombatLpAmount = userInfo.amount;
        if (wombatLpAmount == 0) {
            return;
        }

        (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
            WOMBAT_MASTER
        ).withdraw(pid, wombatLpAmount);

        address(wombatLpToken).safeApprove(yyLpToken, 0);
        address(wombatLpToken).safeApprove(yyLpToken, wombatLpAmount);

        IYYWombatPool(yyLpToken).deposit(wombatLpAmount);

        DiamondStorageLib.removeStakedPosition(wombatLpAsset);
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(wombatLpToken),
                symbol: wombatLpAsset,
                identifier: yyLpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);

        handleRewards(pid, reward, additionalRewards);
    }

    function _getYRT(bytes32 yyLpAsset) internal view returns (address) {
        if (yyLpAsset == YY_ggAVAX_AVAX_LP_AVAX) {
            return 0x7f0eB376eabF4b2B4290D09EFb2f4da99B3ea311;
        }
        if (yyLpAsset == YY_ggAVAX_AVAX_LP_ggAVAX) {
            return 0x13404B1C715aF60869fc658d6D99c117e3543592;
        }
        if (yyLpAsset == YY_sAVAX_AVAX_LP_AVAX) {
            return 0xa84D83787eA216F616C6Bd02C6edC6D6d63f042f;
        }
        if (yyLpAsset == YY_sAVAX_AVAX_LP_sAVAX) {
            return 0x9B5d890d563EE4c9255bB500a790Ca6B1FB9dB6b;
        }
    }

    function handleRewards(
        uint256 pid,
        uint256 reward,
        uint256[] memory additionalRewards
    ) internal {
        (, , address rewarder, , , , ) = IWombatMaster(WOMBAT_MASTER).poolInfo(pid);
        address boostedRewarder = IWombatMaster(WOMBAT_MASTER).boostedRewarders(
            pid
        );
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address owner = DiamondStorageLib.contractOwner();

        if (reward > 0 && tokenManager.isTokenAssetActive(WOM_TOKEN)) {
            _increaseExposure(tokenManager, WOM_TOKEN, reward);
        } else if (reward > 0) {
            WOM_TOKEN.safeTransfer(owner, reward);
        }

        uint256 baseIdx;
        if (rewarder != address(0)) {
            address[] memory rewardTokens = IRewarder(rewarder).rewardTokens();
            baseIdx = rewardTokens.length;
            for (uint256 i; i != baseIdx; ++i) {
                address rewardToken = rewardTokens[i];
                uint256 pendingReward = additionalRewards[i];

                if (pendingReward == 0) {
                    continue;
                }

                if (tokenManager.isTokenAssetActive(rewardToken)) {
                    _increaseExposure(tokenManager, rewardToken, pendingReward);
                } else {
                    rewardToken.safeTransfer(owner, pendingReward);
                }
            }
        }
        if (boostedRewarder != address(0)) {
            address[] memory rewardTokens = IRewarder(boostedRewarder).rewardTokens();
            for (uint256 i; i != rewardTokens.length; ++i) {
                address rewardToken = rewardTokens[i];
                uint256 pendingReward = additionalRewards[baseIdx + i];

                if (pendingReward == 0) {
                    continue;
                }

                if (tokenManager.isTokenAssetActive(rewardToken)) {
                    _increaseExposure(tokenManager, rewardToken, pendingReward);
                } else {
                    rewardToken.safeTransfer(owner, pendingReward);
                }
            }
        }
    }

    function getLpTokenBalance(bytes32 asset) internal view returns (uint256) {
        address lpToken = _getYRT(asset);
        uint256 balance = IERC20Metadata(lpToken).balanceOf(address(this));
        return IYYWombatPool(lpToken).getDepositTokensForShares(balance);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}
}
