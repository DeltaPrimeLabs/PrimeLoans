// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

library ParaSwapLib {
    struct SimpleData {
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address[] callees;
        bytes exchangeData;
        uint256[] startIndexes;
        uint256[] values;
        address payable beneficiary;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    struct Route {
        uint256 index; //Adapter at which index needs to be used
        address targetExchange;
        uint256 percent;
        bytes payload;
        uint256 networkFee; //NOT USED - Network fee is associated with 0xv3 trades
    }

    struct Adapter {
        address payable adapter;
        uint256 percent;
        uint256 networkFee; //NOT USED
        Route[] route;
    }

    struct Path {
        address to;
        uint256 totalNetworkFee; //NOT USED - Network fee is associated with 0xv3 trades
        Adapter[] adapters;
    }

    struct SellData {
        address fromToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address payable beneficiary;
        Path[] path;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    struct DirectUniV3 {
        address fromToken;
        address toToken;
        address exchange;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        uint256 feePercent;
        uint256 deadline;
        address payable partner;
        bool isApproved;
        address payable beneficiary;
        bytes path;
        bytes permit;
        bytes16 uuid;
    }

    bytes4 private constant SIMPLESWAP_SELECTOR = 0x54e3f31b;
    bytes4 private constant MULTISWAP_SELECTOR = 0xa94e78ef;
    bytes4 private constant DIRECT_UNIV3_SELECTOR = 0xa6886da9;

    function extractTokensAndAmount(bytes4 selector, bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        if (selector == SIMPLESWAP_SELECTOR) {
            return getSimpleSwapData(data);
        } else if (selector == MULTISWAP_SELECTOR) {
            return getMultiSwapData(data);
        } else if (selector == DIRECT_UNIV3_SELECTOR) {
            return getDirectUniV3SwapData(data);
        } else {
            revert ("Unknown Selector");
        }
    }

    function getSimpleSwapData(bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        SimpleData memory simpleData = abi.decode(data, (SimpleData));
        (fromToken, toToken, fromAmount) = (simpleData.fromToken, simpleData.toToken, simpleData.fromAmount);
    }

    function getMultiSwapData(bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        SellData memory sellData = abi.decode(data, (SellData));
        toToken = sellData.path[sellData.path.length - 1].to;
        (fromToken, fromAmount) = (sellData.fromToken, sellData.fromAmount);
    }

    function getDirectUniV3SwapData(bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        DirectUniV3 memory directData = abi.decode(data, (DirectUniV3));
        (fromToken, toToken, fromAmount) = (directData.fromToken, directData.toToken, directData.fromAmount);
    }
}
