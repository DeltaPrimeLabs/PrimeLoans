// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: cb1fa840386b7a38a8711e20dbc566c5b3a700d7;
pragma solidity 0.8.17;

import "./lib/Bytes32EnumerableMap.sol";
import "./interfaces/IBorrowersRegistry.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./lib/local/DeploymentConstants.sol";

contract TokenManager is OwnableUpgradeable {
    /**
     * For adding supported assets
     **/
    struct Asset {
        bytes32 asset;
        address assetAddress;
        uint256 debtCoverage;
    }

    /**
     * For adding supported lending pools
     **/
    struct poolAsset {
        bytes32 asset;
        address poolAddress;
    }

    struct Exposure {
        uint256 current;
        uint256 max; // Setting max to 0 means no exposure limitations.
    }

    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;

    uint256 private constant _NOT_SUPPORTED = 0;
    uint256 private constant _INACTIVE = 1;
    uint256 private constant _ACTIVE = 2;

    // Stores an asset's bytes32 symbol representation to pool's address mapping
    EnumerableMap.Bytes32ToAddressMap private assetToPoolAddress;
    // Stores an asset's bytes32 symbol representation to asset's address mapping
    EnumerableMap.Bytes32ToAddressMap private assetToTokenAddress;
    mapping(address => bytes32) public tokenAddressToSymbol;
    mapping(address => uint256) private tokenPositionInList;
    // used for defining different leverage ratios for tokens
    mapping(address => uint256) public debtCoverage;
    address[] public supportedTokensList;

    mapping(address => uint256) public tokenToStatus;
    // used for defining different leverage ratios for staked assets
    mapping(bytes32 => uint256) public debtCoverageStaked;

    mapping(bytes32 => bytes32) public identifierToExposureGroup;
    mapping(bytes32 => Exposure) public groupToExposure;

    mapping(address => mapping(bytes32 => uint256)) public pendingUserExposure;
    mapping(bytes32 => uint256) public pendingProtocolExposure;

    address public vPrimeControllerAddress;

    /**
    * Returns the address of the vPrimeController contract
     */
    function getVPrimeControllerAddress() public view returns (address) {
        return vPrimeControllerAddress;
    }

    /**
    * Sets the address of the vPrimeController contract
     */
    function setVPrimeControllerAddress(address _vPrimeControllerAddress) public onlyOwner {
        vPrimeControllerAddress = _vPrimeControllerAddress;
    }

    function initialize(Asset[] memory tokenAssets, poolAsset[] memory poolAssets) external initializer {
        __Ownable_init();

        addTokenAssets(tokenAssets);
        addPoolAssets(poolAssets);
    }

    function getAllPoolAssets() public view returns (bytes32[] memory result) {
        return assetToPoolAddress._inner._keys._inner._values;
    }

    function getSupportedTokensAddresses() public view returns (address[] memory) {
        return supportedTokensList;
    }

    function getAllTokenAssets() public view returns (bytes32[] memory result) {
        return assetToTokenAddress._inner._keys._inner._values;
    }

    /**
    * Returns address of an asset
    **/
    function getAssetAddress(bytes32 _asset, bool allowInactive) public view returns (address) {
        (, address assetAddress) = assetToTokenAddress.tryGet(_asset);
        require(assetAddress != address(0), "Asset not supported.");
        if (!allowInactive) {
            require(tokenToStatus[assetAddress] == _ACTIVE, "Asset inactive");
        }

        return assetAddress;
    }

    /**
    * Returns address of an asset's lending pool
    **/
    function getPoolAddress(bytes32 _asset) public view returns (address) {
        (, address assetAddress) = assetToPoolAddress.tryGet(_asset);
        require(assetAddress != address(0), "Pool asset not supported.");

        return assetAddress;
    }

    function increaseProtocolExposure(bytes32 assetIdentifier, uint256 exposureIncrease) public onlyPrimeAccountOrOwner {
        bytes32 group = identifierToExposureGroup[assetIdentifier];
        if(group != ""){
            Exposure storage exposure = groupToExposure[group];
            if(exposure.max != 0){
                exposure.current += exposureIncrease;
                require(exposure.current <= exposure.max, "Max asset exposure breached");
                emit ProtocolExposureChanged(msg.sender, group, exposure.current, block.timestamp);
            }
        }
    }

    function decreaseProtocolExposure(bytes32 assetIdentifier, uint256 exposureDecrease) public onlyPrimeAccountOrOwner {
        bytes32 group = identifierToExposureGroup[assetIdentifier];
        if(group != ""){
            Exposure storage exposure = groupToExposure[group];
            if(exposure.max != 0){
                exposure.current = exposure.current <= exposureDecrease ? 0 : exposure.current - exposureDecrease;
                emit ProtocolExposureChanged(msg.sender, group, exposure.current, block.timestamp);
            }
        }
    }

    function setCurrentProtocolExposure(bytes32[] memory groupIdentifiers, uint256[] memory currentExposures) external onlyOwner {
        require(groupIdentifiers.length == currentExposures.length, "Arrays lengths mismatch");
        for (uint256 i = 0; i < groupIdentifiers.length; i++) {
            _setCurrentProtocolExposure(groupIdentifiers[i], currentExposures[i]);
        }
    }

    function setMaxProtocolsExposure(bytes32[] memory groupIdentifiers, uint256[] memory maxExposures) public onlyOwner {
        require(groupIdentifiers.length == maxExposures.length, "Arrays lengths mismatch");
        for (uint256 i = 0; i < groupIdentifiers.length; i++) {
            _setMaxProtocolExposure(groupIdentifiers[i], maxExposures[i]);
        }
    }

    function _setMaxProtocolExposure(bytes32 groupIdentifier, uint256 maxExposure) internal {
        require(groupIdentifier != "", "Cannot set an empty string asset.");
        uint256 prevExposure = groupToExposure[groupIdentifier].max;
        groupToExposure[groupIdentifier].max = maxExposure;

        emit ProtocolExposureSet(msg.sender, groupIdentifier, prevExposure, maxExposure, groupToExposure[groupIdentifier].current , block.timestamp);
    }

    function _setCurrentProtocolExposure(bytes32 groupIdentifier, uint256 currentExposure) internal {
        require(groupIdentifier != "", "Cannot set an empty string asset.");
        uint256 prevExposure = groupToExposure[groupIdentifier].current;
        groupToExposure[groupIdentifier].current = currentExposure;

        emit ProtocolCurrentExposureSet(msg.sender, groupIdentifier, prevExposure, currentExposure, block.timestamp);
    }

    function setIdentifiersToExposureGroups(bytes32[] memory identifiers, bytes32[] memory exposureGroups) public onlyOwner {
        require(identifiers.length == exposureGroups.length, "Arrays lengths mismatch");
        for(uint i=0; i<identifiers.length; i++){
            identifierToExposureGroup[identifiers[i]] = exposureGroups[i];
            emit IdentifierToExposureGroupSet(msg.sender, identifiers[i], exposureGroups[i], block.timestamp);
        }

    }

    function addPoolAssets(poolAsset[] memory poolAssets) public onlyOwner {
        for (uint256 i = 0; i < poolAssets.length; i++) {
            _addPoolAsset(poolAssets[i].asset, poolAssets[i].poolAddress);
        }
    }

    function _addPoolAsset(bytes32 _asset, address _poolAddress) internal {
        require(Address.isContract(_poolAddress), "TokenManager: Pool must be a contract");
        require(!assetToPoolAddress.contains(_asset), "Asset's pool already exists");
        assetToPoolAddress.set(_asset, _poolAddress);
        emit PoolAssetAdded(msg.sender, _asset, _poolAddress, block.timestamp);
    }

    function addTokenAssets(Asset[] memory tokenAssets) public onlyOwner {
        for (uint256 i = 0; i < tokenAssets.length; i++) {
            _addTokenAsset(tokenAssets[i].asset, tokenAssets[i].assetAddress, tokenAssets[i].debtCoverage);
        }
    }

    function isTokenAssetActive(address token) external view returns(bool) {
        return tokenToStatus[token] == _ACTIVE;
    }

    function activateToken(address token) public onlyOwner {
        require(tokenToStatus[token] == _INACTIVE, "Must be inactive");
        tokenToStatus[token] = _ACTIVE;
        emit TokenAssetActivated(msg.sender, token, block.timestamp);
    }

    function deactivateToken(address token) public onlyOwner {
        require(tokenToStatus[token] == _ACTIVE, "Must be active");
        tokenToStatus[token] = _INACTIVE;
        emit TokenAssetDeactivated(msg.sender, token, block.timestamp);
    }

    function _addTokenAsset(bytes32 _asset, address _tokenAddress, uint256 _debtCoverage) internal {
        require(_asset != "", "Cannot set an empty string asset.");
        require(_tokenAddress != address(0), "Cannot set an empty address.");
        require(!assetToTokenAddress.contains(_asset), "Asset's token already exists");
        require(tokenAddressToSymbol[_tokenAddress] == 0, "Asset address is already in use");
        setDebtCoverage(_tokenAddress, _debtCoverage);

        assetToTokenAddress.set(_asset, _tokenAddress);
        tokenAddressToSymbol[_tokenAddress] = _asset;
        tokenToStatus[_tokenAddress] = _ACTIVE;

        supportedTokensList.push(_tokenAddress);
        tokenPositionInList[_tokenAddress] = supportedTokensList.length - 1;

        emit TokenAssetAdded(msg.sender, _asset, _tokenAddress, block.timestamp);
    }

    function _removeTokenFromList(address tokenToRemove) internal {
        // Move last address token to the `tokenToRemoveIndex` position (index of an asset that is being removed) in the address[] supportedTokensList
        // and update map(address=>uint256) tokenPostitionInList if the token is not already the last element
        uint256 tokenToRemoveIndex = tokenPositionInList[tokenToRemove];
        require(tokenToRemoveIndex < supportedTokensList.length, "Index out of range");
        if (tokenToRemoveIndex == 0 && supportedTokensList[0] != tokenToRemove) {
            revert("Token does not exist");
        }
        if (tokenToRemoveIndex != (supportedTokensList.length - 1)) {
            address currentLastToken = supportedTokensList[supportedTokensList.length - 1];
            tokenPositionInList[currentLastToken] = tokenToRemoveIndex;
            supportedTokensList[tokenToRemoveIndex] = currentLastToken;
        }
        // Remove last element - that is either the token that is being removed (if was already at the end)
        // or some other asset that at this point was already copied to the `index` positon
        supportedTokensList.pop();
        tokenPositionInList[tokenToRemove] = 0;
    }

    function removeTokenAssets(bytes32[] memory _tokenAssets) public onlyOwner {
        for (uint256 i = 0; i < _tokenAssets.length; i++) {
            _removeTokenAsset(_tokenAssets[i]);
        }
    }

    function _removeTokenAsset(bytes32 _tokenAsset) internal {
        address tokenAddress = getAssetAddress(_tokenAsset, true);
        EnumerableMap.remove(assetToTokenAddress, _tokenAsset);
        tokenAddressToSymbol[tokenAddress] = 0;
        tokenToStatus[tokenAddress] = _NOT_SUPPORTED;
        debtCoverage[tokenAddress] = 0;
        _removeTokenFromList(tokenAddress);
        emit TokenAssetRemoved(msg.sender, _tokenAsset, block.timestamp);
    }

    function removePoolAssets(bytes32[] memory _poolAssets) public onlyOwner {
        for (uint256 i = 0; i < _poolAssets.length; i++) {
            _removePoolAsset(_poolAssets[i]);
        }
    }

    function _removePoolAsset(bytes32 _poolAsset) internal {
        address poolAddress = getPoolAddress(_poolAsset);
        EnumerableMap.remove(assetToPoolAddress, _poolAsset);
        emit PoolAssetRemoved(msg.sender, _poolAsset, poolAddress, block.timestamp);
    }

    function setDebtCoverage(address token, uint256 coverage) public onlyOwner {
        //LTV must be lower than 5
        require(coverage <= 0.833333333333333333e18, 'Debt coverage higher than maximum acceptable');
        debtCoverage[token] = coverage;
    }

    function setDebtCoverageStaked(bytes32 stakedAsset, uint256 coverage) public onlyOwner {
        //LTV must be lower than 5
        require(coverage <= 0.833333333333333333e18, 'Debt coverage higher than maximum acceptable');
        debtCoverageStaked[stakedAsset] = coverage;
    }

    function isExposureAvailable(bytes32 assetIdentifier) internal view returns(bool) {
        bytes32 group = identifierToExposureGroup[assetIdentifier];
        if(group != ""){
            Exposure memory exposure = groupToExposure[group];
            if(exposure.max != 0){
                if(exposure.max <= exposure.current + pendingProtocolExposure[assetIdentifier]) {
                    return false;
                }
            }
        }
        return true;
    }

    function increasePendingExposure(bytes32 assetIdentifier, address user, uint256 amount) public onlyPrimeAccountOrOwner {
        pendingUserExposure[user][assetIdentifier] += amount;
        pendingProtocolExposure[assetIdentifier] += amount;
        
        require(isExposureAvailable(assetIdentifier), "Lack of Exposure");
    }

    function setPendingExposureToZero(bytes32 assetIdentifier, address user) public onlyPrimeAccountOrOwner {
        uint256 pending = pendingUserExposure[user][assetIdentifier];
        if(pending > 0) {
            pendingProtocolExposure[assetIdentifier] -= pending;
            pendingUserExposure[user][assetIdentifier] = 0;
        }
    }

    function getSmartLoansFactoryAddress() public view virtual returns (address) {
        return DeploymentConstants.getSmartLoansFactoryAddress();
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    function renounceOwnership() public virtual override {}

    /* ========== MODIFIERS ========== */

    modifier onlyPrimeAccountOrOwner() {
        IBorrowersRegistry borrowersRegistry = IBorrowersRegistry(getSmartLoansFactoryAddress());
        require(borrowersRegistry.canBorrow(msg.sender) || owner() == _msgSender(), "Only PrimeAccount or owner can change protocol exposure");
        _;
    }

    /**
     * @dev emitted after changing current protocol exposure
     * @param performer an address of the wallet changing the exposure
     * @param identifier group identifier
     * @param newExposure new current protocol exposure
     * @param timestamp time of associating identifier with a exposure group
     **/
    event ProtocolExposureChanged(address indexed performer, bytes32 indexed identifier, uint256 newExposure, uint256 timestamp);


    /**
     * @dev emitted after associating identifier with a exposure group
     * @param performer an address of the wallet setting max exposure
     * @param identifier asset identifier
     * @param exposureGroup exposure group identifier
     * @param timestamp time of associating identifier with a exposure group
     **/
    event IdentifierToExposureGroupSet(address indexed performer, bytes32 indexed identifier, bytes32 indexed exposureGroup, uint256 timestamp);

    /**
     * @dev emitted after setting max exposure for a given protocol.
     * @param performer an address of the wallet setting max exposure
     * @param groupIdentifier exposure group identifier
     * @param prevMaxExposure previous max protocol exposure
     * @param newMaxExposure new max protocol exposure
     * @param currentExposure current protocol exposure
     * @param timestamp time of setting max exposure
     **/
    event ProtocolExposureSet(address indexed performer, bytes32 indexed groupIdentifier, uint256 prevMaxExposure, uint256 newMaxExposure, uint256 currentExposure, uint256 timestamp);


    /**
         * @dev emitted after setting max exposure for a given protocol.
     * @param performer an address of the wallet setting max exposure
     * @param groupIdentifier exposure group identifier
     * @param prevCurrentExposure previous max protocol exposure
     * @param newCurrentExposure new max protocol exposure
     * @param timestamp time of setting max exposure
     **/
    event ProtocolCurrentExposureSet(address indexed performer, bytes32 indexed groupIdentifier, uint256 prevCurrentExposure, uint256 newCurrentExposure, uint256 timestamp);



    /**
     * @dev emitted after adding a token asset
     * @param performer an address of the wallet adding a token asset
     * @param tokenAsset token asset
     * @param assetAddress an address of the token asset
     * @param timestamp time of adding a token asset
     **/
    event TokenAssetAdded(address indexed performer, bytes32 indexed tokenAsset, address assetAddress, uint256 timestamp);

    /**
     * @dev emitted after activating a token asset
     * @param performer an address of the wallet activating a token asset
     * @param assetAddress an address of the token asset
     * @param timestamp time of activating a token asset
     **/
    event TokenAssetActivated(address indexed performer, address assetAddress, uint256 timestamp);

    /**
     * @dev emitted after deactivating a token asset
     * @param performer an address of the wallet deactivating a token asset
     * @param assetAddress an address of the token asset
     * @param timestamp time of deactivating a token asset
     **/
    event TokenAssetDeactivated(address indexed performer, address assetAddress, uint256 timestamp);

    /**
     * @dev emitted after removing a token asset
     * @param performer an address of the wallet removing a token asset
     * @param tokenAsset token asset
     * @param timestamp time a token asset removal
     **/
    event TokenAssetRemoved(address indexed performer, bytes32 indexed tokenAsset, uint256 timestamp);

    /**
     * @dev emitted after adding a pool asset
     * @param performer an address of wallet adding the pool asset
     * @param poolAsset pool asset
     * @param poolAddress an address of the pool asset
     * @param timestamp time of the pool asset addition
     **/
    event PoolAssetAdded(address indexed performer, bytes32 indexed poolAsset, address poolAddress, uint256 timestamp);

    /**
     * @dev emitted after removing a pool asset
     * @param performer an address of wallet removing the pool asset
     * @param poolAsset pool asset
     * @param poolAddress an address of the pool asset
     * @param timestamp time of a pool asset removal
     **/
    event PoolAssetRemoved(address indexed performer, bytes32 indexed poolAsset, address poolAddress, uint256 timestamp);
}
