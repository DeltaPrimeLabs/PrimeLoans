pragma solidity ^0.8.17;

interface IOwnershipFacet {
    function proposeOwnershipTransfer(address _newOwner) external;

    function acceptOwnership() external;

    function owner() external view returns (address owner_);

    function proposedOwner() external view returns (address proposedOwner_);

    function pauseAdmin() external view returns (address pauseAdmin);

    function proposedPauseAdmin() external view returns (address proposedPauseAdmin);
}
