// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@redstone-finance/evm-connector/contracts/mocks/AuthorisedMockSignersBase.sol";
import {LTIPFacet} from "../arbitrum/LTIPFacet.sol";

contract LTIPFacetMock is LTIPFacet, AuthorisedMockSignersBase{
    uint256 constant DEFAULT_MAX_DATA_TIMESTAMP_DELAY_SECONDS = 15 minutes;

    uint256 internal constant MIN_TIMESTAMP_MILLISECONDS = 1654353400000;

    function getAuthorisedSignerIndex(address signerAddress)
    public
    view
    virtual
    override
    returns (uint8)
    {
        return getAuthorisedMockSignerIndex(signerAddress);
    }

    function validateTimestamp(uint256 receivedTimestampMilliseconds) public view virtual override {
        // Always pass
    }

}
