// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit:
pragma solidity 0.8.17;

import "../ReentrancyGuardKeccak.sol";
import "../interfaces/facets/IWithdrawalIntentFacet.sol";
import "../lib/SolvencyMethods.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";


contract WithdrawalIntentFacet is IWithdrawalIntentFacet, ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    function createWithdrawalIntent(bytes32 _asset, uint256 _amount) external onlyOwner nonReentrant {
        require(_amount > 0, "Amount must be greater than zero");

        IERC20Metadata token = getERC20TokenInstance(_asset, true);
        address tokenAddress = address(token);

        _removeExpiredIntents(tokenAddress);

        uint256 availableBalance = getAvailableBalance(_asset);
        if(_amount > availableBalance) {
            revert InsufficientAvailableBalance(_amount, availableBalance);
        }

        DiamondStorageLib.WithdrawalIntentsStorage storage wis = DiamondStorageLib.withdrawalIntentsStorage();
        uint256 actionableAt = block.timestamp + 24 hours;
        uint256 expiresAt = actionableAt + 48 hours;

        wis.intents[tokenAddress].push(DiamondStorageLib.WithdrawalIntent({
            amount: _amount,
            actionableAt: actionableAt,
            expiresAt: expiresAt
        }));
        wis.totalPendingAmount[tokenAddress] += _amount;

        emit WithdrawalIntentCreated(_asset, _amount, actionableAt, expiresAt);
    }

    function executeWithdrawalIntent(bytes32 _asset, uint256[] calldata intentIndices) external onlyOwner nonReentrant canRepayDebtFully remainsSolvent {
        IERC20Metadata token = getERC20TokenInstance(_asset, true);
        address tokenAddress = address(token);

        uint256 finalAmount = validateWithdrawalIntents(tokenAddress, intentIndices);
        require(finalAmount > 0, "No valid amount to withdraw");

        DiamondStorageLib.WithdrawalIntentsStorage storage wis = DiamondStorageLib.withdrawalIntentsStorage();
        DiamondStorageLib.WithdrawalIntent[] storage intents = wis.intents[tokenAddress];

        // Remove intents from highest to lowest index
        for(uint256 i = intentIndices.length; i > 0; i--) {
            uint256 indexToRemove = intentIndices[i - 1];
            wis.totalPendingAmount[tokenAddress] -= intents[indexToRemove].amount;

            uint256 lastIndex = intents.length - 1;
            if (indexToRemove != lastIndex) {
                intents[indexToRemove] = intents[lastIndex];
            }
            intents.pop();
        }

        address(token).safeTransfer(msg.sender, finalAmount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, tokenAddress, finalAmount);

        emit WithdrawalIntentExecuted(_asset, finalAmount, block.timestamp);
    }

    function cancelWithdrawalIntent(bytes32 _asset, uint256 intentIndex) external onlyOwner nonReentrant {
        address tokenAddress = address(getERC20TokenInstance(_asset, true));
        DiamondStorageLib.WithdrawalIntentsStorage storage wis = DiamondStorageLib.withdrawalIntentsStorage();
        DiamondStorageLib.WithdrawalIntent[] storage intents = wis.intents[tokenAddress];

        require(intentIndex < intents.length, "Invalid intent index");

        uint256 amount = intents[intentIndex].amount;
        wis.totalPendingAmount[tokenAddress] -= amount;

        uint256 lastIndex = intents.length - 1;
        if (intentIndex != lastIndex) {
            intents[intentIndex] = intents[lastIndex];
        }
        intents.pop();

        emit WithdrawalIntentCanceled(_asset, amount, block.timestamp);
    }

    function clearExpiredIntents(bytes32 _asset) external {
        address tokenAddress = address(getERC20TokenInstance(_asset, true));
        _removeExpiredIntents(tokenAddress);
    }

    function _removeExpiredIntents(address tokenAddress) internal {
        DiamondStorageLib.WithdrawalIntentsStorage storage wis = DiamondStorageLib.withdrawalIntentsStorage();
        DiamondStorageLib.WithdrawalIntent[] storage intents = wis.intents[tokenAddress];

        uint256 i = 0;
        while (i < intents.length) {
            if (block.timestamp > intents[i].expiresAt) {
                wis.totalPendingAmount[tokenAddress] -= intents[i].amount;
                uint256 lastIndex = intents.length - 1;
                if (i != lastIndex) {
                    intents[i] = intents[lastIndex];
                }
                intents.pop();
            } else {
                i++;
            }
        }
    }

    function validateWithdrawalIntents(
        address tokenAddress,
        uint256[] calldata intentIndices
    ) internal view returns (uint256 finalAmount) {
        require(intentIndices.length > 0, "Must provide at least one intent");

        DiamondStorageLib.WithdrawalIntentsStorage storage wis = DiamondStorageLib.withdrawalIntentsStorage();
        DiamondStorageLib.WithdrawalIntent[] storage intents = wis.intents[tokenAddress];

        uint256 totalAmount = 0;

        for(uint256 i = 0; i < intentIndices.length; i++) {
            require(
                i == 0 || intentIndices[i] > intentIndices[i-1],
                "Intent indices must be strictly increasing"
            );

            uint256 index = intentIndices[i];
            require(index < intents.length, "Invalid intent index");

            DiamondStorageLib.WithdrawalIntent storage intent = intents[index];
            require(block.timestamp >= intent.actionableAt, "Intent not matured");
            require(block.timestamp <= intent.expiresAt, "Intent expired");

            totalAmount += intent.amount;
        }

        return totalAmount;
    }

    function getUserIntents(bytes32 _asset) external view returns (IntentInfo[] memory) {
        address tokenAddress = address(getERC20TokenInstance(_asset, true));
        DiamondStorageLib.WithdrawalIntentsStorage storage wis = DiamondStorageLib.withdrawalIntentsStorage();
        DiamondStorageLib.WithdrawalIntent[] storage intents = wis.intents[tokenAddress];

        IntentInfo[] memory intentInfos = new IntentInfo[](intents.length);

        for (uint256 i = 0; i < intents.length; i++) {
            DiamondStorageLib.WithdrawalIntent storage intent = intents[i];
            intentInfos[i] = IntentInfo({
                amount: intent.amount,
                actionableAt: intent.actionableAt,
                expiresAt: intent.expiresAt,
                isPending: block.timestamp < intent.actionableAt,
                isActionable: block.timestamp >= intent.actionableAt && block.timestamp <= intent.expiresAt,
                isExpired: block.timestamp > intent.expiresAt
            });
        }

        return intentInfos;
    }

    function getTotalIntentAmount(bytes32 _asset) public view returns (uint256) {
        address tokenAddress = address(getERC20TokenInstance(_asset, true));
        return DiamondStorageLib.withdrawalIntentsStorage().totalPendingAmount[tokenAddress];
    }

    function getAvailableBalance(bytes32 _asset) public view returns (uint256) {
        IERC20Metadata token = getERC20TokenInstance(_asset, true);
        address tokenAddress = address(token);
        uint256 balance = token.balanceOf(address(this));
        uint256 pendingWithdrawals = getTotalIntentAmount(_asset);
        return balance > pendingWithdrawals ? balance - pendingWithdrawals : 0;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    error InsufficientAvailableBalance(uint256 amount, uint256 availableBalance);
}
