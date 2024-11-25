// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ac51526ea73cc486f4527cf20f228688d343110b;
pragma solidity 0.8.17;

import "./FraxPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract FraxPoolFactory {
    function deployPool() public {
        FraxPool pool = new FraxPool();
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