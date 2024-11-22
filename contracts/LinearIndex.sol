// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 97d6cc3cb60bfd6feda4ea784b13bf0e7daac710;
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IIndex.sol";

/**
 * LinearIndex
 * The contract contains logic for time-based index recalculation with minimal memory footprint.
 * It could be used as a base building block for any index-based entities like deposits and loans.
 * The index is updated on a linear basis to the compounding happens when a user decide to accumulate the interests
 **/
contract LinearIndex is IIndex, OwnableUpgradeable {

    uint256 private constant SECONDS_IN_YEAR = 365 days;
    uint256 private constant BASE_RATE = 1e18;

    uint256 public index;
    uint256 public indexUpdateTime;

    mapping(uint256 => uint256) prevIndex;
    mapping(address => uint256) userUpdateTime;

    uint256 public rate;

    function initialize(address owner_) external initializer {
        index = BASE_RATE;
        indexUpdateTime = block.timestamp;

        __Ownable_init();
        if (address(owner_) != address(0)) {
            transferOwnership(owner_);
        }
    }

    /* ========== SETTERS ========== */

    /**
     * Sets the new rate
     * Before the new rate is set, the index is updated accumulating interest
     * @dev _rate the value of updated rate
   **/
    function setRate(uint256 _rate) public override onlyOwner {
        updateIndex();
        rate = _rate;
        emit RateUpdated(rate, block.timestamp);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * Updates user index
     * It persists the update time and the update index time->index mapping
     * @dev user address of the index owner
   **/
    function updateUser(address user) public override onlyOwner {
        userUpdateTime[user] = block.timestamp;
        prevIndex[block.timestamp] = getIndex();
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * Gets current value of the linear index
     * It recalculates the value on-demand without updating the storage
     **/
    function getIndex() public view override returns (uint256) {
        uint256 period = block.timestamp - indexUpdateTime;
        if (period > 0) {
            return index * getLinearFactor(period) / 1e27;
        } else {
            return index;
        }
    }

    /**
     * Gets the user value recalculated to the current index
     * It recalculates the value on-demand without updating the storage
     * Ray operations round up the result, but it is only an issue for very small values (with an order of magnitude
     * of 1 Wei)
     **/
    function getIndexedValue(uint256 value, address user) public view override returns (uint256) {
        uint256 userTime = userUpdateTime[user];
        uint256 prevUserIndex = userTime == 0 ? getIndex() : prevIndex[userTime];

        return value * getIndex() / prevUserIndex;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function updateIndex() internal {
        prevIndex[indexUpdateTime] = index;

        index = getIndex();
        indexUpdateTime = block.timestamp;
    }

    /**
     * Returns a linear factor in Ray
     **/
    function getLinearFactor(uint256 period) virtual internal view returns (uint256) {
        return rate * period * 1e9 / SECONDS_IN_YEAR + 1e27;
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    function renounceOwnership() public virtual override {}

    /* ========== EVENTS ========== */

    /**
     * @dev Emitted after updating the current rate
     * @param updatedRate the value of updated rate
     * @param timestamp of the rate update
     **/
    event RateUpdated(uint256 updatedRate, uint256 timestamp);
}