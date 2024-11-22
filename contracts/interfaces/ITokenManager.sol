interface ITokenManager {
    struct poolAsset {
        bytes32 asset;
        address poolAddress;
    }

    struct Asset {
        bytes32 asset;
        address assetAddress;
        uint256 debtCoverage;
    }

    function activateToken ( address token ) external;
    function addPoolAssets ( poolAsset[] memory poolAssets ) external;
    function addTokenAssets ( Asset[] memory tokenAssets ) external;
    function deactivateToken ( address token ) external;
    function debtCoverage ( address ) external view returns ( uint256 );
    function getVPrimeControllerAddress ( ) external view returns ( address );
    function debtCoverageStaked ( bytes32 ) external view returns ( uint256 );
    function getAllPoolAssets (  ) external view returns ( bytes32[] memory result );
    function getAllTokenAssets (  ) external view returns ( bytes32[] memory result );
    function identifierToExposureGroup ( bytes32 _asset) external view returns ( bytes32 );
    function getAssetAddress ( bytes32 _asset, bool allowInactive ) external view returns ( address );
    function getPoolAddress ( bytes32 _asset ) external view returns ( address );
    function getSupportedTokensAddresses (  ) external view returns ( address[] memory);
    function initialize ( Asset[] memory tokenAssets, poolAsset[] memory poolAssets ) external;
    function increaseProtocolExposure ( bytes32 assetIdentifier, uint256 exposureIncrease ) external;
    function decreaseProtocolExposure(bytes32 assetIdentifier, uint256 exposureDecrease) external;
    function isTokenAssetActive ( address token ) external view returns ( bool );
    function owner (  ) external view returns ( address );
    function removePoolAssets ( bytes32[] memory _poolAssets ) external;
    function removeTokenAssets ( bytes32[] memory _tokenAssets ) external;
    function renounceOwnership (  ) external;
    function setDebtCoverage ( address token, uint256 coverage ) external;
    function setMaxProtocolsExposure (bytes32[] memory groupIdentifiers, uint256[] memory maxExposures) external;
    function setIdentifiersToExposureGroups (bytes32[] memory identifiers, bytes32[] memory exposureGroups) external;
    function setDebtCoverageStaked ( bytes32 stakedAsset, uint256 coverage ) external;
    function supportedTokensList ( uint256 ) external view returns ( address );
    function tokenAddressToSymbol ( address ) external view returns ( bytes32 );
    function tokenToStatus ( address ) external view returns ( uint256 );
    function transferOwnership ( address newOwner ) external;
    function increasePendingExposure ( bytes32 , address, uint256 ) external;
    function setPendingExposureToZero ( bytes32, address ) external;
}