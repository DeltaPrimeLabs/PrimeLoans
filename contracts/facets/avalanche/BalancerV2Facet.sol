// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 6f7f4cd9481c319d118ca12f8d2a3f8688dcf371;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/balancer-v2/IBalancerV2Vault.sol";
import "../../interfaces/balancer-v2/IBalancerV2Gauge.sol";
import "../../interfaces/balancer-v2/IBalancerPseudoMinter.sol";
import "../../interfaces/facets/avalanche/IBalancerV2Facet.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract BalancerV2Facet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent, IBalancerV2Facet {
    using TransferHelper for address;

    // Used to deposit/withdraw tokens
    // https://docs.balancer.fi/concepts/vault/
    address private constant MASTER_VAULT_ADDRESS = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    /**
     * Joins a pool and stakes in a gauge
     * @param request stake request
     **/
    function joinPoolAndStakeBalancerV2(IBalancerV2Facet.StakeRequest memory request) external nonReentrant onlyOwner remainsSolvent {
        uint256 stakedTokensLength = request.stakedTokens.length;

        if (stakedTokensLength != request.stakedAmounts.length) revert ArgArrayLengthsDiffer();

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        IVault vault = IVault(MASTER_VAULT_ADDRESS);

        (address pool,) = vault.getPool(request.poolId);
        if (pool == address(0)) revert ZeroAddressPool();

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        for (uint256 i; i < stakedTokensLength; i++) {
            if (request.stakedAmounts[i] > 0 && !tokenManager.isTokenAssetActive(request.stakedTokens[i])) revert DepositingInactiveToken();
            if (request.stakedTokens[i] == address(gauge)) revert DepositingWrongToken();
        }

        uint256[] memory initialDepositTokenBalances = new uint256[](stakedTokensLength);

        {
            bool allZero = true;

            for (uint256 i; i < stakedTokensLength; ++i) {
                if (request.stakedAmounts[i] > 0) {
                    IERC20 depositToken = IERC20Metadata(request.stakedTokens[i]);
                    initialDepositTokenBalances[i] = depositToken.balanceOf(address(this));
                    request.stakedAmounts[i] = Math.min(request.stakedAmounts[i], initialDepositTokenBalances[i]);
                }
            }

            for (uint256 i; i < stakedTokensLength; ++i ) {
                if (request.stakedAmounts[i] > 0) {
                    allZero = false;
                    request.stakedTokens[i].safeApprove(MASTER_VAULT_ADDRESS, 0);
                    request.stakedTokens[i].safeApprove(MASTER_VAULT_ADDRESS, request.stakedAmounts[i]);
                }
            }
            require(!allZero, "Cannot joinPoolAndStakeBalancerV2 0 tokens");
        }

        uint256 beforePoolBalance = IERC20(pool).balanceOf(address(this));
        {
            IAsset[] memory tokens;
            uint256[] memory amounts;
            bytes memory userData;

            {
                uint256 length;
                {
                    bool hasPoolToken;
                    for (uint256 i; i < stakedTokensLength; i++) {
                        if (request.stakedTokens[i] == pool) {
                            hasPoolToken = true;
                            break;
                        }
                    }

                    length = hasPoolToken ? stakedTokensLength : stakedTokensLength + 1;
                }
                tokens = new IAsset[](length);
                amounts = new uint256[](length);

                for (uint256 i; i < stakedTokensLength; i++) {
                    tokens[i] = IAsset(request.stakedTokens[i]);
                    amounts[i] = request.stakedAmounts[i];
                }

                if (stakedTokensLength != length) {
                    tokens[stakedTokensLength] = IAsset(pool);
                    amounts[stakedTokensLength] = 0;
                }

                userData = _calcUserData(request, stakedTokensLength, length);
            }

            IVault.JoinPoolRequest memory joinRequest = IVault.JoinPoolRequest(
                tokens,
                amounts,
                //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html
                userData,
                false
            );

            //joins the pool
            IVault(MASTER_VAULT_ADDRESS).joinPool(request.poolId, address(this), address(this), joinRequest);
        }

        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));
        {
            uint256 poolBalance = IERC20(pool).balanceOf(address(this)) - beforePoolBalance;

            IERC20(pool).approve(address(gauge), poolBalance);
            //stakes everything in a gauge
            gauge.deposit(poolBalance);

            bytes32 poolSymbol = tokenManager.tokenAddressToSymbol(pool);
            IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
                asset : pool,
                symbol : poolSymbol,
                identifier : poolToIdentifier(pool),
                balanceSelector : poolToBalanceSelector(pool),
                unstakeSelector : bytes4(0)
            });

            // Add staked position
            DiamondStorageLib.addStakedPosition(position);

            _increaseExposure(tokenManager, address(pool), IERC20(gauge).balanceOf(address(this)) - initialGaugeBalance);
        }

        bytes32[] memory stakedAssets = new bytes32[](stakedTokensLength);
        uint256[] memory stakedAmounts = new uint256[](stakedTokensLength);

        // Remove deposit tokens if empty and prepare arrays for the event
        for (uint256 i; i < stakedTokensLength; ++i ) {
            if (request.stakedAmounts[i] > 0) {
                _decreaseExposure(tokenManager, request.stakedTokens[i], request.stakedAmounts[i]);

                stakedAssets[i] = tokenManager.tokenAddressToSymbol(request.stakedTokens[i]);
                stakedAmounts[i] = initialDepositTokenBalances[i] - IERC20Metadata(request.stakedTokens[i]).balanceOf(address(this));
            }
        }

        emit StakeBalancerV2(
            msg.sender,
            stakedAssets,
            pool,
            stakedAmounts,
            IERC20(gauge).balanceOf(address(this)) - initialGaugeBalance,
            block.timestamp
        );
    }

    /**
     * Stakes in a gauge
     * @param poolId balancer pool id
     * @param amount stake amount
     **/
    function stakeBalancerV2(bytes32 poolId, uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        IVault vault = IVault(MASTER_VAULT_ADDRESS);

        (address pool,) = vault.getPool(poolId);
        if (pool == address(0)) revert ZeroAddressPool();

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));
        amount = Math.min(amount, IERC20(pool).balanceOf(address(this)));
        require(amount > 0, "Cannot stake 0 tokens");

        IERC20(pool).approve(address(gauge), amount);
        //stakes everything in a gauge
        gauge.deposit(amount);

        bytes32 poolSymbol = tokenManager.tokenAddressToSymbol(pool);
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : pool,
            symbol : poolSymbol,
            identifier : poolToIdentifier(pool),
            balanceSelector : poolToBalanceSelector(pool),
            unstakeSelector : bytes4(0)
        });

        // Add staked position
        DiamondStorageLib.addStakedPosition(position);
        if (IERC20(pool).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(poolSymbol);
        }

        emit BptStaked(
            msg.sender,
            poolSymbol,
            pool,
            amount,
            IERC20(gauge).balanceOf(address(this)) - initialGaugeBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes tokens a gauge and exits a pool
     * @param request unstake request
    **/
    function unstakeAndExitPoolBalancerV2(IBalancerV2Facet.UnstakeRequest memory request) external nonReentrant onlyOwnerOrInsolvent {
        (address pool,) = IVault(MASTER_VAULT_ADDRESS).getPool(request.poolId);
        if (pool == address(0)) revert ZeroAddressPool();

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (!tokenManager.isTokenAssetActive(request.unstakedToken)) revert UnstakingToInactiveToken();
        if (request.unstakedToken == address(pool) || request.unstakedToken == address(gauge)) revert UnstakingWrongToken();

        uint256 initialDepositTokenBalance = IERC20(request.unstakedToken).balanceOf(address(this));

        //checks as well if the pool is whitelisted
        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));

        //unstakes from the gauge
        gauge.withdraw(request.bptAmount);

        IVault.ExitPoolRequest memory exitRequest;

        //exit pool to basic assets
        {
            IAsset[] memory assets;
            uint256[] memory amounts;

            uint256 unstakedIndex;
            {
                (IERC20[] memory tokens,,) = IVault(MASTER_VAULT_ADDRESS).getPoolTokens(request.poolId);

                uint256 tokensLength = tokens.length;
                assets = new IAsset[](tokensLength);
                amounts = new uint256[](tokensLength);

                bool foundPoolToken;
                for (uint256 i; i < tokensLength; ++i) {
                    assets[i] = IAsset(address(tokens[i]));
                    if (address(tokens[i]) == pool) {
                        foundPoolToken = true;
                    }
                    if (address(tokens[i]) == request.unstakedToken) {
                        amounts[i] = request.unstakedAmount;
                        unstakedIndex = foundPoolToken ? i - 1 : i;
                    }
                }
            }

            exitRequest = IVault.ExitPoolRequest(
                assets,
                amounts,
                //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html
                abi.encode(0, request.bptAmount, unstakedIndex),
                false
            );
        }

        //exit the pool
        IVault(MASTER_VAULT_ADDRESS).exitPool(request.poolId, address(this), payable(address(this)), exitRequest);

        bytes32[] memory unstakedAssets = new bytes32[](1);
        uint256[] memory unstakedAmounts = new uint256[](1);

        unstakedAssets[0] = tokenManager.tokenAddressToSymbol(request.unstakedToken);
        unstakedAmounts[0] = IERC20(request.unstakedToken).balanceOf(address(this)) - initialDepositTokenBalance;
        uint256 newGaugeBalance = IERC20(gauge).balanceOf(address(this));

        _increaseExposure(tokenManager, request.unstakedToken, unstakedAmounts[0]);
        _decreaseExposure(tokenManager, address(pool), initialGaugeBalance - newGaugeBalance);


        if (newGaugeBalance == 0) {
            DiamondStorageLib.removeStakedPosition(poolToIdentifier(pool));
        }

        emit UnstakeBalancerV2(
            msg.sender,
            unstakedAssets,
            pool,
            unstakedAmounts,
            initialGaugeBalance - newGaugeBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes tokens a gauge
     * @param poolId balancer pool id
     * @param amount unstake amount
    **/
    function unstakeBalancerV2(bytes32 poolId, uint256 amount) external nonReentrant onlyOwnerOrInsolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        (address pool,) = IVault(MASTER_VAULT_ADDRESS).getPool(poolId);
        if (pool == address(0)) revert ZeroAddressPool();

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        uint256 initialDepositTokenBalance = IERC20(pool).balanceOf(address(this));

        //checks as well if the pool is whitelisted
        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));
        amount = Math.min(amount, initialGaugeBalance);
        require(amount > 0, "Cannot unstake 0 tokens");

        //unstakes from the gauge
        gauge.withdraw(amount);

        uint256 newGaugeBalance = IERC20(gauge).balanceOf(address(this));
        if (newGaugeBalance == 0) {
            DiamondStorageLib.removeStakedPosition(poolToIdentifier(pool));
        }

        bytes32 poolSymbol = tokenManager.tokenAddressToSymbol(pool);
        DiamondStorageLib.addOwnedAsset(poolSymbol, pool);

        emit BptUnstaked(
            msg.sender,
            poolSymbol,
            pool,
            IERC20(pool).balanceOf(address(this)) - initialDepositTokenBalance,
            initialGaugeBalance - newGaugeBalance,
            block.timestamp
        );
    }

    function claimRewardsBalancerV2(bytes32 poolId) external nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        (address pool,) = IVault(MASTER_VAULT_ADDRESS).getPool(poolId);
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        bytes32[] memory _rewardTokens = rewardTokens(pool);
        uint256[] memory initialBalances = new uint256[](_rewardTokens.length);

        for (uint256 i; i < _rewardTokens.length; i++) {
            address rewardToken;
            rewardToken = unsupportedAssetToAddress(_rewardTokens[i]);

            // Token is supported
            if(rewardToken == address(0)){
                rewardToken = tokenManager.getAssetAddress(_rewardTokens[i], false);
                initialBalances[i] = IERC20(rewardToken).balanceOf(address(this));
            }
            // Token is not supported
            else {
                initialBalances[i] = IERC20(rewardToken).balanceOf(address(this));
            }
        }

        gauge.claim_rewards();

        IBalancerPseudoMinter pseudoMinter = IBalancerPseudoMinter(gauge.bal_pseudo_minter());
        pseudoMinter.mint(address(gauge));

        for (uint256 i; i < _rewardTokens.length; i++) {
            address rewardToken;
            rewardToken = unsupportedAssetToAddress(_rewardTokens[i]);

            // Token is supported - add to owned assets
            if(rewardToken == address(0)){
                rewardToken = tokenManager.getAssetAddress(_rewardTokens[i], false);
                uint256 claimedAmount = IERC20(rewardToken).balanceOf(address(this)) - initialBalances[i];
                if(claimedAmount > 0) {
                    _increaseExposure(tokenManager, rewardToken, claimedAmount);
                    emit RewardClaimed(
                        msg.sender,
                        rewardToken,
                        _rewardTokens[i],
                        claimedAmount,
                        block.timestamp
                    );
                }
            }
            // Token is not supported - transfer to msg.sender
            else {
                uint256 claimedAmount = IERC20(rewardToken).balanceOf(address(this)) - initialBalances[i];
                if(claimedAmount > 0) {
                    rewardToken.safeTransfer(msg.sender, claimedAmount);
                    emit RewardClaimed(
                        msg.sender,
                        rewardToken,
                        _rewardTokens[i],
                        claimedAmount,
                        block.timestamp
                    );
                }
            }
        }
    }

    function balancerGgAvaxBalance() public view returns (uint256) {
        return gaugeBalance(0xC13546b97B9B1b15372368Dc06529d7191081F5B);
    }

    function balancerYyAvaxBalance() public view returns (uint256) {
        return gaugeBalance(0x9fA6aB3d78984A69e712730A2227F20bCC8b5aD9);
    }

    function balancerSAvaxBalance() public view returns (uint256) {
        return gaugeBalance(0xfD2620C9cfceC7D152467633B3B0Ca338D3d78cc);
    }

    // INTERNAL FUNCTIONS

    function poolToGauge(address pool) internal pure returns (address) {
        if (pool == 0xC13546b97B9B1b15372368Dc06529d7191081F5B) {
            return 0x231d84C37b2C4B5a2E2Fe325BB77DAa65bF71D92;
        }
        if (pool == 0x9fA6aB3d78984A69e712730A2227F20bCC8b5aD9) {
            return 0x720158c329E6558287c4539b0Ed21742B0B73436;
        }
        if (pool == 0xfD2620C9cfceC7D152467633B3B0Ca338D3d78cc) {
            return 0xf9aE6D2D56f02304f72dcC61694eAD0dC8DB51f7;
        }

        revert BalancerV2PoolNotWhitelisted();
    }

    function poolToIdentifier(address pool) internal pure returns (bytes32) {
        if (pool == 0xC13546b97B9B1b15372368Dc06529d7191081F5B) {
            return "BAL_GG_AVAX_MAIN";
        }
        if (pool == 0x9fA6aB3d78984A69e712730A2227F20bCC8b5aD9) {
            return "BAL_YY_AVAX_MAIN";
        }
        if (pool == 0xfD2620C9cfceC7D152467633B3B0Ca338D3d78cc) {
            return "BAL_S_AVAX_MAIN";
        }

        revert BalancerV2PoolNotWhitelisted();
    }

    function poolToBalanceSelector(address pool) internal pure returns (bytes4) {
        if (pool == 0xC13546b97B9B1b15372368Dc06529d7191081F5B) {
            return this.balancerGgAvaxBalance.selector;
        }
        if (pool == 0x9fA6aB3d78984A69e712730A2227F20bCC8b5aD9) {
            return this.balancerYyAvaxBalance.selector;
        }
        if (pool == 0xfD2620C9cfceC7D152467633B3B0Ca338D3d78cc) {
            return this.balancerSAvaxBalance.selector;
        }

        revert BalancerV2PoolNotWhitelisted();
    }

    function gaugeBalance(address pool) internal view returns (uint256) {
        address gauge = poolToGauge(pool);
        return IERC20(gauge).balanceOf(address(this));
    }

    function unsupportedAssetToAddress(bytes32 symbol) internal pure returns (address) {
        if (symbol == "GGP") {
            return 0x69260B9483F9871ca57f81A90D91E2F96c2Cd11d;
        }
        if (symbol == "BAL") {
            return 0xE15bCB9E0EA69e6aB9FA080c4c4A5632896298C3;
        }
        if (symbol == "QI") {
            return 0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5;
        }

        return address(0);
    }

    function rewardTokens(address pool) internal pure returns (bytes32[] memory) {
        if (pool == 0xC13546b97B9B1b15372368Dc06529d7191081F5B) {
            bytes32[] memory tokens = new bytes32[](4);
            tokens[0] = "AVAX";
            tokens[1] = "USDC";
            tokens[2] = "GGP";
            tokens[3] = "BAL";

            return tokens;
        }
        if (pool == 0x9fA6aB3d78984A69e712730A2227F20bCC8b5aD9) {
            bytes32[] memory tokens = new bytes32[](4);
            tokens[0] = "AVAX";
            tokens[1] = "USDC";
            tokens[2] = "yyAVAX";
            tokens[3] = "BAL";

            return tokens;
        }
        if (pool == 0xfD2620C9cfceC7D152467633B3B0Ca338D3d78cc) {
            bytes32[] memory tokens = new bytes32[](4);
            tokens[0] = "AVAX";
            tokens[1] = "USDC";
            tokens[2] = "QI";
            tokens[3] = "BAL";

            return tokens;
        }

        revert BalancerV2RewardsNotDefined();
    }

    function _calcUserData(IBalancerV2Facet.StakeRequest memory request, uint256 stakedTokensLength, uint256 length) internal view returns (bytes memory userData) {
        IVault vault = IVault(MASTER_VAULT_ADDRESS);
        (address pool,) = vault.getPool(request.poolId);

        if (stakedTokensLength != length) {
            userData = abi.encode(1, request.stakedAmounts, request.minBptAmount);
        } else {
            uint256[] memory stakedAmounts = new uint256[](length - 1);
            uint256 j;
            for (uint256 i; i < stakedTokensLength; i++) {
                if (request.stakedTokens[i] != pool) {
                    stakedAmounts[j] = request.stakedAmounts[i];
                    ++j;
                }
            }
            userData = abi.encode(1, stakedAmounts, request.minBptAmount);
        }
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    event RewardClaimed(
        address indexed user,
        address indexed token,
        bytes32 asset,
        uint256 amount,
        uint256 timestamp
    );


    // ERRORS
    error BalancerV2PoolNotWhitelisted();

    error BalancerV2RewardsNotDefined();

    error ArgArrayLengthsDiffer();

    error DepositingInactiveToken();

    error DepositingWrongToken();

    error UnstakingToInactiveToken();

    error UnstakingWrongToken();

    error ZeroAddressPool();
}
