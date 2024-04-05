// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity 0.8.17;

// Importing necessary libraries and interfaces
import "../lib/joe-v2/math/SafeCast.sol";
import "../interfaces/ISPrime.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../lib/joe-v2/LiquidityAmounts.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// SPrime contract declaration
contract SPrime is ISPrime, ReentrancyGuard, Ownable, ERC20 {
    using SafeERC20 for IERC20; // Using SafeERC20 for IERC20 for safe token transfers
    using LiquidityAmounts for address; // Using LiquidityAmounts for address for getting amounts of liquidity
    using SafeCast for uint256; // Using SafeCast for uint256 for safe type casting

    // Constants declaration
    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _MAX_RANGE = 51;
    uint256 private constant _PACKED_DISTRIBS_SIZE = 16;
    uint256 private constant _MAX_SIPPIAGE = 5;

    // Mapping for storing pair information and user shares
    mapping(uint256 => PairInfo) public pairList;
    mapping(address => UserShare) public userShares;
    mapping(uint256 => bool) public pairStatus;

    // Immutable variables for storing token and pair information
    IERC20 public immutable tokenX;
    IERC20 public immutable tokenY;
    ILBPair public immutable lbPair;
    uint16 internal constant DEFAULT_BIN_STEP = 10;
    uint256 internal constant DEFAULT_SLIPPAGE = 10;

    // Arrays for storing deltaIds and distributions
    int256[] private deltaIds;
    uint256[] private distributionX;
    uint256[] private distributionY;

    /**
    * @dev Constructor of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param distributionX_ Pre-defined distribution X
    * @param distributionY_ Pre-defined distribution Y
    * @param deltaIds_ Delta id for bins
    */
    constructor(address tokenX_, address tokenY_, string memory name_, uint256[] memory distributionX_, uint256[] memory distributionY_, int256[] memory deltaIds_) ERC20(name_, "sPrime"){
        require(deltaIds_.length == distributionX_.length && deltaIds_.length == distributionY_.length, "Length Mismatch");

        (tokenX_, tokenY_) = tokenX_ < tokenY_ ? (tokenX_, tokenY_) : (tokenY_, tokenX_);

        tokenX = IERC20(tokenX_);
        tokenY = IERC20(tokenY_);

        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(tokenX, tokenY, DEFAULT_BIN_STEP);

        lbPair = pairInfo.LBPair;

        deltaIds = deltaIds_;
        distributionX = distributionX_;
        distributionY = distributionY_;
    }

    /**
     * @dev Returns the address of the JoeV2Router.
     * @return The address of the JoeV2Router.
     */
    function getJoeV2RouterAddress() public view virtual returns (address){
        return 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;
    }

    /**
    * @dev Adds a new bin for the PRIME-TOKEN pair.
    * @param centerId The unique identifier for the new bin.
    * @param ids Deposit IDs for the pair.
    */
    function _addBins(uint256 centerId, uint256[] memory ids) internal {
        require(!pairStatus[centerId], "Active ID added already");
        PairInfo memory newPairInfo = PairInfo({
            depositIds: ids,
            lastRebalance: block.timestamp.safe64(),
            totalShare: 0
        });

        pairList[centerId] = newPairInfo;
        pairStatus[centerId] = true;
    }

    /**
    * @dev Returns the balances of the contract, including those deposited in the LB pool.
    * @param centerId The active id of the pair.
    * @return amountX The balance of token X.
    * @return amountY The balance of token Y.
    */
    function _getBalances(uint256 centerId) internal view returns (uint256 amountX, uint256 amountY) {
        PairInfo memory pair = pairList[centerId];

        amountX = 0;
        amountY = 0;
        if (pairStatus[centerId] == true) {
            (uint256 depositedX, uint256 depositedY) = address(this).getAmountsOf(pair.depositIds, address(lbPair));

            amountX += depositedX;
            amountY += depositedY;
        }
    }

    /**
     * @dev Returns the total weight of tokens in a liquidity pair.
     * @return weight The total weight of tokens in the liquidity pair.
     */
    function _getTotalWeight(uint256 amountX, uint256 amountY) internal view returns(uint256 weight) {
        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        (, uint128 amountXToY, ) = traderJoeV2Router.getSwapOut(lbPair, uint128(amountX), true);
        weight = amountY + amountXToY;
    }

    /**
    * @dev Returns the updated amounts of tokens.
    * @return amountX The updated amount of token X.
    * @return amountY The updated amount of token Y.
    */
    function _getUpdatedAmounts(uint256 amountX, uint256 amountY) internal returns(uint256, uint256) {
        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        (, uint128 amountXToY, ) = traderJoeV2Router.getSwapOut(lbPair, uint128(amountX), true);
        bool swapTokenX = amountY < amountXToY;
        uint256 diff = swapTokenX ? amountXToY - amountY : amountY - amountXToY;

        if(amountY * _MAX_SIPPIAGE / 100 < diff) {
            uint256 amountIn = swapTokenX ? amountX * diff / amountXToY / 2 : diff / 2;

            IERC20[] memory tokenPathDynamic = new IERC20[](2);
            if (swapTokenX) {
                tokenPathDynamic[0] = tokenX;
                tokenPathDynamic[1] = tokenY;
            } else {
                tokenPathDynamic[0] = tokenY;
                tokenPathDynamic[1] = tokenX;
            }

            ILBRouter.Version[] memory versionsDynamic = new ILBRouter.Version[](2);
            versionsDynamic[0] = ILBRouter.Version.V2_1;
            versionsDynamic[1] = ILBRouter.Version.V2_1;

            uint256[] memory binStepsDynamic = new uint256[](2);
            binStepsDynamic[0] = DEFAULT_BIN_STEP;
            binStepsDynamic[1] = DEFAULT_BIN_STEP;

            ILBRouter.Path memory path = ILBRouter.Path({
                pairBinSteps: binStepsDynamic,
                versions: versionsDynamic,
                tokenPath: tokenPathDynamic
            });

            uint256 amountOut = traderJoeV2Router.swapExactTokensForTokens(amountIn, 0, path, address(this), block.timestamp + 1000);

            (amountX, amountY) = swapTokenX ? (amountX - amountIn, amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
        }

        return (amountX, amountY);
    }

    /**
    * @dev Returns the liquidity configurations for the given range.
    * @param centerId The active id of the pair.
    * @return liquidityConfigs The liquidity configurations for the given range.
    * @return depositIds Deposit ID list.
    */
    function _getLiquidityConfigs(uint256 centerId)
    internal
    view
    returns (bytes32[] memory liquidityConfigs, uint256[] memory depositIds)
    {
        liquidityConfigs = new bytes32[](deltaIds.length);
        depositIds = new uint256[](deltaIds.length);
        {
            for (uint256 i; i < liquidityConfigs.length; ++i) {
                int256 _id = int256(centerId) + deltaIds[i];

                require(_id >= 0 && uint256(_id) <= type(uint24).max, "Overflow");
                depositIds[i] = uint256(_id);
                liquidityConfigs[i] = LiquidityConfigurations.encodeParams(
                    uint64(distributionX[i]), uint64(distributionY[i]), uint24(uint256(_id))
                );
            }
        }
    }

    /**
    * @dev Deposits tokens to the LB.
    * @param liquidityParameters The parameters for the liquidity.
    */
    function _depositToLB(ILBRouter.LiquidityParameters memory liquidityParameters) internal {
        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());

        (uint256 amountXAdded,uint256 amountYAdded,,,uint256[] memory depositIds, ) = traderJoeV2Router.addLiquidity(liquidityParameters);

        int256 _activeId = int256(depositIds[0]) - liquidityParameters.deltaIds[0];
        uint256 centerId = uint256(_activeId);

        if(pairStatus[centerId] == false) {
            _addBins(centerId, depositIds);
        }

        PairInfo memory pair = pairList[centerId];
        (uint256 totalBalanceX, uint256 totalBalanceY) = _getBalances(centerId);

        uint256 share = pair.totalShare * _getTotalWeight(amountXAdded, amountYAdded) / _getTotalWeight(totalBalanceX - amountXAdded, totalBalanceY - amountYAdded);

        _mint(_msgSender(), share);
        pair.totalShare += share;

        userShares[_msgSender()] = UserShare({
            share: share,
            centerId: centerId
        });
    }

    /**
    * @dev Withdraws tokens from the lbPair and applies the AUM annual fee. This function will also reset the range.
    * @param centerId The active Id of the pair
    * @param share The amount of share to withdraw.
    * @return totalBalanceX The amount of token X withdrawn.
    * @return totalBalanceY The amount of token Y withdrawn.
    */
    function _withdrawAndUpdateShare(uint256 centerId, uint256 share) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        PairInfo storage pair = pairList[centerId];

        _burn(_msgSender(), share);

        (totalBalanceX, totalBalanceY) = _withdrawFromLB(pair.depositIds, share * _PRECISION / pair.totalShare);

        // Ge the last rebalance timestamp and update it.
        pair.lastRebalance = block.timestamp.safe64();
    }

    /**
    * @dev Withdraws tokens from the Liquidity Book Pair.
    * @param depositIds Deposit ID list.
    * @param share The amount of share to withdraw.
    * @return balanceX The amount of token X received.
    * @return balanceY The amount of token Y received.
    */
    function _withdrawFromLB(uint256[] memory depositIds, uint256 share)
    internal
    returns (uint256 balanceX, uint256 balanceY)
    {
        uint256 length;
        // Get the lbPair address and the delta between the upper and lower range.
        uint256 delta = depositIds.length;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);

        // Get the ids and amounts of the tokens to withdraw.
        for (uint256 i; i < delta;) {
            uint256 id = depositIds[i];
            uint256 amount = ILBToken(lbPair).balanceOf(address(this), id);

            if (amount != 0) {
                ids[length] = id;
                amounts[length] = amount * share / _PRECISION;

                unchecked {
                    ++length;
                }
            }

            unchecked {
                ++i;
            }
        }

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
        balanceX = tokenX.balanceOf(address(this));
        balanceY = tokenY.balanceOf(address(this));
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    */
    function deposit(uint256 activeIdDesired, uint256 idSlippage, uint256 amountX, uint256 amountY) public {

        if(amountX > 0) tokenX.safeTransferFrom(_msgSender(), address(this), amountX);
        if(amountY > 0) tokenY.safeTransferFrom(_msgSender(), address(this), amountY);

        if(userShares[_msgSender()].share > 0) {
            (uint256 amountXReceived, uint256 amountYReceived) = _withdrawAndUpdateShare(userShares[_msgSender()].centerId, userShares[_msgSender()].share);
            amountX = amountX + amountXReceived;
            amountY = amountY + amountYReceived;
        }

        (amountX, amountY) = _getUpdatedAmounts(amountX, amountY);

        ILBRouter.LiquidityParameters memory liquidityParameters = ILBRouter.LiquidityParameters({
            tokenX: tokenX,
            tokenY: tokenY,
            binStep: DEFAULT_BIN_STEP,
            amountX: amountX,
            amountY: amountY,
            amountXMin: 0,
            amountYMin: 0,
            activeIdDesired: activeIdDesired,
            idSlippage: idSlippage,
            deltaIds: deltaIds,
            distributionX: distributionX,
            distributionY: distributionY,
            to: address(this),
            refundTo: _msgSender(),
            deadline: block.timestamp + 1000
        });

        tokenX.safeApprove(getJoeV2RouterAddress(), 0);
        tokenY.safeApprove(getJoeV2RouterAddress(), 0);

        tokenX.safeApprove(getJoeV2RouterAddress(), amountX);
        tokenY.safeApprove(getJoeV2RouterAddress(), amountY);

        _depositToLB(liquidityParameters);
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param shareWithdraw The amount of share to withdraw.
    */
    function withdraw(uint256 shareWithdraw) external {
        require(shareWithdraw <= userShares[_msgSender()].share, "Insufficient Balance");

        PairInfo storage pair = pairList[userShares[_msgSender()].centerId];

        // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
        _burn(_msgSender(), shareWithdraw);

        (uint256 amountX, uint256 amountY) = _withdrawFromLB(pair.depositIds, shareWithdraw * _PRECISION / pair.totalShare);

        // Send the tokens to the user.
        tokenX.safeTransfer(_msgSender(), amountX);
        tokenY.safeTransfer(_msgSender(), amountY);
    }

    /**
    * @dev The hook that happens before token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if (from != address(0)) {

            uint256 centerId = userShares[from].centerId;

            require(userShares[from].share > amount, "Insufficient");

            if (to != address(0)) {
                UserShare storage userTo = userShares[to];
                if (userTo.share > 0) {
                    // Should process the rebalance for the existing position and the receiving position
                    (bytes32[] memory liquidityConfigs, ) = _getLiquidityConfigs(userTo.centerId);
                    PairInfo memory pair = pairList[userTo.centerId];

                    (uint256 beforeBalanceX, uint256 beforeBalanceY) = _getBalances(centerId);

                    (uint256 amountXFrom, uint256 amountYFrom) = _withdrawAndUpdateShare(userShares[from].centerId, amount);

                    if (amountXFrom > 0) tokenX.safeTransfer(address(lbPair), amountXFrom);
                    if (amountYFrom > 0) tokenY.safeTransfer(address(lbPair), amountYFrom);

                    // Mint the liquidity tokens.
                    lbPair.mint(address(this), liquidityConfigs, address(this));

                    (uint256 afterBalanceX, uint256 afterBalanceY) = _getBalances(centerId);
                    uint256 afterWeight = _getTotalWeight(afterBalanceX, afterBalanceY);
                    uint256 beforeWeight = _getTotalWeight(beforeBalanceX, beforeBalanceY);

                    uint256 share = pair.totalShare * (afterWeight - beforeWeight) / beforeWeight;

                    userTo.share += share;

                } else {
                    userTo.centerId = centerId;
                    userTo.share = amount;
                }
            } else {
                pairList[centerId].totalShare -= amount;
            }
            userShares[from].share -= amount;
        }
    }
}