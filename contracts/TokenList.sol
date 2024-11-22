// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TokenListOwnableUpgreadable is OwnableUpgradeable {
    mapping(address => bool) isTokenWhitelisted;
    mapping(address => uint256) tokenPositionInList;
    address[] whitelistedTokensList;

    function __TokenList_init(address[] memory _whitelistedTokens) internal onlyInitializing {
        for (uint256 i = 0; i < _whitelistedTokens.length; i++) {
            require(_whitelistToken(_whitelistedTokens[i], false), "Whitelisting token failed");
        }

        __Ownable_init();
    }

    // PUBLIC MUTATIVE FUNCTIONS

    function whitelistTokens(address[] memory tokensToWhitelist) public onlyOwner {
        for (uint256 i = 0; i < tokensToWhitelist.length; i++) {
            require(_whitelistToken(tokensToWhitelist[i], true), "Whitelisting token failed");
        }
    }

    function delistTokens(address[] memory tokensToDelist) public onlyOwner {
        for (uint256 i = 0; i < tokensToDelist.length; i++) {
            require(_delistToken(tokensToDelist[i], true), "Delisting token failed");
        }
    }

    // PUBLIC VIEW FUNCTIONS

    function getAllWhitelistedTokens() public view returns (address[] memory) {
        return whitelistedTokensList;
    }

    // Already auto-generated because of the public visibility modifier
    // function isTokenWhitelisted(address token) public view returns (bool) {
    //     return isTokenWhitelisted[token];
    // }

    // INTERNAL MUTATIVE FUNCTIONS

    function _whitelistToken(address token, bool revertOnDuplicates) internal returns (bool){
        require(token != address(0), "Cannot whitelist a zero address");

        if (!isTokenWhitelisted[token]) {
            whitelistedTokensList.push(token);
            tokenPositionInList[token] = whitelistedTokensList.length - 1;
            isTokenWhitelisted[token] = true;
            emit TokenWhitelisted(msg.sender, token, block.timestamp);
            return true;

        } else if (revertOnDuplicates) {
            revert("Token already whitelisted");
        }
        return false;
    }

    function _delistToken(address token, bool revertOnNonListedTokens) internal returns (bool){
        if (isTokenWhitelisted[token]) {
            _removeTokenFromList(token);
            isTokenWhitelisted[token] = false;
            emit TokenDelisted(msg.sender, token, block.timestamp);
            return true;

        } else if (revertOnNonListedTokens) {
            revert("Token was not whitelisted before");
        }
        return false;
    }

    // INTERNAL HELPER MUTATIVE FUNCTIONS

    function _removeTokenFromList(address tokenToRemove) internal {
        // Move last address token to the `tokenToRemoveIndex` position (index of an asset that is being removed) in the address[] whitelistedTokensList
        // and update map(address=>uint256) tokenPostitionInList if the token is not already the last element
        uint256 tokenToRemoveIndex = tokenPositionInList[tokenToRemove];
        require(tokenToRemoveIndex < whitelistedTokensList.length, "Index out of range");
        if (tokenToRemoveIndex == 0 && whitelistedTokensList[0] != tokenToRemove) {
            revert("Token does not exist");
        }
        if (tokenToRemoveIndex != (whitelistedTokensList.length - 1)) {
            address currentLastToken = whitelistedTokensList[whitelistedTokensList.length - 1];
            tokenPositionInList[currentLastToken] = tokenToRemoveIndex;
            whitelistedTokensList[tokenToRemoveIndex] = currentLastToken;
        }
        // Remove last element - that is either the token that is being removed (if was already at the end)
        // or some other asset that at this point was already copied to the `index` positon
        whitelistedTokensList.pop();
        tokenPositionInList[tokenToRemove] = 0;
    }

    // EVENTS
    /**
    * @dev emitted after whitelisting a token
    * @param user performing the transaction
    * @param token address of whitelisted token
    * @param timestamp of change
    **/
    event TokenWhitelisted(address indexed user, address token, uint256 timestamp);

    /**
    * @dev emitted after delisting a token
    * @param user performing the transaction
    * @param token address of delisted token
    * @param timestamp of change
    **/
    event TokenDelisted(address indexed user, address token, uint256 timestamp);
}