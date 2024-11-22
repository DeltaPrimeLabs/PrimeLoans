pragma solidity ^0.8.17;

interface IUniswapV2DEXFacet {
    event Swap(address indexed user, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 maximumSold, uint256 minimumBought, uint256 timestamp);
    event AddLiquidity(address indexed user, address indexed lpToken, bytes32 firstAsset, bytes32 secondAsset, uint liquidity, uint firstAmount, uint secondAmount, uint256 timestamp);
    event RemoveLiquidity(address indexed user, address indexed lpToken, bytes32 firstAsset, bytes32 secondAsset, uint liquidity, uint firstAmount, uint secondAmount, uint256 timestamp);
}
