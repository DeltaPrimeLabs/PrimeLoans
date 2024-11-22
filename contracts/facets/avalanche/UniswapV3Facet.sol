// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import "../../interfaces/joe-v2/ILBFactory.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/uniswap-v3/OracleLibrary.sol";
import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";

contract UniswapV3Facet is IUniswapV3Facet, AvalancheDataServiceConsumerBase, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    address private constant NONFUNGIBLE_POSITION_MANAGER_ADDRESS = 0x655C406EBFa14EE2006250925e54ec43AD184f8B;
    address private constant UNISWAP_V3_FACTORY_ADDRESS = 0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD;
    uint256 public constant ACCEPTED_UNISWAP_SLIPPAGE = 0.05e18;

    using TransferHelper for address;

    uint256 constant MAX_OWNED_UNISWAP_V3_POSITIONS = 100; //TODO: dummy number, update after running gas tests

    function getTokenIds() internal returns (uint256[] storage result){
        return DiamondStorageLib.getUV3OwnedTokenIds();
    }

    function getOwnedUniswapV3TokenIds() public view returns (uint256[] memory result){
        return DiamondStorageLib.getUV3OwnedTokenIdsView();
    }

    function getWhitelistedUniswapV3Pools() internal view returns (IUniswapV3Pool[2] memory pools){
        return [
            IUniswapV3Pool(0xfAe3f424a0a47706811521E3ee268f00cFb5c45E),
            IUniswapV3Pool(0x7b602f98D71715916E7c963f51bfEbC754aDE2d0)
        ];
    }

    //TODO: optimize it (mapping?)
    function isPoolWhitelisted(address pool) internal view returns (bool){
        IUniswapV3Pool[2] memory pools = getWhitelistedUniswapV3Pools();

        for (uint i; i < pools.length; ++i) {
            if (pool == address(pools[i])) return true;
        }
        return false;
    }

    function mintLiquidityUniswapV3(INonfungiblePositionManager.MintParams memory params) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(params.token0, params.token1, params.fee));

        if (!isPoolWhitelisted(poolAddress)) revert UniswapV3PoolNotWhitelisted();

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes32 token0 = tokenManager.tokenAddressToSymbol(address(params.token0));
        bytes32 token1 = tokenManager.tokenAddressToSymbol(address(params.token1));

        params.recipient = address(this);

        {
            //TODO: write tests for that

            bytes32[] memory symbols = new bytes32[](2);

            symbols[0] = token0;
            symbols[1] = token1;

            uint256[] memory prices = getOracleNumericValuesFromTxMsg(symbols);
            (,int24 tick,,,,,) = IUniswapV3Pool(poolAddress).slot0();

            uint256 poolPrice = OracleLibrary.getQuoteAtTick(tick, uint128(10 ** IERC20Metadata(params.token0).decimals()), params.token0, params.token1);
            uint256 oraclePrice = prices[0] * (10 ** IERC20Metadata(params.token1).decimals()) / prices[1];

            if (oraclePrice > poolPrice) {
                if ((oraclePrice - poolPrice) * 1e18 / oraclePrice > ACCEPTED_UNISWAP_SLIPPAGE) revert SlippageTooHigh();
            } else {
                if ((poolPrice - oraclePrice) * 1e18 / oraclePrice > ACCEPTED_UNISWAP_SLIPPAGE) revert SlippageTooHigh();
            }
        }

        address(params.token0).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), 0);
        address(params.token1).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), 0);

        address(params.token0).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount0Desired);
        address(params.token1).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount1Desired);

        (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).mint(params);

        {
            uint256[] storage tokenIds = DiamondStorageLib.getUV3OwnedTokenIds();
            if (tokenIds.length >= MAX_OWNED_UNISWAP_V3_POSITIONS) revert TooManyUniswapV3Positions();
            tokenIds.push(tokenId);
        }

        _decreaseExposure(tokenManager, params.token0, amount0);
        _decreaseExposure(tokenManager, params.token1, amount1);

        emit AddLiquidityUniswapV3(msg.sender, poolAddress, tokenId, token0, token1, liquidity, amount0, amount1, block.timestamp);
    }

    function increaseLiquidityUniswapV3(INonfungiblePositionManager.IncreaseLiquidityParams memory params) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        (
        ,,
        address token0Address,
        address token1Address,
        uint24 fee,
        ,,,,,,
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).positions(params.tokenId);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes32 token0 = tokenManager.tokenAddressToSymbol(token0Address);
        bytes32 token1 = tokenManager.tokenAddressToSymbol(token1Address);

        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(token0Address, token1Address, fee));

        if (!isPoolWhitelisted(poolAddress)) revert UniswapV3PoolNotWhitelisted();

        {
            bytes32[] memory symbols = new bytes32[](2);

            symbols[0] = token0;
            symbols[1] = token1;

            uint256[] memory prices = getOracleNumericValuesFromTxMsg(symbols);
            (,int24 tick,,,,,) = IUniswapV3Pool(poolAddress).slot0();

            uint256 poolPrice = OracleLibrary.getQuoteAtTick(tick, uint128(10 ** IERC20Metadata(token0Address).decimals()), token0Address, token1Address);
            uint256 oraclePrice = prices[0] * (10 ** IERC20Metadata(token1Address).decimals()) / prices[1];


            if (oraclePrice > poolPrice) {
                if ((oraclePrice - poolPrice) * 1e18 / oraclePrice > ACCEPTED_UNISWAP_SLIPPAGE) revert SlippageTooHigh();
            } else {
                if ((poolPrice - oraclePrice) * 1e18 / oraclePrice > ACCEPTED_UNISWAP_SLIPPAGE) revert SlippageTooHigh();
            }
        }

        token0Address.safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), 0);
        token1Address.safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), 0);

        token0Address.safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount0Desired);
        token1Address.safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount1Desired);

        (
        ,
        uint256 amount0,
        uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).increaseLiquidity(params);

        _decreaseExposure(tokenManager, token0Address, amount0);
        _decreaseExposure(tokenManager, token1Address, amount1);

        emit IncreaseLiquidityUniswapV3(msg.sender, poolAddress, params.tokenId, token0, token1, amount0, amount1, block.timestamp);
    }

    function decreaseLiquidityUniswapV3(INonfungiblePositionManager.DecreaseLiquidityParams memory params) external nonReentrant noBorrowInTheSameBlock onlyOwnerOrInsolvent {
        (
        ,,
        address token0Address,
        address token1Address,
        uint24 fee,
        ,,,,,,
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).positions(params.tokenId);
        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(token0Address, token1Address, fee));

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes32 token0 = tokenManager.tokenAddressToSymbol(token0Address);
        bytes32 token1 = tokenManager.tokenAddressToSymbol(token1Address);

        {
            bytes32[] memory symbols = new bytes32[](2);

            symbols[0] = token0;
            symbols[1] = token1;

            uint256[] memory prices = getOracleNumericValuesFromTxMsg(symbols);
            (,int24 tick,,,,,) = IUniswapV3Pool(poolAddress).slot0();

            uint256 poolPrice = OracleLibrary.getQuoteAtTick(tick, uint128(10 ** IERC20Metadata(token0Address).decimals()), token0Address, token1Address);
            uint256 oraclePrice = prices[0] * (10 ** IERC20Metadata(token1Address).decimals()) / prices[1];


            if (oraclePrice > poolPrice) {
                if ((oraclePrice - poolPrice) * 1e18 / oraclePrice > ACCEPTED_UNISWAP_SLIPPAGE) revert SlippageTooHigh();
            } else {
                if ((poolPrice - oraclePrice) * 1e18 / oraclePrice > ACCEPTED_UNISWAP_SLIPPAGE) revert SlippageTooHigh();
            }
        }

        (
            uint256 amount0,
            uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).decreaseLiquidity(params);

        //TODO: check risks of uint256 to uint128 conversion
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams(params.tokenId, address(this), uint128(amount0), uint128(amount1));

        INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).collect(collectParams);

        _increaseExposure(tokenManager, token0Address, amount0);
        _increaseExposure(tokenManager, token1Address, amount1);

        emit DecreaseLiquidityUniswapV3(msg.sender, poolAddress, params.tokenId, token0, token1, amount0, amount1, block.timestamp);
    }

    function burnLiquidityUniswapV3(uint256 tokenId) external nonReentrant noBorrowInTheSameBlock onlyOwnerOrInsolvent {
        uint256[] storage tokenIds = getTokenIds();
        for (uint256 i; i < tokenIds.length; i++) {
            if (tokenIds[i] == tokenId) {
                INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).burn(tokenId);
                tokenIds[i] = tokenIds[tokenIds.length - 1];
                tokenIds.pop();
                emit BurnLiquidityUniswapV3(msg.sender, tokenId, block.timestamp);

                break;
            }
        }
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // pool must be whitelisted
    error UniswapV3PoolNotWhitelisted();

    error TooManyUniswapV3Positions();

    error SlippageTooHigh();

    /**
     * @dev emitted after minting liquidity
     * @param user the address of user providing liquidity
     * @param pool UniswapV3 pool
     * @param tokenId the if of NFT LP position
     * @param firstAsset first asset provided for liquidity
     * @param secondAsset second asset provided for liquidity
     * @param liquidity amount of liquidity (LP token) added
     * @param firstAmount amount of the first asset used
     * @param secondAmount amount of the second asset used
     * @param timestamp time of the transaction
     **/
    event AddLiquidityUniswapV3(address indexed user, address indexed pool, uint256 indexed tokenId, bytes32 firstAsset, bytes32 secondAsset, uint liquidity, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after increasing liquidity
     * @param user the address of user providing liquidity
     * @param pool UniswapV3 pool
     * @param tokenId the if of NFT LP position
     * @param firstAsset first asset provided for liquidity
     * @param secondAsset second asset provided for liquidity
     * @param firstAmount amount of the first asset used
     * @param secondAmount amount of the second asset used
     * @param timestamp time of the transaction
     **/
    event IncreaseLiquidityUniswapV3(address indexed user, address indexed pool, uint256 indexed tokenId, bytes32 firstAsset, bytes32 secondAsset, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after decreasing liquidity
     * @param user the address of user decreasing liquidity
     * @param pool UniswapV3 pool
     * @param tokenId the if of NFT LP position
     * @param firstAsset first asset received
     * @param secondAsset second asset received
     * @param firstAmount amount of the first asset received
     * @param secondAmount amount of the second asset received
     * @param timestamp time of the transaction
     **/
    event DecreaseLiquidityUniswapV3(address indexed user, address indexed pool, uint256 indexed tokenId, bytes32 firstAsset, bytes32 secondAsset, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after burning Uniswap V3 token
     * @param user the address of user decreasing liquidity
     * @param tokenId the if of NFT LP position
     * @param timestamp time of the transaction
     **/
    event BurnLiquidityUniswapV3(address indexed user, uint256 tokenId, uint256 timestamp);

}
