pragma solidity ^0.8.17;

interface IBeefyFinanceArbitrumFacet {
    function stakeSushiDpxEthLpBeefy(uint256 amount) external;

    function stakeGmxBeefy(uint256 amount) external;

    function unstakeSushiDpxEthLpBeefy(uint256 amount) external;

    function unstakeGmxBeefy(uint256 amount) external;
}
