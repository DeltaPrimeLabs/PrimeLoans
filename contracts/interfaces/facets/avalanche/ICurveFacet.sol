pragma solidity ^0.8.17;

interface ICurveFacet {
    function stakeCurve(uint256[5] memory amounts) external;

    function unstakeCurve(uint256 amount, uint256[5] memory min_amounts) external;

    function unstakeOneTokenCurve(uint256 i, uint256 amount) external;
}
