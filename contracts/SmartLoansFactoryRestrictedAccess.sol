// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: da3db6d98ac8305a3d43391d37f1b9a30e456c4e;
pragma solidity 0.8.17;

import "./SmartLoansFactory.sol";

contract SmartLoansFactoryRestrictedAccess is SmartLoansFactory {
    bytes32 internal constant ACCESS_NFT_SLOT = bytes32(uint256(keccak256('WHITELIST_SLOT_1670605213')) - 1);

    function getWhitelistingMapping() internal view returns(mapping(address=>bool) storage result){
        bytes32 slot = ACCESS_NFT_SLOT;
        assembly{
            result.slot := sload(slot)
        }
    }
    
    function whitelistBorrowers(address[] memory _borrowers) external onlyOwner {

        for(uint i; i<_borrowers.length; i++){
            getWhitelistingMapping()[_borrowers[i]] = true;
            emit BorrowerWhitelisted(_borrowers[i], msg.sender, block.timestamp);
        }
    }

    function delistBorrowers(address[] memory _borrowers) external onlyOwner {
        for(uint i; i<_borrowers.length; i++){
            getWhitelistingMapping()[_borrowers[i]] = false;
            emit BorrowerDelisted(_borrowers[i], msg.sender, block.timestamp);
        }
    }

    function isBorrowerWhitelisted(address _borrower) public view returns(bool){
        return getWhitelistingMapping()[_borrower];
    }

    function createLoan() public virtual override hasNoLoan canCreatePrimeAccount(msg.sender) returns (SmartLoanDiamondBeacon) {
        return super.createLoan();
    }

    function createAndFundLoan(bytes32 _fundedAsset, uint256 _amount) public virtual override hasNoLoan canCreatePrimeAccount(msg.sender) returns (SmartLoanDiamondBeacon) {
        return super.createAndFundLoan(_fundedAsset, _amount);
    }

    /**
     * @dev emitted when a new borrower gets whitelisted
     * @param borrower the address being whitelisted
     * @param performer the address initiating whitelisting
     * @param timestamp of the whitelisting
     **/
    event BorrowerWhitelisted(address indexed borrower, address performer, uint256 timestamp);
    
    /**
     * @dev emitted when a borrower gets delisted
     * @param borrower the address being delisted
     * @param performer the address initiating delisting
     * @param timestamp of the delisting
     **/
    event BorrowerDelisted(address indexed borrower, address performer, uint256 timestamp);

    modifier canCreatePrimeAccount(address _borrower) {
        require(isBorrowerWhitelisted(_borrower), "Only whitelisted borrowers can create a Prime Account.");
        _;
    }
}
