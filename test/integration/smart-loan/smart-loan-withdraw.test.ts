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

    describe('A loan with withdrawal', () => {
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

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
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

        it("should deploy a smart loan, fund", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            MOCK_PRICES = [
                {
                    dataFeedId: 'USDC',
                    value: tokensPrices.get('USDC')!
                },
                {
                    dataFeedId: 'AVAX',
                    value: tokensPrices.get('AVAX')!
                }
            ]

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        });

        it('should not revert on a withdrawal while debt is 0', async () => {
            await wrappedLoan.withdraw(toBytes32("AVAX"), toWei("100"));
        });

        it('should fund again', async () => {
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        });

        it('should borrow and swap', async () => {
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * tokensPrices.get('AVAX')!, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * tokensPrices.get('AVAX')!, 0.1);

            let debt = 300 * tokensPrices.get('AVAX')!;
            let maxDebt = 0.833333 * 400 * tokensPrices.get('AVAX')!;

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(maxDebt / debt, 0.01);

            const slippageTolerance = 0.03;
            let usdAmount = 3000;
            let requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(usdAmount.toString(), await tokenContracts.get('USDC')!.decimals())
            );
        });

        it('should revert on a withdrawal with insufficient debt-denominated tokens', async () => {
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.gt(0);
            expect(await wrappedLoan.isSolvent()).to.be.true;
            await expect(wrappedLoan.withdraw(toBytes32("AVAX"), 1)).to.be.revertedWith("Insufficient assets to fully repay the debt")
        });

        it('should withdraw while sufficient debt-dominated tokens are present', async () => {
            expect(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address)).to.be.gt(0);

            const slippageTolerance = 0.03;
            let avaxAmount = 300 - fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address));
            let requiredUsdcAmount = tokensPrices.get('AVAX')! * avaxAmount * (1 + slippageTolerance) / tokensPrices.get('USDC')!;

            await wrappedLoan.swapPangolin(
                toBytes32('USDC'),
                toBytes32('AVAX'),
                parseUnits(Math.floor(requiredUsdcAmount).toString(), BigNumber.from("6")),
                parseUnits(avaxAmount.toString(), await tokenContracts.get('AVAX')!.decimals())
            );
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.gte(300);

            let extraUsdcAmount = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;

            await expect(wrappedLoan.withdraw(toBytes32("USDC"), extraUsdcAmount)).to.be.revertedWith("The action may cause an account to become insolvent");

            await wrappedLoan.withdraw(toBytes32("USDC"), extraUsdcAmount.div(BigNumber.from("10")));

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });

        // it('should not revert on 0 token withdrawal amount', async () => {
        //     await wrappedLoan.withdraw(toBytes32("USDC"), 0);
        // });
        //
        // it('should revert on a withdrawal amount being higher than the available balance', async () => {
        //     await expect(wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("200001", await tokenContracts.get('USDC')!.decimals()))).to.be.revertedWith("There is not enough funds to withdraw");
        // });
        //
        // it('should revert on a withdrawal resulting in an insolvent loan', async () => {
        //     await expect(wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("5000", await tokenContracts.get('USDC')!.decimals()))).to.be.revertedWith("The action may cause an account to become insolvent");
        // });
        //
        // it('should withdraw', async () => {
        //     let previousBalance = formatUnits(await tokenContracts.get('USDC')!.balanceOf(owner.address), await tokenContracts.get('USDC')!.decimals());
        //     await wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("1", await tokenContracts.get('USDC')!.decimals()));
        //     expect(await tokenContracts.get('USDC')!.balanceOf(owner.address)).to.be.equal(parseUnits((previousBalance + 1).toString(), await tokenContracts.get('USDC')!.decimals()))
        // });
    });

});

