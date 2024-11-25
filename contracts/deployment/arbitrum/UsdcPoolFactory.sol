// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./UsdcPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract UsdcPoolFactory {
    function deployPool() public {
        UsdcPool pool = new UsdcPool();
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