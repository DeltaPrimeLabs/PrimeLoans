// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BtcEligibleUsersList is Ownable{
    address[] public eligibleUsersList;

    constructor(address[] memory _eligibleUsersList){
        eligibleUsersList = _eligibleUsersList;
        _transferOwnership(0xBd2413135f3aab57195945A046cCA4e4bacD5a5b);
    }

    // only owner function to add users to eligible list
    function addEligibleUsers(address[] calldata _eligibleUsers) external onlyOwner {
        for (uint256 i = 0; i < _eligibleUsers.length; i++) {
            eligibleUsersList.push(_eligibleUsers[i]);
        }
    }

    /// only owner function to remove users from eligible list
    function removeEligibleUsers(address[] calldata _eligibleUsers) external onlyOwner {
        for (uint256 i = 0; i < _eligibleUsers.length; i++) {
            for (uint256 j = 0; j < eligibleUsersList.length; j++) {
                if (eligibleUsersList[j] == _eligibleUsers[i]) {
                    eligibleUsersList[j] = eligibleUsersList[eligibleUsersList.length - 1];
                    eligibleUsersList.pop();
                }
            }
        }
    }

    // only owner function for replacing eligible users list
    function replaceEligibleUsersList(address[] calldata _eligibleUsersList) external onlyOwner {
        eligibleUsersList = _eligibleUsersList;
    }

    // function for getting the number of eligible users
    function getEligibleUsersCount() external view returns (uint256) {
        return eligibleUsersList.length;
    }

    // function for getting range of eligible users
    function getEligibleUsers(uint256 _start, uint256 _end) external view returns (address[] memory) {
        require(_start < _end, "Invalid range");
        require(_end <= eligibleUsersList.length, "Invalid range");
        address[] memory users = new address[](_end - _start);
        for (uint256 i = _start; i < _end; i++) {
            users[i - _start] = eligibleUsersList[i];
        }
        return users;
    }
}