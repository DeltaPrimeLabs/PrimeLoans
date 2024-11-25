// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

abstract contract ECDSAVerify {
    using ECDSA for bytes32;

    function verifyMessage(address signer, string memory message, bytes memory signature) public pure returns (bool) {
        bytes32 messageHash = keccak256(bytes(message));
        address signerAddress = messageHash.toEthSignedMessageHash().recover(signature);

        return signerAddress == signer;
    }
}
