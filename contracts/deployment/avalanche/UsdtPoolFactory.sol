// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9f1e1bba11316303810f35a4440e20bc5ad0ef86;
pragma solidity 0.8.17;

import "./UsdtPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract UsdtPoolFactory {
    function deployPool() public {
        UsdtPool pool = new UsdtPool();
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