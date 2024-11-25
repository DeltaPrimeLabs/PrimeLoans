pragma solidity ^0.8.17;

interface IGmxV2PlusFacet {
    function depositBtcGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable;

    function depositEthGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable;

    function depositAvaxGmxV2Plus(
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) external payable;

    function withdrawBtcGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable;

    function withdrawEthGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable;

    function withdrawAvaxGmxV2Plus(
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    ) external payable;
}
