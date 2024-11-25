// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 3742ed131202971f0b79e04769200986a3c7f8d0;
pragma solidity 0.8.17;

import "./DepositSwap.sol";

contract DepositSwapArbitrum is DepositSwap {
    using SafeERC20 for IERC20;

    address private constant PARA_TRANSFER_PROXY =
    0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER =
    0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    address public constant WETH_POOL_TUP = 0x0BeBEB5679115f143772CfD97359BBcc393d46b3;
    address public constant USDC_POOL_TUP = 0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0;
    address public constant ARB_POOL_TUP = 0x2B8C610F3fC6F883817637d15514293565C3d08A;
    address public constant BTC_POOL_TUP = 0x5CdE36c23f0909960BA4D6E8713257C6191f8C35;
    address public constant DAI_POOL_TUP = 0xd5E8f691756c3d7b86FD8A89A06497D38D362540;

    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address public constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    address public constant BTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    address public constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;

    function _isTokenSupported(address token) internal override pure returns (bool) {
        if(
            token == WETH ||
            token == USDC ||
            token == BTC ||
            token == DAI ||
            token == ARB
        ){
            return true;
        }
        return false;
    }

    function _tokenToPoolTUPMapping(address token) internal override pure returns (Pool) {
        if(token == WETH){
            return Pool(WETH_POOL_TUP);
        } else if (token == USDC){
            return Pool(USDC_POOL_TUP);
        } else if (token == ARB){
            return Pool(ARB_POOL_TUP);
        } else if (token == BTC){
            return Pool(BTC_POOL_TUP);
        } else if (token == DAI){
            return Pool(DAI_POOL_TUP);
        }
        revert("Pool not supported");
    }

    function YY_ROUTER() internal override pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }
}
