import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset, convertAssetsListToSupportedAssets, convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployAndInitializeLendingPool, erc20ABI,
    formatUnits,
    fromBytes32, fromWei,
    getFixedGasSigners,
    getLiquidationAmounts, getLiquidationAmountsBasedOnLtv, getRedstonePrices, getTokensPricesMap,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei, ZERO,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    TraderJoeIntermediary,
    Pool,
    SmartLoansFactory,
    MockTokenManager,
    AddressProvider,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import CACHE_LAYER_URLS from '../../../common/redstone-cache-layer-urls.json';

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

const DEFAULT_MAX_LEVERAGE = {
    AVAX: 0.8333333,
    USDC: 0.8333333,
    USDT: 0.8333333,
    PNG: 0,
    QI: 0,
    sAVAX: 0.8333333,
    ETH: 0.8333333,
    BTC: 0.8333333,
    YY_AAVE_AVAX: 0.8333333
}

const TEST_TABLE = [
    {
        id: 1,
        fundInUsd: {
            AVAX: 100,
            USDC: 0,
            ETH: 0,
            BTC: 0
        },
        borrowInUsd: {
            AVAX: 550,
            USDC: 0,
            ETH: 0
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 2,
        fundInUsd: {
            AVAX: 100,
            USDC: 0,
            ETH: 0,
            BTC: 0
        },
        borrowInUsd: {
            AVAX: 500,
            USDC: 0,
            ETH: 0
        },
        swaps: [
            {from: 'AVAX', to: 'USDC', all: true, amountInUsd: null}
        ],
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 3,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 75,
            BTC: 0
        },
        borrowInUsd: {
            AVAX: 0,
            USDC: 200,
            ETH: 200
        },
        swaps: [
            {from: 'USDC', to: 'BTC', amountInUsd: null, all: true},
            {from: 'ETH', to: 'sAVAX', amountInUsd: null, all: true}
        ],
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 4,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 80,
            BTC: 0
        },
        borrowInUsd: {
            AVAX: 0,
            USDC: 300,
            ETH: 280
        },
        swaps: [
            {from: 'USDC', to: 'AVAX', amountInUsd: 200, all: false},
            {from: 'USDC', to: 'BTC', amountInUsd: 90, all: false},
            {from: 'ETH', to: 'sAVAX', amountInUsd: 200, all: false},
            {from: 'ETH', to: 'AVAX', amountInUsd: 90, all: false}
        ],
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 5,
        fundInUsd: {
            AVAX: 100,
            USDC: 0,
            ETH: 0,
            BTC: 0
        },
        borrowInUsd: {
            AVAX: 550,
            USDC: 0,
            ETH: 0
        },
        stakeInUsd: {
            YAK: 640
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 6,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            sAVAX: 50
        },
        borrowInUsd: {
            AVAX: 0,
            USDC: 350,
            ETH: 350
        },
        swaps: [
            {from: 'USDC', to: 'AVAX', all: true, amountInUsd: null},
            {from: 'ETH', to: 'AVAX', all: true, amountInUsd: null},
        ],
        stakeInUsd: {
            YAK: 690
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 7,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            sAVAX: 0
        },
        borrowInUsd: {
            USDC: 300,
            AVAX: 0,
            ETH: 0
        },
        withdrawInUsd: {
            USDC: 50
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        //Solidity uint256 max
        targetHealthRatio: 1.157920892373162e+59,
        ratioPrecision: 0,
        action: 'HEAL'
    },
    {
        id: 8,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 20,
            sAVAX: 20
        },
        borrowInUsd: {
            USDC: 200,
            AVAX: 200,
            ETH: 200
        },
        withdrawInUsd: {
            USDC: 50,
            AVAX: 50,
            ETH: 50
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        //Solidity uint256 max
        targetHealthRatio: 1.157920892373162e+59,
        ratioPrecision: 0,
        action: 'HEAL'
    },
    {
        id: 9,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0
        },
        borrowInUsd: {
            USDC: 300,
            AVAX: 0,
            ETH: 0
        },
        withdrawInUsd: {
            USDC: 50
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        //Solidity uint256 max
        targetHealthRatio: 1.157920892373162e+59,
        ratioPrecision: 0,
        action: 'CLOSE'
    },
    {
        id: 10,
        fundInUsd: {
            AVAX: 5,
            USDC: 5,
            ETH: 5,
            BTC: 5,
            USDT: 5,
            sAVAX: 5
        },
        borrowInUsd: {
            AVAX: 350,
            USDC: 0,
            ETH: 0
        },
        debtCoverage: DEFAULT_MAX_LEVERAGE,
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
]

describe('Smart loan - real prices', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('An insolvent loan', () => {
        let exchange: TraderJoeIntermediary,
            loan: Contract,
            wrappedLoan: any,
            owner: SignerWithAddress,
            borrowers: SignerWithAddress[],
            borrower: SignerWithAddress,
            borrower1: SignerWithAddress,
            borrower2: SignerWithAddress,
            borrower3: SignerWithAddress,
            borrower4: SignerWithAddress,
            borrower5: SignerWithAddress,
            borrower6: SignerWithAddress,
            borrower7: SignerWithAddress,
            borrower8: SignerWithAddress,
            borrower9: SignerWithAddress,
            borrower10: SignerWithAddress,
            depositor: SignerWithAddress,
            admin: SignerWithAddress,
            liquidator: SignerWithAddress,
            smartLoansFactory: SmartLoansFactory,
            supportedAssets: Array<Asset>,
            tokenContracts: any = {},
            poolContracts: any = {},
            tokenManager: any,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            USDC_PRICE: number,
            USDT_PRICE: number,
            SAVAX_PRICE: number,
            PNG_PRICE: number,
            QI_PRICE: number,
            ETH_PRICE: number,
            YY_AAVE_AVAX_PRICE: number,
            GLP_PRICE: number,
            BTC_PRICE: number,
            diamondAddress: any,
            tokensPrices: Map<string, number>;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor, borrower1, borrower2, borrower3, borrower4, borrower5, borrower6, borrower7, borrower8, borrower9, borrower10, admin, liquidator] = await getFixedGasSigners(10000000);

            borrowers = [borrower1, borrower2, borrower3, borrower4, borrower5, borrower6, borrower7, borrower8, borrower9, borrower10];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            let lendingPools = [];
            for (const token of [
                {'name': 'USDC', 'airdropList': [], 'autoPoolDeposit': false},
                {
                    'name': 'AVAX',
                    'airdropList': [depositor, borrower1, borrower2, borrower3, borrower4],
                    'autoPoolDeposit': true
                },
                {'name': 'ETH', 'airdropList': [], 'autoPoolDeposit': false},
            ]) {
                let {
                    poolContract,
                    tokenContract
                } = await deployAndInitializeLendingPool(owner, token.name, smartLoansFactory.address, token.airdropList);
                if (token.autoPoolDeposit) {
                    await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                    await poolContract.connect(depositor).deposit(toWei("1000"));
                }
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                poolContracts[token.name] = poolContract;
                tokenContracts[token.name] = tokenContract;
            }
            tokenContracts['GLP'] = new ethers.Contract(TOKEN_ADDRESSES['GLP'], erc20ABI, provider);
            tokenContracts['USDT'] = new ethers.Contract(TOKEN_ADDRESSES['USDT'], erc20ABI, provider);
            tokenContracts['PNG'] = new ethers.Contract(TOKEN_ADDRESSES['PNG'], erc20ABI, provider);
            tokenContracts['sAVAX'] = new ethers.Contract(TOKEN_ADDRESSES['sAVAX'], erc20ABI, provider);
            tokenContracts['QI'] = new ethers.Contract(TOKEN_ADDRESSES['QI'], erc20ABI, provider);
            tokenContracts['BTC'] = new ethers.Contract(TOKEN_ADDRESSES['BTC'], erc20ABI, provider);
            tokenContracts['YY_AAVE_AVAX'] = new ethers.Contract(TOKEN_ADDRESSES['YY_AAVE_AVAX'], erc20ABI, provider);


            let assetsList = ['AVAX', 'sAVAX', 'USDC', 'USDT', 'PNG', 'QI', 'ETH', 'BTC', 'YY_AAVE_AVAX', 'GLP']
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            AVAX_PRICE = tokensPrices.get("AVAX")!;
            SAVAX_PRICE = tokensPrices.get("sAVAX")!;
            USDC_PRICE = tokensPrices.get("USDC")!;
            USDT_PRICE = tokensPrices.get("USDT")!;
            PNG_PRICE = tokensPrices.get("PNG")!;
            QI_PRICE = tokensPrices.get("QI")!;
            ETH_PRICE = tokensPrices.get("ETH")!;
            BTC_PRICE = tokensPrices.get("BTC")!;
            YY_AAVE_AVAX_PRICE = tokensPrices.get("YY_AAVE_AVAX")!;
            GLP_PRICE = tokensPrices.get("GLP")!;

            //TODO: why do we mock prices? maybe we can use wrapLite?
            MOCK_PRICES = [
                {
                    dataFeedId: 'AVAX',
                    value: AVAX_PRICE
                },
                {
                    dataFeedId: 'sAVAX',
                    value: SAVAX_PRICE
                },
                {
                    dataFeedId: 'USDC',
                    value: USDC_PRICE
                },
                {
                    dataFeedId: 'USDT',
                    value: USDT_PRICE
                },
                {
                    dataFeedId: 'PNG',
                    value: PNG_PRICE
                },
                {
                    dataFeedId: 'QI',
                    value: QI_PRICE
                },
                {
                    dataFeedId: 'ETH',
                    value: ETH_PRICE
                },
                {
                    dataFeedId: 'BTC',
                    value: BTC_PRICE
                },
                {
                    dataFeedId: 'YY_AAVE_AVAX',
                    value: YY_AAVE_AVAX_PRICE
                },
                {
                    dataFeedId: 'GLP',
                    value: GLP_PRICE
                }
            ];

            //deposit other tokens
            await depositToPool("USDC", tokenContracts['USDC'], poolContracts.USDC, 1000, USDC_PRICE);
            await depositToPool("ETH", tokenContracts['ETH'], poolContracts.ETH, 1, ETH_PRICE);
            await topupUser(liquidator);
            for (let user of borrowers) {
                await topupUser(user);
            }

            async function depositToPool(symbol: string, tokenContract: Contract, pool: Pool, amount: number, price: number) {
                const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
                let requiredAvax = toWei((amount * price * 1.5 / AVAX_PRICE).toString());

                await tokenContracts['AVAX'].connect(depositor).deposit({value: requiredAvax});
                await tokenContracts['AVAX'].connect(depositor).transfer(exchange.address, requiredAvax);
                await exchange.connect(depositor).swap(tokenContracts['AVAX'].address, tokenContracts[symbol].address, requiredAvax, initialTokenDepositWei);

                await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
                await pool.connect(depositor).deposit(initialTokenDepositWei);
            }

            async function topupUser(user: SignerWithAddress) {
                await tokenContracts['AVAX'].connect(user).deposit({value: toWei((20 * 1000 / AVAX_PRICE).toString())});

                const amountSwapped = toWei((2000 / AVAX_PRICE).toString());
                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['USDC'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['USDT'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['ETH'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['BTC'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['PNG'].address, amountSwapped, 0);


                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['QI'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['sAVAX'].address, amountSwapped, 0);
            }
        });

        before("prepare smart loan facets", async () => {
            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            // this facet is used to override max data timestamp delay
            // await replaceFacet('MockSolvencyFacet', diamondAddress, ['isSolvent', 'getDebt', 'getTotalValue', 'getTotalAssetsValue', 'getHealthRatio', 'getPrices']);
            await diamondCut.unpause();
        });

        beforeEach("create a loan", async () => {
            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent', 'canRepayDebtFully']);
            await replaceFacet('SmartLoanLiquidationFacetDebug', diamondAddress, ['liquidateLoan']);
            await diamondCut.unpause();
        });


        TEST_TABLE.forEach(
            async testCase => {
                if (testCase.id) {
                    it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fundInUsd.AVAX}, USDC: ${testCase.fundInUsd.USDC}, ETH: ${testCase.fundInUsd.ETH}, BTC: ${testCase.fundInUsd.BTC}, sAVAX: ${testCase.fundInUsd.sAVAX}\n
        borrow AVAX: ${testCase.borrowInUsd.AVAX}, USDC: ${testCase.borrowInUsd.USDC}, ETH: ${testCase.borrowInUsd.ETH}`,
                        async () => {

                            borrower = borrowers[testCase.id - 1];

                            await smartLoansFactory.connect(borrower).createLoan();

                            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

                            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

                            // @ts-ignore
                            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                                {
                                    dataServiceId: "redstone-avalanche-prod",
                                    uniqueSignersCount: 3,
                                    dataFeeds: ["AVAX", "ETH", "USDC", "USDT", "BTC", "PNG", "QI", "sAVAX", "YY_AAVE_AVAX", "GLP"],
                                    // @ts-ignore
                                    disablePayloadsDryRun: true
                                },
                                 CACHE_LAYER_URLS.urls
                            );

                            for (let [symbol, leverage] of Object.entries(testCase.debtCoverage)) {
                                await tokenManager.connect(owner).setDebtCoverage(getTokenContract(symbol)!.address, toWei(leverage.toString()))
                            }

                            //fund
                            for (const [symbol, value] of Object.entries(testCase.fundInUsd)) {
                                if (value > 0) {
                                    let contract = getTokenContract(symbol)!;
                                    let tokenDecimals = await contract.decimals();

                                    let requiredAvax = toWei((value * 1.3 / AVAX_PRICE).toString());
                                    await tokenContracts['AVAX'].connect(borrower).deposit({value: requiredAvax});

                                    if (symbol !== 'AVAX') {
                                        await tokenContracts['AVAX'].connect(borrower).transfer(exchange.address, requiredAvax);

                                        let amountOfToken = value / getPrice(symbol)!;
                                        await exchange.connect(borrower).swap(tokenContracts['AVAX'].address, tokenContracts[symbol].address, requiredAvax, parseUnits(amountOfToken.toFixed(tokenDecimals), tokenDecimals));
                                    }

                                    let amountOfTokens = value / getPrice(symbol)!;
                                    await contract.connect(borrower).approve(wrappedLoan.address, parseUnits(amountOfTokens.toFixed(tokenDecimals), tokenDecimals));
                                    await wrappedLoan.fund(toBytes32(symbol), parseUnits(amountOfTokens.toFixed(tokenDecimals), tokenDecimals));
                                }
                            }
                            // borrow
                            for (const [symbol, value] of Object.entries(testCase.borrowInUsd)) {
                                if (value > 0) {
                                    let contract = getTokenContract(symbol)!;
                                    let decimals = await contract.decimals();
                                    let amountOfTokens = value / getPrice(symbol)!;

                                    await wrappedLoan.borrow(toBytes32(symbol), toWei(amountOfTokens.toFixed(decimals) ?? 0, decimals));
                                }
                            }

                            if (testCase.withdrawInUsd) {
                                for (const [symbol, value] of Object.entries(testCase.withdrawInUsd)) {
                                    if (value! > 0) {
                                        let contract = getTokenContract(symbol)!;
                                        let decimals = await contract.decimals();
                                        let amountOfTokens = value! / getPrice(symbol)!;

                                        await wrappedLoan.withdraw(toBytes32(symbol), toWei(amountOfTokens.toFixed(decimals) ?? 0, decimals));
                                    }
                                }
                            }

                            if (testCase.swaps) {
                                for (const swap of testCase.swaps) {
                                    let contract = getTokenContract(swap.from)!;
                                    let tokenDecimals = await contract.decimals();
                                    let minRate = 0.2 * getPrice(swap.from)! / getPrice(swap.to)!;
                                    let fromBalance = await wrappedLoan.getBalance(toBytes32(swap.from));
                                    let minBought = minRate * formatUnits(fromBalance, await contract.decimals());
                                    let swapToDecimals = await getTokenContract(swap.to).decimals();

                                    if (swap.all) {
                                        await wrappedLoan.swapTraderJoe(toBytes32(swap.from), toBytes32(swap.to), fromBalance, parseUnits(minBought.toFixed(swapToDecimals), swapToDecimals));
                                    } else if (swap.amountInUsd) {
                                        let amountOfTokens = 0.99 * swap.amountInUsd / getPrice(swap.from)!;
                                        await wrappedLoan.swapTraderJoe(toBytes32(swap.from), toBytes32(swap.to), toWei(amountOfTokens.toFixed(tokenDecimals), tokenDecimals), 0);
                                    }
                                }
                            }

                            // Use when GLP will be transferable during the liquidation
                            // if(testCase.mintGLPInUSDC) {
                            //     const minGlpAmount = Number(testCase.mintGLPInUSDC * tokensPrices.get("USDC")! / tokensPrices.get("GLP")! * 98 / 100).toFixed();
                            //
                            //     await wrappedLoan.mintAndStakeGlp(
                            //         TOKEN_ADDRESSES['USDC'],
                            //         parseUnits(
                            //             testCase.mintGLPInUSDC.toString(),
                            //             BigNumber.from("6")
                            //         ),
                            //         0,
                            //         parseUnits(
                            //             minGlpAmount.toString(),
                            //             BigNumber.from("6")
                            //         ),
                            //     )
                            // }

                            if (testCase.stakeInUsd) {
                                if (testCase.stakeInUsd.YAK) {
                                    //YAK AVAX
                                    let amountOfTokens = testCase.stakeInUsd.YAK / getPrice("AVAX")!;
                                    await wrappedLoan.stakeAVAXYak(toWei(amountOfTokens.toString()));
                                }
                            }

                            let maxBonus = 0.05;

                            // const bonus = calculateBonus(
                            //     testCase.action,
                            //     fromWei(await wrappedLoan.getDebt()),
                            //     fromWei(await wrappedLoan.getTotalValue()),
                            //     testCase.targetLtv,
                            //     maxBonus
                            // );

                            const bonus = maxBonus;

                            const weiDebts = (await wrappedLoan.getDebts());

                            const debts: any[] = [];
                            for (let debt of weiDebts) {
                                let symbol = fromBytes32(debt.name);
                                debts.push(
                                    {
                                        name: symbol,
                                        debt: formatUnits(debt.debt, await getTokenContract(symbol)!.decimals())
                                    }
                                )
                            }

                            const balances: any[] = [];

                            const weiBalances = (await wrappedLoan.getAllAssetsBalances());

                            for (let balance of weiBalances) {
                                let symbol = fromBytes32(balance.name);
                                balances.push(
                                    {
                                        name: symbol,
                                        //@ts-ignore
                                        debtCoverage: testCase.debtCoverage[symbol],
                                        balance: formatUnits(balance.balance, await getTokenContract(symbol)!.decimals())
                                    }
                                )
                            }

                            let loanIsBankrupt = fromWei(await wrappedLoan.getTotalValue()) < fromWei(await wrappedLoan.getDebt());

                            let {repayAmounts, deliveredAmounts} = getLiquidationAmountsBasedOnLtv(
                                'LIQUIDATE',
                                debts,
                                balances,
                                MOCK_PRICES,
                                testCase.targetHealthRatio,
                                bonus,
                                loanIsBankrupt
                            );

                            const performer = testCase.action === 'CLOSE' ? borrower : liquidator;

                            let performerBalanceBefore = await liquidatingAccountBalanceInUsd(testCase, performer.address);

                            await action(wrappedLoan, testCase.action, deliveredAmounts, repayAmounts, bonus, testCase.stakeInUsd, undefined, performer);

                            let performerBalanceAfter = await liquidatingAccountBalanceInUsd(testCase, performer.address);

                            if (loanIsBankrupt) {
                                let funded = 0;

                                if (testCase.fundInUsd) {
                                    for (const [, value] of Object.entries(testCase.fundInUsd)) {
                                        funded += value;
                                    }
                                }

                                let withdrawn = 0;

                                if (testCase.withdrawInUsd) {
                                    for (const [, value] of Object.entries(testCase.withdrawInUsd)) {
                                        withdrawn += value!;
                                    }
                                }

                                let badDebt = withdrawn - funded;

                                expect(performerBalanceBefore - performerBalanceAfter).to.be.closeTo(badDebt, 0.05);
                            }

                            // if (!loanIsBankrupt) {
                            //     expect(performerBalanceAfter - performerBalanceBefore).to.be.closeTo(bonus * neededToRepay, 0.05);
                            // }

                            // @ts-ignore
                            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(testCase.targetHealthRatio, testCase.ratioPrecision ?? 0.01);
                        });
                }
            }
        );


        async function action(
            wrappedLoan: Contract,
            performedAction: string,
            allowanceAmounts: any[],
            repayAmounts: any[],
            bonus: number,
            stake: any,
            glp: any,
            performer: any
        ) {

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            //this facet is used to override max data timestamp delay
            await replaceFacet('MockSolvencyFacet', diamondAddress, ['isSolvent', 'getDebt', 'getTotalValue', 'getTotalAssetsValue', 'getHealthRatio', 'getPrices']);
            await diamondCut.unpause();

            const initialStakedYakTokensBalance = await tokenContracts['YY_AAVE_AVAX'].balanceOf(performer.address);
            const initialGLPTokensBalance = await tokenContracts['GLP'].balanceOf(performer.address);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan.connect(performer)).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "USDT", "BTC", "PNG", "QI", "sAVAX", "YY_AAVE_AVAX", "GLP"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                 CACHE_LAYER_URLS.urls
            );

            await wrappedLoan.isSolvent();
            expect(await wrappedLoan.isSolvent()).to.be.false;

            let liquidatorsList = await ethers.getContractAt('ISmartLoanLiquidationFacet', diamondAddress, owner);
            if (!(await liquidatorsList.isLiquidatorWhitelisted(performer.address))) {
                await expect(wrappedLoan.liquidateLoan([], [], 0)).to.be.revertedWith("Only whitelisted liquidators can execute this method");
                await expect(wrappedLoan.unsafeLiquidateLoan([], [], 0)).to.be.revertedWith("Only whitelisted liquidators can execute this method");

                await liquidatorsList.whitelistLiquidators([performer.address]);
                expect(await liquidatorsList.isLiquidatorWhitelisted(performer.address)).to.be.true;
            }

            let amountsToRepayInWei = [];
            let assetsToRepay = [];
            for (const repayment of repayAmounts) {
                let decimals = await tokenContracts[repayment.name].decimals();
                amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
                assetsToRepay.push(toBytes32(repayment.name));
            }

            for (const allowance of allowanceAmounts) {
                let decimals = await tokenContracts[allowance.name].decimals();
                let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
                await tokenContracts[allowance.name].connect(performer).approve(wrappedLoan.address, delivered);
            }


            const bonusInWei = (bonus * 1000).toFixed(0);

            switch (performedAction) {
                case 'LIQUIDATE':
                    await wrappedLoan.liquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
                    break;
                case 'HEAL':
                    await wrappedLoan.unsafeLiquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
                    break;
                case 'CLOSE':
                    await wrappedLoan.unsafeLiquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
                    break;
            }

            expect(await wrappedLoan.isSolvent()).to.be.true;
            if (stake) {
                expect(await tokenContracts['YY_AAVE_AVAX'].balanceOf(performer.address)).to.be.gt(initialStakedYakTokensBalance);
            }
            if(glp){
                expect(await tokenContracts['GLP'].balanceOf(performer.address)).to.be.gt(initialGLPTokensBalance);
            }
        }


        function getTokenContract(symbol: string) {
            if (symbol == "AVAX") return tokenContracts['AVAX'];
            if (symbol == "sAVAX") return tokenContracts['sAVAX'];
            if (symbol == "USDC") return tokenContracts['USDC'];
            if (symbol == "USDT") return tokenContracts['USDT'];
            if (symbol == "PNG") return tokenContracts['PNG'];
            if (symbol == "QI") return tokenContracts['QI'];
            if (symbol == "ETH") return tokenContracts['ETH'];
            if (symbol == "BTC") return tokenContracts['BTC'];
            if (symbol == "YY_AAVE_AVAX") return tokenContracts['YY_AAVE_AVAX'];
            if (symbol == "GLP") return tokenContracts['GLP'];
        }

        function getPrice(symbol: string) {
            if (symbol == "AVAX") return AVAX_PRICE;
            if (symbol == "sAVAX") return SAVAX_PRICE;
            if (symbol == "USDC") return USDC_PRICE;
            if (symbol == "USDT") return USDT_PRICE;
            if (symbol == "PNG") return PNG_PRICE;
            if (symbol == "QI") return QI_PRICE;
            if (symbol == "ETH") return ETH_PRICE;
            if (symbol == "BTC") return BTC_PRICE;
            if (symbol == "YY_AAVE_AVAX") return YY_AAVE_AVAX_PRICE;
            if (symbol == "GLP") return GLP_PRICE;
        }

        async function liquidatingAccountBalanceInUsd(testCase: any, account: string) {
            let balanceInUsd = 0;
            for (const [asset,] of Object.entries(testCase.fundInUsd)) {
                balanceInUsd += formatUnits(await tokenContracts[asset].balanceOf(account), await tokenContracts[asset].decimals()) * getPrice(asset)!;
            }

            if (testCase.stakeInUsd) {
                balanceInUsd += formatUnits(await tokenContracts['YY_AAVE_AVAX'].balanceOf(account), await tokenContracts['YY_AAVE_AVAX'].decimals()) * getPrice('YY_AAVE_AVAX')!
            }

            return balanceInUsd;
        }
    });
});