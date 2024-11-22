import {ethers, network, waffle} from 'hardhat'
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
    erc20ABI,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {AddressProvider, MockTokenManager, SmartLoanGigaChadInterface, SmartLoansFactory,} from "../../../typechain";
import {Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from "../../../common/addresses/arbitrum/token_addresses.json";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
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
            let assetsList = ['ETH', 'USDT', 'YY_WOMBEX_USDT',
                "USDC",
                "ARB",
                "BTC",
                "DAI",
                "FRAX",
                "USDC.e",
                "UNI",
                "LINK",
                "GMX",
                "MAGIC",
                "WOO",
                "wstETH",
                "JOE",
                "GRAIL",
                "ezETH",
                "weETH",
                "rsETH"];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]},
                {name: 'USDT', airdropList: []},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');
            tokensPrices = await getTokensPricesMap(assetsList, "arbitrum", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, "ARBITRUM");
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], "ARBITRUM");

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
                5000,
                "1.042e18",
                200,
                "ETH",
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            );
            await deployAllFacets(diamondAddress, true, 'ARBITRUM')
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

        it("should fund PA with USDT and ETH", async () => {
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0x20fa1822a87d4e7a3ccf20f86e716ef3772ecff1"],
            });
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0xc3e5607cd4ca0d5fe51e09b60ed97a0ae6f874dd"],
            });
            // send 0.1 ETH from owner to usdt whale
            await owner.sendTransaction({
                to: "0x20fa1822a87d4e7a3ccf20f86e716ef3772ecff1",
                value: toWei("0.1"),
            });
            // send 0.1 ETH from owner to eht whale
            await owner.sendTransaction({
                to: "0xc3e5607cd4ca0d5fe51e09b60ed97a0ae6f874dd",
                value: toWei("0.1"),
            });


            let usdtWhale = await ethers.provider.getSigner('0x20fa1822a87d4e7a3ccf20f86e716ef3772ecff1');
            let ethWhale = await ethers.provider.getSigner('0xc3e5607cd4ca0d5fe51e09b60ed97a0ae6f874dd');

            await tokenContracts.get('USDT')!.connect(usdtWhale).transfer(owner.address, parseUnits("10000", 6));
            await tokenContracts.get('USDT')!.connect(owner).approve(wrappedLoan.address, parseUnits("1000", 6));
            console.log('FUND 1000 USDT')
            await wrappedLoan.fund(toBytes32("USDT"), parseUnits("1000", 6));

            console.log(`TotalValue of the loan: $${fromWei(await wrappedLoan.getTotalValue())}`);
            console.log(`Debt of the loan: $${fromWei(await wrappedLoan.getDebt())}`);
            console.log(`EligibleTVL: ${fromWei(await wrappedLoan.getLTIPEligibleTVL())}`);

            await tokenContracts.get('USDT')!.connect(owner).approve(poolContracts.get('USDT')!.address, parseUnits("9000", 6));
            await poolContracts.get('USDT')!.connect(owner).deposit(parseUnits("9000", 6));

            await tokenContracts.get('ETH')!.connect(ethWhale).transfer(owner.address, toWei("1"));
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("1"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("1"));
            console.log('FUND 1 ETH')
            console.log(`TotalValue of the loan: $${fromWei(await wrappedLoan.getTotalValue())}`);
            console.log(`Debt of the loan: $${fromWei(await wrappedLoan.getDebt())}`);
            console.log(`EligibleTVL: ${fromWei(await wrappedLoan.getLTIPEligibleTVL())}`);


            console.log('BORROW 5000 USDT')
            await wrappedLoan.borrow(toBytes32("USDT"), parseUnits("5000", 6));
            console.log(`TotalValue of the loan: $${fromWei(await wrappedLoan.getTotalValue())}`);
            console.log(`Debt of the loan: $${fromWei(await wrappedLoan.getDebt())}`);
            console.log(`EligibleTVL: ${fromWei(await wrappedLoan.getLTIPEligibleTVL())}`);

            console.log('STAKE 6000 USDT')
            let totalValueBefore = fromWei(await wrappedLoan.getTotalValue());
            await wrappedLoan.stakeUSDTYak(parseUnits("6000", 6));
            let totalValueAfter = fromWei(await wrappedLoan.getTotalValue());
            console.log(`TotalValue of the loan: $${totalValueAfter}`);
            console.log(`Debt of the loan: $${fromWei(await wrappedLoan.getDebt())}`);
            let eligibleTVL = fromWei(await wrappedLoan.getLTIPEligibleTVL());
            console.log(`EligibleTVL: ${eligibleTVL}`);
            expect(eligibleTVL).to.be.gt(2000)
            expect(totalValueAfter).to.be.closeTo(totalValueBefore, 100)
        });
    });
});