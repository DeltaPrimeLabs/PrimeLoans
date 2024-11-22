// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 6d86e26ff5a23ee2fa4ddb079d0569c41d45f7dd;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";

import "../../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/IWrappedNativeToken.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract CaiFacet is
    ReentrancyGuardKeccak,
    OnlyOwnerOrInsolvent,
    AvalancheDataServiceConsumerBase
{
    using TransferHelper for address;

    address private constant INDEX_ROUTER =
        0xD6dd95610fC3A3579a2C32fe06158d8bfB8F4eE9;

    address private constant CAI = 0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0;

    function mintCai(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        uint256 maxSlippage
    ) external nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(
            fromAmount > 0,
            "Amount of tokens to sell has to be greater than 0"
        );

        bytes32 fromTokenSymbol = tokenManager.tokenAddressToSymbol(fromToken);

        address(fromToken).safeApprove(INDEX_ROUTER, 0);
        address(fromToken).safeApprove(INDEX_ROUTER, fromAmount);

        uint256 beforeCaiBalance = IERC20(CAI).balanceOf(address(this));
        uint256 beforeFromTokenBalance = IERC20(fromToken).balanceOf(address(this));

        (bool success, ) = INDEX_ROUTER.call((abi.encodePacked(selector, data)));
        require(success, "Mint failed");

        uint256 afterCaiBalance = IERC20(CAI).balanceOf(address(this));
        uint256 afterFromTokenBalance = IERC20(fromToken).balanceOf(address(this));

        uint256 fromTokenUsed = beforeFromTokenBalance - afterFromTokenBalance;
        uint256 caiBoughtAmount = afterCaiBalance - beforeCaiBalance;

        CAI.safeApprove(INDEX_ROUTER, 0);
        CAI.safeApprove(INDEX_ROUTER, type(uint256).max);

        checkSlippage(fromTokenSymbol, fromTokenUsed, "CAI", caiBoughtAmount, maxSlippage);

        _increaseExposure(tokenManager, CAI, caiBoughtAmount);
        _decreaseExposure(tokenManager, fromToken, fromTokenUsed);

        emit CaiMinted(
            msg.sender,
            fromTokenSymbol,
            fromAmount,
            caiBoughtAmount,
            block.timestamp
        );
    }

    function burnCai(
        bytes4 selector,
        bytes memory data,
        uint256 shares,
        address toToken,
        uint256 maxSlippage
    ) external nonReentrant onlyOwnerOrInsolvent remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(shares > 0, "Amount of tokens to sell has to be greater than 0");

        bytes32 toTokenSymbol = tokenManager.tokenAddressToSymbol(toToken);

        uint256 caiBurnt;
        uint256 boughtAmount;

        {
            uint256 beforeCaiBalance = IERC20(CAI).balanceOf(address(this));
            uint256 beforeTokenBalance = IERC20(toToken).balanceOf(address(this));

            (bool success, ) = INDEX_ROUTER.call((abi.encodePacked(selector, data)));
            require(success, "Burn failed");

            uint256 afterCaiBalance = IERC20(CAI).balanceOf(address(this));
            uint256 afterTokenBalance = IERC20(toToken).balanceOf(address(this));

            caiBurnt = beforeCaiBalance - afterCaiBalance;
            boughtAmount = afterTokenBalance - beforeTokenBalance;
        }

        checkSlippage("CAI", caiBurnt, toTokenSymbol, boughtAmount, maxSlippage);

        _decreaseExposure(tokenManager, CAI, caiBurnt);
        _increaseExposure(tokenManager, toToken, boughtAmount);

        emit CaiBurned(
            msg.sender,
            shares,
            toTokenSymbol,
            boughtAmount,
            block.timestamp
        );
    }

    function checkSlippage(
        bytes32 inputAsset,
        uint256 inputAmount,
        bytes32 outputAsset,
        uint256 outputAmount,
        uint256 maxSlippage
    ) internal view {        
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes32[] memory assets = new bytes32[](2);
        assets[0] = inputAsset;
        assets[1] = outputAsset;

        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assets);

        IERC20Metadata inputToken = IERC20Metadata(tokenManager.getAssetAddress(inputAsset, true));
        IERC20Metadata outputToken = IERC20Metadata(tokenManager.getAssetAddress(outputAsset, true));

        uint256 inputValue = prices[0] * inputAmount * 10 ** 10 / 10 ** inputToken.decimals();
        uint256 outputValue = prices[1] * outputAmount * 10 ** 10 / 10 ** outputToken.decimals();
        uint256 diff = inputValue > outputValue
            ? (inputValue - outputValue)
            : (outputValue - inputValue);
        uint256 slippage = (diff * 10000) / inputValue;

        require(slippage <= maxSlippage, "Slippage too high");
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
     * @dev emitted after a CAI mint
     * @param user the address of user minting the CAI
     * @param soldAsset sold by the user
     * @param amountSold amount of tokens sold
     * @param amountMinted amount of CAI minted
     * @param timestamp time of the mint
     **/
    event CaiMinted(
        address indexed user,
        bytes32 indexed soldAsset,
        uint256 amountSold,
        uint256 amountMinted,
        uint256 timestamp
    );

    /**
     * @dev emitted after a CAI mint
     * @param user the address of user minting the CAI
     * @param shares amount of CAI burned
     * @param buyAsset redeemed by the user
     * @param amountRedeemed amount of CAI minted
     * @param timestamp time of the mint
     **/
    event CaiBurned(
        address indexed user,
        uint256 indexed shares,
        bytes32 indexed buyAsset,
        uint256 amountRedeemed,
        uint256 timestamp
    );
}
