// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "../UniswapV2DEXFacet.sol";

contract UbeswapDEXFacet is UniswapV2DEXFacet {

    /**
    * Swaps one asset to another
    * @dev This function uses the redstone-evm-connector
    * @param _soldAsset asset to be sold
    * @param _boughtAsset asset to be bought
    * @param _exactSold exact amount of asset to be sold
    * @param _minimumBought minimum amount of asset to be bought
    **/
    function swapUbeswap(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) public onlyOwner returns (uint256[] memory) {
        return swapAssets(_soldAsset, _boughtAsset, _exactSold, _minimumBought);
    }

    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public override returns (address) {
        return 0xd8edCc7162281abFFbd65d4a1b260ef1275e1EAc;
    }
}