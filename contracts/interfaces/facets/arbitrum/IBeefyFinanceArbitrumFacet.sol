pragma solidity ^0.8.17;

interface IBeefyFinanceArbitrumFacet {
    function stakeGmxBeefy(uint256 amount) external;

    function unstakeGmxBeefy(uint256 amount) external;
}
