// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 499a35c62f8a913d89f7faf78bf5c6b3cea2ee8b;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/SolvencyMethods.sol";
import "../../interfaces/IWrappedNativeToken.sol";
import "../../interfaces/IGgAvax.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract GogoPoolFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    address private constant GG_AVAX =
        0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3;

    function swapToGgAvax(uint256 _amount)
        external
        nonReentrant
        onlyOwner
        remainsSolvent
    {
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        _amount = Math.min(wrapped.balanceOf(address(this)), _amount);
        require(_amount > 0, "Amount has to be greater than 0");

        wrapped.withdraw(_amount);

        uint256 initialGgAvaxBalance = IERC20(GG_AVAX).balanceOf(address(this));

        IGgAvax ggAvax = IGgAvax(GG_AVAX);
        ggAvax.depositAVAX{value: _amount}();

        _increaseExposure(tokenManager, GG_AVAX, IERC20(GG_AVAX).balanceOf(address(this)) - initialGgAvaxBalance);
        _decreaseExposure(tokenManager, address(wrapped), _amount);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}
}
