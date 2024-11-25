pragma solidity ^0.8.17;

interface IRecoveryFacet {
    function emergencyWithdraw(bytes32 asset) external returns (uint256 _amount);

    function notifyRefund(address token, uint256 amount) external;
}
