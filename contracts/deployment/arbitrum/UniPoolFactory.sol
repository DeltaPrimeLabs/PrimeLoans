// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 67471c167ea4dcee4590ca5d8289a47373be90e3;
pragma solidity 0.8.17;

import "./UniPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract UniPoolFactory {
    function deployPool() public {
        UniPool pool = new UniPool();
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