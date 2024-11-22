import {ethers, network, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {BigNumber, Contract} from "ethers";
import Web3 from 'web3';

const web3 = new Web3();
import {
    Pool,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    MockVariableUtilisationRatesCalculator,
    IUniswapV2Router01,
    WrappedNativeTokenPool, SmartLoanDiamondBeacon, OwnershipFacet, DiamondCutFacet, TokenManager, IERC20
} from "../../typechain";
import SMART_LOAN_DIAMOND_BEACON from '../../deployments/avalanche/SmartLoanDiamondBeacon.json';
import OWNERSHIP_FACET from '../../deployments/avalanche/OwnershipFacet.json';
import DIAMOND_CUT_FACET from '../../deployments/avalanche/DiamondCutFacet.json';
import SMART_LOAN_FACTORY_TUP from '../../deployments/avalanche/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '../../deployments/avalanche/SmartLoansFactory.json';
import SMART_LOAN_GIGACHAD_INTERFACE from '../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import WAVAX_POOL_TUP from '../../deployments/avalanche/WavaxPoolTUP.json';
import USDC_POOL_TUP from '../../deployments/avalanche/UsdcPoolTUP.json';
import WAVAX_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import USDC_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import WRAPPED_POOL from '../../artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import RATES_CALCULATOR from '../../deployments/avalanche/MockVariableUtilisationRatesCalculator.json';
import TOKEN_MANAGER_TUP from '../../deployments/avalanche/TokenManagerTUP.json';
import TOKEN_MANAGER from '../../deployments/avalanche/TokenManager.json';
import {
    asset,
    Asset,
    erc20ABI,
    formatUnits, fromBytes32,
    fromWei,
    getFixedGasSigners, pool,
    syncTime,
    toBytes32,
    toWei,
    wavaxAbi,
    ZERO
} from "../_helpers";
import {pangolinAssets} from "../../common/addresses/avax/pangolin_supported_assets";
import {traderJoeAssets} from "../../common/addresses/avax/traderjoe_supported_assets";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JsonRpcSigner} from "@ethersproject/providers";
import VariableUtilisationRatesCalculatorArtifact
    from "../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json";
import {parseUnits} from "ethers/lib/utils";
import web3Abi from "web3-eth-abi";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {supportedAssetsAvax} from '../../common/addresses/avax/avalanche_supported_assets';
import addresses from "../../common/addresses/avax/token_addresses.json";
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const randomContractAddress = '0xF8d1b34651f2c9230beB9b83B2260529769FDeA4';
const traderJoeRouter = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

chai.use(solidity);

const {deployContract, provider} = waffle;

const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

//TODO: create a report

describe('Test deployed contracts on Avalanche', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe(`Run tests`, () => {
        let smartLoansFactory: SmartLoansFactory,
            smartLoansDiamondBeacon: SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet,
            loan1: SmartLoanGigaChadInterface,
            loan2: SmartLoanGigaChadInterface,
            loan3: SmartLoanGigaChadInterface,
            loan4: SmartLoanGigaChadInterface,
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
            await sendUsdc(100, [ USER_1, USER_2, USER_3, USER_4, USER_5]);

        });

        it('Pools', async () => {
            //administrative functions
            await poolAdministrativeFunctionsTests(wavaxPool, MAINNET_DEPLOYER, USER_1);
            await poolAdministrativeFunctionsTests(usdcPool, MAINNET_DEPLOYER, USER_1);

            //administrative functions
            await poolActionsTests(wavaxPool, wavaxTokenContract, USER_1, USER_2);
            await poolActionsTests(usdcPool, usdcTokenContract, USER_1, USER_2);

            //ERC20 functions
            await erc20PoolActionsTests(wavaxPool, wavaxTokenContract, USER_1, USER_2);
            await erc20PoolActionsTests(usdcPool, usdcTokenContract, USER_1, USER_2);
        });


        it('SmartLoansFactory', async () => {
            //administrative functions

            //initialize
            await expect(smartLoansFactory.connect(MAINNET_DEPLOYER).initialize(randomContractAddress)).to.be.revertedWith('Initializable: contract is already initialized')
            await expect(smartLoansFactory.connect(USER_1).initialize(randomContractAddress)).to.be.revertedWith('Initializable: contract is already initialized')

            //createLoan
            let loansBeforeCreate = await smartLoansFactory.getAllLoans();

            await smartLoansFactory.connect(USER_1).createLoan();

            let loansAfterCreate = await smartLoansFactory.getAllLoans();
            let newLoan = await smartLoansFactory.getLoanForOwner(USER_1.address);

            loan1 = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;

            expect(loansAfterCreate.length).to.be.equal(loansBeforeCreate.length + 1);
            expect(newLoan).be.equal(loansAfterCreate[loansAfterCreate.length - 1]);
            expect(await smartLoansFactory.getOwnerOfLoan(newLoan)).be.equal(USER_1.address);

            await expect(smartLoansFactory.connect(USER_1).createLoan()).to.be.revertedWith('Only one loan per owner is allowed');
            await expect(smartLoansFactory.connect(USER_1).createAndFundLoan(
                toBytes32('USDC'), parseUnits('1', await usdcTokenContract.decimals()))
            ).to.be.revertedWith('Only one loan per owner is allowed');

            await usdcTokenContract.connect(USER_2).approve(smartLoansFactory.address, parseUnits('1', await usdcTokenContract.decimals()));
            await wavaxTokenContract.connect(USER_2).approve(smartLoansFactory.address, parseUnits('1', await wavaxTokenContract.decimals()));

            loansBeforeCreate = await smartLoansFactory.getAllLoans();

            await usdcTokenContract.connect(USER_2).approve(smartLoansFactory.address, parseUnits('1', await usdcTokenContract.decimals()));

            await smartLoansFactory.connect(USER_2).createAndFundLoan(
                toBytes32('USDC'), parseUnits('1', await usdcTokenContract.decimals()));

            loansAfterCreate = await smartLoansFactory.getAllLoans();
            newLoan = await smartLoansFactory.getLoanForOwner(USER_2.address);

            loan2 = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;

            expect(loansAfterCreate.length).to.be.equal(loansBeforeCreate.length + 1);
            expect(newLoan).be.equal(loansAfterCreate[loansAfterCreate.length - 1]);
            expect(await smartLoansFactory.getOwnerOfLoan(newLoan)).be.equal(USER_2.address);

            await expect(smartLoansFactory.connect(USER_1).changeOwnership(randomContractAddress)).to.be.revertedWith('Only a SmartLoan can change it\'s owner');

            await expect(smartLoansFactory.connect(USER_2).changeOwnership(randomContractAddress)).to.be.revertedWith('Only a SmartLoan can change it\'s owner');
        });

        it('SmartLoansDiamondBeacon', async () => {
            expect(await smartLoansDiamondBeacon.owner()).to.equal(MAINNET_DEPLOYER._address);

            //proposeBeaconOwnershipTransfer
            await expect(smartLoansDiamondBeacon.connect(USER_1).proposeBeaconOwnershipTransfer(USER_2.address)).to.be.revertedWith('\'DiamondStorageLib: Must be contract owner');

            await smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).proposeBeaconOwnershipTransfer(USER_2.address);

            //acceptBeaconOwnership
            expect(await smartLoansDiamondBeacon.owner()).to.equal(MAINNET_DEPLOYER._address);
            expect(await smartLoansDiamondBeacon.proposedOwner()).to.equal(USER_2.address);

            await expect(smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).acceptBeaconOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');
            await expect(smartLoansDiamondBeacon.connect(USER_1).acceptBeaconOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');

            //USER_2 becomes an owner, MAINNET_DEPLOYER stays pause admin
            await smartLoansDiamondBeacon.connect(USER_2).acceptBeaconOwnership();

            expect(await smartLoansDiamondBeacon.owner()).to.equal(USER_2.address);
            expect(await smartLoansDiamondBeacon.proposedOwner()).to.equal(ZERO);

            //pause
            await expect(smartLoansDiamondBeacon.connect(USER_1).pause()).to.be.revertedWith('Must be contract pauseAdmin');
            await expect(smartLoansDiamondBeacon.connect(USER_2).pause()).to.be.revertedWith('Must be contract pauseAdmin');

            await smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).pause();

            await expect(smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).pause()).to.be.revertedWith('ProtocolUpgrade: paused.');

            await expect(loan1.connect(USER_1).getPercentagePrecision()).to.be.revertedWith('ProtocolUpgrade: paused.');

            //unpause
            await expect(smartLoansDiamondBeacon.connect(USER_1).unpause()).to.be.revertedWith('Must be contract pauseAdmin');
            await expect(smartLoansDiamondBeacon.connect(USER_2).unpause()).to.be.revertedWith('Must be contract pauseAdmin');

            await smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).unpause();

            await loan1.connect(USER_1).getPercentagePrecision();

            //proposeBeaconPauseAdminOwnershipTransfer (USER_3)
            expect(await smartLoansDiamondBeacon.pauseAdmin()).to.equal(MAINNET_DEPLOYER._address);

            await expect(smartLoansDiamondBeacon.connect(USER_1).proposeBeaconPauseAdminOwnershipTransfer(USER_3.address)).to.be.revertedWith('Must be contract pauseAdmin');
            await expect(smartLoansDiamondBeacon.connect(USER_2).proposeBeaconPauseAdminOwnershipTransfer(USER_3.address)).to.be.revertedWith('Must be contract pauseAdmin');

            await smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).proposeBeaconPauseAdminOwnershipTransfer(USER_3.address);

            expect(await smartLoansDiamondBeacon.proposedPauseAdmin()).to.equal(USER_3.address);

            await expect(smartLoansDiamondBeacon.connect(USER_3).pause()).to.be.revertedWith('Must be contract pauseAdmin');

            await expect(smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).acceptBeaconOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');
            await expect(smartLoansDiamondBeacon.connect(USER_2).acceptBeaconOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');

            //USER_2 stays an owner, USER_3 becomes a pause admin
            await smartLoansDiamondBeacon.connect(USER_3).acceptBeaconPauseAdminOwnership();

            expect(await smartLoansDiamondBeacon.pauseAdmin()).to.equal(USER_3.address);

            await expect(smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).pause()).to.be.revertedWith('Must be contract pauseAdmin');

            await smartLoansDiamondBeacon.connect(USER_3).pause();
            await smartLoansDiamondBeacon.connect(USER_3).unpause();

            //setPausedMethodExemptions (available for owner, not for admin)

            const methodId = web3.utils.keccak256('getPercentagePrecision()').substr(0, 10);

            await expect(smartLoansDiamondBeacon.connect(USER_3).setPausedMethodExemptions([methodId], [true])).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

            await smartLoansDiamondBeacon.connect(USER_3).pause();
            await expect(loan1.connect(USER_1).getPercentagePrecision()).to.be.revertedWith('ProtocolUpgrade: paused.');

            await smartLoansDiamondBeacon.connect(USER_2).setPausedMethodExemptions([methodId], [true]);

            await loan1.connect(USER_1).getPercentagePrecision();

            await smartLoansDiamondBeacon.connect(USER_3).unpause();
        });



    it('SmartLoan', async () => {
        //Ownership

        //proposeOwnershipTransfer
        expect(await loan1.owner()).to.equal(USER_1.address);
        expect(await loan1.proposedOwner()).to.equal(ZERO);

        await expect(loan1.connect(USER_2).proposeOwnershipTransfer(USER_3.address)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        await loan1.connect(USER_1).proposeOwnershipTransfer(USER_3.address);

        expect(await loan1.owner()).to.equal(USER_1.address);
        expect(await loan1.proposedOwner()).to.equal(USER_3.address);

        await expect(loan1.connect(USER_3).proposeOwnershipTransfer(USER_2.address)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        //acceptOwnership
        await expect(loan1.connect(USER_2).acceptOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');

        await loan1.connect(USER_3).acceptOwnership();

        expect(await loan1.owner()).to.equal(USER_3.address);
        expect(await loan1.proposedOwner()).to.equal(ZERO);

        //go back to LOAN_1 -> USER_1
        await loan1.connect(USER_3).proposeOwnershipTransfer(USER_1.address);
        await loan1.connect(USER_1).acceptOwnership();


        const usdcDecimals = await usdcTokenContract.decimals();

        let wrappedLoan1User1 = wrapContract(loan1, USER_1);
        let wrappedLoan1User2 = wrapContract(loan1, USER_2);

        //AssetsOperations

        //fund
        let fundedAmount = 1;
        let amountInWei = parseUnits(fundedAmount.toString(), usdcDecimals);

        let loanBalanceBeforeFund = formatUnits(await usdcTokenContract.connect(USER_1).balanceOf(loan1.address), usdcDecimals);

        await usdcTokenContract.connect(USER_1).approve(loan1.address, amountInWei);
        await usdcTokenContract.connect(USER_2).approve(loan1.address, amountInWei);


        expect(fromWei(await wrappedLoan1User1.getTotalValue())).to.be.equal(0);

        await loan1.connect(USER_1).fund(toBytes32('USDC'), amountInWei);
        let loanBalanceAfterFirstFund = formatUnits(await usdcTokenContract.connect(USER_1).balanceOf(loan1.address), usdcDecimals);
        expect(loanBalanceAfterFirstFund - loanBalanceBeforeFund).to.be.equal(fundedAmount);

        await loan1.connect(USER_2).fund(toBytes32('USDC'), amountInWei);
        let loanBalanceAfterSecondFund = formatUnits(await usdcTokenContract.connect(USER_1).balanceOf(loan1.address), usdcDecimals);
        expect(loanBalanceAfterSecondFund - loanBalanceAfterFirstFund).to.be.equal(fundedAmount);

        //withdraw
        let withdrawAmount = .5;
        amountInWei = parseUnits(withdrawAmount.toString(), usdcDecimals);

        //should revert without price feed
        await expect(loan1.connect(USER_1).unwrapAndWithdraw(amountInWei)).to.be.reverted;
        //TODO:
        // await expect(loan1.connect(USER_1).withdraw(toBytes32('USDC'), amountInWei)).to.be.revertedWith('CalldataMustHaveValidPayload()');

        await wrappedLoan1User1.withdraw(toBytes32('USDC'), amountInWei);

        let loanBalanceAfterWithdraw = formatUnits(await usdcTokenContract.connect(USER_1).balanceOf(loan1.address), usdcDecimals);

        expect(loanBalanceAfterSecondFund - loanBalanceAfterWithdraw).to.be.equal(withdrawAmount);

        await expect(wrappedLoan1User2.withdraw(toBytes32('USDC'), amountInWei)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        //borrow (too much)
        let borrowAmount = 20 * fundedAmount;
        amountInWei = parseUnits(borrowAmount.toString(), usdcDecimals);

        await expect(wrappedLoan1User1.borrow(toBytes32('USDC'), amountInWei)).to.be.revertedWith('The action may cause an account to become insolvent');

        //borrow
        borrowAmount = 2 * fundedAmount;
        amountInWei = parseUnits(borrowAmount.toString(), usdcDecimals);

        await expect(wrappedLoan1User2.borrow(toBytes32('USDC'), amountInWei)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        let loanBalanceBeforeBorrow = formatUnits(await usdcTokenContract.balanceOf(loan1.address), usdcDecimals);
        let poolBalanceBeforeBorrow = formatUnits(await usdcTokenContract.balanceOf(usdcPool.address), usdcDecimals);

        await wrappedLoan1User1.borrow(toBytes32('USDC'), amountInWei);

        let loanBalanceAfterBorrow = formatUnits(await usdcTokenContract.balanceOf(loan1.address), usdcDecimals);
        let poolBalanceAfterBorrow = formatUnits(await usdcTokenContract.balanceOf(usdcPool.address), usdcDecimals);

        expect(loanBalanceAfterBorrow - loanBalanceBeforeBorrow).to.be.equal(borrowAmount);
        expect(poolBalanceBeforeBorrow - poolBalanceAfterBorrow).to.be.equal(borrowAmount);

        //repay
        let repayAmount = borrowAmount / 2;
        amountInWei = parseUnits(repayAmount.toString(), usdcDecimals);

        await expect(wrappedLoan1User2.repay(toBytes32('USDC'), amountInWei)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        let loanBalanceBeforeRepay = formatUnits(await usdcTokenContract.balanceOf(loan1.address), usdcDecimals);
        let poolBalanceBeforeRepay = formatUnits(await usdcTokenContract.balanceOf(usdcPool.address), usdcDecimals);

        await wrappedLoan1User1.repay(toBytes32('USDC'), amountInWei);

        let loanBalanceAfterRepay = formatUnits(await usdcTokenContract.balanceOf(loan1.address), usdcDecimals);
        let poolBalanceAfterRepay = formatUnits(await usdcTokenContract.balanceOf(usdcPool.address), usdcDecimals);

        expect(loanBalanceBeforeRepay - loanBalanceAfterRepay).to.be.equal(repayAmount);
        expect(poolBalanceAfterRepay - poolBalanceBeforeRepay).to.be.equal(repayAmount);

        //getBalance
        expect(await loan1.getBalance(toBytes32('USDC'))).to.be.equal(await usdcTokenContract.balanceOf(loan1.address));

        //wrapped native token functions

        let sentAmount = 1;
        amountInWei = toWei(sentAmount.toString());

        await USER_2.sendTransaction({
            to: loan1.address,
            value: amountInWei
        });

        expect(fromWei(await provider.getBalance(loan1.address))).to.be.equal(sentAmount);

        //wrap native token
        let wrappedAmount = sentAmount / 2;
        amountInWei = toWei(wrappedAmount.toString());

        await expect(loan1.connect(USER_2).wrapNativeToken(amountInWei)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        await loan1.connect(USER_1).wrapNativeToken(amountInWei);

        expect(fromWei(await provider.getBalance(loan1.address))).to.be.equal(sentAmount - wrappedAmount);
        expect(fromWei(await wavaxTokenContract.balanceOf(loan1.address))).to.be.equal(wrappedAmount);

        //deposit native token
        let depositedAmount = 1;
        amountInWei = toWei(depositedAmount.toString());

        let balanceBeforeFirstDeposit = fromWei(await wavaxTokenContract.balanceOf(loan1.address));
        await loan1.connect(USER_1).depositNativeToken({ value: amountInWei });
        let balanceAfterFirstDeposit = fromWei(await wavaxTokenContract.balanceOf(loan1.address));
        await loan1.connect(USER_2).depositNativeToken({ value: amountInWei });
        let balanceAfterSecondDeposit = fromWei(await wavaxTokenContract.balanceOf(loan1.address));

        expect(balanceAfterFirstDeposit - balanceBeforeFirstDeposit).to.be.equal(depositedAmount);
        expect(balanceAfterSecondDeposit -balanceAfterFirstDeposit ).to.be.equal(depositedAmount);

        //unwrapAndWithdraw
        let withdrawnAmount = 0.5;
        amountInWei = toWei(withdrawnAmount.toString());

        let loanBalanceBeforeWithdraw = fromWei(await wavaxTokenContract.balanceOf(loan1.address));
        let userBalanceBeforeWithdraw = fromWei(await provider.getBalance(USER_1.address));

        await expect(loan1.connect(USER_2).unwrapAndWithdraw(amountInWei)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        await expect(loan1.connect(USER_1).unwrapAndWithdraw(amountInWei)).to.be.reverted;
        //TODO:
        // await expect(loan1.connect(USER_1).unwrapAndWithdraw(amountInWei)).to.be.revertedWith('CalldataMustHaveValidPayload()');

        await wrappedLoan1User1.unwrapAndWithdraw(amountInWei);

        loanBalanceAfterWithdraw = fromWei(await wavaxTokenContract.balanceOf(loan1.address));
        let userBalanceAfterWithdraw = fromWei(await provider.getBalance(USER_1.address));

        expect(loanBalanceBeforeWithdraw - loanBalanceAfterWithdraw).to.be.equal(withdrawnAmount);
        expect(userBalanceAfterWithdraw - userBalanceBeforeWithdraw).to.be.closeTo(withdrawnAmount, 0.09);

        //test DEXes

        await smartLoansFactory.connect(USER_3).createLoan();

        let newLoan = await smartLoansFactory.getLoanForOwner(USER_3.address);
        loan3 = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;

        //Pangolin
        console.log('Pangolin')
        await testDex(
            'swapPangolin',
            'addLiquidityPangolin',
            'removeLiquidityPangolin',
            loan3,
            pangolinAssets,
            USER_3,
            USER_5
        );

        await smartLoansFactory.connect(USER_4).createLoan();
        newLoan = await smartLoansFactory.getLoanForOwner(USER_4.address);
        loan4 = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;

        //TraderJoe
        console.log('TraderJoe')
        await testDex(
            'swapTraderJoe',
            'addLiquidityTraderJoe',
            'removeLiquidityTraderJoe',
            loan4,
            traderJoeAssets,
            USER_4,
            USER_5
        );


        await smartLoansFactory.connect(USER_6).createLoan();
        newLoan = await smartLoansFactory.getLoanForOwner(USER_6.address);
        loan4 = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;

        console.log('Test Yield Yak vaults');
        await testYieldYak(loan4, USER_6, USER_7, tokenManager);

        console.log('Test Vector vaults');
        await testVector(loan4, USER_6, USER_7);
        });

        it('TokenManager', async () => {
            //asset list
            let allAssets = await tokenManager.getAllTokenAssets();

            for (let asset of allAssets) {
                let address = await tokenManager.getAssetAddress(asset, true);
                console.log(`${fromBytes32(asset)} address: ${address} debtCoverage: ${await tokenManager.debtCoverage(address)}`)
            }

            //ownership
            await expect(tokenManager.connect(MAINNET_DEPLOYER).initialize([],[])).to.be.revertedWith('Initializable: contract is already initialized');


            //add pool assets
            let poolAssets = await tokenManager.getAllPoolAssets();

            await expect(tokenManager.connect(USER_1).addPoolAssets([pool('sAVAX', '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE')])).to.be.revertedWith('Ownable: caller is not the owner');

            await tokenManager.connect(MAINNET_DEPLOYER).addPoolAssets([pool('sAVAX', '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE')]);

            let poolAssetsAfterAdd = await tokenManager.getAllPoolAssets();

            expect(poolAssetsAfterAdd.length).to.be.equal(poolAssets.length + 1);
            expect(poolAssetsAfterAdd.includes(toBytes32('sAVAX'))).to.be.true;

            //remove pool assets

            await expect(tokenManager.connect(USER_1).removePoolAssets([toBytes32('USDC')])).to.be.revertedWith('Ownable: caller is not the owner');

            await tokenManager.connect(MAINNET_DEPLOYER).removePoolAssets([toBytes32('USDC')]);

            let poolAssetsAfterRemove = await tokenManager.getAllPoolAssets();

            expect(poolAssetsAfterRemove.length).to.be.equal(poolAssetsAfterAdd.length - 1);
            expect(poolAssetsAfterRemove.includes(toBytes32('USDC'))).to.be.false;


            // add token assets
            let xavaAddress = '0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4';
            let asset = new Asset(toBytes32('XAVA'), xavaAddress, '0.5');
            await expect(tokenManager.connect(USER_1).addTokenAssets([asset])).to.be.revertedWith('Ownable: caller is not the owner');

            let assetsBeforeAdd = await tokenManager.getAllTokenAssets();

            await tokenManager.connect(MAINNET_DEPLOYER).addTokenAssets([asset]);

            let assetsAfterAdd = await tokenManager.getAllTokenAssets();

            expect(assetsAfterAdd.length).to.be.equal(assetsBeforeAdd.length + 1);
            expect(assetsAfterAdd[assetsAfterAdd.length - 1]).to.be.equal(toBytes32('XAVA'));
            expect(await tokenManager.getAssetAddress(toBytes32('XAVA'), false)).to.be.equal(xavaAddress);
            expect(await tokenManager.getAssetAddress(toBytes32('XAVA'), true)).to.be.equal(xavaAddress);
            expect(fromWei(await tokenManager.debtCoverage(xavaAddress))).to.be.equal(0.5);

            // remove token assets

            await expect(tokenManager.connect(USER_1).removeTokenAssets([toBytes32('USDC')])).to.be.revertedWith('Ownable: caller is not the owner');

            await tokenManager.connect(MAINNET_DEPLOYER).removeTokenAssets([toBytes32('USDC')]);

            let assetsAfterRemove = await tokenManager.getAllTokenAssets();

            expect(assetsAfterRemove.length).to.be.equal(assetsAfterAdd.length - 1);
            expect(assetsAfterRemove.includes(toBytes32('USDC'))).to.be.false;

            // deactivate tokens
            expect(await tokenManager.isTokenAssetActive(TOKEN_ADDRESSES['BTC'])).to.be.true;

            expect(await tokenManager.getAssetAddress(toBytes32('BTC'), false)).to.be.equal(TOKEN_ADDRESSES['BTC']);

            await expect(tokenManager.connect(USER_1).deactivateToken(TOKEN_ADDRESSES['BTC'])).to.be.revertedWith('Ownable: caller is not the owner');

            await tokenManager.connect(MAINNET_DEPLOYER).deactivateToken(TOKEN_ADDRESSES['BTC']);

            expect(await tokenManager.isTokenAssetActive(TOKEN_ADDRESSES['BTC'])).to.be.false;
            await expect(tokenManager.getAssetAddress(toBytes32('BTC'), false)).to.be.revertedWith('Asset inactive');


            // activate tokens
            await expect(tokenManager.connect(USER_1).activateToken(TOKEN_ADDRESSES['BTC'])).to.be.revertedWith('Ownable: caller is not the owner');

            await tokenManager.connect(MAINNET_DEPLOYER).activateToken(TOKEN_ADDRESSES['BTC']);

            expect(await tokenManager.isTokenAssetActive(TOKEN_ADDRESSES['BTC'])).to.be.true;
            expect(await tokenManager.getAssetAddress(toBytes32('BTC'), false)).to.be.equal(TOKEN_ADDRESSES['BTC']);


            // debt coverage
            await expect(tokenManager.connect(USER_1).setDebtCoverage(TOKEN_ADDRESSES['ETH'], toWei('0.4'))).to.be.revertedWith('Ownable: caller is not the owner');

            await tokenManager.connect(MAINNET_DEPLOYER).setDebtCoverage(TOKEN_ADDRESSES['ETH'], toWei('0.4'));

            expect(fromWei(await tokenManager.debtCoverage(TOKEN_ADDRESSES['ETH']))).to.be.equal(0.4);

        });
    });
    // ================================= HELPER FUNCTIONS ===================================================

    async function poolAdministrativeFunctionsTests(pool: Contract, admin: any, badActor: any) {
        //initialize
        await expect(pool.connect(admin).initialize(ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, 0)).to.be.revertedWith('Initializable: contract is already initialized');
        await expect(pool.connect(badActor).initialize(ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, 0)).to.be.revertedWith('Initializable: contract is already initialized');

        //setTotalSupplyCap
        await pool.connect(admin).setTotalSupplyCap(toWei("0.5"));
        expect(await pool.connect(admin).totalSupplyCap()).to.be.equal(toWei("0.5"));

        await expect(pool.connect(badActor).setTotalSupplyCap(toWei("0.4"))).to.be.revertedWith('Ownable: caller is not the owner');
        await pool.connect(admin).setTotalSupplyCap(0);

        //setPoolRewarder
        await pool.connect(admin).setPoolRewarder(randomContractAddress);
        expect(await pool.connect(admin).poolRewarder()).to.be.equal(randomContractAddress);
        await pool.connect(admin).setPoolRewarder(ZERO);

        await expect(pool.connect(badActor).setPoolRewarder(randomContractAddress)).to.be.revertedWith('Ownable: caller is not the owner');

        //setRatesCalculator
        let newCalculator = (await deployContract(admin, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;

        await pool.connect(admin).setRatesCalculator(newCalculator.address);
        expect(await pool.connect(admin).ratesCalculator()).to.be.equal(newCalculator.address);
        await expect(pool.connect(badActor).setRatesCalculator(RATES_CALCULATOR.address)).to.be.revertedWith('Ownable: caller is not the owner');
        await pool.connect(admin).setRatesCalculator(RATES_CALCULATOR.address);

        //setBorrowersRegistry
        await pool.connect(admin).setBorrowersRegistry(randomContractAddress);
        expect(await pool.connect(admin).borrowersRegistry()).to.be.equal(randomContractAddress);
        await pool.connect(admin).setBorrowersRegistry(SMART_LOAN_FACTORY_TUP.address);

        await expect(pool.connect(badActor).setBorrowersRegistry(randomContractAddress)).to.be.revertedWith('Ownable: caller is not the owner');

        //recoverSurplus
        await pool.connect(admin).recoverSurplus(0, admin._address);
        await expect(pool.connect(badActor).recoverSurplus(0, badActor.address)).to.be.revertedWith('Ownable: caller is not the owner');

        //renounceOwnership
        await pool.connect(admin).renounceOwnership();
        await pool.connect(admin).setBorrowersRegistry(SMART_LOAN_FACTORY_TUP.address); //method that requires ownership
    }

    async function poolActionsTests(pool: Contract, tokenContract: Contract, USER_1: any, USER_2: any) {
        const decimals = await tokenContract.decimals();

        //deposit
        let initialPoolBalance = formatUnits(await pool.totalSupply(), decimals);
        let initialUserBalance = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        let initialTokenBalanceOfPool = formatUnits(await tokenContract.balanceOf(pool.address), decimals);

        let depositAmount = 100;
        let amountInWei = parseUnits(depositAmount.toString(), decimals);
        await tokenContract.connect(USER_1).approve(pool.address, amountInWei);

        await pool.connect(USER_1).deposit(amountInWei);

        let balanceAfterDeposit = formatUnits(await pool.totalSupply(), decimals);
        let tokenBalanceOfPoolAfterDeposit = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
        let userBalanceAfterDeposit = formatUnits(await pool.balanceOf(USER_1.address), decimals);

        expect(balanceAfterDeposit - initialPoolBalance).to.be.closeTo(depositAmount, 0.0001);
        expect(tokenBalanceOfPoolAfterDeposit - initialTokenBalanceOfPool).to.be.closeTo(depositAmount, 0.0001);
        expect(userBalanceAfterDeposit - initialUserBalance).to.be.closeTo(depositAmount, 0.0001);

        //withdraw
        let withdrawAmount = depositAmount / 2;
        let withdrawAmountInWei = parseUnits(withdrawAmount.toString(), decimals);

        await pool.connect(USER_1).withdraw(withdrawAmountInWei);

        let balanceAfterWithdraw = formatUnits(await pool.totalSupply(), decimals);
        let tokenBalanceOfPoolAfterWithdraw = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
        let userBalanceAfterWithdraw = formatUnits(await pool.balanceOf(USER_1.address), decimals);

        expect(balanceAfterDeposit - balanceAfterWithdraw).to.be.closeTo(depositAmount - withdrawAmount, 0.0001);
        expect(tokenBalanceOfPoolAfterDeposit - tokenBalanceOfPoolAfterWithdraw).to.be.closeTo(depositAmount - withdrawAmount, 0.0001);
        expect(userBalanceAfterDeposit - userBalanceAfterWithdraw).to.be.closeTo(depositAmount - withdrawAmount, 0.0001);

        //borrow
        let borrowAmount = depositAmount / 10;
        let borrowAmountInWei = parseUnits(borrowAmount.toString(), decimals);
        // await expect(pool.connect(USER_1).borrow(borrowAmountInWei)).to.be.revertedWith('NotAuthorizedToBorrow()');
        await expect(pool.connect(USER_1).borrow(borrowAmountInWei)).to.be.reverted;

        //borrow
        let repayAmount = depositAmount / 10;
        let repayAmountInWei = parseUnits(repayAmount.toString(), decimals);
        await expect(pool.connect(USER_1).repay(repayAmountInWei)).to.be.reverted;

        const isWrappedNativeToken = tokenContract.address === wavaxTokenContract.address;

        let wrappedPool = new ethers.Contract(pool.address, WRAPPED_POOL.abi, provider.getSigner()) as WrappedNativeTokenPool;

        if (isWrappedNativeToken) {
            //deposit native
            let depositAmount = 1;
            let amountInWei = parseUnits(depositAmount.toString(), decimals);

            let poolBalanceBeforeNativeDeposit = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceBeforeNativeDeposit = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolBeforeNativeDeposit = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolBeforeNativeDeposit = formatUnits(await provider.getBalance(pool.address), decimals);

            await wrappedPool.connect(USER_1).depositNativeToken({ value: amountInWei});

            let poolBalanceAfterNativeDeposit = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceAfterNativeDeposit = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolAfterNativeDeposit = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolAfterNativeDeposit = formatUnits(await provider.getBalance(pool.address), decimals);

            expect(poolBalanceAfterNativeDeposit - poolBalanceBeforeNativeDeposit).to.be.closeTo(depositAmount, 0.0001);
            expect(userBalanceAfterNativeDeposit - userBalanceBeforeNativeDeposit).to.be.closeTo(depositAmount, 0.0001);
            expect(tokenBalanceOfPoolAfterNativeDeposit - tokenBalanceOfPoolBeforeNativeDeposit).to.be.closeTo(depositAmount, 0.0001);
            expect(nativeBalanceOfPoolAfterNativeDeposit - nativeBalanceOfPoolBeforeNativeDeposit).to.be.closeTo(0, 0.0001);

            //withdraw native
            //deposit native
            let withdrawAmount = depositAmount / 2;
            amountInWei = parseUnits(withdrawAmount.toString(), decimals);

            let poolBalanceBeforeNativeWithdraw = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceBeforeNativeWithdraw = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolBeforeNativeWithdraw = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolBeforeNativeWithdraw = formatUnits(await provider.getBalance(pool.address), decimals);
            let nativeBalanceOfUserBeforeNativeWithdraw = formatUnits(await provider.getBalance(USER_1.address), decimals);

            await wrappedPool.connect(USER_1).withdrawNativeToken(amountInWei);

            let poolBalanceAfterNativeWithdraw = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceAfterNativeWithdraw = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolAfterNativeWithdraw = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolAfterNativeWithdraw = formatUnits(await provider.getBalance(pool.address), decimals);
            let nativeBalanceOfUserAfterNativeWithdraw = formatUnits(await provider.getBalance(USER_1.address), decimals);

            expect(poolBalanceBeforeNativeWithdraw - poolBalanceAfterNativeWithdraw).to.be.closeTo(withdrawAmount, 0.0001);
            expect(userBalanceBeforeNativeWithdraw - userBalanceAfterNativeWithdraw).to.be.closeTo(withdrawAmount, 0.0001);
            expect(tokenBalanceOfPoolBeforeNativeWithdraw - tokenBalanceOfPoolAfterNativeWithdraw).to.be.closeTo(withdrawAmount, 0.0001);
            expect(nativeBalanceOfPoolBeforeNativeWithdraw - nativeBalanceOfPoolAfterNativeWithdraw).to.be.closeTo(0, 0.001);
            expect(nativeBalanceOfUserAfterNativeWithdraw - nativeBalanceOfUserBeforeNativeWithdraw).to.be.closeTo(withdrawAmount, 0.02);
        } else {
            let depositAmount = 1;
            let amountInWei = parseUnits(depositAmount.toString(), decimals);

            // await expect(wrappedPool.connect(USER_1).depositNativeToken({ value: amountInWei } )).to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function');
            // await expect(wrappedPool.connect(USER_1).withdrawNativeToken(amountInWei)).to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function');

            await expect(wrappedPool.connect(USER_1).depositNativeToken({ value: amountInWei } )).to.be.reverted;
            await expect(wrappedPool.connect(USER_1).withdrawNativeToken(amountInWei)).to.be.reverted;

        }
    }

    async function erc20PoolActionsTests(pool: Contract, tokenContract: Contract, USER_1: any, USER_2: any) {
        const decimals = await tokenContract.decimals();

        //transfer
        let user1BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        let user2BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        let transferredAmount = 0.1;
        let amountInWei = parseUnits(transferredAmount.toString(), decimals);
        await pool.connect(USER_1).transfer(USER_2.address, amountInWei);

        let user1BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        let user2BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        expect(user1BalanceBeforeTransfer - user1BalanceAfterTransfer).to.be.closeTo(transferredAmount, 0.0001);
        expect(user2BalanceAfterTransfer - user2BalanceBeforeTransfer).to.be.closeTo(transferredAmount, 0.0001);

        //increaseAllowance
        let allowedAmount = 0.1;
        amountInWei = parseUnits(allowedAmount.toString(), decimals);

        let user2AllowanceBeforeIncrease = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);

        await pool.connect(USER_1).increaseAllowance(USER_2.address, amountInWei);

        let user2AllowanceAfterIncrease = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);

        expect(user2AllowanceAfterIncrease - user2AllowanceBeforeIncrease).to.be.closeTo(allowedAmount, 0.000001);

        //decreaseAllowance
        let decreasedAmount = 0.05;
        amountInWei = parseUnits(decreasedAmount.toString(), decimals);
        await pool.connect(USER_1).decreaseAllowance(USER_2.address, amountInWei);

        let user2AllowanceAfterDecrease = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);

        expect(user2AllowanceAfterIncrease - user2AllowanceAfterDecrease).to.be.closeTo(decreasedAmount, 0.000001);

        //approve
        let approveAmount = 0.037;
        let approveInWei = parseUnits(approveAmount.toString(), decimals);

        await pool.connect(USER_1).approve(USER_2.address, approveInWei);

        let user2AllowanceAfterApprove = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);
        expect(user2AllowanceAfterApprove).to.be.closeTo(approveAmount, 0.000001);


        //transferFrom (too high)
        let transferAmount = 0.038;
        let transferInWei = parseUnits(transferAmount.toString(), decimals);

        // await expect(pool.connect(USER_2).transferFrom(USER_1.address, randomContractAddress, transferInWei))
        //     .to.be.revertedWith(`InsufficientAllowance(${transferInWei}, ${approveInWei})`);
        await expect(pool.connect(USER_2).transferFrom(USER_1.address, randomContractAddress, transferInWei))
            .to.be.reverted;

        //transferFrom
        transferAmount = 0.068;
        transferInWei = parseUnits(transferAmount.toString(), decimals);

        user1BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        user2BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        await pool.connect(USER_1).transfer(USER_2.address, transferInWei);

        user1BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        user2BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        expect(user1BalanceBeforeTransfer - user1BalanceAfterTransfer).to.be.closeTo(transferAmount, 0.0001);
        expect(user2BalanceAfterTransfer - user2BalanceBeforeTransfer).to.be.closeTo(transferAmount, 0.0001);
    }

    async function sendWavax(amount: Number, users: SignerWithAddress[]) {
        const decimals = await wavaxTokenContract.decimals();
        let amountInWei = parseUnits(amount.toString(), decimals);

        for (let user of users) {
            await wavaxTokenContract.connect(user).deposit({ value: amountInWei })
        }
    }

    async function sendUsdc(amountInAVAX: Number, users: SignerWithAddress[]) {
        let amountInWei = parseUnits(amountInAVAX.toString(), await wavaxTokenContract.decimals());

        let router = await ethers.getContractAt("IUniswapV2Router01", traderJoeRouter);

        for (let user of users) {
            await wavaxTokenContract.connect(user).deposit({ value: amountInWei });
            await wavaxTokenContract.connect(user).approve(router.address, amountInWei);

            await router.connect(user).swapExactTokensForTokens(amountInWei, 0, [wavaxTokenContract.address, usdcTokenContract.address], user.address, 1880333856);
        }
    }

    async function testDex(
        swapMethod: string,
        provideLiquidityMethod: string,
        removeLiquidityMethod: string,
        loan1: SmartLoanGigaChadInterface,
        assets: Asset[],
        USER_1: any,
        USER_2: any
    ) {
        await testSwap(swapMethod, loan1, assets, USER_1, USER_2);

        await testLP(swapMethod, provideLiquidityMethod, removeLiquidityMethod, loan1, assets, USER_1, USER_2);
    }

    async function testSwap(
        swapMethod: string,
        loan1: SmartLoanGigaChadInterface,
        assets: Asset[],
        USER_1: any,
        USER_2: any
    ) {
        assets = assets.filter(a => !fromBytes32(a.asset).includes('_LP'));

        let wavaxDecimals = await wavaxTokenContract.decimals();
        //add token1 (AVAX)
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);
        let wrappedLoan1User2 = wrapContract(loan1, USER_2);

        let depositedAmount = 20;
        let amountInWei = parseUnits(depositedAmount.toString(), wavaxDecimals);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});

        expect((await loan1.getAllOwnedAssets()).length).to.equal(1);
        expect((await loan1.getAllOwnedAssets())[0]).to.equal(toBytes32('AVAX'));

        //non-owner trying to swap
        await expect(wrappedLoan1User2[swapMethod](
            assets[0].asset,
            assets[1].asset,
            wrappedLoan1User1.getBalance(assets[0].asset),
            0
        )).to.be.revertedWith('DiamondStorageLib: Must be contract owner')


        for (let i = 0; i < assets.length - 1; i++) {
            let TWVbefore = fromWei(await wrappedLoan1User2.getThresholdWeightedValue());
            //swap all token (i) to token (i+1)
            await wrappedLoan1User1[swapMethod](
                assets[i].asset,
                assets[i+1].asset,
                await wrappedLoan1User1.getBalance(assets[i].asset),
                0
            );

            let TWVafter = fromWei(await wrappedLoan1User2.getThresholdWeightedValue());

            expect((await loan1.getAllOwnedAssets()).length).to.equal(1);
            expect((await loan1.getAllOwnedAssets())[0]).to.equal(assets[i+1].asset);

            function twvInfo() {
                return `Change of TWV ${fromBytes32(assets[i].asset)} to ${fromBytes32(assets[i+1].asset)}: ${(Math.abs(TWVafter - TWVbefore)/TWVbefore * 100).toFixed(2)}%`;
            }

            if (assets[i+1].debtCoverage > assets[i].debtCoverage) {
                expect(TWVafter).to.be.gt(TWVbefore);
                console.log(twvInfo())
            } else if (assets[i+1].debtCoverage < assets[i].debtCoverage) {
                //that might fail if debt coverages are close and the trade slippage decreases TWVafter
                expect(TWVafter).to.be.lt(TWVbefore);
                console.log(twvInfo())
            } else {
                console.log(twvInfo())
            }
            console.log('TWV: ', TWVafter);
        }

        //swap back to AVAX
        await wrappedLoan1User1[swapMethod](
            assets[assets.length - 1].asset,
            assets[0].asset,
            await wrappedLoan1User1.getBalance(assets[assets.length - 1].asset),
            0
        );
    }

    async function testLP(
        swapMethod: string,
        provideLiquidityMethod: string,
        removeLiquidityMethod: string,
        loan1: SmartLoanGigaChadInterface,
        assets: Asset[],
        USER_1: any,
        USER_2: any
    ) {
        let depositedAmount = 20;
        let amountInWei = parseUnits(depositedAmount.toString(), 18);
        await loan1.depositNativeToken({ value: amountInWei});

        let lpAssets = assets.filter(a => fromBytes32(a.asset).includes('_LP'));

        let wrappedLoan1User1 = wrapContract(loan1, USER_1);
        let wrappedLoan1User2 = wrapContract(loan1, USER_2);

        //initial check if the loan contains only AVAX
        expect((await loan1.getAllOwnedAssets()).length).to.equal(1);
        expect((await loan1.getAllOwnedAssets())[0]).to.equal(assets[0].asset);


        for (let lp of lpAssets) {
            let [, firstAsset, secondAsset,] = fromBytes32(lp.asset).split('_');
            //get first asset
            let avaxBalance = await loan1.getBalance(assets[0].asset);

            if (toBytes32(firstAsset) != assets[0].asset) {
                await wrappedLoan1User1[swapMethod](assets[0].asset, toBytes32(firstAsset), avaxBalance.div(2).sub(1), 0);
            }

            if (toBytes32(secondAsset) != assets[0].asset) {
                await wrappedLoan1User1[swapMethod](assets[0].asset, toBytes32(secondAsset), avaxBalance.div(2).sub(1), 0);
            }

            let firstBalance = await loan1.getBalance(toBytes32(firstAsset));
            let secondBalance = await loan1.getBalance(toBytes32(secondAsset));

            //add LP position
            expect(await loan1.getBalance(lp.asset)).to.be.equal(0);

            let TWV1 = fromWei(await wrappedLoan1User1.getThresholdWeightedValue());

            await expect(wrappedLoan1User2[provideLiquidityMethod](toBytes32(firstAsset), toBytes32(secondAsset), firstBalance, secondBalance, 1, 1)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

            await wrappedLoan1User1[provideLiquidityMethod](toBytes32(firstAsset), toBytes32(secondAsset), firstBalance, secondBalance, 1, 1);

            let TWV2 = fromWei(await wrappedLoan1User1.getThresholdWeightedValue());

            console.log(twvInfo('providing', TWV1, TWV2))
            expect(await loan1.getBalance(lp.asset)).to.be.gt(0);
            let ownedAssetsAfterProvide = await loan1.getAllOwnedAssets();

            expect(ownedAssetsAfterProvide[ownedAssetsAfterProvide.length - 1]).to.be.equal(lp.asset);


            //remove LP position
            await expect(wrappedLoan1User2[removeLiquidityMethod](toBytes32(firstAsset), toBytes32(secondAsset), await loan1.getBalance(lp.asset), 1, 1)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');
            await wrappedLoan1User1[removeLiquidityMethod](toBytes32(firstAsset), toBytes32(secondAsset), await loan1.getBalance(lp.asset), 1, 1);

            let ownedAssetsAfterRemove = await loan1.getAllOwnedAssets();

            expect(ownedAssetsAfterRemove.includes(lp.asset)).to.be.false;

            let TWV3 = fromWei(await wrappedLoan1User1.getThresholdWeightedValue());

            console.log(twvInfo('removing', TWV2, TWV3))


            function twvInfo(action: string, TWVbefore: number, TWVafter: number) {
                return `Change of TWV ${fromBytes32(lp.asset)} after ${action} liquidity: ${(Math.abs(TWVafter - TWVbefore)/TWVbefore * 100).toFixed(2)}%,  newTWV: ${TWVafter}`;
            }
        }
    }

    async function testYieldYak(
        loan1: SmartLoanGigaChadInterface,
        USER_1: any,
        USER_2: any,
        tokenManager: TokenManager
    ) {
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);

        //AVAX
        let avaxAmount = 20;
        let amountInWei = parseUnits(avaxAmount.toString(), 18);
        await loan1.depositNativeToken({ value: amountInWei});

        let vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_AAVE_AVAX'), true);

        await testVault('stakeAVAXYak', 'unstakeAVAXYak', 'AVAX', amountInWei,'YY_AAVE_AVAX', vaultAddress, null, loan1, USER_1, USER_2, false);


        //sAVAX
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('sAVAX'), amountInWei, 0);

        vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_PTP_sAVAX'), true);

        await testVault('stakeSAVAXYak', 'unstakeSAVAXYak', 'sAVAX', await loan1.getBalance(toBytes32('sAVAX')), 'YY_PTP_sAVAX', vaultAddress, null, loan1, USER_1, USER_2, false);

        //YY_PNG_AVAX_USDC_LP
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('USDC'), amountInWei.div(2), 0);
        await wrappedLoan1User1.addLiquidityPangolin(
            toBytes32('AVAX'),
            toBytes32('USDC'),
            await loan1.getBalance(toBytes32('AVAX')),
            await loan1.getBalance(toBytes32('USDC')),
            1,
            1
        );

        vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_PNG_AVAX_USDC_LP'), true);

        await testVault('stakePNGAVAXUSDCYak', 'unstakePNGAVAXUSDCYak', 'PNG_AVAX_USDC_LP', await loan1.getBalance(toBytes32('PNG_AVAX_USDC_LP')),'YY_PNG_AVAX_USDC_LP', vaultAddress, null, loan1, USER_1, USER_2, false);

        //YY_PNG_AVAX_ETH_LP
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('ETH'), amountInWei.div(2), 0);
        await wrappedLoan1User1.addLiquidityPangolin(
            toBytes32('AVAX'),
            toBytes32('ETH'),
            await loan1.getBalance(toBytes32('AVAX')),
            await loan1.getBalance(toBytes32('ETH')),
            1,
            1
        );

        vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_PNG_AVAX_ETH_LP'), true);

        await testVault('stakePNGAVAXETHYak', 'unstakePNGAVAXETHYak', 'PNG_AVAX_ETH_LP', await loan1.getBalance(toBytes32('PNG_AVAX_ETH_LP')),'YY_PNG_AVAX_ETH_LP', vaultAddress, null,  loan1, USER_1, USER_2, false);

        //YY_TJ_AVAX_USDC_LP
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('USDC'), amountInWei.div(2), 0);
        await wrappedLoan1User1.addLiquidityTraderJoe(
            toBytes32('AVAX'),
            toBytes32('USDC'),
            await loan1.getBalance(toBytes32('AVAX')),
            await loan1.getBalance(toBytes32('USDC')),
            1,
            1
        );

        vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_TJ_AVAX_USDC_LP'), true);

        await testVault('stakeTJAVAXUSDCYak', 'unstakeTJAVAXUSDCYak', 'TJ_AVAX_USDC_LP', await loan1.getBalance(toBytes32('TJ_AVAX_USDC_LP')),'YY_TJ_AVAX_USDC_LP', vaultAddress, null, loan1, USER_1, USER_2, false);

        //YY_TJ_AVAX_ETH_LP
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('ETH'), amountInWei.div(2), 0);
        await wrappedLoan1User1.addLiquidityTraderJoe(
            toBytes32('AVAX'),
            toBytes32('ETH'),
            await loan1.getBalance(toBytes32('AVAX')),
            await loan1.getBalance(toBytes32('ETH')),
            1,
            1
        );

        vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_TJ_AVAX_ETH_LP'), true);

        await testVault('stakeTJAVAXETHYak', 'unstakeTJAVAXETHYak', 'TJ_AVAX_ETH_LP', await loan1.getBalance(toBytes32('TJ_AVAX_ETH_LP')),'YY_TJ_AVAX_ETH_LP', vaultAddress, null, loan1, USER_1, USER_2, false);

        //YY_TJ_AVAX_sAVAX_LP
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('sAVAX'), amountInWei.div(2), 0);
        await wrappedLoan1User1.addLiquidityTraderJoe(
            toBytes32('AVAX'),
            toBytes32('sAVAX'),
            await loan1.getBalance(toBytes32('AVAX')),
            await loan1.getBalance(toBytes32('sAVAX')),
            1,
            1
        );

        vaultAddress = await tokenManager.getAssetAddress(toBytes32('YY_TJ_AVAX_sAVAX_LP'), true);

        await testVault('stakeTJAVAXSAVAXYak', 'unstakeTJAVAXSAVAXYak', 'TJ_AVAX_sAVAX_LP', await loan1.getBalance(toBytes32('TJ_AVAX_sAVAX_LP')),'YY_TJ_AVAX_sAVAX_LP', vaultAddress, null, loan1, USER_1, USER_2, false);
    }

    async function testVector(
        loan1: SmartLoanGigaChadInterface,
        USER_1: any,
        USER_2: any
    ) {
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);

        //AVAX
        let avaxAmount = 20;
        let amountInWei = parseUnits(avaxAmount.toString(), 18);
        await loan1.depositNativeToken({ value: amountInWei});

        await testVault('vectorStakeWAVAX1', 'vectorUnstakeWAVAX1', 'AVAX', amountInWei,'vectorStakeWAVAX1', '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc', 'balance', loan1, USER_1, USER_2, true);

        //sAVAX

        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('sAVAX'), amountInWei, 0);
        await testVault('vectorStakeSAVAX1', 'vectorUnstakeSAVAX1', 'sAVAX', await loan1.getBalance(toBytes32('sAVAX')),'vectorStakeSAVAX1', '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', 'balance', loan1, USER_1, USER_2, true);

        //USDC

        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('USDC'), amountInWei, 0);
        await testVault('vectorStakeUSDC1', 'vectorUnstakeUSDC1', 'USDC', await loan1.getBalance(toBytes32('USDC')),'vectorStakeUSDC1', '0xE5011Ab29612531727406d35cd9BcCE34fAEdC30', 'balance', loan1, USER_1, USER_2, true);
    }

    async function testVault(
        stakeMethod: string,
        unstakeMethod: string,
        stakedTokenSymbol: string,
        amountStaked: BigNumber,
        vaultTokenSymbol: string,
        vaultAddress: string,
        balanceMethod: string | null,
        loan1: SmartLoanGigaChadInterface,
        USER_1: any,
        USER_2: any,
        isStakedPosition: boolean
    ) {
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);
        let wrappedLoan1User2 = wrapContract(loan1, USER_2);

        let vault = new ethers.Contract(vaultAddress, isStakedPosition ? [`function ${balanceMethod}(address _owner) public view returns (uint256 balance)`] : erc20ABI, provider.getSigner()) as Contract;

        //stake

        isStakedPosition ?
            expect((await loan1.getStakedPositions()).some(sp => sp.vault === vaultAddress)).to.be.false
            :
            expect((await loan1.getAllOwnedAssets()).includes(toBytes32(vaultTokenSymbol))).to.be.false;

        if (!isStakedPosition) expect(await loan1.getBalance(toBytes32(vaultTokenSymbol))).to.be.equal(0);

        let TWV1 = fromWei(await wrappedLoan1User1.getThresholdWeightedValue());

        let tokenBalance1;
        if (!isStakedPosition) {
            tokenBalance1 = await loan1.getBalance(toBytes32(stakedTokenSymbol));
        }

        await expect(wrappedLoan1User2[stakeMethod](amountStaked)).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        await wrappedLoan1User1[stakeMethod](amountStaked);

        if (!isStakedPosition) expect(await loan1.getBalance(toBytes32(vaultTokenSymbol))).to.be.gt(0);

        isStakedPosition ?
            expect(fromWei(await vault[balanceMethod!](loan1.address))).to.be.gt(0)
            :
            expect(fromWei(await vault.balanceOf(loan1.address))).to.be.gt(0);

        isStakedPosition ?
            expect((await loan1.getStakedPositions()).some(sp => sp.vault === vaultAddress)).to.be.true
            :
            expect((await loan1.getAllOwnedAssets()).includes(toBytes32(vaultTokenSymbol))).to.be.true;

        let TWV2 = fromWei(await wrappedLoan1User1.getThresholdWeightedValue());

        let tokenBalance2;
        if (!isStakedPosition) {
            tokenBalance2 = await loan1.getBalance(toBytes32(stakedTokenSymbol));
            expect(tokenBalance2).to.be.lt(tokenBalance1);
        }

        console.log(twvInfo('stake', TWV1, TWV2))

        //unstake
        isStakedPosition ?
            await expect(wrappedLoan1User2[unstakeMethod](await vault[balanceMethod!](loan1.address), 0)).to.be.revertedWith('DiamondStorageLib: Must be contract owner')
            :
            await expect(wrappedLoan1User2[unstakeMethod](await loan1.getBalance(toBytes32(vaultTokenSymbol)))).to.be.revertedWith('DiamondStorageLib: Must be contract owner');

        isStakedPosition ?
            await wrappedLoan1User1[unstakeMethod](await vault[balanceMethod!](loan1.address), 0)
            :
            await wrappedLoan1User1[unstakeMethod](await loan1.getBalance(toBytes32(vaultTokenSymbol)));


        isStakedPosition ?
            expect((await loan1.getStakedPositions()).some(sp => sp.vault === vaultAddress)).to.be.false
            :
            expect((await loan1.getAllOwnedAssets()).includes(toBytes32(vaultTokenSymbol))).to.be.false;

        if (!isStakedPosition) expect(await loan1.getBalance(toBytes32(vaultTokenSymbol))).to.be.equal(0);

        let TWV3 = fromWei(await wrappedLoan1User1.getThresholdWeightedValue());

        let tokenBalance3;
        if (!isStakedPosition) {
            tokenBalance3 = await loan1.getBalance(toBytes32(stakedTokenSymbol));
            expect(tokenBalance3).to.be.gt(tokenBalance2);
        }

        isStakedPosition ?
            expect(await vault[balanceMethod!](loan1.address)).to.be.equal(0)
            :
            expect(await vault.balanceOf(loan1.address)).to.be.equal(0);

        console.log(twvInfo('unstake', TWV2, TWV3))

        function twvInfo(action: string, TWVbefore: number, TWVafter: number) {
            return `Change of TWV ${vaultTokenSymbol} after ${action}: ${(Math.abs(TWVafter - TWVbefore)/TWVbefore * 100).toFixed(2)}%,  newTWV: ${TWVafter}`;
        }
    }

    function wrapContract(contract: any, performer: SignerWithAddress) {
        return WrapperBuilder.wrap(contract.connect(performer)).usingDataService(
            {
                dataServiceId: "redstone-avalanche-prod",
                uniqueSignersCount: 3,
                dataFeeds: supportedAssetsAvax.map(a => fromBytes32(a.asset)),
                // @ts-ignore
                disablePayloadsDryRun: true
            },
            CACHE_LAYER_URLS.urls
        );
    }
});

