// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "../ReentrancyGuardKeccak.sol";

contract AntiReentrantDiamondStorage is ReentrancyGuardKeccak {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    function antiReentrant() public nonReentrant {
        payable(msg.sender).safeTransferETH(100);
    }
}
