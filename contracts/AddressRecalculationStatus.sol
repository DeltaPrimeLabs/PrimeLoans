// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract AddressRecalculationStatus {
    address public owner;
    mapping(address => bool) private needsRecalculation;
    address[] private addressesNeedingRecalculation;
    mapping(address => uint256) private addressToIndex;

    event AddressNeedsRecalculation(address indexed account);
    event AddressRecalculationComplete(address indexed account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchMarkedForRecalculation(uint256 count);
    event BatchRecalculationComplete(uint256 count);

    modifier onlyOwner() {
        require(msg.sender == owner, "AddressRecalculationStatus: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "AddressRecalculationStatus: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function markForRecalculation(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;
        require(length > 0, "AddressRecalculationStatus: empty array");

        uint256 addedCount = 0;
        for (uint256 i = 0; i < length; i++) {
            address account = accounts[i];
            if (account == address(0)) continue; // Skip zero address
            if (needsRecalculation[account]) continue;    // Skip already marked

            needsRecalculation[account] = true;
            addressToIndex[account] = addressesNeedingRecalculation.length;
            addressesNeedingRecalculation.push(account);

            emit AddressNeedsRecalculation(account);
            addedCount++;
        }

        emit BatchMarkedForRecalculation(addedCount);
    }

    function markRecalculationCompleteBatch(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;
        require(length > 0, "AddressRecalculationStatus: empty array");

        uint256 completedCount = 0;
        for (uint256 i = 0; i < length; i++) {
            address account = accounts[i];
            if (account == address(0)) continue; // Skip zero address
            if (!needsRecalculation[account]) continue;   // Skip addresses not marked

            // Get the index of the address to remove
            uint256 indexToRemove = addressToIndex[account];
            uint256 lastIndex = addressesNeedingRecalculation.length - 1;

            if (indexToRemove != lastIndex) {
                // Move the last address to the index being removed
                address lastAddress = addressesNeedingRecalculation[lastIndex];
                addressesNeedingRecalculation[indexToRemove] = lastAddress;
                addressToIndex[lastAddress] = indexToRemove;
            }

            // Remove the last element
            addressesNeedingRecalculation.pop();
            delete needsRecalculation[account];
            delete addressToIndex[account];

            emit AddressRecalculationComplete(account);
            completedCount++;
        }

        emit BatchRecalculationComplete(completedCount);
    }

    // Original single-address functions maintained for backward compatibility
    function markAddressForRecalculation(address account) external onlyOwner {
        require(account != address(0), "AddressRecalculationStatus: cannot mark zero address");
        require(!needsRecalculation[account], "AddressRecalculationStatus: address already marked for recalculation");

        needsRecalculation[account] = true;
        addressToIndex[account] = addressesNeedingRecalculation.length;
        addressesNeedingRecalculation.push(account);

        emit AddressNeedsRecalculation(account);
    }

    function markRecalculationComplete(address account) external onlyOwner {
        require(account != address(0), "AddressRecalculationStatus: cannot mark zero address");
        require(needsRecalculation[account], "AddressRecalculationStatus: address not marked for recalculation");

        uint256 indexToRemove = addressToIndex[account];
        uint256 lastIndex = addressesNeedingRecalculation.length - 1;

        if (indexToRemove != lastIndex) {
            address lastAddress = addressesNeedingRecalculation[lastIndex];
            addressesNeedingRecalculation[indexToRemove] = lastAddress;
            addressToIndex[lastAddress] = indexToRemove;
        }

        addressesNeedingRecalculation.pop();
        delete needsRecalculation[account];
        delete addressToIndex[account];

        emit AddressRecalculationComplete(account);
    }

    // View functions
    function needsRecalculationCheck(address account) external view returns (bool) {
        return needsRecalculation[account];
    }

    function getAllAddressesNeedingRecalculation() external view returns (address[] memory) {
        return addressesNeedingRecalculation;
    }

    function getRecalculationCount() external view returns (uint256) {
        return addressesNeedingRecalculation.length;
    }
}