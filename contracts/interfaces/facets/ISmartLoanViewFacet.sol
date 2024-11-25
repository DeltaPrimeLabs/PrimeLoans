pragma solidity ^0.8.17;

import "../../facets/SmartLoanViewFacet.sol";

interface ISmartLoanViewFacet {
    function getAllAssetsBalances() external view returns (SmartLoanViewFacet.AssetNameBalance[] memory);

    function getAllAssetsBalancesDebtCoverages() external view returns (SmartLoanViewFacet.AssetNameBalanceDebtCoverage[] memory);

    function getDebts() external view returns (SmartLoanViewFacet.AssetNameDebt[] memory);

    function getAllAssetsPrices() external view returns (SmartLoanViewFacet.AssetNamePrice[] memory);

    function getAllOwnedAssets() external view returns (bytes32[] memory result);

    function getTotalAssetsValue() external view returns (uint256);

    function getSupportedTokensAddresses() external view returns (address[] memory result);

    function getBalance(bytes32 _asset) external view returns (uint256);

    function getPercentagePrecision() external view returns (uint256);

    function getContractOwner() external view returns (address _owner);

    function getProposedOwner() external view returns (address _proposed);

    function getStakedPositions() external view returns (IStakingPositions.StakedPosition[] memory  _positions);

    function initialize(address owner) external;
}
