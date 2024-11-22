import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import IYakWrapRouterArtifact from '../../../artifacts/contracts/interfaces/IYakWrapRouter.sol/IYakWrapRouter.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI, formatUnits,
    fromBytes32,
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
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    IYakWrapRouter
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;

const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';
const yieldYakWrapRouterAddress = '0x44f4737C3Bb4E5C1401AE421Bd34F135E0BB8394';
const yieldYakGlpWrapperAddress = '0xe663d083b849d1f22ef2778339ec58175f547608';


describe('Smart loan', () => {

    describe('A loan with GLP operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            glpBalanceBeforeRedemptions: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'GLP', 'USDC', 'BTC', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));

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

            let exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary");

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
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan, get USDC, ETH and BTC", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("1000")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("1000"));

            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("ETH"), toWei("10"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("10"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("BTC"), toWei("10"), 0);

            expect(formatUnits(await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address), BigNumber.from("6"))).to.be.closeTo(10 * tokensPrices.get('AVAX')! / tokensPrices.get('USDC')!, 50);
            expect(fromWei(await tokenContracts.get("ETH")!.balanceOf(wrappedLoan.address))).to.be.closeTo(10 * tokensPrices.get('AVAX')! / tokensPrices.get('ETH')!, 50);
            expect(formatUnits(await tokenContracts.get("BTC")!.balanceOf(wrappedLoan.address), BigNumber.from("8"))).to.be.closeTo(10 * tokensPrices.get('AVAX')! / tokensPrices.get('BTC')!, 50);
            expect(fromWei(await tokenContracts.get("AVAX")!.balanceOf(wrappedLoan.address))).to.be.gt(10);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(1000 * tokensPrices.get('AVAX')!, 50);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.true;
            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.true;
            expect(await loanOwnsAsset("GLP")).to.be.false;
        });

        it("should fail to mint as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["GLP"], 0, 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to redeem as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeAndRedeemGlp(TOKEN_ADDRESSES["GLP"], 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should mint with USDC", async () => {
           let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
           let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
           let usdcInitialBalance = await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address)
           expect(formatUnits(usdcInitialBalance, BigNumber.from("6"))).to.be.gt(0);

           const minGlpAmount = formatUnits(usdcInitialBalance, BigNumber.from("6")) * tokensPrices.get("USDC")! / tokensPrices.get("GLP")! * 98 / 100;
           await expect(wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["USDC"], toWei("9999"), 0, 0)).to.be.revertedWith("Not enough token to mint");
           await wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["USDC"], usdcInitialBalance, 0, toWei(minGlpAmount.toString()));

           expect(formatUnits(await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address), BigNumber.from("6"))).to.be.equal(0);
           expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.gte(initialGlpBalance + minGlpAmount);
           expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.true;
            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should mint with BTC", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let btcInitialBalance = await tokenContracts.get("BTC")!.balanceOf(wrappedLoan.address)
            expect(formatUnits(btcInitialBalance, BigNumber.from("8"))).to.be.gt(0);

            const minGlpAmount = formatUnits(btcInitialBalance, BigNumber.from("8")) * tokensPrices.get("BTC")! / tokensPrices.get("GLP")! * 98 / 100;
            await expect(wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["BTC"], toWei("9999"), 0, 0)).to.be.revertedWith("Not enough token to mint");
            await wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["BTC"], btcInitialBalance, 0, toWei(minGlpAmount.toString()));

            expect(formatUnits(await tokenContracts.get("BTC")!.balanceOf(wrappedLoan.address), BigNumber.from("8"))).to.be.equal(0);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.gte(initialGlpBalance + minGlpAmount);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should mint with ETH", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let ethInitialBalance = await tokenContracts.get("ETH")!.balanceOf(wrappedLoan.address)
            expect(fromWei(ethInitialBalance)).to.be.gt(0);

            const minGlpAmount = fromWei(ethInitialBalance) * tokensPrices.get("ETH")! / tokensPrices.get("GLP")! * 98 / 100;
            await expect(wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["ETH"], toWei("9999"), 0, 0)).to.be.revertedWith("Not enough token to mint");
            await wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["ETH"], ethInitialBalance, 0, toWei(minGlpAmount.toString()));

            expect(fromWei(await tokenContracts.get("ETH")!.balanceOf(wrappedLoan.address))).to.be.equal(0);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.gte(initialGlpBalance + minGlpAmount);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.false;
            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should mint with AVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let avaxInitialBalance = await tokenContracts.get("AVAX")!.balanceOf(wrappedLoan.address)
            const avaxInvestedAmount = 10;
            expect(fromWei(avaxInitialBalance)).to.be.gt(avaxInvestedAmount);

            const minGlpAmount = avaxInvestedAmount * tokensPrices.get("AVAX")! / tokensPrices.get("GLP")! * 98 / 100;
            await expect(wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["AVAX"], toWei("9999"), 0, 0)).to.be.revertedWith("Not enough token to mint");
            await wrappedLoan.mintAndStakeGlp(TOKEN_ADDRESSES["AVAX"], toWei(avaxInvestedAmount.toString()), 0, toWei(minGlpAmount.toString()));

            expect(fromWei(await tokenContracts.get("AVAX")!.balanceOf(wrappedLoan.address))).to.be.lt(fromWei(avaxInitialBalance));
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.gte(initialGlpBalance + minGlpAmount);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.false;
            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("GLP")).to.be.true;

            glpBalanceBeforeRedemptions = await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address);
        });

        it("should redeem GLP into AVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let glpRedemptionAmount = fromWei(glpBalanceBeforeRedemptions) / 4;
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let avaxInitialBalance = await tokenContracts.get("AVAX")!.balanceOf(wrappedLoan.address)
            expect(initialGlpBalance).to.be.gte(glpRedemptionAmount);

            const expectedAVAXAmount = glpRedemptionAmount * tokensPrices.get("GLP")! / tokensPrices.get("AVAX")! * 98 / 100;
            await wrappedLoan.unstakeAndRedeemGlp(TOKEN_ADDRESSES["AVAX"], toWei(glpRedemptionAmount.toString()), toWei(expectedAVAXAmount.toString()));

            expect(fromWei(await tokenContracts.get("AVAX")!.balanceOf(wrappedLoan.address))).to.be.gte(fromWei(avaxInitialBalance) + expectedAVAXAmount);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.closeTo(initialGlpBalance - glpRedemptionAmount, 0.0001);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.false;
            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should redeem GLP into ETH", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let glpRedemptionAmount = fromWei(glpBalanceBeforeRedemptions) / 4;
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let ETHInitialBalance = await tokenContracts.get("ETH")!.balanceOf(wrappedLoan.address)
            expect(initialGlpBalance).to.be.gte(glpRedemptionAmount);

            const expectedETHAmount = glpRedemptionAmount * tokensPrices.get("GLP")! / tokensPrices.get("ETH")! * 98 / 100;
            await wrappedLoan.unstakeAndRedeemGlp(TOKEN_ADDRESSES["ETH"], toWei(glpRedemptionAmount.toString()), toWei(expectedETHAmount.toString()));

            expect(fromWei(await tokenContracts.get("ETH")!.balanceOf(wrappedLoan.address))).to.be.gte(fromWei(ETHInitialBalance) + expectedETHAmount);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.closeTo(initialGlpBalance - glpRedemptionAmount, 0.0001);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should redeem GLP into USDC", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let glpRedemptionAmount = fromWei(glpBalanceBeforeRedemptions) / 4;
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let USDCInitialBalance = await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address)
            expect(initialGlpBalance).to.be.gte(glpRedemptionAmount);

            const expectedUSDCAmount = Number((glpRedemptionAmount * tokensPrices.get("GLP")! / tokensPrices.get("USDC")! * 98 / 100).toFixed(6));
            await wrappedLoan.unstakeAndRedeemGlp(TOKEN_ADDRESSES["USDC"], toWei(glpRedemptionAmount.toString()), parseUnits(expectedUSDCAmount.toString(), BigNumber.from("6")));

            expect(formatUnits(await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address), BigNumber.from("6"))).to.be.gte(formatUnits(USDCInitialBalance, BigNumber.from("6")) + expectedUSDCAmount);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.closeTo(initialGlpBalance - glpRedemptionAmount, 0.0001);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.true;
            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should redeem GLP into BTC", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let BTCInitialBalance = await tokenContracts.get("BTC")!.balanceOf(wrappedLoan.address)
            expect(initialGlpBalance).to.be.gte(0);

            const expectedBTCAmount = Number((initialGlpBalance * tokensPrices.get("GLP")! / tokensPrices.get("BTC")! * 98 / 100).toFixed(8));
            await wrappedLoan.unstakeAndRedeemGlp(TOKEN_ADDRESSES["BTC"], toWei(initialGlpBalance.toString()), parseUnits(expectedBTCAmount.toString(), BigNumber.from("8")));

            expect(formatUnits(await tokenContracts.get("BTC")!.balanceOf(wrappedLoan.address), BigNumber.from("8"))).to.be.gte(formatUnits(BTCInitialBalance, BigNumber.from("8")) + expectedBTCAmount);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.closeTo(0, 1e-10);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 80);

            expect(await loanOwnsAsset("AVAX")).to.be.true;
            expect(await loanOwnsAsset("BTC")).to.be.true;
            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.true;
            expect(await loanOwnsAsset("GLP")).to.be.false;
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


    describe('Minting/redeeming GLP with YakSwap', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            yieldYakWrapRouter: IYakWrapRouter,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            glpBalanceBeforeRedemptions: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'GLP', 'USDC', 'BTC', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            yieldYakWrapRouter = new ethers.Contract(yieldYakWrapRouterAddress, IYakWrapRouterArtifact.abi, provider) as IYakWrapRouter;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));

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

            let exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary");

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
        });

        it("should fund a loan, get USDC, ETH and BTC", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("1000")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("1000"));

            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("10"), 0);

            expect(formatUnits(await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address), BigNumber.from("6"))).to.be.closeTo(10 * tokensPrices.get('AVAX')! / tokensPrices.get('USDC')!, 50);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(1000 * tokensPrices.get('AVAX')!, 5);

            expect(await loanOwnsAsset("GLP")).to.be.false;
        });

        it("should get YieldYak route and mint GLP", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialGlpBalance = fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));
            let usdcInitialBalance = await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address)
            expect(formatUnits(usdcInitialBalance, BigNumber.from("6"))).to.be.gt(0);

            const gasPrice = ethers.utils.parseUnits('225', 'gwei');

            let queryRes = await yieldYakWrapRouter.findBestPathAndWrap(usdcInitialBalance, TOKEN_ADDRESSES["USDC"], yieldYakGlpWrapperAddress, 3, gasPrice);

            const minGlpAmount = formatUnits(usdcInitialBalance, BigNumber.from("6")) * tokensPrices.get("USDC")! / tokensPrices.get("GLP")! * 95 / 100;
            const minGlpAmountWei = toWei(minGlpAmount.toString());

            await wrappedLoan.yakSwap(
                queryRes.amounts[0],
                minGlpAmountWei,
                queryRes.path,
                queryRes.adapters
            );

            fromWei(await tokenContracts.get("AVAX")!.balanceOf(wrappedLoan.address))

            expect(formatUnits(await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address), BigNumber.from("6"))).to.be.equal(0);
            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.gte(initialGlpBalance + minGlpAmount);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 5);

            expect(await loanOwnsAsset("GLP")).to.be.true;
        });

        it("should get Yield Yak route and redeem GLP", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let glpBalance = await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address);

            const gasPrice = ethers.utils.parseUnits('225', 'gwei');

            let queryRes = await yieldYakWrapRouter.unwrapAndFindBestPath(glpBalance, TOKEN_ADDRESSES["USDC"], yieldYakGlpWrapperAddress, 2, gasPrice);

            const minUsdAmount = fromWei(glpBalance) * tokensPrices.get("GLP")! / tokensPrices.get("USDC")!  * 95 / 100;
            const minUsdAmountWei = parseUnits(minUsdAmount.toFixed(6), BigNumber.from('6'));

            await wrappedLoan.yakSwap(
                queryRes.amounts[0],
                minUsdAmountWei,
                queryRes.path,
                queryRes.adapters
            );

            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.0001);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 5);
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

