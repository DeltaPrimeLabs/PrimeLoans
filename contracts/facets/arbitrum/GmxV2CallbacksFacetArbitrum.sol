// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 65136a418b6f93ab386bcb536b847bd1de0caf3a;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2CallbacksFacet.sol";

contract GmxV2CallbacksFacetArbitrum is GmxV2CallbacksFacet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/arbitrum/
    // GMX contracts

    function getGmxV2RoleStore() internal pure override returns (address) {
        return 0x3c3d99FD298f679DBC2CEcd132b4eC4d0F5e6e72;
    }

    // Markets
    address constant GM_ETH_WETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address constant GM_ARB_ARB_USDC = 0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407;
    address constant GM_LINK_LINK_USDC = 0x7f1fa204bb700853D36994DA19F830b6Ad18455C;
    address constant GM_UNI_UNI_USDC = 0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50;
    address constant GM_BTC_WBTC_USDC = 0x47c031236e19d024b42f8AE6780E44A573170703;

    address constant GM_SOL_SOL_USDC = 0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9;
    address constant GM_NEAR_WETH_USDC = 0x63Dc80EE90F26363B3FCD609007CC9e14c8991BE;
    address constant GM_ATOM_WETH_USDC = 0x248C35760068cE009a13076D573ed3497A47bCD4;
    address constant GM_GMX_GMX_USDC = 0x55391D178Ce46e7AC8eaAEa50A72D1A5a8A622Da;

    address constant GM_ETH_WETH = 0x450bb6774Dd8a756274E0ab4107953259d2ac541;
    address constant GM_BTC_WBTC = 0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77;

    // Tokens
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    address constant LINK = 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4;
    address constant UNI = 0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0;
    address constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;

    address constant SOL = 0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07;
    address constant GMX = 0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a;

    // Mappings
    function marketToLongToken(
        address market
    ) internal pure override returns (address) {
        if (market == GM_ETH_WETH_USDC || market == GM_ETH_WETH) {
            return WETH;
        } else if (market == GM_ARB_ARB_USDC) {
            return ARB;
        } else if (market == GM_LINK_LINK_USDC) {
            return LINK;
        } else if (market == GM_UNI_UNI_USDC) {
            return UNI;
        } else if (market == GM_BTC_WBTC_USDC || market == GM_BTC_WBTC) {
            return WBTC;
        } else if (market == GM_SOL_SOL_USDC) {
            return SOL;
        } else if (market == GM_NEAR_WETH_USDC) {
            return WETH;
        } else if (market == GM_ATOM_WETH_USDC) {
            return WETH;
        } else if (market == GM_GMX_GMX_USDC) {
            return GMX;
        } else {
            revert("Market not supported");
        }
    }

    function marketToShortToken(
        address market
    ) internal pure override returns (address) {
        if (market == GM_ETH_WETH_USDC) {
            return USDC;
        } else if (market == GM_ARB_ARB_USDC) {
            return USDC;
        } else if (market == GM_LINK_LINK_USDC) {
            return USDC;
        } else if (market == GM_UNI_UNI_USDC) {
            return USDC;
        } else if (market == GM_BTC_WBTC_USDC) {
            return USDC;
        } else if (market == GM_ETH_WETH) {
            return WETH;
        } else if (market == GM_BTC_WBTC) {
            return WBTC;
        } else if (market == GM_SOL_SOL_USDC) {
            return USDC;
        } else if (market == GM_NEAR_WETH_USDC) {
            return USDC;
        } else if (market == GM_ATOM_WETH_USDC) {
            return USDC;
        } else if (market == GM_GMX_GMX_USDC) {
            return USDC;
        } else {
            revert("Market not supported");
        }
    }
}
