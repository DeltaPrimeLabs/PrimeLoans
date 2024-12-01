// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract AddressBlacklist {
    address public owner;
    mapping(address => bool) private blacklist;
    address[] private blacklistedAddresses;
    mapping(address => uint256) private addressToIndex;

    event AddressBlacklisted(address indexed account);
    event AddressRemovedFromBlacklist(address indexed account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchBlacklisted(uint256 count);
    event BatchRemovedFromBlacklist(uint256 count);

    modifier onlyOwner() {
        require(msg.sender == owner, "AddressBlacklist: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "AddressBlacklist: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function blacklistAddresses(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;
        require(length > 0, "AddressBlacklist: empty array");

        uint256 addedCount = 0;
        for (uint256 i = 0; i < length; i++) {
            address account = accounts[i];
            if (account == address(0)) continue; // Skip zero address
            if (blacklist[account]) continue;    // Skip already blacklisted

            blacklist[account] = true;
            addressToIndex[account] = blacklistedAddresses.length;
            blacklistedAddresses.push(account);

            emit AddressBlacklisted(account);
            addedCount++;
        }

        emit BatchBlacklisted(addedCount);
    }

    function removeFromBlacklistBatch(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;
        require(length > 0, "AddressBlacklist: empty array");

        uint256 removedCount = 0;
        for (uint256 i = 0; i < length; i++) {
            address account = accounts[i];
            if (account == address(0)) continue; // Skip zero address
            if (!blacklist[account]) continue;   // Skip non-blacklisted

            // Get the index of the address to remove
            uint256 indexToRemove = addressToIndex[account];
            uint256 lastIndex = blacklistedAddresses.length - 1;

            if (indexToRemove != lastIndex) {
                // Move the last address to the index being removed
                address lastAddress = blacklistedAddresses[lastIndex];
                blacklistedAddresses[indexToRemove] = lastAddress;
                addressToIndex[lastAddress] = indexToRemove;
            }

            // Remove the last element
            blacklistedAddresses.pop();
            delete blacklist[account];
            delete addressToIndex[account];

            emit AddressRemovedFromBlacklist(account);
            removedCount++;
        }

        emit BatchRemovedFromBlacklist(removedCount);
    }

    // Original single-address functions maintained for backward compatibility
    function blacklistAddress(address account) external onlyOwner {
        require(account != address(0), "AddressBlacklist: cannot blacklist zero address");
        require(!blacklist[account], "AddressBlacklist: address already blacklisted");

        blacklist[account] = true;
        addressToIndex[account] = blacklistedAddresses.length;
        blacklistedAddresses.push(account);

        emit AddressBlacklisted(account);
    }

    function removeFromBlacklist(address account) external onlyOwner {
        require(account != address(0), "AddressBlacklist: cannot remove zero address");
        require(blacklist[account], "AddressBlacklist: address not blacklisted");

        uint256 indexToRemove = addressToIndex[account];
        uint256 lastIndex = blacklistedAddresses.length - 1;

        if (indexToRemove != lastIndex) {
            address lastAddress = blacklistedAddresses[lastIndex];
            blacklistedAddresses[indexToRemove] = lastAddress;
            addressToIndex[lastAddress] = indexToRemove;
        }

        blacklistedAddresses.pop();
        delete blacklist[account];
        delete addressToIndex[account];

        emit AddressRemovedFromBlacklist(account);
    }

    // View functions
    function isBlacklisted(address account) external view returns (bool) {
        return blacklist[account];
    }

    function getAllBlacklistedAddresses() external view returns (address[] memory) {
        return blacklistedAddresses;
    }

    function getBlacklistCount() external view returns (uint256) {
        return blacklistedAddresses.length;
    }
}