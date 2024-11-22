// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 65136a418b6f93ab386bcb536b847bd1de0caf3a;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2PlusFacet.sol";

contract GmxV2PlusFacetArbitrum is GmxV2PlusFacet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/arbitrum/
    // GMX contracts
    function getGmxV2Router() internal pure override returns (address) {
        return 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    }

    function getGmxV2ExchangeRouter() internal pure override returns (address) {
        return 0x69C527fC77291722b52649E45c838e41be8Bf5d5;
    }

    function getGmxV2DepositVault() internal pure override returns (address) {
        return 0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55;
    }

    function getGmxV2WithdrawalVault() internal pure override returns (address) {
        return 0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55;
    }

    // Markets
    address constant GM_ETH_WETH = 0x450bb6774Dd8a756274E0ab4107953259d2ac541;
    address constant GM_BTC_WBTC = 0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77;

    // Tokens
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;

    // Mappings
    function marketToToken(
        address market
    ) internal pure override returns (address) {
        if (market == GM_ETH_WETH) {
            return WETH;
        } else if (market == GM_BTC_WBTC) {
            return WBTC;
        } else {
            revert("Market not supported");
        }
    }

    // DEPOSIT
    function depositEthGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable {
        _deposit(GM_ETH_WETH, tokenAmount, minGmAmount, executionFee);
    }

    function depositBtcGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable {
        _deposit(GM_BTC_WBTC, tokenAmount, minGmAmount, executionFee);
    }

    // WITHDRAW
    function withdrawEthGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable {
        _withdraw(
            GM_ETH_WETH,
            gmAmount,
            minLongTokenAmount,
            minShortTokenAmount,
            executionFee
        );
    }

    function withdrawBtcGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable {
        _withdraw(
            GM_BTC_WBTC,
            gmAmount,
            minLongTokenAmount,
            minShortTokenAmount,
            executionFee
        );
    }
}
