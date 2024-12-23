import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    PoolInitializationObject,
    convertAssetsListToSupportedAssets,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    getFixedGasSigners,
    addMissingTokenContracts,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei, time,
} from "../../_helpers";
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

describe('Smart loan withdrawal intents', () => {
    let accounts: SignerWithAddress[];
    let exchange: PangolinIntermediary;
    let smartLoansFactory: SmartLoansFactory;
    let tokenContracts: Map<string, Contract> = new Map();
    let tokensPrices: Map<string, number>;
    let MOCK_PRICES: any;

    // Variables for each test suite
    let intentsTestLoan: any;

    before("deploy and setup", async () => {
        accounts = await getFixedGasSigners(10000000);
        const [owner] = accounts;
        const assetsList = ['AVAX', 'USDC'];
        const poolNameAirdropList: Array<PoolInitializationObject> = [
            {name: 'AVAX', airdropList: [accounts[1]]}
        ];

        const diamondAddress = await deployDiamond();
        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
        const tokenManager = await deployContract(owner, MockTokenManagerArtifact, []) as MockTokenManager;
        const poolContracts = new Map<string, Contract>();
        const lendingPools: Array<PoolAsset> = [];

        await deployPools(
            smartLoansFactory,
            poolNameAirdropList,
            tokenContracts,
            poolContracts,
            lendingPools,
            owner,
            accounts[1],
            1000,
            'AVAX',
            [],
            tokenManager.address
        );

        tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
        MOCK_PRICES = [
            { dataFeedId: 'USDC', value: tokensPrices.get('USDC')! },
            { dataFeedId: 'AVAX', value: tokensPrices.get('AVAX')! }
        ];

        const supportedAssets = convertAssetsListToSupportedAssets(assetsList);
        addMissingTokenContracts(tokenContracts, assetsList);

        await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
        await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);
        await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

        const addressProvider = await deployContract(owner, AddressProviderArtifact, []) as AddressProvider;
        exchange = await deployAndInitExchangeContract(
            owner,
            pangolinRouterAddress,
            tokenManager.address,
            supportedAssets,
            "PangolinIntermediary"
        ) as PangolinIntermediary;

        await recompileConstantsFile(
            'local',
            "DeploymentConstants",
            [{ facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol', contractAddress: exchange.address }],
            tokenManager.address,
            addressProvider.address,
            diamondAddress,
            smartLoansFactory.address,
            'lib'
        );

        await deployAllFacets(diamondAddress);

        // Create and setup test loan
        await smartLoansFactory.connect(accounts[2]).createLoan();
        const loanAddress = await smartLoansFactory.getLoanForOwner(accounts[2].address);
        const loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, accounts[2]);

        intentsTestLoan = WrapperBuilder
            .wrap(loan)
            .usingSimpleNumericMock({
                mockSignersCount: 10,
                dataPoints: MOCK_PRICES,
            });

        // Fund the loan
        await tokenContracts.get('AVAX')!.connect(accounts[2]).deposit({value: toWei("100")});
        await tokenContracts.get('AVAX')!.connect(accounts[2]).approve(intentsTestLoan.address, toWei("100"));
        await intentsTestLoan.fund(toBytes32("AVAX"), toWei("100"));
    });

    describe('Basic intent operations', () => {
        it("should create withdrawal intent", async () => {
            const tx = await intentsTestLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("50"));
            const receipt = await tx.wait();

            const event = receipt.events?.find(e => e.event === 'WithdrawalIntentCreated');
            expect(event?.args?.amount).to.equal(toWei("50"));

            const intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(1);
            expect(intents[0].isPending).to.be.true;
        });

        it("should reject excessive withdrawal intent", async () => {
            await expect(
                intentsTestLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("150"))
            ).to.be.revertedWith("InsufficientAvailableBalance");
        });

        it("should execute mature intent", async () => {
            await time.increase(25 * 60 * 60);
            const beforeBalance = await tokenContracts.get('AVAX')!.balanceOf(accounts[2].address);

            await intentsTestLoan.executeWithdrawalIntent(toBytes32("AVAX"), [0]);

            const afterBalance = await tokenContracts.get('AVAX')!.balanceOf(accounts[2].address);
            expect(afterBalance.sub(beforeBalance)).to.equal(toWei("50"));
        });

        it("should reject premature execution", async () => {
            await intentsTestLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));
            await expect(
                intentsTestLoan.executeWithdrawalIntent(toBytes32("AVAX"), [0])
            ).to.be.revertedWith("Intent not matured");
        });

        it("should handle intent cancellation", async () => {
            let intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(1);

            await intentsTestLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));

            intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(2);

            await intentsTestLoan.cancelWithdrawalIntent(toBytes32("AVAX"), 0);

            intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(1);
        });

        it("should handle expired intents", async () => {
            let intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(1);

            await intentsTestLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));

            intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(2);

            await time.increase(49 * 60 * 60);

            intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(2);

            await intentsTestLoan.clearExpiredIntents(toBytes32("AVAX"));

            intents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            expect(intents.length).to.equal(0);
        });

        it("should handle multiple token intents", async () => {
            // fund 300 avax
            await tokenContracts.get('AVAX')!.connect(accounts[2]).approve(intentsTestLoan.address, toWei("300"));
            await intentsTestLoan.fund(toBytes32("AVAX"), toWei("300"));

            // Setup USDC balance through swap
            const slippageTolerance = 0.03;
            const usdAmount = 3000;
            const requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            await intentsTestLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(usdAmount.toString(), 6)
            );

            // Create intents for both tokens
            await intentsTestLoan.createWithdrawalIntent(toBytes32("AVAX"), toWei("20"));
            await intentsTestLoan.createWithdrawalIntent(toBytes32("USDC"), parseUnits("1000", 6));

            const avaxIntents = await intentsTestLoan.getUserIntents(toBytes32("AVAX"));
            const usdcIntents = await intentsTestLoan.getUserIntents(toBytes32("USDC"));
            expect(avaxIntents.length).to.equal(1);
            expect(usdcIntents.length).to.equal(1);
        });
    });
});

