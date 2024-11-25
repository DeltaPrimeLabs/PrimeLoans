// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IAssetExchange
 * @dev Basic interface for investing into assets
 * It could be linked either to DEX or to a synthetic assets platform
 */
interface IAssetsExchange {

    /*
     * Swaps selected ERC20 token with other ERC20 token
     * @param soldToken_ sold ERC20 token's address
     * @param boughtToken_ bought ERC20 token's address
     * @param _amountSold exact amount of ERC20 token to be sold
     * @param _amountBought minimum amount of ERC20 token to be bought
     **/
    function swap(address soldToken_, address boughtToken_, uint256 _exactAmountIn, uint256 _minAmountOut) external returns (uint256[] memory);

    /*
     * Adds liquidity of ERC20 tokens
     */
    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin) external returns (address, uint, uint, uint);

    /*
     * Removes liquidity of ERC20 tokens
     */
    function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin) external returns (uint, uint);

    /**
     * Returns the minimum _soldToken amount that is required to be sold to receive _exactAmountOut of a _boughtToken.
     **/
    function getMinimumTokensNeeded(uint256 _exactAmountOut, address _soldToken, address _boughtToken) external returns (uint256);

    /**
     * Returns the maximum _boughtToken amount that will be obtained in the event of selling _amountIn of _soldToken token.
     **/
    function getMaximumTokensReceived(uint256 _amountIn, address _soldToken, address _boughtToken) external returns (uint256);

    /**
     * getPair
     **/
    function getPair(address _tokenA, address _tokenB) external returns (address);

}
