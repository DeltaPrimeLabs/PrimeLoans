pragma solidity ^0.8.17;

interface ITraderJoeV2AutopoolsFacet {
    function stakeTraderJoeV2AutopoolAVAXUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeTraderJoeV2AutopoolAVAXUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

}
