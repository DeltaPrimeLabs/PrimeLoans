// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

/**
 * @title Liquidity Book Factory Interface
 * @author Trader Joe
 * @notice Required interface of LBFactory contract
 */
interface ILBHookLens {
    struct Parameters {
        address hooks;
        bool beforeSwap;
        bool afterSwap;
        bool beforeFlashLoan;
        bool afterFlashLoan;
        bool beforeMint;
        bool afterMint;
        bool beforeBurn;
        bool afterBurn;
        bool beforeBatchTransferFrom;
        bool afterBatchTransferFrom;
    }

    function getHooks(address pair) external view returns (Parameters memory);
}
