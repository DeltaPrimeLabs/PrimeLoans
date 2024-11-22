import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import IVectorFinanceStakingArtifact
    from '../../../artifacts/contracts/interfaces/IVectorFinanceStaking.sol/IVectorFinanceStaking.json';
import IVectorRewarderArtifact from '../../../artifacts/contracts/interfaces/IVectorRewarder.sol/IVectorRewarder.json';
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
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    time,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import { IVectorFinanceCompounder__factory } from './../../../typechain/factories/IVectorFinanceCompounder__factory';
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;


const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const VectorUSDCStaking1 = '0x7d44f9eb1ffa6848362a966ef7d6340d14f4af7e';
const VectorUSDTStaking1 = '0xc57d07fedD6ad36F7334B84C4F1DFd2768999E9D';
const VectorWAVAXStaking1 = '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc';
const VectorSAVAXStaking1 = '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Vector staking operations', () => {
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
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'sAVAX', 'USDC', 'USDT', 'PTP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'PTP'), "avalanche", getRedstonePrices, [{symbol: 'PTP', value: 0.072}]);
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

            await tokenManager.setDebtCoverage(VectorUSDCStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorUSDTStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorWAVAXStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorSAVAXStaking1, toWei("0.8333333333333333"));

            await tokenManager.setDebtCoverageStaked(toBytes32("VF_USDC_MAIN"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_AVAX_SAVAX"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_SAVAX_MAIN"), toWei("0.8333333333333333"));

            await tokenManager.setDebtCoverageStaked(toBytes32("VF_USDC_MAIN_AUTO"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_USDT_MAIN_AUTO"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_AVAX_SAVAX_AUTO"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_SAVAX_MAIN_AUTO"), toWei("0.8333333333333333"));

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

            let exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary");

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

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('VectorFinanceFacetMock', diamondAddress, [
                'vectorStakeUSDC1',
                'vectorUnstakeUSDC1',
                'vectorUSDC1Balance',
                'vectorStakeWAVAX1',
                'vectorUnstakeWAVAX1',
                'vectorWAVAX1Balance',
                'vectorStakeSAVAX1',
                'vectorUnstakeSAVAX1',
                'vectorSAVAX1Balance'
            ]);
            await diamondCut.unpause();
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

        it("should fund a loan, get USDC and sAVAX and borrow", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("sAVAX"), toWei("50"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("50"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDT"), toWei("50"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(500 * tokensPrices.get('AVAX')!, 80);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.vectorStakeUSDC1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeWAVAX1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeSAVAX1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeWAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeSAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake to normal vaults", async () => {
            await testStakeNormal("vectorStakeUSDC1", "vectorUSDC1Balance", VectorUSDCStaking1, parseUnits('400', BigNumber.from("6")));
            await testStakeNormal("vectorStakeWAVAX1", "vectorWAVAX1Balance", VectorWAVAXStaking1, toWei('30'));
            await testStakeNormal("vectorStakeSAVAX1", "vectorSAVAX1Balance", VectorSAVAXStaking1, toWei('30'));

            await time.increase(time.duration.days(30));
        });

        it("should fail to stake to normal vaults after upgrade", async () => {
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('VectorFinanceFacetOld', diamondAddress, [
                'vectorStakeUSDC1',
                'vectorUnstakeUSDC1',
                'vectorUSDC1Balance',
                'vectorStakeWAVAX1',
                'vectorUnstakeWAVAX1',
                'vectorWAVAX1Balance',
                'vectorStakeSAVAX1',
                'vectorUnstakeSAVAX1',
                'vectorSAVAX1Balance'
            ]);
            await diamondCut.unpause();

            await expect(wrappedLoan.vectorStakeUSDC1(toWei("9999"))).to.be.revertedWith("Manual VF vaults are no longer supported.");
            await expect(wrappedLoan.vectorStakeWAVAX1(toWei("9999"))).to.be.revertedWith("Manual VF vaults are no longer supported.");
            await expect(wrappedLoan.vectorStakeSAVAX1(toWei("9999"))).to.be.revertedWith("Manual VF vaults are no longer supported.");
        });

        it("should stake", async () => {
            await testStake("vectorStakeUSDC1Auto", "vectorUSDC1BalanceAuto", VectorUSDCStaking1, parseUnits('100', BigNumber.from("6")));
            await testStake("vectorStakeUSDT1Auto", "vectorUSDT1BalanceAuto", VectorUSDTStaking1, parseUnits('100', BigNumber.from("6")));
            await testStake("vectorStakeWAVAX1Auto", "vectorWAVAX1BalanceAuto", VectorWAVAXStaking1, toWei('10'));
            await testStake("vectorStakeSAVAX1Auto", "vectorSAVAX1BalanceAuto", VectorSAVAXStaking1, toWei('10'));

            await time.increase(time.duration.days(30));
        });

        it("should unstake all in normal way", async () => {
            await testUnstakeNormal("vectorUnstakeWAVAX1", "vectorWAVAX1Balance", VectorWAVAXStaking1, toWei('15'));
        });

        it("should migrate", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let normalSAVAX1Balance = await wrappedLoan.vectorSAVAX1Balance();
            let initialSAVAX1Balance = await wrappedLoan.vectorSAVAX1BalanceAuto();

            await wrappedLoan.vectorMigrateSAvax();

            expect(await wrappedLoan.vectorSAVAX1Balance()).to.be.eq(0);
            expect(await wrappedLoan.vectorSAVAX1BalanceAuto()).to.be.closeTo(initialSAVAX1Balance.add(normalSAVAX1Balance), normalSAVAX1Balance.div(1000));

            expect(await wrappedLoan.getTotalValue()).to.be.closeTo(initialTotalValue, initialTotalValue.div(1000));
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.0002);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), fromWei(initialTWV) / 10000);
        });

        it("should unstake", async () => {
            await testUnstake("vectorUnstakeUSDC1Auto", "vectorUSDC1BalanceAuto", VectorUSDCStaking1, parseUnits('50', BigNumber.from("6")));
            await testUnstake("vectorUnstakeUSDT1Auto", "vectorUSDT1BalanceAuto", VectorUSDTStaking1, parseUnits('50', BigNumber.from("6")));
            await testUnstake("vectorUnstakeWAVAX1Auto", "vectorWAVAX1BalanceAuto", VectorWAVAXStaking1, toWei('8'));
            await testUnstake("vectorUnstakeSAVAX1Auto", "vectorSAVAX1BalanceAuto", VectorSAVAXStaking1, toWei('20'));
        });

        async function testStakeNormal(stakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);

            let initialStakedBalance = await stakingContract.balance(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan[stakeMethod](amount);

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(amount);
            expect(await stakingContract.balance(wrappedLoan.address)).to.be.equal(amount);

            expect(await wrappedLoan.getTotalValue()).to.be.closeTo(initialTotalValue, 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.00001);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 0.00001);
        }

        async function testUnstakeNormal(unstakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);

            let rewardTokens = await getRewardTokens(stakingContract);
            // convert from address to symbol
            rewardTokens = rewardTokens.map((token) => getSymbol(token));

            //accepted max. 10% withdrawal fee
            await wrappedLoan[unstakeMethod](amount, amount.div(BigNumber.from(10)).mul(BigNumber.from(9)));

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(0);
            expect(await stakingContract.balance(wrappedLoan.address)).to.be.equal(0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 15);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);

            for(const rewardToken of rewardTokens){
                let ownedAssets = await wrappedLoan.getAllOwnedAssets();
                if(isRewardTokenSupported(rewardToken)){
                    if((await tokenContracts.get(rewardToken)!.balanceOf(wrappedLoan.address)) > 0){
                        expect((ownedAssets).includes(toBytes32(rewardToken))).to.be.true;
                        continue;
                    }
                }
                expect((ownedAssets).includes(toBytes32(rewardToken))).to.be.false;
            }
        }

        async function getRewardTokens(stakingContract: Contract) {
            let rewarder = await new ethers.Contract(await stakingContract.rewarder(), IVectorRewarderArtifact.abi, provider);
            let rewardTokens: any[] = [];

            let index = 0;
            while(true){
                try {
                    rewardTokens.push(await rewarder.rewardTokens(index));
                } catch (error) {
                    break;
                }
                index++;
            }
            return rewardTokens;
        }

        function isRewardTokenSupported(rewardToken: string) {
            let supported = false;
            for(const asset of supportedAssets) {
                if(fromBytes32(asset.asset) === rewardToken) {
                    supported = true;
                    break;
                }
            }
            return supported;
        }

        async function testStake(stakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {
            let initialNativeAVAXBalance = await provider.getBalance(loan.address);
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);
            let compounder = IVectorFinanceCompounder__factory.connect(await stakingContract.compounder(), provider);

            let initialStakedBalance = await compounder.depositTracking(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan[stakeMethod](amount);

            let postStakingNativeAVAXBalance = await provider.getBalance(loan.address);
            let extraAvaxAddedDollarValue = tokensPrices.get('AVAX')! * fromWei(postStakingNativeAVAXBalance.sub(initialNativeAVAXBalance))
            
            expect(await wrappedLoan[balanceMethod]()).to.be.closeTo(amount, 1);
            expect(await compounder.depositTracking(wrappedLoan.address)).to.be.eq(amount);


            expect(fromWei(await wrappedLoan.getTotalValue()) - + extraAvaxAddedDollarValue).to.be.closeTo(fromWei(initialTotalValue), 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue()) - extraAvaxAddedDollarValue * 0.833333333333333333).to.be.closeTo(fromWei(initialTWV), 0.0001);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.1);
        }

        async function testUnstake(unstakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);
            let compounder = IVectorFinanceCompounder__factory.connect(await stakingContract.compounder(), provider);

            let initialStakedBalance = await compounder.depositTracking(wrappedLoan.address);

            //accepted max. 10% withdrawal fee
            await wrappedLoan[unstakeMethod](amount, amount.div(BigNumber.from(10)).mul(BigNumber.from(9)));

            expect(await wrappedLoan[balanceMethod]()).to.be.closeTo(initialStakedBalance.sub(amount), 2);
            expect(await compounder.depositTracking(wrappedLoan.address)).to.be.closeTo(initialStakedBalance.sub(amount), 1);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.001);
        }

        it("should allow whitelisted accounts to unstake if insolvent", async () => {
            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1Auto(parseUnits('2', BigNumber.from("6")), parseUnits('1', BigNumber.from("6")))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");;

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1100"));

            await diamondCut.pause();
            await replaceFacet('SolvencyFacetMock', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            const whitelistingContract = await ethers.getContractAt('SmartLoanGigaChadInterface', diamondAddress, owner);

            expect(await wrappedLoan.isSolvent()).to.be.false;

            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1Auto(parseUnits('2', BigNumber.from("6")), parseUnits('1', BigNumber.from("6")))).to.be.reverted;

            await whitelistingContract.whitelistLiquidators([nonOwner.address]);

            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1Auto(parseUnits('2', BigNumber.from("6")), parseUnits('1', BigNumber.from("6")))).not.to.be.reverted;
        });

        function getSymbol(address: string) {
            return getKeyByValue(TOKEN_ADDRESSES, address);
        }

        function getKeyByValue(object: any, value: any) {
            return Object.keys(object).find(key => object[key].toLowerCase() === value.toLowerCase());
        }
    });
});


