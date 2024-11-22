// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IVectorFinanceMainStaking {
    struct PoolInfo {
        uint256 pid;
        bool isActive;
        address token;
        address lp;
        uint256 sizeLp;
        address receipt;
        uint256 size;
        address rewards_addr;
        address helper;
    }

    function getPoolInfo(address _address)
    external
    view
    returns (PoolInfo memory);
}