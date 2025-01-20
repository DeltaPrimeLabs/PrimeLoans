// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 19d9982858f4feeff1ca98cbf31b07304a79ac7f;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "./SmartLoanLiquidationFacet.sol";
import "../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract ParaSwapFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    ///@dev paraSwap v6.2 router
    address private constant PARA_ROUTER = 0x6A000F20005980200259B80c5102003040001068;

    ///@notice selectors for paraSwapV6 data decoding
    bytes4 private constant SWAP_EXACT_AMOUNT_IN_SELECTOR = 0xe3ead59e;
    bytes4 private constant SWAP_EXACT_AMOUNT_IN_ON_UNI_V3_SELECTOR = 0x876a02f6;

    /// @notice executor addresses returned by ParaSwap API
    /// https://api.paraswap.io/adapters/contract-takers?network=43114
    address private constant EXECUTOR_1 = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;
    address private constant EXECUTOR_2 = 0x6A000F20005980200259B80c5102003040001068;
    address private constant EXECUTOR_3 = 0x000010036C0190E009a000d0fc3541100A07380A;
    address private constant EXECUTOR_4 = 0x00C600b30fb0400701010F4b080409018B9006E0;
    address private constant EXECUTOR_5 = 0xe009F00e200A090090fC70e02d70B232000c0802;

    struct SwapTokensDetails {
        bytes32 tokenSoldSymbol;
        bytes32 tokenBoughtSymbol;
        IERC20Metadata soldToken;
        IERC20Metadata boughtToken;
        uint256 initialSoldTokenBalance;
        uint256 initialBoughtTokenBalance;
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

    ////////////////////****** PARASWAPV6 STRUCTS *////////////////////

    /*//////////////////////////////////////////////////////////////
                            GENERIC SWAP DATA
    //////////////////////////////////////////////////////////////*/

    /// @notice Struct containg data for generic swapExactAmountIn/swapExactAmountOut
    /// @param srcToken The token to swap from
    /// @param destToken The token to swap to
    /// @param fromAmount The amount of srcToken to swap
    /// = amountIn for swapExactAmountIn and maxAmountIn for swapExactAmountOut
    /// @param toAmount The minimum amount of destToken to receive
    /// = minAmountOut for swapExactAmountIn and amountOut for swapExactAmountOut
    /// @param quotedAmount The quoted expected amount of destToken/srcToken
    /// = quotedAmountOut for swapExactAmountIn and quotedAmountIn for swapExactAmountOut
    /// @param metadata Packed uuid and additional metadata
    /// @param beneficiary The address to send the swapped tokens to
    /// @dev GenericData size: since all elements are lefPadded to 32 bytes, size is 32*7 = 224
    struct GenericData {
        address srcToken; // changing IERC20 to address for possible ease of decoding
        address destToken; // changing IERC20 to address for possible ease of decoding
        uint256 fromAmount;
        uint256 toAmount;
        uint256 quotedAmount;
        bytes32 metadata;
        address payable beneficiary;
    }

    /// @notice struct constructed from swapExactAmountIn interface from developer docs
    /// https://developers.paraswap.network/augustus-swapper/augustus-v6.2
    struct SwapExactAmountIn {
        address executor;
        GenericData swapData;
        uint256 partnerAndFee;
        bytes permit;
        bytes executorData;
    }

    /// @notice struct constructed based swapExactAmountInOnUniswapV3 from developer docs.
    /// @dev changed srctToken and destToken to address from IERC20 for ease of decoding
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

    /// @notice FullData struct for swapExactAmountInOnUniswapV3
    /// @dev from the deployed contract https://snowtrace.deth.net/address/0x6a000f20005980200259b80c5102003040001068
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
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (_boughtTokenAddress == 0xaE64d55a6f09E4263421737397D1fdFA71896a69) {
            _boughtTokenAddress = 0x9e295B5B976a184B14aD8cd72413aD846C299660;
        }

        if (_soldTokenAddress == 0xaE64d55a6f09E4263421737397D1fdFA71896a69) {
            _soldTokenAddress = 0x9e295B5B976a184B14aD8cd72413aD846C299660;
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

    function paraSwapBeforeLiquidation(
        bytes4 selector,
        bytes calldata data
    ) external nonReentrant onlyWhitelistedLiquidators noBorrowInTheSameBlock {
        // Liquidation-specific check
        require(!_isSolvent(), "Cannot perform on a solvent account");

        ParaSwapDecodedData memory paraSwapDecodedData;

        // Decode data based on selector
        if (selector == SWAP_EXACT_AMOUNT_IN_SELECTOR) {
            (
                paraSwapDecodedData.executor,
                paraSwapDecodedData.srcToken,
                paraSwapDecodedData.destToken,
                paraSwapDecodedData.fromAmount,
                paraSwapDecodedData.toAmount,
                paraSwapDecodedData.partner,
                paraSwapDecodedData.beneficiary
            ) = _decodeSwapExactAmountInData(data);

            // Validate executor address
            require(_checkExecutorAddress(paraSwapDecodedData.executor), "Executor address is wrong");
        } else if (selector == SWAP_EXACT_AMOUNT_IN_ON_UNI_V3_SELECTOR) {
            (
                paraSwapDecodedData.srcToken,
                paraSwapDecodedData.destToken,
                paraSwapDecodedData.fromAmount,
                paraSwapDecodedData.toAmount,
                paraSwapDecodedData.partner,
                paraSwapDecodedData.beneficiary
            ) = _decodeSwapExactAmountInOnUniV3Data(data);
        } else {
            revert("Invalid selector");
        }

        // Validate partner address
        require(
            paraSwapDecodedData.partner == DeploymentConstants.getFeesRedistributionAddress(),
            "Invalid partner address"
        );

        // Validate beneficiary address
        require(
            paraSwapDecodedData.beneficiary == address(this) || paraSwapDecodedData.beneficiary == address(0),
            "Invalid beneficiary address"
        );

        // Validate token addresses
        require(paraSwapDecodedData.srcToken != address(0), "Source token cannot be zero address");
        require(paraSwapDecodedData.destToken != address(0), "Destination token cannot be zero address");
        require(paraSwapDecodedData.srcToken != paraSwapDecodedData.destToken, "Source and destination tokens must be different");

        // Validate amounts
        require(paraSwapDecodedData.fromAmount > 0 && paraSwapDecodedData.toAmount > 0, "Invalid amounts");
        require(paraSwapDecodedData.fromAmount <= type(uint128).max, "Amount too large");

        // Get initial token details
        SwapTokensDetails memory swapTokensDetails = getInitialTokensDetails(
            paraSwapDecodedData.srcToken,
            paraSwapDecodedData.destToken
        );

        // Validate balances and allowance
        require(
            swapTokensDetails.soldToken.balanceOf(address(this)) >= paraSwapDecodedData.fromAmount,
            "Insufficient balance"
        );

        // Approve tokens for ParaSwap router
        address(swapTokensDetails.soldToken).safeApprove(PARA_ROUTER, 0);
        address(swapTokensDetails.soldToken).safeApprove(PARA_ROUTER, paraSwapDecodedData.fromAmount);

        require(
            swapTokensDetails.soldToken.allowance(address(this), PARA_ROUTER) >= paraSwapDecodedData.fromAmount,
            "Insufficient allowance"
        );

        // Execute swap
        (bool success,) = PARA_ROUTER.call(abi.encodePacked(selector, data));
        require(success, "Swap failed");

        // Calculate final amounts
        uint256 boughtTokenFinalAmount = swapTokensDetails.boughtToken.balanceOf(address(this))
            - swapTokensDetails.initialBoughtTokenBalance;
        require(boughtTokenFinalAmount >= paraSwapDecodedData.toAmount, "Too little received");

        uint256 soldTokenFinalAmount = swapTokensDetails.initialSoldTokenBalance
            - swapTokensDetails.soldToken.balanceOf(address(this));

        // Liquidation-specific check: Ensure exact amount was sold
        require(soldTokenFinalAmount == paraSwapDecodedData.fromAmount, "Too much sold");

        // Slippage protection
        bytes32[] memory symbols = new bytes32[](2);
        symbols[0] = swapTokensDetails.tokenSoldSymbol;
        symbols[1] = swapTokensDetails.tokenBoughtSymbol;
        uint256[] memory prices = getPrices(symbols);

        uint256 soldTokenDollarValue = prices[0] * soldTokenFinalAmount * 10**10 / 10**swapTokensDetails.soldToken.decimals();
        uint256 boughtTokenDollarValue = prices[1] * boughtTokenFinalAmount * 10**10 / 10**swapTokensDetails.boughtToken.decimals();

        if (soldTokenDollarValue > boughtTokenDollarValue) {
            uint256 slippage = (soldTokenDollarValue - boughtTokenDollarValue) * 100 / soldTokenDollarValue;
            require(slippage < 2, "Slippage too high"); // MAX 2% slippage for liquidation (stricter than normal swaps)
        }

        // Update token exposures
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(swapTokensDetails.soldToken), soldTokenFinalAmount);
        _increaseExposure(tokenManager, address(swapTokensDetails.boughtToken), boughtTokenFinalAmount);

        // Emit swap event
        emit Swap(
            msg.sender,
            swapTokensDetails.tokenSoldSymbol,
            swapTokensDetails.tokenBoughtSymbol,
            soldTokenFinalAmount,
            boughtTokenFinalAmount,
            block.timestamp
        );
    }

    /// @notice function to swap funds via ParaSwap, the DEX aggregator
    /// @param selector the function selector of the ParaSwap method that will be called
    /// @param data the data that is passed to the ParaSwap method
    /// @dev paraSwap API returns both selector and data, which is being passed on here
    /// @dev on chain validations of the data is done in the internal functions before praSwap method gets called
    function paraSwapV2(
        bytes4 selector,
        bytes calldata data
    ) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        ParaSwapDecodedData memory paraSwapDecodedData;

        // Decode data based on selector
        if (selector == SWAP_EXACT_AMOUNT_IN_SELECTOR) {
            (
                paraSwapDecodedData.executor,
                paraSwapDecodedData.srcToken,
                paraSwapDecodedData.destToken,
                paraSwapDecodedData.fromAmount,
                paraSwapDecodedData.toAmount,
                paraSwapDecodedData.partner,
                paraSwapDecodedData.beneficiary
            ) = _decodeSwapExactAmountInData(data);

            // Validate executor address
            require(_checkExecutorAddress(paraSwapDecodedData.executor), "Executor address is wrong");
        } else if (selector == SWAP_EXACT_AMOUNT_IN_ON_UNI_V3_SELECTOR) {
            (
                paraSwapDecodedData.srcToken,
                paraSwapDecodedData.destToken,
                paraSwapDecodedData.fromAmount,
                paraSwapDecodedData.toAmount,
                paraSwapDecodedData.partner,
                paraSwapDecodedData.beneficiary
            ) = _decodeSwapExactAmountInOnUniV3Data(data);
        } else {
            revert("Invalid selector");
        }


        // Validate partner address
        require(
            paraSwapDecodedData.partner == DeploymentConstants.getFeesRedistributionAddress(),
            "Invalid partner address"
        );

        // Validate beneficiary address
        require(
            paraSwapDecodedData.beneficiary == address(this) || paraSwapDecodedData.beneficiary == address(0),
            "Invalid beneficiary address"
        );

        // Validate token addresses
        require(paraSwapDecodedData.srcToken != address(0), "Source token cannot be zero address");
        require(paraSwapDecodedData.destToken != address(0), "Destination token cannot be zero address");
        require(paraSwapDecodedData.srcToken != paraSwapDecodedData.destToken, "Source and destination tokens must be different");

        // Validate amounts
        require(paraSwapDecodedData.fromAmount > 0 && paraSwapDecodedData.toAmount > 0, "Invalid amounts");
        require(paraSwapDecodedData.fromAmount <= type(uint128).max, "Amount too large");

        // Get initial token details
        SwapTokensDetails memory swapTokensDetails = getInitialTokensDetails(
            paraSwapDecodedData.srcToken,
            paraSwapDecodedData.destToken
        );

        // Validate balances and allowance
        require(
            swapTokensDetails.soldToken.balanceOf(address(this)) >= paraSwapDecodedData.fromAmount,
            "Insufficient balance"
        );

        // Approve tokens for ParaSwap router
        address(swapTokensDetails.soldToken).safeApprove(PARA_ROUTER, 0);
        address(swapTokensDetails.soldToken).safeApprove(PARA_ROUTER, paraSwapDecodedData.fromAmount);

        require(
            swapTokensDetails.soldToken.allowance(address(this), PARA_ROUTER) >= paraSwapDecodedData.fromAmount,
            "Insufficient allowance"
        );

        // Execute swap
        (bool success,) = PARA_ROUTER.call(abi.encodePacked(selector, data));
        require(success, "Swap failed");

        // Calculate final amounts
        uint256 boughtTokenFinalAmount = swapTokensDetails.boughtToken.balanceOf(address(this))
            - swapTokensDetails.initialBoughtTokenBalance;
        require(boughtTokenFinalAmount >= paraSwapDecodedData.toAmount, "Too little received");

        uint256 soldTokenFinalAmount = swapTokensDetails.initialSoldTokenBalance
            - swapTokensDetails.soldToken.balanceOf(address(this));

        // Slippage protection
        bytes32[] memory symbols = new bytes32[](2);
        symbols[0] = swapTokensDetails.tokenSoldSymbol;
        symbols[1] = swapTokensDetails.tokenBoughtSymbol;
        uint256[] memory prices = getPrices(symbols);

        uint256 soldTokenDollarValue = prices[0] * soldTokenFinalAmount * 10**10 / 10**swapTokensDetails.soldToken.decimals();
        uint256 boughtTokenDollarValue = prices[1] * boughtTokenFinalAmount * 10**10 / 10**swapTokensDetails.boughtToken.decimals();

        if (soldTokenDollarValue > boughtTokenDollarValue) {
            uint256 slippage = (soldTokenDollarValue - boughtTokenDollarValue) * 100 / soldTokenDollarValue;
            require(slippage < 5, "Slippage too high"); // MAX 5% slippage
        }

        // Update token exposures
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(swapTokensDetails.soldToken), soldTokenFinalAmount);
        _increaseExposure(tokenManager, address(swapTokensDetails.boughtToken), boughtTokenFinalAmount);

        // Emit swap event
        emit Swap(
            msg.sender,
            swapTokensDetails.tokenSoldSymbol,
            swapTokensDetails.tokenBoughtSymbol,
            soldTokenFinalAmount,
            boughtTokenFinalAmount,
            block.timestamp
        );
    }

    /// @notice internal function that decodes the data returned by ParaSwap API for SwapExactAmountInOnUniV3 method
    /// @param _data the data to be decoded
    /// @dev the different scope of the internal function helps avoid Stack Too Deep errors
    function _decodeSwapExactAmountInOnUniV3Data(bytes calldata _data)
        internal
        pure
        returns (address srcToken, address destToken, uint256 fromAmount, uint256 toAmount, address partner, address payable beneficiary)
    {
        UniswapV3Data memory _uniswapV3Data = abi.decode(_data, (UniswapV3Data));

        uint256 partnerAndFee = _decodePartnerAndFeeForUniFullData(_data);
        (address payable partner, uint256 fee) = _parsePartnerAndFeeData(partnerAndFee);

    return (_uniswapV3Data.srcToken, _uniswapV3Data.destToken, _uniswapV3Data.fromAmount, _uniswapV3Data.toAmount, partner, _uniswapV3Data.beneficiary);
    }

    /// @notice internal function that decodes partnerAndFee element from UniswapV3FullData
    function _decodePartnerAndFeeForUniFullData(bytes calldata data) internal pure returns (uint256 partnerAndFee) {
        require(data.length >= 288, "Invalid UniV3 data length");

        assembly {
        // partnerAndFee is at position 32 in the UniswapV3FullData struct
            partnerAndFee := calldataload(add(data.offset, 32))
        }

        (address payable partner, uint256 fee) = _parsePartnerAndFeeData(partnerAndFee);
        return partnerAndFee;
    }

    function _parsePartnerAndFeeData(uint256 partnerAndFee)
    public
    pure
    returns (address payable partner, uint256 feeBps)
    {
        assembly ("memory-safe") {
        // Get partner address from last 20 bytes
            partner := and(shr(96, partnerAndFee), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        // Get fee directly in basis points using 14-bit mask
            feeBps := and(partnerAndFee, 0x3FFF)
        }
    }

    /// @notice internal function that decodes the data returned by ParaSwap API for SwapExactAmountIn method
    /// @param _data the data to be decoded
    /// @dev the different scope of the internal function helps avoid Stack Too Deep errors
    /// @dev _data gets sliced according to the SwapExactAmountIn struct declaration
    function _decodeSwapExactAmountInData(bytes calldata _data)
        internal
        pure
        returns (address executorAddress, address srcToken, address destToken, uint256 fromAmount, uint256 toAmount, address partner, address payable beneficiary)
    {
        address executor;
        bytes memory executorBytes = _data[:32];
        (executor) = abi.decode(executorBytes, (address));

        /// @dev generic data size is 224. So the entire struct would be from 32 to 224+32 positions
        bytes memory genericDataBytes = _data[32:256];
        GenericData memory _genericData = _decodeGenericData(genericDataBytes);

        (uint256 partnerAndFee) = abi.decode(_data[256:288], (uint256));
        (address payable partner, uint256 fee) = _parsePartnerAndFeeData(partnerAndFee);

        return (executor, _genericData.srcToken, _genericData.destToken, _genericData.fromAmount, _genericData.toAmount, partner, _genericData.beneficiary);
    }

    /// @notice internal function that decodes the GenericData struct, subset of SwapExactAmountIn
    /// @param _data the data to be decoded
    /// @dev the different scope here is crucial to avoid Stack Too Deep errors
    function _decodeGenericData(bytes memory _data) internal pure returns (GenericData memory) {
        GenericData memory genericData = abi.decode(_data, (GenericData));
        bytes memory metadata = abi.encodePacked(genericData.metadata);
        return genericData;
    }

    /// @notice internal function that validates the executor address returned by the ParaSwap API
    /// @param _executorAddress the address of the executor
    /// @dev the executor addresses are available at https://api.paraswap.io/adapters/contract-takers?network=43114
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
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(
            SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender),
            "Only whitelisted liquidators can execute this method"
        );
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
     *
     */
    event Swap(
        address indexed user,
        bytes32 indexed soldAsset,
        bytes32 indexed boughtAsset,
        uint256 amountSold,
        uint256 amountBought,
        uint256 timestamp
    );
}
