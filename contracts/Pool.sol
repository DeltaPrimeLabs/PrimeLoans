// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: df4e8663a52ef1d5a18b05efa088f2816405be91;
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./abstract/PendingOwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IIndex.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IVPrimeController.sol";
import "./interfaces/IRatesCalculator.sol";
import "./interfaces/IBorrowersRegistry.sol";
import "./interfaces/IPoolRewarder.sol";
import "./VestingDistributor.sol";


/**
 * @title Pool
 * @dev Contract allowing user to deposit to and borrow from a dedicated user account
 * Depositors are rewarded with the interest rates collected from borrowers.
 * The interest rates calculation is delegated to an external calculator contract.
 */
contract Pool is PendingOwnableUpgradeable, ReentrancyGuardUpgradeable, IERC20, ProxyConnector {
    using TransferHelper for address payable;
    using Math for uint256;

    uint256 public totalSupplyCap;

    mapping(address => mapping(address => uint256)) private _allowed;
    mapping(address => uint256) internal _deposited;

    mapping(address => uint256) public borrowed;

    IRatesCalculator public ratesCalculator;
    IBorrowersRegistry public borrowersRegistry;
    IPoolRewarder public poolRewarder;

    IIndex public depositIndex;
    IIndex public borrowIndex;

    address payable public tokenAddress;

    VestingDistributor public vestingDistributor; // Needs to stay here in order to preserve the storage layout

    uint8 internal _decimals;

    struct LockDetails {
        uint256 lockTime;
        uint256 amount;
        uint256 unlockTime;
    }
    mapping(address => LockDetails[]) public locks;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    ITokenManager public tokenManager;

    struct WithdrawalIntent {
        uint256 amount;
        uint256 actionableAt;
        uint256 expiresAt;
    }

    struct IntentInfo {
        uint256 amount;           // Amount requested for withdrawal
        uint256 actionableAt;     // Timestamp when withdrawal becomes possible
        uint256 expiresAt;        // Timestamp when intent expires
        bool isPending;           // True if waiting period not completed
        bool isActionable;        // True if can be withdrawn now
        bool isExpired;          // True if expired
    }

    mapping(address => WithdrawalIntent[]) public withdrawalIntents;


    /* ========== METHODS ========== */

    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                lockedBalance += locks[account][i].amount;
            }
        }
        return lockedBalance;
    }

    function getNotLockedBalance(address account, uint256 excludedIntentAmount) public view returns (uint256 notLockedBalance) {
        uint256 lockedBalance = getLockedBalance(account);
        uint256 totalIntentAmount = getTotalIntentAmount(account);

        // Subtract the excluded intent amount
        totalIntentAmount = totalIntentAmount > excludedIntentAmount ? totalIntentAmount - excludedIntentAmount : 0;

        uint256 balance = balanceOf(account);
        uint256 unavailableBalance = lockedBalance + totalIntentAmount;

        if (balance < unavailableBalance) {
            notLockedBalance = 0;
        } else {
            notLockedBalance = balance - unavailableBalance;
        }
    }


    function lockDeposit(uint256 amount, uint256 lockTime) public {
        require(getNotLockedBalance(msg.sender, 0) >= amount, "Insufficient balance to lock");
        require(lockTime <= MAX_LOCK_TIME, "Cannot lock for more than 3 years");
        locks[msg.sender].push(LockDetails(lockTime, amount, block.timestamp + lockTime));

        emit DepositLocked(msg.sender, amount, lockTime, block.timestamp + lockTime);

        notifyVPrimeController(msg.sender);
    }


    /**
     * @notice Calculates and returns the fully vested locked balance for a given account.
     * @dev The fully vested locked balance is used in the governance mechanism of the system, specifically for the allocation of vPrime tokens.
     * The method calculates the fully vested locked balance by iterating over all the locks of the account and summing up the amounts of those locks that are still active (i.e., their `unlockTime` is greater than the current block timestamp). However, the amount of each lock is scaled by the ratio of its `lockTime` to the `MAX_LOCK_TIME` (3 years). This means that the longer the lock time, the larger the contribution of the lock to the fully vested locked balance.
     * The fully vested locked balance is used to calculate the maximum vPrime allocation for a user. Users accrue vPrime over a period of 3 years, from 0 to the maximum vPrime based on their 10-1 pairs of pool-deposit and sPrime. Locking pool deposits and sPrime immediately vests the vPrime.
     * @param account The address of the account for which to calculate the fully vested locked balance.
     * @return fullyVestedBalance The fully vested locked balance of the provided account.
     */
    function getFullyVestedLockedBalance(address account) public view returns (uint256 fullyVestedBalance) {
        fullyVestedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) { // Lock is still active
                fullyVestedBalance += locks[account][i].amount * locks[account][i].lockTime / MAX_LOCK_TIME;
            }
        }
    }

    function setTokenManager(ITokenManager _tokenManager) public onlyOwner {
        tokenManager = _tokenManager;
    }

    function getVPrimeControllerAddress() public view returns (address) {
        if(address(tokenManager) != address(0)) {
            return tokenManager.getVPrimeControllerAddress();
        }
        return address(0);
    }


    function initialize(IRatesCalculator ratesCalculator_, IBorrowersRegistry borrowersRegistry_, IIndex depositIndex_, IIndex borrowIndex_, address payable tokenAddress_, IPoolRewarder poolRewarder_, uint256 _totalSupplyCap) public initializer {
        require(AddressUpgradeable.isContract(address(ratesCalculator_))
        && AddressUpgradeable.isContract(address(borrowersRegistry_))
        && AddressUpgradeable.isContract(address(depositIndex_))
        && AddressUpgradeable.isContract(address(borrowIndex_))
        && (AddressUpgradeable.isContract(address(poolRewarder_)) || address(poolRewarder_) == address(0)), "Wrong init arguments");

        borrowersRegistry = borrowersRegistry_;
        ratesCalculator = ratesCalculator_;
        depositIndex = depositIndex_;
        borrowIndex = borrowIndex_;
        poolRewarder = poolRewarder_;
        tokenAddress = tokenAddress_;
        totalSupplyCap = _totalSupplyCap;

        _decimals = IERC20Metadata(tokenAddress_).decimals();

        __Ownable_init();
        __ReentrancyGuard_init();
        _updateRates();
    }


    function correctBalances(address[] calldata accounts, uint256[] calldata balances) external nonReentrant onlyOwner {
        require(accounts.length == balances.length, "Arrays length mismatch");

        for(uint i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            uint256 balance = balances[i];

            _accumulateDepositInterest(account);

            uint256 currentBalance = balanceOf(account);
            if(balance > currentBalance) {
                uint256 diff = balance - currentBalance;
                _deposited[address(this)] += diff;
                _mint(account, diff);
                emit BalanceCorrected(account, int256(diff), block.timestamp);
            } else if(balance < currentBalance) {
                uint256 diff = currentBalance - balance;
                _deposited[address(this)] -= diff;
                _burn(account, diff);
                emit BalanceCorrected(account, -int256(diff), block.timestamp);
            }
        }
    }


    function checkIfCanBorrow(address account) internal view returns (bool) {
        if (address(borrowersRegistry) == address(0))
            revert BorrowersRegistryNotConfigured();
        if (!borrowersRegistry.canBorrow(account))
            revert NotAuthorizedToBorrow();
        return true;
    }

    /* ========== SETTERS ========== */

    /**
     * Sets new totalSupplyCap limiting how much in total can be deposited to the Pool.
     * Only the owner of the Contract can execute this function.
     * @dev _newTotalSupplyCap new deposit cap
    **/
    function setTotalSupplyCap(uint256 _newTotalSupplyCap) external onlyOwner {
        totalSupplyCap = _newTotalSupplyCap;
    }

    /**
     * Sets the new Pool Rewarder.
     * The IPoolRewarder that distributes additional token rewards to people having a stake in this pool proportionally to their stake and time of participance.
     * Only the owner of the Contract can execute this function.
     * @dev _poolRewarder the address of PoolRewarder
    **/
    function setPoolRewarder(IPoolRewarder _poolRewarder) external onlyOwner {
        if(!AddressUpgradeable.isContract(address(_poolRewarder)) && address(_poolRewarder) != address(0)) revert NotAContract(address(poolRewarder));
        poolRewarder = _poolRewarder;

        emit PoolRewarderChanged(address(_poolRewarder), block.timestamp);
    }

    /**
     * Sets the new rate calculator.
     * The calculator is an external contract that contains the logic for calculating deposit and borrowing rates.
     * Only the owner of the Contract can execute this function.
     * @dev ratesCalculator the address of rates calculator
     **/
    function setRatesCalculator(IRatesCalculator ratesCalculator_) external onlyOwner {
        // setting address(0) ratesCalculator_ freezes the pool
        if(!AddressUpgradeable.isContract(address(ratesCalculator_)) && address(ratesCalculator_) != address(0)) revert NotAContract(address(ratesCalculator_));
        ratesCalculator = ratesCalculator_;
        if (address(ratesCalculator_) != address(0)) {
            _updateRates();
        }

        emit RatesCalculatorChanged(address(ratesCalculator_), block.timestamp);
    }

    /**
     * Sets the new borrowers registry contract.
     * The borrowers registry decides if an account can borrow funds.
     * Only the owner of the Contract can execute this function.
     * @dev borrowersRegistry the address of borrowers registry
     **/
    function setBorrowersRegistry(IBorrowersRegistry borrowersRegistry_) external onlyOwner {
        if(!AddressUpgradeable.isContract(address(borrowersRegistry_))) revert NotAContract(address(borrowersRegistry_));

        borrowersRegistry = borrowersRegistry_;
        emit BorrowersRegistryChanged(address(borrowersRegistry_), block.timestamp);
    }


    /* ========== MUTATIVE FUNCTIONS ========== */

    function createWithdrawalIntent(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");

        // Remove expired intents first
        _removeExpiredIntents(msg.sender);

        uint256 availableBalance = getNotLockedBalance(msg.sender, 0);
        if(amount > availableBalance){
            revert InsufficientAvailableBalance(amount, availableBalance);
        }

        uint256 actionableAt = block.timestamp + 24 hours;
        uint256 expiresAt = actionableAt + 48 hours;

        WithdrawalIntent memory newIntent = WithdrawalIntent({
            amount: amount,
            actionableAt: actionableAt,
            expiresAt: expiresAt
        });

        withdrawalIntents[msg.sender].push(newIntent);

        emit WithdrawalIntentCreated(msg.sender, amount, actionableAt, expiresAt);
    }


    function cancelWithdrawalIntent(uint256 intentIndex) external nonReentrant {
        WithdrawalIntent[] storage intents = withdrawalIntents[msg.sender];

        require(intentIndex < intents.length, "Invalid intent index");

        WithdrawalIntent memory intent = intents[intentIndex];

        // Remove the intent
        uint256 lastIndex = intents.length - 1;
        if (intentIndex != lastIndex) {
            intents[intentIndex] = intents[lastIndex];
        }
        intents.pop();

        emit WithdrawalIntentCancelled(msg.sender, intent.amount, block.timestamp);
    }

    function clearExpiredIntents() external {
        _removeExpiredIntents(msg.sender);
    }

    function transfer(address recipient, uint256 amount) public virtual override nonReentrant returns (bool) {
        if(recipient == address(0)) revert TransferToZeroAddress();
        if(recipient == address(this)) revert TransferToPoolAddress();
        if(!isWithdrawalAmountAvailable(msg.sender, amount, 0)){
            revert InsufficientAvailableBalance(amount, getNotLockedBalance(msg.sender, 0));
        }

        address account = msg.sender;
        _accumulateDepositInterest(account);

        // (this is verified in "require" above)
        unchecked {
            _deposited[account] -= amount;
        }

        _accumulateDepositInterest(recipient);
        _deposited[recipient] += amount;

        // Handle rewards
        if(address(poolRewarder) != address(0) && amount != 0){
            uint256 unstaked = poolRewarder.withdrawFor(amount, account);
            if(unstaked > 0) {
                poolRewarder.stakeFor(unstaked, recipient);
            }
        }

        emit Transfer(account, recipient, amount);

        notifyVPrimeController(msg.sender);
        notifyVPrimeController(recipient);

        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowed[owner][spender];
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        if(spender == address(0)) revert SpenderZeroAddress();
        uint256 newAllowance = _allowed[msg.sender][spender] + addedValue;
        _allowed[msg.sender][spender] = newAllowance;

        emit Approval(msg.sender, spender, newAllowance);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        if(spender == address(0)) revert SpenderZeroAddress();
        uint256 currentAllowance = _allowed[msg.sender][spender];
        if(currentAllowance < subtractedValue) revert InsufficientAllowance(subtractedValue, currentAllowance);

        uint256 newAllowance = currentAllowance - subtractedValue;
        _allowed[msg.sender][spender] = newAllowance;

        emit Approval(msg.sender, spender, newAllowance);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        if(spender == address(0)) revert SpenderZeroAddress();
        _allowed[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);

        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override nonReentrant returns (bool) {
        if(_allowed[sender][msg.sender] < amount) revert InsufficientAllowance(amount, _allowed[sender][msg.sender]);

        if(recipient == address(0)) revert TransferToZeroAddress();
        if(recipient == address(this)) revert TransferToPoolAddress();

        if(!isWithdrawalAmountAvailable(sender, amount, 0)){
            revert InsufficientAvailableBalance(amount, getNotLockedBalance(sender, 0));
        }

        _accumulateDepositInterest(sender);

        _deposited[sender] -= amount;
        _allowed[sender][msg.sender] -= amount;

        _accumulateDepositInterest(recipient);
        _deposited[recipient] += amount;

        // Handle rewards
        if(address(poolRewarder) != address(0) && amount != 0){
            uint256 unstaked = poolRewarder.withdrawFor(amount, sender);
            if(unstaked > 0) {
                poolRewarder.stakeFor(unstaked, recipient);
            }
        }

        emit Transfer(sender, recipient, amount);

        notifyVPrimeController(sender);
        notifyVPrimeController(recipient);

        return true;
    }


    /**
     * Deposits the amount
     * It updates user deposited balance, total deposited and rates
     **/
    function deposit(uint256 _amount) public virtual {
        depositOnBehalf(_amount, msg.sender);
    }

    /**
     * Deposits the amount on behalf of `_of` user.
     * It updates `_of` user deposited balance, total deposited and rates
     **/
    function depositOnBehalf(uint256 _amount, address _of) public virtual nonReentrant {
        if(_amount == 0) revert ZeroDepositAmount();
        require(_of != address(0), "Address zero");
        require(_of != address(this), "Cannot deposit on behalf of pool");

        _amount = Math.min(_amount, IERC20(tokenAddress).balanceOf(msg.sender));

        _accumulateDepositInterest(_of);

        if(totalSupplyCap != 0){
            if(_deposited[address(this)] + _amount > totalSupplyCap) revert TotalSupplyCapBreached();
        }

        _transferToPool(msg.sender, _amount);

        _mint(_of, _amount);
        _deposited[address(this)] += _amount;
        _updateRates();

        if (address(poolRewarder) != address(0)) {
            poolRewarder.stakeFor(_amount, _of);
        }

        emit DepositOnBehalfOf(msg.sender, _of, _amount, block.timestamp);

        notifyVPrimeController(_of);
    }

    function _transferToPool(address from, uint256 amount) internal virtual {
        tokenAddress.safeTransferFrom(from, address(this), amount);
    }

    function _transferFromPool(address to, uint256 amount) internal virtual {
        tokenAddress.safeTransfer(to, amount);
    }

    function isWithdrawalAmountAvailable(address account, uint256 amount, uint256 excludedIntentAmount) public view returns (bool) {
        uint256 availableBalance = getNotLockedBalance(account, excludedIntentAmount);
        return amount <= availableBalance;
    }

    /**
     * @dev Validates withdrawal intents and checks if requested amount is within acceptable range
     * @param intents The array of withdrawal intents for the user
     * @param intentIndices Array of intent indices to validate
     * @param requestedAmount The total amount requested for withdrawal
     * @return finalAmount The actual amount to be withdrawn (may be less than requested if balance insufficient)
    */
    function validateWithdrawalIntents(
        WithdrawalIntent[] storage intents,
        uint256[] calldata intentIndices,
        uint256 requestedAmount
    ) internal view returns (uint256 finalAmount) {
        require(intentIndices.length > 0, "Must provide at least one intent");

        // Check indices are monotonically increasing
        for(uint256 i = 1; i < intentIndices.length; i++) {
            require(
                intentIndices[i] > intentIndices[i-1],
                "Intent indices must be strictly increasing"
            );
        }

        // Validate each intent and sum up total intended amount
        uint256 totalIntentAmount = 0;
        for(uint256 i = 0; i < intentIndices.length; i++) {
            uint256 index = intentIndices[i];
            require(index < intents.length, "Invalid intent index");

            WithdrawalIntent storage intent = intents[index];
            require(block.timestamp >= intent.actionableAt, "Withdrawal intent not matured");
            require(block.timestamp <= intent.expiresAt, "Withdrawal intent expired");

            totalIntentAmount += intent.amount;
        }

        // Allow up to 1% more than total intent amount
        uint256 maxAllowedAmount = totalIntentAmount + (totalIntentAmount / 100);
        require(
            requestedAmount <= maxAllowedAmount,
            "Requested amount exceeds intent amount by more than 1%"
        );

        // Return the minimum of requested amount and actual balance
        return Math.min(requestedAmount, getNotLockedBalance(msg.sender, totalIntentAmount));
    }

    /**
 * Withdraws selected amount using multiple intents
 * @param _amount the total amount to be withdrawn
 * @param intentIndices array of intent indices to be used for withdrawal
 **/
    function withdraw(uint256 _amount, uint256[] calldata intentIndices) public virtual nonReentrant {
        WithdrawalIntent[] storage intents = withdrawalIntents[msg.sender];

        // Validate intents and get final withdrawal amount
        uint256 finalAmount = validateWithdrawalIntents(intents, intentIndices, _amount);

        require(isWithdrawalAmountAvailable(msg.sender, finalAmount, finalAmount), "Balance is locked");

        // Remove intents from highest to lowest index to maintain array integrity
        for(uint256 i = intentIndices.length; i > 0; i--) {
            uint256 indexToRemove = intentIndices[i - 1];
            uint256 lastIndex = intents.length - 1;
            if (indexToRemove != lastIndex) {
                intents[indexToRemove] = intents[lastIndex];
            }
            intents.pop();
        }

        _accumulateDepositInterest(msg.sender);

        if(finalAmount > IERC20(tokenAddress).balanceOf(address(this))) revert InsufficientPoolFunds();
        if(finalAmount > _deposited[address(this)]) revert BurnAmountExceedsBalance();

        _deposited[address(this)] -= finalAmount;
        _burn(msg.sender, finalAmount);

        _updateRates();

        notifyVPrimeController(msg.sender);

        if (address(poolRewarder) != address(0)) {
            poolRewarder.withdrawFor(finalAmount, msg.sender);
        }

        _transferFromPool(msg.sender, finalAmount);

        emit Withdrawal(msg.sender, finalAmount, block.timestamp);
    }

    /**
     * Borrows the specified amount
     * It updates user borrowed balance, total borrowed amount and rates
     * @dev _amount the amount to be borrowed
     * @dev It is only meant to be used by a SmartLoanDiamondProxy
     **/
    function borrow(uint256 _amount) public virtual canBorrow nonReentrant {
        if (_amount > IERC20(tokenAddress).balanceOf(address(this))) revert InsufficientPoolFunds();

        _accumulateBorrowingInterest(msg.sender);

        borrowed[msg.sender] += _amount;
        borrowed[address(this)] += _amount;

        _transferFromPool(msg.sender, _amount);

        _updateRates();

        emit Borrowing(msg.sender, _amount, block.timestamp);
    }

    /**
     * Repays the amount
     * It updates user borrowed balance, total borrowed amount and rates
     * @dev It is only meant to be used by a SmartLoanDiamondProxy
     **/
    function repay(uint256 amount) external nonReentrant {
        _accumulateBorrowingInterest(msg.sender);

        if(amount > borrowed[msg.sender]) revert RepayingMoreThanWasBorrowed();
        _transferToPool(msg.sender, amount);

        borrowed[msg.sender] -= amount;
        borrowed[address(this)] -= amount;

        _updateRates();

        emit Repayment(msg.sender, amount, block.timestamp);
    }

    function notifyVPrimeController(address account) internal {
        address vPrimeControllerAddress = getVPrimeControllerAddress();
        if(vPrimeControllerAddress != address(0)){
            if(containsOracleCalldata()) {
                proxyCalldata(
                    vPrimeControllerAddress,
                    abi.encodeWithSignature
                    ("updateVPrimeSnapshot(address)", account),
                    false
                );
            } else {
                IVPrimeController(vPrimeControllerAddress).setUserNeedsUpdate(account);
            }
        }
    }

    function _removeExpiredIntents(address user) internal {
        WithdrawalIntent[] storage intents = withdrawalIntents[user];
        uint256 i = 0;
        while (i < intents.length) {
            if (block.timestamp > intents[i].expiresAt) {
                // Remove expired intent
                uint256 lastIndex = intents.length - 1;
                if (i != lastIndex) {
                    intents[i] = intents[lastIndex];
                }
                intents.pop();
                // Do not increment i as the new element at index i needs to be checked
            } else {
                i++;
            }
        }
    }

    /* ========= VIEW METHODS ========= */

    /**
      * @dev Returns array of all intents with their current status for a given user
      * @param user Address of the user to check intents for
      * @return Array of IntentInfo structs containing all intent details and status
     **/
    function getUserIntents(address user) external view returns (IntentInfo[] memory) {
        WithdrawalIntent[] storage intents = withdrawalIntents[user];
        IntentInfo[] memory intentInfos = new IntentInfo[](intents.length);

        for (uint256 i = 0; i < intents.length; i++) {
            WithdrawalIntent storage intent = intents[i];

            intentInfos[i] = IntentInfo({
                amount: intent.amount,
                actionableAt: intent.actionableAt,
                expiresAt: intent.expiresAt,
                isPending: block.timestamp < intent.actionableAt,
                isActionable: block.timestamp >= intent.actionableAt && block.timestamp <= intent.expiresAt,
                isExpired: block.timestamp > intent.expiresAt
            });
        }

        return intentInfos;
    }

    /**
      * Returns the total amount of the withdrawal intents for the given user
      * @dev user the address of the queried user
    **/
    function getTotalIntentAmount(address user) public view returns (uint256 totalIntentAmount) {
        WithdrawalIntent[] storage intents = withdrawalIntents[user];
        for (uint256 i = 0; i < intents.length; i++) {
            if (block.timestamp <= intents[i].expiresAt) {
                totalIntentAmount += intents[i].amount;
            }
        }
    }


    /**
     * Returns the current borrowed amount for the given user
     * The value includes the interest rates owned at the current moment
     * @dev _user the address of queried borrower
    **/
    function getBorrowed(address _user) public view returns (uint256) {
        return borrowIndex.getIndexedValue(borrowed[_user], _user);
    }

    function name() public virtual pure returns(string memory _name){
        _name = "";
    }

    function symbol() public virtual pure returns(string memory _symbol){
        _symbol = "";
    }

    function decimals() public virtual view returns(uint8){
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return balanceOf(address(this));
    }

    function totalBorrowed() public view returns (uint256) {
        return getBorrowed(address(this));
    }


    // Calls the IPoolRewarder.getRewardsFor() that sends pending rewards to msg.sender
    function getRewards() external {
        poolRewarder.getRewardsFor(msg.sender);
    }

    // Returns number of pending rewards for msg.sender
    function checkRewards() external view returns (uint256) {
        return poolRewarder.earned(msg.sender);
    }

    // Returns max. acceptable pool utilisation after borrow action
    function getMaxPoolUtilisationForBorrowing() virtual public view returns (uint256) {
        return 0.925e18;
    }

    /**
     * Returns the current deposited amount for the given user
     * The value includes the interest rates earned at the current moment
     * @dev _user the address of queried depositor
     **/
    function balanceOf(address user) public view override returns (uint256) {
        return depositIndex.getIndexedValue(_deposited[user], user);
    }

    /**
     * Returns the current interest rate for deposits
     **/
    function getDepositRate() public view returns (uint256) {
        return ratesCalculator.calculateDepositRate(totalBorrowed(), totalSupply());
    }

    /**
     * Returns the current interest rate for borrowings
     **/
    function getBorrowingRate() public view returns (uint256) {
        return ratesCalculator.calculateBorrowingRate(totalBorrowed(), totalSupply());
    }

    /**
     * Returns full pool status
     */
    function getFullPoolStatus() public view returns (uint256[5] memory) {
        return [
            totalSupply(),
            getDepositRate(),
            getBorrowingRate(),
            totalBorrowed(),
            getMaxPoolUtilisationForBorrowing()
            ];
    }

    function containsOracleCalldata() public view returns (bool) {
        // Checking if the calldata ends with the RedStone marker
        bool hasValidRedstoneMarker;
        assembly {
            let calldataLast32Bytes := calldataload(sub(calldatasize(), STANDARD_SLOT_BS))
            hasValidRedstoneMarker := eq(
                REDSTONE_MARKER_MASK,
                and(calldataLast32Bytes, REDSTONE_MARKER_MASK)
            )
        }
        return hasValidRedstoneMarker;
    }

    /**
     * Recovers the surplus funds resultant from difference between deposit and borrowing rates
     **/
    function recoverSurplus(uint256 amount, address account) public onlyOwner nonReentrant {
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        uint256 surplus = balance + totalBorrowed() - totalSupply();

        if(amount > balance) revert InsufficientPoolFunds();
        if(surplus < amount) revert InsufficientSurplus();

        _transferFromPool(account, amount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _mint(address to, uint256 amount) internal {
        if(to == address(0)) revert MintToAddressZero();

        _deposited[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    function _burn(address account, uint256 amount) internal {
        if(amount > _deposited[account]) revert BurnAmountExceedsBalance();

        // verified in "require" above
        unchecked {
            _deposited[account] -= amount;
        }

        emit Transfer(account, address(0), amount);
    }


    function _updateRates() internal {
        uint256 _totalBorrowed = totalBorrowed();
        uint256 _totalSupply = totalSupply();
        if(address(ratesCalculator) == address(0)) revert PoolFrozen();
        depositIndex.setRate(ratesCalculator.calculateDepositRate(_totalBorrowed, _totalSupply));
        borrowIndex.setRate(ratesCalculator.calculateBorrowingRate(_totalBorrowed, _totalSupply));
    }

    function _accumulateDepositInterest(address user) internal {
        uint256 interest = balanceOf(user) - _deposited[user];

        _mint(user, interest);
        _deposited[address(this)] = balanceOf(address(this));

        emit InterestCollected(user, interest, block.timestamp);

        depositIndex.updateUser(user);
        depositIndex.updateUser(address(this));
    }

    function _accumulateBorrowingInterest(address user) internal {
        borrowed[user] = getBorrowed(user);
        borrowed[address(this)] = getBorrowed(address(this));

        borrowIndex.updateUser(user);
        borrowIndex.updateUser(address(this));
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    function renounceOwnership() public virtual override {}

    /* ========== MODIFIERS ========== */

    modifier canBorrow() {
        if(address(borrowersRegistry) == address(0)) revert BorrowersRegistryNotConfigured();
        if(!borrowersRegistry.canBorrow(msg.sender)) revert NotAuthorizedToBorrow();
        if(totalSupply() == 0) revert InsufficientPoolFunds();
        _;
        if((totalBorrowed() * 1e18) / totalSupply() > getMaxPoolUtilisationForBorrowing()) revert MaxPoolUtilisationBreached();
    }

    /* ========== EVENTS ========== */


    /**
        * @dev emitted after the user creates withdrawal intent
        * @param user the address that creates the withdrawal intent
        * @param amount the amount of the withdrawal intent
        * @param actionableAt the time when the withdrawal intent can be executed
        * @param expiresAt the time when the withdrawal intent expires
    **/
    event WithdrawalIntentCreated(address indexed user, uint256 amount, uint256 actionableAt, uint256 expiresAt);

    /**
        * @dev emitted after the user cancels withdrawal intent
        * @param user the address that cancels the withdrawal intent
        * @param amount the amount of the withdrawal intent
        * @param timestamp of the cancellation
    **/
    event WithdrawalIntentCancelled(address indexed user, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted after the user deposits funds
     * @param user the address performing the deposit
     * @param value the amount deposited
     * @param timestamp of the deposit
     **/
    event Deposit(address indexed user, uint256 value, uint256 timestamp);

    event DepositorInitialized(
        address indexed user,
        address indexed depositor,
        uint256 value,
        uint256 timestamp
    );

    /**
     * @dev emitted after the user deposits funds on behalf of other user
     * @param user the address performing the deposit
     * @param _of the address on behalf of which the deposit is being performed
     * @param value the amount deposited
     * @param timestamp of the deposit
     **/
    event DepositOnBehalfOf(address indexed user, address indexed _of, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user withdraws funds
     * @param user the address performing the withdrawal
     * @param value the amount withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawal(address indexed user, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user borrows funds
     * @param user the address that borrows
     * @param value the amount borrowed
     * @param timestamp time of the borrowing
     **/
    event Borrowing(address indexed user, uint256 value, uint256 timestamp);

    event BorrowerInitialized(address indexed user, address indexed borrower, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user repays debt
     * @param user the address that repays debt
     * @param value the amount repaid
     * @param timestamp of the repayment
     **/
    event Repayment(address indexed user, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after accumulating deposit interest
     * @param user the address that the deposit interest is accumulated for
     * @param value the amount that interest is calculated from
     * @param timestamp of the interest accumulation
     **/
    event InterestCollected(address indexed user, uint256 value, uint256 timestamp);

    /**
    * @dev emitted after changing borrowers registry
    * @param registry an address of the newly set borrowers registry
    * @param timestamp of the borrowers registry change
    **/
    event BorrowersRegistryChanged(address indexed registry, uint256 timestamp);

    /**
    * @dev emitted after changing rates calculator
    * @param calculator an address of the newly set rates calculator
    * @param timestamp of the borrowers registry change
    **/
    event RatesCalculatorChanged(address indexed calculator, uint256 timestamp);

    /**
    * @dev emitted after changing pool rewarder
    * @param poolRewarder an address of the newly set pool rewarder
    * @param timestamp of the pool rewarder change
    **/
    event PoolRewarderChanged(address indexed poolRewarder, uint256 timestamp);


    /**
     * @dev emitted after the user locks deposit
     * @param user the address that locks the deposit
     * @param amount the amount locked
     * @param lockTime the time for which the deposit is locked
     * @param unlockTime the time when the deposit will be unlocked
     **/
    event DepositLocked(address indexed user, uint256 amount, uint256 lockTime, uint256 unlockTime);

    event BalanceCorrected(address indexed account, int256 diff, uint256 timestamp);


    /* ========== ERRORS ========== */

    // Only authorized accounts may borrow
    error NotAuthorizedToBorrow();

    // Borrowers registry is not configured
    error BorrowersRegistryNotConfigured();

    // Pool is frozen
    error PoolFrozen();

    // Not enough funds in the pool.
    error InsufficientPoolFunds();

    // Insufficient pool surplus to cover the requested recover amount
    error InsufficientSurplus();

    // Address (`target`) must be a contract
    // @param target target address that must be a contract
    error NotAContract(address target);

    //  ERC20: Spender cannot be a zero address
    error SpenderZeroAddress();

    //  ERC20: cannot transfer to the zero address
    error TransferToZeroAddress();

    //  ERC20: cannot transfer to the pool address
    error TransferToPoolAddress();

    //  ERC20: transfer amount (`amount`) exceeds balance (`balance`)
    /// @param amount transfer amount
    /// @param balance available balance
    error TransferAmountExceedsBalance(uint256 amount, uint256 balance);

    //  ERC20: requested transfer amount (`requested`) exceeds current allowance (`allowance`)
    /// @param requested requested transfer amount
    /// @param allowance current allowance
    error InsufficientAllowance(uint256 requested, uint256 allowance);

    //  This deposit operation would result in a breach of the totalSupplyCap
    error TotalSupplyCapBreached();

    // The deposit amount must be > 0
    error ZeroDepositAmount();

    // ERC20: cannot mint to the zero address
    error MintToAddressZero();

    // ERC20: burn amount exceeds current pool indexed balance
    error BurnAmountExceedsBalance();

    // ERC20: burn amount exceeds current amount available (including vesting)
    error BurnAmountExceedsAvailableForUser();

    // Trying to repay more than was borrowed
    error RepayingMoreThanWasBorrowed();

    // getMaxPoolUtilisationForBorrowing was breached
    error MaxPoolUtilisationBreached();

    // Insufficient available balance
    error InsufficientAvailableBalance(uint256 amount, uint256 availableBalance);
}