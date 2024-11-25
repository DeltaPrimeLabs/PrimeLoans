pragma solidity ^0.8.17;

interface ISteakHutFinanceFacet {
    function stakeSteakHutAVAXUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutAVAXUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    function stakeSteakHutBTCAVAX(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutBTCAVAX(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    function stakeSteakHutUSDTeUSDT(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutUSDTeUSDT(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    function stakeSteakHutJOEAVAX(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutJOEAVAX(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    function stakeSteakHutEUROCUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutEUROCUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;
}
