// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 70b36afc5a8b248fa8852d29a59352bc4fdd0209;
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

    function isWhitelistedAdapterOptimized(address adapter) public virtual pure returns (bool) {
        if (adapter == 0xDB66686Ac8bEA67400CF9E5DD6c8849575B90148) return true;  // UnilikeAdapter
        if (adapter == 0x3614657EDc3cb90BA420E5f4F61679777e4974E3) return true;  // UnilikeAdapter
        if (adapter == 0x3f314530a4964acCA1f20dad2D35275C23Ed7F5d) return true;  // UnilikeAdapter
        if (adapter == 0xA05A3ebE5D0Ab59E449Fe34014f51948cb9F31dF) return true;  // VelodromeAdapter
        if (adapter == 0xaFb5aE9934266a131F44F2A80c783d6a827A3d1a) return true;  // CurveLikeAdapter
        if (adapter == 0x491dc06178CAF5b962DB53576a8A1456a8476232) return true;  // Curve1Adapter
        if (adapter == 0xd0f6e66113A6D6Cca238371948F4Ce2893D62881) return true;  // CurvePlainAdapter
        if (adapter == 0x5083fC22c18771609fA661fc6304a611613A6068) return true;  // CurvePlainAdapter
        if (adapter == 0x77fc17D927eBcEaEA2c4704BaB1AEebB0547ea42) return true;  // Curve2Adapter
        if (adapter == 0x22c62c9E409B97F1f9caA5Ca5433074914d73c3e) return true;  // CurvePlainAdapter
        if (adapter == 0x3EeA1f1fFCA00c69bA5a99E362D9A7d4e3902B3c) return true;  // CurvePlainAdapter
        if (adapter == 0x29deCcD2f4Fdb046D24585d01B1DcDFb902ACAcD) return true;  // UniswapV3Adapter
        if (adapter == 0x6A68F261F8976559259d74A3494C19Ee2bDE0e4F) return true;  // LB2Adapter
        if (adapter == 0xd8F5aBA3Ee8E3B27633E06b43f459f5bCE516Ab6) return true;  // LB22Adapter
        if (adapter == 0x3B9645B2432374d9B3Fa766b95D5A793D7241190) return true;  // WoofiV2Adapter
        if (adapter == 0x7F8B47Ff174Eaf96960a050B220a907dFa3feD5b) return true;  // GmxAdapter
        if (adapter == 0x2F6ca0a98CF8f7D407E98993fD576f70F0FAA80B) return true;  // SAvaxAdapter
        if (adapter == 0x5C4d23fd18Fc4128f77426F42237acFcE618D0b1) return true;  // WAvaxAdapter
        if (adapter == 0x7De32C76309aeB1025CBA3384caBe36326603046) return true;  // ?
        if (adapter == 0x97d26D7fc0895e3456b2146585848b466cfbb1cf) return true;  // RamsesV2Adapter
        if (adapter == 0x79632b8194a1Ce048e5d9b0e282E9eE2d4579c20) return true;  // GGAvaxAdapter
        if (adapter == 0x214617987145Ef7c5462870362FdCAe9cacdf3C8) return true;  // TokenMillAdapter
        return false;
    }

    function yakSwap(
        uint256 _amountIn,
        uint256 _amountOut,
        address[] calldata _path,
        address[] calldata _adapters
    ) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());

        // Check if all adapters are whitelisted in router
        for (uint256 i = 0; i < _adapters.length; i++) {
            require(isWhitelistedAdapterOptimized(_adapters[i]), "YakSwap: Adapter not whitelisted in router");
        }

        SwapTokensDetails memory swapTokensDetails = getInitialTokensDetails(_path[0], _path[_path.length - 1]);

        _amountIn = Math.min(swapTokensDetails.soldToken.balanceOf(address(this)), _amountIn);
        require(_amountIn > 0, "Amount of tokens to sell has to be greater than 0");
        require(_getAvailableBalance(swapTokensDetails.tokenSoldSymbol) >= _amountIn, "Insufficient balance");

        address(swapTokensDetails.soldToken).safeApprove(YY_ROUTER(), 0);
        address(swapTokensDetails.soldToken).safeApprove(YY_ROUTER(), _amountIn);

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
        _syncExposure(tokenManager, address(swapTokensDetails.boughtToken));
        _syncExposure(tokenManager, address(swapTokensDetails.soldToken));

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
