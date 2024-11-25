pragma solidity ^0.8.17;

interface IWombatFacet {
    function depositSavaxToAvaxSavax(uint256 amount, uint256 minLpOut) external;

    function withdrawSavaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function sAvaxBalanceAvaxSavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositGgavaxToAvaxGgavax(uint256 amount, uint256 minLpOut) external;

    function withdrawGgavaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function ggAvaxBalanceAvaxGgavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxToAvaxSavax(uint256 amount, uint256 minLpOut) external;

    function withdrawAvaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function avaxBalanceAvaxSavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxToAvaxGgavax(uint256 amount, uint256 minLpOut) external;

    function withdrawAvaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function avaxBalanceAvaxGgavax()
        external
        view
        returns (uint256 _stakedBalance);

    function withdrawSavaxFromAvaxSavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function withdrawGgavaxFromAvaxGgavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function withdrawAvaxFromAvaxSavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function withdrawAvaxFromAvaxGgavaxInOtherToken(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function depositAndStakeAvaxSavaxLpSavax(uint256 amount) external;

    function unstakeAndWithdrawAvaxSavaxLpSavax(uint256 amount) external;

    function depositAndStakeAvaxSavaxLpAvax(uint256 amount) external;

    function unstakeAndWithdrawAvaxSavaxLpAvax(
        uint256 amount
    ) external returns (uint256 amountOut);

    function depositAvaxGgavaxLpGgavax(uint256 amount) external;

    function unstakeAndWithdrawAvaxGgavaxLpGgavax(
        uint256 amount
    ) external returns (uint256 amountOut);

    function depositAndStakeAvaxGgavaxLpAvax(uint256 amount) external;

    function unstakeAndWithdrawAvaxGgavaxLpAvax(
        uint256 amount
    ) external returns (uint256 amountOut);

    function claimAllWombatRewards() external;

    function pendingRewardsForAvaxSavaxLpSavax()
        external
        view
        returns (
            address[] memory rewardTokenAddresses,
            uint256[] memory pendingRewards
        );

    function pendingRewardsForAvaxSavaxLpAvax()
        external
        view
        returns (
            address[] memory rewardTokenAddresses,
            uint256[] memory pendingRewards
        );

    function pendingRewardsForAvaxGgavaxLpGgavax()
        external
        view
        returns (
            address[] memory rewardTokenAddresses,
            uint256[] memory pendingRewards
        );

    function pendingRewardsForAvaxGgavaxLpAvax()
        external
        view
        returns (
            address[] memory rewardTokenAddresses,
            uint256[] memory pendingRewards
        );
}
