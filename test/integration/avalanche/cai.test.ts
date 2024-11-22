import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
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
    getMintData,
    getBurnData,
    recompileConstantsFile,
    toBytes32,
    toWei,
    fromBytes32,
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
import {Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with CAI operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['CAI', 'AVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(
                ['AVAX', 'CAI'],
                "avalanche",
                getRedstonePrices,
                []
            );
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

            await deployAllFacets(diamondAddress)
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        });

        it("should fail to mint/burn as a non-owner", async () => {
            const mintData = await getMintData(TOKEN_ADDRESSES['AVAX'], toWei('10').toString(), wrappedLoan.address);
            await expect(nonOwnerWrappedLoan.mintCai(mintData.selector, mintData.data, TOKEN_ADDRESSES['AVAX'], toWei('10'), 1)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.burnCai(mintData.selector, mintData.data, toWei('10'), TOKEN_ADDRESSES['AVAX'], 1)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it('should mint CAI', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("CAI")).to.be.false;

            const mintData = await getMintData(TOKEN_ADDRESSES['AVAX'], toWei('10').toString(), wrappedLoan.address);
            await wrappedLoan.mintCai(mintData.selector, mintData.data, TOKEN_ADDRESSES['AVAX'], toWei('10'), 500);

            expect(await loanOwnsAsset("CAI")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 10);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 10);
        });

        it('should burn CAI', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("CAI")).to.be.true;

            const caiBalance = await tokenContracts.get("CAI")!.balanceOf(wrappedLoan.address);

            const burnData = await getBurnData(caiBalance, TOKEN_ADDRESSES['AVAX'], wrappedLoan.address);
            await wrappedLoan.burnCai(burnData.selector, burnData.data, caiBalance, TOKEN_ADDRESSES['AVAX'], 500);

            expect(await loanOwnsAsset("CAI")).to.be.false;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        async function loanOwnsAsset(asset: string) {
            let ownedAssets =  await wrappedLoan.getAllOwnedAssets();
            for(const ownedAsset of ownedAssets){
                if(fromBytes32(ownedAsset) == asset){
                    return true;
                }
            }
            return false;
        }
    });
});
