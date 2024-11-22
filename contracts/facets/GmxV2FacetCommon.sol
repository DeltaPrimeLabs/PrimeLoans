// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../interfaces/ITokenManager.sol";

import "../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/gmx-v2/EventUtils.sol";
import "../interfaces/gmx-v2/IDepositUtils.sol";
import "../interfaces/gmx-v2/IWithdrawalUtils.sol";
import "../interfaces/gmx-v2/IGmxV2Router.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

abstract contract GmxV2FacetCommon is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // GMX contracts
    function getGmxV2Router() internal pure virtual returns (address);

    function getGmxV2ExchangeRouter() internal pure virtual returns (address);

    function getGmxV2DepositVault() internal pure virtual returns (address);

    function getGmxV2WithdrawalVault() internal pure virtual returns (address);

    function isWithinBounds(uint256 _estimate, uint256 _userInput) internal pure returns(bool) {
        if(_estimate * 95 / 100 <= _userInput && _estimate * 105 / 100 >= _userInput) {
            return true;
        }
        return false;
    }

    // MODIFIERS
    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
