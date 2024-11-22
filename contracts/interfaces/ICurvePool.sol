// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

interface ICurvePool {
    function underlying_coins(uint256 arg0) external view returns (address);

    function token() external view returns (address);

    function calc_withdraw_one_coin(
        uint256 token_amount,
        uint256 i
    ) external view returns (uint256);

    function add_liquidity(
        uint256[5] calldata _amounts,
        uint256 _min_mint_amount
    ) external;

    function remove_liquidity(
        uint256 _amount,
        uint256[5] calldata _min_amounts
    ) external;

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        uint256 i,
        uint256 _min_amount
    ) external;
}
