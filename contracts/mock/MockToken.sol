// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    uint256 public constant MAX_SUPPLY = 100 * 10 ** 18; // 100 tokens with 18 decimals

    constructor() ERC20("MCKTKN18", "MockToken18") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint() external {
        require(balanceOf(msg.sender) == 0, "Already have tokens");
        require(totalSupply() + (10 * 10 ** decimals()) <= MAX_SUPPLY, "Max supply reached");
        _mint(msg.sender, 10 * 10 ** decimals());
    }
}