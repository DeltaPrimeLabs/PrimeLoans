// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IWombatMaster {
    struct UserInfo {
        uint128 amount;
        uint128 factor;
        uint128 rewardDebt;
        uint128 pendingWom;
    }

    function getAssetPid(address asset) external view returns (uint256);

    function boostedRewarders(uint256 pid) external view returns (address);

    function userInfo(
        uint256 pid,
        address user
    ) external view returns (UserInfo memory);

    function deposit(
        uint256 pid,
        uint256 amount
    ) external returns (uint256, uint256);

    function withdraw(
        uint256 pid,
        uint256 amount
    ) external returns (uint256 reward, uint256[] memory additionalRewards);

    function multiClaim(
        uint256[] calldata _pids
    )
        external
        returns (
            uint256 reward,
            uint256[] memory amounts,
            uint256[][] memory additionalRewards
        );

    function poolInfo(
        uint256 _pid
    )
        external
        view
        returns (
            address lpToken,
            uint96 allocPoint,
            address rewarder,
            uint256 sumOfFactors,
            uint104 accWomPerShare,
            uint104 accWomPerFactorShare,
            uint40 lastRewardTimestamp
        );

    function pendingTokens(
        uint256 _pid,
        address _user
    )
        external
        view
        returns (
            uint256 pendingRewards,
            address[] memory bonusTokenAddresses,
            string[] memory bonusTokenSymbols,
            uint256[] memory pendingBonusRewards
        );
}
