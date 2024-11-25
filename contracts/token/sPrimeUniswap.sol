// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9f02dab5ae5dd02d0771bb7dedabb0ad6ac8802c;
pragma solidity ^0.8.17;

// Importing necessary libraries and interfaces
import "../interfaces/ISPrimeUniswap.sol";
import "../interfaces/IVPrimeController.sol";
import "../interfaces/uniswap-v3/IUniswapV3Factory.sol";
import "../interfaces/uniswap-v3/ISwapRouter.sol";
import "../lib/uniswap-v3/OracleLibrary.sol";
import "../lib/uniswap-v3/PositionValue.sol";
import "../lib/uniswap-v3/UniswapV3IntegrationHelper.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

// SPrime contract declaration
contract sPrimeUniswap is
    ISPrimeUniswap,
    ReentrancyGuardUpgradeable,
    PendingOwnableUpgradeable,
    ERC20Upgradeable,
    ERC721HolderUpgradeable,
    ProxyConnector
{
    using SafeERC20 for IERC20Metadata; // Using SafeERC20 for IERC20 for safe token transfers
    using PositionValue for INonfungiblePositionManager;
    // Constants declaration
    uint256 private constant _REBALANCE_MARGIN = 5; // 5% Rebalance Limit - If token diff is smaller than this percent, it will skip the token swap part
    uint256 private constant _MAX_SLIPPAGE = 500; // 5% Max slippage at the time of token swap for equal values
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;
    uint256 public constant PRECISION = 20;
    uint256 private constant _DENOMINATOR = 10000;

    // Mapping for storing pair information and user shares
    mapping(address => LockDetails[]) public locks;
    mapping(address => uint256) public userTokenId;

    // Immutable variables for storing token and pair information
    IERC20Metadata public tokenX;
    IERC20Metadata public tokenY;
    int24 public tickSpacing;
    int24 private deltaId;

    IUniswapV3Pool public pool;
    uint8 public tokenDecimals;
    uint24 public feeTier;

    INonfungiblePositionManager public positionManager;
    ISwapRouter public swapRouter;
    IVPrimeController public vPrimeController;

    bool public tokenSequence;
    
    address private implementation;
    address public operator;

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializer of the contract.
     * @param tokenX_ The address of the token X.
     * @param tokenY_ The address of the token Y.
     * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
     * @param feeTier_ Fee Tier of Uniswap V3 Pool
     * @param deltaId_ Delta id for tick lower and tick upper
     * @param positionManager_ Uniswap v3 NonfungiblePositionManager contract
     * @param swapRouter_ Uniswap V3 Swap Router contract
     * @param uniV3Factory_ Uniswap V3 Factory contract
     */
    function initialize(
        IERC20Metadata tokenX_,
        IERC20Metadata tokenY_,
        string memory name_,
        uint24 feeTier_,
        int24 deltaId_,
        INonfungiblePositionManager positionManager_,
        ISwapRouter swapRouter_,
        IUniswapV3Factory uniV3Factory_
    ) external initializer {
        __PendingOwnable_init();
        __ReentrancyGuard_init_unchained();
        __ERC20_init_unchained(name_, "sPrime");
        __ERC721Holder_init_unchained();

        tokenDecimals = tokenY_.decimals();

        tokenSequence = tokenX_ > tokenY_;
        tokenX = tokenX_;
        tokenY = tokenY_;
        feeTier = feeTier_;

        positionManager = positionManager_;
        swapRouter = swapRouter_;

        address poolAddress = uniV3Factory_.getPool(
            address(tokenX_),
            address(tokenY_),
            feeTier_
        );
        if (poolAddress == address(0)) {
            revert PoolNotExisting();
        }
        pool = IUniswapV3Pool(poolAddress);
        tickSpacing = pool.tickSpacing();
        deltaId = deltaId_;
    }

    modifier onlyOperator() {
        if(_msgSender() != operator) {
            revert AccessDenied();
        }
        _;
    }

    function setVPrimeControllerAddress(
        IVPrimeController _vPrimeController
    ) public onlyOwner {
        vPrimeController = _vPrimeController;
    }

    function setOperator(
        address _operator
    ) public onlyOwner {
        operator = _operator;
    }

    function setImplementation(
        address _implementation
    ) public onlyOwner {
        implementation = _implementation;
    }

    function getTokenX() public view returns (IERC20) {
        return IERC20(tokenX);
    }

    function getTokenY() public view returns (IERC20) {
        return IERC20(tokenY);
    }

    function getToken0() internal view returns (IERC20Metadata) {
        return IERC20Metadata(pool.token0());
    }

    function getToken1() internal view returns (IERC20Metadata) {
        return IERC20Metadata(pool.token1());
    }

    /**
     * @dev Check if the tick is in the user position range
     * @param user User Address.
     * @return status tick status
     */
    function tickInRange(address user) public view returns (bool status) {
        uint256 tokenId = userTokenId[user];
        if (tokenId == 0) {
            revert NoPosition();
        }
        (bool success, bytes memory result) = implementation.staticcall(abi.encodeWithSignature("tickInRange(uint256)", tokenId));
        if (!success)  {
            revert ProxyCallFailed();
        }
        status = abi.decode(result, (bool));
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @param poolPrice Pool Price or oracle price for calculating proper token amount
     * @return amountY Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(
        address user,
        uint256 poolPrice
    ) public view returns (uint256 amountY) {
        (bool success, bytes memory result) = implementation.staticcall(abi.encodeWithSignature("getUserValueInTokenY(address,uint256)", user, poolPrice));
        
        if (!success)  {
            revert ProxyCallFailed();
        }
        amountY = abi.decode(result, (uint256));
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
    function getFullyVestedLockedBalance(
        address account
    ) public view returns (uint256 fullyVestedBalance) {
        uint256 length = locks[account].length;
        for (uint256 i; i != length; ++i) {
            if (locks[account][i].unlockTime > block.timestamp) {
                fullyVestedBalance += FullMath.mulDiv(
                    locks[account][i].amount,
                    locks[account][i].lockPeriod,
                    MAX_LOCK_TIME
                );
            }
        }
    }

    /**
     * @dev Returns the total locked balance of an account.
     * @param account The address of the account.
     * @return The total locked balance of the account.
     */
    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance = 0;
        uint256 length = locks[account].length;
        for (uint256 i; i != length; ++i) {
            if (locks[account][i].unlockTime > block.timestamp) {
                lockedBalance += locks[account][i].amount;
            }
        }
        return lockedBalance;
    }

    /**
     * @dev Returns the total weight of tokens in a liquidity pair.
     * @param amountX Token X Amount.
     * @param amountY Token Y Amount.
     * @return weight The total weight of tokens in the liquidity pair.
     */
    function _getTotalInTokenY(
        uint256 amountX,
        uint256 amountY
    ) internal view returns (uint256 weight) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        weight = amountY + amountXToY;
    }

    /**
     * @dev Returns the estimated token Y amount from token X.
     * @param amountX Token X Amount.
     * @return amountY Token Y Amount to return.
     */
    function _getTokenYFromTokenX(
        uint256 amountX
    ) internal view returns (uint256 amountY) {
        (, int24 tick, , , , , ) = pool.slot0();
        amountY = OracleLibrary.getQuoteAtTick(
            tick,
            uint128(amountX),
            address(tokenX),
            address(tokenY)
        );
    }

    function getPoolPrice() public view returns (uint256) {
        (, int24 tick, , , , , ) = pool.slot0();
        uint256 price = OracleLibrary.getQuoteAtTick(
            tick,
            uint128(10 ** tokenX.decimals()),
            address(tokenX),
            address(tokenY)
        );
        return
            FullMath.mulDiv(
                price,
                1e8,
                10 ** tokenY.decimals()
            );
    }

    /**
     * @dev Returns the updated amounts of tokens.
     * @return amountX The updated amount of token X.
     * @return amountY The updated amount of token Y.
     */
    function _swapForEqualValues(
        uint256 amountX,
        uint256 amountY,
        uint256 swapSlippage
    ) internal returns (uint256, uint256) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        bool swapTokenX = amountY < amountXToY;
        uint256 diff = swapTokenX ? amountXToY - amountY : amountY - amountXToY;
        // (amountXToY != 0 || amountX == 0) for excluding the initial LP deposit
        if (
            (amountY * _REBALANCE_MARGIN) / 100 < diff &&
            (amountXToY > 0 || amountX == 0)
        ) {
            uint256 amountIn;
            {
                (, int24 tick, , , , , ) = pool.slot0();
                amountIn = OracleLibrary.getQuoteAtTick(
                    tick,
                    uint128(diff / 2),
                    address(tokenY),
                    address(tokenX)
                );
            }
            uint256 amountOut = diff / 2;

            address tokenIn;
            address tokenOut;

            (amountIn, amountOut) = swapTokenX
                ? (amountIn, amountOut)
                : (amountOut, amountIn);

            if (swapTokenX) {
                tokenIn = address(tokenX);
                tokenOut = address(tokenY);
            } else {
                tokenIn = address(tokenY);
                tokenOut = address(tokenX);
            }
            
            IERC20Metadata(tokenIn).safeApprove(address(swapRouter), 0);
            IERC20Metadata(tokenIn).safeApprove(address(swapRouter), amountIn);
            
            (amountIn, amountOut) = _processTokenSwap(
                tokenIn,
                tokenOut,
                amountIn,
                amountOut * (_DENOMINATOR - swapSlippage) / _DENOMINATOR
            );

            (amountX, amountY) = swapTokenX
                ? (amountX - amountIn, amountY + amountOut)
                : (amountX + amountOut, amountY - amountIn);
        }
        return (amountX, amountY);
    }

    function _processTokenSwap(
        address tokenIn,
        address tokenOut,
        uint256 amount,
        uint256 amountOutMinimum
    ) internal returns (uint256 amountIn, uint256 amountOut) {
        uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: feeTier,
                recipient: address(this),
                amountIn: amount,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
        amountIn = beforeBalance - IERC20(tokenIn).balanceOf(address(this));
    }

    function _depositToUniswap(
        address user,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountX,
        uint256 amountY,
        uint256 desiredAmountX,
        uint256 desiredAmountY
    ) internal {
        uint256 tokenId = userTokenId[user];
        uint256 amountXAdded;
        uint256 amountYAdded;
        tokenX.forceApprove(address(positionManager), amountX);
        tokenY.forceApprove(address(positionManager), amountY);

        (uint256 amount0, uint256 amount1) = tokenSequence ? (amountY, amountX) : (amountX, amountY);
        (desiredAmountX, desiredAmountY) = tokenSequence ? (desiredAmountY, desiredAmountX) : (desiredAmountX, desiredAmountY);

        if (tokenId == 0) {
            (tokenId, , amountXAdded, amountYAdded) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: address(getToken0()),
                    token1: address(getToken1()),
                    fee: feeTier,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0,
                    amount1Desired: amount1,
                    amount0Min: desiredAmountX,
                    amount1Min: desiredAmountY,
                    recipient: address(this),
                    deadline: block.timestamp
                })
            );
            userTokenId[user] = tokenId;
        } else {
            (, amountXAdded, amountYAdded) = positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: amount0,
                    amount1Desired: amount1,
                    amount0Min: desiredAmountX,
                    amount1Min: desiredAmountY,
                    deadline: block.timestamp
                })
            );
        }
        if(tokenSequence) {
            (amountXAdded, amountYAdded) = (amountYAdded, amountXAdded);
        }

        uint256 share = _getTotalInTokenY(amountXAdded, amountYAdded);

        _mint(user, share);

        _transferTokens(
            address(this),
            user,
            amountX - amountXAdded,
            amountY - amountYAdded
        );
    }

    /**
     * @dev Internal function to transfer tokens between addresses.
     * @param from The address from which tokens are being transferred.
     * @param to The address to which tokens are being transferred.
     * @param amountX The amount of token X to transfer.
     * @param amountY The amount of token Y to transfer.
     */
    function _transferTokens(
        address from,
        address to,
        uint256 amountX,
        uint256 amountY
    ) internal {
        if (from == address(this)) {
            if (amountX > 0) tokenX.safeTransfer(to, amountX);
            if (amountY > 0) tokenY.safeTransfer(to, amountY);
        } else {
            if (amountX > 0) tokenX.safeTransferFrom(from, to, amountX);
            if (amountY > 0) tokenY.safeTransferFrom(from, to, amountY);
        }
    }

    /**
     * @dev Users can use deposit function for depositing tokens to the specific bin.
     * @param tickDesired The tick that user wants to add liquidity from
     * @param tickSlippage The tick slippage that are allowed to slip
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @param desiredAmountX The desired amount of token X to deposit.
     * @param desiredAmountY The desired amount of token Y to deposit.
     * @param isRebalance Rebalance the existing position with deposit.
     * @param swapSlippage Slippage for the rebalance.
     */
    function deposit(
        int24 tickDesired,
        int24 tickSlippage,
        uint256 amountX,
        uint256 amountY,
        uint256 desiredAmountX,
        uint256 desiredAmountY,
        bool isRebalance,
        uint256 swapSlippage
    ) public nonReentrant {
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        if (swapSlippage > _MAX_SLIPPAGE) {
            revert SlippageTooHigh();
        }

        _deposit(
            _msgSender(),
            tickDesired,
            tickSlippage,
            amountX,
            amountY,
            desiredAmountX,
            desiredAmountY,
            isRebalance,
            swapSlippage
        );
    }

    function _deposit(
        address user,
        int24 tickDesired,
        int24 tickSlippage,
        uint256 amountX,
        uint256 amountY,
        uint256 desiredAmountX,
        uint256 desiredAmountY,
        bool isRebalance,
        uint256 swapSlippage
    ) internal {
        int24 tickLower;
        int24 tickUpper;

        uint256 tokenId = userTokenId[user];
        if (tokenId > 0) {
            uint128 liquidity;
            (, , , , , tickLower, tickUpper, liquidity, , , , ) = positionManager.positions(tokenId);

            if (isRebalance) {
                // Withdraw Position For Rebalance
                (uint256 amountXBefore, uint256 amountYBefore) = positionManagerRemove(tokenId, liquidity, address(this), 0, 0);
                
                if(getToken0() != tokenX) {
                    (amountXBefore, amountYBefore) = (amountYBefore, amountXBefore);
                }

                burnUserPosition(user, tokenId);

                (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
            }
        }
        (amountX, amountY) = _swapForEqualValues(amountX, amountY, swapSlippage);

        if (userTokenId[user] == 0) {
            (, int24 currenTick, , , , , ) = pool.slot0();
            currenTick = convertToNearestTickSpacingMultiple(currenTick);
            if (!(tickDesired + tickSlippage >= currenTick && currenTick + tickSlippage >= tickDesired)) {
                revert SlippageTooHigh();
            }
            tickLower = currenTick - tickSpacing * deltaId;
            tickUpper = currenTick + tickSpacing * deltaId;
        }
        _depositToUniswap(user, tickLower, tickUpper, amountX, amountY, desiredAmountX, desiredAmountY);

        notifyVPrimeController(user);
    }

    function convertToNearestTickSpacingMultiple(int24 tick) internal view returns (int24) {
        return (tick / tickSpacing) * tickSpacing;
    }

    function collect() external nonReentrant() {
        uint256 tokenId = userTokenId[_msgSender()];
        if (tokenId == 0) {
            revert NoPosition();
        }

        positionManagerCollect(
            tokenId,
            _msgSender()
        );
    }

    /**
     * @dev Users can use withdraw function for withdrawing their share.
     * @param share Amount to withdraw
     */
    function withdraw(uint256 share, uint256 amountXMin, uint256 amountYMin) external nonReentrant {
        address msgSender = _msgSender();
        uint256 tokenId = userTokenId[msgSender];
        if (tokenId == 0) {
            revert NoPositionToWithdraw();
        }

        (, , , , , , , uint128 liquidity, , , , ) = positionManager.positions(
            tokenId
        );

        uint256 balance = balanceOf(msgSender);
        if (balance < share + getLockedBalance(msgSender)) {
            revert BalanceLocked();
        }

        (amountXMin, amountYMin) = tokenSequence ? (amountYMin, amountXMin) : (amountXMin, amountYMin);
        positionManagerRemove(tokenId, uint128((liquidity * share) / balance), msgSender, amountXMin, amountYMin);

        // Burn Position NFT
        if (balance == share) {
            positionManager.burn(tokenId);
            delete userTokenId[msgSender];
        }

        _burn(msgSender, share);

        notifyVPrimeController(msgSender);
    }

    /**
     * @dev Users can use deposit function for depositing tokens to the specific bin.
     * @param user The active id that user wants to add liquidity from
     * @param percentForLocks sPrime amount % to lock
     * @param lockPeriods Lock period to Lock for each amount
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @param tickDesired The tick that user wants to add liquidity from
     * @param tickSlippage Tick slippage from the current tick.
     */
    function mintForUserAndLock(
        address user,
        uint256[] calldata percentForLocks,
        uint256[] calldata lockPeriods,
        uint256 amountX,
        uint256 amountY,
        int24 tickDesired,
        int24 tickSlippage
    ) public onlyOperator nonReentrant {
        address msgSender = _msgSender();
        _transferTokens(msgSender, address(this), amountX, amountY);

        if (percentForLocks.length != lockPeriods.length) {
            revert LengthMismatch();
        }

        uint256 oldBalance = balanceOf(user);
        _deposit(user, tickDesired, tickSlippage, amountX, amountY, 0, 0, true, _MAX_SLIPPAGE);
        
        if(balanceOf(user) > oldBalance) {
            lockForUser(user, balanceOf(user) - oldBalance, percentForLocks, lockPeriods);
        } else {
            revert InsufficientBalanceToLock();
        }

        notifyVPrimeController(user);
    }

    function lockForUser(address user, uint256 balance, uint256[] calldata percentForLocks, uint256[] calldata lockPeriods) internal {
        uint256 totalLock;
        uint256 length = lockPeriods.length;
        for (uint8 i; i != length; ++i) {
            totalLock += percentForLocks[i];
        }
        if (totalLock != 100) {
            revert TotalLockMismatch();
        }
        totalLock = 0;
        for (uint8 i; i != length; ++i) {
            if (lockPeriods[i] > MAX_LOCK_TIME) {
                revert LockPeriodExceeded();
            }
            // Should minus from total balance to avoid the round issue
            uint256 amount = i == length - 1
                ? balance - totalLock
                : (balance * percentForLocks[i]) / 100;
            locks[user].push(
                LockDetails({
                    lockPeriod: lockPeriods[i],
                    amount: amount,
                    unlockTime: block.timestamp + lockPeriods[i]
                })
            );
            totalLock += amount;
        }
    }

    function positionManagerCollect(
        uint256 tokenId,
        address recipient
    ) internal returns (uint256 amount0, uint256 amount1) {
        return
            positionManager.collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: recipient,
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            );
    }

    function positionManagerRemove(
        uint256 tokenId,
        uint128 liquidity,
        address recipient,
        uint256 amount0Min,
        uint256 amount1Min
    ) internal returns (uint256, uint256) {
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp
            })
        );

        return positionManagerCollect(
            tokenId,
            recipient
        );
    }

    function burnUserPosition(address user, uint256 tokenId) internal {
        _burn(user, balanceOf(user));
        positionManager.burn(tokenId);

        delete userTokenId[user];
    }

    /**
     * @dev Users can use deposit function for depositing tokens to the specific bin.
     * @param tokenId Token ID from UniswapPositionManager
     * @param tickDesired The tick that user wants to add liquidity from
     * @param tickSlippage The tick slippage that are allowed to slip
     * @param swapSlippage Slippage for the rebalance.
     */
    function migrateLiquidity(
        uint256 tokenId,
        int24 tickDesired,
        int24 tickSlippage,
        uint256 swapSlippage
    ) public nonReentrant {
        if(positionManager.ownerOf(tokenId) != _msgSender()) {
            revert NoPosition();
        }

        (, , , , , , , uint128 liquidity , , , ,) = positionManager.positions(tokenId);

        (uint256 amountX, uint256 amountY) = positionManagerRemove(tokenId, liquidity, address(this), 0, 0);

        if(getToken0() != tokenX) {
            (amountX, amountY) = (amountY, amountX);
        }
        positionManager.burn(tokenId);

        if (swapSlippage > _MAX_SLIPPAGE) {
            revert SlippageTooHigh();
        }

        _deposit(_msgSender(), tickDesired, tickSlippage, amountX, amountY, 0, 0, true, swapSlippage);
    }

    /**
     * @dev Locks a specified amount of balance for a specified lock period.
     * @param amount The amount of balance to be locked.
     * @param lockPeriod The duration for which the balance will be locked.
     */
    function lockBalance(uint256 amount, uint256 lockPeriod) public nonReentrant {
        address msgSender = _msgSender();
        uint256 lockedBalance = getLockedBalance(msgSender);
        if (balanceOf(msgSender) < amount + lockedBalance) {
            revert InsufficientBalanceToLock();
        }
        if (lockPeriod > MAX_LOCK_TIME) {
            revert LockPeriodExceeded();
        }
        locks[msgSender].push(
            LockDetails({
                lockPeriod: lockPeriod,
                amount: amount,
                unlockTime: block.timestamp + lockPeriod
            })
        );

        notifyVPrimeController(msgSender);
    }

    /** Overrided Functions */

    /**
    * @dev The hook that happens before token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if (from != address(0) && to != address(0)) {
            uint256 lockedBalance = getLockedBalance(from);
            uint256 fromBalance = balanceOf(from);
            if (fromBalance < amount + lockedBalance) {
                revert InsufficientBalance();
            }
        }
    }

    /**
     * @dev The hook that happens after token transfer.
     * @param from The address to transfer from.
     * @param to The address to transfer to.
     * @param amount The amount to transfer.
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from != address(0) && to != address(0)) {
            uint256 fromBalance = balanceOf(from);
            if (userTokenId[to] != 0) {
                revert ReceiverAlreadyHasPosition();
            }

            uint256 tokenId = userTokenId[from];

            // Collect the fee before transfer
            positionManagerCollect(
                tokenId,
                from
            );

            if (fromBalance == 0) {
                userTokenId[to] = userTokenId[from];
                delete userTokenId[from];
            } else {
                ( , , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , ,) = positionManager.positions(tokenId);

                (uint256 amountX, uint256 amountY) = positionManagerRemove(tokenId, uint128((liquidity * amount) / (fromBalance + amount)), address(this), 0, 0);
                getToken0().forceApprove(address(positionManager), amountX);
                getToken1().forceApprove(address(positionManager), amountY);
                (
                    uint256 newTokenId,
                    ,
                    uint256 amountXAdded,
                    uint256 amountYAdded
                ) = positionManager.mint(
                        INonfungiblePositionManager.MintParams({
                            token0: address(getToken0()),
                            token1: address(getToken1()),
                            fee: feeTier,
                            tickLower: tickLower,
                            tickUpper: tickUpper,
                            amount0Desired: amountX,
                            amount1Desired: amountY,
                            amount0Min: 0,
                            amount1Min: 0,
                            recipient: address(this),
                            deadline: block.timestamp
                        })
                    );
                amountX -= amountXAdded;
                amountY -= amountYAdded;

                if(getToken0() != tokenX) { 
                    (amountXAdded, amountYAdded) = (amountYAdded, amountXAdded);
                    (amountX, amountY) = (amountY, amountX);
                }

                uint256 total = _getTotalInTokenY(amountXAdded, amountYAdded);

                _transferTokens(
                    address(this),
                    to,
                    amountX - amountXAdded,
                    amountY - amountYAdded
                );

                if (amount > total) {
                    _burn(to, amount - total);
                } else {
                    _mint(to, total - amount);
                }

                userTokenId[to] = newTokenId;
            }
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
        return tokenDecimals;
    }

    // CUSTOM ERROR MESSAGES
    error PoolNotExisting();
    error InsufficientBalance();
    error ReceiverAlreadyHasPosition();
    error NoPosition();
    error SlippageTooHigh();
    error NoPositionToWithdraw();
    error StillInLockPeriod();
    error BalanceLocked();
    error UserAlreadyHasPosition();
    error LengthMismatch();
    error TotalLockMismatch();
    error InsufficientBalanceToLock();
    error LockPeriodExceeded();
    error AccessDenied();
    error ProxyCallFailed();
}
