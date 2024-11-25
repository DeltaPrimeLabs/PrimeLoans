pragma solidity ^0.8.17;

import "../../balancer-v2/IBalancerV2Vault.sol";

interface IBalancerV2Facet {
    struct UnstakeRequest {
        bytes32 poolId;
        address unstakedToken;
        uint256 unstakedAmount;
        uint256 bptAmount;
    }

    struct StakeRequest {
        bytes32 poolId;
        address[] stakedTokens;
        uint256[] stakedAmounts;
        uint256 minBptAmount;
    }

    function joinPoolAndStakeBalancerV2(StakeRequest memory request) external;

    function stakeBalancerV2(bytes32 poolId, uint256 amount) external;

    function unstakeAndExitPoolBalancerV2(UnstakeRequest memory request) external;

    function unstakeBalancerV2(bytes32 poolId, uint256 amount) external;

    function claimRewardsBalancerV2(bytes32 poolId) external;

    function balancerGgAvaxBalance() external view returns (uint256);

    function balancerYyAvaxBalance() external view returns (uint256);

    function balancerSAvaxBalance() external view returns (uint256);

    event StakeBalancerV2(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    event BptUnstaked(address indexed user, bytes32 asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    event UnstakeBalancerV2(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    event BptStaked(address indexed user, bytes32 asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

}
