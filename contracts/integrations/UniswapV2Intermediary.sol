// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity 0.8.17;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IAssetsExchange.sol";
import "../TokenList.sol";
import "../interfaces/ITokenManager.sol";

/**
 * @title UniswapV2Intermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation supports UniswapV2-like DEXs
 */
contract UniswapV2Intermediary is TokenListOwnableUpgreadable, IAssetsExchange, ReentrancyGuardKeccak {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /* ========= STATE VARIABLES ========= */
    IUniswapV2Router01 router;
    IUniswapV2Factory factory;
    ITokenManager tokenManager;

    function initialize(address _router, address _tokenManager, address[] memory _whitelistedTokens) external initializer {
        tokenManager = ITokenManager(_tokenManager);
        router = IUniswapV2Router01(_router);
        factory = IUniswapV2Factory(router.factory());

        __TokenList_init(_whitelistedTokens);
    }

    /*
     * Swaps selected ERC20 token with other ERC20 token
     * @param soldToken_ sold ERC20 token's address
     * @param boughtToken_ bought ERC20 token's address
     * @param _exactSold exact amount of ERC20 token to be sold
     * @param _minimumBought minimum amount of ERC20 token to be bought
     **/
    function swap(address _soldToken, address _boughtToken, uint256 _exactSold, uint256 _minimumBought) external override nonReentrant returns (uint256[] memory amounts) {
        require(_exactSold > 0, "Amount of tokens to sell has to be greater than 0");

        _soldToken.safeApprove(address(router), 0);
        _soldToken.safeApprove(address(router), _exactSold);

        require(isTokenWhitelisted[_boughtToken], 'Trying to buy unsupported token');

        if (_minimumBought > 0) {
            require(_exactSold >= getMinimumTokensNeeded(_minimumBought, _soldToken, _boughtToken), "Not enough funds were provided");
        }

        amounts = router.swapExactTokensForTokens(_exactSold, _minimumBought, getPath(_soldToken, _boughtToken), msg.sender, block.timestamp);

        uint256 residualBalance = IERC20Metadata(_soldToken).balanceOf(address(this));

        if (residualBalance > 0) {
            _soldToken.safeTransfer(msg.sender, residualBalance);
        }

        return amounts;
    }


    /*
     * addLiquidity selected ERC20 tokens
     **/
    function addLiquidity(address tokenA, address tokenB, uint amountA, uint amountB, uint amountAMin, uint amountBMin) external override nonReentrant returns (address, uint, uint, uint) {
        require(amountA > 0, "amountADesired has to be greater than 0");
        require(amountB > 0, "amountBDesired to sell has to be greater than 0");
        require(amountAMin > 0, "amountAMin has to be greater than 0");
        require(amountBMin > 0, "amountBMin has to be greater than 0");

        tokenA.safeApprove(address(router), amountA);
        tokenB.safeApprove(address(router), amountB);

        address lpTokenAddress = getPair(tokenA, tokenB);

        require(isTokenWhitelisted[tokenA], 'Trying to LP unsupported token');
        require(isTokenWhitelisted[tokenB], 'Trying to LP unsupported token');
        require(tokenManager.isTokenAssetActive(lpTokenAddress), 'Trying to add unsupported LP token');

        uint liquidity;
        (amountA, amountB, liquidity) =
           router.addLiquidity(tokenA, tokenB, amountA, amountB, amountAMin, amountBMin, address(this), block.timestamp);

        lpTokenAddress.safeTransfer(msg.sender, IERC20Metadata(lpTokenAddress).balanceOf(address(this)));
        if (IERC20Metadata(tokenA).balanceOf(address(this)) > 0) {
            tokenA.safeTransfer(msg.sender, IERC20Metadata(tokenA).balanceOf(address(this)));
        }
        if ( IERC20Metadata(tokenB).balanceOf(address(this)) > 0) {
            tokenB.safeTransfer(msg.sender, IERC20Metadata(tokenB).balanceOf(address(this)));
        }
        tokenA.safeApprove(address(router), 0);
        tokenB.safeApprove(address(router), 0);

        return (lpTokenAddress, amountA, amountB, liquidity);
    }


    /*
     *  removeLiquidity selected ERC20 tokens
     **/
    function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountA, uint amountB) external override nonReentrant returns (uint, uint) {
        require(amountA > 0, "amountA has to be greater than 0");
        require(amountB > 0, "amountB has to be greater than 0");

        address lpTokenAddress = getPair(tokenA, tokenB);

        lpTokenAddress.safeApprove(address(router), liquidity);

        require(isTokenWhitelisted[tokenA], 'Trying to remove LP of unsupported token');
        require(isTokenWhitelisted[tokenB], 'Trying to remove LP of unsupported token');
        //TODO: handle paused LP tokens
        require(tokenManager.isTokenAssetActive(lpTokenAddress), 'Trying to remove unsupported LP token');

        (amountA, amountB) =
         router.removeLiquidity(tokenA, tokenB, liquidity, amountA, amountB, address(this), block.timestamp);

        lpTokenAddress.safeTransfer(msg.sender, IERC20Metadata(lpTokenAddress).balanceOf(address(this)));
        tokenA.safeTransfer(msg.sender, IERC20Metadata(tokenA).balanceOf(address(this)));
        tokenB.safeTransfer(msg.sender, IERC20Metadata(tokenB).balanceOf(address(this)));

        return (amountA, amountB);
    }


    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}


    /* ========== VIEW FUNCTIONS ========== */

    /**
     * Returns the minimum _soldToken amount that is required to be sold to receive _exactAmountOut of a _boughtToken.
     * Can revert due to insufficient liquidity
     **/
    function getMinimumTokensNeeded(uint256 _exactAmountOut, address _soldToken, address _boughtToken) public view override returns (uint256) {
        address[] memory path = getPath(_soldToken, _boughtToken);

        (bool success, bytes memory result) = address(router).staticcall(
            abi.encodeWithSignature("getAmountsIn(uint256,address[])", _exactAmountOut, path)
        );

        require(success, "Error when calculating amounts needed");

        uint256[] memory amounts = abi.decode(result, (uint256[]));

        return amounts[0];
    }

    /**
     * Returns the maximum _boughtToken amount that will be obtained in the event of selling _amountIn of _soldToken token.
     **/
    function getMaximumTokensReceived(uint256 _amountIn, address _soldToken, address _boughtToken) public view override returns (uint256) {
        address[] memory path = getPath(_soldToken, _boughtToken);

        return router.getAmountsOut(_amountIn, path)[1];
    }

    /**
     * Returns a path containing tokens' addresses
     * @param _token1 ERC20 token's address
     * @param _token2 ERC20 token's address
     **/
    function getPath(address _token1, address _token2) internal virtual view returns (address[] memory) {
        address[] memory path;

        if (_token1 != getNativeTokenAddress() && _token2 != getNativeTokenAddress()) {
            path = new address[](3);
            path[0] = _token1;
            path[1] = getNativeTokenAddress();
            path[2] = _token2;
        } else {
            path = new address[](2);
            path[0] = _token1;
            path[1] = _token2;
        }

        return path;
    }

    /**
     * Returns an address of LP token
     * @param _token1 ERC20 token's address
     * @param _token2 ERC20 token's address
     **/
    function getPair(address _token1, address _token2) public virtual view returns (address) {
        return factory.getPair(_token1, _token2);
    }

    function getNativeTokenAddress() virtual internal view returns (address) {
        //address of WETH9 on Ethereum network. Must be overriden in implementations on other chains
        return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    }
}