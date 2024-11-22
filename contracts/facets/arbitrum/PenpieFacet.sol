// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 45f62a9cb0dbaab64877c33c5a5f9324e08e6a40;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/arbitrum/IPendleRouter.sol";
import "../../interfaces/arbitrum/IPendleDepositHelper.sol";
import "../../interfaces/arbitrum/IMasterPenpie.sol";
import "../../OnlyOwnerOrInsolvent.sol";
//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract PenpieFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // CONSTANTS

    address private constant PENDLE_ROUTER =
        0x888888888889758F76e7103c6CbF23ABbF58F946;
    address public constant DEPOSIT_HELPER =
        0xc06a5d3014b9124Bf215287980305Af2f793eB30;
    address public constant PENDLE_STAKING =
        0x6DB96BBEB081d2a85E0954C252f2c1dC108b3f81;
    address public constant MASTER_PENPIE =
        0x0776C06907CE6Ff3d9Dbf84bA9B3422d7225942D;
    address public constant PNP = 0x2Ac2B254Bc18cD4999f64773a966E4f4869c34Ee;
    address public constant PENDLE = 0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8;
    address public constant SILO = 0x0341C0C0ec423328621788d4854119B97f44E391;

    address public constant PENDLE_EZ_ETH_MARKET =
        0x5E03C94Fc5Fb2E21882000A96Df0b63d2c4312e2;
    address public constant PENDLE_EZ_ETH_26_09_24 =
    0x35f3dB08a6e9cB4391348b0B404F493E7ae264c0;

    address public constant PENDLE_WST_ETH_MARKET =
        0xFd8AeE8FCC10aac1897F8D5271d112810C79e022;
    address public constant PENDLE_WSTETH_26_06_25 =
    0x08a152834de126d2ef83D612ff36e4523FD0017F;

    address public constant PENDLE_E_ETH_MARKET =
        0x952083cde7aaa11AB8449057F7de23A970AA8472;
    address public constant PENDLE_E_ETH_26_09_24 =
    0xf9F9779d8fF604732EBA9AD345E6A27EF5c2a9d6;

    address public constant PENDLE_RS_ETH_MARKET =
        0x6Ae79089b2CF4be441480801bb741A531d94312b;
    address public constant PENDLE_RS_ETH_26_09_24 =
    0xED99fC8bdB8E9e7B8240f62f69609a125A0Fbf14;

    address public constant PENDLE_WST_ETH_SILO_MARKET =
        0xACcd9A7cb5518326BeD715f90bD32CDf2fEc2D14;

    // PUBLIC FUNCTIONS

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function depositToPendleAndStakeInPenpie(
        bytes32 asset,
        uint256 amount,
        address market,
        uint256 minLpOut,
        IPendleRouter.ApproxParams memory guessPtReceivedFromSy,
        IPendleRouter.TokenInput memory input,
        IPendleRouter.LimitOrderData memory limit
    ) external onlyOwner nonReentrant remainsSolvent {
        require(minLpOut > 0, "Invalid minLpOut");

        address lpToken = _getPenpieLpToken(market);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        IERC20 token = IERC20(tokenManager.getAssetAddress(asset, false));

        amount = Math.min(token.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot stake 0 tokens");

        address(token).safeApprove(PENDLE_ROUTER, 0);
        address(token).safeApprove(PENDLE_ROUTER, amount);

        (uint256 netLpOut, , ) = IPendleRouter(PENDLE_ROUTER)
            .addLiquiditySingleToken(
                address(this),
                market,
                minLpOut,
                guessPtReceivedFromSy,
                input,
                limit
            );
        require(netLpOut >= minLpOut, "Too little received");

        market.safeApprove(PENDLE_STAKING, 0);
        market.safeApprove(PENDLE_STAKING, netLpOut);

        IPendleDepositHelper(DEPOSIT_HELPER).depositMarket(market, netLpOut);

        _increaseExposure(tokenManager, lpToken, netLpOut);
        _decreaseExposure(tokenManager, address(token), amount);

        emit Staked(msg.sender, asset, lpToken, amount, netLpOut, block.timestamp);
    }

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function unstakeFromPenpieAndWithdrawFromPendle(
        bytes32 asset,
        uint256 amount,
        address market,
        uint256 minOut,
        IPendleRouter.TokenOutput memory output,
        IPendleRouter.LimitOrderData memory limit
    ) external onlyOwnerOrInsolvent nonReentrant returns (uint256) {
        address lpToken = _getPenpieLpToken(market);
        uint256 netTokenOut;

        {
            amount = Math.min(IERC20(lpToken).balanceOf(address(this)), amount);
            require(amount > 0, "Cannot unstake 0 tokens");

            {
                (
                    uint256 pendingPenpie,
                    address[] memory bonusTokenAddresses,
                    uint256[] memory pendingBonusRewards
                ) = pendingRewards(market);

                IPendleDepositHelper(DEPOSIT_HELPER).withdrawMarketWithClaim(
                    market,
                    amount,
                    true
                );

                _handleRewards(pendingPenpie, bonusTokenAddresses, pendingBonusRewards);
            }

            market.safeApprove(PENDLE_ROUTER, 0);
            market.safeApprove(PENDLE_ROUTER, amount);

            (netTokenOut, , ) = IPendleRouter(PENDLE_ROUTER)
                .removeLiquiditySingleToken(
                    address(this),
                    market,
                    amount,
                    output,
                    limit
                );
            require(netTokenOut >= minOut, "Too little received");

            ITokenManager tokenManager = DeploymentConstants.getTokenManager();
            address token = tokenManager.getAssetAddress(asset, false);

            require(token == output.tokenOut, "Invalid input token");

            _increaseExposure(tokenManager, token, netTokenOut);
            _decreaseExposure(tokenManager, lpToken, amount);
        }

        emit Unstaked(
            msg.sender,
            asset,
            lpToken,
            netTokenOut,
            amount,
            block.timestamp
        );

        return netTokenOut;
    }

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function depositPendleLPAndStakeInPenpie(
        address market,
        uint256 amount
    ) external onlyOwner nonReentrant remainsSolvent {
        address lpToken = _getPenpieLpToken(market);

        market.safeTransferFrom(msg.sender, address(this), amount);

        market.safeApprove(PENDLE_STAKING, 0);
        market.safeApprove(PENDLE_STAKING, amount);

        IPendleDepositHelper(DEPOSIT_HELPER).depositMarket(market, amount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, lpToken, amount);

        emit PendleLpStaked(msg.sender, lpToken, amount, block.timestamp);
    }

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function unstakeFromPenpieAndWithdrawPendleLP(
        address market,
        uint256 amount
    )
        external
        onlyOwner
        canRepayDebtFully
        nonReentrant
        remainsSolvent
        returns (uint256)
    {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address lpToken = _getPenpieLpToken(market);

        amount = Math.min(IERC20(lpToken).balanceOf(address(this)), amount);
        require(amount > 0, "Cannot unstake 0 tokens");

        (
            uint256 pendingPenpie,
            address[] memory bonusTokenAddresses,
            uint256[] memory pendingBonusRewards
        ) = pendingRewards(market);

        IPendleDepositHelper(DEPOSIT_HELPER).withdrawMarketWithClaim(
            market,
            amount,
            true
        );
        _handleRewards(pendingPenpie, bonusTokenAddresses, pendingBonusRewards);

        market.safeTransfer(msg.sender, amount);

        _decreaseExposure(tokenManager, lpToken, amount);

        emit PendleLpUnstaked(msg.sender, lpToken, amount, block.timestamp);

        return amount;
    }

    function pendingRewards(
        address market
    ) public view returns (uint256, address[] memory, uint256[] memory) {
        (
            uint256 pendingPenpie,
            address[] memory bonusTokenAddresses,
            ,
            uint256[] memory pendingBonusRewards
        ) = IMasterPenpie(MASTER_PENPIE).allPendingTokens(market, address(this));
        return (pendingPenpie, bonusTokenAddresses, pendingBonusRewards);
    }

    function claimRewards(address market) external onlyOwner {
        (
            uint256 pendingPenpie,
            address[] memory bonusTokenAddresses,
            uint256[] memory pendingBonusRewards
        ) = pendingRewards(market);
        address[] memory stakingTokens = new address[](1);
        stakingTokens[0] = market;
        IMasterPenpie(MASTER_PENPIE).multiclaim(stakingTokens);

        _handleRewards(pendingPenpie, bonusTokenAddresses, pendingBonusRewards);
    }

    // INTERNAL FUNCTIONS
    function _getPenpieLpToken(address market) internal pure returns (address) {
        // ezETH
        if (market == PENDLE_EZ_ETH_MARKET) {
            return 0xecCDC2C2191d5148905229c5226375124934b63b;
        }
        if (market == PENDLE_EZ_ETH_26_09_24) {
            return 0xB3f215aFD47Dd29f4B82D9b480BB86FeAF543e67;
        }

        // wstETH
        if (market == PENDLE_WST_ETH_MARKET) {
            return 0xdb0e1D1872202A81Eb0cb655137f4a937873E02f;
        }
        if (market == PENDLE_WSTETH_26_06_25) {
            return 0x4d2Faa48Ef93Cc3c8A7Ec27F3Cb91cEB1a36F89B;
        }

        // eETH
        if (market == PENDLE_E_ETH_MARKET) {
            return 0x264f4138161aaE16b76dEc7D4eEb756f25Fa67Cd;
        }
        if (market == PENDLE_E_ETH_26_09_24) {
            return 0xa7D760926F3098E9fb5A93018155578fCDad75C0;
        }

        // rsETH
        if (market == PENDLE_RS_ETH_MARKET) {
            return 0xe3B327c43b5002eb7280Eef52823698b6cDA06cF;
        }
        if (market == PENDLE_RS_ETH_26_09_24) {
            return 0x9e411b97437Af296D6c4b482893c63Ffd8DfBE6D;
        }

        // wstETHSilo
        if (market == PENDLE_WST_ETH_SILO_MARKET) {
            return 0xCcCC7c80c9Be9fDf22e322A5fdbfD2ef6ac5D574;
        }

        revert("Invalid market address");
    }

    function _handleRewards(
        uint256 pendingPenpie,
        address[] memory bonusTokenAddresses,
        uint256[] memory pendingBonusRewards
    ) internal {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address owner = DiamondStorageLib.contractOwner();

        if (pendingPenpie > 0 && tokenManager.isTokenAssetActive(PNP)) {
            _increaseExposure(tokenManager, PNP, pendingPenpie);
        } else if (pendingPenpie > 0) {
            PNP.safeTransfer(owner, pendingPenpie);
        }

        uint256 len = bonusTokenAddresses.length;
        for (uint256 i; i != len; ++i) {
            address bonusToken = bonusTokenAddresses[i];
            uint256 pendingReward = pendingBonusRewards[i];
            if (pendingReward == 0) {
                continue;
            }

            if (tokenManager.isTokenAssetActive(bonusToken)) {
                _increaseExposure(tokenManager, bonusToken, pendingReward);
            } else {
                bonusToken.safeTransfer(owner, pendingReward);
            }
        }
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    /**
     * @dev emitted when user stakes an asset
     * @param user the address executing staking
     * @param asset the asset that was staked
     * @param vault address of receipt token
     * @param depositTokenAmount how much of deposit token was staked
     * @param receiptTokenAmount how much of receipt token was received
     * @param timestamp of staking
     **/
    event Staked(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositTokenAmount,
        uint256 receiptTokenAmount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user unstakes an asset
     * @param user the address executing unstaking
     * @param asset the asset that was unstaked
     * @param vault address of receipt token
     * @param depositTokenAmount how much deposit token was received
     * @param receiptTokenAmount how much receipt token was unstaked
     * @param timestamp of unstaking
     **/
    event Unstaked(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositTokenAmount,
        uint256 receiptTokenAmount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user stakes an asset
     * @param user the address executing staking
     * @param vault address of receipt token
     * @param amount how much of deposit token was staked
     * @param timestamp of staking
     **/
    event PendleLpStaked(
        address indexed user,
        address indexed vault,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user unstakes an asset
     * @param user the address executing unstaking
     * @param vault address of receipt token
     * @param amount how much deposit token was received
     * @param timestamp of unstaking
     **/
    event PendleLpUnstaked(
        address indexed user,
        address indexed vault,
        uint256 amount,
        uint256 timestamp
    );
}
