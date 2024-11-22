// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

abstract contract NFTAccess is OwnableUpgradeable {
    bytes32 internal constant ACCESS_NFT_SLOT = bytes32(uint256(keccak256('ACCESS_NFT_SLOT')) - 1);

    function setAccessNFT(ERC721 nftAddress) external onlyOwner {
        // Setting nftAddress to a address(0) removes the lock
        if (address(nftAddress) != address(0)) {
            require(AddressUpgradeable.isContract(address(nftAddress)), "Cannot set nftAddress to a non-contract instance");
            (bool success, bytes memory result) = address(nftAddress).call(
                abi.encodeWithSignature("balanceOf(address)", msg.sender)
            );
            require(success && result.length > 0, "Contract has to support the ERC721 balanceOf() interface");
        }

        bytes32 slot = ACCESS_NFT_SLOT;
        assembly {
            sstore(slot, nftAddress)
        }
    }

    function getAccessNFT() external view returns (ERC721 accessNFT) {
        bytes32 slot = ACCESS_NFT_SLOT;
        assembly {
            accessNFT := sload(slot)
        }
    }

    modifier hasAccessNFT {
        bytes32 slot = ACCESS_NFT_SLOT;
        ERC721 accessNFT;
        assembly {
            accessNFT := sload(slot)
        }
        if (address(accessNFT) != address(0)) {
            require(accessNFT.balanceOf(msg.sender) > 0, "Access NFT required");
        }
        _;
    }
}
