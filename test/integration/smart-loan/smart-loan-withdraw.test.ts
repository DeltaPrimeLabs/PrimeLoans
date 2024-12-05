import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset,
    PoolInitializationObject,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    fromWei,
    getFixedGasSigners,
    addMissingTokenContracts,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployDiamond} = require('../../../tools/diamond/deploy-diamond');
const {deployContract} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    // describe('A loan with withdrawal', () => {
    //     let exchange: PangolinIntermediary,
    //         loan: SmartLoanGigaChadInterface,
    //         smartLoansFactory: SmartLoansFactory,
    //         wrappedLoan: any,
    //         owner: SignerWithAddress,
    //         depositor: SignerWithAddress,
    //         MOCK_PRICES: any,
    //         poolContracts: Map<string, Contract> = new Map(),
    //         tokenContracts: Map<string, Contract> = new Map(),
    //         lendingPools: Array<PoolAsset> = [],
    //         supportedAssets: Array<Asset>,
    //         tokensPrices: Map<string, number>;
    //
    //
    //     before("deploy provider, exchange and pool", async () => {
    //         [owner, depositor] = await getFixedGasSigners(10000000);
    //         let assetsList = ['AVAX', 'USDC'];
    //         let poolNameAirdropList: Array<PoolInitializationObject> = [
    //             {name: 'AVAX', airdropList: [depositor]}
    //         ];
    //
    //         let diamondAddress = await deployDiamond();
    //
    //         smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
    //
    //         let tokenManager = await deployContract(
    //             owner,
    //             MockTokenManagerArtifact,
    //             []
    //         ) as MockTokenManager;
    //
    //         await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'AVAX', [], tokenManager.address)
    //
    //         tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
    //         MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
    //         supportedAssets = convertAssetsListToSupportedAssets(assetsList);
    //         addMissingTokenContracts(tokenContracts, assetsList);
    //
    //
    //         await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
    //         await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);
    //
    //         await smartLoansFactory.initialize(diamondAddress, tokenManager.address);
    //
    //         let addressProvider = await deployContract(
    //             owner,
    //             AddressProviderArtifact,
    //             []
    //         ) as AddressProvider;
    //
    //         await recompileConstantsFile(
    //             'local',
    //             "DeploymentConstants",
    //             [],
    //             tokenManager.address,
    //             addressProvider.address,
    //             diamondAddress,
    //             smartLoansFactory.address,
    //             'lib'
    //         );
    //
    //         exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;
    //
    //         await recompileConstantsFile(
    //             'local',
    //             "DeploymentConstants",
    //             [
    //                 {
    //                     facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
    //                     contractAddress: exchange.address,
    //                 }
    //             ],
    //             tokenManager.address,
    //             addressProvider.address,
    //             diamondAddress,
    //             smartLoansFactory.address,
    //             'lib'
    //         );
    //
    //         await deployAllFacets(diamondAddress)
    //     });
    //
    //     it("should deploy a smart loan, fund", async () => {
    //         await smartLoansFactory.connect(owner).createLoan();
    //
    //         const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
    //
    //         loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);
    //
    //         MOCK_PRICES = [
    //             {
    //                 dataFeedId: 'USDC',
    //                 value: tokensPrices.get('USDC')!
    //             },
    //             {
    //                 dataFeedId: 'AVAX',
    //                 value: tokensPrices.get('AVAX')!
    //             }
    //         ]
    //
    //         wrappedLoan = WrapperBuilder
    //             // @ts-ignore
    //             .wrap(loan)
    //             .usingSimpleNumericMock({
    //                 mockSignersCount: 10,
    //                 dataPoints: MOCK_PRICES,
    //             });
    //
    //         await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
    //         await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
    //         await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
    //     });
    //
    //     it('should not revert on a withdrawal while debt is 0', async () => {
    //         await wrappedLoan.withdraw(toBytes32("AVAX"), toWei("100"));
    //     });
    //
    //     it('should fund again', async () => {
    //         await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
    //         await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
    //     });
    //
    //     it('should borrow and swap', async () => {
    //         await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
    //
    //         expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * tokensPrices.get('AVAX')!, 0.1);
    //         expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * tokensPrices.get('AVAX')!, 0.1);
    //
    //         let debt = 300 * tokensPrices.get('AVAX')!;
    //         let maxDebt = 0.833333 * 400 * tokensPrices.get('AVAX')!;
    //
    //         expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(maxDebt / debt, 0.01);
    //
    //         const slippageTolerance = 0.03;
    //         let usdAmount = 3000;
    //         let requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;
    //
    //         await wrappedLoan.swapPangolin(
    //             toBytes32('AVAX'),
    //             toBytes32('USDC'),
    //             toWei(requiredAvaxAmount.toString()),
    //             parseUnits(usdAmount.toString(), await tokenContracts.get('USDC')!.decimals())
    //         );
    //     });
    //
    //     // it('should revert on a withdrawal with insufficient debt-denominated tokens', async () => {
    //     //     expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.gt(0);
    //     //     expect(await wrappedLoan.isSolvent()).to.be.true;
    //     //     await expect(wrappedLoan.withdraw(toBytes32("AVAX"), toWei("10"))).to.be.revertedWith("Insufficient assets to fully repay the debt")
    //     // });
    //
    //     // it('should withdraw while sufficient debt-dominated tokens are present', async () => {
    //     //     expect(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address)).to.be.gt(0);
    //     //
    //     //     const slippageTolerance = 0.03;
    //     //     let avaxAmount = 300 - fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address));
    //     //     let requiredUsdcAmount = tokensPrices.get('AVAX')! * avaxAmount * (1 + slippageTolerance) / tokensPrices.get('USDC')!;
    //     //
    //     //     await wrappedLoan.swapPangolin(
    //     //         toBytes32('USDC'),
    //     //         toBytes32('AVAX'),
    //     //         parseUnits(Math.floor(requiredUsdcAmount).toString(), BigNumber.from("6")),
    //     //         parseUnits(avaxAmount.toString(), await tokenContracts.get('AVAX')!.decimals())
    //     //     );
    //     //     expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.gte(300);
    //     //
    //     //     let extraUsdcAmount = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);
    //     //
    //     //     expect(await wrappedLoan.isSolvent()).to.be.true;
    //     //
    //     //     await expect(wrappedLoan.withdraw(toBytes32("USDC"), extraUsdcAmount)).to.be.revertedWith("The action may cause an account to become insolvent");
    //     //
    //     //     await wrappedLoan.withdraw(toBytes32("USDC"), extraUsdcAmount.div(BigNumber.from("10")));
    //     //
    //     //     expect(await wrappedLoan.isSolvent()).to.be.true;
    //     // });
    //
    //     // it('should not revert on 0 token withdrawal amount', async () => {
    //     //     await wrappedLoan.withdraw(toBytes32("USDC"), 0);
    //     // });
    //     //
    //     // it('should revert on a withdrawal amount being higher than the available balance', async () => {
    //     //     await expect(wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("200001", await tokenContracts.get('USDC')!.decimals()))).to.be.revertedWith("There is not enough funds to withdraw");
    //     // });
    //     //
    //     // it('should revert on a withdrawal resulting in an insolvent loan', async () => {
    //     //     await expect(wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("5000", await tokenContracts.get('USDC')!.decimals()))).to.be.revertedWith("The action may cause an account to become insolvent");
    //     // });
    //     //
    //     // it('should withdraw', async () => {
    //     //     let previousBalance = formatUnits(await tokenContracts.get('USDC')!.balanceOf(owner.address), await tokenContracts.get('USDC')!.decimals());
    //     //     await wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("1", await tokenContracts.get('USDC')!.decimals()));
    //     //     expect(await tokenContracts.get('USDC')!.balanceOf(owner.address)).to.be.equal(parseUnits((previousBalance + 1).toString(), await tokenContracts.get('USDC')!.decimals()))
    //     // });
    // });

    describe('Withdrawal intents', () => {
        let exchange: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            smartLoansFactory: SmartLoansFactory,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'AVAX', [], tokenManager.address)

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);


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

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress)
        });

        beforeEach("deploy loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        });

        // describe('Creating intents', () => {
        //     it("should create withdrawal intent", async () => {
        //         const amount = toWei("50");
        //         const tx = await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), amount);
        //         console.log("FORTH Available balance:", await wrappedLoan.getAvailableBalance(toBytes32("AVAX")));
        //         const receipt = await tx.wait();
        //
        //         const event = receipt.events?.find(e => e.event === 'WithdrawalIntentCreated');
        //         expect(event?.args?.asset).to.equal(toBytes32("AVAX"));
        //         expect(event?.args?.amount).to.equal(amount);
        //
        //         const intents = await wrappedLoan.getUserIntents(toBytes32("AVAX"));
        //         expect(intents.length).to.equal(1);
        //         expect(intents[0].amount).to.equal(amount);
        //         expect(intents[0].isPending).to.be.true;
        //         expect(intents[0].isActionable).to.be.false;
        //         expect(intents[0].isExpired).to.be.false;
        //     });
        //
        //     it("should revert when creating intent for more than available balance", async () => {
        //         console.log("Available balance:", await wrappedLoan.getAvailableBalance(toBytes32("AVAX")));
        //         await expect(
        //             wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("150"))
        //         ).to.be.revertedWith("InsufficientAvailableBalance");
        //     });
        //
        //     it("should track total intent amount correctly", async () => {
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("30"));
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));
        //
        //         expect(await wrappedLoan.getTotalIntentAmount(toBytes32("AVAX"))).to.equal(toWei("100"));
        //         expect(await wrappedLoan.getAvailableBalance(toBytes32("AVAX"))).to.equal(toWei("0"));
        //     });
        // });

        describe('Executing intents', () => {
            beforeEach("create intent", async () => {
                await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("50"));
            });

            it("should not execute intent before maturity", async () => {
                await expect(
                    wrappedLoan.executeWithdrawalIntent(toBytes32("AVAX"), [0])
                ).to.be.revertedWith("Intent not matured");
            });

            it("should execute mature intent", async () => {
                await time.increase(25 * 60 * 60); // 25 hours

                const beforeBalance = await tokenContracts.get('AVAX')!.balanceOf(owner.address);
                await wrappedLoan.executeWithdrawalIntent(toBytes32("AVAX"), [0]);
                const afterBalance = await tokenContracts.get('AVAX')!.balanceOf(owner.address);

                expect(afterBalance.sub(beforeBalance)).to.equal(toWei("50"));
                expect(await wrappedLoan.getTotalIntentAmount(toBytes32("AVAX"))).to.equal(0);
            });

            it("should not execute expired intent", async () => {
                await time.increase(49 * 60 * 60); // 49 hours

                await expect(
                    wrappedLoan.executeWithdrawalIntent(toBytes32("AVAX"), [0])
                ).to.be.revertedWith("Intent expired");
            });

            it("should execute multiple intents", async () => {
                await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));
                await time.increase(25 * 60 * 60);

                await wrappedLoan.executeWithdrawalIntent(toBytes32("AVAX"), [0, 1]);
                expect(await wrappedLoan.getTotalIntentAmount(toBytes32("AVAX"))).to.equal(0);
            });
        });

        // describe('Canceling intents', () => {
        //     it("should cancel pending intent", async () => {
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("50"));
        //         await wrappedLoan.cancelWithdrawalIntent(toBytes32("AVAX"), 0);
        //
        //         expect(await wrappedLoan.getTotalIntentAmount(toBytes32("AVAX"))).to.equal(0);
        //         const intents = await wrappedLoan.getUserIntents(toBytes32("AVAX"));
        //         expect(intents.length).to.equal(0);
        //     });
        //
        //     it("should revert when canceling non-existent intent", async () => {
        //         await expect(
        //             wrappedLoan.cancelWithdrawalIntent(toBytes32("AVAX"), 0)
        //         ).to.be.revertedWith("Invalid intent index");
        //     });
        // });
        //
        // describe('Managing expired intents', () => {
        //     it("should clean expired intents", async () => {
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("30"));
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));
        //
        //         await time.increase(49 * 60 * 60); // 49 hours
        //         await wrappedLoan.clearExpiredIntents(toBytes32("AVAX"));
        //
        //         expect(await wrappedLoan.getTotalIntentAmount(toBytes32("AVAX"))).to.equal(0);
        //         const intents = await wrappedLoan.getUserIntents(toBytes32("AVAX"));
        //         expect(intents.length).to.equal(0);
        //     });
        //
        //     it("should auto-clean expired intents when creating new one", async () => {
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("30"));
        //         await time.increase(49 * 60 * 60);
        //
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));
        //         expect(await wrappedLoan.getTotalIntentAmount(toBytes32("AVAX"))).to.equal(toWei("20"));
        //     });
        // });
        //
        // describe('Edge cases', () => {
        //     it("should handle intent creation when balance changes", async () => {
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("50"));
        //
        //         // Add more funds
        //         await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
        //         await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
        //         await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        //
        //         // Should be able to create intent for new funds
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("100"));
        //     });
        //
        //     it("should handle multiple token intents independently", async () => {
        //         // Setup USDC balance first
        //         await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
        //         const slippageTolerance = 0.03;
        //         const usdAmount = 3000;
        //         const requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;
        //         await wrappedLoan.swapPangolin(
        //             toBytes32('AVAX'),
        //             toBytes32('USDC'),
        //             toWei(requiredAvaxAmount.toString()),
        //             parseUnits(usdAmount.toString(), await tokenContracts.get('USDC')!.decimals())
        //         );
        //
        //         // Create intents for both tokens
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("50"));
        //         await wrappedLoan.createWithdrawalIntent(toBytes32("USDC"), parseUnits("1000", 6));
        //
        //         const avaxIntents = await wrappedLoan.getUserIntents(toBytes32("AVAX"));
        //         const usdcIntents = await wrappedLoan.getUserIntents(toBytes32("USDC"));
        //         expect(avaxIntents.length).to.equal(1);
        //         expect(usdcIntents.length).to.equal(1);
        //     });
        // });
    });

});

