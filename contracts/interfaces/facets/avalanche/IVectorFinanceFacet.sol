pragma solidity ^0.8.17;

interface IVectorFinanceFacet {
    function vectorStakeUSDC1Auto(uint256 amount) external;

    function vectorStakeUSDT1Auto(uint256 amount) external;

    function vectorStakeWAVAX1Auto(uint256 amount) external;

    function vectorStakeSAVAX1Auto(uint256 amount) external;

    function vectorUnstakeUSDC1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeUSDT1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeWAVAX1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeSAVAX1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUSDC1BalanceAuto() external view returns(uint256);

    function vectorUSDT1BalanceAuto() external view returns(uint256);

    function vectorWAVAX1BalanceAuto() external view returns(uint256);

    function vectorSAVAX1BalanceAuto() external view returns(uint256);

    function vectorMigrateAvax() external;

    function vectorMigrateSAvax() external;

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of receipt token
        * @param migratedAmount how much of receipt token was migrated
        * @param timestamp of staking
    **/
    event Migrated(address indexed user, bytes32 indexed asset, address indexed vault, uint256 migratedAmount, uint256 timestamp);
}
