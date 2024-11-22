import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory
} from "../../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');
const {deployContract} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan - upgrading', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Check basic logic before and after upgrade', () => {
        let exchange: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            smartLoansFactory: SmartLoansFactory,
            owner: SignerWithAddress,
            other: SignerWithAddress,
            oracle: SignerWithAddress,
            tokenManager: any,
            borrower: SignerWithAddress,
            depositor: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("should deploy provider, exchange, loansFactory and WrappedNativeTokenPool", async () => {
            [owner, oracle, depositor, borrower, other] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

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

        it("should create a loan", async () => {
            const wrappedSmartLoansFactory = WrapperBuilder
                // @ts-ignore
                .wrap(smartLoansFactory.connect(borrower))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
            await wrappedSmartLoansFactory.createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);
            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });


        it("should check if only one loan per owner is allowed", async () => {
            await expect(smartLoansFactory.connect(borrower).createLoan()).to.be.revertedWith("Only one loan per owner is allowed");
            await expect(smartLoansFactory.connect(borrower).createAndFundLoan(toBytes32("AVAX"), 0)).to.be.revertedWith("Only one loan per owner is allowed");
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("2")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("2"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("2"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(2 * tokensPrices.get('AVAX')!, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });

        it("should not allow to re-initialize", async () => {
            await expect(wrappedLoan.initialize(owner.address)).to.be.revertedWith('DiamondInit: contract is already initialized');
        });

        it("should not allow to upgrade from non-owner", async () => {
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await expect(diamondCut.connect(borrower).diamondCut([], ethers.constants.AddressZero, [])).to.be.revertedWith('DiamondStorageLib: Must be contract owner');
            await diamondCut.unpause();
        });

        it("should return list of facets", async () => {
            const diamondLoupe = await ethers.getContractAt('IDiamondLoupe', diamondAddress, owner);
            let facetAddresses = await diamondLoupe.facetAddresses();
            expect(facetAddresses.length).to.be.gt(0);
            expect((await diamondLoupe.facets()).length).to.be.gt(0);
            let facetSelectors = await diamondLoupe.facetFunctionSelectors(facetAddresses[0]);
            expect(facetSelectors.length).to.be.gt(0);
            expect(await diamondLoupe.facetAddress(facetSelectors[0])).not.to.be.equal(ethers.constants.AddressZero);
        });

        it("should test paused methods exemptions", async () => {
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            const diamondBeaconOwner = await ethers.getContractAt("SmartLoanDiamondBeacon", diamondAddress, owner);
            const diamondBeaconNonOwner = await ethers.getContractAt("SmartLoanDiamondBeacon", diamondAddress, depositor);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            // Should access non-exempted function while not paused
            await wrappedLoan.isSolvent();

            // PAUSE
            await diamondCut.pause();

            // Should fail to access non-exempted function while paused
            await expect(wrappedLoan.isSolvent()).to.be.revertedWith("ProtocolUpgrade: paused.");

            // Fail setting function's exemption as a non owner
            // 0x5ce23950 -> isSolvent()
            await expect(diamondBeaconNonOwner.setPausedMethodExemptions([0x5ce23950], [true])).to.be.revertedWith("DiamondStorageLib: Must be contract owner");

            // Set function's exemption as an owner
            // 0x5ce23950 -> isSolvent()
            await diamondBeaconOwner.setPausedMethodExemptions([0x5ce23950], [true]);

            // Should access exempted function while paused
            await wrappedLoan.isSolvent();

            // UNPAUSE
            await diamondCut.unpause();

            // Check the canBeExecutedWhenPaused() function
            expect(await diamondBeaconOwner.canBeExecutedWhenPaused("0x5ce23950")).to.be.true;
            expect(await diamondBeaconOwner.canBeExecutedWhenPaused("0xffffffff")).to.be.false;

            // Should access exempted function while not paused
            await wrappedLoan.isSolvent();

            // Fail setting function's "false" value exemption as a non owner
            // 0x5ce23950 -> isSolvent()
            await expect(diamondBeaconNonOwner.setPausedMethodExemptions([0x5ce23950], [false])).to.be.revertedWith("DiamondStorageLib: Must be contract owner");

            // Set function's "false" value exemption as the owner
            // 0x5ce23950 -> isSolvent()
            await diamondBeaconOwner.setPausedMethodExemptions([0x5ce23950], [false]);

            // Check the canBeExecutedWhenPaused() function
            expect(await diamondBeaconOwner.canBeExecutedWhenPaused("0x5ce23950")).to.be.false;
            expect(await diamondBeaconOwner.canBeExecutedWhenPaused("0xffffffff")).to.be.false;

            // Should access no-longer-exempted function while not paused
            await wrappedLoan.isSolvent();

            // Should fail to disallow using unpause() function while paused
            // 0x3f4ba83a -> unpause()
            await expect(diamondBeaconOwner.setPausedMethodExemptions([0x3f4ba83a], [false])).to.be.revertedWith("The unpause() method must be available during the paused state.");

            // Should not revert on allowing using unpause() function while paused
            // 0x3f4ba83a -> unpause()
            await diamondBeaconOwner.setPausedMethodExemptions([0x3f4ba83a], [true]);
        });

        it("should upgrade", async () => {
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await expect(replaceFacet("MockSolvencyFacetConstantDebt", diamondAddress, ['getDebt'])).to.be.revertedWith('ProtocolUpgrade: not paused.');

            await diamondCut.pause()
            await replaceFacet("MockSolvencyFacetConstantDebt", diamondAddress, ['getDebt'])

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            await expect(wrappedLoan.getDebt()).to.be.revertedWith('ProtocolUpgrade: paused.');

            await diamondCut.unpause();
            //The mock loan has a hardcoded debt of 2137
            expect(await wrappedLoan.getDebt()).to.be.equal(2137);
        });
    });
});
