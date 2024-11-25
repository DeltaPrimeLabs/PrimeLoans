pragma solidity ^0.8.17;

interface IYieldYakFacet {
    function stakeUSDTYak(uint256 amount) external;

    function stakeUSDCeYak(uint256 amount) external;

    function stakeAVAXYak(uint256 amount) external;

    function stakeSAVAXYak(uint256 amount) external;

    function stakeGLPYak(uint256 amount) external;

    function stakePNGAVAXUSDCYak(uint256 amount) external;

    function stakePNGAVAXETHYak(uint256 amount) external;

    function stakeTJAVAXUSDCYak(uint256 amount) external;

    function stakeTJAVAXETHYak(uint256 amount) external;

    function stakeTJAVAXSAVAXYak(uint256 amount) external;

    function unstakeAVAXYak(uint256 amount) external;

    function unstakeUSDTYak(uint256 amount) external;

    function unstakeUSDCeYak(uint256 amount) external;

    function unstakeSAVAXYak(uint256 amount) external;

    function unstakeGLPYak(uint256 amount) external;

    function unstakePNGAVAXUSDCYak(uint256 amount) external;

    function unstakePNGAVAXETHYak(uint256 amount) external;

    function unstakeTJAVAXUSDCYak(uint256 amount) external;

    function unstakeTJAVAXETHYak(uint256 amount) external;

    function unstakeTJAVAXSAVAXYak(uint256 amount) external;

    //deprecated
//    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    //deprecated
//    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);
}
