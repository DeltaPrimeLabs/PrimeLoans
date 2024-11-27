// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../TraderJoeV2Facet.sol";

contract TraderJoeV2AvalancheFacet is TraderJoeV2Facet {
    function maxBinsPerPrimeAccount() public pure override returns (uint256) {
        return 80;
    }

    function getWhitelistedTraderJoeV2Pairs() internal pure override returns (ILBPair[] memory pools) {
        pools = new ILBPair[](5);
        // TJLB_WAVAX_USDC
        pools[0] = ILBPair(0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1);
        // TJLB_WETH.e_WAVAX
        pools[1] = ILBPair(0x1901011a39B11271578a1283D620373aBeD66faA);
        // TJLB_BTCb_WAVAX
        pools[2] = ILBPair(0xD9fa522F5BC6cfa40211944F2C8DA785773Ad99D);
        // TJLB_USDt_USDC
        pools[3] = ILBPair(0x2823299af89285fF1a1abF58DB37cE57006FEf5D);
        // TJLB_JOE_WAVAX
        pools[4] = ILBPair(0xEA7309636E7025Fda0Ee2282733Ea248c3898495);
    }
}
