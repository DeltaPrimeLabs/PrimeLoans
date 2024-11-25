// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IYakWrapRouter {

    struct FormattedOffer {
        uint256[] amounts;
        address[] adapters;
        address[] path;
        uint256 gasEstimate;
    }

    function findBestPathAndWrap(
        uint256 amountIn,
        address tokenIn,
        address wrapper,
        uint256 maxSteps,
        uint256 gasPrice
    ) external view returns (FormattedOffer memory bestOffer);

    function unwrapAndFindBestPath(
        uint256 amountIn,
        address tokenOut,
        address wrapper,
        uint256 maxSteps,
        uint256 gasPrice
    ) external view returns (FormattedOffer memory bestOffer);
}