import chai, { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Contract, Signer } from "ethers";
import { BaseOracle, TransparentUpgradeableProxy } from "../../typechain";
import { solidity } from "ethereum-waffle";
const { deployContract } = waffle;

chai.use(solidity);

describe("BaseOracle", function () {
    const TOKENS = {
        WETH: "0x4200000000000000000000000000000000000006",
        AERO: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        BRETT: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
        AIXBT: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    enum Protocol {
        UNISWAP,
        AERODROME
    }

    const POOLS = {
        BRETT: [
            {
                address: "0x43BBb129b56A998732767725A183b7a566843dBA",
                isCL: false,
                pair: "AERO",
                baseAsset: TOKENS.AERO,
                protocol: Protocol.AERODROME
            },
            {
                address: "0x4e829F8A5213c42535AB84AA40BD4aDCCE9cBa02",
                isCL: true,
                pair: "WETH",
                tickSpacing: 200,
                baseAsset: TOKENS.WETH,
                protocol: Protocol.AERODROME
            },
            {
                address: "0xBA3F945812a83471d709BCe9C3CA699A19FB46f7",
                isCL: true,
                pair: "WETH",
                tickSpacing: 200,
                baseAsset: TOKENS.WETH,
                protocol: Protocol.UNISWAP
            },
            {
                address: "0x76Bf0abD20f1e0155Ce40A62615a90A709a6C3D8",
                isCL: true,
                pair: "WETH",
                tickSpacing: 60,
                baseAsset: TOKENS.WETH,
                protocol: Protocol.UNISWAP
            }
        ],
        AIXBT: [
            {
                address: "0xF3E7E359b75a7223BA9D71065C57DDd4F5D8747e",
                isCL: false,
                pair: "WETH",
                baseAsset: TOKENS.WETH,
                protocol: Protocol.AERODROME
            },
            {
                address: "0x22A52bB644f855ebD5ca2edB643FF70222D70C31",
                isCL: true,
                pair: "WETH",
                tickSpacing: 200,
                baseAsset: TOKENS.WETH,
                protocol: Protocol.AERODROME
            },
            {
                address: "0xf1Fdc83c3A336bdbDC9fB06e318B08EadDC82FF4",
                isCL: true,
                pair: "USDC",
                tickSpacing: 60,
                baseAsset: TOKENS.USDC,
                protocol: Protocol.UNISWAP
            }
        ]
    };

    let oracleTUP: BaseOracle;
    let oracleImplementation: Contract;
    let proxyAdmin: Signer;
    let owner: Signer;
    let addr1: Signer;

    beforeEach(async function () {
        [proxyAdmin, owner, addr1] = await ethers.getSigners();

        // Deploy implementation.
        const BaseOracleFactory = await ethers.getContractFactory("BaseOracle");
        oracleImplementation = await BaseOracleFactory.deploy();

        // Prepare initialization data with explicit owner.
        const initializeData = oracleImplementation.interface.encodeFunctionData(
            "initialize",
            [await owner.getAddress()]
        );

        // Deploy proxy.
        const TransparentUpgradeableProxyFactory = await ethers.getContractFactory(
            "TransparentUpgradeableProxy"
        );
        const proxy = await TransparentUpgradeableProxyFactory.deploy(
            oracleImplementation.address,
            await proxyAdmin.getAddress(),
            initializeData
        );

        // Attach the implementation's interface to the proxy address.
        oracleTUP = BaseOracleFactory.attach(proxy.address) as BaseOracle;
    });

    describe("Owner Functions", function () {
        it("Should set owner correctly on deployment", async function () {
            expect(await oracleTUP.connect(addr1).owner()).to.equal(
                await owner.getAddress()
            );
        });

        it("Should allow owner to transfer ownership", async function () {
            await oracleTUP.connect(owner).transferOwnership(await addr1.getAddress());
            expect(await oracleTUP.connect(addr1).owner()).to.equal(
                await addr1.getAddress()
            );
        });

        it("Should not allow non-owner to transfer ownership", async function () {
            await expect(
                oracleTUP.connect(addr1).transferOwnership(await addr1.getAddress())
            ).to.be.reverted;
        });

        it("Should not allow configuring token with empty pools", async function () {
            await expect(
                oracleTUP.configureToken(TOKENS.BRETT, [])
            ).to.be.reverted;
        });

        it("Should not allow configuring pools with invalid base asset", async function () {
            const invalidPools = [
                {
                    poolAddress: POOLS.BRETT[0].address,
                    isCL: false,
                    tickSpacing: 0,
                    shortTwap: 30,
                    twapChecks: [],
                    baseAsset: ethers.constants.AddressZero,
                },
            ];
            await expect(
                oracleTUP.configureToken(TOKENS.BRETT, invalidPools)
            ).to.be.reverted;
        });
    });

    describe("Token Configuration", function () {
        it("Should emit TokenConfigured event when configuring token", async function () {
            const pools = POOLS.BRETT.map((pool) => ({
                poolAddress: pool.address,
                isCL: pool.isCL,
                tickSpacing: pool.isCL ? pool.tickSpacing : 0,
                shortTwap: 30,
                // For CL pools, we include two TWAP checks.
                twapChecks: pool.isCL
                    ? [
                        {
                            duration: 3600,
                            maxDeviation: ethers.utils.parseUnits("0.02", 18),
                        },
                        {
                            duration: 86400,
                            maxDeviation: ethers.utils.parseUnits("0.05", 18),
                        },
                    ]
                    : [],
                baseAsset: pool.baseAsset,
            }));

            await expect(oracleTUP.connect(owner).configureToken(TOKENS.BRETT, pools))
                .to.emit(oracleTUP, "TokenConfigured")
                .withArgs(TOKENS.BRETT);
        });

        it("Should allow removing token configuration", async function () {
            const pools = POOLS.BRETT.map((pool) => ({
                poolAddress: pool.address,
                isCL: pool.isCL,
                tickSpacing: pool.isCL ? pool.tickSpacing : 0,
                shortTwap: 30,
                twapChecks: pool.isCL
                    ? [
                        {
                            duration: 3600,
                            maxDeviation: ethers.utils.parseUnits("0.02", 18),
                        },
                        {
                            duration: 86400,
                            maxDeviation: ethers.utils.parseUnits("0.05", 18),
                        },
                    ]
                    : [],
                baseAsset: pool.baseAsset,
            }));
            await oracleTUP.connect(owner).configureToken(TOKENS.BRETT, pools);

            await expect(oracleTUP.connect(owner).removeToken(TOKENS.BRETT))
                .to.emit(oracleTUP, "TokenRemoved")
                .withArgs(TOKENS.BRETT);

            const config = await oracleTUP.connect(owner).getFullTokenConfig(TOKENS.BRETT);
            expect(config.isConfigured).to.be.false;
        });
    });

    describe("Price Calculations", function () {
        beforeEach(async function () {
            // Configure tokens with new pool config.
            for (const [token, poolsConfig] of Object.entries(POOLS)) {
                const pools = poolsConfig.map((pool) => ({
                    poolAddress: pool.address,
                    isCL: pool.isCL,
                    tickSpacing: pool.isCL ? pool.tickSpacing : 0,
                    shortTwap: 60,
                    twapChecks: pool.isCL
                        ? [
                            {
                                duration: 3600,
                                maxDeviation: ethers.utils.parseUnits("0.02", 18),
                            },
                            {
                                duration: 86400,
                                maxDeviation: ethers.utils.parseUnits("0.05", 18),
                            },
                        ]
                        : [],
                    baseAsset: pool.baseAsset,
                    protocol: pool.protocol
                }));
                await oracleTUP.connect(owner).configureToken(TOKENS[token], pools);
            }
        });

        it("Should calculate BRETT/USD price with multiple base assets", async function () {
            const amount = ethers.utils.parseUnits("7", 18);
            const wethPrice = ethers.utils.parseUnits("2660", 18);
            const aeroPrice = ethers.utils.parseUnits("0.8195", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                amount: amount,
                useTwapChecks: false, // disable deviation checks
                baseAssets: [TOKENS.WETH, TOKENS.AERO],
                baseAssetPrices: [wethPrice, aeroPrice],
            };

            const price = await oracleTUP.connect(addr1).getTokenDollarPrice(priceParams);
            expect(price).to.be.gt(0);
            console.log(`Price of BRETT: ${ethers.utils.formatUnits(price, 18)}`);
        });

        it("Should calculate AIXBT/USD price with ETH base asset", async function () {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("2800", 18);
            const usdcPrice = ethers.utils.parseUnits("1", 18);

            const priceParams = {
                asset: TOKENS.AIXBT,
                amount: amount,
                useTwapChecks: false,
                baseAssets: [TOKENS.WETH, TOKENS.USDC],
                baseAssetPrices: [wethPrice, usdcPrice],
            };

            const price = await oracleTUP.connect(addr1).getTokenDollarPrice(priceParams);
            expect(price).to.be.gt(0);
            console.log(`Price of AIXBT: ${ethers.utils.formatUnits(price, 18)}`);
        });

        it("Should fail when trying to get price for unconfigured token", async function () {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("2800", 18);

            const priceParams = {
                asset: ethers.constants.AddressZero,
                amount: amount,
                useTwapChecks: false,
                baseAssets: [TOKENS.WETH],
                baseAssetPrices: [wethPrice],
            };

            await expect(oracleTUP.connect(addr1).getTokenDollarPrice(priceParams)).to.be
                .reverted;
        });

        it("Should fail when base asset prices array length doesn't match base assets array", async function () {
            const amount = ethers.utils.parseUnits("1", 18);
            const wethPrice = ethers.utils.parseUnits("2800", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                amount: amount,
                useTwapChecks: false,
                baseAssets: [TOKENS.WETH, TOKENS.AERO],
                baseAssetPrices: [wethPrice], // Missing AERO price.
            };

            await expect(oracleTUP.connect(addr1).getTokenDollarPrice(priceParams)).to.be
                .reverted;
        });

        it("Should fail when required base asset price is missing", async function () {
            const amount = ethers.utils.parseUnits("1", 18);
            const aeroPrice = ethers.utils.parseUnits("0.9268", 18);

            const priceParams = {
                asset: TOKENS.BRETT,
                amount: amount,
                useTwapChecks: false,
                baseAssets: [TOKENS.AERO], // Missing WETH.
                baseAssetPrices: [aeroPrice],
            };

            await expect(oracleTUP.connect(addr1).getTokenDollarPrice(priceParams)).to.be
                .reverted;
        });
    });
});