pragma solidity ^0.8.17;

interface ILTIPFacet {
    function getLTIPEligibleTVL() external view returns (uint256);
}
