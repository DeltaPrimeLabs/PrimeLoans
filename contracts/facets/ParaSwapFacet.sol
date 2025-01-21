// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../ReentrancyGuardKeccak.sol";
import "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "./SmartLoanLiquidationFacet.sol";
import "../interfaces/ITokenManager.sol";
import "../lib/local/DeploymentConstants.sol";

contract ParaSwapFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    // Constants
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant LIQUIDATION_MAX_SLIPPAGE_BPS = 200; // 2%
    uint256 private constant NORMAL_MAX_SLIPPAGE_BPS = 500; // 5%
    uint256 private constant PRICE_DECIMALS = 10;
    uint256 private constant MAX_AMOUNT = type(uint128).max;

    ///@dev paraSwap v6.2 router
    address private constant PARA_ROUTER = 0x6A000F20005980200259B80c5102003040001068;

    ///@notice selectors for paraSwapV6 data decoding
    bytes4 private constant SWAP_EXACT_AMOUNT_IN_SELECTOR = 0xe3ead59e;
    bytes4 private constant SWAP_EXACT_AMOUNT_IN_ON_UNI_V3_SELECTOR = 0x876a02f6;

    /// @notice executor addresses returned by ParaSwap API
    address private constant EXECUTOR_1 = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;
    address private constant EXECUTOR_2 = 0x6A000F20005980200259B80c5102003040001068;
    address private constant EXECUTOR_3 = 0x000010036C0190E009a000d0fc3541100A07380A;
    address private constant EXECUTOR_4 = 0x00C600b30fb0400701010F4b080409018B9006E0;
    address private constant EXECUTOR_5 = 0xe009F00e200A090090fC70e02d70B232000c0802;

    // Events
    event SwapExecuted(
        address indexed user,
        bytes32 indexed soldAsset,
        bytes32 indexed boughtAsset,
        uint256 amountSold,
        uint256 amountBought,
        uint256 timestamp
    );
    event SlippageExceeded(
        address indexed user,
        uint256 soldTokenValue,
        uint256 boughtTokenValue,
        uint256 slippage
    );

    // Custom errors for gas optimization
    error InvalidExecutor();
    error InvalidPartnerAddress();
    error InvalidBeneficiary();
    error InvalidTokenAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientAllowance();
    error SwapFailed();
    error TooLittleReceived();
    error SlippageTooHigh(uint256 actual, uint256 max);
    error InvalidDecimals();
    error TooMuchSold();

    struct SwapTokensDetails {
        bytes32 tokenSoldSymbol;
        bytes32 tokenBoughtSymbol;
        IERC20Metadata soldToken;
        IERC20Metadata boughtToken;
        uint256 initialSoldTokenBalance;
        uint256 initialBoughtTokenBalance;
        uint8 soldTokenDecimals;
        uint8 boughtTokenDecimals;
    }

    struct ParaSwapDecodedData {
        address executor;
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        address partner;
        address payable beneficiary;
    }

    struct GenericData {
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
    }

    struct SwapExactAmountIn {
        address executor;
        GenericData swapData;
        uint256 partnerAndFee;
        bytes permit;
        bytes executorData;
    }

    struct UniswapV3Data {
        address srcToken;
        address destToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
        bytes pools;
    }

    struct UniswapV3FullData {
        UniswapV3Data uniData;
        uint256 partnerAndFee;
        bytes permit;
    }

    function getInitialTokensDetails(address _soldTokenAddress, address _boughtTokenAddress)
    internal
    view
    returns (SwapTokensDetails memory)
    {
        if (_soldTokenAddress == address(0) || _boughtTokenAddress == address(0)) {
            revert InvalidTokenAddress();
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(address(tokenManager) != address(0), "Invalid token manager");

        bytes32 _tokenSoldSymbol = tokenManager.tokenAddressToSymbol(_soldTokenAddress);
        bytes32 _tokenBoughtSymbol = tokenManager.tokenAddressToSymbol(_boughtTokenAddress);

        require(tokenManager.isTokenAssetActive(_boughtTokenAddress), "Asset not supported");

        IERC20Metadata _soldToken = IERC20Metadata(_soldTokenAddress);
        IERC20Metadata _boughtToken = IERC20Metadata(_boughtTokenAddress);

        // Validate token decimals
        uint8 soldDecimals = _soldToken.decimals();
        uint8 boughtDecimals = _boughtToken.decimals();
        if (soldDecimals > 18 || boughtDecimals > 18) {
            revert InvalidDecimals();
        }

        return SwapTokensDetails({
            tokenSoldSymbol: _tokenSoldSymbol,
            tokenBoughtSymbol: _tokenBoughtSymbol,
            soldToken: _soldToken,
            boughtToken: _boughtToken,
            initialSoldTokenBalance: _soldToken.balanceOf(address(this)),
            initialBoughtTokenBalance: _boughtToken.balanceOf(address(this)),
            soldTokenDecimals: soldDecimals,
            boughtTokenDecimals: boughtDecimals
        });
    }

    function validateSwapParameters(ParaSwapDecodedData memory data, bool isLiquidation) internal {
        // Validate executor
        if (data.executor != address(0) && !_checkExecutorAddress(data.executor)) {
            revert InvalidExecutor();
        }

        // Validate partner address
        if (data.partner != DeploymentConstants.getFeesRedistributionAddress()) {
            revert InvalidPartnerAddress();
        }

        // Validate beneficiary
        if (data.beneficiary != address(this) && data.beneficiary != address(0)) {
            revert InvalidBeneficiary();
        }

        // Validate token addresses
        if (data.srcToken == address(0) || data.destToken == address(0) || data.srcToken == data.destToken) {
            revert InvalidTokenAddress();
        }

        // Validate amounts
        if (data.fromAmount == 0 || data.toAmount == 0 || data.fromAmount > MAX_AMOUNT) {
            revert InvalidAmount();
        }

        // Additional checks for liquidation
        if (isLiquidation) {
            require(!_isSolvent(), "Cannot liquidate solvent account");
        }
    }

    function executeSwap(
        bytes4 selector,
        bytes calldata data,
        SwapTokensDetails memory details,
        ParaSwapDecodedData memory swapData,
        bool isLiquidation
    ) internal {
        // Check balance and allowance
        if (details.soldToken.balanceOf(address(this)) < swapData.fromAmount) {
            revert InsufficientBalance();
        }

        // Update state before external calls
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(details.soldToken), swapData.fromAmount);

        // Approve tokens
        address(details.soldToken).safeApprove(PARA_ROUTER, 0);
        address(details.soldToken).safeApprove(PARA_ROUTER, swapData.fromAmount);

        if (details.soldToken.allowance(address(this), PARA_ROUTER) < swapData.fromAmount) {
            revert InsufficientAllowance();
        }

        // Execute swap
        (bool success,) = PARA_ROUTER.call(abi.encodePacked(selector, data));
        if (!success) revert SwapFailed();

        // Verify results
        uint256 boughtAmount = details.boughtToken.balanceOf(address(this)) - details.initialBoughtTokenBalance;

        if (boughtAmount < swapData.toAmount) revert TooLittleReceived();

        uint256 soldAmount = details.initialSoldTokenBalance - details.soldToken.balanceOf(address(this));

        // Verify exact amount sold for liquidations
        if (isLiquidation && soldAmount != swapData.fromAmount) {
            revert TooMuchSold();
        }

        // Check slippage
        checkSlippage(details, soldAmount, boughtAmount, isLiquidation);

        // Update bought token exposure
        _increaseExposure(tokenManager, address(details.boughtToken), boughtAmount);

        emit SwapExecuted(
            msg.sender,
            details.tokenSoldSymbol,
            details.tokenBoughtSymbol,
            soldAmount,
            boughtAmount,
            block.timestamp
        );
    }

    function checkSlippage(
        SwapTokensDetails memory details,
        uint256 soldAmount,
        uint256 boughtAmount,
        bool isLiquidation
    ) internal {
        bytes32[] memory symbols = new bytes32[](2);
        symbols[0] = details.tokenSoldSymbol;
        symbols[1] = details.tokenBoughtSymbol;
        uint256[] memory prices = getPrices(symbols);
        require(prices.length == 2, "Invalid price data");

        uint256 soldTokenDollarValue = prices[0] * soldAmount * (10**PRICE_DECIMALS) / (10**details.soldTokenDecimals);
        uint256 boughtTokenDollarValue = prices[1] * boughtAmount * (10**PRICE_DECIMALS) / (10**details.boughtTokenDecimals);

        if (soldTokenDollarValue > boughtTokenDollarValue) {
            uint256 slippage = ((soldTokenDollarValue - boughtTokenDollarValue) * MAX_BPS) / soldTokenDollarValue;
            uint256 maxSlippage = isLiquidation ? LIQUIDATION_MAX_SLIPPAGE_BPS : NORMAL_MAX_SLIPPAGE_BPS;

            if (slippage >= maxSlippage) {
                emit SlippageExceeded(msg.sender, soldTokenDollarValue, boughtTokenDollarValue, slippage);
                revert SlippageTooHigh(slippage, maxSlippage);
            }
        }
    }

    function paraSwapBeforeLiquidation(
        bytes4 selector,
        bytes calldata data
    ) external nonReentrant onlyWhitelistedLiquidators noBorrowInTheSameBlock {
        ParaSwapDecodedData memory paraSwapDecodedData = decodeParaSwapData(selector, data);
        validateSwapParameters(paraSwapDecodedData, true);

        SwapTokensDetails memory details = getInitialTokensDetails(
            paraSwapDecodedData.srcToken,
            paraSwapDecodedData.destToken
        );

        executeSwap(selector, data, details, paraSwapDecodedData, true);
    }

    function paraSwapV6(
        bytes4 selector,
        bytes calldata data
    ) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        ParaSwapDecodedData memory paraSwapDecodedData = decodeParaSwapData(selector, data);

        validateSwapParameters(paraSwapDecodedData, false);

        SwapTokensDetails memory details = getInitialTokensDetails(
            paraSwapDecodedData.srcToken,
            paraSwapDecodedData.destToken
        );

        executeSwap(selector, data, details, paraSwapDecodedData, false);
    }

    function decodeParaSwapData(bytes4 selector, bytes calldata data) internal pure returns (ParaSwapDecodedData memory) {
        if (selector == SWAP_EXACT_AMOUNT_IN_SELECTOR) {
            return _decodeSwapExactAmountInData(data);
        } else if (selector == SWAP_EXACT_AMOUNT_IN_ON_UNI_V3_SELECTOR) {
            return _decodeSwapExactAmountInOnUniV3Data(data);
        }
        revert("Invalid selector");
    }

    function _decodeSwapExactAmountInOnUniV3Data(bytes calldata _data)
    internal
    pure
    returns (ParaSwapDecodedData memory decoded)
    {
        UniswapV3Data memory _uniswapV3Data = abi.decode(_data, (UniswapV3Data));
        uint256 partnerAndFee = _decodePartnerAndFeeForUniFullData(_data);
        (address payable partner,) = _parsePartnerAndFeeData(partnerAndFee);

        decoded.srcToken = _uniswapV3Data.srcToken;
        decoded.destToken = _uniswapV3Data.destToken;
        decoded.fromAmount = _uniswapV3Data.fromAmount;
        decoded.toAmount = _uniswapV3Data.toAmount;
        decoded.partner = partner;
        decoded.beneficiary = _uniswapV3Data.beneficiary;

        return decoded;
    }

    function _decodePartnerAndFeeForUniFullData(bytes calldata data) internal pure returns (uint256 partnerAndFee) {
        require(data.length >= 288, "Invalid UniV3 data length");

        assembly {
            partnerAndFee := calldataload(add(data.offset, 32))
        }
    }

    function _decodeSwapExactAmountInData(bytes calldata _data)
    internal
    pure
    returns (ParaSwapDecodedData memory decoded)
    {
        require(_data.length >= 288, "Invalid SwapExactAmountIn data length");

        address executor;
        bytes memory executorBytes = _data[:32];
        assembly {
            executor := mload(add(executorBytes, 32))
        }

        /// @dev generic data size is 224. So the entire struct would be from 32 to 224+32 positions
        bytes memory genericDataBytes = _data[32:256];
        GenericData memory _genericData = _decodeGenericData(genericDataBytes);

        uint256 partnerAndFee = abi.decode(_data[256:288], (uint256));
        (address payable partner,) = _parsePartnerAndFeeData(partnerAndFee);

        decoded.executor = executor;
        decoded.srcToken = _genericData.srcToken;
        decoded.destToken = _genericData.destToken;
        decoded.fromAmount = _genericData.fromAmount;
        decoded.toAmount = _genericData.toAmount;
        decoded.partner = partner;
        decoded.beneficiary = _genericData.beneficiary;

        return decoded;
    }

    function _decodeGenericData(bytes memory _data) internal pure returns (GenericData memory) {
        GenericData memory genericData = abi.decode(_data, (GenericData));
        return genericData;
    }

    function _parsePartnerAndFeeData(uint256 partnerAndFee)
    internal
    pure
    returns (address payable partner, uint256 feeBps)
    {
        assembly {
        // Get partner address from last 20 bytes
            partner := and(shr(96, partnerAndFee), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        // Get fee directly in basis points using 14-bit mask
            feeBps := and(partnerAndFee, 0x3FFF)
        }
    }

    function _checkExecutorAddress(address _executorAddress) internal pure returns (bool) {
        if (_executorAddress == EXECUTOR_3) return true; //most likely executor, checks first
        if (_executorAddress == EXECUTOR_2) return true;
        if (_executorAddress == EXECUTOR_4) return true;
        if (_executorAddress == EXECUTOR_5) return true;
        if (_executorAddress == EXECUTOR_1) return true;
        return false;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    modifier onlyWhitelistedLiquidators() {
        require(
            SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender),
            "Only whitelisted liquidators can execute this method"
        );
        _;
    }
}