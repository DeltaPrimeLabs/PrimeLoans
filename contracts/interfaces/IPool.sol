// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPool is IERC20 {
    function getLockedBalance(address account) external view returns (uint256);
    function lockDeposit(uint256 amount, uint256 lockTime) external;
    function getFullyVestedLockedBalance(address account) external view returns (uint256);
    function setVPrimeController(address _vPrimeController) external;
    function deposit(uint256 _amount) external;
    function depositOnBehalf(uint256 _amount, address _of) external;
    function withdraw(uint256 _amount) external;
    function borrow(uint256 _amount) external;
    function repay(uint256 amount) external;
    function getBorrowed(address _user) external view returns (uint256);
    function balanceOf(address user) external view override returns (uint256);
    function getDepositRate() external view returns (uint256);
    function getBorrowingRate() external view returns (uint256);
    function getFullPoolStatus() external view returns (uint256[5] memory);
    function recoverSurplus(uint256 amount, address account) external;
    function isWithdrawalAmountAvailable(address account, uint256 amount) external view returns (bool);
    function getMaxPoolUtilisationForBorrowing() external view returns (uint256);
    function totalBorrowed() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
    function totalSupplyCap() external view returns (uint256);
    function ratesCalculator() external view returns (address);
    function borrowersRegistry() external view returns (address);
    function poolRewarder() external view returns (address);
    function depositIndex() external view returns (address);
    function borrowIndex() external view returns (address);
    function tokenAddress() external view returns (address);
    function vestingDistributor() external view returns (address);
    function vPrimeControllerContract() external view returns (address);

    /**
     * @dev emitted after the user deposits funds
     * @param user the address performing the deposit
     * @param value the amount deposited
     * @param timestamp of the deposit
     **/
    event Deposit(address indexed user, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user deposits funds on behalf of other user
     * @param user the address performing the deposit
     * @param _of the address on behalf of which the deposit is being performed
     * @param value the amount deposited
     * @param timestamp of the deposit
     **/
    event DepositOnBehalfOf(address indexed user, address indexed _of, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user withdraws funds
     * @param user the address performing the withdrawal
     * @param value the amount withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawal(address indexed user, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user borrows funds
     * @param user the address that borrows
     * @param value the amount borrowed
     * @param timestamp time of the borrowing
     **/
    event Borrowing(address indexed user, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after the user repays debt
     * @param user the address that repays debt
     * @param value the amount repaid
     * @param timestamp of the repayment
     **/
    event Repayment(address indexed user, uint256 value, uint256 timestamp);

    /**
     * @dev emitted after accumulating deposit interest
     * @param user the address that the deposit interest is accumulated for
     * @param value the amount that interest is calculated from
     * @param timestamp of the interest accumulation
     **/
    event InterestCollected(address indexed user, uint256 value, uint256 timestamp);

    /**
    * @dev emitted after changing borrowers registry
    * @param registry an address of the newly set borrowers registry
    * @param timestamp of the borrowers registry change
    **/
    event BorrowersRegistryChanged(address indexed registry, uint256 timestamp);

    /**
    * @dev emitted after changing rates calculator
    * @param calculator an address of the newly set rates calculator
    * @param timestamp of the borrowers registry change
    **/
    event RatesCalculatorChanged(address indexed calculator, uint256 timestamp);

    /**
    * @dev emitted after changing pool rewarder
    * @param poolRewarder an address of the newly set pool rewarder
    * @param timestamp of the pool rewarder change
    **/
    event PoolRewarderChanged(address indexed poolRewarder, uint256 timestamp);


    /**
     * @dev emitted after the user locks deposit
     * @param user the address that locks the deposit
     * @param amount the amount locked
     * @param lockTime the time for which the deposit is locked
     * @param unlockTime the time when the deposit will be unlocked
     **/
    event DepositLocked(address indexed user, uint256 amount, uint256 lockTime, uint256 unlockTime);
}