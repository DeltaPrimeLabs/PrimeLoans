// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e458289996cc5bb1378ce9654eedc316f5beefdf;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/facets/IYieldYakRouter.sol";
import "./Pool.sol";

abstract contract DepositSwap {
    using SafeERC20 for IERC20;

    address private constant PARA_TRANSFER_PROXY =
        0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER =
        0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    function _isTokenSupported(address token) internal virtual pure returns (bool);

    function _tokenToPoolTUPMapping(address token) internal virtual pure returns (Pool);

    function _withdrawFromPool(Pool pool, IERC20 token, uint256 amount, address user) internal {
        uint256 userInitialFromTokenDepositBalance = pool.balanceOf(user);
        uint256 poolInitialBalance = pool.balanceOf(address(this));

        require(userInitialFromTokenDepositBalance >= amount, "Insufficient fromToken deposit balance");

        pool.transferFrom(user, address(this), amount);
        require(pool.balanceOf(address(this)) - poolInitialBalance == amount, "amountFromToken and post-transfer contract balance mismatch");
        require(pool.balanceOf(user) == userInitialFromTokenDepositBalance - amount, "user post-transfer balance is incorrect");

        uint256 poolInitialTokenBalance = token.balanceOf(address(this));

        pool.withdraw(amount);

        require(pool.balanceOf(address(this)) == poolInitialBalance, "Post-withdrawal contract deposit balance must be 0");
        require(token.balanceOf(address(this)) == poolInitialTokenBalance + amount, "Post-withdrawal contract fromToken balance is incorrect");
    }

    function _depositToPool(Pool pool, IERC20 token, uint256 amount, address user) internal {
        uint256 contractInitialToTokenBalance = token.balanceOf(address(this));
        uint256 userInitialToTokenDepositBalance = pool.balanceOf(user);
        uint256 poolInitialBalance = pool.balanceOf(address(this));

        require(contractInitialToTokenBalance >= amount, "Insufficient contract toToken balance");

        token.safeApprove(address(pool), 0);
        token.safeApprove(address(pool), amount);
        pool.deposit(amount);

        require(token.balanceOf(address(this)) == contractInitialToTokenBalance - amount, "Post-deposit contract toToken balance must be 0");
        require(pool.balanceOf(address(this)) == poolInitialBalance + amount, "Post-deposit contract deposit balance is incorrect");

        pool.transfer(user, amount);

        require(token.balanceOf(address(this)) == contractInitialToTokenBalance - amount, "Post-transfer contract deposit balance must be 0");
        require(pool.balanceOf(user) == userInitialToTokenDepositBalance + amount, "Post-transfer user deposit balance is incorrect");
    }

    function _yakSwap(address[] calldata path, address[] calldata adapters, uint256 amountIn, uint256 amountOut) internal {
        IERC20(path[0]).safeApprove(YY_ROUTER(), 0);
        IERC20(path[0]).safeApprove(YY_ROUTER(), amountIn);

        IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());


        IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
            amountIn: amountIn,
            amountOut: amountOut,
            path: path,
            adapters: adapters
        });

        router.swapNoSplit(trade, address(this), 0);
    }


    // Needs approval on the fromToken Pool
    function depositSwap(uint256 amountFromToken, uint256 minAmountToToken, address[] calldata path, address[] calldata adapters) public {
        address fromToken = path[0];
        address toToken = path[path.length - 1];

        require(_isTokenSupported(fromToken), "fromToken not supported");
        require(_isTokenSupported(toToken), "toToken not supported");

        Pool fromPool = _tokenToPoolTUPMapping(fromToken);
        Pool toPool = _tokenToPoolTUPMapping(toToken);

        address user = msg.sender;
        amountFromToken = Math.min(fromPool.balanceOf(user), amountFromToken);

        _withdrawFromPool(fromPool, IERC20(fromToken), amountFromToken, user);

        _yakSwap(path, adapters, amountFromToken, minAmountToToken);

        _depositToPool(toPool, IERC20(toToken), IERC20(toToken).balanceOf(address(this)), user);
    }

    // Needs approval on the fromToken Pool
    function depositSwapParaSwap(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 minOut
    ) public {
        require(_isTokenSupported(fromToken), "fromToken not supported");
        require(_isTokenSupported(toToken), "toToken not supported");

        require(minOut > 0, "minOut needs to be > 0");
        require(fromAmount > 0, "Amount of tokens to sell needs to be > 0");

        Pool fromPool = _tokenToPoolTUPMapping(fromToken);
        Pool toPool = _tokenToPoolTUPMapping(toToken);

        address user = msg.sender;
        fromAmount = Math.min(fromPool.balanceOf(user), fromAmount);

        _withdrawFromPool(fromPool, IERC20(fromToken), fromAmount, user);

        IERC20(fromToken).safeApprove(PARA_TRANSFER_PROXY, 0);
        IERC20(fromToken).safeApprove(
            PARA_TRANSFER_PROXY,
            fromAmount
        );

        (bool success, ) = PARA_ROUTER.call((abi.encodePacked(selector, data)));
        require(success, "Swap failed");

        uint256 amountOut = IERC20(toToken).balanceOf(address(this));
        require(amountOut >= minOut, "Too little received");

        _depositToPool(toPool, IERC20(toToken), amountOut, user);
    }

    function YY_ROUTER() internal virtual pure returns (address);
}
