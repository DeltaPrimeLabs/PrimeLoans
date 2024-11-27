// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./GmxV2FacetCommon.sol";

abstract contract GmxV2PlusFacet is GmxV2FacetCommon {
    using TransferHelper for address;

    // Mappings
    function marketToToken(
        address market
    ) internal pure virtual returns (address);

    function _deposit(
        address gmToken,
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) internal nonReentrant noBorrowInTheSameBlock onlyOwner {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        address depositedToken = marketToToken(gmToken);
        tokenAmount = IERC20(depositedToken).balanceOf(address(this)) < tokenAmount
            ? IERC20(depositedToken).balanceOf(address(this))
            : tokenAmount;

        bytes[] memory data = new bytes[](4);
        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGmxV2DepositVault(),
            executionFee
        );
        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            depositedToken,
            getGmxV2DepositVault(),
            tokenAmount / 2
        );
        data[2] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            depositedToken,
            getGmxV2DepositVault(),
            tokenAmount / 2
        );
        data[3] = abi.encodeWithSelector(
            IDepositUtils.createDeposit.selector,
            IDepositUtils.CreateDepositParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: gmToken, //market
                initialLongToken: depositedToken, //initialLongToken
                initialShortToken: depositedToken, //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        depositedToken.safeApprove(getGmxV2Router(), 0);
        depositedToken.safeApprove(getGmxV2Router(), tokenAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{value: msg.value}(data);

        // Simulate solvency check
        {
            bytes32[] memory dataFeedIds = new bytes32[](2);
            dataFeedIds[0] = tokenManager.tokenAddressToSymbol(gmToken);
            dataFeedIds[1] = tokenManager.tokenAddressToSymbol(depositedToken);

            uint256 gmTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[0];
            uint256 depositTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[1];
            require(
                isWithinBounds(
                    (depositTokenUsdPrice * tokenAmount) /
                        10 ** IERC20Metadata(depositedToken).decimals(), // Deposit Amount In USD
                    (minGmAmount * gmTokenUsdPrice) /
                        10 ** IERC20Metadata(gmToken).decimals()
                ), // Output Amount In USD
                "Invalid min output value"
            );

            uint256 gmTokensWeightedUsdValue = (gmTokenUsdPrice *
                minGmAmount *
                tokenManager.debtCoverage(gmToken)) /
                (10 ** IERC20Metadata(gmToken).decimals() * 1e8);
            require(
                (_getThresholdWeightedValuePayable() + gmTokensWeightedUsdValue) >
                    _getDebtPayable(),
                "The action may cause the account to become insolvent"
            );
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        tokenManager.increasePendingExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            address(this),
            (minGmAmount * 1e18) / 10 ** IERC20Metadata(gmToken).decimals()
        );

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(depositedToken),
            (tokenAmount * 1e18) / 10 ** IERC20Metadata(depositedToken).decimals()
        );

        // Update owned assets
        if (IERC20Metadata(depositedToken).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(
                tokenManager.tokenAddressToSymbol(depositedToken)
            );
        }
    }

    function _withdraw(
        address gmToken,
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    )
        internal
        nonReentrant
        noBorrowInTheSameBlock
        onlyOwnerNoStaySolventOrInsolventPayable
    {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        gmAmount = IERC20(gmToken).balanceOf(address(this)) < gmAmount
            ? IERC20(gmToken).balanceOf(address(this))
            : gmAmount;

        bytes[] memory data = new bytes[](3);
        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGmxV2WithdrawalVault(),
            executionFee
        );

        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            gmToken,
            getGmxV2WithdrawalVault(),
            gmAmount
        );

        data[2] = abi.encodeWithSelector(
            IWithdrawalUtils.createWithdrawal.selector,
            IWithdrawalUtils.CreateWithdrawalParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: gmToken, //market
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minLongTokenAmount: minLongTokenAmount,
                minShortTokenAmount: minShortTokenAmount,
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        IERC20(gmToken).approve(getGmxV2Router(), gmAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{value: msg.value}(data);

        address longToken = marketToToken(gmToken);
        address shortToken = marketToToken(gmToken);

        // Simulate solvency check
        if (msg.sender == DiamondStorageLib.contractOwner()) {
            // Only owner can call this method or else it's liquidator when the account is already insolvent
            uint256[] memory tokenPrices;

            {
                bytes32[] memory tokenSymbols = new bytes32[](2);
                tokenSymbols[0] = tokenManager.tokenAddressToSymbol(shortToken); // Short token and long token is the same, hence we can reuse the price
                tokenSymbols[1] = tokenManager.tokenAddressToSymbol(gmToken);
                tokenPrices = getPrices(tokenSymbols);
            }
            require(
                isWithinBounds(
                    (tokenPrices[1] * gmAmount) /
                        10 ** IERC20Metadata(gmToken).decimals(), // Deposit Amount In USD
                    (tokenPrices[0] * minLongTokenAmount) /
                        10 ** IERC20Metadata(longToken).decimals() +
                        (tokenPrices[0] * minShortTokenAmount) /
                        10 ** IERC20Metadata(shortToken).decimals()
                ), // Output Amount In USD
                "Invalid min output value"
            );

            uint256 receivedTokensWeightedUsdValue = (((tokenPrices[0] *
                minLongTokenAmount *
                tokenManager.debtCoverage(longToken)) /
                10 ** IERC20Metadata(longToken).decimals()) +
                ((tokenPrices[0] *
                    minShortTokenAmount *
                    tokenManager.debtCoverage(shortToken)) /
                    10 ** IERC20Metadata(shortToken).decimals())) / 1e8;
            require(
                (_getThresholdWeightedValuePayable() + receivedTokensWeightedUsdValue) >
                    _getDebtPayable(),
                "The action may cause the account to become insolvent"
            );
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        tokenManager.increasePendingExposure(
            tokenManager.tokenAddressToSymbol(longToken),
            address(this),
            (minLongTokenAmount * 1e18) / 10 ** IERC20Metadata(longToken).decimals()
        );
        tokenManager.increasePendingExposure(
            tokenManager.tokenAddressToSymbol(shortToken),
            address(this),
            (minShortTokenAmount * 1e18) / 10 ** IERC20Metadata(shortToken).decimals()
        );

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            (gmAmount * 1e18) / 10 ** IERC20Metadata(gmToken).decimals()
        );

        // Remove GM token from owned assets if whole balance was used
        if (IERC20Metadata(gmToken).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(
                tokenManager.tokenAddressToSymbol(gmToken)
            );
        }
    }
}
