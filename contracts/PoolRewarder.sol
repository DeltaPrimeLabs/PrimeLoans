// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPoolRewarder.sol";

contract PoolRewarder is IPoolRewarder {
    using SafeERC20 for IERC20;

    // IERC20 public immutable stakingToken;
    IERC20 public immutable rewardsToken;

    address public owner;
    address public pool;

    // Duration of rewards to be paid out (in seconds)
    uint public duration;
    // Timestamp of when the rewards finish
    uint public finishAt;
    // Minimum of last updated time and reward finish time
    uint public updatedAt;
    // Reward to be paid out per second
    uint public rewardRate;
    // Sum of (reward rate * dt * 1e18 / total supply)
    uint public rewardPerTokenStored;
    // User address => rewardPerTokenStored
    mapping(address => uint) public userRewardPerTokenPaid;
    // User address => rewards to be claimed
    mapping(address => uint) public rewards;

    // Total staked
    uint public totalSupply;
    // User address => staked amount
    mapping(address => uint) public balanceOf;

//    constructor(address _stakingToken, address _rewardToken) {
    constructor(address _rewardToken, address _pool) {
        owner = msg.sender;
        pool = _pool;
//        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardToken);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized: onlyOwner");
        _;
    }

    modifier onlyPool() {
        require(msg.sender == pool, "Unauthorized: onlyPool");
        _;
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }

        _;
    }

    function lastTimeRewardApplicable() public view returns (uint) {
        return _min(finishAt, block.timestamp);
    }

    function rewardPerToken() public view returns (uint) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return
        rewardPerTokenStored +
        (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) /
        totalSupply;
    }

    function stakeFor(uint _amount, address _stakeFor) external updateReward(_stakeFor) onlyPool {
        require(_amount > 0, "amount = 0");
//        stakingToken.transferFrom(msg.sender, address(this), _amount);
        balanceOf[_stakeFor] += _amount;
        totalSupply += _amount;
        emit Staked(_stakeFor, _amount, block.timestamp);
    }

    function withdrawFor(uint _amount, address _unstakeFor) external updateReward(_unstakeFor) onlyPool returns (uint256){
        require(_amount > 0, "amount = 0");
        if(balanceOf[_unstakeFor] > 0) {
            uint256 amountToUnstake = _amount > balanceOf[_unstakeFor] ? balanceOf[_unstakeFor] : _amount;
            balanceOf[_unstakeFor] -= amountToUnstake;
            totalSupply -= amountToUnstake;
            //        stakingToken.transfer(msg.sender, _amount);
            emit Unstaked(_unstakeFor, amountToUnstake, block.timestamp);
            return amountToUnstake;
        }
        return 0;
    }

    function earned(address _account) public view returns (uint) {
        return
        ((balanceOf[_account] *
        (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
        rewards[_account];
    }

    function getRewardsFor(address _user) external updateReward(_user) {
        uint reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            rewardsToken.safeTransfer(_user, reward);
        }
    }

    function setRewardsDuration(uint _duration) external onlyOwner {
        require(finishAt < block.timestamp, "reward duration not finished");
        duration = _duration;
    }

    function notifyRewardAmount(uint _amount)
    external
    onlyOwner
    updateReward(address(0))
    {
        if (block.timestamp >= finishAt) {
            rewardRate = _amount / duration;
        } else {
            uint remainingRewards = (finishAt - block.timestamp) * rewardRate;
            rewardRate = (_amount + remainingRewards) / duration;
        }

        require(rewardRate > 0, "reward rate = 0");
        require(
            rewardRate * duration <= rewardsToken.balanceOf(address(this)),
            "reward amount > balance"
        );

        finishAt = block.timestamp + duration;
        updatedAt = block.timestamp;
    }

    function _min(uint x, uint y) private pure returns (uint) {
        return x <= y ? x : y;
    }

    /**
      * @dev emitted after staking in the pool
      * @param user the address that staked
      * @param timestamp of the staking
    **/
    event Staked(address user, uint256 indexed amount, uint256 timestamp);

    /**
      * @dev emitted after staking in the pool
      * @param user the address that unstaked
      * @param timestamp of the unstaking
    **/
    event Unstaked(address user, uint256 indexed amount, uint256 timestamp);
}
