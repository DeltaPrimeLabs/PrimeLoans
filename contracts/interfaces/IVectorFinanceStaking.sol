// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./IVectorFinanceCompounder.sol";
import "./IVectorRewarder.sol";

interface IVectorFinanceStaking {
    function balance(address account) external view returns (uint256);

    function compounder() external view returns (IVectorFinanceCompounder);

    function withdraw(uint256 amount, uint256 minAmount) external;

    function deposit(uint256 amount) external;

    function decimals() external view returns (uint256);

    function earned(address rewardToken) external view returns (uint256);

    function masterVtx() external view returns (address);

    function stakingToken() external view returns (address);

    function rewarder() external view returns (IVectorRewarder);
}