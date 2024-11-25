pragma solidity ^0.8.17;

interface ISmartLoanWrappedNativeTokenFacet {
    function depositNativeToken() payable external;

    function unwrapAndWithdraw(uint256 _amount) payable external;

    function wrapNativeToken(uint256 amount) external;

    event WrapNative(address indexed user, uint256 amount, uint256 timestamp);

    event DepositNative(address indexed user, uint256 amount, uint256 timestamp);

    event UnwrapAndWithdraw(address indexed user, uint256 amount, uint256 timestamp);
}
