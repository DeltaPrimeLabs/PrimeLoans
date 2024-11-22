import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {
    Asset,
    calculateStakingTokensAmountBasedOnAvaxValue,
    deployAllFacets, erc20ABI,
    fromWei,
    getFixedGasSigners, getRedstonePrices, getTokensPricesMap,
    recompileConstantsFile,
    toBytes32,
    toWei, wavaxAbi, ZERO
} from "../../_helpers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {BigNumber, Contract} from "ethers";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import {WrapperBuilder} from "@redstone-finance/evm-connector";

const {deployContract} = waffle;
chai.use(solidity);
const {provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const yakStakingAVAXTokenAddress = "0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95";
const yakStakingSAVAXTokenAddress = "0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977";

describe('Yield Yak test stake AVAX', () => {
    let smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        user: SignerWithAddress,
        owner: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        YY_AAVE_AVAX_PRICE: number,
        yakStakingContract: Contract,
        avaxTokenContract: Contract;

    before(async () => {
        [user, owner] = await getFixedGasSigners(10000000);
        yakStakingContract = await new ethers.Contract(yakStakingAVAXTokenAddress, erc20ABI, provider);

        let supportedAssets = [
            new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
            new Asset(toBytes32('YY_AAVE_AVAX'), TOKEN_ADDRESSES['YY_AAVE_AVAX']),
        ]

        let diamondAddress = await deployDiamond();

        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        let tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact,
            []
        ) as MockTokenManager;

        await tokenManager.connect(owner).initialize(supportedAssets, []);
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

        let tokensPrices = await getTokensPricesMap(['AVAX', 'YY_AAVE_AVAX'], "avalanche", getRedstonePrices, []);
        AVAX_PRICE = tokensPrices.get('AVAX')!;
        YY_AAVE_AVAX_PRICE = tokensPrices.get('YY_AAVE_AVAX')!;

        MOCK_PRICES = [
            {
                dataFeedId: 'AVAX',
                value: AVAX_PRICE
            },
            {
                dataFeedId: 'YY_AAVE_AVAX',
                value: YY_AAVE_AVAX_PRICE
            },
        ];

        await smartLoansFactory.connect(user).createLoan();

        const loan_proxy_address = await smartLoansFactory.getLoanForOwner(user.address);
        loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, user);

        wrappedLoan = WrapperBuilder
            // @ts-ignore
            .wrap(loan)
            .usingSimpleNumericMock({
                mockSignersCount: 10,
                dataPoints: MOCK_PRICES,
            });

        avaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
        await avaxTokenContract.connect(user).deposit({value: toWei('1000')});
        await avaxTokenContract.connect(user).approve(loan.address, toWei('1000'));
        await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
    })

    it("should successfully stake AVAX with YieldYak", async () => {
        let initialAvaxBalance = BigNumber.from(await avaxTokenContract.balanceOf(wrappedLoan.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
        let investedAvaxAmount = BigNumber.from(toWei("10"));

        expect(initialStakedBalance).to.be.equal(0);
        expect(fromWei(initialAvaxBalance)).to.be.greaterThan(0);

        await wrappedLoan.stakeAVAXYak(investedAvaxAmount);

        let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, investedAvaxAmount);

        let afterStakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
        let avaxBalanceDifference = initialAvaxBalance.sub(await avaxTokenContract.balanceOf(wrappedLoan.address));

        expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
        expect(fromWei(avaxBalanceDifference)).to.be.closeTo(10, 1);
    });


    it("should unstake remaining AVAX", async () => {
        let initialAvaxBalance = BigNumber.from(await avaxTokenContract.balanceOf(wrappedLoan.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

        await yakStakingContract.connect(user).approve(wrappedLoan.address, initialStakedBalance)
        await wrappedLoan.unstakeAVAXYak(initialStakedBalance);

        let afterUntakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
        let avaxBalanceDifference = (await avaxTokenContract.balanceOf(wrappedLoan.address)).sub(initialAvaxBalance);

        expect(afterUntakingStakedBalance).to.be.equal(0);
        expect(fromWei(avaxBalanceDifference)).to.be.closeTo(10, 0.5);
    });

});

describe('Yield Yak test stake sAVAX', () => {
    let smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        exchange: PangolinIntermediary,
        wrappedLoan: any,
        user: SignerWithAddress,
        owner: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        SAVAX_PRICE: number,
        YY_PTP_sAVAX_PRICE: any,
        yakStakingContract: Contract,
        sAvaxTokenContract: Contract,
        avaxTokenContract: Contract;

    before(async () => {
        [user, owner] = await getFixedGasSigners(10000000);
        yakStakingContract = await new ethers.Contract(yakStakingSAVAXTokenAddress, erc20ABI, provider);

        let supportedAssets = [
            new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
            new Asset(toBytes32('sAVAX'), TOKEN_ADDRESSES['sAVAX']),
            new Asset(toBytes32('YY_PTP_sAVAX'), TOKEN_ADDRESSES['YY_PTP_sAVAX']),
        ]

        let diamondAddress = await deployDiamond();

        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        let tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact,
            []
        ) as MockTokenManager;

        await tokenManager.connect(owner).initialize(supportedAssets, []);
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

        let exchangeFactory = await ethers.getContractFactory("PangolinIntermediary");
        exchange = (await exchangeFactory.deploy()).connect(owner) as PangolinIntermediary;
        await exchange.initialize(pangolinRouterAddress, tokenManager.address, supportedAssets.map(asset => asset.assetAddress));

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

        let tokensPrices = await getTokensPricesMap(['AVAX', 'sAVAX', 'YY_PTP_sAVAX'], "avalanche", getRedstonePrices, []);
        AVAX_PRICE = tokensPrices.get('AVAX')!;
        SAVAX_PRICE = tokensPrices.get('sAVAX')!;
        YY_PTP_sAVAX_PRICE = tokensPrices.get('YY_PTP_sAVAX')!;

        MOCK_PRICES = [
            {
                dataFeedId: 'AVAX',
                value: AVAX_PRICE
            },
            {
                dataFeedId: 'sAVAX',
                value: SAVAX_PRICE
            },
            {
                dataFeedId: 'YY_PTP_sAVAX',
                value: YY_PTP_sAVAX_PRICE
            },
        ];

        await smartLoansFactory.connect(user).createLoan();

        const loan_proxy_address = await smartLoansFactory.getLoanForOwner(user.address);
        loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, user);

        wrappedLoan = WrapperBuilder
            // @ts-ignore
            .wrap(loan)
            .usingSimpleNumericMock({
                mockSignersCount: 10,
                dataPoints: MOCK_PRICES,
            });

        avaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
        sAvaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['sAVAX'], wavaxAbi, provider);
        await avaxTokenContract.connect(user).deposit({value: toWei('1000')});
        await avaxTokenContract.connect(user).approve(loan.address, toWei('1000'));
        await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
    });

    // TODO: Calculate more accurate expected sAvax output once Redstone data feed provides sAvax price
    it("should buy 50 sAVAX", async () => {
        await wrappedLoan.swapPangolin(
            toBytes32('AVAX'),
            toBytes32('sAVAX'),
            toWei("50"),
            toWei("40")
        )
    });

    it("should successfully stake sAVAX with YieldYak", async () => {
        let initialSAvaxBalance = BigNumber.from(await sAvaxTokenContract.balanceOf(wrappedLoan.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
        let investedAvaxAmount = BigNumber.from(toWei("10"));

        expect(initialStakedBalance).to.be.equal(0);
        expect(fromWei(initialSAvaxBalance)).to.be.greaterThan(0);

        await wrappedLoan.stakeSAVAXYak(investedAvaxAmount);

        let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, investedAvaxAmount);

        let afterStakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
        let sAvaxBalanceDifference = initialSAvaxBalance.sub(await sAvaxTokenContract.balanceOf(wrappedLoan.address));

        expect(fromWei(afterStakingStakedBalance)).to.be.closeTo(fromWei(expectedAfterStakingStakedBalance), 1e-3);
        expect(fromWei(sAvaxBalanceDifference)).to.be.closeTo(10, 1);
    });

    it("should unstake remaining sAVAX", async () => {
        let initialSAvaxBalance = BigNumber.from(await sAvaxTokenContract.balanceOf(wrappedLoan.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

        await yakStakingContract.connect(user).approve(wrappedLoan.address, initialStakedBalance)
        await wrappedLoan.unstakeSAVAXYak(initialStakedBalance);

        let afterUntakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
        let sAvaxBalanceDifference = (await sAvaxTokenContract.balanceOf(wrappedLoan.address)).sub(initialSAvaxBalance);

        expect(afterUntakingStakedBalance).to.be.equal(0);
        expect(fromWei(sAvaxBalanceDifference)).to.be.closeTo(10, 0.5);
    });

});