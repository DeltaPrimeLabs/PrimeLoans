pragma solidity ^0.8.17;

interface IAssetsOperationsFacet {
    function borrow(bytes32 _asset, uint256 _amount) external;

    function fund(bytes32 _fundedAsset, uint256 _amount) external;

    function fundGLP(uint256 _amount) external;

    function repay(bytes32 _asset, uint256 _amount) payable external;

    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) external;

    function withdrawGLP(uint256 _amount) external;

    function swapDebt(bytes32 _fromAsset, bytes32 _toAsset, uint256 _repayAmount, uint256 _borrowAmount, address[] calldata _path, address[] calldata _adapters) external;

    event Funded(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    event Withdrawn(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    event Borrowed(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    event Repaid(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}
