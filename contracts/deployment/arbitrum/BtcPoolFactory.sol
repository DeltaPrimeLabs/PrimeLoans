// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: de0a4e9ee653d2aade275c436805bb3217a8979d;
pragma solidity 0.8.17;

import "./BtcPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract BtcPoolFactory {
    function deployPool() public {
        BtcPool pool = new BtcPool();
        emit PoolDeployed(msg.sender, address(pool), block.timestamp);
    }

    /**
     * @dev emitted after pool is deployed by any user
     * @param user the address initiating the deployment
     * @param poolAddress of deployed pool
     * @param timestamp of the deployment
     **/
    event PoolDeployed(address user, address poolAddress, uint256 timestamp);
}