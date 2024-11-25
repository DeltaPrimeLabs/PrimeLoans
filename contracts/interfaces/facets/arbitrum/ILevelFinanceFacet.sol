pragma solidity ^0.8.17;

interface ILevelFinanceFacet {
    function levelStakeEthSnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeEthMze(uint256 amount, uint256 minLpAmount) external;

    function levelStakeEthJnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeBtcSnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeBtcMze(uint256 amount, uint256 minLpAmount) external;

    function levelStakeBtcJnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeUsdtSnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeUsdtMze(uint256 amount, uint256 minLpAmount) external;

    function levelStakeUsdtJnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeUsdcSnr(uint256 amount, uint256 minLpAmount) external;

    function levelStakeUsdcMze(uint256 amount, uint256 minLpAmount) external;

    function levelStakeUsdcJnr(uint256 amount, uint256 minLpAmount) external;

    function levelUnstakeEthSnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeEthMze(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeEthJnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeBtcSnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeBtcMze(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeBtcJnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeUsdtSnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeUsdtMze(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeUsdtJnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeUsdcSnr(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeUsdcMze(uint256 lpAmount, uint256 minAmount) external;

    function levelUnstakeUsdcJnr(uint256 lpAmount, uint256 minAmount) external;

    function levelSnrBalance() external view returns (uint256 _stakedBalance);

    function levelMzeBalance() external view returns (uint256 _stakedBalance);

    function levelJnrBalance() external view returns (uint256 _stakedBalance);

    function depositLLPAndStake(uint256 pid, uint256 amount) external;

    function unstakeAndWithdrawLLP(uint256 pid, uint256 amount) external;
}
