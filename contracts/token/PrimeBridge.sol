// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: fdbe5a41cfc30a8d7f63abcbfeae5f77df7368a1;
pragma solidity ^0.8.17;

import "@layerzerolabs/solidity-examples/contracts/token/oft/v2/BaseOFTV2.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PrimeBridge is BaseOFTV2 {
    using SafeERC20 for IERC20;

    IERC20 internal immutable innerToken;

    /// @notice long decimals to short decimals rate.
    uint256 internal immutable ld2sdRate;

    // total amount is transferred from this chain to other chains, ensuring the total is less than uint64.max in sd
    uint256 public outboundAmount;

    constructor(
        IERC20 _token,
        uint8 _sharedDecimals,
        address _lzEndpoint
    ) BaseOFTV2(_sharedDecimals, _lzEndpoint) {
        innerToken = _token;

        (bool success, bytes memory data) = address(_token).staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success, "ProxyOFT: failed to get token decimals");
        uint8 decimals = abi.decode(data, (uint8));

        require(
            _sharedDecimals <= decimals,
            "ProxyOFT: sharedDecimals must be <= decimals"
        );
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
    }

    /************************************************************************
     * public functions
     ************************************************************************/
    function circulatingSupply() public view virtual override returns (uint256) {
        return innerToken.totalSupply() - outboundAmount;
    }

    function token() public view virtual override returns (address) {
        return address(innerToken);
    }

    /************************************************************************
     * internal functions
     ************************************************************************/
    function _debitFrom(
        address _from,
        uint16,
        bytes32,
        uint256 _amount
    ) internal virtual override returns (uint256) {
        require(_from == _msgSender(), "ProxyOFT: owner is not send caller");

        _amount = _transferFrom(_from, address(this), _amount);

        // _amount still may have dust if the token has transfer fee, then give the dust back to the sender
        (uint256 amount, uint256 dust) = _removeDust(_amount);
        if (dust > 0) innerToken.safeTransfer(_from, dust);

        // check total outbound amount
        outboundAmount += amount;
        uint256 cap = _sd2ld(type(uint64).max);
        require(cap >= outboundAmount, "ProxyOFT: outboundAmount overflow");

        return amount;
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint256 _amount
    ) internal virtual override returns (uint256) {
        outboundAmount -= _amount;

        // tokens are already in this contract, so no need to transfer
        if (_toAddress == address(this)) {
            return _amount;
        } else {
            return _transferFrom(address(this), _toAddress, _amount);
        }
    }

    function _transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) internal virtual override returns (uint256) {
        uint256 before = innerToken.balanceOf(_to);
        if (_from == address(this)) {
            innerToken.safeTransfer(_to, _amount);
        } else {
            innerToken.safeTransferFrom(_from, _to, _amount);
        }
        return innerToken.balanceOf(_to) - before;
    }

    function _ld2sdRate() internal view virtual override returns (uint256) {
        return ld2sdRate;
    }
}
