import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import IMiniChefArtifact
    from '../../../artifacts/contracts/interfaces/facets/arbitrum/IMiniChef.sol/IMiniChef.json';
import IRewarderArtifact
    from '../../../artifacts/contracts/interfaces/facets/arbitrum/IRewarder.sol/IRewarder.json';
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
    toWei
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
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;

const sushiSwapRouterAddress = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
const miniChefAddress = '0xF4d73326C13a4Fc5FD7A064217e12780e9Bd62c3';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with SushiSwap staking operations', () => {
        let exchange: SushiSwapIntermediary,
            smartLoansFactory: SmartLoansFactory,
            lpTokenAddress: string,
            lpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            lpTokenBalance: BigNumber,
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
            let assetsList = ['ETH', 'DPX', 'SUSHI', 'SUSHI_DPX_ETH_LP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000, 'ARBITRUM');

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['SUSHI'].includes(el))), "arbitrum", getRedstonePrices, [{symbol: 'SUSHI', value: 0.6}]);
            tokenContracts.set('SUSHI_DPX_ETH_LP', new ethers.Contract(TOKEN_ADDRESSES['SUSHI_DPX_ETH_LP'], LPAbi, provider));
            tokenContracts.set('SUSHI', new ethers.Contract(TOKEN_ADDRESSES['SUSHI'], erc20ABI, provider));
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'ARBITRUM');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'ARBITRUM');

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            await tokenManager.setDebtCoverageStaked(toBytes32("SUSHI_DPX_ETH_LP_AUTO"), toWei("0.8333333333333333"));

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

            exchange = await deployAndInitExchangeContract(owner, sushiSwapRouterAddress, tokenManager.address, supportedAssets, "SushiSwapIntermediary") as SushiSwapIntermediary;

            lpTokenAddress = await exchange.connect(owner).getPair(TOKEN_ADDRESSES['DPX'], TOKEN_ADDRESSES['ETH']);
            lpToken = new ethers.Contract(lpTokenAddress, erc20ABI, provider);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/arbitrum/SushiSwapDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
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

            await deployAllFacets(diamondAddress, true, 'ARBITRUM');
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

        it("should swap and addLiquidity on Sushi", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("300")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("300"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("300"));

            await wrappedLoan.swapSushiSwap(
                toBytes32('ETH'),
                toBytes32('DPX'),
                toWei('10'),
                0
            );

            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.equal(0);

            await wrappedLoan.addLiquiditySushiSwap(
                toBytes32('ETH'),
                toBytes32('DPX'),
                toWei("8"),
                toWei((tokensPrices.get('ETH')! / tokensPrices.get('DPX')! * 8).toFixed(6)),
                toWei("6"),
                toWei((tokensPrices.get('ETH')! / tokensPrices.get('DPX')! * 6).toFixed(6))
            );
            lpTokenBalance = await lpToken.balanceOf(wrappedLoan.address);
            expect(lpTokenBalance).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 50);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.sushiStakeDpxEthLp(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.sushiUnstakeDpxEthLp(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake", async () => {
            await testStake("sushiStakeDpxEthLp", "sushiDpxEthLpBalance", 17, lpTokenBalance);

            await time.increase(time.duration.days(30));
        });

        it("should unstake", async () => {
            await testUnstake("sushiUnstakeDpxEthLp", "sushiDpxEthLpBalance", 17, lpTokenBalance);
        });

        async function testStake(stakeMethod: string, balanceMethod: string, pid: number, amount: BigNumber) {

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let stakingContract = await new ethers.Contract(miniChefAddress, IMiniChefArtifact.abi, provider);

            let initialStakedBalance = (await stakingContract.userInfo(pid, wrappedLoan.address)).amount;

            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan[stakeMethod](amount);

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(amount);
            expect((await stakingContract.userInfo(pid, wrappedLoan.address)).amount).to.be.equal(amount);

            expect(await wrappedLoan.getTotalValue()).to.be.closeTo(initialTotalValue, 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.00001);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 0.00001);
        }

        async function testUnstake(unstakeMethod: string, balanceMethod: string, pid: number, amount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            let stakingContract = await new ethers.Contract(miniChefAddress, IMiniChefArtifact.abi, provider);

            let rewardTokens: any[] = await getRewardTokens(stakingContract, pid);
            // convert from address to symbol
            rewardTokens = rewardTokens.map((token) => getSymbol(token));

            let beforeBalances = new Array(rewardTokens.length);
            for (let i = 0; i < rewardTokens.length; i++) {
                const rewardToken = rewardTokens[i];
                beforeBalances[i] = await tokenContracts.get(rewardToken)!.balanceOf(wrappedLoan.address);
            }

            //accepted max. 10% withdrawal fee
            await wrappedLoan[unstakeMethod](amount, amount.div(BigNumber.from(10)).mul(BigNumber.from(9)));

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(0);
            expect((await stakingContract.userInfo(pid, wrappedLoan.address)).amount).to.be.equal(0);

            let rewardsValue = 0;

            for (let i = 0; i < rewardTokens.length; i++) {
                const rewardToken = rewardTokens[i];
                let ownedAssets = await wrappedLoan.getAllOwnedAssets();
                if(isRewardTokenSupported(rewardToken)){
                    let balance = await tokenContracts.get(rewardToken)!.balanceOf(wrappedLoan.address);
                    if (balance > 0) {
                        rewardsValue += formatUnits(balance.sub(beforeBalances[i]), await tokenContracts.get(rewardToken)!.decimals()) * tokensPrices.get(rewardToken)!;
                        expect((ownedAssets).includes(toBytes32(rewardToken))).to.be.true;
                        continue;
                    }
                }
                expect((ownedAssets).includes(toBytes32(rewardToken))).to.be.false;
            }

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue) + rewardsValue, 15);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
        }

        async function getRewardTokens(stakingContract: Contract, pid: number) {
            let rewarder = await new ethers.Contract(await stakingContract.rewarder(pid), IRewarderArtifact.abi, provider);
            let pendingSushi = stakingContract.pendingSushi(pid, wrappedLoan.address);
            let rewardTokens: string[] = (await rewarder.pendingTokens(pid, wrappedLoan.address, pendingSushi))[0];

            return [TOKEN_ADDRESSES["SUSHI"], ...rewardTokens];
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

        function getSymbol(address: string) {
            return getKeyByValue(TOKEN_ADDRESSES, address);
        }

        function getKeyByValue(object: any, value: any) {
            return Object.keys(object).find(key => object[key].toLowerCase() === value.toLowerCase());
        }
    });
});


