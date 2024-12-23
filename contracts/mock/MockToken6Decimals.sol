// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken6Decimals is ERC20 {
    uint256 public constant MAX_SUPPLY = 100 * 10 ** 6; // 100 tokens with 6 decimals

    constructor() ERC20("MCKTKN6", "MockToken6") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint() external {
        require(balanceOf(msg.sender) == 0, "Already have tokens");
        require(totalSupply() + (10 * 10 ** decimals()) <= MAX_SUPPLY, "Max supply reached");
        _mint(msg.sender, 10 * 10 ** decimals());
    }
}