// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 499a35c62f8a913d89f7faf78bf5c6b3cea2ee8b;
pragma solidity 0.8.17;

import "../UniswapV2DEXFacet.sol";

contract PangolinDEXFacet is UniswapV2DEXFacet {
    function getProtocolID() pure internal override returns (bytes32) {
        return "PNG";
    }

    /**
      * Swaps one asset to another
      * @dev This function uses the redstone-evm-connector
      * @param _soldAsset asset to be sold
      * @param _boughtAsset asset to be bought
      * @param _exactSold exact amount of asset to be sold
      * @param _minimumBought minimum amount of asset to be bought
    **/
    function swapPangolin(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) public noBorrowInTheSameBlock onlyOwner returns (uint256[] memory) {
        return swapAssets(_soldAsset, _boughtAsset, _exactSold, _minimumBought);
    }

    function addLiquidityPangolin(bytes32 _firstAsset, bytes32 _secondAsset, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin) public onlyOwner {
        addLiquidity(_firstAsset, _secondAsset, amountADesired, amountBDesired, amountAMin, amountBMin);
    }

    //onlOwnerOrInsolvent inside UniswapDexFacet
    function removeLiquidityPangolin(bytes32 _firstAsset, bytes32 _secondAsset, uint liquidity, uint amountAMin, uint amountBMin) public {
        removeLiquidity(_firstAsset, _secondAsset, liquidity, amountAMin, amountBMin);
    }

    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public override returns (address) {
        return 0xdB5D94B8Ed491B058F3e74D029775A14477cF7fA;
    }
}