// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

interface IMasterPenpie {
    function allPendingTokens(
        address _stakingToken,
        address _user
    )
        external
        view
        returns (
            uint256 pendingPenpie,
            address[] memory bonusTokenAddresses,
            string[] memory bonusTokenSymbols,
            uint256[] memory pendingBonusRewards
        );

    function multiclaim(address[] calldata _stakingTokens) external;
}
