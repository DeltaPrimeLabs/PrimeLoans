import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import DestructableArtifact from '../../../artifacts/contracts/mock/DestructableContract.sol/DestructableContract.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    AssetNameBalance, AssetNameBalanceDebtCoverage,
    AssetNameDebt,
    AssetNamePrice,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployPools,
    fromBytes32,
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
    DestructableContract, MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    AddressProvider,
} from "../../../typechain";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {BigNumber, Contract} from "ethers";
chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe(`Funding a loan`, () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            wrappedLoanLiquidator: any,
            wrappedLoanNonLiquidator: any,
            tokenManager: any,
            liquidator: SignerWithAddress,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'MCKUSD'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'MCKUSD', airdropList: [owner, depositor]}
            ];


            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'MCKUSD'), "avalanche", getRedstonePrices, [{symbol: 'MCKUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);

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

            await deployAllFacets(diamondAddress)
            let liquidatorsList = await ethers.getContractAt('ISmartLoanLiquidationFacet', diamondAddress, owner);
            await liquidatorsList.whitelistLiquidators([liquidator.address]);
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            wrappedLoanLiquidator = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(liquidator))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            wrappedLoanNonLiquidator = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });


        it("should fund a loan", async () => {
            await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("300"));

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
        });

        it("should return all supported assets addresses", async () => {
            let result = await wrappedLoan.getSupportedTokensAddresses();
            expect(result[0].toLowerCase()).to.be.equal(TOKEN_ADDRESSES['AVAX'].toLowerCase());
            expect(result[1].toLowerCase()).to.be.equal(tokenContracts.get('MCKUSD')!.address.toLowerCase());
        });


        it("should return all assets balances and debt coverages", async () => {
            let result = await wrappedLoan.getAllAssetsBalancesDebtCoverages();
            let assetsNameBalance = [];
            for (const r of result) {
                assetsNameBalance.push(new AssetNameBalanceDebtCoverage(fromBytes32(r[0]), r[1], r[2]));
            }
            expect(assetsNameBalance).to.eql([
                new AssetNameBalanceDebtCoverage("AVAX", BigNumber.from("0"), toWei("0.8333333333333333")),
                new AssetNameBalanceDebtCoverage("MCKUSD", toWei("300"), toWei("0.8333333333333333")),
            ])
        });

        it("should check all owned assets", async () => {
            expect(await loanOwnsAsset("MCKUSD")).to.be.true;
            expect(await loanOwnsAsset("AVAX")).to.be.false;
        });

        // fail to remove owned asset as a non liquidator
        it("should fail to remove owned asset as a non liquidator", async () => {
            await expect(wrappedLoanNonLiquidator.removeUnsupportedOwnedAsset(toBytes32("MCKUSD"), tokenContracts.get('MCKUSD')!.address)).to.be.revertedWith("Only whitelisted liquidators can execute this method");
        });

        // should fail to remove owned asset as liquidator if it's still in tokenmanager
        it("should fail to remove owned asset as liquidator if it's still in tokenmanager", async () => {
            await expect(wrappedLoanLiquidator.removeUnsupportedOwnedAsset(toBytes32("MCKUSD"), tokenContracts.get('MCKUSD')!.address)).to.be.revertedWith("Asset is still supported");
        });

        // remove asset from tokenManager
        it("should remove asset from tokenManager", async () => {
            await tokenManager.removeTokenAssets([toBytes32("MCKUSD")]);
        });

        // should remove owned asset as liquidator
        it("should remove owned asset as liquidator", async () => {
            await wrappedLoanLiquidator.removeUnsupportedOwnedAsset(toBytes32("MCKUSD"), tokenContracts.get('MCKUSD')!.address);
            expect(await loanOwnsAsset("MCKUSD")).to.be.false;
            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
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

