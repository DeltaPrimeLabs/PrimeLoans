// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 6123239267c57f570c1448d6c3247dae657184ec;
pragma solidity 0.8.17;

import "../avalanche/YieldYakSwapFacet.sol";

contract YieldYakSwapArbitrumFacet is YieldYakSwapFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }
}
