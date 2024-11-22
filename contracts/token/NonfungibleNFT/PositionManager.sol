// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 7791f4c6f965248c1000f6642d53e9701e04a22d;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';

import "../../interfaces/IPositionManager.sol";

/// @title NFT positions
contract PositionManager is
    ERC721Enumerable,
    IPositionManager,
    Ownable
{   
    // token id => Position Information
    mapping(uint256 => Position) private _positions;
    // bin id => Bin Information
    mapping(uint256 => DepositConfig) private _binInfo;
    uint176 private _nextId = 1;
    ISPrimeTraderJoe public sPrime;

    // Nothing to initialize from the constructor. 
    // Only had to call the contructor for ERC721
    constructor() ERC721('SPrime Position NFT', 'SPRIME-POS') {}

    modifier onlySPrime() {
        require(address(sPrime) == _msgSender(), "Not sPrime");
        _;
    }

    function setSPrime(ISPrimeTraderJoe sPrime_) external onlyOwner {
        sPrime = sPrime_;
        emit SPrimeUpdated(sPrime_);
    }

    function getDepositConfig(uint256 centerId) external view returns(DepositConfig memory) {
        return _binInfo[centerId];
    }

    function getDepositConfigFromTokenId(uint256 tokenId) external view returns(DepositConfig memory) {
        uint256 centerId = _positions[tokenId].centerId;
        return _binInfo[centerId];
    }

    function positions(uint256 tokenId)
        external
        view
        override
        returns (
            IERC20 token0,
            IERC20 token1,
            ILBPair pairAddr,
            uint256 totalShare,
            uint256 centerId,
            uint256[] memory liquidityMinted
        )
    {
        Position memory position = _positions[tokenId];

        return (
            sPrime.getTokenX(),
            sPrime.getTokenY(),
            sPrime.getLBPair(),
            position.totalShare,
            position.centerId,
            position.liquidityMinted
        );
    }

    function mint(MintParams calldata params)
        external
        override
        onlySPrime
        returns (
            uint256 tokenId
        )
    {
        _mint(params.recipient, tokenId = _nextId++);

        _positions[tokenId] = Position({
            totalShare: params.totalShare,
            centerId: params.centerId,
            liquidityMinted: params.liquidityMinted
        });
        
        DepositConfig storage binInfo = _binInfo[params.centerId];
        if(binInfo.depositIds.length == 0) {
            binInfo.depositIds = params.depositIds;
            binInfo.liquidityConfigs = params.liquidityConfigs;
        }
    }

    function update(UpdateParams calldata params)
        external
        override
        onlySPrime
    {
        Position storage position = _positions[params.tokenId];
        require(position.liquidityMinted.length == params.liquidityAmounts.length, "Length Dismatch");
        if(params.isAdd) {
            position.totalShare += params.share;
            for(uint i = 0 ; i < params.liquidityAmounts.length ; i ++) {
                position.liquidityMinted[i] += params.liquidityAmounts[i];
            }
        } else {
            position.totalShare -= params.share;
            for(uint i = 0 ; i < params.liquidityAmounts.length ; i ++) {
                position.liquidityMinted[i] -= params.liquidityAmounts[i];
            }
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId));
        return "";
    }

    function forceTransfer(address from, address to, uint256 tokenId) external override {
        _transfer(from, to, tokenId);
    }

    function burn(uint256 tokenId) external override {        
        _burn(tokenId);
        delete _positions[tokenId];
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override onlySPrime{
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}