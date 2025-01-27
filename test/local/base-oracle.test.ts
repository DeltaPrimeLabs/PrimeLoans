import chai, {expect} from "chai"
import {ethers, waffle} from "hardhat"
import { Signer } from "ethers";
import BaseOracleArtifact from "../../artifacts/contracts/oracle/BaseOracle.sol/BaseOracle.json";
import {BaseOracle} from "../../typechain";

import {solidity} from "ethereum-waffle";
const {deployContract} = waffle;

chai.use(solidity);

describe("BaseOracle", function() {
    const TOKENS = {
        WETH: '0x4200000000000000000000000000000000000006',
        AERO: '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
        BRETT: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
        AIXBT: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825',
    };

    const POOLS = {
        BRETT: [
            {
                address: '0x43BBb129b56A998732767725A183b7a566843dBA',
                isCL: false,
                pair: 'AERO',
                baseAsset: TOKENS.AERO
            },
            {
                address: '0x4e829F8A5213c42535AB84AA40BD4aDCCE9cBa02',
                isCL: true,
                pair: 'WETH',
                tickSpacing: 200,
                baseAsset: TOKENS.WETH
            }
        ],
        AIXBT: [
            {
                address: '0xF3E7E359b75a7223BA9D71065C57DDd4F5D8747e',
                isCL: false,
                pair: 'WETH',
                baseAsset: TOKENS.WETH
            },
            {
                address: '0x22A52bB644f855ebD5ca2edB643FF70222D70C31',
                isCL: true,
                pair: 'WETH',
                tickSpacing: 200,
                baseAsset: TOKENS.WETH
            }
        ]
    };

    let oracle: BaseOracle;
    let owner: Signer;
    let addr1: Signer;
    let ownerAddress: string;
    let addr1Address: string;

    beforeEach(async function() {
        [owner, addr1] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        addr1Address = await addr1.getAddress();
        oracle = (await deployContract(owner, BaseOracleArtifact)) as BaseOracle;
    });

    describe("Admin Functions", function() {
        it("Should set admin correctly on deployment", async function() {
            expect(await oracle.admin()).to.equal(ownerAddress);
        });

        it("Should allow admin to change admin", async function() {
            await oracle.setAdmin(addr1Address);
            expect(await oracle.admin()).to.equal(addr1Address);
        });

        it("Should not allow non-admin to change admin", async function() {
            await expect(
                oracle.connect(addr1).setAdmin(addr1Address)
            ).to.be.revertedWith("Only admin");
        });

        it("Should not allow configuring token with empty pools", async function() {
            await expect(
                oracle.configureToken(TOKENS.BRETT, [])
            ).to.be.revertedWith("Empty pools");
        });

        it("Should not allow configuring pools with invalid base asset", async function() {
            const invalidPools = [{
                poolAddress: POOLS.BRETT[0].address,
                isCL: false,
                tickSpacing: 0,
                shortTwap: 30,
                midTwap: 3600,
                longTwap: 86400,
                midDeviation: ethers.utils.parseUnits("0.02", 18),
                longDeviation: ethers.utils.parseUnits("0.05", 18),
                minLiquidity: ethers.utils.parseUnits("1000", 18),
                baseAsset: ethers.constants.AddressZero
            }];
            await expect(
                oracle.configureToken(TOKENS.BRETT, invalidPools)
            ).to.be.revertedWith("Invalid base asset");
        });
    });

    describe("Token Configuration", function() {
        it("Should emit TokenConfigured event when configuring token", async function() {
            const pools = POOLS.BRETT.map(pool => ({
                poolAddress: pool.address,
                isCL: pool.isCL,
                tickSpacing: pool.isCL ? pool.tickSpacing : 0,
                shortTwap: 30,
                midTwap: 3600,
                longTwap: 86400,
                midDeviation: ethers.utils.parseUnits("0.02", 18),
                longDeviation: ethers.utils.parseUnits("0.05", 18),
                minLiquidity: ethers.utils.parseUnits("1000", 18),
                baseAsset: pool.baseAsset
            }));

            await expect(oracle.configureToken(TOKENS.BRETT, pools))
                .to.emit(oracle, 'TokenConfigured')
                .withArgs(TOKENS.BRETT);
        });

        it("Should allow removing token configuration", async function() {
            // First configure the token
            const pools = POOLS.BRETT.map(pool => ({
                poolAddress: pool.address,
                isCL: pool.isCL,
                tickSpacing: pool.isCL ? pool.tickSpacing : 0,
                shortTwap: 30,
                midTwap: 3600,
                longTwap: 86400,
                midDeviation: ethers.utils.parseUnits("0.02", 18),
                longDeviation: ethers.utils.parseUnits("0.05", 18),
                minLiquidity: ethers.utils.parseUnits("1000", 18),
                baseAsset: pool.baseAsset
            }));
            await oracle.configureToken(TOKENS.BRETT, pools);

            // Then remove it
            await expect(oracle.removeToken(TOKENS.BRETT))
                .to.emit(oracle, 'TokenRemoved')
                .withArgs(TOKENS.BRETT);

            // Verify it's removed
            const config = await oracle.getFullTokenConfig(TOKENS.BRETT);
            expect(config.isConfigured).to.be.false;
        });
    });

    describe("Price Calculations", function() {
        beforeEach(async function() {
            for (const [token, poolsConfig] of Object.entries(POOLS)) {
                const pools = poolsConfig.map(pool => ({
                    poolAddress: pool.address,
                    isCL: pool.isCL,
                    tickSpacing: pool.isCL ? pool.tickSpacing : 0,
                    shortTwap: 30,
                    midTwap: 3600,
                    longTwap: 86400,
                    midDeviation: ethers.utils.parseUnits("0.02", 18),
                    longDeviation: ethers.utils.parseUnits("0.05", 18),
                    minLiquidity: ethers.utils.parseUnits("1000", 18),
                    baseAsset: pool.baseAsset
                }));
                await oracle.configureToken(TOKENS[token], pools);
            }
        });

        it("Should calculate BRETT/USD price with multiple base assets", async function() {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("3041", 18);
            const aeroPrice = ethers.utils.parseUnits("0.8985", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                amount: amount,
                useMidTwap: false,
                useLongTwap: false,
                baseAssets: [TOKENS.WETH, TOKENS.AERO],
                baseAssetPrices: [wethPrice, aeroPrice]
            };

            const price = await oracle.getDollarValue(priceParams);
            expect(price).to.be.gt(0);
            console.log(`Price of BRETT: ${ethers.utils.formatUnits(price, 18)}`);
        });

        it("Should calculate AIXBT/USD price with ETH base asset", async function() {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("3041", 18);

            const priceParams = {
                asset: TOKENS.AIXBT,
                amount: amount,
                useMidTwap: false,
                useLongTwap: false,
                baseAssets: [TOKENS.WETH],
                baseAssetPrices: [wethPrice]
            };

            const price = await oracle.getDollarValue(priceParams);
            expect(price).to.be.gt(0);
            console.log(`Price of AIXBT: ${ethers.utils.formatUnits(price, 18)}`);
        });

        it("Should fail when trying to get price for unconfigured token", async function() {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("3041", 18);

            const priceParams = {
                asset: ethers.constants.AddressZero,
                amount: amount,
                useMidTwap: false,
                useLongTwap: false,
                baseAssets: [TOKENS.WETH],
                baseAssetPrices: [wethPrice]
            };

            await expect(
                oracle.getDollarValue(priceParams)
            ).to.be.revertedWith("Token not configured");
        });

        it("Should fail when base asset prices array length doesn't match base assets array", async function() {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("3041", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                amount: amount,
                useMidTwap: false,
                useLongTwap: false,
                baseAssets: [TOKENS.WETH, TOKENS.AERO],
                baseAssetPrices: [wethPrice] // Missing AERO price
            };

            await expect(
                oracle.getDollarValue(priceParams)
            ).to.be.revertedWith("Length mismatch");
        });

        it("Should fail when required base asset price is missing", async function() {
            const amount = ethers.utils.parseUnits("1", 18);
            const aeroPrice = ethers.utils.parseUnits("0.8985", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                amount: amount,
                useMidTwap: false,
                useLongTwap: false,
                baseAssets: [TOKENS.AERO], // Missing WETH
                baseAssetPrices: [aeroPrice]
            };

            await expect(
                oracle.getDollarValue(priceParams)
            ).to.be.revertedWith("Missing base asset price");
        });
    });
});