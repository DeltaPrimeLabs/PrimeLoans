pragma solidity ^0.8.17;

interface ISushiSwapFacet {
    function sushiStakeDpxEthLp(uint256 amount) external;

    function sushiUnstakeDpxEthLp(uint256 amount, uint256 minAmount) external;

    function sushiDpxEthLpBalance() external view returns (uint256);
}
