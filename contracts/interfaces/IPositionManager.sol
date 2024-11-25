// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';
import "./ISPrimeTraderJoe.sol";

interface IPositionManager is IERC721Enumerable {
    // details about the position
    struct Position {
        // the liquidity of the position
        uint256 totalShare;
        uint256 centerId;
        uint256[] liquidityMinted;
    }

    struct DepositConfig {
        uint256[] depositIds;
        bytes32[] liquidityConfigs;
    }


    struct UpdateParams {
        uint256 tokenId;
        uint256 share;
        uint256[] liquidityAmounts;
        bool isAdd;
    }

    struct MintParams {
        address recipient;
        uint256 totalShare;
        uint256 centerId;
        uint256[] liquidityMinted;
        bytes32[] liquidityConfigs;
        uint256[] depositIds;
    }

    event SPrimeUpdated(ISPrimeTraderJoe prime);

    // Mint new position NFT
    function mint(
        MintParams calldata params
    )
        external
        returns (
            uint256 tokenId
        );

    // Burn position NFT
    function burn(
        uint256 tokenId
    )
        external;

    function update(
        UpdateParams calldata params
    )
        external;

    function forceTransfer(address from, address to, uint256 tokenId) external;
    function getDepositConfig(uint256 centerId) external view returns(DepositConfig memory);
    function getDepositConfigFromTokenId(uint256 tokenId) external view returns(DepositConfig memory);
    
    // Get position details
    function positions(uint256 tokenId)
        external
        view
        returns (
            IERC20 token0,
            IERC20 token1,
            ILBPair pairAddr,
            uint256 totalShare,
            uint256 centerId,
            uint256[] memory liquidityMinted
        );
}