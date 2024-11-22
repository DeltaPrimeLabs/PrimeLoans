// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./DepositSwap.sol";

contract DepositSwapAvalanche is DepositSwap {
    using SafeERC20 for IERC20;

    address private constant PARA_TRANSFER_PROXY =
        0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER =
        0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    address public constant WAVAX_POOL_TUP = 0xD26E504fc642B96751fD55D3E68AF295806542f5;
    address public constant USDC_POOL_TUP = 0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b;
    address public constant USDT_POOL_TUP = 0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1;
    address public constant ETH_POOL_TUP = 0xD7fEB276ba254cD9b34804A986CE9a8C3E359148;
    address public constant BTC_POOL_TUP = 0x475589b0Ed87591A893Df42EC6076d2499bB63d0;

    address public constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address public constant WETH = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address public constant USDC = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    address public constant USDT = 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7;
    address public constant BTC = 0x152b9d0FdC40C096757F570A51E494bd4b943E50;

    function _isTokenSupported(address token) internal override pure returns (bool) {
        if(
            token == WAVAX ||
            token == WETH ||
            token == USDC ||
            token == USDT ||
            token == BTC
        ){
            return true;
        }
        return false;
    }

    function _tokenToPoolTUPMapping(address token) internal override pure returns (Pool) {
        if(token == WAVAX){
            return Pool(WAVAX_POOL_TUP);
        } else if (token == WETH){
            return Pool(ETH_POOL_TUP);
        } else if (token == USDC){
            return Pool(USDC_POOL_TUP);
        } else if (token == USDT){
            return Pool(USDT_POOL_TUP);
        } else if (token == BTC){
            return Pool(BTC_POOL_TUP);
        }
        revert("Pool not supported");
    }

    function YY_ROUTER() internal override pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }
}
