pragma solidity ^0.8.17;

import "../../arbitrum/IPendleRouter.sol";

interface IPenpieFacet {
    function depositToPendleAndStakeInPenpie(
        bytes32 asset,
        uint256 amount,
        address market,
        uint256 minLpOut,
        IPendleRouter.ApproxParams memory guessPtReceivedFromSy,
        IPendleRouter.TokenInput memory input,
        IPendleRouter.LimitOrderData memory limit
    ) external;

    function unstakeFromPenpieAndWithdrawFromPendle(
        bytes32 asset,
        uint256 amount,
        address market,
        uint256 minOut,
        IPendleRouter.TokenOutput memory output,
        IPendleRouter.LimitOrderData memory limit
    ) external returns (uint256);

    function depositPendleLPAndStakeInPenpie(
        address market,
        uint256 amount
    ) external;

    function unstakeFromPenpieAndWithdrawPendleLP(
        address market,
        uint256 amount
    ) external;

    function pendingRewards(
        address market
    ) external view returns (uint256, address[] memory, uint256[] memory);

    function claimRewards(address market) external;
}
