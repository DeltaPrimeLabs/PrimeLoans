pragma solidity ^0.8.17;

interface ISolvencyFacetProd {
    function getDebt() external view returns (uint256);

    function getFullLoanStatus() external view returns (uint256[5] memory);

    function getHealthRatio() external view returns (uint256);

    function getThresholdWeightedValue() external view returns (uint256);

    function getMaxDataTimestampDelay() external view returns (uint256);

    function getTotalValue() external view returns (uint256);

    function getTotalTraderJoeV2() external view returns (uint256);

    function isSignerAuthorized(address _receivedSigner) external view returns (bool);

    function isSolvent() external view returns (bool);

    function isTimestampValid(uint256 _receivedTimestamp) external view returns (bool);

    function getStakedValue() external view returns (uint256);
}
