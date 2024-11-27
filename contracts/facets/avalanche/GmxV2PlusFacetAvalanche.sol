// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c1391d85590ab530af967dbef6f857f87886a119;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2PlusFacet.sol";

contract GmxV2PlusFacetAvalanche is GmxV2PlusFacet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/avalanche/
    // GMX contracts
    function getGmxV2Router() internal pure override returns (address) {
        return 0x820F5FfC5b525cD4d88Cd91aCf2c28F16530Cc68;
    }

    function getGmxV2ExchangeRouter() internal pure override returns (address) {
        return 0x3BE24AED1a4CcaDebF2956e02C27a00726D4327d;
    }

    function getGmxV2DepositVault() internal pure override returns (address) {
        return 0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF;
    }

    function getGmxV2WithdrawalVault() internal pure override returns (address) {
        return 0xf5F30B10141E1F63FC11eD772931A8294a591996;
    }

    // Markets
    address constant GM_BTC_BTCb = 0x3ce7BCDB37Bf587d1C17B930Fa0A7000A0648D12;
    address constant GM_ETH_WETHe = 0x2A3Cf4ad7db715DF994393e4482D6f1e58a1b533;
    address constant GM_AVAX_WAVAX = 0x08b25A2a89036d298D6dB8A74ace9d1ce6Db15E5;

    // Tokens
    address constant BTCb = 0x152b9d0FdC40C096757F570A51E494bd4b943E50;
    address constant WETHe = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    // Mappings
    function marketToToken(
        address market
    ) internal pure override returns (address) {
        if (market == GM_BTC_BTCb) {
            return BTCb;
        } else if (market == GM_ETH_WETHe) {
            return WETHe;
        } else if (market == GM_AVAX_WAVAX) {
            return WAVAX;
        } else {
            revert("Market not supported");
        }
    }

    // DEPOSIT
    function depositBtcGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable {
        _deposit(GM_BTC_BTCb, tokenAmount, minGmAmount, executionFee);
    }

    function depositEthGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable {
        _deposit(GM_ETH_WETHe, tokenAmount, minGmAmount, executionFee);
    }

    function depositAvaxGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable {
        _deposit(GM_AVAX_WAVAX, tokenAmount, minGmAmount, executionFee);
    }

    // WITHDRAW
    function withdrawBtcGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable {
        _withdraw(
            GM_BTC_BTCb,
            gmAmount,
            minLongTokenAmount,
            minShortTokenAmount,
            executionFee
        );
    }

    function withdrawEthGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable {
        _withdraw(
            GM_ETH_WETHe,
            gmAmount,
            minLongTokenAmount,
            minShortTokenAmount,
            executionFee
        );
    }

    function withdrawAvaxGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable {
        _withdraw(
            GM_AVAX_WAVAX,
            gmAmount,
            minLongTokenAmount,
            minShortTokenAmount,
            executionFee
        );
    }
}
