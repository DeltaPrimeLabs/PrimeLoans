// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5bae95ca244e96444fe80078195944f6637e72d8;
pragma solidity 0.8.17;

import "./Pool.sol";
import "./interfaces/IWrappedNativeToken.sol";

/**
 * @title Pool
 * @dev Contract allowing user to deposit to and borrow from a single pot
 * Depositors are rewarded with the interest rates collected from borrowers.
 * Rates are compounded every second and getters always return the current deposit and borrowing balance.
 * The interest rates calculation is delegated to the external calculator contract.
 */
contract WrappedNativeTokenPool is Pool {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
     * Wraps and deposits amount attached to the transaction
     **/
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

        if (address(poolRewarder) != address(0) && !isDepositorExcludedFromRewarder(msg.sender)) {
            poolRewarder.stakeFor(msg.value, msg.sender);
        }

        notifyVPrimeController(msg.sender);

        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    /**
     * Unwraps and withdraws selected amount from the user deposits
     * @dev _amount the amount to be withdrawn
     **/
    function withdrawNativeToken(uint256 _amount) external nonReentrant {
        if(_amount > IERC20(tokenAddress).balanceOf(address(this))) revert InsufficientPoolFunds();

        _accumulateDepositInterest(msg.sender);

        if(_amount > _deposited[address(this)]) revert BurnAmountExceedsBalance();
        // verified in "require" above
        unchecked {
            _deposited[address(this)] -= _amount;
        }
        _burn(msg.sender, _amount);

        _updateRates();

        IWrappedNativeToken(tokenAddress).withdraw(_amount);
        payable(msg.sender).safeTransferETH(_amount);

        if (address(poolRewarder) != address(0) && !isDepositorExcludedFromRewarder(msg.sender)) {
            poolRewarder.withdrawFor(_amount, msg.sender);
        }

        notifyVPrimeController(msg.sender);

        emit Withdrawal(msg.sender, _amount, block.timestamp);
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    //needed for withdrawNativeToken
    receive() external payable {}
}