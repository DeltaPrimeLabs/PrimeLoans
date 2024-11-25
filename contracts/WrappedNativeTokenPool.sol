// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5bae95ca244e96444fe80078195944f6637e72d8;
pragma solidity 0.8.17;

import "./Pool.sol";
import "./interfaces/IWrappedNativeToken.sol";

/**
 * @title WrappedNativeTokenPool
 * @dev Contract allowing users to deposit and withdraw native tokens with wrapping functionality.
 * Depositors are rewarded with the interest rates collected from borrowers.
 * The interest rates calculation is delegated to an external calculator contract.
 */
contract WrappedNativeTokenPool is Pool {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
     * @notice Wraps and deposits the amount of native token attached to the transaction.
     */
    function depositNativeToken() public payable virtual {
        if (msg.value == 0) revert ZeroDepositAmount();

        _accumulateDepositInterest(msg.sender);

        if(totalSupplyCap != 0){
            if(_deposited[address(this)] + msg.value > totalSupplyCap) revert TotalSupplyCapBreached();
        }

        IWrappedNativeToken(tokenAddress).deposit{value : msg.value}();

        _mint(msg.sender, msg.value);
        _deposited[address(this)] += msg.value;
        _updateRates();

        if (address(poolRewarder) != address(0) && !isDepositorExcludedFromRewarder(msg.sender)) {
            poolRewarder.stakeFor(msg.value, msg.sender);
        }

        notifyVPrimeController(msg.sender);

        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Unwraps and withdraws the specified amount from the user's deposits, enforcing withdrawal intents.
     * @param _amount The amount to be withdrawn.
     * @param intentIndex The index of the withdrawal intent to use.
     */
    function withdrawNativeToken(uint256 _amount, uint256 intentIndex) external nonReentrant {
        WithdrawalIntent[] storage intents = withdrawalIntents[msg.sender];
        require(intentIndex < intents.length, "Invalid intent index");

        WithdrawalIntent storage intent = intents[intentIndex];
        require(intent.amount == _amount, "Withdrawal amount must match intent amount");
        require(block.timestamp >= intent.actionableAt, "Withdrawal intent not matured");
        require(block.timestamp <= intent.expiresAt, "Withdrawal intent expired");

        require(isWithdrawalAmountAvailable(msg.sender, _amount, _amount), "Balance is locked");

        // Remove intent first
        uint256 lastIndex = intents.length - 1;
        if (intentIndex != lastIndex) {
            intents[intentIndex] = intents[lastIndex];
        }
        intents.pop();

        _accumulateDepositInterest(msg.sender);

        _amount = Math.min(_amount, _deposited[msg.sender]);

        if (_amount > IERC20(tokenAddress).balanceOf(address(this)))
            revert InsufficientPoolFunds();

        if (_amount > _deposited[address(this)]) revert BurnAmountExceedsBalance();

        unchecked {
            _deposited[address(this)] -= _amount;
        }
        _burn(msg.sender, _amount);

        _updateRates();

        // Unwrap and transfer native tokens last
        IWrappedNativeToken(tokenAddress).withdraw(_amount);
        payable(msg.sender).safeTransferETH(_amount);

        if (address(poolRewarder) != address(0) && !isDepositorExcludedFromRewarder(msg.sender)) {
            poolRewarder.withdrawFor(_amount, msg.sender);
        }

        emit Withdrawal(msg.sender, _amount, block.timestamp);

        notifyVPrimeController(msg.sender);
    }

    /* ========== RECEIVE NATIVE TOKEN FUNCTION ========== */
    // Needed for withdrawNativeToken
    receive() external payable {}
}
