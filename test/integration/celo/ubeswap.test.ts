//npx hardhat test test/integration/celo/ubeswap.test.ts --network localhost

import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {JsonRpcSigner} from "@ethersproject/providers";
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    extractAssetNameBalances,
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
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    UbeswapIntermediary,
} from "../../../typechain";
import {Contract, Wallet} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;
const ubeswapRouterAddress = '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121';

describe('Smart loan', () => {

    describe('A loan without debt', () => {
        let exchange: UbeswapIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: JsonRpcSigner,
            depositor: Wallet,
            random: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [random] = await getFixedGasSigners(6500000);
            let assetsList = ['CELO', 'ETH', 'mcUSD'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'CELO', airdropList: []}
            ];

            owner = provider.getSigner('0x5839Dd13ad2C78dDcF3365D54302D65764619737');
            depositor = ethers.Wallet.createRandom().connect(provider);

            await random.sendTransaction({
                to: depositor.address,
                value: toWei("20")
            })

            await random.sendTransaction({
                to: await owner.getAddress(),
                value: toWei("20")
            })

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;


            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000, 'CELO');

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'mcUSD'), "avalanche", getRedstonePrices, [{symbol: 'mcUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'CELO');
            addMissingTokenContracts(tokenContracts, assetsList, 'CELO');
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
                'lib',
                undefined,
                undefined,
                undefined,
                'CELO'
            );

            exchange = await deployAndInitExchangeContract(owner, ubeswapRouterAddress, tokenManager.address, supportedAssets, "UbeswapIntermediary") as UbeswapIntermediary;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/celo/UbeswapDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress, true,'CELO')
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(await owner.getAddress());

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1);

            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("10"));

            expect(fromWei(await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address))).to.be.closeTo(10, 0.1);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('ETH')! * 10, 0.01);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1);
        });

        it("should fail to swap from a non-owner account", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
            await expect(nonOwnerWrappedLoan.swapUbeswap(
                toBytes32('ETH'), toBytes32('mcUSD'), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });


        it("should buy an asset from funded", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('ETH')! * 10, 2);

            const slippageTolerance = 0.1;
            const swappedEthAmount = 3;
            const expectedUSDAmount = tokensPrices.get('ETH')! * swappedEthAmount / (1 + slippageTolerance);

            expect(fromWei(await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address))).to.be.closeTo(10, 0.1);

            await wrappedLoan.swapUbeswap(
                toBytes32('ETH'),
                toBytes32('mcUSD'),
                toWei(swappedEthAmount.toString()),
                toWei(expectedUSDAmount.toString())
            )

            expect(fromWei(await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address))).to.be.closeTo(10 - swappedEthAmount, 0.1);
            expect(fromWei((await extractAssetNameBalances(wrappedLoan))["ETH"])).to.be.closeTo(10 - swappedEthAmount, 0.05);
            expect(fromWei(await tokenContracts.get('mcUSD')!.balanceOf(wrappedLoan.address))).to.be.closeTo(expectedUSDAmount, 400);
            expect(fromWei((await extractAssetNameBalances(wrappedLoan))["mcUSD"])).to.be.closeTo(expectedUSDAmount, 400);

            // total value should stay similar to before swap
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('ETH')! * 10, 300);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1);
        });

        it("should swap back", async () => {
            const initialUsdTokenBalance = (await extractAssetNameBalances(wrappedLoan))["mcUSD"];

            const slippageTolerance = 0.1;

            const ethAmount = fromWei(initialUsdTokenBalance) / tokensPrices.get('ETH')! / (1 + slippageTolerance);

            await wrappedLoan.swapUbeswap(
                toBytes32('mcUSD'),
                toBytes32('ETH'),
                initialUsdTokenBalance,
                toWei(ethAmount.toString())
            );

            const currentUsdTokenBalance = (await extractAssetNameBalances(wrappedLoan))["mcUSD"];

            expect(fromWei(currentUsdTokenBalance)).to.be.closeTo(0, 1);

            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1);
        });
    });
});

