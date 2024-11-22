pragma solidity ^0.8.17;

interface IUbeswapDEXFacet {
    function swapUbeswap(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) external returns (uint256[] memory);
}
