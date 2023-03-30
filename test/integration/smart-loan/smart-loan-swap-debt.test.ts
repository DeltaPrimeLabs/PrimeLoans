import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { parseUnits } from "ethers/lib/utils";

import SmartLoansFactoryArtifact from "../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json";
import MockTokenManagerArtifact from "../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import CACHE_LAYER_URLS from "../../../common/redstone-cache-layer-urls.json";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    deployAndInitExchangeContract,
    deployAllFacets,
    deployPools,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
    yakRouterAbi,
} from "../../_helpers";
import { syncTime } from "../../_syncTime";
import {
    TraderJoeIntermediary,
    PangolinIntermediary,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import { deployDiamond } from "../../../tools/diamond/deploy-diamond";
import { getProvider } from "../../../tools/liquidation/utlis";
import { Contract, BigNumber } from "ethers";

chai.use(solidity);

const { deployContract } = waffle;
const traderJoeRouterAddress = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";
const pangolinRouterAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";
const yakRouterAddress = "0xC4729E56b831d74bBc18797e0e17A295fA77488c";

const args = require("yargs").argv;
const network = args.network ? args.network : "localhost";
let provider = getProvider(network);

const yakRouter = new ethers.Contract(yakRouterAddress, yakRouterAbi, provider);

async function query(tknFrom: string, tknTo: string, amountIn: BigNumber) {
    const maxHops = 2;
    const gasPrice = await provider.getGasPrice();
    return await yakRouter.findBestPathWithGas(
        amountIn,
        tknFrom,
        tknTo,
        maxHops,
        gasPrice.mul(15).div(10),
        { gasLimit: 1e9 }
    );
}

describe("Smart loan", () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe("Swap debt", () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: TraderJoeIntermediary,
            exchangePNG: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            borrower: SignerWithAddress,
            depositor: SignerWithAddress,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before(
            "deploy factory, wrapped native token pool and USD pool",
            async () => {
                [owner, depositor, borrower] = await getFixedGasSigners(10000000);

                let assetsList = ["AVAX", "USDC"];
                let poolNameAirdropList: Array<PoolInitializationObject> = [
                    { name: "AVAX", airdropList: [borrower, depositor, owner] },
                    { name: "USDC", airdropList: [] },
                ];

                smartLoansFactory = (await deployContract(
                    owner,
                    SmartLoansFactoryArtifact
                )) as SmartLoansFactory;

                await deployPools(
                    smartLoansFactory,
                    poolNameAirdropList,
                    tokenContracts,
                    poolContracts,
                    lendingPools,
                    owner,
                    depositor
                );
                tokensPrices = await getTokensPricesMap(
                    assetsList,
                    getRedstonePrices,
                    []
                );
                supportedAssets = convertAssetsListToSupportedAssets(assetsList);
                addMissingTokenContracts(tokenContracts, assetsList);

                let diamondAddress = await deployDiamond();

                let tokenManager = (await deployContract(
                    owner,
                    MockTokenManagerArtifact,
                    []
                )) as MockTokenManager;

                await tokenManager
                    .connect(owner)
                    .initialize(supportedAssets, lendingPools);
                await tokenManager
                    .connect(owner)
                    .setFactoryAddress(smartLoansFactory.address);

                await recompileConstantsFile(
                    "local",
                    "DeploymentConstants",
                    [],
                    tokenManager.address,
                    diamondAddress,
                    smartLoansFactory.address,
                    "lib"
                );

                exchange = (await deployAndInitExchangeContract(
                    owner,
                    traderJoeRouterAddress,
                    tokenManager.address,
                    supportedAssets,
                    "TraderJoeIntermediary"
                )) as TraderJoeIntermediary;
                exchangePNG = (await deployAndInitExchangeContract(
                    owner,
                    pangolinRouterAddress,
                    tokenManager.address,
                    supportedAssets,
                    "PangolinIntermediary"
                )) as PangolinIntermediary;

                await smartLoansFactory.initialize(diamondAddress);

                await recompileConstantsFile(
                    "local",
                    "DeploymentConstants",
                    [
                        {
                            facetPath: "./contracts/facets/avalanche/TraderJoeDEXFacet.sol",
                            contractAddress: exchange.address,
                        },
                        {
                            facetPath: "./contracts/facets/avalanche/PangolinDEXFacet.sol",
                            contractAddress: exchangePNG.address,
                        },
                    ],
                    tokenManager.address,
                    diamondAddress,
                    smartLoansFactory.address,
                    "lib"
                );
                await deployAllFacets(diamondAddress, false);
            }
        );

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(
                borrower.address
            );
            loan = await ethers.getContractAt(
                "SmartLoanGigaChadInterface",
                loan_proxy_address,
                borrower
            );

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC"],
                    // @ts-ignore
                    disablePayloadsDryRun: true,
                },
                CACHE_LAYER_URLS.urls
            );
        });

        it("should fund and borrow", async () => {
            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .deposit({ value: toWei("100") });
            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            const usdcDeposited = parseUnits("600", BigNumber.from("6"));
            const amountSwapped = toWei("50");
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .deposit({ value: amountSwapped });
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .approve(exchange.address, amountSwapped);
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .transfer(exchange.address, amountSwapped);

            await exchange
                .connect(depositor)
                .swap(
                    TOKEN_ADDRESSES["AVAX"],
                    TOKEN_ADDRESSES["USDC"],
                    amountSwapped,
                    usdcDeposited
                );
            const usdcPool = poolContracts.get("USDC");
            await tokenContracts
                .get("USDC")!
                .connect(depositor)
                .approve(usdcPool?.address, usdcDeposited);
            await usdcPool!.connect(depositor).deposit(usdcDeposited);

            const borrowAmount = parseUnits("400", BigNumber.from("6"));
            await wrappedLoan.borrow(toBytes32("USDC"), borrowAmount);

            expect(await usdcPool?.getBorrowed(wrappedLoan.address)).to.be.eq(
                borrowAmount
            );
            expect(await poolContracts.get("AVAX")?.getBorrowed(wrappedLoan.address)).to.be.eq(
                0
            );
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(400, 0.2);
        });

        it("should fail to swap debt as a non-owner", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingDataService(
                    {
                        dataServiceId: "redstone-avalanche-prod",
                        uniqueSignersCount: 3,
                        dataFeeds: ["AVAX", "ETH", "USDC", "BTC"],
                        // @ts-ignore
                        disablePayloadsDryRun: true,
                    },
                    CACHE_LAYER_URLS.urls
                );
            await expect(
                nonOwnerWrappedLoan.swapDebt(
                    toBytes32("USDC"),
                    toBytes32("AVAX"),
                    parseUnits("400", BigNumber.from("6")),
                    0,
                    [],
                    []
                )
            ).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should swap debt", async () => {
            let AVAX_PRICE = tokensPrices.get("AVAX")!;
            let repayAmount = parseUnits("400.1", BigNumber.from("6"));
            let borrowAmount = toWei(((400 *1.01) / AVAX_PRICE).toFixed(18));
            const queryRes = await query(
                TOKEN_ADDRESSES["AVAX"],
                TOKEN_ADDRESSES["USDC"],
                borrowAmount
            );
            await wrappedLoan.swapDebt(
                toBytes32("USDC"),
                toBytes32("AVAX"),
                repayAmount,
                borrowAmount,
                queryRes.path,
                queryRes.adapters
            );

            expect(await poolContracts.get("USDC")?.getBorrowed(wrappedLoan.address)).to.be.eq(
                0
            );
            expect(await poolContracts.get("AVAX")?.getBorrowed(wrappedLoan.address)).to.be.closeTo(
                borrowAmount, borrowAmount.div(100)
            );
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(400 * 1.01, 0.5);
        });
    });
});
