// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/IVectorFinanceCompounder.sol";
import "../../interfaces/IVectorFinanceMainStaking.sol";
import "../../interfaces/IVectorFinanceStaking.sol";

contract VectorFinanceHelper {
    // CONSTANTS

    address private constant VectorMainStaking =
        0x8B3d9F0017FA369cD8C164D0Cc078bf4cA588aE5;

    // PUBLIC FUNCTIONS

    function vectorUnstakeUSDC(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) public {
        _unstakeToken(
            amount,
            minAmount,
            0x06f01502327De1c37076Bea4689a7e44279155e9
        );
    }

    function vectorUnstakeUSDT(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) public {
        _unstakeToken(
            amount,
            minAmount,
            0x836648A8cE166Ba7CaFb27F0E6AD21d5C91b7774
        );
    }

    function vectorUnstakeWAVAX(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) public {
        _unstakeToken(
            amount,
            minAmount,
            0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7
        );
    }

    function vectorUnstakeSAVAX(
        address,
        address,
        uint256 amount,
        uint256 minAmount,
        uint256
    ) public {
        _unstakeToken(
            amount,
            minAmount,
            0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE
        );
    }

    // INTERNAL FUNCTIONS

    function _unstakeToken(
        uint256 amount,
        uint256 minAmount,
        address asset
    ) internal {
        IVectorFinanceCompounder compounder = _getAssetPoolHelper(asset)
            .compounder();
        require(amount > 0, "Cannot unstake 0 tokens");

        amount = Math.min(compounder.depositTracking(address(this)), amount);

        compounder.withdraw(amount, minAmount);
    }

    function _getAssetPoolHelper(
        address asset
    ) internal view returns (IVectorFinanceStaking) {
        IVectorFinanceMainStaking mainStaking = IVectorFinanceMainStaking(
            VectorMainStaking
        );
        return IVectorFinanceStaking(mainStaking.getPoolInfo(asset).helper);
    }
}
