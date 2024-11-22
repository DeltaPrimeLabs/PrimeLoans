// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/facets/avalanche/IYieldYak.sol";
import "../../interfaces/IWrappedNativeToken.sol";

contract YieldYakHelper {
    // Staking Vaults tokens
    address private constant YY_AAVE_AVAX =
        0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95;
    address private constant YY_PTP_sAVAX =
        0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977;
    address private constant YY_GLP = 0x9f637540149f922145c06e1aa3f38dcDc32Aff5C;

    // Staking Vaults LPs
    address private constant YY_PNG_AVAX_USDC_LP =
        0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656;
    address private constant YY_PNG_AVAX_ETH_LP =
        0xFCD2050E213cC54db2c9c99632AC870574FbC261;
    address private constant YY_TJ_AVAX_USDC_LP =
        0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC;
    address private constant YY_TJ_AVAX_ETH_LP =
        0x5219558ee591b030E075892acc41334A1694fd8A;
    address private constant YY_TJ_AVAX_sAVAX_LP =
        0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56;

    // Tokens
    address private constant SAVAX_TOKEN =
        0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE;
    address private constant AVAX_TOKEN =
        0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address private constant GLP_TOKEN =
        0x9e295B5B976a184B14aD8cd72413aD846C299660;
    // LPs
    address private constant PNG_AVAX_USDC_LP =
        0x0e0100Ab771E9288e0Aa97e11557E6654C3a9665;
    address private constant PNG_AVAX_ETH_LP =
        0x7c05d54fc5CB6e4Ad87c6f5db3b807C94bB89c52;

    address private constant TJ_AVAX_USDC_LP =
        0xf4003F4efBE8691B60249E6afbD307aBE7758adb;
    address private constant TJ_AVAX_ETH_LP =
        0xFE15c2695F1F920da45C30AAE47d11dE51007AF9;
    address private constant TJ_AVAX_sAVAX_LP =
        0x4b946c91C2B1a7d7C40FB3C130CdfBaf8389094d;

    // PUBLIC FUNCTIONS

    function unstakeAVAXYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        IYieldYak yakStakingContract = IYieldYak(YY_AAVE_AVAX);

        amount = Math.min(yakStakingContract.balanceOf(address(this)), amount);

        yakStakingContract.withdraw(amount);

        require(address(this).balance >= minAmount, "too little received");

        IWrappedNativeToken(AVAX_TOKEN).deposit{value: address(this).balance}();
    }

    function unstakeSAVAXYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(SAVAX_TOKEN, YY_PTP_sAVAX, amount, minAmount);
    }

    function unstakeGLPYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(GLP_TOKEN, YY_GLP, amount, minAmount);
    }

    function unstakePNGAVAXUSDCYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(PNG_AVAX_USDC_LP, YY_PNG_AVAX_USDC_LP, amount, minAmount);
    }

    function unstakePNGAVAXETHYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(PNG_AVAX_ETH_LP, YY_PNG_AVAX_ETH_LP, amount, minAmount);
    }

    function unstakeTJAVAXUSDCYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(TJ_AVAX_USDC_LP, YY_TJ_AVAX_USDC_LP, amount, minAmount);
    }

    function unstakeTJAVAXETHYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(TJ_AVAX_ETH_LP, YY_TJ_AVAX_ETH_LP, amount, minAmount);
    }

    function unstakeTJAVAXSAVAXYak(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) external {
        _unstakeTokenYY(TJ_AVAX_sAVAX_LP, YY_TJ_AVAX_sAVAX_LP, amount, minAmount);
    }

    // INTERNAL FUNCTIONS

    function _unstakeTokenYY(
        address tokenAddress,
        address vaultAddress,
        uint256 amount,
        uint256 minAmount
    ) private {
        IYieldYak vaultContract = IYieldYak(vaultAddress);
        IERC20Metadata depositToken = IERC20Metadata(tokenAddress);
        uint256 initialDepositTokenBalance = depositToken.balanceOf(address(this));
        amount = Math.min(vaultContract.balanceOf(address(this)), amount);

        vaultContract.withdraw(amount);

        uint256 unstaked = depositToken.balanceOf(address(this)) -
            initialDepositTokenBalance;
        require(unstaked >= minAmount, "too little received");
    }
}
