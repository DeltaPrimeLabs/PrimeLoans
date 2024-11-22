// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ec6e7a0ed7ef3d10f4007e7ebad336dc88392717;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../interfaces/facets/IYieldYakRouter.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/SolvencyMethods.sol";
import "../../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract YieldYakSwapFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    struct SwapTokensDetails {
        bytes32 tokenSoldSymbol;
        bytes32 tokenBoughtSymbol;
        IERC20Metadata soldToken;
        IERC20Metadata boughtToken;
        uint256 initialSoldTokenBalance;
        uint256 initialBoughtTokenBalance;
    }

    function getInitialTokensDetails(address _soldTokenAddress, address _boughtTokenAddress) internal returns (SwapTokensDetails memory){
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (_boughtTokenAddress == 0xaE64d55a6f09E4263421737397D1fdFA71896a69) {
            _boughtTokenAddress = 0x9e295B5B976a184B14aD8cd72413aD846C299660;
        }

        if (_soldTokenAddress == 0x9e295B5B976a184B14aD8cd72413aD846C299660) {
            _soldTokenAddress = 0xaE64d55a6f09E4263421737397D1fdFA71896a69;
        }

        bytes32 _tokenSoldSymbol = tokenManager.tokenAddressToSymbol(_soldTokenAddress);
        bytes32 _tokenBoughtSymbol = tokenManager.tokenAddressToSymbol(_boughtTokenAddress);

        require(tokenManager.isTokenAssetActive(_boughtTokenAddress), "Asset not supported.");

        IERC20Metadata _soldToken = IERC20Metadata(_soldTokenAddress);
        IERC20Metadata _boughtToken = IERC20Metadata(_boughtTokenAddress);

        return SwapTokensDetails({
            tokenSoldSymbol: _tokenSoldSymbol,
            tokenBoughtSymbol: _tokenBoughtSymbol,
            soldToken: _soldToken,
            boughtToken: _boughtToken,
            initialSoldTokenBalance: _soldToken.balanceOf(address(this)),
            initialBoughtTokenBalance: _boughtToken.balanceOf(address(this))
        });
    }

    function yakSwap(uint256 _amountIn, uint256 _amountOut, address[] calldata _path, address[] calldata _adapters) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent{
        SwapTokensDetails memory swapTokensDetails = getInitialTokensDetails(_path[0], _path[_path.length - 1]);

        _amountIn = Math.min(swapTokensDetails.soldToken.balanceOf(address(this)), _amountIn);
        require(_amountIn > 0, "Amount of tokens to sell has to be greater than 0");

        address(swapTokensDetails.soldToken).safeApprove(YY_ROUTER(), 0);
        address(swapTokensDetails.soldToken).safeApprove(YY_ROUTER(), _amountIn);

        IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());

        IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
            amountIn: _amountIn,
            amountOut: _amountOut,
            path: _path,
            adapters: _adapters
        });

        router.swapNoSplit(trade, address(this), 0);

        uint256 boughtTokenFinalAmount = swapTokensDetails.boughtToken.balanceOf(address(this)) - swapTokensDetails.initialBoughtTokenBalance;
        require(boughtTokenFinalAmount >= _amountOut, "Insufficient output amount");

        uint256 soldTokenFinalAmount = swapTokensDetails.initialSoldTokenBalance - swapTokensDetails.soldToken.balanceOf(address(this));

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(swapTokensDetails.boughtToken), boughtTokenFinalAmount);
        _decreaseExposure(tokenManager, address(swapTokensDetails.soldToken), soldTokenFinalAmount);

        emit Swap(
            msg.sender,
            swapTokensDetails.tokenSoldSymbol,
            swapTokensDetails.tokenBoughtSymbol,
            soldTokenFinalAmount,
            boughtTokenFinalAmount,
            block.timestamp
        );

    }

    function YY_ROUTER() internal virtual pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after a swap of assets
     * @param user the address of user making the purchase
     * @param soldAsset sold by the user
     * @param boughtAsset bought by the user
     * @param amountSold amount of tokens sold
     * @param amountBought amount of tokens bought
     * @param timestamp time of the swap
     **/
    event Swap(address indexed user, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 amountSold, uint256 amountBought, uint256 timestamp);
}
