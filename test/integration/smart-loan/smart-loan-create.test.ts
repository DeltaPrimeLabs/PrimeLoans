import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
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
    toWei, ZERO
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('Creating a loan', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower1: SignerWithAddress,
            borrower2: SignerWithAddress,
            borrower3: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor, borrower1, borrower2, borrower3] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ETH', 'MCKUSD'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [owner, depositor, borrower3]}
            ];

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'MCKUSD'), "avalanche", getRedstonePrices, [{symbol: 'MCKUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, []);
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

            await deployAllFacets(diamondAddress)
        });


        it("should create a smart loan using createLoan", async () => {
            await smartLoansFactory.connect(borrower1).createLoan();

            const loanAddress = await smartLoansFactory.getLoanForOwner(borrower1.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, borrower1);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(0, 0.01)
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.01)
        });


        it("should create a smart loan using createAndFundLoan", async () => {
            const wrappedSmartLoansFactory = smartLoansFactory.connect(borrower2)

            await tokenContracts.get('AVAX')!.connect(borrower2).deposit({value: toWei("1")});
            await tokenContracts.get('AVAX')!.connect(borrower2).approve(smartLoansFactory.address, toWei("1"));
            await wrappedSmartLoansFactory.createAndFundLoan(toBytes32("AVAX"), toWei("1"));

            const loanAddress = await smartLoansFactory.getLoanForOwner(borrower2.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, borrower2);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0)
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(1 * tokensPrices.get('AVAX')!, 0.05)
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(loan.address))).to.equal(1);
            expect(fromWei(await tokenContracts.get('MCKUSD')!.balanceOf(loan.address))).to.be.equal(0);
        });

        it("should get loans length", async () => {
            const length = await smartLoansFactory.getLoansLength();
            expect(length).to.be.eq(2);
        });

        it("should get loans", async () => {
            const loans = await smartLoansFactory.getLoans(0, 5);
            expect(loans.length).to.be.eq(2);
            const loanAddress1 = await smartLoansFactory.getLoanForOwner(borrower1.address);
            const loanAddress2 = await smartLoansFactory.getLoanForOwner(borrower2.address);
            expect(loans[0]).to.be.eq(loanAddress1);
            expect(loans[1]).to.be.eq(loanAddress2);
        });

        it("should not create a smart loan when wrong data is sent", async () => {
            const wrappedSmartLoansFactory = smartLoansFactory.connect(borrower3)

            await tokenContracts.get('MCKUSD')!.connect(borrower3).approve(smartLoansFactory.address, toWei("1"));
            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(borrower3).balanceOf(borrower3.address))).to.be.gt(1);

            await tokenContracts.get('AVAX')!.connect(borrower3).deposit({value: toWei("1")});
            await tokenContracts.get('AVAX')!.connect(borrower3).approve(smartLoansFactory.address, toWei("1"));

            await expect(wrappedSmartLoansFactory.createAndFundLoan(toBytes32("AVAX"), toWei("1")))
                .to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');

            await expect(wrappedSmartLoansFactory.createAndFundLoan(toBytes32("MCKUSD"), toWei("1")))
                .not.to.be.reverted;
        });
    });
});

