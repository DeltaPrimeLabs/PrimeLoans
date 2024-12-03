// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RevenueDistributor is OwnableUpgradeable{
    using SafeERC20 for IERC20;

    struct Epoch {
        bool active;
        address rewardToken;
        uint256 totalAllocation;
        mapping(address => uint256) allocations;
        mapping(address => bool) claimed;
    }

    mapping(uint256 => Epoch) public epochs;
    address public pauseAdmin;
    bool public paused;

    event EpochUpdated(uint256 epochId, address rewardToken, uint256 totalAllocation);
    event EpochInitiated(uint256 epochId);
    event TokensClaimed(uint256[] epochIds, address user, uint256[] amounts);
    event BatchTokensClaimed(uint256 epochId, address[] users, uint256[] amounts);
    event PauseAdminChanged(address newPauseAdmin);
    event Paused();
    event Unpaused();


    modifier epochActive(uint256 epochId) {
        require(epochs[epochId].active, "Epoch not active");
        _;
    }

    function initialize(address _pauseAdmin) external initializer {
        __Ownable_init();
        pauseAdmin = _pauseAdmin;
    }

    constructor() {
        _disableInitializers();
    }

    function setEpochReward(
        uint256 epochId,
        address rewardToken,
        address[] calldata users,
        uint256[] calldata allocations
    ) external onlyOwner {
        require(users.length == allocations.length, "Mismatched inputs");
        require(!epochs[epochId].active, "Epoch already active");
        require(rewardToken != address(0), "Invalid reward token");

        Epoch storage epoch = epochs[epochId];
        epoch.rewardToken = rewardToken;
        uint256 totalAllocation;

        for (uint256 i = 0; i < users.length; i++) {
            epoch.allocations[users[i]] += allocations[i];
            totalAllocation += allocations[i];
        }

        epoch.totalAllocation = totalAllocation;

        emit EpochUpdated(epochId, rewardToken, totalAllocation);
    }

    function initiateEpoch(uint256 epochId) external onlyOwner {
        Epoch storage epoch = epochs[epochId];
        require(!epoch.active, "Epoch already active");

        // Transfer total tokens to this contract
        IERC20(epoch.rewardToken).safeTransferFrom(
            msg.sender,
            address(this),
            epoch.totalAllocation
        );

        epoch.active = true;
        emit EpochInitiated(epochId);
    }

    function claim(uint256 epochId) external epochActive(epochId) whenNotPaused {
        uint256 allocation = _claim(epochId, msg.sender);
        uint256[] memory epochIds = new uint256[](1);
        uint256[] memory allocations = new uint256[](1);

        epochIds[0] = epochId;
        allocations[0] = allocation;
        emit TokensClaimed(epochIds, msg.sender, allocations);
    }

    function claimMultiple(uint256[] calldata epochIds) external whenNotPaused {
        uint256[] memory allocations = new uint256[](epochIds.length);
        for (uint256 i = 0; i < epochIds.length; i++) {
            if (epochs[epochIds[i]].active) {
                allocations[i] = _claim(epochIds[i], msg.sender);
            }
        }
        emit TokensClaimed(epochIds, msg.sender, allocations);
    }

    function batchClaim(uint256 epochId, address[] calldata users) external onlyOwner epochActive(epochId) {
        uint256[] memory allocations = new uint256[](users.length);

        for (uint256 i = 0; i < users.length; i++) {
            allocations[i] = _claim(epochId, users[i]);
        }

        emit BatchTokensClaimed(epochId, users, allocations);
    }

    function _claim(uint256 epochId, address user) internal returns (uint256) {
        Epoch storage epoch = epochs[epochId];
        require(!epoch.claimed[user], "Already claimed");

        uint256 allocation = epoch.allocations[user];
        require(allocation > 0, "No allocation for this user");

        epoch.claimed[user] = true;
        IERC20(epoch.rewardToken).safeTransfer(user, allocation);

        return allocation;
    }

    function setPauseAdmin(address _pauseAdmin) external onlyOwner {
        pauseAdmin = _pauseAdmin;
        emit PauseAdminChanged(_pauseAdmin);
    }

    function pause() external {
        require(msg.sender == pauseAdmin, "Not authorized");
        paused = true;
        emit Paused();
    }

    function unpause() external {
        require(msg.sender == pauseAdmin, "Not authorized");
        paused = false;
        emit Unpaused();
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
}
