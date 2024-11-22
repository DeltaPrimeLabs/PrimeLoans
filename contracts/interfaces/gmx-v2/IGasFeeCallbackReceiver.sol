// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./EventUtils.sol";

// @title IGasFeeCallbackReceiver
// @dev interface for a gas fee callback contract
interface IGasFeeCallbackReceiver {
    function refundExecutionFee(bytes32 key, EventUtils.EventLogData memory eventData) external payable;
}
