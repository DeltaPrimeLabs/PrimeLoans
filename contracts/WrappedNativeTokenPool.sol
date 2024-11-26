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
        if(msg.value == 0) revert ZeroDepositAmount();

        _accumulateDepositInterest(msg.sender);

        if(totalSupplyCap != 0){
            if(_deposited[address(this)] + msg.value > totalSupplyCap) revert TotalSupplyCapBreached();
        }

        IWrappedNativeToken(tokenAddress).deposit{value : msg.value}();

        _mint(msg.sender, msg.value);
        _deposited[address(this)] += msg.value;
        _updateRates();

        if (address(poolRewarder) != address(0)) {
            poolRewarder.stakeFor(msg.value, msg.sender);
        }

        notifyVPrimeController(msg.sender);

        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Unwraps and withdraws the specified amount from the user's deposits, enforcing withdrawal intents.
     * @param _amount The amount to be withdrawn.
     * @param intentIndices array of intent indices to be used for withdrawal
     */
    function withdrawNativeToken(uint256 _amount, uint256[] calldata intentIndices) external nonReentrant {
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

        if (finalAmount > IERC20(tokenAddress).balanceOf(address(this)))
            revert InsufficientPoolFunds();
        if (finalAmount > _deposited[address(this)]) revert BurnAmountExceedsBalance();

        _deposited[address(this)] -= finalAmount;
        _burn(msg.sender, finalAmount);

        _updateRates();

        if (address(poolRewarder) != address(0)) {
            poolRewarder.withdrawFor(finalAmount, msg.sender);
        }

        notifyVPrimeController(msg.sender);

        // Unwrap and transfer native tokens last
        IWrappedNativeToken(tokenAddress).withdraw(finalAmount);
        payable(msg.sender).safeTransferETH(finalAmount);

        emit Withdrawal(msg.sender, finalAmount, block.timestamp);
    }

    /* ========== RECEIVE NATIVE TOKEN FUNCTION ========== */
    // Needed for withdrawNativeToken
    receive() external payable {}
}