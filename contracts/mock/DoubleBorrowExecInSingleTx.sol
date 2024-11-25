// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../facets/AssetsOperationsFacet.sol";
import "../facets/avalanche/PangolinDEXFacet.sol";
import "../SmartLoansFactory.sol";


/**
 * @title DoubleBorrowExecInSingleTx
 * @dev For tests
 */
contract DoubleBorrowExecInSingleTx is ProxyConnector {

    function stringToBytes32(string memory source) public pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    address constant WAVAX_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    function createLoan(address factoryAddress) public {
        SmartLoansFactory factory = SmartLoansFactory(factoryAddress);
        factory.createLoan();
    }

    function execute(address smartLoanAddress) public {
        IERC20 token = IERC20(WAVAX_ADDRESS);
        token.approve(smartLoanAddress, 1 ether);

        proxyCalldata(address(smartLoanAddress), abi.encodeWithSelector(AssetsOperationsFacet.fund.selector, stringToBytes32("AVAX"), 1 ether), false);

        proxyCalldata(address(smartLoanAddress), abi.encodeWithSelector(AssetsOperationsFacet.borrow.selector, stringToBytes32("AVAX"), 1 ether), false);
        // Should fail with: "Borrowing must happen in a standalone transaction"
        proxyCalldata(address(smartLoanAddress), abi.encodeWithSelector(PangolinDEXFacet.swapPangolin.selector, stringToBytes32("AVAX"), stringToBytes32("USDC"), 1 ether, 1 ether), false);
    }
}
