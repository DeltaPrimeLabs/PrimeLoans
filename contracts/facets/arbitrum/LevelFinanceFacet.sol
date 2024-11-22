// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 64a9eb8d8ae32bd1462f11fe1513b45de6dcdadb;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/facets/arbitrum/ILevelFinance.sol";
import "../../interfaces/facets/arbitrum/ILevelOrderManager.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/IWrappedNativeToken.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract LevelFinanceFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address payable;
    using TransferHelper for address;

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    address private constant ETH_TOKEN =
        0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    address private constant LEVEL_FARMING =
        0xC18c952F800516E1eef6aB482F3d331c84d43d38;

    address private constant LEVEL_ORDER_MANAGER = 0x2215298606C9D0274527b13519Ec50c3A7f1c1eF;

    // LPs
    address private constant LEVEL_SENIOR_LLP =
        0x5573405636F4b895E511C9C54aAfbefa0E7Ee458;
    address private constant LEVEL_MEZZANINE_LLP =
        0xb076f79f8D1477165E2ff8fa99930381FB7d94c1;
    address private constant LEVEL_JUNIOR_LLP =
        0x502697AF336F7413Bb4706262e7C506Edab4f3B9;

    // ----- STAKE -----

    /**
     * Stakes ETH in the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of ETH to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeEthSnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeEthSnr.selector
            });
        _stakeTokenLevel(address(0), "ETH", amount, minLpAmount, 0, position);
    }

    /**
     * Stakes ETH in the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of ETH to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeEthMze(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeEthMze.selector
            });
        _stakeTokenLevel(address(0), "ETH", amount, minLpAmount, 1, position);
    }

    /**
     * Stakes ETH in the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of ETH to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeEthJnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeEthJnr.selector
            });
        _stakeTokenLevel(address(0), "ETH", amount, minLpAmount, 2, position);
    }

    /**
     * Stakes BTC in the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of BTC to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeBtcSnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeBtcSnr.selector
            });
        _stakeTokenLevel(
            0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f,
            "BTC",
            amount,
            minLpAmount,
            0,
            position
        );
    }

    /**
     * Stakes BTC in the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of BTC to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeBtcMze(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeBtcMze.selector
            });
        _stakeTokenLevel(
            0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f,
            "BTC",
            amount,
            minLpAmount,
            1,
            position
        );
    }

    /**
     * Stakes BTC in the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of BTC to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeBtcJnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeBtcJnr.selector
            });
        _stakeTokenLevel(
            0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f,
            "BTC",
            amount,
            minLpAmount,
            2,
            position
        );
    }

    /**
     * Stakes USDT in the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDT to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeUsdtSnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdtSnr.selector
            });
        _stakeTokenLevel(
            0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            "USDT",
            amount,
            minLpAmount,
            0,
            position
        );
    }

    /**
     * Stakes USDT in the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDT to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeUsdtMze(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeUsdtMze.selector
            });
        _stakeTokenLevel(
            0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            "USDT",
            amount,
            minLpAmount,
            1,
            position
        );
    }

    /**
     * Stakes USDT in the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDT to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeUsdtJnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdtJnr.selector
            });
        _stakeTokenLevel(
            0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            "USDT",
            amount,
            minLpAmount,
            2,
            position
        );
    }

    /**
     * Stakes USDC in the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDC to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeUsdcSnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcSnr.selector
            });
        _stakeTokenLevel(
            0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            "USDC",
            amount,
            minLpAmount,
            0,
            position
        );
    }

    /**
     * Stakes USDC in the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDC to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeUsdcMze(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcMze.selector
            });
        _stakeTokenLevel(
            0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            "USDC",
            amount,
            minLpAmount,
            1,
            position
        );
    }

    /**
     * Stakes USDC in the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param amount amount of USDC to be staked
     * @param minLpAmount minimum amount of LLP
     **/
    function levelStakeUsdcJnr(
        uint256 amount,
        uint256 minLpAmount
    )
        public
        onlyOwner
        nonReentrant
        recalculateAssetsExposure
        remainsSolvent
    {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcJnr.selector
            });
        _stakeTokenLevel(
            0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            "USDC",
            amount,
            minLpAmount,
            2,
            position
        );
    }

    // ----- UNSTAKE -----

    /**
     * Unstakes ETH from the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of ETH to be unstaked
     **/
    function levelUnstakeEthSnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeEthSnr.selector
            });
        _unstakeTokenLevel(address(0), "ETH", lpAmount, minAmount, 0, position);
    }

    /**
     * Unstakes ETH from the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of ETH to be unstaked
     **/
    function levelUnstakeEthMze(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeEthMze.selector
            });
        _unstakeTokenLevel(address(0), "ETH", lpAmount, minAmount, 1, position);
    }

    /**
     * Unstakes ETH from the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of ETH to be unstaked
     **/
    function levelUnstakeEthJnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeEthJnr.selector
            });
        _unstakeTokenLevel(address(0), "ETH", lpAmount, minAmount, 2, position);
    }

    /**
     * Unstakes BTC from the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of BTC to be unstaked
     **/
    function levelUnstakeBtcSnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeBtcSnr.selector
            });
        _unstakeTokenLevel(
            0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f,
            "BTC",
            lpAmount,
            minAmount,
            0,
            position
        );
    }

    /**
     * Unstakes BTC from the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of BTC to be unstaked
     **/
    function levelUnstakeBtcMze(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeBtcMze.selector
            });
        _unstakeTokenLevel(
            0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f,
            "BTC",
            lpAmount,
            minAmount,
            1,
            position
        );
    }

    /**
     * Unstakes BTC from the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of BTC to be unstaked
     **/
    function levelUnstakeBtcJnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeBtcJnr.selector
            });
        _unstakeTokenLevel(
            0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f,
            "BTC",
            lpAmount,
            minAmount,
            2,
            position
        );
    }

    /**
     * Unstakes USDT from the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of USDT to be unstaked
     **/
    function levelUnstakeUsdtSnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdtSnr.selector
            });
        _unstakeTokenLevel(
            0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            "USDT",
            lpAmount,
            minAmount,
            0,
            position
        );
    }

    /**
     * Unstakes USDT from the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of USDT to be unstaked
     **/
    function levelUnstakeUsdtMze(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeUsdtMze.selector
            });
        _unstakeTokenLevel(
            0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            "USDT",
            lpAmount,
            minAmount,
            1,
            position
        );
    }

    /**
     * Unstakes USDT from the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of USDT to be unstaked
     **/
    function levelUnstakeUsdtJnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdtJnr.selector
            });
        _unstakeTokenLevel(
            0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            "USDT",
            lpAmount,
            minAmount,
            2,
            position
        );
    }

    /**
     * Unstakes USDC from the senior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of USDC to be unstaked
     **/
    function levelUnstakeUsdcSnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyWhitelistedLiquidators nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcSnr.selector
            });
        _unstakeTokenLevel(
            0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            "USDC",
            lpAmount,
            minAmount,
            0,
            position
        );
    }

    /**
     * Unstakes USDC from the mezzanine tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of USDC to be unstaked
     **/
    function levelUnstakeUsdcMze(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyWhitelistedLiquidators nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcMze.selector
            });
        _unstakeTokenLevel(
            0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            "USDC",
            lpAmount,
            minAmount,
            1,
            position
        );
    }

    modifier onlyWhitelistedLiquidators() {
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted liquidators can execute this method");
        _;
    }

    /**
     * Unstakes USDC from the junior tranche of Level finance
     * @dev This function uses the redstone-evm-connector
     * @param lpAmount amount of LLP to be unstaked
     * @param minAmount minimum amount of USDC to be unstaked
     **/
    function levelUnstakeUsdcJnr(
        uint256 lpAmount,
        uint256 minAmount
    ) public onlyWhitelistedLiquidators nonReentrant recalculateAssetsExposure {
        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcJnr.selector
            });
        _unstakeTokenLevel(
            0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            "USDC",
            lpAmount,
            minAmount,
            2,
            position
        );
    }

    // ----- BALANCE -----

    function levelSnrBalance() public view returns (uint256 _stakedBalance) {
        return _levelBalance(0);
    }

    function levelMzeBalance() public view returns (uint256 _stakedBalance) {
        return _levelBalance(1);
    }

    function levelJnrBalance() public view returns (uint256 _stakedBalance) {
        return _levelBalance(2);
    }

    function _levelBalance(uint256 pid) internal view returns (uint256) {
        ILevelFinance.UserInfo memory userInfo = ILevelFinance(LEVEL_FARMING)
            .userInfo(pid, address(this));
        return userInfo.amount;
    }

    // ----- PRIVATE METHODS -----

    /**
     * Stakes {stakingDetails.lpTokenAddress} LP token in the Level finance
     * @dev This function uses the redstone-evm-connector
     **/
    function _stakeTokenLevel(
        address asset,
        bytes32 symbol,
        uint256 amount,
        uint256 minLpAmount,
        uint256 pid,
        IStakingPositions.StakedPosition memory position
    ) private {
        revert("No longer supported.");
    }

    function exitLevelFinanceAndHarvestRewardsForOwner() external payable onlyWhitelistedLiquidators{
        ILevelFinance farmingContract = ILevelFinance(LEVEL_FARMING);
        ILevelOrderManager orderManager = ILevelOrderManager(LEVEL_ORDER_MANAGER);

        uint256 snrTrancheBalance = levelSnrBalance();


        if(snrTrancheBalance > 0){
            farmingContract.withdraw(0, snrTrancheBalance, address(this));
            uint256 llpSeniorBalance = IERC20Metadata(LEVEL_SENIOR_LLP).balanceOf(address(this));
            IERC20Metadata(LEVEL_SENIOR_LLP).approve(LEVEL_ORDER_MANAGER, llpSeniorBalance);

            orderManager.placeRemoveLiquidityOrder{value: msg.value}(
                LEVEL_SENIOR_LLP,
                0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
                llpSeniorBalance,
                0,
                uint64(block.timestamp + 180),
                address(this)
            );
            farmingContract.harvest(0, DiamondStorageLib.contractOwner());
            DiamondStorageLib.removeStakedPosition("stkdSnrLLP");
            DiamondStorageLib.addOwnedAsset("USDC",0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
        }
    }

    /**
     * Unstakes {stakingDetails.lpTokenAddress} LP token from the Level finance
     * @dev This function uses the redstone-evm-connector
     **/
    function _unstakeTokenLevel(
        address asset,
        bytes32 symbol,
        uint256 amount,
        uint256 minAmount,
        uint256 pid,
        IStakingPositions.StakedPosition memory position
    ) private {
        ILevelFinance farmingContract = ILevelFinance(LEVEL_FARMING);
        IERC20Metadata unstakedToken = getERC20TokenInstance(symbol, false);
        uint256 initialReceiptTokenBalance = farmingContract
        .userInfo(pid, address(this))
        .amount;

        amount = Math.min(initialReceiptTokenBalance, amount);

        require(amount > 0, "Cannot unstake 0 tokens");

        uint256 balance = unstakedToken.balanceOf(address(this));

        if (asset == address(0)) {
            farmingContract.removeLiquidityETH(
                pid,
                amount,
                minAmount,
                address(this)
            );
            IWrappedNativeToken(ETH_TOKEN).deposit{value: address(this).balance}();
        } else {
            farmingContract.removeLiquidity(
                pid,
                amount,
                asset,
                minAmount,
                address(this)
            );
        }

        uint256 newBalance = unstakedToken.balanceOf(address(this));

        uint256 newReceiptTokenBalance = farmingContract
        .userInfo(pid, address(this))
        .amount;

        // Add/remove owned tokens
        if (newReceiptTokenBalance == 0) {
            DiamondStorageLib.removeStakedPosition(position.identifier);
        }
        DiamondStorageLib.addOwnedAsset(symbol, address(unstakedToken));

        emit Unstaked(
            msg.sender,
            symbol,
            LEVEL_FARMING,
            newBalance - balance,
            initialReceiptTokenBalance - newReceiptTokenBalance,
            block.timestamp
        );

        farmingContract.harvest(pid, DiamondStorageLib.contractOwner());
        emit RewardsHarvested(msg.sender, pid, block.timestamp);
    }

    function harvestRewards(uint256 pid) external nonReentrant onlyOwner {
        ILevelFinance farmingContract = ILevelFinance(LEVEL_FARMING);
        farmingContract.harvest(pid, msg.sender);
        emit RewardsHarvested(msg.sender, pid, block.timestamp);
    }

    function unstakeAndWithdrawLLP(uint256 pid, uint256 amount) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent{
        revert("No longer supported.");
    }

    // @dev Requires an approval on LLP token for the PrimeAccount address prior to calling this function
    function depositLLPAndStake(uint256 pid, uint256 amount) external nonReentrant onlyOwner recalculateAssetsExposure{
        revert("No longer supported.");
    }

    function pidToLLPToken(uint256 pid) private pure returns (address){
        if(pid == 0){
            return LEVEL_SENIOR_LLP;
        } else if(pid == 1){
            return LEVEL_MEZZANINE_LLP;
        } else if(pid == 2){
            return LEVEL_JUNIOR_LLP;
        } else {
            revert("Invalid pid");
        }
    }

    function pidToStakedPosition(uint256 pid) private pure returns (IStakingPositions.StakedPosition memory){
        if(pid == 0){
            return IStakingPositions
            .StakedPosition({
                asset: LEVEL_SENIOR_LLP,
                symbol: "arbSnrLLP",
                identifier: "stkdSnrLLP",
                balanceSelector: this.levelSnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcSnr.selector
            });
        } else if(pid == 1){
            return IStakingPositions
            .StakedPosition({
                asset: LEVEL_MEZZANINE_LLP,
                symbol: "arbMzeLLP",
                identifier: "stkdMzeLLP",
                balanceSelector: this.levelMzeBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcMze.selector
            });
        } else if(pid == 2){
            return IStakingPositions
            .StakedPosition({
                asset: LEVEL_JUNIOR_LLP,
                symbol: "arbJnrLLP",
                identifier: "stkdJnrLLP",
                balanceSelector: this.levelJnrBalance.selector,
                unstakeSelector: this.levelUnstakeUsdcJnr.selector
            });
        } else {
            revert("Invalid pid");
        }
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
     * @dev emitted when user deposits LLP tokens into PA
     * @param user the address depositing
     * @param asset the asset that was staked
     * @param vault address of the vault token
     * @param depositAmount how much of LLP was deposited
     * @param timestamp of deposit
     **/
    event DepositedLLP(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositAmount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user withdraws LLP tokens from PA
     * @param user the address withdrawing
     * @param asset the asset that was staked
     * @param vault address of the vault token
     * @param depositAmount how much of LLP was withdrawn
     * @param timestamp of withdrawal
     **/
    event WithdrewLLP(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositAmount,
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
     * @dev emitted when user harvests rewards
     * @param user the address collecting rewards
     * @param pid tranche id that rewards were harvested from
     * @param timestamp of collecting rewards
     **/
    event RewardsHarvested(
        address indexed user,
        uint256 indexed pid,
        uint256 timestamp
    );
}
