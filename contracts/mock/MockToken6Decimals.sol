// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken6Decimals is ERC20 {
    constructor() ERC20("MCKTKN6", "MockToken6") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint() external {
        _mint(msg.sender, 10000 * 10 ** decimals());
    }
}
