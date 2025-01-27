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
        SKI: '0x768BE13e1680b5ebE0024C42c896E3dB59ec0149',
        DRV: '0x9d0e8f5b25384c7310cb8c6ae32c8fbeb645d083'
    };

    const POOLS = {
        BRETT: [
            {
                address: '0x43BBb129b56A998732767725A183b7a566843dBA',
                isCL: false,
                pair: 'AERO'
            },
            {
                address: '0x4e829F8A5213c42535AB84AA40BD4aDCCE9cBa02',
                isCL: true,
                pair: 'WETH',
                tickSpacing: 200
            }
        ],
        AIXBT: [
            {
                address: '0xF3E7E359b75a7223BA9D71065C57DDd4F5D8747e',
                isCL: false,
                pair: 'WETH'
            },
            {
                address: '0x22A52bB644f855ebD5ca2edB643FF70222D70C31',
                isCL: true,
                pair: 'WETH',
                tickSpacing: 200
            }
        ]
    };

    let oracle: BaseOracle;
    let owner: Signer;
    let addr1: Signer;

    beforeEach(async function() {
        [owner, addr1] = await ethers.getSigners();

        console.log("Deploying BaseOracle...");
        oracle = (await deployContract(owner, BaseOracleArtifact)) as BaseOracle;
    });

    // describe("Token Configuration", function() {
    //     it("Should allow admin to configure BRETT token", async function() {
    //         const pools = POOLS.BRETT.map(pool => ({
    //             poolAddress: pool.address,
    //             isCL: pool.isCL,
    //             tickSpacing: pool.isCL ? pool.tickSpacing : 0,
    //             shortTwap: 30,
    //             midTwap: 3600,
    //             longTwap: 86400,
    //             midDeviation: ethers.utils.parseUnits("0.02", 18),
    //             longDeviation: ethers.utils.parseUnits("0.05", 18),
    //             minLiquidity: ethers.utils.parseUnits("1000", 18)
    //         }));
    //
    //         await oracle.configureToken(TOKENS.BRETT, pools);
    //
    //         const tokenConfig = await oracle.getFullTokenConfig(TOKENS.BRETT);
    //         expect(tokenConfig.isConfigured).to.be.true;
    //         expect(tokenConfig.pools.length).to.equal(2);
    //         expect(tokenConfig.pools[0].poolAddress).to.equal(POOLS.BRETT[0].address);
    //         expect(tokenConfig.pools[1].poolAddress).to.equal(POOLS.BRETT[1].address);
    //     });
    //
    //     it("Should reject non-admin configuration attempts", async function() {
    //         const pools = POOLS.BRETT.map(pool => ({
    //             poolAddress: pool.address,
    //             isCL: pool.isCL,
    //             tickSpacing: pool.isCL ? pool.tickSpacing : 0,
    //             shortTwap: 30,
    //             midTwap: 3600,
    //             longTwap: 86400,
    //             midDeviation: ethers.utils.parseUnits("0.02", 18),
    //             longDeviation: ethers.utils.parseUnits("0.05", 18),
    //             minLiquidity: ethers.utils.parseUnits("1000", 18)
    //         }));
    //
    //         await expect(
    //             oracle.connect(addr1).configureToken(TOKENS.BRETT, pools)
    //         ).to.be.revertedWith("Only admin");
    //     });
    // });

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
                    minLiquidity: ethers.utils.parseUnits("1000", 18)
                }));
                await oracle.configureToken(TOKENS[token], pools);
            }
            const tokenConfig = await oracle.getFullTokenConfig(TOKENS.BRETT);
            expect(tokenConfig.isConfigured).to.be.true;
            expect(tokenConfig.pools.length).to.equal(2);
            expect(tokenConfig.pools[0].poolAddress).to.equal(POOLS.BRETT[0].address);
            expect(tokenConfig.pools[1].poolAddress).to.equal(POOLS.BRETT[1].address);
            console.log('Token configured');
        });

        it("Should calculate BRETT/USD price", async function() {
            const amount = ethers.utils.parseUnits("1", 18);
            const baseAssetPrice = ethers.utils.parseUnits("3041", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                baseAsset: TOKENS.WETH,
                baseAssetPrice: baseAssetPrice,
                amount: amount,
                useMidTwap: false,
                useLongTwap: false
            };

            const price = await oracle.getDollarValue(priceParams);
            expect(price).to.be.gt(0);
            console.log(`Price of BRETT: ${price}`);
        });

        // it("Should calculate AIXBT/USD price with mid TWAP check", async function() {
        //     const amount = ethers.utils.parseUnits("1", 18);
        //     const baseAssetPrice = ethers.utils.parseUnits("3041", 18);
        //
        //     const priceParams = {
        //         asset: TOKENS.AIXBT,
        //         baseAsset: TOKENS.WETH,
        //         baseAssetPrice: baseAssetPrice,
        //         amount: amount,
        //         useMidTwap: true,
        //         useLongTwap: false
        //     };
        //
        //     const price = await oracle.getDollarValue(priceParams);
        //     expect(price).to.be.gt(0);
        //     console.log(`Price of AIXBT: ${price}`);
        // });
        //
        // it("Should revert on high mid TWAP deviation", async function() {
        //     const amount = ethers.utils.parseUnits("1", 18);
        //     const baseAssetPrice = ethers.utils.parseUnits("3328.13", 18);
        //
        //     const priceParams = {
        //         asset: TOKENS.AIXBT,
        //         baseAsset: TOKENS.WETH,
        //         baseAssetPrice: baseAssetPrice,
        //         amount: amount,
        //         useMidTwap: true,
        //         useLongTwap: false
        //     };
        //
        //     await expect(
        //         oracle.getDollarValue(priceParams)
        //     ).to.be.revertedWith("Mid TWAP deviation too high");
        // });
    });

    // describe("Admin Functions", function() {
    //     it("Should allow admin to remove token", async function() {
    //         const pools = POOLS.BRETT.map(pool => ({
    //             poolAddress: pool.address,
    //             isCL: pool.isCL,
    //             tickSpacing: pool.isCL ? pool.tickSpacing : 0,
    //             shortTwap: 30,
    //             midTwap: 3600,
    //             longTwap: 86400,
    //             midDeviation: ethers.utils.parseUnits("0.02", 18),
    //             longDeviation: ethers.utils.parseUnits("0.05", 18),
    //             minLiquidity: ethers.utils.parseUnits("1000", 18)
    //         }));
    //
    //         await oracle.configureToken(TOKENS.BRETT, pools);
    //         await oracle.removeToken(TOKENS.BRETT);
    //
    //         const config = await oracle.getFullTokenConfig(TOKENS.BRETT);
    //         expect(config.isConfigured).to.be.false;
    //     });
    //
    //     it("Should allow admin transfer", async function() {
    //         const newAdmin = await addr1.getAddress();
    //         await oracle.setAdmin(newAdmin);
    //         expect(await oracle.admin()).to.equal(newAdmin);
    //     });
    // });
});