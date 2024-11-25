// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9f1e1bba11316303810f35a4440e20bc5ad0ef86;
pragma solidity 0.8.17;

import "./Pool.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title VestingDistributor
 * @dev Contract distributing pool's spread among vesting participants.
 */
contract VestingDistributor {

    Pool immutable pool;
    IERC20Metadata immutable poolToken;
    address keeper;
    address pendingKeeper;

    uint256 totalLockedMultiplied;
    address[] public participants;
    mapping(address => uint256) public locked;
    mapping(address => uint256) public withdrawn;
    mapping(address => uint256) public unvestingTime;
    mapping(address => uint256) public unlockTimestamp;
    mapping(address => uint256) public multiplier;
    mapping(uint256 => uint256) rewardAmount;
    mapping(uint256 => mapping(address => bool)) rewardDistributed;
    mapping(uint256 => uint256) numRewardDistributed;

    uint256 lastUpdated;
    uint256 updateInterval = 6 hours;

    uint256 public constant ONE_DAY = 24 * 3600; // 24 hours * 3600 seconds
    uint256 public constant MIN_VESTING_TIME = ONE_DAY; // 1 day * 24 hours * 3600 seconds
    uint256 public constant MAX_VESTING_TIME = 30 * ONE_DAY; // 30 days * 24 hours * 3600 seconds

    modifier onlyPool() {
        require(msg.sender == address(pool), "Unauthorized: onlyPool");
        _;
    }

    modifier onlyKeeper() {
        require(msg.sender == keeper, "Unauthorized: onlyKeeper");
        _;
    }

    modifier onlyPendingKeeper() {
        require(msg.sender == pendingKeeper, "Unauthorized: onlyPendingKeeper");
        _;
    }

    constructor(address poolAddress, address keeperAddress) {
        pool = Pool(poolAddress);
        poolToken = IERC20Metadata(pool.tokenAddress());
        keeper = keeperAddress;
        lastUpdated = block.timestamp;
    }

    function transferKeeper(address keeperAddress) external onlyKeeper {
        pendingKeeper = keeperAddress;
    }

    function acceptKeeper() external onlyPendingKeeper {
        keeper = pendingKeeper;
        pendingKeeper = address(0);
    }

    /**
     * Add vesting participant (msg.sender)
     **/
    function startVesting(uint256 amount, uint256 time) public {
        if (time < MIN_VESTING_TIME || time > MAX_VESTING_TIME) revert InvalidVestingTime();
        if (pool.balanceOf(msg.sender) < amount) revert InsufficientPoolBalance();
        if (locked[msg.sender] > 0 || unvestingTime[msg.sender] > 0) revert AlreadyLocked();

        participants.push(msg.sender);
        locked[msg.sender] = amount;
        unvestingTime[msg.sender] = time;
        uint256 _multiplier = getMultiplier(time);
        multiplier[msg.sender] = _multiplier;

        totalLockedMultiplied += amount * _multiplier / 1e18;
    }

    /**
     * Increase vesting of msg.sender
     **/
    function increaseVesting(uint256 amount) public {
        if (locked[msg.sender] == 0 || unvestingTime[msg.sender] == 0) revert UserNotLocked();
        if (pool.balanceOf(msg.sender) < locked[msg.sender] + amount) revert InsufficientPoolBalance();
        if (unlockTimestamp[msg.sender] > 0) revert TooLate();

        locked[msg.sender] += amount;

        totalLockedMultiplied += amount * multiplier[msg.sender] / 1e18;
    }

    /**
     * Unlock funds - start of unvesting
     **/
    function unlock() public {
        if (locked[msg.sender] == 0 || unvestingTime[msg.sender] == 0) revert UserNotLocked();

        unlockTimestamp[msg.sender] = block.timestamp;
    }

    /**
     * Check how much user can withdraw
     **/
    function availableToWithdraw(address account) public view returns (uint256) {
        if (locked[account] == 0 || unvestingTime[account] == 0) revert UserNotLocked();
        if (unlockTimestamp[account] == 0) revert UserLocked();

        uint256 timeFromUnlock = block.timestamp - unlockTimestamp[account];
        if (timeFromUnlock > unvestingTime[account]) timeFromUnlock = unvestingTime[account];
        uint256 initialUnlock = ONE_DAY * locked[account] / (unvestingTime[account] + ONE_DAY); // 1D / vesting days * locked amount

        return initialUnlock + timeFromUnlock * (locked[account] - initialUnlock) / unvestingTime[account];
    }

    /**
     * Gets pool's spread and distributes among vesting participants.
     * @dev _totalLoans total value of loans
     * @dev _totalDeposits total value of deposits
     **/
    //TODO: run periodically by bots
    function distributeRewards(uint256 fromIndex, uint256 toIndex) public onlyKeeper {
        if (block.timestamp < lastUpdated + updateInterval) revert DistributeTooEarly();

        (fromIndex, toIndex) = fromIndex < toIndex ? (fromIndex, toIndex) : (toIndex, fromIndex);
        toIndex = toIndex < participants.length ? toIndex : participants.length - 1;

        if (rewardAmount[lastUpdated] == 0) {
            rewardAmount[lastUpdated] = pool.balanceOf(address(this));
        }
        uint256 rewards = rewardAmount[lastUpdated];

        for (uint256 i = fromIndex; i <= toIndex; i++) {
            address participant = participants[i];
            if (rewardDistributed[lastUpdated][participant]) {
                continue;
            }

            //TODO: right now we distribute rewards even when someone start withdrawing. The rewards should depend on the amount which is still locked.
            uint256 participantReward = rewards * (locked[participant] - withdrawn[participant]) * multiplier[participant] / 1e18 / totalLockedMultiplied;

            pool.transfer(participant, participantReward);

            rewardDistributed[lastUpdated][participant] = true;
            ++numRewardDistributed[lastUpdated];
            if (numRewardDistributed[lastUpdated] == participants.length) {
                lastUpdated = block.timestamp;
            }
        }
    }

    //TODO: run periodically by bots
    function updateParticipants(uint256 fromIndex, uint256 toIndex) public onlyKeeper {
        (fromIndex, toIndex) = fromIndex < toIndex ? (fromIndex, toIndex) : (toIndex, fromIndex);
        toIndex = toIndex < participants.length ? toIndex : participants.length - 1;
        for (uint256 i = fromIndex; i <= toIndex;) {
            address participant = participants[i];
            if (unlockTimestamp[participant] > 0 && (block.timestamp - unlockTimestamp[participant]) > unvestingTime[participant]) {
                totalLockedMultiplied -= (locked[participant] - withdrawn[participant]) * multiplier[participant] / 1e18;

                unvestingTime[participant] = 0;
                locked[participant] = 0;
                unlockTimestamp[participant] = 0;
                withdrawn[participant] = 0;
                multiplier[participant] = 0;

                participants[i] = participants[participants.length - 1];
                participants.pop();
                --toIndex;
            } else {
                ++i;
            }
        }
    }

    function updateWithdrawn(address account, uint256 amount) public onlyPool {
        withdrawn[account] += amount;
        if (withdrawn[account] > availableToWithdraw(account)) {
            revert WithdrawMoreThanLocked();
        }
        totalLockedMultiplied -= amount * multiplier[account] / 1e18;
    }

    function getMultiplier(uint256 time) public pure returns (uint256){
        if (time >= 30 * ONE_DAY) return 2e18; // min. 30 days
        if (time >= 29 * ONE_DAY) return 1.99e18; // min. 29 days
        if (time >= 28 * ONE_DAY) return 1.98e18; // min. 28 days
        if (time >= 27 * ONE_DAY) return 1.97e18; // min. 27 days
        if (time >= 26 * ONE_DAY) return 1.96e18; // min. 26 days
        if (time >= 25 * ONE_DAY) return 1.948e18; // min. 25 days
        if (time >= 24 * ONE_DAY) return 1.936e18; // min. 24 days
        if (time >= 23 * ONE_DAY) return 1.924e18; // min. 23 days
        if (time >= 22 * ONE_DAY) return 1.912e18; // min. 22 days
        if (time >= 21 * ONE_DAY) return 1.9e18; // min. 21 days
        if (time >= 20 * ONE_DAY) return 1.885e18; // min. 20 days
        if (time >= 19 * ONE_DAY) return 1.871e18; // min. 19 days
        if (time >= 18 * ONE_DAY) return 1.856e18; // min. 18 days
        if (time >= 17 * ONE_DAY) return 1.841e18; // min. 17 days
        if (time >= 16 * ONE_DAY) return 1.824e18; // min. 16 days
        if (time >= 15 * ONE_DAY) return 1.806e18; // min. 15 days
        if (time >= 14 * ONE_DAY) return 1.788e18; // min. 14 days
        if (time >= 13 * ONE_DAY) return 1.768e18; // min. 13 days
        if (time >= 12 * ONE_DAY) return 1.746e18; // min. 12 days
        if (time >= 11 * ONE_DAY) return 1.723e18; // min. 11 days
        if (time >= 10 * ONE_DAY) return 1.698e18; // min. 10 days
        if (time >= 9 * ONE_DAY) return 1.67e18; // min. 9 days
        if (time >= 8 * ONE_DAY) return 1.64e18; // min. 8 days
        if (time >= 7 * ONE_DAY) return 1.605e18; // min. 7 days
        if (time >= 6 * ONE_DAY) return 1.566e18; // min. 6 days
        if (time >= 5 * ONE_DAY) return 1.521e18; // min. 5 days
        if (time >= 4 * ONE_DAY) return 1.468e18; // min. 4 days
        if (time >= 3 * ONE_DAY) return 1.4e18; // min. 3 days
        if (time >= 2 * ONE_DAY) return 1.32e18; // min. 2 days
        if (time >= 1 * ONE_DAY) return 1.2e18; // min. 1 day

        return 1e18;
    }


    // Trying to distribute before the update interval has been reached
    error DistributeTooEarly();

    // Already participates in vesting
    error AlreadyLocked();

    // Vesting time is out of range
    error InvalidVestingTime();

    // Insufficient user balance of pool's tokens
    error InsufficientPoolBalance();

    // User not locked
    error UserNotLocked();

    // User funds are locked
    error UserLocked();

    // Too late
    error TooLate();

    // Withdraw amount is more than locked
    error WithdrawMoreThanLocked();
}