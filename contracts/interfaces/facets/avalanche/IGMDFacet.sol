pragma solidity ^0.8.17;

interface IGMDFacet {
    function gmdStakeUSDC(uint256 amountStaked, uint256 minSharesOut) external;
    function gmdStakeAVAX(uint256 amountStaked, uint256 minSharesOut) external;
    function gmdStakeBTCb(uint256 amountStaked, uint256 minSharesOut) external;
    function gmdStakeWETHe(uint256 amountStaked, uint256 minSharesOut) external;

    function gmdUnstakeUSDC(uint256 amountUnstaked, uint256 minTokenOut) external;
    function gmdUnstakeAVAX(uint256 amountUnstaked, uint256 minTokenOut) external;
    function gmdUnstakeBTCb(uint256 amountUnstaked, uint256 minTokenOut) external;
    function gmdUnstakeWETHe(uint256 amountUnstaked, uint256 minTokenOut) external;

    struct StakingDetails {
        address asset;
        address receiptToken;
        bytes32 symbol;
        bytes32 identifier;
        uint256 amountStaked;
        uint256 minSharesOut;
        uint256 pid;
    }

    struct UnstakingDetails {
        address asset;
        address receiptToken;
        bytes32 symbol;
        bytes32 identifier;
        uint256 amountUnstaked;
        uint256 minTokenOut;
        uint256 pid;
    }
}
