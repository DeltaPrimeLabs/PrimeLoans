// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import {SolvencyFacetProd} from "../../facets/SolvencyFacetProd.sol";
import "../../lib/uniswap-v3/FullMath.sol";
import "../vPrimeController.sol";

contract SPrimeMock is ERC20, Ownable, ProxyConnector {
    struct LockDetails {
        uint256 lockTime;
        uint256 amount;
        uint256 unlockTime;
    }

    vPrimeController public vPrimeControllerContract;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;
    uint256 public immutable DOLLAR_VALUE_MULTIPLIER;

    mapping(address => LockDetails[]) public locks;

    // TODO: _DOLLAR_VALUE_MULTIPLIER is only for mocking of dollar value calculation, we need to replace it with actual calculation in the final implementation
    constructor(string memory name, string memory symbol, uint256 _DOLLAR_VALUE_MULTIPLIER) ERC20(name, symbol) {
        DOLLAR_VALUE_MULTIPLIER = _DOLLAR_VALUE_MULTIPLIER;
    }

    function increaseBalance(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
        proxyCalldata(
            address(vPrimeControllerContract),
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", account),
            false
        );
    }

    function getFullyVestedLockedBalance(address account) public view returns (uint256 fullyVestedBalance) {
        fullyVestedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                fullyVestedBalance += FullMath.mulDiv(locks[account][i].amount, locks[account][i].lockTime, MAX_LOCK_TIME);
            }
        }
    }

    function setVPrimeControllerContract(address _vPrimeControllerContract) public onlyOwner {
        vPrimeControllerContract = vPrimeController(_vPrimeControllerContract);
    }

    function decreaseBalance(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
        proxyCalldata(
            address(vPrimeControllerContract),
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", account),
            false
        );
    }

    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                lockedBalance += locks[account][i].amount;
            }
        }
        return lockedBalance;
    }

    function lockBalance(uint256 amount, uint256 lockTime) public {
        uint256 lockedBalance = getLockedBalance(msg.sender);
        require(balanceOf(msg.sender) - lockedBalance >= amount, "Insufficient balance to lock");
        require(lockTime <= MAX_LOCK_TIME, "Cannot lock for more than 3 years");
        locks[msg.sender].push(LockDetails({
            lockTime: lockTime,
            amount: amount,
            unlockTime: block.timestamp + lockTime
        }));
        // TODO: Add event
        proxyCalldata(
            address(vPrimeControllerContract),
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", msg.sender),
            false
        );
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if(from != address(0)) {
            uint256 lockedBalance = getLockedBalance(msg.sender);
            require(amount <= balanceOf(from) - lockedBalance, "Balance is locked");
        }
    }

    function getTokenY() public view returns (address) {
        return 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7; // WAVAX 18 decimals
    }

    function getUserValueInTokenY(address userAddress) public view returns (uint256) {
        return balanceOf(userAddress) * DOLLAR_VALUE_MULTIPLIER;
    }
}