// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title IBaseOracle
 * @dev Interface for BaseOracle contract that calculates the USD value of an asset using multiple liquidity pools.
 */
interface IBaseOracle {
    // Custom errors
    error EmptyPools();
    error InvalidPoolTokens();
    error NoCLPoolProvided();
    error InvalidBaseAsset();
    error TokenNotConfigured();
    error LengthMismatch();
    error MissingBaseAssetPrice();
    error NoValidPrice();
    error TWAPDeviationTooHigh();
    error InvalidInput();
    error DivisionByZero();

    // Enums
    enum Protocol {
        UNISWAP,
        AERODROME
    }

    // Structs
    struct QuoterConfig {
        address clQuoter;
    }

    struct TWAPCheck {
        uint32 duration;
        uint256 maxDeviation;
    }

    struct PoolConfig {
        address poolAddress;
        bool isCL;
        int24 tickSpacing;
        uint32 shortTwap;
        TWAPCheck[] twapChecks;
        address baseAsset;
        Protocol protocol;
    }

    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    struct GetDollarValueParams {
        address asset;
        uint256 amount;
        bool useTwapChecks;
        address[] baseAssets;
        uint256[] baseAssetPrices;
    }

    // Events
    event PoolAdded(address indexed token, address indexed pool);
    event PoolRemoved(address indexed token, address indexed pool);
    event TokenConfigured(address indexed token);
    event TokenRemoved(address indexed token);

    // Functions
    function initialize(address _initialOwner) external;

    function configureToken(
        address token,
        PoolConfig[] calldata pools
    ) external;

    function removeToken(address token) external;

    function getTokenDollarPrice(
        GetDollarValueParams calldata params
    ) external view returns (uint256);

    function getFullTokenConfig(
        address token
    ) external view returns (TokenConfig memory);

    // Optional: View functions for configurations
    function tokenConfigs(
        address token
    ) external view returns (TokenConfig memory);

    function quoterConfigs(
        Protocol protocol
    ) external view returns (QuoterConfig memory);
}