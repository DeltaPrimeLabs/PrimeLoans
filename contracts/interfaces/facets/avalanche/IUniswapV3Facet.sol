pragma solidity ^0.8.17;

import "../../joe-v2/ILBRouter.sol";
import "../../uniswap-v3/IUniswapV3Pool.sol";
import "../../uniswap-v3-periphery/INonfungiblePositionManager.sol";

interface IUniswapV3Facet {

    struct UniswapV3Position {
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }


    function mintLiquidityUniswapV3(INonfungiblePositionManager.MintParams calldata params) external;

    function increaseLiquidityUniswapV3(INonfungiblePositionManager.IncreaseLiquidityParams calldata params) external;

    function decreaseLiquidityUniswapV3(INonfungiblePositionManager.DecreaseLiquidityParams calldata params) external;

    function burnLiquidityUniswapV3(uint256 tokenId) external;

    function getOwnedUniswapV3TokenIds() external view returns (uint256[] memory result);

    }
