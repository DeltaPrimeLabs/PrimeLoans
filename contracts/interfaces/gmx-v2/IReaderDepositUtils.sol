// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IReaderDepositUtils {
    function getDepositAmountOut(
        address dataStore,
        MarketProps memory market,
        MarketPrices memory prices,
        uint256 longTokenAmount,
        uint256 shortTokenAmount,
        address uiFeeReceiver
    ) external view returns (uint256);

    function getWithdrawalAmountOut(
        address dataStore,
        MarketProps memory market,
        MarketPrices memory prices,
        uint256 marketTokenAmount,
        address uiFeeReceiver
    ) external view returns (uint256, uint256);

    struct MarketPrices {
        PriceProps indexTokenPrice;
        PriceProps longTokenPrice;
        PriceProps shortTokenPrice;
    }

    struct PriceProps {
        uint256 min;
        uint256 max;
    }

    struct MarketProps {
        address marketToken;
        address indexToken;
        address longToken;
        address shortToken;
    }
}
