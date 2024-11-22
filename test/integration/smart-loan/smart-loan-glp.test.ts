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
    AssetNameBalance,
    AssetNamePrice,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployPools,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap, GLPManagerRewarderAbi,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, wavaxAbi, ZERO
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {BigNumber, Contract} from "ethers";

chai.use(solidity);

const {deployContract, provider} = waffle;
const GLP_REWARDER_ADDRESS = "0xB70B91CE0771d3f4c81D87660f71Da31d48eB3B3";
const GLP_MANAGER_ADDRESS = "0xD152c7F25db7F4B95b7658323c5F33d176818EE4";
const STAKED_GLP_ADDRESS = "0xaE64d55a6f09E4263421737397D1fdFA71896a69";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe(`Funding a loan`, () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            glpBalanceAfterMint: any,
            glpRewarderContract: Contract,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'GLP', 'MCKUSD'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [owner, depositor]}
            ];

            glpRewarderContract = new ethers.Contract(GLP_REWARDER_ADDRESS, GLPManagerRewarderAbi, provider);

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'MCKUSD'), "avalanche", getRedstonePrices, [{symbol: 'MCKUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);
            tokenContracts.set('sGLP', new ethers.Contract(STAKED_GLP_ADDRESS , wavaxAbi, provider));

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

            const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });


        it("should mint GLP for owner", async () => {
            let currentGlpBalance = await tokenContracts.get("GLP")!.balanceOf(owner.address);
            expect(currentGlpBalance).to.be.equal(0);

            const minGlpAmount = tokensPrices.get("AVAX")! / tokensPrices.get("GLP")! * 98 / 100;

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("1")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(GLP_MANAGER_ADDRESS, toWei("1"));
            await glpRewarderContract.connect(owner).mintAndStakeGlp(
                TOKEN_ADDRESSES['AVAX'],
                toWei("1"),
                0,
                toWei(minGlpAmount.toString())
            )
            glpBalanceAfterMint = await tokenContracts.get("GLP")!.balanceOf(owner.address);
            expect(glpBalanceAfterMint).to.be.gt(0);
        });


        it("should fund a loan", async () => {
            await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("300"));

            await tokenContracts.get('sGLP')!.connect(owner).approve(wrappedLoan.address, glpBalanceAfterMint);
            await wrappedLoan.fundGLP(glpBalanceAfterMint);

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(wrappedLoan.address)).to.be.equal(glpBalanceAfterMint);
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(owner.address)).to.be.equal(0);
        });

        it("should withdraw from a loan", async () => {
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(wrappedLoan.address)).to.be.equal(glpBalanceAfterMint);
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(owner.address)).to.be.equal(0);

            await wrappedLoan.withdrawGLP(glpBalanceAfterMint);

            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(wrappedLoan.address)).to.be.equal(0);
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(owner.address)).to.be.equal(glpBalanceAfterMint);
        });

        it("should fund a loan back with GLP", async () => {
            await tokenContracts.get('sGLP')!.connect(owner).approve(wrappedLoan.address, glpBalanceAfterMint);
            await wrappedLoan.fundGLP(glpBalanceAfterMint);

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(wrappedLoan.address)).to.be.equal(glpBalanceAfterMint);
            expect(await tokenContracts.get('GLP')!.connect(owner).balanceOf(owner.address)).to.be.equal(0);
        });

        it("should return all supported assets addresses", async () => {
            let result = await wrappedLoan.getSupportedTokensAddresses();
            expect(result[0].toLowerCase()).to.be.equal(TOKEN_ADDRESSES['AVAX'].toLowerCase());
            expect(result[1].toLowerCase()).to.be.equal(TOKEN_ADDRESSES['GLP'].toLowerCase());
            expect(result[2].toLowerCase()).to.be.equal(tokenContracts.get('MCKUSD')!.address.toLowerCase());
        });

        it("should return all assets balances", async () => {
            let result = await wrappedLoan.getAllAssetsBalances();
            let assetsNameBalance = [];
            for (const r of result) {
                assetsNameBalance.push(new AssetNameBalance(fromBytes32(r[0]), r[1]));
            }
            expect(assetsNameBalance).to.eql([
                new AssetNameBalance("AVAX", BigNumber.from("0")),
                new AssetNameBalance("GLP", glpBalanceAfterMint),
                new AssetNameBalance("MCKUSD", toWei("300")),
            ])
        });

        it("should return all assets prices", async () => {
            let result = await wrappedLoan.getAllAssetsPrices();
            let assetsNamePrice = [];
            for (const r of result) {
                assetsNamePrice.push(new AssetNamePrice(fromBytes32(r[0]), r[1]));
            }
            expect(assetsNamePrice).to.eql([
                new AssetNamePrice("AVAX", BigNumber.from((Math.floor(Number(tokensPrices.get('AVAX')!) * 1e8)).toString())),
                new AssetNamePrice("GLP", BigNumber.from(Math.floor((Number(tokensPrices.get('GLP')!) * 1e8)).toString())),
                new AssetNamePrice("MCKUSD", BigNumber.from(Math.floor((Number(tokensPrices.get('MCKUSD')!) * 1e8)).toString())),
            ])
        });
    });
});

