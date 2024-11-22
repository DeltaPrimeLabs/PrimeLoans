// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9be978eee452f5d0645f568d47e3ca96b1d7c8ef;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IVPrimeController.sol";
import "./SmartLoanLiquidationFacet.sol";
import "../interfaces/facets/IYieldYakRouter.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsOperationsFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address payable;
    using TransferHelper for address;

    address private constant PARA_TRANSFER_PROXY =
        0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER =
        0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
    * Removes an asset from the ownedAssets array
    * @param _asset asset to be removed
    * @param _address address of the asset
    **/
    function removeUnsupportedOwnedAsset(bytes32 _asset, address _address) external onlyWhitelistedLiquidators nonReentrant {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        // Check if the asset exists in the TokenManager
        require(tokenManager.tokenToStatus(_address) == 0, "Asset is still supported");
        require(tokenManager.tokenAddressToSymbol(_address) == bytes32(0), "Asset address to symbol not empty");
        require(tokenManager.debtCoverage(_address) == 0, "Asset still has debt coverage");
        require(tokenManager.identifierToExposureGroup(_asset) == bytes32(0), "Asset still has exposure group");

        bytes32[] memory allAssets = tokenManager.getAllTokenAssets();
        // Loop through all assets and check if the asset exists
        for (uint i = 0; i < allAssets.length; i++) {
            require(allAssets[i] != _asset, "Asset exists in TokenManager");
        }

        // Remove the asset from the ownedAssets array
        DiamondStorageLib.removeOwnedAsset(_asset);

        emit RemovedAsset(_asset, _address, block.timestamp);
    }

    function removeUnsupportedStakedPosition(bytes32 _identifier) external onlyWhitelistedLiquidators nonReentrant {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bool found = false;
        IStakingPositions.StakedPosition memory stakedPosition;
        for (uint i = 0; i < positions.length; i++) {
            if (positions[i].identifier == _identifier) {
                found = true;
                stakedPosition = positions[i];
                break;
            }
        }
        require(found, "Position not found");

        address _address = stakedPosition.asset;
        bytes32 _symbol = stakedPosition.symbol;

        // Check if the asset exists in the TokenManager
        require(tokenManager.tokenToStatus(_address) == 0, "Asset is still supported");
        require(tokenManager.tokenAddressToSymbol(_address) == bytes32(0), "Asset address to symbol not empty");
        require(tokenManager.debtCoverage(_address) == 0, "Asset still has debt coverage");
        require(tokenManager.identifierToExposureGroup(_symbol) == bytes32(0), "Asset still has exposure group");

        bytes32[] memory allAssets = tokenManager.getAllTokenAssets();
        // Loop through all assets and check if the asset exists
        for (uint i = 0; i < allAssets.length; i++) {
            require(allAssets[i] != _symbol, "Asset exists in TokenManager");
        }

        DiamondStorageLib.removeStakedPosition(_identifier);

        emit RemovedStakedPosition(_identifier, _address,_symbol, block.timestamp);
    }

    /**
    * Funds the loan with a specified amount of a defined token
    * @dev Requires approval for ERC20 token on frontend side
    * @param _fundedAsset asset to be funded
    * @param _amount to be funded
    **/
    function fund(bytes32 _fundedAsset, uint256 _amount) public virtual nonReentrant {
        IERC20Metadata token = getERC20TokenInstance(_fundedAsset, false);
        _amount = Math.min(_amount, token.balanceOf(msg.sender));

        address(token).safeTransferFrom(msg.sender, address(this), _amount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(token), _amount);

        emit Funded(msg.sender, _fundedAsset, _amount, block.timestamp);
    }

    function addOwnedAsset(bytes32 _asset, address _address) external onlyWhitelistedLiquidators nonReentrant{
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(tokenManager.isTokenAssetActive(_address), "Asset not supported");

        DiamondStorageLib.addOwnedAsset(_asset, _address);
    }

    function _processRepay(ITokenManager tokenManager, Pool fromAssetPool, address fromToken, uint256 repayAmount, uint256 receivedRepayTokenAmount) internal {
        fromToken.safeApprove(address(fromAssetPool), 0);
        fromToken.safeApprove(address(fromAssetPool), repayAmount);
        fromAssetPool.repay(repayAmount);

        if(receivedRepayTokenAmount > repayAmount) {
            _increaseExposure(tokenManager, fromToken, receivedRepayTokenAmount - repayAmount);
        }  else {
            _decreaseExposure(tokenManager, fromToken, repayAmount - receivedRepayTokenAmount);
        }
    }

    /**
    * Funds the loan with a specified amount of a GLP
    * @dev Requires approval for stakedGLP token on frontend side
    * @param _amount to be funded
    **/
    function fundGLP(uint256 _amount) public virtual nonReentrant {
        IERC20Metadata stakedGlpToken = IERC20Metadata(0xaE64d55a6f09E4263421737397D1fdFA71896a69);
        _amount = Math.min(_amount, stakedGlpToken.balanceOf(msg.sender));
        address(stakedGlpToken).safeTransferFrom(msg.sender, address(this), _amount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(stakedGlpToken), _amount);

        emit Funded(msg.sender, "GLP", _amount, block.timestamp);
    }

    /**
    * Withdraws an amount of a defined asset from the loan
    * This method could be used to cash out profits from investments
    * The loan needs to remain solvent after the withdrawal
    * @dev This function uses the redstone-evm-connector
    * @param _withdrawnAsset asset to be withdrawn
    * @param _amount to be withdrawn
    **/
    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) public virtual onlyOwner nonReentrant canRepayDebtFully remainsSolvent {
        IERC20Metadata token = getERC20TokenInstance(_withdrawnAsset, true);
        _amount = Math.min(_amount, token.balanceOf(address(this)));

        address(token).safeTransfer(msg.sender, _amount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        _decreaseExposure(tokenManager, address(token), _amount);
        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }

    /**
        * Withdraws specified amount of a GLP
        * @param _amount to be withdrawn
    **/
    function withdrawGLP(uint256 _amount) public virtual onlyOwner nonReentrant canRepayDebtFully remainsSolvent{
        IERC20Metadata token = getERC20TokenInstance("GLP", true);
        IERC20Metadata stakedGlpToken = IERC20Metadata(0xaE64d55a6f09E4263421737397D1fdFA71896a69);
        _amount = Math.min(token.balanceOf(address(this)), _amount);
        
        address(stakedGlpToken).safeTransfer(msg.sender, _amount);
        
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        _decreaseExposure(tokenManager, address(stakedGlpToken), _amount);
        emit Withdrawn(msg.sender, "GLP", _amount, block.timestamp);
    }

    /**
    * Borrows funds from the pool
    * @dev This function uses the redstone-evm-connector
    * @param _asset to be borrowed
    * @param _amount of funds to borrow
    **/
    function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent nonReentrant {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        ds._lastBorrowTimestamp = block.timestamp;

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool pool = Pool(tokenManager.getPoolAddress(_asset));
        pool.borrow(_amount);

        IERC20Metadata token = getERC20TokenInstance(_asset, false);
        _increaseExposure(tokenManager, address(token), _amount);

        notifyVPrimeController(DiamondStorageLib.contractOwner(), tokenManager);
        emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
    }

    /**
     * Repays funds to the pool
     * @dev This function uses the redstone-evm-connector
     * @param _asset to be repaid
     * @param _amount of funds to repay
     **/
    function repay(bytes32 _asset, uint256 _amount) public payable nonReentrant {
        IERC20Metadata token = getERC20TokenInstance(_asset, true);

        if (_isSolvent()) {
            DiamondStorageLib.enforceIsContractOwner();
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool pool = Pool(tokenManager.getPoolAddress(_asset));

        _amount = Math.min(_amount, token.balanceOf(address(this)));
        _amount = Math.min(_amount, pool.getBorrowed(address(this)));

        address(token).safeApprove(address(pool), 0);
        address(token).safeApprove(address(pool), _amount);

        pool.repay(_amount);

        _decreaseExposure(tokenManager, address(token), _amount);

        emit Repaid(msg.sender, _asset, _amount, block.timestamp);

        notifyVPrimeController(DiamondStorageLib.contractOwner(), tokenManager);
    }

    function withdrawUnsupportedToken(address token) external nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        // _NOT_SUPPORTED = 0
        require(tokenManager.tokenToStatus(token) == 0, "token supported");
        require(tokenManager.debtCoverage(token) == 0, "token debt coverage != 0");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "nothing to withdraw");
        token.safeTransfer(msg.sender, balance);

        emit WithdrawUnsupportedToken(msg.sender, token, balance, block.timestamp);
    }

    // TODO: Separate manager for unfreezing - not liquidators
    function unfreezeAccount() external onlyWhitelistedLiquidators {
        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    modifier onlyWhitelistedLiquidators() {
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted liquidators can execute this method");
        _;
    }

    /**
     * Swap existing debt to another debt
    * @dev This function uses the redstone-evm-connector
    * @dev _repayAmount and __borrowAmount can be used to control the slippage.
     * @param _fromAsset existing debt asset
     * @param _toAsset new debt asset
     * @param _repayAmount debt repay amount
     * @param _borrowAmount debt borrow amount
     * @param _path yield yak swap path
     * @param _adapters yield yak swap adapters
     */
    function swapDebt(bytes32 _fromAsset, bytes32 _toAsset, uint256 _repayAmount, uint256 _borrowAmount, address[] calldata _path, address[] calldata _adapters) external onlyOwner remainsSolvent nonReentrant {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool fromAssetPool = Pool(tokenManager.getPoolAddress(_fromAsset));
        _repayAmount = Math.min(_repayAmount, fromAssetPool.getBorrowed(address(this)));

        IERC20Metadata toToken = getERC20TokenInstance(_toAsset, false);
        IERC20Metadata fromToken = getERC20TokenInstance(_fromAsset, false);

        require(address(toToken) == _path[0], "Invalid token input");
        require(address(fromToken) == _path[_path.length - 1], "Invalid token input");

        Pool(tokenManager.getPoolAddress(_toAsset)).borrow(_borrowAmount);
        uint256 initialRepayTokenAmount = fromToken.balanceOf(address(this));

        {
            // swap toAsset to fromAsset
            address(toToken).safeApprove(YY_ROUTER(), 0);
            address(toToken).safeApprove(YY_ROUTER(), _borrowAmount);

            IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());

            IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
                amountIn: _borrowAmount,
                amountOut: _repayAmount,
                path: _path,
                adapters: _adapters
            });
        
            router.swapNoSplit(trade, address(this), 0);
        }

        _repayAmount = Math.min(_repayAmount, fromToken.balanceOf(address(this)));
        
        _processRepay(tokenManager, fromAssetPool, address(fromToken), _repayAmount, fromToken.balanceOf(address(this)) - initialRepayTokenAmount);

        emit DebtSwap(msg.sender, address(fromToken), address(toToken), _repayAmount, _borrowAmount, block.timestamp);
    }

    function swapDebtParaSwap(bytes32 _fromAsset, bytes32 _toAsset, uint256 _repayAmount, uint256 _borrowAmount, bytes4 selector, bytes memory data) external onlyOwnerOrInsolvent remainsSolvent nonReentrant {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool fromAssetPool = Pool(tokenManager.getPoolAddress(_fromAsset));
        _repayAmount = Math.min(_repayAmount, fromAssetPool.getBorrowed(address(this)));

        IERC20Metadata toToken = getERC20TokenInstance(_toAsset, false);
        IERC20Metadata fromToken = getERC20TokenInstance(_fromAsset, false);

        Pool toAssetPool = Pool(tokenManager.getPoolAddress(_toAsset));
        toAssetPool.borrow(_borrowAmount);

        uint256 initialRepayTokenAmount = fromToken.balanceOf(address(this));

        {
            
            // swap toAsset to fromAsset
            address(toToken).safeApprove(PARA_TRANSFER_PROXY, 0);
            address(toToken).safeApprove(PARA_TRANSFER_PROXY, _borrowAmount);

            (bool success, ) = PARA_ROUTER.call((abi.encodePacked(selector, data)));
            require(success, "Swap failed");

        }
        _repayAmount = Math.min(fromToken.balanceOf(address(this)), _repayAmount);

        _processRepay(tokenManager, fromAssetPool, address(fromToken), _repayAmount, fromToken.balanceOf(address(this)) - initialRepayTokenAmount);

        emit DebtSwap(msg.sender, address(fromToken), address(toToken), _repayAmount, _borrowAmount, block.timestamp);
    }

    function containsOracleCalldata() public view returns (bool) {
        // Checking if the calldata ends with the RedStone marker
        bool hasValidRedstoneMarker;
        assembly {
            let calldataLast32Bytes := calldataload(sub(calldatasize(), STANDARD_SLOT_BS))
            hasValidRedstoneMarker := eq(
                REDSTONE_MARKER_MASK,
                and(calldataLast32Bytes, REDSTONE_MARKER_MASK)
            )
        }
        return hasValidRedstoneMarker;
    }

    function getVPrimeControllerAddress(ITokenManager tokenManager) internal view returns (address) {
        if(address(tokenManager) != address(0)) {
            return tokenManager.getVPrimeControllerAddress();
        }
        return address(0);
    }

    function notifyVPrimeController(address account, ITokenManager tokenManager) internal {
        address vPrimeControllerAddress = getVPrimeControllerAddress(tokenManager);
        if(vPrimeControllerAddress != address(0)){
            if(containsOracleCalldata()) {
                proxyCalldata(
                    vPrimeControllerAddress,
                    abi.encodeWithSignature
                    ("updateVPrimeSnapshot(address)", account),
                    false
                );
            } else {
                IVPrimeController(vPrimeControllerAddress).setUserNeedsUpdate(account);
            }
        }
    }

    /* ======= VIEW FUNCTIONS ======*/

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) internal view returns (uint256) {
        IERC20 token = IERC20(DeploymentConstants.getTokenManager().getAssetAddress(_asset, true));
        return token.balanceOf(address(this));
    }

    function YY_ROUTER() internal virtual pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after an asset is removed
     * @param asset the asset that was removed
     * @param _address the address of the asset
     * @param timestamp time of removal
     **/
    event RemovedAsset(bytes32 indexed asset, address indexed _address, uint256 timestamp);

    /**
     * @dev emitted after a staked position is removed
     * @param identifier the identifier of the staked position
     * @param _address the address of the asset
     * @param timestamp time of removal
     **/
    event RemovedStakedPosition(bytes32 indexed identifier, address indexed _address, bytes32 indexed _symbol, uint256 timestamp);

    /**
     * @dev emitted after a debt swap
     * @param user the address which performed the debt swap
     * @param fromToken token that was repaid
     * @param toToken token that was borrowed
     * @param repayAmount the amount of fromToken that was repaid
     * @param borrowAmount the amount of toToken that was borrowed
     * @param timestamp time of debt swap
     **/
    event DebtSwap(address indexed user, address indexed fromToken, address indexed toToken, uint256 repayAmount, uint256 borrowAmount, uint256 timestamp);

    /**
     * @dev emitted after a loan is funded
     * @param user the address which funded the loan
     * @param asset funded by a user
     * @param amount the amount of funds
     * @param timestamp time of funding
     **/
    event Funded(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted after the funds are withdrawn from the loan
     * @param user the address which withdraws funds from the loan
     * @param asset withdrawn by a user
     * @param amount of funds withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawn(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are borrowed from the pool
     * @param user the address of borrower
     * @param asset borrowed by an= user
     * @param amount of the borrowed funds
     * @param timestamp time of the borrowing
     **/
    event Borrowed(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool
     * @param user the address initiating repayment
     * @param asset asset repaid by a user
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event Repaid(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when unsupported token is withdrawn
     * @param user the address withdrawing unsupported token
     * @param token the unsupported token address
     * @param amount of unsupported token withdrawn
     * @param timestamp of the withdraw
     **/
    event WithdrawUnsupportedToken(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
}