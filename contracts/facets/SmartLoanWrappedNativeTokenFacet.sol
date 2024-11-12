// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e431e50ac1cb32ed6fa23d9302056e3e06924d8b;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../interfaces/IWrappedNativeToken.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../ReentrancyGuardKeccak.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract SmartLoanWrappedNativeTokenFacet is OnlyOwnerOrInsolvent, ReentrancyGuardKeccak {
    using TransferHelper for address payable;

    function wrapNativeToken(uint256 amount) onlyOwnerOrInsolvent nonReentrant public {
        require(amount <= address(this).balance, "Not enough native token to wrap");
        require(amount > 0, "Cannot wrap 0 tokens");
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        wrapped.deposit{value : amount}();

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(wrapped), amount);

        emit WrapNative(msg.sender, amount, block.timestamp);
    }

    function depositNativeToken() public payable virtual {
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        wrapped.deposit{value : msg.value}();

        if (wrapped.balanceOf(address(this)) != 0) {
            DiamondStorageLib.addOwnedAsset(DeploymentConstants.getNativeTokenSymbol(), address(wrapped));
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(wrapped), msg.value);

        emit DepositNative(msg.sender, msg.value, block.timestamp);
    }

    function unwrapAndWithdraw(uint256 _amount) onlyOwner remainsSolvent canRepayDebtFully public payable virtual {
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        _amount = Math.min(wrapped.balanceOf(address(this)), _amount);
        require(wrapped.balanceOf(address(this)) >= _amount, "Not enough native token to unwrap and withdraw");

        wrapped.withdraw(_amount);

        if (wrapped.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(DeploymentConstants.getNativeTokenSymbol());
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(wrapped), _amount);

        payable(msg.sender).safeTransferETH(_amount);

        emit UnwrapAndWithdraw(msg.sender, _amount, block.timestamp);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== EVENTS ========== */

    /**
    * @dev emitted when native tokens are wrapped in the SmartLoan
    * @param user the address initiating wrap
    * @param amount of wrapped funds
    * @param timestamp of wrap
    **/
    event WrapNative(address indexed user, uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are deposited to the SmartLoan
    * @param user the address initiating deposit of native token
    * @param amount of deposited funds
    * @param timestamp of deposit
    **/
    event DepositNative(address indexed user, uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are unwrapped and withdrawn from the SmartLoan
    * @param user the address initiating unwrap and withdraw of native token
    * @param amount of unwrapped and withdrawn funds
    * @param timestamp of unwrap and withdraw
    **/
    event UnwrapAndWithdraw(address indexed user, uint256 amount, uint256 timestamp);

}