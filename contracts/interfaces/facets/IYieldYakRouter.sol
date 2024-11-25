// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IYieldYakRouter {
    struct Trade {
        uint256 amountIn;
        uint256 amountOut;
        address[] path;
        address[] adapters;
    }

    struct FormattedOffer {
        uint256[] amounts;
        address[] adapters;
        address[] path;
    }

    function swapNoSplit(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external;

    // @notice Returns total number of registered adapters
    // @return Number of adapters
    function adaptersCount() external view returns (uint256);

    // @notice Returns adapter address at given index
    // @param index Position in the adapters array
    // @return Adapter contract address
    function ADAPTERS(uint256 index) external view returns (address);
}