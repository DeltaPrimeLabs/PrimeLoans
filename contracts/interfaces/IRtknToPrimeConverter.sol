// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";

interface IRtknToPrimeConverter {
    // Enums
    enum Phase { Phase1, Phase2 }

    // State variable getters
    function rTKN() external view returns (ERC20BurnableUpgradeable);

    function rRTKNMaxCap() external view returns (uint256);

    function currentPhase() external view returns (Phase);

    function userrTKNPledged(address user) external view returns (uint256);

    function userProcessed(address user) external view returns (bool);

    function users(uint256 index) external view returns (address);

    function totalrTKNPledged() external view returns (uint256);

    function totalAdjustedrTKNPledged() external view returns (uint256);

    function scalingFactor() external view returns (uint256);

    function currentBatchIndex() external view returns (uint256);

    // Functions
    function setRTKNMaxCap(uint256 _newMaxCap) external;

    function pledgerTKN(uint256 amount) external;

    function startPhase2() external;

    function processUsers(uint256 batchSize) external;

    function withdrawrTKN() external;

    function getTotalUsers() external view returns (uint256);

    function previewFuturePrimeAmountBasedOnPledgedAmountForUser(address user) external view returns (uint256);

    // Events
    event Pledged(address indexed user, uint256 amount);
    event PhaseStarted(Phase newPhase, uint256 scalingFactor);
    event UserProcessed(address indexed user, uint256 adjustedPledgedAmount, uint256 excessAmount);
    event Withdrawal(address indexed owner, uint256 amount);
    event MaxCapSet(uint256 prevMaxCap, uint256 newMaxCap);
    event Burned(uint256 amount);
}
