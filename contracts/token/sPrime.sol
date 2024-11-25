// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: aca0d66772607a851d7017b5cb3e6f38ee11f918;

pragma solidity ^0.8.17;

// Importing necessary libraries and interfaces
import "../interfaces/joe-v2/ILBRouter.sol";
import "../interfaces/joe-v2/ILBHooksBaseRewarder.sol";
import "../interfaces/ISPrimeTraderJoe.sol";
import "../interfaces/IVPrimeController.sol";
import "../lib/uniswap-v3/FullMath.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "../lib/joe-v2/PriceHelper.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";

// SPrime contract declaration
contract SPrime is ISPrimeTraderJoe, ReentrancyGuardUpgradeable, PendingOwnableUpgradeable, ERC20Upgradeable, ProxyConnector {
    using SafeERC20 for IERC20Metadata; // Using SafeERC20 for IERC20Metadata for safe token transfers
    using PackedUint128Math for bytes32;

    // Constants declaration
    uint256 private constant _REBALANCE_MARGIN = 500;
    uint256 private constant _DENOMINATOR = 10000;
    uint256 private constant _MAX_SLIPPAGE = 500;
    uint16 internal constant DEFAULT_BIN_STEP = 50;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    // Mapping for storing pair information and user shares
    mapping(address => LockDetails[]) public locks;

    // Immutable variables for storing token and pair information
    IERC20Metadata public tokenX;
    IERC20Metadata public tokenY;
    uint8 public tokenXDecimals;
    uint8 public tokenYDecimals;
    ILBPair public lbPair;
    IPositionManager public positionManager;
    IVPrimeController public vPrimeController;
    address public traderJoeV2Router;

    // Arrays for storing deltaIds and distributions
    DepositForm[] private depositForm;

    address public operator;
    ILBHooksBaseRewarder public baseRewarder;

    address private implementation;

    constructor() {
        _disableInitializers();
    }

    /**
    * @dev initialize of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param depositForm_ Pre-defined distributions and delta ids
    * @param positionManager_ Position Manager contract for sPrime
    * @param traderJoeV2Router_ Trader Joe V2 Router Address
    */
    function initialize(address tokenX_, address tokenY_, string memory name_, DepositForm[] calldata depositForm_, IPositionManager positionManager_, address traderJoeV2Router_) external initializer {
        __PendingOwnable_init();
        __ReentrancyGuard_init();
        __ERC20_init(name_, "sPrime");

        traderJoeV2Router = traderJoeV2Router_;
        ILBFactory lbFactory = ILBRouter(traderJoeV2Router).getFactory();
        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(IERC20(tokenX_), IERC20(tokenY_), DEFAULT_BIN_STEP);

        lbPair = pairInfo.LBPair;
        tokenX = IERC20Metadata(address(lbPair.getTokenX()));
        tokenY = IERC20Metadata(address(lbPair.getTokenY()));

        tokenXDecimals = tokenX.decimals();
        tokenYDecimals = tokenY.decimals();

        for(uint256 i = 0 ; i < depositForm_.length ; i ++) {
            depositForm.push(depositForm_[i]);
        }

        positionManager = positionManager_;
    }

    modifier onlyOperator() {
        if (_msgSender() != operator) {
            revert Unauthorized();
        }
        _;
    }

    function setVPrimeControllerAddress(IVPrimeController _vPrimeController) public onlyOwner {
        vPrimeController = _vPrimeController;
    }

    function setOperator(
        address _operator
    ) public onlyOwner {
        operator = _operator;
    }

    function setBaseRewarder(
        ILBHooksBaseRewarder _baseRewarder
    ) public onlyOwner {
        baseRewarder = _baseRewarder;
    }

    function setImplementation(
        address _implementation
    ) public onlyOwner {
        implementation = _implementation;
    }

    /** Public View Functions */

    function getLBPair() public view returns (ILBPair) {
        return lbPair;
    }

    function getTokenX() public view returns (IERC20) {
        return tokenX;
    }

    function getTokenY() public view returns (IERC20) {
        return tokenY;
    }

    /**
     * @dev Check if the active id is in the user position range
     * @param user User Address.
     * @return status bin status
     */
    function binInRange(address user) public view returns(bool status) {
        uint256 tokenId = getUserTokenId(user);
        if (tokenId == 0) {
            revert NoPosition();
        }
        (bool success, bytes memory result) = implementation.staticcall(abi.encodeWithSignature("binInRange(uint256)", tokenId));
        if (!success)  {
            revert ProxyCallFailed();
        }
        status = abi.decode(result, (bool));
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @param poolPrice Pool Price or oracle price for calculating proper token amount
     * @return Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(address user, uint256 poolPrice) public view returns (uint256) {
        (,,,,uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(getUserTokenId(user));
        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
        
        if (depositConfig.depositIds.length != liquidityMinted.length) {
            revert LengthMismatch();
        }

        uint256 amountX = 0;
        uint256 amountY = 0;
        (bool success, bytes memory result) = implementation.staticcall(abi.encodeWithSignature("getLiquidityTokenAmounts(uint256[],uint256[],uint256)", depositConfig.depositIds, liquidityMinted, poolPrice));
        
        if (!success)  {
            revert ProxyCallFailed();
        }

        (amountX, amountY) = abi.decode(result, (uint256, uint256));

        amountY = amountY + FullMath.mulDiv(amountX, poolPrice * 10 ** tokenYDecimals, 10 ** (8 + tokenXDecimals));

        return amountY;
    }
    
    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @return Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(address user) external view returns (uint256) {
        uint256 poolPrice = getPoolPrice();
        return getUserValueInTokenY(user, poolPrice);
    }

    
    /**
    * @dev Returns the fully vested locked balance for an account.
    * @dev Full business logic description can be found in Pool::getFullyVestedLockedBalance() docstring
    * @param account The address of the account.
    * @return fullyVestedBalance Fully vested locked balance
    */
    function getFullyVestedLockedBalance(address account) public view returns (uint256 fullyVestedBalance) {
        uint256 length = locks[account].length;
        for (uint256 i; i != length; ++i) {
            LockDetails memory lock = locks[account][i];
            if (lock.unlockTime > block.timestamp) {
                fullyVestedBalance += FullMath.mulDiv(lock.amount, lock.lockPeriod, MAX_LOCK_TIME);
            }
        }
    }

    /**
    * @dev Returns the total locked balance of an account.
    * @param account The address of the account.
    * @return The total locked balance of the account.
    */
    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance;
        uint256 length = locks[account].length;
        for (uint256 i; i != length; ++i) {
            LockDetails memory lock = locks[account][i];
            if (lock.unlockTime > block.timestamp) {
                lockedBalance += lock.amount;
            }
        }
        return lockedBalance;
    }

    /**
    * @dev Returns the token id for the user
    * @param user The user address
    * @return tokenId token id owned by the user
    */
    function getUserTokenId(address user) public view returns(uint256 tokenId){
        if(positionManager.balanceOf(user) > 0) {
            tokenId = positionManager.tokenOfOwnerByIndex(user, 0);
        }
    }

    /** Internal Functions */

    /**
     * @dev Returns the total weight of tokens in a liquidity pair.
     * @param amountX Token X Amount.
     * @param amountY Token Y Amount.
     * @return weight The total weight of the tokens.
     */
    function _getTotalInTokenY(uint256 amountX, uint256 amountY) internal view returns(uint256 weight) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        weight = amountY + amountXToY;
    }

    function getPoolPrice() public view returns(uint256) {
        uint256 price = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(lbPair.getActiveId()));
        // price * 1e8 * 1edx / 1edy / 1e18
        if (tokenXDecimals >= 10 + tokenYDecimals) {
            price = price * 10 ** (tokenXDecimals - 10 - tokenYDecimals);
        } else {
            price = price / 10 ** (10 + tokenYDecimals - tokenXDecimals);
        }
        return price;
    }

    /**
     * @dev Returns the estimated token Y amount from token X.
     * @param amountX Token X Amount.
     * @return amountY Token Y Amount to return.
     */
    function _getTokenYFromTokenX(uint256 amountX) internal view returns(uint256 amountY) {
        (uint128 reserveA, uint128 reserveB) = lbPair.getReserves();
        if(reserveA > 0 || reserveB > 0) {
            uint256 price = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(lbPair.getActiveId()));
            // Swap For Y : Convert token X to token Y
            amountY = amountX * price / 1e18;
        } else {
            amountY = 0;
        }
    }

    /**
    * @dev Returns the updated amounts of tokens.
    * @return amountX The updated amount of token X.
    * @return amountY The updated amount of token Y.
    */
    function _swapForEqualValues(uint256 amountX, uint256 amountY, uint256 swapSlippage) internal returns(uint256, uint256) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        bool swapTokenX = amountY < amountXToY;
        uint256 diff = swapTokenX ? amountXToY - amountY : amountY - amountXToY;
        // (amountXToY != 0 || amountX == 0) for excluding the initial LP deposit
        if(FullMath.mulDiv(amountY, _REBALANCE_MARGIN, _DENOMINATOR) < diff && (amountXToY > 0 || amountX == 0)) {
            uint256 amountIn;
            {
                uint256 price = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(lbPair.getActiveId()));
                // Swap For X : Convert token Y to token X
                amountIn = FullMath.mulDiv(diff / 2, 1e18, price);
            }

            uint256 amountOut = diff / 2; 

            (amountIn, amountOut) = swapTokenX ? (amountIn, amountOut) : (amountOut, amountIn);
            IERC20[] memory tokenPathDynamic = new IERC20[](2);
            if (swapTokenX) {
                tokenPathDynamic[0] = tokenX;
                tokenPathDynamic[1] = tokenY;
                tokenX.safeApprove(traderJoeV2Router, 0);
                tokenX.safeApprove(traderJoeV2Router, amountIn);
            } else {
                tokenPathDynamic[0] = tokenY;
                tokenPathDynamic[1] = tokenX;
                tokenY.safeApprove(traderJoeV2Router, 0);
                tokenY.safeApprove(traderJoeV2Router, amountIn);
            }

            ILBRouter.Version[] memory versionsDynamic = new ILBRouter.Version[](1);
            versionsDynamic[0] = ILBRouter.Version.V2_2;

            uint256[] memory binStepsDynamic = new uint256[](1);
            binStepsDynamic[0] = DEFAULT_BIN_STEP;

            ILBRouter.Path memory path = ILBRouter.Path({
                pairBinSteps: binStepsDynamic,
                versions: versionsDynamic,
                tokenPath: tokenPathDynamic
            });
            amountOut = ILBRouter(traderJoeV2Router).swapExactTokensForTokens(amountIn, amountOut * (_DENOMINATOR - swapSlippage) / _DENOMINATOR, path, address(this), block.timestamp);
            (amountX, amountY) = swapTokenX ? (amountX - amountIn,amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
        }
        return (amountX, amountY);
    }

    /**
    * @dev Returns the liquidity configurations for the given range.
    * @param centerId The active id of the pair.
    * @return liquidityConfigs The liquidity configurations for the given range.
    * @return depositIds Deposit ID list.
    */
    function _encodeDepositConfigs(uint256 centerId) internal view returns (bytes32[] memory liquidityConfigs, uint256[] memory depositIds) {
        uint256 length = depositForm.length;
        liquidityConfigs = new bytes32[](length);
        depositIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            DepositForm memory config = depositForm[i];
            int256 _id = int256(centerId) + config.deltaId;
            if (!(_id >= 0 && uint256(_id) <= type(uint24).max)) {
                revert Overflow();
            }
            depositIds[i] = uint256(_id);
            liquidityConfigs[i] = LiquidityConfigurations.encodeParams(config.distributionX, config.distributionY, uint24(uint256(_id)));
        }
    }

    /**
    * @dev Withdraws tokens from the Liquidity Book Pair.
    * @param user User address to withdraw
    * @param depositIds Deposit ID list.
    * @param liquidityMinted The amount of ids to withdraw.
    * @param share sPrime amount to withdraw.
    * @return balanceX The amount of token X received.
    * @return balanceY The amount of token Y received.
    */
    function _withdrawFromLB(address user, uint256[] memory depositIds, uint256[] memory liquidityMinted, uint256 share) internal returns (uint256 balanceX, uint256 balanceY, uint256[] memory liquidityAmounts) {
        if (depositIds.length != liquidityMinted.length) {
            revert LengthMismatch();
        }

        uint256 length;
        uint256 totalShare = balanceOf(user);
        // Get the lbPair address and the delta between the upper and lower range.
        uint256 delta = depositIds.length;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);
        liquidityAmounts  = new uint256[](delta);

        // Get the ids and amounts of the tokens to withdraw.
        for (uint256 i; i < delta;) {
            uint256 id = depositIds[i];
            liquidityAmounts[i] = FullMath.mulDiv(liquidityMinted[i], share, totalShare);
            if (liquidityAmounts[i] != 0) {
                ids[length] = id;
                amounts[length] = liquidityAmounts[i];

                unchecked {
                    ++length;
                }
            }

            unchecked {
                ++i;
            }
        }
        uint256 balanceXBefore = tokenX.balanceOf(address(this));
        uint256 balanceYBefore = tokenY.balanceOf(address(this));

        // If the range is not empty, burn the tokens from the lbPair.
        if (length > 0) {
            // If the length is different than the delta, update the arrays, this allows to avoid the zero share error.
            if (length != delta) {
                assembly {
                    mstore(ids, length)
                    mstore(amounts, length)
                }
            }

            lbPair.burn(address(this), address(this), ids, amounts);
        }

        // Get the amount of tokens in the sPrime contract.
        balanceX = tokenX.balanceOf(address(this)) - balanceXBefore;
        balanceY = tokenY.balanceOf(address(this)) - balanceYBefore;
    }

    /**
     * @dev Deposits tokens into the lbPair.
     * @param user The user address to receive sPrime.
     * @param centerId The active Id.
     */
    function _depositToLB(address user, uint256 centerId) internal {
        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
        if(depositConfig.depositIds.length == 0) {
            (depositConfig.liquidityConfigs, depositConfig.depositIds) = _encodeDepositConfigs(centerId);
        }

        // Mint the liquidity tokens.
        (bytes32 amountsReceived, bytes32 amountsLeft, uint256[] memory liquidityMinted) = lbPair.mint(address(this), depositConfig.liquidityConfigs, user);
        
        uint256 share = _getTotalInTokenY(amountsReceived.decodeX() - amountsLeft.decodeX(), amountsReceived.decodeY() - amountsLeft.decodeY());
        uint256 tokenId = getUserTokenId(user);
        if(tokenId == 0) {
            tokenId = positionManager.mint(IPositionManager.MintParams({
                recipient: user,
                totalShare: share,
                centerId: centerId,
                liquidityMinted: liquidityMinted,
                liquidityConfigs: depositConfig.liquidityConfigs,
                depositIds: depositConfig.depositIds
            }));
        } else  {
            positionManager.update(IPositionManager.UpdateParams({
                tokenId: tokenId,
                share: share,
                liquidityAmounts: liquidityMinted,
                isAdd: true
            }));
        }
        _mint(user, share);
    }

    /**
    * @dev Internal function to transfer tokens between addresses.
    * @param from The address from which tokens are being transferred.
    * @param to The address to which tokens are being transferred.
    * @param amountX The amount of token X to transfer.
    * @param amountY The amount of token Y to transfer.
    */
    function _transferTokens(address from, address to, uint256 amountX, uint256 amountY) internal {
        if(from == address(this)) {
            if(amountX > 0) tokenX.safeTransfer(to, amountX);
            if(amountY > 0) tokenY.safeTransfer(to, amountY);
        } else {
            if(amountX > 0) tokenX.safeTransferFrom(from, to, amountX);
            if(amountY > 0) tokenY.safeTransferFrom(from, to, amountY);
        }
    }


    /** Public And External Functions */

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param isRebalance Rebalance the existing position with deposit.
    * @param swapSlippage Slippage for the rebalance.
    */
    function deposit(uint256 activeIdDesired, uint256 idSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) public nonReentrant {
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        _deposit(_msgSender(), activeIdDesired, idSlippage, amountX, amountY, isRebalance, swapSlippage);

        notifyVPrimeController(_msgSender());
    }


    function _deposit(address user, uint256 activeIdDesired, uint256 idSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) internal {

        if (swapSlippage > _MAX_SLIPPAGE) {
            revert SlippageTooHigh();
        }

        uint256 tokenId = getUserTokenId(user);
        uint256 activeId = lbPair.getActiveId();
        if(tokenId > 0) {
            (,,, uint256 share, uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(tokenId);
            activeId = centerId;
            if(isRebalance) { // Withdraw Position For Rebalance
                IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
                (uint256 amountXBefore, uint256 amountYBefore, ) = _withdrawFromLB(user, depositConfig.depositIds, liquidityMinted, share);
                
                positionManager.burn(tokenId);   
                _burn(user, share);

                (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
                tokenId = 0;
            }
        }
        (amountX, amountY) = _swapForEqualValues(amountX, amountY, swapSlippage);
        
        // Revert if active id moved without rebalancing
        if (!(activeId == lbPair.getActiveId() || tokenId == 0)) {
            revert BinIdChanged();
        }
        activeId = lbPair.getActiveId();

        if (!(activeIdDesired + idSlippage >= activeId && activeId + idSlippage >= activeIdDesired)) {
            revert SlippageTooHigh();
        }

        _transferTokens(address(this), address(lbPair), amountX, amountY);
        _depositToLB(user, activeId);
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param user The active id that user wants to add liquidity from
    * @param percentForLocks sPrime amount % to lock
    * @param lockPeriods Lock period to Lock for each amount
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param activeIdDesired Desired bin id.
    * @param idSlippage Bin id slippage from the active id.
    */
    function mintForUserAndLock(address user, uint256[] calldata percentForLocks, uint256[] calldata lockPeriods, uint256 amountX, uint256 amountY, uint256 activeIdDesired, uint256 idSlippage) public onlyOperator nonReentrant {
        if (percentForLocks.length != lockPeriods.length) {
            revert LengthMismatch();
        }
        
        uint256 oldBalance = balanceOf(user);
        _transferTokens(_msgSender(), address(this), amountX, amountY);
        _deposit(user, activeIdDesired, idSlippage, amountX, amountY, true, _MAX_SLIPPAGE);
        if (balanceOf(user) < oldBalance) {
            revert NegativeMint();
        }

        uint256 totalLock;
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            totalLock += percentForLocks[i];
        }
        if (totalLock != 100) {
            revert ShouldLock100Percent();
        }
        
        uint256 balance = balanceOf(user) - oldBalance;
        totalLock = 0;
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            if (lockPeriods[i] > MAX_LOCK_TIME) {
                revert MaxLockTimeExceeded();
            }
            // Should minus from total balance to avoid the round issue
            uint256 amount = i == lockPeriods.length - 1 ? balance - totalLock : balance * percentForLocks[i] / 100;
            locks[user].push(LockDetails({
                lockPeriod: lockPeriods[i],
                amount: amount,
                unlockTime: block.timestamp + lockPeriods[i]
            }));
            totalLock += amount;
        }

        notifyVPrimeController(user);
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param ids Depoisit Ids from TraderJoe
    * @param amounts Minted LBT amount for each deposit id
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param swapSlippage Slippage for the rebalance.
    */
    function migrateLiquidity(uint256[] calldata ids, uint256[] calldata amounts, uint256 activeIdDesired, uint256 idSlippage, uint256 swapSlippage) public nonReentrant {
        uint256 balanceXBefore = tokenX.balanceOf(address(this));
        uint256 balanceYBefore = tokenY.balanceOf(address(this));

        lbPair.burn(_msgSender(), address(this), ids, amounts);

        _deposit(_msgSender(), activeIdDesired, idSlippage, tokenX.balanceOf(address(this)) - balanceXBefore, tokenY.balanceOf(address(this)) - balanceYBefore, true, swapSlippage);

        notifyVPrimeController(_msgSender());
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param share Amount to withdraw
    */
    function withdraw(uint256 share, uint256 amountXMin, uint256 amountYMin) external nonReentrant {
        uint256 tokenId = getUserTokenId(_msgSender());
        if (tokenId == 0) {
            revert NoPosition();
        }

        (,,,, uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(tokenId);
        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);

        uint256 lockedBalance = getLockedBalance(_msgSender());
        if (balanceOf(_msgSender()) < share + lockedBalance) {
            revert BalanceIsLocked();
        }

        (uint256 amountX, uint256 amountY, uint256[] memory liquidityAmounts) = _withdrawFromLB(_msgSender(), depositConfig.depositIds, liquidityMinted, share);
        if(amountX < amountXMin || amountY < amountYMin) {
            revert SlippageTooHigh();
        }
        positionManager.update(IPositionManager.UpdateParams({
            tokenId: tokenId,
            share: share,
            liquidityAmounts: liquidityAmounts,
            isAdd: false
        }));

        // Burn Position NFT
        if(balanceOf(_msgSender()) == share) {
            positionManager.burn(tokenId);
        }

        // Send the tokens to the user.
        _transferTokens(address(this), _msgSender(), amountX, amountY);

        _burn(_msgSender(), share);

        notifyVPrimeController(_msgSender());
    }

    /**
    * @dev Locks a specified amount of balance for a specified lock period.
    * @param amount The amount of balance to be locked.
    * @param lockPeriod The duration for which the balance will be locked.
    */
    function lockBalance(uint256 amount, uint256 lockPeriod) public nonReentrant {
        uint256 lockedBalance = getLockedBalance(_msgSender());
        if (balanceOf(_msgSender()) < amount + lockedBalance) {
            revert InsufficientBalance();
        }
        if (lockPeriod > MAX_LOCK_TIME) {
            revert MaxLockTimeExceeded();
        }
        locks[_msgSender()].push(LockDetails({
            lockPeriod: lockPeriod,
            amount: amount,
            unlockTime: block.timestamp + lockPeriod
        }));

        notifyVPrimeController(_msgSender());
    }

    /**
    * @dev Claims the reward from TraderJoe v2.2 Base Reward Pool
    * @param receiver User address that will receive the collected reward.
    * @param ids Bin Id list to claim.
    */
    function claim(address receiver, uint256[] calldata ids) public onlyOwner nonReentrant {
        baseRewarder.claim(address(this), ids);
        IERC20Metadata rewardToken = IERC20Metadata(address(baseRewarder.getRewardToken()));
        uint256 reward = rewardToken.balanceOf(address(this));
        if(reward > 0) {
            rewardToken.safeTransfer(receiver, reward);
        }
    }

    /** Overrided Functions */

    /**
    * @dev The hook that happens before token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if(from != address(0) && to != address(0)) {
            uint256 lockedBalance = getLockedBalance(from);
            uint256 fromBalance = balanceOf(from);
            if (fromBalance < amount + lockedBalance) {
                revert InsufficientBalance();
            }
            if (getUserTokenId(to) != 0) {
                revert UserAlreadyHasPosition();
            }
            
            uint256 tokenId = getUserTokenId(from);

            if(fromBalance == amount) {
                positionManager.forceTransfer(from, to, tokenId);
            } else {
                (,,,,uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(tokenId);
                IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
                for(uint256 i = 0 ; i < liquidityMinted.length ; i ++) {
                    liquidityMinted[i] = FullMath.mulDiv(liquidityMinted[i], amount, fromBalance);
                }

                positionManager.update(IPositionManager.UpdateParams({
                    tokenId: tokenId,
                    share: amount,
                    liquidityAmounts: liquidityMinted,
                    isAdd: false
                }));

                positionManager.mint(IPositionManager.MintParams({
                    recipient: to,
                    totalShare: amount,
                    centerId: centerId,
                    liquidityMinted: liquidityMinted,
                    liquidityConfigs: depositConfig.liquidityConfigs,
                    depositIds: depositConfig.depositIds
                }));
            }
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if(from != address(0) && to != address(0)) {
            notifyVPrimeController(from);
            notifyVPrimeController(to);
        }
    }

    function containsOracleCalldata() public pure returns (bool) {
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

    function notifyVPrimeController(address account) internal {
        if(address(vPrimeController) != address(0)){
            if(containsOracleCalldata()) {
                proxyCalldata(
                    address(vPrimeController),
                    abi.encodeWithSignature
                    ("updateVPrimeSnapshot(address)", account),
                    false
                );
            } else {
                vPrimeController.setUserNeedsUpdate(account);
            }
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return tokenYDecimals;
    }

    // CUSTOM ERRORS
    error InsufficientBalance();
    error BalanceIsLocked();
    error NoPosition();
    error LengthMismatch();
    error MaxLockTimeExceeded();
    error SlippageTooHigh();
    error BinIdChanged();
    error UserAlreadyHasPosition();
    error NegativeMint();
    error ShouldLock100Percent();
    error Unauthorized();
    error Overflow();
    error ProxyCallFailed();
}