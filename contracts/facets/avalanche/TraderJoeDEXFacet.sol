// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 71813826f564de63a2462d95b5c15944fcdf686e;
pragma solidity 0.8.17;

import "../UniswapV2DEXFacet.sol";

contract TraderJoeDEXFacet is UniswapV2DEXFacet {
    function getProtocolID() pure internal override returns (bytes32) {
        return "TJ";
    }

    /**
      * Swaps one asset to another
      * @dev This function uses the redstone-evm-connector
      * @param _soldAsset asset to be sold
      * @param _boughtAsset asset to be bought
      * @param _exactSold exact amount of asset to be sold
      * @param _minimumBought minimum amount of asset to be bought
    **/
    function swapTraderJoe(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) public noBorrowInTheSameBlock onlyOwner returns (uint256[] memory) {
        return swapAssets(_soldAsset, _boughtAsset, _exactSold, _minimumBought);
    }

    function addLiquidityTraderJoe(bytes32 _firstAsset, bytes32 _secondAsset, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin) public onlyOwner {
        addLiquidity(_firstAsset, _secondAsset, amountADesired, amountBDesired, amountAMin, amountBMin);
    }

    //onlOwnerOrInsolvent inside UniswapDexFacet
    function removeLiquidityTraderJoe(bytes32 _firstAsset, bytes32 _secondAsset, uint liquidity, uint amountAMin, uint amountBMin) public {
        removeLiquidity(_firstAsset, _secondAsset, liquidity, amountAMin, amountBMin);
    }

    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public override returns (address) {
        return 0x5302E909d1e93e30F05B5D6Eea766363D14F9892;
    }
}