// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: fdbe5a41cfc30a8d7f63abcbfeae5f77df7368a1;

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@layerzerolabs/solidity-examples/contracts/token/oft/v2/BaseOFTV2.sol";

contract Prime_L2 is BaseOFTV2, ERC20 {
    /// @notice long decimals to short decimals rate.
    uint internal immutable ld2sdRate;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _sharedDecimals,
        address _lzEndpoint
    ) ERC20(_name, _symbol) BaseOFTV2(_sharedDecimals, _lzEndpoint) {
        uint8 decimals = decimals();
        require(
            _sharedDecimals <= decimals,
            "OFT: sharedDecimals must be <= decimals"
        );
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
    }

    /************************************************************************
     * public functions
     ************************************************************************/
    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }

    function token() public view virtual override returns (address) {
        return address(this);
    }

    /************************************************************************
     * internal functions
     ************************************************************************/
    function _debitFrom(
        address _from,
        uint16,
        bytes32,
        uint _amount
    ) internal virtual override returns (uint) {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
        return _amount;
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint _amount
    ) internal virtual override returns (uint) {
        _mint(_toAddress, _amount);
        return _amount;
    }

    function _transferFrom(
        address _from,
        address _to,
        uint _amount
    ) internal virtual override returns (uint) {
        address spender = _msgSender();
        // if transfer from this contract, no need to check allowance
        if (_from != address(this) && _from != spender)
            _spendAllowance(_from, spender, _amount);
        _transfer(_from, _to, _amount);
        return _amount;
    }

    function _ld2sdRate() internal view virtual override returns (uint) {
        return ld2sdRate;
    }
}
