// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../interfaces/IRtknToPrimeConverter.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RtknToPrimeConverter is Initializable, IRtknToPrimeConverter, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for ERC20BurnableUpgradeable;

    ERC20BurnableUpgradeable public rTKN;

    uint256 public constant CONVERSION_RATIO = 0.808015513897867e18; // 1 / 0.884 / 1.4; scaled by 1e18 for precision
    uint256 public rRTKNMaxCap;

    Phase public currentPhase;

    mapping(address => uint256) public userrTKNPledged;
    mapping(address => bool) public userProcessed;
    address[] public users;

    uint256 public totalrTKNPledged;
    uint256 public totalAdjustedrTKNPledged;
    uint256 public scalingFactor; // Scaled by 1e18 for precision
    uint256 public currentBatchIndex;

    // Add new event for pledge cancellation
    event PledgeCancelled(address indexed user, uint256 amount);

    function initialize(
        address _rTKNAddress,
        uint256 _rRTKNMaxCap,
        address _owner
    ) external initializer {
        require(_rTKNAddress != address(0), "Invalid token address");
        require(_rRTKNMaxCap > 0, "Max cap must be greater than zero");

        __Ownable_init();
        __ReentrancyGuard_init();

        _transferOwnership(_owner);

        rTKN = ERC20BurnableUpgradeable(_rTKNAddress);
        rRTKNMaxCap = _rRTKNMaxCap;
        currentPhase = Phase.Phase1;
    }

    constructor () {
        _disableInitializers();
    }

    function setRTKNMaxCap(uint256 _newMaxCap) external onlyOwner {
        require(currentPhase == Phase.Phase1, "Can only change cap in Phase 1");
        require(_newMaxCap > 0, "Max cap must be greater than zero");
        emit MaxCapSet(rRTKNMaxCap, _newMaxCap);
        rRTKNMaxCap = _newMaxCap;
    }

    function previewFuturePrimeAmountBasedOnPledgedAmountForUser(address user) external view returns (uint256) {
        return userrTKNPledged[user] * CONVERSION_RATIO / 1e18;
    }

    function pledgerTKN(uint256 amount) external nonReentrant {
        require(currentPhase == Phase.Phase1, "Pledging not allowed in current phase");
        require(amount > 0, "Amount must be greater than zero");

        rTKN.safeTransferFrom(msg.sender, address(this), amount);

        if (userrTKNPledged[msg.sender] == 0) {
            users.push(msg.sender);
        }
        userrTKNPledged[msg.sender] += amount;
        totalrTKNPledged += amount;

        emit Pledged(msg.sender, amount);
    }

    // Add new function to cancel pledge
    function cancelPledge() external nonReentrant {
        require(currentPhase == Phase.Phase1, "Can only cancel pledge in Phase 1");
        uint256 pledgedAmount = userrTKNPledged[msg.sender];
        require(pledgedAmount > 0, "No pledge to cancel");

        // Reset user's pledge
        userrTKNPledged[msg.sender] = 0;
        totalrTKNPledged -= pledgedAmount;

        // Transfer tokens back to user
        rTKN.safeTransfer(msg.sender, pledgedAmount);

        // Remove user from users array if they have no remaining pledge
        // Note: This is an O(n) operation but necessary to maintain accurate user list
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == msg.sender) {
                users[i] = users[users.length - 1];
                users.pop();
                break;
            }
        }

        emit PledgeCancelled(msg.sender, pledgedAmount);
    }

    function burnRTKNs() external onlyOwner {
        require(currentPhase == Phase.Phase1, "Cannot burn RTKNs in current phase");
        uint256 contractBalance = rTKN.balanceOf(address(this));
        rTKN.burn(contractBalance);
        emit Burned(contractBalance);
    }

    function startPhase2() external onlyOwner {
        require(currentPhase == Phase.Phase1, "Already in Phase 2");
        currentPhase = Phase.Phase2;

        uint256 totalrRTKNDemanded = totalrTKNPledged;
        if (totalrRTKNDemanded <= rRTKNMaxCap) {
            scalingFactor = 1e18;
        } else {
            scalingFactor = (rRTKNMaxCap * 1e18) / totalrRTKNDemanded;
        }

        emit PhaseStarted(currentPhase, scalingFactor);
    }

    function processUsers(uint256 batchSize) external nonReentrant {
        require(currentPhase == Phase.Phase2, "Must be in Phase 2");

        uint256 totalUsers = users.length;
        uint256 endIndex = currentBatchIndex + batchSize;
        if (endIndex > totalUsers) {
            endIndex = totalUsers;
        }

        for (uint256 i = currentBatchIndex; i < endIndex; i++) {
            address user = users[i];
            if (!userProcessed[user]) {
                uint256 pledgedAmount = userrTKNPledged[user];
                uint256 adjustedPledgedAmount = (pledgedAmount * scalingFactor) / 1e18;
                uint256 excessAmount = pledgedAmount - adjustedPledgedAmount;

                if (excessAmount > 0) {
                    rTKN.safeTransfer(user, excessAmount);
                }

                userrTKNPledged[user] = adjustedPledgedAmount;
                totalAdjustedrTKNPledged += adjustedPledgedAmount;
                userProcessed[user] = true;

                emit UserProcessed(user, adjustedPledgedAmount, excessAmount);
            }
        }

        currentBatchIndex = endIndex;
    }

    function withdrawrTKN() external onlyOwner nonReentrant {
        require(currentPhase == Phase.Phase2, "Must be in Phase 2");
        require(currentBatchIndex == users.length, "Processing not complete");

        uint256 contractBalance = rTKN.balanceOf(address(this));
        rTKN.safeTransfer(owner(), contractBalance);

        emit Withdrawal(owner(), contractBalance);
    }

    function getTotalUsers() external view returns (uint256) {
        return users.length;
    }
}