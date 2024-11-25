pragma solidity ^0.8.17;

interface IYieldYakWombatFacet {
    function depositSavaxToAvaxSavaxYY(uint256 amount, uint256 minLpOut) external;

    function withdrawSavaxFromAvaxSavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function sAvaxBalanceAvaxSavaxYY()
        external
        view
        returns (uint256 _stakedBalance);

    function depositGgavaxToAvaxGgavaxYY(uint256 amount, uint256 minLpOut) external;

    function withdrawGgavaxFromAvaxGgavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function ggAvaxBalanceAvaxGgavaxYY()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxToAvaxSavaxYY(uint256 amount, uint256 minLpOut) external;

    function withdrawAvaxFromAvaxSavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function avaxBalanceAvaxSavaxYY()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxToAvaxGgavaxYY(uint256 amount, uint256 minLpOut) external;

    function withdrawAvaxFromAvaxGgavaxYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function avaxBalanceAvaxGgavaxYY()
        external
        view
        returns (uint256 _stakedBalance);

    function withdrawSavaxFromAvaxSavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function withdrawGgavaxFromAvaxGgavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function withdrawAvaxFromAvaxSavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function withdrawAvaxFromAvaxGgavaxInOtherTokenYY(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function depositAndStakeAvaxSavaxLpSavaxYY(uint256 amount) external;

    function unstakeAndWithdrawAvaxSavaxLpSavaxYY(uint256 amount) external;

    function depositAndStakeAvaxSavaxLpAvaxYY(uint256 amount) external;

    function unstakeAndWithdrawAvaxSavaxLpAvaxYY(
        uint256 amount
    ) external returns (uint256 amountOut);

    function depositAvaxGgavaxLpGgavaxYY(uint256 amount) external;

    function unstakeAndWithdrawAvaxGgavaxLpGgavaxYY(
        uint256 amount
    ) external returns (uint256 amountOut);

    function depositAndStakeAvaxGgavaxLpAvaxYY(uint256 amount) external;

    function unstakeAndWithdrawAvaxGgavaxLpAvaxYY(
        uint256 amount
    ) external returns (uint256 amountOut);

    function migrateAvaxSavaxLpSavaxFromWombatToYY() external;

    function migrateAvaxGgavaxLpGgavaxFromWombatToYY() external;

    function migrateAvaxSavaxLpAvaxFromWombatToYY() external;

    function migrateAvaxGgavaxLpAvaxFromWombatToYY() external;
}
