// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

/**
 * @title DestructableContract
 * @dev For tests
 */
contract DestructableContract {
    fallback() external payable {
        //just receive funds
    }

    function destruct(address payable receiverOfFunds) public {
        selfdestruct(receiverOfFunds);
    }
}
