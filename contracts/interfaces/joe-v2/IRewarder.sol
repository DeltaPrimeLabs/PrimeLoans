// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRewarder {
    /**
     * @dev Structure to store the Merkle tree entry. It contains:
     * - `market` is the address of the market.
     * - `epoch` is the epoch of the market.
     * - `token` is the token address of the market.
     * - `user` is the user address.
     * - `amount` is the amount of tokens to be claimed.
     * - `merkleProof` is the Merkle proof of the claim.
     */
    struct MerkleEntry {
        address market;
        uint256 epoch;
        IERC20 token;
        address user;
        uint256 amount;
        bytes32[] merkleProof;
    }

    function batchClaim(MerkleEntry[] calldata merkleEntries) external;
}
