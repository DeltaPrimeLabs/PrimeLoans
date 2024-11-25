// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "./AntiReentrantDiamondStorage.sol";

contract ReentrantAttack {

    uint256 callCounter = 0;
    uint256 targetCallCount = 1;

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {
        if (callCounter < targetCallCount) {
            callCounter += 1;
            AntiReentrantDiamondStorage(payable(msg.sender)).antiReentrant();
        } else {
            callCounter = 0;
        }
    }

    function changeTargetCallCount(uint256 _newCount) public {
        targetCallCount = _newCount;
    }

    function callAntiReentrant(address payable _antiReentrant) external {
        callCounter += 1;
        AntiReentrantDiamondStorage(_antiReentrant).antiReentrant();
    }
}
