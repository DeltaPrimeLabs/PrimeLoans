import chai, { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SmartLoansFactory, VPrimeMock, MockTokenManager, ISwapRouter } from "../../../typechain";
import VPrimeArtifact from '../../../artifacts/contracts/token/vPrime.sol/vPrime.json';
import VPrimeControllerArtifact from '../../../artifacts/contracts/token/mock/vPrimeControllerAvalancheMock.sol/vPrimeControllerAvalancheMock.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SPrimeArtifact from '../../../artifacts/contracts/token/sPrimeUniswap.sol/sPrimeUniswap.json';
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { Asset, PoolAsset, PoolInitializationObject, convertAssetsListToSupportedAssets, convertTokenPricesMapToMockPrices, deployPools, getFixedGasSigners, getRedstonePrices, getTokensPricesMap } from '../../_helpers';
import { deployDiamond } from '../../../tools/diamond/deploy-diamond';
import { parseEther } from 'viem';
import { BigNumber, BigNumberish } from 'ethers';
import bn from 'bignumber.js'
import { Contract } from "ethers";

export const erc20ABI = require('../../abis/ERC20.json');

const { deployContract, provider } = waffle;
chai.use(solidity);

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
    return BigNumber.from(
        new bn(reserve1.toString())
            .div(reserve0.toString())
            .sqrt()
            .multipliedBy(new bn(2).pow(96))
            .integerValue(3)
            .toString()
    )
}
const PositionManagerABI = [
    'function balanceOf(address owner) external view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
    'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, uint80 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)'
];


const UniswapV3PoolABI = [
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function tickSpacing() view returns (int24)'
];

const SwapRouterABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
    'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)',
    'function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)'
];

const uniV3SwapRouterAddr = "0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE";
const uniV3FactoryAddr = "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD";

describe("SPrimeUniswapV3", function () {
    // Contract Factory
    let SPrimeFactory, PrimeFactory, swapRouter, smartLoansFactory, initialTick;
    // Contracts
    let wavax, prime, sPrime, positionManager, pool, vPrime, vPrimeControllerContract;

    let lendingPools: Array<PoolAsset> = [],
        supportedAssets: Array<Asset>,
        owner: SignerWithAddress,
        addr1: SignerWithAddress,
        addr2: SignerWithAddress,
        addr3: SignerWithAddress,
        addr4: SignerWithAddress,
        addr5: SignerWithAddress,
        whale: SignerWithAddress,
        MOCK_PRICES: any,
        poolContracts: Map<string, Contract> = new Map(),
        tokenContracts: Map<string, Contract> = new Map();

    before(async function () {
        [owner, addr1, addr2, addr3, addr4, addr5] = await getFixedGasSigners(10000000);

        SPrimeFactory = await ethers.getContractFactory("sPrimeUniswap");
        const SPrimeImplFactory = await ethers.getContractFactory("sPrimeUniswapImpl");
        let user1 = await addr1.getAddress();
        let user2 = await addr2.getAddress();
        let user3 = await addr3.getAddress();

        PrimeFactory = await ethers.getContractFactory("Prime");
        prime = await PrimeFactory.deploy(parseEther("1000000"));
        wavax = await ethers.getContractAt("WETH9", '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7');

        let assetsList = ['AVAX', 'USDC'];
        let diamondAddress = await deployDiamond();
        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        let tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact,
            []
        ) as MockTokenManager;
        let poolNameAirdropList: Array<PoolInitializationObject> = [
            { name: 'AVAX', airdropList: [addr2, addr1] },
            { name: 'USDC', airdropList: [addr2, addr1] }
        ];
        await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, addr1, 1000, 'AVAX', [], tokenManager.address);

        let tokensPrices = await getTokensPricesMap(
            assetsList,
            "avalanche",
            getRedstonePrices,
            []
        );
        MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
        supportedAssets = convertAssetsListToSupportedAssets(assetsList);
        await tokenManager.initialize(supportedAssets, lendingPools);
        await tokenManager.setFactoryAddress(smartLoansFactory.address);
        await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

        vPrime = await deployContract(
            owner,
            VPrimeArtifact,
            []
        ) as VPrimeMock;

        await vPrime.initialize(smartLoansFactory.address);
        await prime.transfer(user1, parseEther("100000"));
        await prime.transfer(user2, parseEther("100000"));
        await prime.transfer(user3, parseEther("100000"));
        positionManager = new ethers.Contract('0x655C406EBFa14EE2006250925e54ec43AD184f8B', PositionManagerABI, provider);
        swapRouter = new ethers.Contract(uniV3SwapRouterAddr, SwapRouterABI, provider);

        await wavax.connect(owner).deposit({ value: parseEther("100") });
        await wavax.transfer(user1, parseEther("10"));
        await wavax.transfer(user2, parseEther("10"));
        await wavax.transfer(user3, parseEther("10"));
        await wavax.connect(owner).approve(positionManager.address, parseEther("1"));
        await prime.connect(owner).approve(positionManager.address, parseEther("1000"));
        const token0 = wavax.address < prime.address ? wavax.address : prime.address;
        const token1 = wavax.address < prime.address ? prime.address : wavax.address;
        await positionManager.connect(owner).createAndInitializePoolIfNecessary(
            token0,
            token1,
            3000,
            encodePriceSqrt(parseEther("1"), parseEther("1")),
        )
        sPrime = await deployContract(
            owner,
            SPrimeArtifact,
            []
        ) as Contract;
        await sPrime.initialize(prime.address, wavax.address, "PRIME-WAVAX", 3000, 30, positionManager.address, uniV3SwapRouterAddr, uniV3FactoryAddr);
        sPrime = WrapperBuilder.wrap(
            sPrime.connect(owner)
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });
        const poolAddress = await sPrime.pool();
        pool = new ethers.Contract(poolAddress, UniswapV3PoolABI, owner);
        const slot0 = await pool.slot0();
        initialTick = slot0.tick;

        vPrimeControllerContract = await deployContract(
            owner,
            VPrimeControllerArtifact,
            []
        ) as Contract;

        await vPrimeControllerContract.initialize([sPrime.address], tokenManager.address, vPrime.address, false);
        vPrimeControllerContract = WrapperBuilder.wrap(
            vPrimeControllerContract
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        const implementation = await SPrimeImplFactory.deploy(sPrime.address);

        await tokenManager.setVPrimeControllerAddress(vPrimeControllerContract.address);
        await poolContracts.get('AVAX')!.setTokenManager(tokenManager.address);
        await poolContracts.get('USDC')!.setTokenManager(tokenManager.address);
        await vPrime.connect(owner).setVPrimeControllerAddress(vPrimeControllerContract.address);
        await sPrime.setVPrimeControllerAddress(vPrimeControllerContract.address);
        await sPrime.setImplementation(implementation.address);
        await vPrimeControllerContract.connect(owner).updateBorrowersRegistry(smartLoansFactory.address);

        // Approve at the starting point
        await prime.connect(addr1).approve(sPrime.address, parseEther("1000000"));
        await wavax.connect(addr1).approve(sPrime.address, parseEther("1000000"));

        await prime.connect(addr2).approve(sPrime.address, parseEther("1000000"));
        await wavax.connect(addr2).approve(sPrime.address, parseEther("1000000"));
    });

    describe("Deposit", function () {
        it("Should deposit correctly", async function () {
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            await sPrime.deposit(initialTick, 0, parseEther("1"), parseEther("1"), false, 5);

            const userShare = await positionManager.balanceOf(sPrime.address);
            expect(userShare).to.equal(1);
        });

        it("Should deposit two times without rebalance", async function () {
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            await sPrime.deposit(initialTick, 0, parseEther("1"), parseEther("1"), false, 5);
        });

        it("Should deposit with token swap to use equal amount", async function () {
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr2)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 10, parseEther("10"), parseEther("10"), false, 5);

            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 0, parseEther("0.1"), parseEther("0.1"), false, 5);
            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 100, parseEther("1"), parseEther("0.005"), true, 100);
        });

        it("Should fail if slippage too high", async function () {
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            initialTick = (await pool.slot0()).tick;
            await expect(sPrime.deposit(initialTick, 0, parseEther("1"), parseEther("1"), false, 5001)).to.be.revertedWith("SlippageTooHigh");
        });
    });

    describe("Rebalance", function () {
        it("Rebalance after some token swap", async function () {
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 100, parseEther("10"), parseEther("10"), true, 500);

            await prime.connect(addr2).approve(swapRouter.address, parseEther("0.1"));
            await swapRouter.connect(addr2).exactInputSingle({
                tokenIn: prime.address,
                tokenOut: wavax.address,
                fee: 3000,
                recipient: addr2.address,
                amountIn: parseEther("0.1"),
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 100, 0, 0, true, 500);
            const tokenId = await sPrime.userTokenId(addr1.address);
            expect(tokenId).to.not.equal(0);
        });

        it("Should receive the position using the balance", async function () {
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 100, parseEther("1"), parseEther("1"), true, 500);

            await prime.connect(addr2).approve(sPrime.address, parseEther("10"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("10"));

            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr2)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            await sPrime.deposit(initialTick, 100, parseEther("10"), parseEther("10"), true, 500);

            // Fetching User 1 Status

            let tokenId = await sPrime.userTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.gt(0);

            const oldLiquidity = userShare.liquidity;
            tokenId = await sPrime.userTokenId(addr2.address);

            userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.gt(0);

            await prime.connect(addr2).approve(swapRouter.address, parseEther("1"));

            await swapRouter.connect(addr2).exactInputSingle({
                tokenIn: prime.address,
                tokenOut: wavax.address,
                fee: 3000,
                recipient: addr2.address,
                amountIn: parseEther("1"),
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            // Rebalancing User 1's position
            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 100, 0, 0, true, 500);
            tokenId = await sPrime.userTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.not.equal(oldLiquidity);

            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr2)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            // Transfer share from User 2 to User 3
            const user2Balance = await sPrime.balanceOf(addr2.address);
            await sPrime.transfer(addr3.address, user2Balance);
        });

        it("Process rebalance after receiving the nft position", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("10"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("10"));

            initialTick = (await pool.slot0()).tick;
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            await sPrime.deposit(initialTick, 100, parseEther("10"), parseEther("10"), true, 500);

            await prime.connect(addr2).approve(sPrime.address, parseEther("1"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("1"));

            initialTick = (await pool.slot0()).tick;
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr2)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            await sPrime.deposit(initialTick, 100, parseEther("1"), parseEther("1"), true, 500);

            // Fetching User 1 Status

            let tokenId = await sPrime.userTokenId(addr2.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.gt(0);

            const oldLiquidity = userShare.liquidity;
            
            tokenId = await sPrime.userTokenId(addr2.address);

            userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.gt(0);

            await prime.connect(addr2).approve(swapRouter.address, parseEther("3"));
            await swapRouter.connect(addr2).exactInputSingle({
                tokenIn: prime.address,
                tokenOut: wavax.address,
                fee: 3000,
                recipient: addr2.address,
                amountIn: parseEther("3"),
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

            // Rebalancing User 1's position
            initialTick = (await pool.slot0()).tick;

            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr2)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            await sPrime.deposit(initialTick, 100, 0, 0, true, 500);
            tokenId = await sPrime.userTokenId(addr2.address);
            userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.not.equal(oldLiquidity);
            const user1InitialShare = userShare.liquidity;

            // Transfer share from User 2 to User 4
            const user2Balance = await sPrime.balanceOf(addr2.address);
            await sPrime.transfer(addr4.address, user2Balance);

            // After receiving the position process the Rebalance
            initialTick = (await pool.slot0()).tick;
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr4)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            await sPrime.deposit(initialTick, 100, 0, 0, true, 500);
            tokenId = await sPrime.userTokenId(addr4.address);
            userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.equal(user1InitialShare);
            tokenId = await sPrime.userTokenId(addr2.address);
            expect(tokenId).to.equal(0);
        });
    });

    describe("Withdraw", function () {
        it("Should withdraw correctly using token ID", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 1000, parseEther("1"), parseEther("1"), true, 500);

            let amount = await sPrime.balanceOf(addr1.address);
            
            await sPrime.withdraw(amount);
            let tokenId = await sPrime.userTokenId(addr1.address);
            expect(tokenId).to.equal(0);
        });

        it("Should receive different amount because of token swap", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("100"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("100"));

            initialTick = (await pool.slot0()).tick;
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr2)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            await sPrime.deposit(initialTick, 1000, parseEther("10"), parseEther("10"), true, 500);


            await prime.connect(addr1).approve(sPrime.address, parseEther("200"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("200"));

            initialTick = (await pool.slot0()).tick;
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            await sPrime.deposit(initialTick, 1000, parseEther("10"), parseEther("0.1"), true, 500);
            
            let tokenId = await sPrime.userTokenId(addr1.address);

            let userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.gt(0);
            initialTick = (await pool.slot0()).tick;
            await sPrime.deposit(initialTick, 1000, parseEther("1"), parseEther("0.05"), true, 500);
            tokenId = await sPrime.userTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);
            expect(userShare.liquidity).to.gt(0);
            const initialPrimeBalance = await prime.balanceOf(addr1.address);
            const initialWAvaxBalance = await wavax.balanceOf(addr1.address);
            let amount = await sPrime.balanceOf(addr1.address);
            await sPrime.withdraw(amount);
            const afterPrimeBalance = await prime.balanceOf(addr1.address);
            const afterWAvaxBalance = await wavax.balanceOf(addr1.address);

            console.log("Input Prime Amount: ", parseEther("1010"));
            console.log("Received Prime After Withdraw: ", afterPrimeBalance - initialPrimeBalance);
            console.log("Input WAVAX Amount: ", parseEther("2"));
            console.log("Received WAVAX After Withdraw: ", afterWAvaxBalance - initialWAvaxBalance);
        });

        it("Should fail if trys to withdraw more shares than the balance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));

            initialTick = (await pool.slot0()).tick;
            sPrime = WrapperBuilder.wrap(
                sPrime.connect(addr1)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            await sPrime.deposit(initialTick, 1000, parseEther("1"), parseEther("1"), true, 500);

            await expect(sPrime.withdraw(parseEther("1000"))).to.be.revertedWith("BalanceLocked");
        });
    });
});
