// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

interface IPendleDepositHelper {
    function depositMarket(address _market, uint256 _amount) external;

    function withdrawMarketWithClaim(
        address _market,
        uint256 _amount,
        bool _doClaim
    ) external;
}
