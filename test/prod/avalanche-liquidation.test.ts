import {ethers, network, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {
    AssetsOperationsFacet,
    AssetsOperationsMock,
    DiamondCutFacet,
    IUniswapV2Router01,
    OwnershipFacet,
    Pool,
    SmartLoanDiamondBeacon,
    SmartLoanGigaChadInterface,
    SmartLoanLiquidationFacetDebug,
    SmartLoansFactory,
    TokenManager
} from "../../typechain";
import SMART_LOAN_DIAMOND_BEACON from '../../deployments/avalanche/SmartLoanDiamondBeacon.json';
import OWNERSHIP_FACET from '../../deployments/avalanche/OwnershipFacet.json';
import DIAMOND_CUT_FACET from '../../deployments/avalanche/DiamondCutFacet.json';
import SMART_LOAN_FACTORY_TUP from '../../deployments/avalanche/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '../../deployments/avalanche/SmartLoansFactory.json';
import SMART_LOAN_GIGACHAD_INTERFACE
    from '../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import WAVAX_POOL_TUP from '../../deployments/avalanche/WavaxPoolTUP.json';
import USDC_POOL_TUP from '../../deployments/avalanche/UsdcPoolTUP.json';
import WAVAX_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import USDC_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import TOKEN_MANAGER_TUP from '../../deployments/avalanche/TokenManagerTUP.json';
import TOKEN_MANAGER from '../../deployments/avalanche/TokenManager.json';
import {
    erc20ABI,
    formatUnits,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    syncTime,
    toBytes32,
    toWei,
    wavaxAbi
} from "../_helpers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JsonRpcSigner} from "@ethersproject/providers";
import {parseUnits} from "ethers/lib/utils";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import {FacetCutAction} from "hardhat-deploy/dist/types";

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const traderJoeRouter = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

chai.use(solidity);

const {provider} = waffle;

const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

describe('Test liquidations using deployed contracts on Avalanche', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe(`Set up 5 insolvent loans`, () => {
        let smartLoansFactory: SmartLoansFactory,
            smartLoansDiamondBeacon: SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet,
            loan1: SmartLoanGigaChadInterface,
            loan2: SmartLoanGigaChadInterface,
            loan3: SmartLoanGigaChadInterface,
            loan4: SmartLoanGigaChadInterface,
            loan5: SmartLoanGigaChadInterface,
            wavaxPool: Pool,
            usdcPool: Pool,
            tokenManager: TokenManager,
            MAINNET_DEPLOYER: JsonRpcSigner,
            USER_1: SignerWithAddress,
            USER_2: SignerWithAddress,
            USER_3: SignerWithAddress,
            USER_4: SignerWithAddress,
            USER_5: SignerWithAddress,
            USER_6: SignerWithAddress,
            USER_7: SignerWithAddress;

        before("setup deployed protocol contracts", async () => {
            smartLoansDiamondBeacon = new ethers.Contract(SMART_LOAN_DIAMOND_BEACON.address, [...SMART_LOAN_DIAMOND_BEACON.abi, ...OWNERSHIP_FACET.abi, ...DIAMOND_CUT_FACET.abi], provider.getSigner()) as SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet;
            smartLoansFactory = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner()) as SmartLoansFactory;
            wavaxPool = new ethers.Contract(WAVAX_POOL_TUP.address, WAVAX_POOL.abi, provider.getSigner()) as Pool;
            usdcPool = new ethers.Contract(USDC_POOL_TUP.address, USDC_POOL.abi, provider.getSigner()) as Pool;
            tokenManager = new ethers.Contract(TOKEN_MANAGER_TUP.address, TOKEN_MANAGER.abi, provider.getSigner()) as TokenManager;
        });

        before("setup wallets", async () => {
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0xbAc44698844f13cF0AF423b19040659b688ef036"],
            });

            MAINNET_DEPLOYER = await ethers.provider.getSigner('0xbAc44698844f13cF0AF423b19040659b688ef036');

            [, USER_1, USER_2, USER_3, USER_4, USER_5, USER_6, USER_7] = await getFixedGasSigners(10000000);

            await sendWavax(100, [USER_1, USER_2, USER_3, USER_4, USER_5]);
            await sendUsdc(100, [USER_1, USER_2, USER_3, USER_4, USER_5]);

            await sendWavax(2000, [USER_6, USER_7]);
            await sendUsdc(2000, [USER_6, USER_7]);

        });

        async function sendWavax(amount: Number, users: SignerWithAddress[]) {
            const decimals = await wavaxTokenContract.decimals();
            let amountInWei = parseUnits(amount.toString(), decimals);

            for (let user of users) {
                await wavaxTokenContract.connect(user).deposit({value: amountInWei})
            }
        }

        async function sendUsdc(amountInAVAX: Number, users: SignerWithAddress[]) {
            let amountInWei = parseUnits(amountInAVAX.toString(), await wavaxTokenContract.decimals());

            let router = await ethers.getContractAt("IUniswapV2Router01", traderJoeRouter);

            for (let user of users) {
                await wavaxTokenContract.connect(user).deposit({value: amountInWei});
                await wavaxTokenContract.connect(user).approve(router.address, amountInWei);

                await router.connect(user).swapExactTokensForTokens(amountInWei, 0, [wavaxTokenContract.address, usdcTokenContract.address], user.address, 1880333856);
            }
        }

        async function wrapLoan(loan: any) {
            // @ts-ignore
            return WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "USDT", "BTC", "PNG", "QI", "sAVAX", "YY_AAVE_AVAX"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                CACHE_LAYER_URLS.urls
            ) as SmartLoanGigaChadInterface;
        }

        it('Should deposit funds to the lending pools', async () => {
            console.log('Deposit AVAX')
            // WAVAX
            let initialWavaxPoolBalance = fromWei(await wavaxPool.totalSupply());

            await wavaxTokenContract.connect(USER_6).approve(wavaxPool.address, toWei("2000"));
            await wavaxPool.connect(USER_6).deposit(toWei("2000"));

            let resultWavaxPoolBalance = fromWei(await wavaxPool.totalSupply());
            expect(resultWavaxPoolBalance - initialWavaxPoolBalance).to.be.closeTo(2000, 1e-6);
            console.log(`AVAX pool balance: ${resultWavaxPoolBalance}`)

            console.log('Deposit USDC')
            // USDC
            let initialUsdcPoolBalance = formatUnits(await usdcPool.totalSupply(), await usdcTokenContract.decimals());

            await usdcTokenContract.connect(USER_6).approve(usdcPool.address, parseUnits("2000", await usdcTokenContract.decimals()));
            await usdcPool.connect(USER_6).deposit(parseUnits("2000", await usdcTokenContract.decimals()));

            let resultUsdcPoolBalance = formatUnits(await usdcPool.totalSupply(), await usdcTokenContract.decimals());
            expect(resultUsdcPoolBalance - initialUsdcPoolBalance).to.be.closeTo(2000, 1e-6);
            console.log(`USDC pool balance: ${resultUsdcPoolBalance}`)
        });

        it('Should create loans for USERS 1 through 5', async () => {
            const loansBeforeCreate = await smartLoansFactory.getAllLoans();

            for (const user of [USER_1, USER_2, USER_3, USER_4, USER_5]) {
                await smartLoansFactory.connect(user).createLoan();
            }

            const loansAfterCreate = await smartLoansFactory.getAllLoans();

            expect(loansAfterCreate.length - loansBeforeCreate.length).to.be.equal(5);
            console.log('Created 5 loans');

            loan1 = await wrapLoan(new ethers.Contract(await smartLoansFactory.getLoanForOwner(USER_1.address), SMART_LOAN_GIGACHAD_INTERFACE.abi, USER_1) as SmartLoanGigaChadInterface);
            loan2 = await wrapLoan(new ethers.Contract(await smartLoansFactory.getLoanForOwner(USER_2.address), SMART_LOAN_GIGACHAD_INTERFACE.abi, USER_2) as SmartLoanGigaChadInterface);
            loan3 = await wrapLoan(new ethers.Contract(await smartLoansFactory.getLoanForOwner(USER_3.address), SMART_LOAN_GIGACHAD_INTERFACE.abi, USER_3) as SmartLoanGigaChadInterface);
            loan4 = await wrapLoan(new ethers.Contract(await smartLoansFactory.getLoanForOwner(USER_4.address), SMART_LOAN_GIGACHAD_INTERFACE.abi, USER_4) as SmartLoanGigaChadInterface);
            loan5 = await wrapLoan(new ethers.Contract(await smartLoansFactory.getLoanForOwner(USER_5.address), SMART_LOAN_GIGACHAD_INTERFACE.abi, USER_5) as SmartLoanGigaChadInterface);
            console.log('Fetched and wrapped 5 loans')
        });

        it('Should deposit collaterals as USERS 1 through 5', async () => {
            const usdcDecimals = await usdcTokenContract.decimals();
            for (const depositConfig of [
                {depositAmountInAVAX: "100", depositAmountInUSDC: "100", user: USER_1, loan: loan1},
                {depositAmountInAVAX: "100", depositAmountInUSDC: "0", user: USER_2, loan: loan2},
                {depositAmountInAVAX: "0", depositAmountInUSDC: "100", user: USER_3, loan: loan3},
                {depositAmountInAVAX: "60", depositAmountInUSDC: "40", user: USER_4, loan: loan4},
                {depositAmountInAVAX: "90", depositAmountInUSDC: "10", user: USER_5, loan: loan5}
            ]) {
                await wavaxTokenContract.connect(depositConfig.user).approve(depositConfig.loan.address, toWei(depositConfig.depositAmountInAVAX));
                await depositConfig.loan.connect(depositConfig.user).fund(toBytes32("AVAX"), toWei(depositConfig.depositAmountInAVAX));

                await usdcTokenContract.connect(depositConfig.user).approve(depositConfig.loan.address, parseUnits(depositConfig.depositAmountInUSDC, usdcDecimals));
                await depositConfig.loan.connect(depositConfig.user).fund(toBytes32("USDC"), parseUnits(depositConfig.depositAmountInUSDC, usdcDecimals));

                expect(await wavaxTokenContract.balanceOf(depositConfig.loan.address)).to.be.equal(toWei(depositConfig.depositAmountInAVAX));
                expect(await usdcTokenContract.balanceOf(depositConfig.loan.address)).to.be.equal(parseUnits(depositConfig.depositAmountInUSDC, usdcDecimals));
            }
        });

        it('Should borrow as USERS 1 through 5', async () => {
            const usdcDecimals = await usdcTokenContract.decimals();
            for (const depositConfig of [
                {borrowAmountInAVAX: 300, borrowAmountInUSDC: 300, user: USER_1, loan: loan1},
                {borrowAmountInAVAX: 300, borrowAmountInUSDC: 100, user: USER_2, loan: loan2},
                {borrowAmountInAVAX: 5, borrowAmountInUSDC: 300, user: USER_3, loan: loan3},
                {borrowAmountInAVAX: 180, borrowAmountInUSDC: 120, user: USER_4, loan: loan4},
                {borrowAmountInAVAX: 270, borrowAmountInUSDC: 30, user: USER_5, loan: loan5}
            ]) {
                // Solvency assertions
                let initialHR = await depositConfig.loan.getHealthRatio();
                expect(await depositConfig.loan.isSolvent()).to.be.true;

                // Borrow AVAX & USDC
                await depositConfig.loan.borrow(toBytes32("AVAX"), toWei(depositConfig.borrowAmountInAVAX.toString()));
                await depositConfig.loan.borrow(toBytes32("USDC"), parseUnits(depositConfig.borrowAmountInUSDC.toString(), usdcDecimals));

                // Assert debts amounts
                let debts = await depositConfig.loan.getDebts();
                expect(fromBytes32(debts[0][0])).to.be.equal("AVAX")
                expect(fromWei(debts[0][1])).to.be.closeTo(depositConfig.borrowAmountInAVAX, 1e-6);

                expect(fromBytes32(debts[1][0])).to.be.equal("USDC")
                expect(formatUnits(debts[1][1], usdcDecimals)).to.be.closeTo(depositConfig.borrowAmountInUSDC, 1e-6);

                // Solvency assertions
                expect(await depositConfig.loan.isSolvent()).to.be.true;
                expect(await depositConfig.loan.getHealthRatio()).to.be.lt(initialHR);
            }
        });

        it('Should update protocol to allow withdrawals without any solvency checks', async () => {
            // Deploy AssetsOperationsMock
            let assetsOperationsMockFactory = await ethers.getContractFactory("AssetsOperationsMock");
            let assetsOperationsMockFacet = (await assetsOperationsMockFactory.deploy()).connect(MAINNET_DEPLOYER) as AssetsOperationsMock;

            // Prepare diamondCut and diamondLoupe
            let diamondCut = await ethers.getContractAt("IDiamondCut", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);
            let diamondLoupe = await ethers.getContractAt("IDiamondLoupe", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);

            // Pause
            await diamondCut.pause();
            // Prepare replace diamondCut
            let cut = [{
                facetAddress: assetsOperationsMockFacet.address,
                action: FacetCutAction.Replace,
                functionSelectors: ["0x040cf020"]  // 0x040cf020 == withdraw(bytes32 _withdrawnAsset, uint256 _amount)
            }]
            // Perform diamondCut replace
            await diamondCut.diamondCut(cut, ethers.constants.AddressZero, []);
            // Unpause
            await diamondCut.unpause();

            // Verify successful replacement of the withdraw() method
            expect(await diamondLoupe.facetAddress("0x040cf020")).to.be.equal(assetsOperationsMockFacet.address);
        });

        it('Should withdraw part of funds making the loans insolvent', async () => {
            const usdcDecimals = await usdcTokenContract.decimals();
            for (const depositConfig of [
                {withdrawAmountInAVAX: "50", withdrawAmountInUSDC: "100", user: USER_1, loan: loan1},
                {withdrawAmountInAVAX: "60", withdrawAmountInUSDC: "0", user: USER_2, loan: loan2},
                {withdrawAmountInAVAX: "1", withdrawAmountInUSDC: "70", user: USER_3, loan: loan3},
                {withdrawAmountInAVAX: "30", withdrawAmountInUSDC: "90", user: USER_4, loan: loan4},
                {withdrawAmountInAVAX: "90", withdrawAmountInUSDC: "22", user: USER_5, loan: loan5}
            ]) {
                expect(await depositConfig.loan.isSolvent()).to.be.true;

                await depositConfig.loan.connect(depositConfig.user).withdraw(toBytes32("AVAX"), toWei(depositConfig.withdrawAmountInAVAX));
                await depositConfig.loan.connect(depositConfig.user).withdraw(toBytes32("USDC"), parseUnits(depositConfig.withdrawAmountInUSDC, usdcDecimals));

                console.log(`Loan: ${depositConfig.loan.address} HR: ${fromWei(await depositConfig.loan.getHealthRatio())}`);
                expect(await depositConfig.loan.isSolvent()).to.be.false;
            }
        });

        it('Should update protocol to use the default withdraw method implementation', async () => {
            // Deploy AssetsOperationsFacet
            let assetsOperationsFactory = await ethers.getContractFactory("AssetsOperationsFacet");
            let assetsOperationsFacet = (await assetsOperationsFactory.deploy()).connect(MAINNET_DEPLOYER) as AssetsOperationsFacet;

            // Prepare diamondCut and diamondLoupe
            let diamondCut = await ethers.getContractAt("IDiamondCut", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);
            let diamondLoupe = await ethers.getContractAt("IDiamondLoupe", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);

            // Pause
            await diamondCut.pause();
            // Prepare replace diamondCut
            let cut = [{
                facetAddress: assetsOperationsFacet.address,
                action: FacetCutAction.Replace,
                functionSelectors: ["0x040cf020"]  // 0x040cf020 == withdraw(bytes32 _withdrawnAsset, uint256 _amount)
            }]
            // Perform diamondCut replace
            await diamondCut.diamondCut(cut, ethers.constants.AddressZero, []);
            // Unpause
            await diamondCut.unpause();

            // Verify successful replacement of the withdraw() method
            expect(await diamondLoupe.facetAddress("0x040cf020")).to.be.equal(assetsOperationsFacet.address);
        });

        xit('Should deploy SmartLoanLiquidationFacetDebug', async () => {
            // Deploy SmartLoanLiquidationFacetDebug contract
            const LiquidationFacetDebugFactory = await ethers.getContractFactory('SmartLoanLiquidationFacetDebug');

            let LiquidationFacetDebug = await LiquidationFacetDebugFactory.deploy() as SmartLoanLiquidationFacetDebug;

            console.log(`Deployed SmartLoanLiquidationFacetDebug at: ${LiquidationFacetDebug.address}`);

            // Prepare diamondCut and diamondLoupe
            let diamondCut = await ethers.getContractAt("IDiamondCut", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);

            // Pause
            await diamondCut.pause();
            // Prepare replace diamondCut
            let cut = [{
                facetAddress: LiquidationFacetDebug.address,
                action: FacetCutAction.Replace,
                functionSelectors: ["0x38df9add", "0xe799d994"]  // 0x38df9add == liquidateLoan(bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonusPercent) ; 0xe799d994 == unsafeLiquidateLoan(bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonusPercent)
            }]
            // Perform diamondCut replace
            await diamondCut.diamondCut(cut, ethers.constants.AddressZero, []);
            // Unpause
            await diamondCut.unpause();
        });
    });
});