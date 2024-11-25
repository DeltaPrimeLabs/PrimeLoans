// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9f5befa18a7b2a78efc746df4a7feaaf7856b8ac;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PRIME vesting contract
 * @dev Contract distributing PRIME among vesting participants.
 */
contract PrimeVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingInfo {
        uint32 cliffPeriod;
        uint32 vestingPeriod;
        address grantClaimRightTo;
        uint256 totalAmount;
    }

    struct UserInfo {
        VestingInfo info;
        uint256 claimed;
    }

    IERC20 public immutable primeToken;

    uint256 public immutable startTime;

    uint256 public totalAmount;

    bool public vestingInitialized;

    mapping(address => UserInfo) public userInfos;

    /// Errors

    /// @dev Trying to claim from unautorized account
    error Unauthorized();

    /// @dev Input array lengths do not match
    error InputLengthMismatch();

    /// @dev Invalid vesting start time
    error InvalidStartTime();

    /// @dev Invalid address
    error InvalidAddress();

    /// @dev Invalid vesting period
    error InvalidVestingPeriod();

    /// @dev No claim available
    error NothingToClaim();

    /// @dev Trying to claim 0 amount
    error ZeroClaimAmount();

    /// @dev Vesting already initialized
    error AlreadyInitialized();

    /// @dev User already exists
    error UserExists();

    /// @dev Vesting not initialized
    error NotInitialized();

    /// @dev Vesting already started
    error VestingAlreadyStarted();

    /// @dev Insufficient allowance
    error InsufficientAllowance();

    /// @dev Insufficient balance
    error InsufficientBalance();

    /// Events

    event Claimed(
        address indexed user,
        address indexed claimant,
        uint256 indexed amount,
        uint256 timestamp
    );

    event VestingUserAdded(
        address indexed user,
        uint256 indexed totalAmount,
        uint256 cliffPeriod,
        uint256 vestingPeriod,
        uint256 timestamp
    );

    /// Constructor

    constructor(
        address primeToken_,
        uint256 startTime_
    ) {
        if (startTime_ < block.timestamp) {
            revert InvalidStartTime();
        }
        if (primeToken_ == address(0)) {
            revert InvalidAddress();
        }

        primeToken = IERC20(primeToken_);
        startTime = startTime_;
    }

    function initializeVesting(
        address[] memory users_,
        VestingInfo[] memory vestingInfos_,
        bool isLastBatch
    ) external onlyOwner {
        if(vestingInitialized){
            revert AlreadyInitialized();
        }
        if (users_.length != vestingInfos_.length) {
            revert InputLengthMismatch();
        }
        uint256 _totalAmount;

        uint256 len = users_.length;
        for (uint256 i; i != len; ++i) {
            address user = users_[i];
            if (user == address(0)) {
                revert InvalidAddress();
            }
            if(vestingInfos_[i].vestingPeriod == 0){
                revert InvalidVestingPeriod();
            }

            UserInfo storage userInfo = userInfos[user];

            if(userInfo.info.totalAmount != 0){
                revert UserExists();
            }

            userInfo.info = vestingInfos_[i];
            _totalAmount += userInfo.info.totalAmount;

            emit VestingUserAdded(
                user,
                userInfo.info.totalAmount,
                userInfo.info.cliffPeriod,
                userInfo.info.vestingPeriod,
                block.timestamp
            );
        }
        totalAmount += _totalAmount;

        if (isLastBatch) {
            vestingInitialized = true;
        }
    }

    /// Public functions

    function claim() external nonReentrant {
        _claimFor(msg.sender, msg.sender, _claimable(msg.sender));
    }

    function claimWithAmount(uint256 amount) nonReentrant external {
        _claimFor(msg.sender, msg.sender, amount);
    }

    function claimFor(address user) nonReentrant external {
        _claimFor(user, msg.sender, _claimable(user));
    }

    function claimForWithAmount(address user, uint256 amount) nonReentrant external {
        _claimFor(user, msg.sender, amount);
    }

    function claimable(address user) public view returns (uint256) {
        return _claimable(user);
    }

    function sendTokensToVesting() external nonReentrant onlyOwner {
        if(!vestingInitialized){
            revert NotInitialized();
        }
        if(primeToken.balanceOf(owner()) < totalAmount){
            revert InsufficientBalance();
        }
        if(primeToken.allowance(owner(), address(this)) < totalAmount){
            revert InsufficientAllowance();
        }
        if(block.timestamp >= startTime){
            revert VestingAlreadyStarted();
        }

        primeToken.safeTransferFrom(owner(), address(this), totalAmount);
    }

    /// Internal functions

    function _claimFor(address user, address claimant, uint256 amount) internal {
        UserInfo storage userInfo = userInfos[user];

        if (user != claimant && userInfo.info.grantClaimRightTo != claimant) {
            revert Unauthorized();
        }

        uint256 claimableAmount = _claimable(user);
        if (claimableAmount == 0) {
            revert NothingToClaim();
        }
        amount = Math.min(amount, claimableAmount);
        if (amount == 0) {
            revert ZeroClaimAmount();
        }

        userInfo.claimed += amount;

        primeToken.safeTransfer(user, amount);

        emit Claimed(user, claimant, amount, block.timestamp);
    }

    function _claimable(address user) internal view returns (uint256) {
        UserInfo storage userInfo = userInfos[user];

        if(userInfo.info.totalAmount == 0){
            return 0;
        }

        uint256 cliffEnd = startTime + userInfo.info.cliffPeriod;
        if (cliffEnd >= block.timestamp) {
            return 0;
        }

        uint256 duration = Math.min(
            block.timestamp - cliffEnd,
            userInfo.info.vestingPeriod
        );

        return
            (userInfo.info.totalAmount * duration) /
            userInfo.info.vestingPeriod -
            userInfo.claimed;
    }
}
