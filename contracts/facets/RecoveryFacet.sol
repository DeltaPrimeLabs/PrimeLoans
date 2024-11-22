// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVectorFinanceStaking.sol";
import "../interfaces/IVectorFinanceMainStaking.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract RecoveryFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;

    // CONSTANTS

    address private constant VectorMainStaking =
        0x8B3d9F0017FA369cD8C164D0Cc078bf4cA588aE5;

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
     * Get refunds from the recovery contract
     * @param _token token to be refunded
     * @param _amount amount refunded
     **/
    function notifyRefund(address _token, uint256 _amount) external onlyRC {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32 asset = tokenManager.tokenAddressToSymbol(_token);
        require(asset != bytes32(0), "Asset not supported.");

        IERC20Metadata token = IERC20Metadata(_token);
        _token.safeTransferFrom(msg.sender, address(this), _amount);

        DiamondStorageLib.addOwnedAsset(asset, _token);

        tokenManager.increaseProtocolExposure(
            asset,
            (_amount * 1e18) / 10 ** token.decimals()
        );

        emit RefundReceived(_token, _amount);
    }

    /**
     * Emergency withdraws given assets from the loan
     * @dev This function uses the redstone-evm-connector
     * @param _asset asset to be withdrawn
     * @return _amount amount withdrawn
     **/
    function emergencyWithdraw(
        bytes32 _asset
    ) external onlyRC returns (uint256 _amount) {
        if (_asset == "GLP") {
            _amount = _withdrawGLP();
        } else {
            _amount = _withdraw(_asset);
        }
    }

    function _withdraw(bytes32 _asset) internal returns (uint256 _amount) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (
            _asset == "VF_USDC_MAIN_AUTO" ||
            _asset == "VF_USDT_MAIN_AUTO" ||
            _asset == "VF_AVAX_SAVAX_AUTO" ||
            _asset == "VF_SAVAX_MAIN_AUTO"
        ) {
            IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib
                .stakedPositions();
            uint256 positionsLength = positions.length;
            for (uint256 i; i != positionsLength; ++i) {
                IStakingPositions.StakedPosition memory position = positions[i];
                if (position.identifier != _asset) continue;

                positions[i] = positions[positionsLength - 1];
                positions.pop();

                IVectorFinanceCompounder compounder = _getAssetPoolHelper(
                    position.asset
                ).compounder();
                uint256 shares = compounder.balanceOf(address(this));
                uint256 stakedBalance = compounder.getDepositTokensForShares(shares);

                _amount = compounder.depositTracking(address(this));
                address(compounder).safeTransfer(msg.sender, _amount);

                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                tokenManager.decreaseProtocolExposure(positions[i].identifier, stakedBalance * 1e18 / 10**decimals);

                break;
            }
        } else {
            IERC20Metadata token = getERC20TokenInstance(_asset, true);
            _amount = token.balanceOf(address(this));

            address(token).safeTransfer(msg.sender, _amount);
            DiamondStorageLib.removeOwnedAsset(_asset);
            tokenManager.decreaseProtocolExposure(
                _asset,
                (_amount * 1e18) / 10 ** token.decimals()
            );
        }

        emit EmergencyWithdrawn(_asset, _amount, block.timestamp);
    }

    function _withdrawGLP() internal returns (uint256 _amount) {
        IERC20Metadata token = getERC20TokenInstance("GLP", true);
        IERC20Metadata stakedGlpToken = IERC20Metadata(
            0xaE64d55a6f09E4263421737397D1fdFA71896a69
        );
        _amount = token.balanceOf(address(this));

        address(stakedGlpToken).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("GLP");
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure("GLP", _amount);

        emit EmergencyWithdrawn("GLP", _amount, block.timestamp);
    }

    function _getAssetPoolHelper(
        address asset
    ) internal view returns (IVectorFinanceStaking) {
        IVectorFinanceMainStaking mainStaking = IVectorFinanceMainStaking(
            VectorMainStaking
        );
        return IVectorFinanceStaking(mainStaking.getPoolInfo(asset).helper);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyRC() {
        IAddressProvider addressProvider = IAddressProvider(
            DeploymentConstants.getAddressProvider()
        );
        require(
            msg.sender == addressProvider.getRecoveryContract(),
            "msg.sender != RC"
        );
        _;
    }

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after the funds are withdrawn from the loan
     * @param asset withdrawn by a user
     * @param amount of funds withdrawn
     * @param timestamp of the withdrawal
     **/
    event EmergencyWithdrawn(
        bytes32 indexed asset,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev emitted after refund is received
     * @param token that is refunded
     * @param amount of the refund
     */
    event RefundReceived(address token, uint256 amount);
}
