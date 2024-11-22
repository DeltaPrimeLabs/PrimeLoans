// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/IAssetsExchange.sol";

contract PangolinHelper {
    using SafeERC20 for IERC20;

    // PUBLIC FUNCTIONS

    function removeLiquidityPangolin(
        address token0,
        address token1,
        uint256 amount,
        uint256 minAmount0,
        uint256 minAmount1
    ) external {
        IERC20Metadata tokenA = IERC20Metadata(token0);
        IERC20Metadata tokenB = IERC20Metadata(token1);

        IAssetsExchange exchange = IAssetsExchange(
            getExchangeIntermediaryContract()
        );

        IERC20 lpTokenAddress = IERC20(exchange.getPair(token0, token1));
        amount = Math.min(amount, lpTokenAddress.balanceOf(address(this)));

        lpTokenAddress.safeTransfer(address(exchange), amount);

        exchange.removeLiquidity(
            address(tokenA),
            address(tokenB),
            amount,
            minAmount0,
            minAmount1
        );
    }

    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public pure returns (address) {
        return 0xdB5D94B8Ed491B058F3e74D029775A14477cF7fA;
    }
}
