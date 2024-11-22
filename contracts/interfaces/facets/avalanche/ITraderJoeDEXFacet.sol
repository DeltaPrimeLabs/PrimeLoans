pragma solidity ^0.8.17;

interface ITraderJoeDEXFacet {
    function swapTraderJoe(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) external returns (uint256[] memory);

    function addLiquidityTraderJoe(bytes32 _firstAsset, bytes32 _secondAsset, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin) external;

    function removeLiquidityTraderJoe(bytes32 _firstAsset, bytes32 _secondAsset, uint liquidity, uint amountAMin, uint amountBMin) external;
}
