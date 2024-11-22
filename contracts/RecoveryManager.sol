// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/facets/avalanche/IRecoveryFacet.sol";

/// @title DeltaPrime Recovery Manager
contract RecoveryManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RecoverData {
        bytes32 asset;
        address underlying;
        address[] accounts;
        address token0;
        address token1;
        uint256 minAmount0;
        uint256 minAmount1;
    }

    struct Helper {
        address helper;
        bytes4 selector;
    }

    mapping(bytes32 => Helper) public helpers;

    function addHelper(
        bytes32 _asset,
        address _helper,
        bytes4 _selector
    ) external onlyOwner {
        helpers[_asset] = Helper({helper: _helper, selector: _selector});

        emit HelperAdded(_asset, _helper, _selector);
    }

    function recoverAssets(
        RecoverData[] memory _data
    ) external nonReentrant onlyOwner {
        uint256 length = _data.length;
        require(length > 0, "empty array");

        for (uint256 i; i != length; ++i) {
            RecoverData memory data = _data[i];
            Helper memory helper = helpers[data.asset];
            require(helper.helper != address(0), "Helper not found");

            uint256 userLength = data.accounts.length;
            uint256[] memory recovered = new uint256[](userLength);
            uint256 totalRecovered;

            for (uint256 j; j != userLength; ++j) {
                recovered[j] = IRecoveryFacet(data.accounts[j]).emergencyWithdraw(
                    data.asset
                );
                totalRecovered += recovered[j];
            }

            require(totalRecovered > 0, "Nothing to recover");

            uint256 beforeBalance = IERC20(data.underlying).balanceOf(address(this));

            (bool success, ) = helper.helper.delegatecall(
                abi.encodeWithSelector(
                    helper.selector,
                    data.token0,
                    data.token1,
                    totalRecovered,
                    data.minAmount0,
                    data.minAmount1
                )
            );
            require(success, "failed to unstake");

            uint256 recoveredBalance = IERC20(data.underlying).balanceOf(
                address(this)
            ) - beforeBalance;

            for (uint256 j; j != userLength; ++j) {
                address account = data.accounts[j];
                uint256 refundAmount = (recoveredBalance * recovered[j]) /
                    totalRecovered;
                IERC20(data.underlying).safeApprove(account, 0);
                IERC20(data.underlying).safeApprove(account, refundAmount);
                IRecoveryFacet(account).notifyRefund(data.underlying, refundAmount);
            }

            emit AssetRecovered(
                data.asset,
                totalRecovered,
                data.underlying,
                recoveredBalance
            );
        }
    }

    event HelperAdded(bytes32 asset, address helper, bytes4 selector);

    event AssetRecovered(
        bytes32 asset,
        uint256 assetRecovered,
        address underlying,
        uint256 underlyingRecovered
    );
}
