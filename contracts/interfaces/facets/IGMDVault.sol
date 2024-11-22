pragma solidity ^0.8.17;

interface IGMDVault {
    function enter(uint256 _amountin, uint256 _pid) external;
    function leave(uint256 _share, uint256 _pid) external;
    function poolInfo(uint256 pid) view external returns (PoolInfoStruct memory);

    struct PoolInfoStruct {
        address lpToken;
        address GDlptoken;
        uint256 EarnRateSec;
        uint256 totalStaked;
        uint256 lastUpdate;
        uint256 vaultcap;
        uint256 glpFees;
        uint256 APR;
        bool stakable;
        bool withdrawable;
        bool rewardStart;
    }
}
