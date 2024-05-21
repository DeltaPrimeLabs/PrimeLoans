// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../interfaces/IBorrowersRegistry.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import {vPrimeController} from "./vPrimeController.sol";


contract vPrime is PendingOwnableUpgradeable {
    struct Checkpoint {
        uint32 blockTimestamp;
        uint256 balance;
        int256 rate; // Tokens per second
        uint256 maxVPrimeCap;
    }

    IBorrowersRegistry public borrowersRegistry;
    address public vPrimeControllerAddress;
    mapping(address => Checkpoint[]) private _checkpoints; // _checkpoints[address(this)] serves as a total supply checkpoint

    /* ========== INITIALIZER ========== */

    function initialize(IBorrowersRegistry _borrowersRegistry) external initializer {
        borrowersRegistry = _borrowersRegistry;
        __PendingOwnable_init();
    }


    /* ========== MODIFIERS ========== */
    modifier onlyVPrimeController() virtual {
        require(_msgSender() == vPrimeControllerAddress, "Only vPrimeController can call this function");
        _;
    }


    /* ========== MUTATIVE EXTERNAL FUNCTIONS ========== */

    /**
    * @notice Sets the address of the vPrimeController contract.
    * @dev Can only be called by the contract owner.
    * @param _vPrimeControllerAddress The address of the vPrimeController contract.
    */
    function setVPrimeControllerAddress(address _vPrimeControllerAddress) external onlyOwner {
        vPrimeControllerAddress = _vPrimeControllerAddress;
    }

    // Called by the vPrimeController to adjust the rate and maxVPrimeCap of a user
    function adjustRateAndCap(address user, int256 rate, uint256 newMaxVPrimeCap) external onlyVPrimeController {
        uint256 lastRecordedVotes = getVotes(user);
        uint256 currentVotesBalance = balanceOf(user);
        int256 votesDiff = int256(currentVotesBalance) - int256(lastRecordedVotes);

        if (votesDiff > 0) {
            increaseTotalSupply(uint256(votesDiff));
            _writeCheckpoint(_checkpoints[user], _add, uint256(votesDiff), rate, newMaxVPrimeCap);
        } else if (votesDiff < 0) {
            decreaseTotalSupply(uint256(- votesDiff));
            _writeCheckpoint(_checkpoints[user], _subtract, uint256(- votesDiff), rate, newMaxVPrimeCap);
        } else {
            _writeCheckpoint(_checkpoints[user], _add, 0, rate, newMaxVPrimeCap);
        }
    }

    // Called by the vPrimeController to adjust the rate, maxVPrimeCap and overwrite the balance of a user
    // Balance overwrite is used when the user's balance is changed by a different mechanism than the rate
    // In our case that would be locking deposit/sPrime pairs (up to 3 years) for an instant vPrime unvesting
    function adjustRateCapAndBalance(address user, int256 rate, uint256 newMaxVPrimeCap, uint256 balance) external onlyVPrimeController {
        uint256 lastRecordedVotes = getVotes(user);
        int256 votesDiff = int256(balance) - int256(lastRecordedVotes);

        if (votesDiff > 0) {
            increaseTotalSupply(uint256(votesDiff));
            _writeCheckpointOverwriteBalance(_checkpoints[user], balance, rate, newMaxVPrimeCap);
        } else if (votesDiff < 0) {
            decreaseTotalSupply(uint256(- votesDiff));
            _writeCheckpointOverwriteBalance(_checkpoints[user], balance, rate, newMaxVPrimeCap);
        } else {
            _writeCheckpointOverwriteBalance(_checkpoints[user], lastRecordedVotes, rate, newMaxVPrimeCap);
        }
    }

    /* ========== VIEW EXTERNAL FUNCTIONS ========== */

    // Override balanceOf to compute balance dynamically
    function balanceOf(address account) public view returns (uint256) {
        // If `account` is an owner of a PrimeAccount then let's return the balance for the PrimeAccount
        address ownerToLoan = borrowersRegistry.getLoanForOwner(account);
        account = ownerToLoan != address(0) ? ownerToLoan : account;

        if (_checkpoints[account].length == 0) {
            return 0;
        }
        Checkpoint memory cp = _checkpoints[account][_checkpoints[account].length - 1];

        uint256 elapsedTime = block.timestamp - cp.blockTimestamp;
        uint256 newBalance;

        if (cp.rate >= 0) {
            uint256 balanceIncrease = uint256(cp.rate) * elapsedTime;
            newBalance = cp.balance + balanceIncrease;
            return (newBalance > cp.maxVPrimeCap) ? cp.maxVPrimeCap : newBalance;
        } else {
            // If rate is negative, convert to positive for calculation, then subtract
            uint256 balanceDecrease = uint256(- cp.rate) * elapsedTime;
            if (balanceDecrease > cp.balance) {
                // Prevent underflow, setting balance to min cap if decrease exceeds current balance
                return cp.maxVPrimeCap;
            } else {
                newBalance = cp.balance - balanceDecrease;
                return (newBalance < cp.maxVPrimeCap) ? cp.maxVPrimeCap : newBalance;
            }
        }
    }


    /**
     * @dev Clock used for flagging checkpoints. Can be overridden to implement timestamp based checkpoints (and voting).
     */
    // Overrides IERC6372 functions to make the token & governor timestamp-based
    function clock() public view returns (uint48) {
        return uint48(block.timestamp);
    }
    /**
     * @dev Description of the clockx
     */
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure returns (string memory) {
        return "mode=timestamp";
    }

    /**
     * @dev Get the `pos`-th checkpoint for `account`.
     */
    function checkpoints(address account, uint32 pos) public view virtual returns (Checkpoint memory) {
        return _checkpoints[account][pos];
    }

    /**
     * @dev Get number of checkpoints for `account`.
     */
    function numCheckpoints(address account) public view virtual returns (uint32) {
        return SafeCast.toUint32(_checkpoints[account].length);
    }

    /**
     * @dev Gets the last recorded votes balance for `account`
     */
    function getVotes(address account) public view virtual returns (uint256) {
        uint256 pos = _checkpoints[account].length;
        unchecked {
            return pos == 0 ? 0 : _checkpoints[account][pos - 1].balance;
        }
    }

    /**
     * @dev Retrieve the number of votes for `account` at the end of `timestamp`.
     *
     * Requirements:
     *
     * - `timestamp` must be in the past
     */
    function getPastVotes(address account, uint256 timestamp) public view virtual returns (uint256) {
        require(timestamp < clock(), "Future lookup");
        return _checkpointsLookup(_checkpoints[account], timestamp);
    }

    /**
     * @dev Retrieve the `totalSupply` at the end of `timestamp`. Note, this value is the sum of all balances.
     * It is NOT the sum of all the delegated votes!
     *
     * Requirements:
     *
     * - `timestamp` must be in the past
     */
    function getPastTotalSupply(uint256 timestamp) public view virtual returns (uint256) {
        require(timestamp < clock(), "Future lookup");
        return _checkpointsLookup(_checkpoints[address(this)], timestamp);
    }

    function getLastRecordedTotalSupply() public view virtual returns (uint256) {
        uint256 pos = _checkpoints[address(this)].length;
        unchecked {
            return pos == 0 ? 0 : _checkpoints[address(this)][pos - 1].balance;
        }
    }

    /* ========== INTERNAL MUTATIVE FUNCTIONS ========== */

    function increaseTotalSupply(uint256 amount) internal {
        require(getLastRecordedTotalSupply() + amount <= _maxSupply(), "Total supply risks overflowing votes");
        _writeCheckpoint(_checkpoints[address(this)], _add, amount, 0, 0);
    }

    function decreaseTotalSupply(uint256 amount) internal {
        _writeCheckpoint(_checkpoints[address(this)], _subtract, amount, 0, 0);
    }

    function _writeCheckpoint(
        Checkpoint[] storage ckpts,
        function(uint256, uint256) view returns (uint256) op,
        uint256 delta,
        int256 rate,
        uint256 maxVPrimeCap
    ) private returns (uint256 oldWeight, uint256 newWeight) {
        uint256 pos = ckpts.length;
        Checkpoint memory oldCkpt = pos == 0 ? Checkpoint(0, 0, 0, 0) : ckpts[pos - 1];

        oldWeight = oldCkpt.balance;
        newWeight = op(oldWeight, delta);

        if (pos > 0 && oldCkpt.blockTimestamp == clock()) {
            oldCkpt.balance = newWeight;
            oldCkpt.rate = rate;
            oldCkpt.maxVPrimeCap = maxVPrimeCap;
        } else {
            ckpts.push(Checkpoint({
                blockTimestamp: SafeCast.toUint32(clock()),
                balance: newWeight,
                rate: rate,
                maxVPrimeCap: maxVPrimeCap
            }));
        }
    }

    function _writeCheckpointOverwriteBalance(
        Checkpoint[] storage ckpts,
        uint256 balance,
        int256 rate,
        uint256 maxVPrimeCap
    ) private returns (uint256 oldWeight, uint256 newWeight) {
        uint256 pos = ckpts.length;
        Checkpoint memory oldCkpt = pos == 0 ? Checkpoint(0, 0, 0, 0) : ckpts[pos - 1];

        if (pos > 0 && oldCkpt.blockTimestamp == clock()) {
            oldCkpt.balance = balance;
            oldCkpt.rate = rate;
            oldCkpt.maxVPrimeCap = maxVPrimeCap;
        } else {
            ckpts.push(Checkpoint({
                blockTimestamp: SafeCast.toUint32(clock()),
                balance: balance,
                rate: rate,
                maxVPrimeCap: maxVPrimeCap
            }));
        }
    }

    /* ========== INTERNAL VIEW FUNCTIONS ========== */

    /**
     * @dev Lookup a value in a list of (sorted) checkpoints.
     */
    function _checkpointsLookup(Checkpoint[] storage ckpts, uint256 timestamp) private view returns (uint256) {
        // We run a binary search to look for the last (most recent) checkpoint taken before (or at) `timestamp`.
        //
        // Initially we check if the block is recent to narrow the search range.
        // During the loop, the index of the wanted checkpoint remains in the range [low-1, high).
        // With each iteration, either `low` or `high` is moved towards the middle of the range to maintain the invariant.
        // - If the middle checkpoint is after `timestamp`, we look in [low, mid)
        // - If the middle checkpoint is before or equal to `timestamp`, we look in [mid+1, high)
        // Once we reach a single value (when low == high), we've found the right checkpoint at the index high-1, if not
        // out of bounds (in which case we're looking too far in the past and the result is 0).
        // Note that if the latest checkpoint available is exactly for `timestamp`, we end up with an index that is
        // past the end of the array, so we technically don't find a checkpoint after `timestamp`, but it works out
        // the same.
        uint256 length = ckpts.length;

        uint256 low = 0;
        uint256 high = length;

        if (length > 5) {
            uint256 mid = length - Math.sqrt(length);
            if (_unsafeAccess(ckpts, mid).blockTimestamp > timestamp) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        while (low < high) {
            uint256 mid = Math.average(low, high);
            if (_unsafeAccess(ckpts, mid).blockTimestamp > timestamp) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        unchecked {
            return high == 0 ? 0 : _unsafeAccess(ckpts, high - 1).balance;
        }
    }

    /**
     * @dev Maximum token supply. Defaults to `type(uint224).max` (2^224^ - 1).
     */
    function _maxSupply() internal view virtual returns (uint224) {
        return type(uint224).max;
    }


    function _add(uint256 a, uint256 b) private pure returns (uint256) {
        return a + b;
    }

    function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
        return a - b;
    }

    /**
     * @dev Access an element of the array without performing bounds check. The position is assumed to be within bounds.
     */
    function _unsafeAccess(Checkpoint[] storage ckpts, uint256 pos) private pure returns (Checkpoint storage result) {
        assembly {
            mstore(0, ckpts.slot)
            result.slot := add(keccak256(0, 0x20), pos)
        }
    }
}
