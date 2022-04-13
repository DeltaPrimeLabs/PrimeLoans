// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IAssetsExchange.sol";
import "./Pool.sol";
import "./SmartLoanProperties.sol";
import "./lib/SmartLoanLib.sol";


/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract SmartLoan is SmartLoanProperties, PriceAware, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using TransferHelper for address payable;
  using TransferHelper for address;
  using EnumerableMap for EnumerableMap.Map;
  using SmartLoanLib for bytes32[];

  function initialize() external initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    SmartLoanLib.addUniqueAsset(swapOwnedAssets, "AVAX");
  }


  /* ========== LOAN INVESTMENTS ========== */

  // TODO: Invest/Redeem will be replaced with a single swap() method once the ERC20-pools will be implemented.

  /**
   * Invests an amount to buy an asset
   * @param _asset code of the asset
   * @param _exactERC20AmountOut exact amount of asset to buy
   * @param _maxAvaxAmountIn maximum amount of AVAX to sell
   * @dev This function uses the redstone-evm-connector
   **/
  function invest(bytes32 _integration, bytes32 _asset, uint256 _exactERC20AmountOut, uint256 _maxAvaxAmountIn) external onlyOwner nonReentrant remainsSolvent {
    require(address(this).balance >= _maxAvaxAmountIn, "Insufficient funds");

    bool success = getDPRouterV1().buy{value: _maxAvaxAmountIn}(_integration, _asset, _exactERC20AmountOut);
    require(success, "Investment failed");
    swapOwnedAssets.addUniqueAsset(_asset);
    
    emit Invested(msg.sender, _asset, _exactERC20AmountOut, block.timestamp);
  }

  /**
   * Redeem an investment by selling an asset
   * @param _asset code of the asset
   * @param _exactERC20AmountIn exact amount of token to sell
   * @param _minAvaxAmountOut minimum amount of the AVAX token to buy
   * @dev This function uses the redstone-evm-connector
   **/
  function redeem(bytes32 _integration, bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut) external nonReentrant onlyOwner remainsSolvent {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    DPRouterV1 dpRouter = getDPRouterV1();
    address(token).safeTransfer(address(dpRouter), _exactERC20AmountIn);

    bool success = dpRouter.sell(_integration, _asset, _exactERC20AmountIn, _minAvaxAmountOut);
    require(success, "Redemption failed");
    if(token.balanceOf(address(this)) == 0) {
      swapOwnedAssets.removeAsset(_asset);
    }

    emit Redeemed(msg.sender, _asset, _exactERC20AmountIn, block.timestamp);
  }

  function stake(bytes32 _integrationID, bytes32 _asset, uint256 _amount) public payable onlyOwner nonReentrant remainsSolvent {
    DPRouterV1 dpRouter = getDPRouterV1();
    if(_asset == "AVAX") {
      require(address(this).balance >= _amount, "Not enough AVAX available");
    } else {
      // TODO: check for ERC20 balance?
      address(dpRouter.getStakingContract(_integrationID, _asset)).safeApprove(address(dpRouter), _amount);
    }
    require(dpRouter.stakeFor{value: _amount}(_integrationID, _asset, _amount), "Staking failed");
    stakingOwnedAssets.addUniqueAsset(_asset);
  }

  function unstake(bytes32 _integrationID, bytes32 _asset, uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
    DPRouterV1 dpRouter = getDPRouterV1();
    StakingToken stakingContract = dpRouter.getStakingContract(_integrationID, _asset);
    address(stakingContract).safeTransfer(address(dpRouter), _amount);

    require(dpRouter.unstake(_integrationID, _asset, _amount), "Unstaking failed");
    if(stakingContract.balanceOf(address(this)) == 0) {
      stakingOwnedAssets.removeAsset(_asset);
    }
  }


  /* ========== FUNDING METHODS ========== */

  /**
   * Funds a loan with the value attached to the transaction
   **/
  function fund() public virtual payable {
    emit Funded(msg.sender, msg.value, block.timestamp);
  }

  /**
   * Withdraws an amount from the loan
   * This method could be used to cash out profits from investments
   * The loan needs to remain solvent after the withdrawal
   * @param _amount to be withdrawn
   * @dev This function uses the redstone-evm-connector
   **/
  function withdraw(uint256 _amount) public virtual onlyOwner nonReentrant remainsSolvent {
    require(address(this).balance >= _amount, "Insufficient funds");

    payable(msg.sender).safeTransferETH(_amount);

    emit Withdrawn(msg.sender, _amount, block.timestamp);
  }

  /**
   * Borrows funds from the pool
   * @param _amount of funds to borrow
   * @dev This function uses the redstone-evm-connector
   **/
  function borrow(uint256 _amount) external onlyOwner remainsSolvent {
    getPool().borrow(_amount);

    emit Borrowed(msg.sender, _amount, block.timestamp);
  }

  /**
   * Repays funds to the pool
   * @param _amount of funds to repay
   * @dev This function uses the redstone-evm-connector
   **/
  function repay(uint256 _amount) public payable {
    if (isSolvent() && _liquidationInProgress == false) {
      require(msg.sender == owner());
    }

    _amount = Math.min(_amount, getDebt());
    require(address(this).balance >= _amount, "Not enough funds to repay the loan");

    getPool().repay{value: _amount}();

    emit Repaid(msg.sender, _amount, block.timestamp);
  }


  /* ========== LOAN OPERATIONS ========== */

  /**
   * This function can only be accessed by the owner and allows selling all of the assets.
   * @dev This function uses the redstone-evm-connector
   **/
  function closeLoan() public virtual payable onlyOwner nonReentrant remainsSolvent {
    bytes32[] memory assets = swapOwnedAssets;
    for (uint256 i = 0; i < assets.length; i++) {
      uint256 balance = getERC20TokenInstance(assets[i]).balanceOf(address(this));
      if (balance > 0) {
        sellAsset(assets[i], "ANY", balance, 0);
      }
    }

    uint256 debt = getDebt();
    require(address(this).balance >= debt, "Debt not repaid fully");
    repay(debt);
    emit LoanClosed(debt, address(this).balance, block.timestamp);

    uint256 balance = address(this).balance;
    if (balance > 0) {
      payable(msg.sender).safeTransferETH(balance);
      emit Withdrawn(msg.sender, balance, block.timestamp);
    }
  }

  /**
  * @dev This function uses the redstone-evm-connector
  **/
  function liquidateLoan(uint256 repayAmount) external payable nonReentrant successfulLiquidation {
    uint256 debt = getDebt();
    if (repayAmount > debt) {
      repayAmount = debt;
    }
    uint256 bonus = (repayAmount * getLiquidationBonus()) / getPercentagePrecision();
    uint256 totalRepayAmount = repayAmount + bonus;

    sellout(totalRepayAmount);
    attemptRepay(repayAmount);
    payBonus(bonus);
    emit Liquidated(msg.sender, repayAmount, bonus, getLTV(), block.timestamp);
  }

  /**
   * @dev This function uses the redstone-evm-connector
  **/
  function withdrawAsset(bytes32 asset, uint256 amount) external onlyOwner nonReentrant remainsSolvent {
    IERC20Metadata token = getERC20TokenInstance(asset);
    address(token).safeTransfer(msg.sender, amount);
  }


  /* ========== INTERNAL METHODS ========== */

  /**
   * This function allows selling assets without checking if the loan will remain solvent after this operation.
   * It is used as part of the sellout() function which sells part/all of assets in order to bring the loan back to solvency.
   * It is possible that multiple different assets will have to be sold and for that reason we do not use the remainsSolvent modifier.
   **/
  function sellAsset(bytes32 _asset, bytes32 _integrationID, uint256 _amount, uint256 _minAvaxOut) internal {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    DPRouterV1 dpRouter = getDPRouterV1();
    address(token).safeTransfer(address(dpRouter), _amount);

    bool success = dpRouter.sell(_integrationID, _asset, _amount, _minAvaxOut);
    if (success) {
      emit Redeemed(msg.sender, _asset, _amount, block.timestamp);
    }
  }

  /**
   * This function attempts to sell just enough asset to receive targetAvaxAmount.
   * If there is not enough asset's balance to cover the whole targetAvaxAmount then the whole asset's balance
   * is being sold.
   * It is possible that multiple different assets will have to be sold and for that reason we do not use the remainsSolvent modifier.
   **/
  function sellAssetForTargetAvax(bytes32 _asset, uint256 targetAvaxAmount) private {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    uint256 balance = token.balanceOf(address(this));
    if (balance > 0) {
      uint256 minSaleAmount = getDPRouterV1().getMinimumERC20TokenAmountForExactAVAX("ANY", _asset, targetAvaxAmount);
      if (balance < minSaleAmount) {
        sellAsset(_asset, "ANY", balance, 0);
      } else {
        sellAsset(_asset, "ANY", minSaleAmount, targetAvaxAmount);
      }
    }
  }

  /**
   * This function attempts to repay the _repayAmount back to the pool.
   * If there is not enough AVAX balance to repay the _repayAmount then the available AVAX balance will be repaid.
   * @dev This function uses the redstone-evm-connector
   **/
  function attemptRepay(uint256 _repayAmount) internal {
    repay(Math.min(address(this).balance, _repayAmount));
  }

  function payBonus(uint256 _bonus) internal {
    payable(msg.sender).safeTransferETH(Math.min(_bonus, address(this).balance));
  }

  function selloutStakedAssets(uint256 targetAvaxAmount) private returns(bool) {
    DPRouterV1 dpRouter = getDPRouterV1();
    for(uint i=0; i<stakingOwnedAssets.length; i++) {
      if (address(this).balance >= targetAvaxAmount) return true;
      StakingToken stakingContract = dpRouter.getStakingContract("ANY", stakingOwnedAssets[i]);
      // TODO: Move to approve -> [dpRouter]transfer to itself pattern?
      address(stakingContract).safeTransfer(address(dpRouter), stakingContract.balanceOf(address(this)));
      dpRouter.unstakeAssetForASpecifiedAmount(stakingOwnedAssets[i], targetAvaxAmount - address(this).balance);
    }
    return true;
  }

  /**
   * This function role is to sell part/all of the available assets in order to receive the targetAvaxAmount.
   *
   **/
  function sellout(uint256 targetAvaxAmount) private {
    bool stakingSelloutSuccess = selloutStakedAssets(targetAvaxAmount);
    if (address(this).balance >= targetAvaxAmount) return;

    for (uint256 i = 0; i < swapOwnedAssets.length; i++) {
      if (address(this).balance >= targetAvaxAmount) break;
      sellAssetForTargetAvax(swapOwnedAssets[i], targetAvaxAmount - address(this).balance);
    }
  }


  /* ========== VIEW METHODS ========== */

  /**
   * Returns the current value of a loan in AVAX including cash and investments
   * @dev This function uses the redstone-evm-connector
   **/
  function getTotalValue() public view virtual returns (uint256) {
    uint256 total = address(this).balance;
    bytes32[] memory assets = swapOwnedAssets;

    // TODO: Ensure that assets' prices are returned in the order of the assets passed as an argument
    uint256[] memory prices = getPricesFromMsg(assets);
    uint256 avaxPrice = prices[0];
    require(avaxPrice != 0, "Avax price returned from oracle is zero");

    for (uint256 i = 1; i < prices.length; i++) {
      require(prices[i] != 0, "Asset price returned from oracle is zero");

      bytes32 _asset = assets[i];
      IERC20Metadata token = getERC20TokenInstance(_asset);
      uint256 assetBalance = getBalance(address(this), _asset);

      total = total + (prices[i] * 10**18 * assetBalance) / (avaxPrice * 10**token.decimals());
    }

    // TODO: Refactor with future integrations and make it more generic
    total += getDPRouterV1().getTotalStakedValue("YIELDYAKV1");

    return total;
  }

  /**
     * Returns the current debt associated with the loan
     **/
  function getDebt() public view virtual returns (uint256) {
    return getPool().getBorrowed(address(this));
  }

  /**
   * LoanToValue ratio is calculated as the ratio between debt and collateral.
   * The collateral is equal to total loan value takeaway debt.
   * @dev This function uses the redstone-evm-connector
   **/
  function getLTV() public view returns (uint256) {
    uint256 debt = getDebt();
    uint256 totalValue = getTotalValue();
    if (debt == 0) {
      return 0;
    } else if (debt < totalValue) {
      return (debt * getPercentagePrecision()) / (totalValue - debt);
    } else {
      return getMaxLtv();
    }
  }

  function getFullLoanStatus() public view returns (uint256[4] memory) {
    return [getTotalValue(), getDebt(), getLTV(), isSolvent() ? uint256(1) : uint256(0)];
  }

  /**
   * Checks if the loan is solvent.
   * It means that the ratio between debt and collateral is below safe level,
   * which is parametrized by the getMaxLtv()
   * @dev This function uses the redstone-evm-connector
   **/
  function isSolvent() public view returns (bool) {
    return getLTV() < getMaxLtv();
  }

  /**
   * Returns the current balance of the asset held by a given user
   * @dev _asset the code of an asset
   * @dev _user the address of queried user
   **/
  function getBalance(address _user, bytes32 _asset) public view returns (uint256) {
    IERC20 token = IERC20(getSwapAssetAddress(_asset));
    return token.balanceOf(_user);
  }

  function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
    address assetAddress = getSwapAssetAddress(_asset);
    IERC20Metadata token = IERC20Metadata(assetAddress);
    return token;
  }

  function getSwapAssetAddress(bytes32 _asset) internal view returns(address) {
    return getDPRouterV1().getSwapAssetAddress(_asset);
  }


  receive() external payable {}

  /* ========== MODIFIERS ========== */

  /**
  * @dev This modifier uses the redstone-evm-connector
  **/
  modifier remainsSolvent() {
    _;

    require(isSolvent(), "The action may cause an account to become insolvent");
  }

  /**
   * This modifier checks if the LTV is between MIN_SELLOUT_LTV and _MAX_LTV after performing the liquidateLoan() operation.
   * If the liquidateLoan() was not called by the owner then an additional check of making sure that LTV > MIN_SELLOUT_LTV is applied.
   * It protects the user from an unnecessarily costly liquidation.
   * The loan must be solvent after the liquidateLoan() operation.
   * @dev This modifier uses the redstone-evm-connector
   **/
  modifier successfulLiquidation() {
    require(!isSolvent(), "Cannot sellout a solvent account");
    _liquidationInProgress = true;

    _;

    uint256 LTV = getLTV();
    if (msg.sender != owner()) {
      require(LTV >= getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
    }
    require(LTV < getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
    _liquidationInProgress = false;
  }


  /* ========== PRICEAWARE METHODS ========== */

  /**
   * Override PriceAware method, addresses below belong to authorized signers of data feeds
   **/
  function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
    return (_receivedSigner == getPriceProvider1()) || (_receivedSigner == getPriceProvider2());
  }

  /**
   * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
   **/
  function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
    return MAX_BLOCK_TIMESTAMP_DELAY;
  }


  /* ========== EVENTS ========== */

  /**
   * @dev emitted after a loan is funded
   * @param funder the address which funded the loan
   * @param amount the amount of funds
   * @param timestamp time of funding
   **/
  event Funded(address indexed funder, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted after the funds are withdrawn from the loan
   * @param owner the address which withdraws funds from the loan
   * @param amount the amount of funds withdrawn
   * @param timestamp of the withdrawal
   **/
  event Withdrawn(address indexed owner, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted after the funds are invested into an asset
   * @param investor the address of investor making the purchase
   * @param asset bought by the investor
   * @param amount the investment
   * @param timestamp time of the investment
   **/
  event Invested(address indexed investor, bytes32 indexed asset, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted after the investment is sold
   * @param investor the address of investor selling the asset
   * @param asset sold by the investor
   * @param amount the investment
   * @param timestamp of the redemption
   **/
  event Redeemed(address indexed investor, bytes32 indexed asset, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted when funds are borrowed from the pool
   * @param borrower the address of borrower
   * @param amount of the borrowed funds
   * @param timestamp time of the borrowing
   **/
  event Borrowed(address indexed borrower, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted when funds are repaid to the pool
   * @param borrower the address initiating repayment
   * @param amount of repaid funds
   * @param timestamp of the repayment
   **/
  event Repaid(address indexed borrower, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted after a successful liquidation operation
   * @param liquidator the address that initiated the liquidation operation
   * @param repayAmount requested amount (AVAX) of liquidation
   * @param bonus an amount of bonus (AVAX) received by the liquidator
   * @param ltv a new LTV after the liquidation operation
   * @param timestamp a time of the liquidation
   **/
  event Liquidated(address indexed liquidator, uint256 repayAmount, uint256 bonus, uint256 ltv, uint256 timestamp);

  /**
   * @dev emitted after closing a loan by the owner
   * @param debtRepaid the amount of a borrowed AVAX that was repaid back to the pool
   * @param withdrawalAmount the amount of AVAX that was withdrawn by the owner after closing the loan
   * @param timestamp a time of the loan's closure
   **/
  event LoanClosed(uint256 debtRepaid, uint256 withdrawalAmount, uint256 timestamp);
}