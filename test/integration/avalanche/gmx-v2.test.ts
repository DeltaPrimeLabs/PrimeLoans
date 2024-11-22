import {ethers, waffle} from 'hardhat'
import chai, {expect, util} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide, ContractMethod } from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    erc20ABI,
    fromBytes32,
    fromWei,
    formatUnits,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    LPAbi,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    time,
    toBytes32,
    toWei,
    getContractSelectors
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    SushiSwapIntermediary,
} from "../../../typechain";
import {BigNumber, Contract, constants} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;


describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Gmx V2 LP operations', () => {
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
            paraSwapMin: SimpleFetchSDK,
            liquidityRouter: Contract,
            MOCK_PRICES: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            paraSwapMin = constructSimpleSDK({ chainId: 42161, axios });

            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'BTC', 'ETH', 'USDC', 'GM_BTC_BTCb_USDC', 'GM_ETH_WETHe_USDC', 'GM_AVAX_WAVAX_USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'AVAX');

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, [{symbol: 'LVL', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'AVAX');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'AVAX');

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            getContractSelectors(tokenManager);

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
                5000,
                "1.042e18",
                200,
                "AVAX",
                "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
            );

            await deployAllFacets(diamondAddress, true, 'AVAX');
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);


            for(const mckPrice of MOCK_PRICES){
                console.log(`MCK PRICE: ${Object.entries(mckPrice)}`)
            }
            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 3,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 3,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should swap and fund", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        });

        it("should deposit to GMX V2", async () => {
            const tokenAmount = toWei('10');
            const maxFee = toWei('0.5');

            const minAmount = fromWei(tokenAmount) * tokensPrices.get('AVAX')! / tokensPrices.get('GM_AVAX_WAVAX_USDC')! * 0.98;
            await wrappedLoan.depositAvaxUsdcGmxV2(true, tokenAmount, toWei(minAmount.toFixed(18)), maxFee, { value: maxFee });
        });

        // it("should withdraw from to GMX V2", async () => {
        //     const gmAmount = await tokenContracts.get('GM_AVAX_WAVAX_USDC')!.balanceOf(wrappedLoan.address);
        //     const maxFee = toWei('0.01');
        //
        //     await wrappedLoan.withdrawAvaxUsdcGmxV2(gmAmount, 0, 0, maxFee, { value: maxFee });
        // });
    });
});
