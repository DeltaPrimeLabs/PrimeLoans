import {ethers, waffle} from 'hardhat';
import chai from 'chai';
import {BigNumber, Contract} from 'ethers';
import {solidity} from "ethereum-waffle";

import PangolinIntermediaryArtifact
    from '../../../artifacts/contracts/integrations/avalanche/PangolinIntermediary.sol/PangolinIntermediary.json';
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {PangolinIntermediary, TokenManager} from '../../../typechain';
import {
    Asset,
    erc20ABI,
    formatUnits,
    fromWei,
    getFixedGasSigners, getRedstonePrices, getTokensPricesMap,
    syncTime,
    toBytes32,
    toWei,
    wavaxAbi
} from "../../_helpers";
import {parseUnits} from "ethers/lib/utils";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
const {expect} = chai;

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const UniswapV2IntermediaryAbi = [
    'function getAmountsIn (uint256 amountOut, address[] path) view returns (uint256[])',
    'function getAmountsOut (uint256 amountIn, address[] path) view returns (uint256[])'
]


describe('PangolinIntermediary', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Test buying and selling an asset', () => {
        let sut: PangolinIntermediary,
            wavaxToken: Contract,
            usdToken: Contract,
            router: Contract,
            owner: SignerWithAddress,
            usdTokenDecimalPlaces: BigNumber;

        before('Deploy the UniswapV2Intermediary contract', async () => {
            [, owner] = await getFixedGasSigners(10000000);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(
                [
                    new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                    new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                ],
                []
            );

            let exchangeFactory = await ethers.getContractFactory("PangolinIntermediary");
            sut = (await exchangeFactory.deploy()).connect(owner) as PangolinIntermediary;

            await sut.initialize(pangolinRouterAddress, tokenManager.address, [TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']]);

            wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
            usdToken = new ethers.Contract(TOKEN_ADDRESSES['USDC'], erc20ABI, provider);
            usdTokenDecimalPlaces = await usdToken.decimals();
            router = await new ethers.Contract(pangolinRouterAddress, UniswapV2IntermediaryAbi);

            await wavaxToken.connect(owner).deposit({value: toWei("1000")});
        });


        it('should check for the amount of tokens to swap to be greater than 0', async () => {
            await wavaxToken.connect(owner).approve(sut.address, parseUnits("1", usdTokenDecimalPlaces));
            await wavaxToken.connect(owner).transfer(sut.address, parseUnits("1", usdTokenDecimalPlaces));
            await expect(sut.swap(TOKEN_ADDRESSES['USDC'], TOKEN_ADDRESSES['AVAX'], 0, 1)).to.be.revertedWith('Amount of tokens to sell has to be greater than 0');
        });


        it('should check if enough funds were provided', async () => {
            const usdTokenPurchaseAmount = 1e8;
            const estimatedAvax = (await router.connect(owner).getAmountsIn(usdTokenPurchaseAmount.toString(), [TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']]))[0];

            await expect(sut.swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], Math.floor(estimatedAvax * 0.9).toString(), usdTokenPurchaseAmount.toString())).to.be.revertedWith('Not enough funds were provided');
        });


        it('should check if an erc20 tokens were purchased successfully', async () => {
            const usdTokenPurchaseAmount = 100;
            const usdTokenPurchaseAmountWei = parseUnits(usdTokenPurchaseAmount.toString(), usdTokenDecimalPlaces);
            const estimatedAvax = (await router.connect(owner).getAmountsIn(usdTokenPurchaseAmountWei, [TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']]))[0];

            const initialWavaxBalance = await wavaxToken.connect(owner).balanceOf(owner.address);
            const initialUsdBalance = await usdToken.connect(owner).balanceOf(owner.address);

            await wavaxToken.connect(owner).transfer(sut.address, estimatedAvax);

            await sut.connect(owner).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], estimatedAvax, usdTokenPurchaseAmountWei);

            const currentUsdTokenBalance = await usdToken.connect(owner).balanceOf(owner.address);
            const currentWavaxBalance = await wavaxToken.connect(owner).balanceOf(owner.address);

            expect(fromWei(currentUsdTokenBalance.sub(initialUsdBalance))).to.be.closeTo(usdTokenPurchaseAmount / 10 ** 18, 100);
            expect(currentWavaxBalance).to.be.lte(initialWavaxBalance);
        });


        it('should keep the same USDC balance in case of an insufficient token balance transferred to an exchange', async () => {
            const initialusdTokenBalance = await usdToken.connect(owner).balanceOf(sut.address);

            expect(await wavaxToken.connect(owner).balanceOf(sut.address)).to.be.equal(0);
            expect(await usdToken.connect(owner).balanceOf(sut.address)).to.be.equal(0);

            const estimatedAvaxNeeded = (await router.connect(owner).getAmountsIn(parseUnits("100", usdTokenDecimalPlaces), [TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']]))[0];

            await wavaxToken.connect(owner).deposit({value: estimatedAvaxNeeded});
            await wavaxToken.connect(owner).approve(sut.address, estimatedAvaxNeeded);

            const initialWavaxBalance = await wavaxToken.connect(owner).balanceOf(owner.address);

            await expect(sut.swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], (estimatedAvaxNeeded * 0.9).toString(), parseUnits("100", usdTokenDecimalPlaces))).to.be.revertedWith("Not enough funds were provided");

            expect(fromWei(await wavaxToken.connect(owner).balanceOf(sut.address))).to.be.equal(0);
            expect(formatUnits(await usdToken.connect(owner).balanceOf(sut.address), usdTokenDecimalPlaces)).to.be.equal(0);

            let newUsdBalance = await usdToken.connect(owner).balanceOf(sut.address);
            expect(newUsdBalance).to.be.equal(initialusdTokenBalance);
            expect(await wavaxToken.connect(owner).balanceOf(owner.address)).to.be.gt(BigNumber.from(initialWavaxBalance.toString()).sub(BigNumber.from(estimatedAvaxNeeded.toString())))
        });

        it('should properly handle view methods for extreme amounts', async () => {
            //numbers higher than available liquidity
            let avaxAmount = 100000000000;
            let usdAmount = 100000000000;

            await expect(sut.getMinimumTokensNeeded(parseUnits(usdAmount.toString(), usdTokenDecimalPlaces), wavaxToken.address, usdToken.address)).to.be.revertedWith('Error when calculating amounts needed');
            await expect(sut.getMaximumTokensReceived(toWei(avaxAmount.toString()), wavaxToken.address, usdToken.address)).not.to.be.reverted;
        });
    });

    describe('Test providing liquidity', () => {
        let sut: PangolinIntermediary,
            AVAX_PRICE: number,
            USD_PRICE: number,
            lpTokenAddress: string,
            lpToken: Contract,
            wavaxToken: Contract,
            usdToken: Contract,
            router: Contract,
            owner: SignerWithAddress,
            usdTokenDecimalPlaces: BigNumber;

        before('Deploy the UniswapV2Intermediary contract', async () => {
            [, owner] = await getFixedGasSigners(10000000);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(
                [
                    new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                    new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                    new Asset(toBytes32('PNG_AVAX_USDC_LP'), TOKEN_ADDRESSES['PNG_AVAX_USDC_LP'])
                ],
                []
            );

            let exchangeFactory = await ethers.getContractFactory("PangolinIntermediary");
            sut = (await exchangeFactory.deploy()).connect(owner) as PangolinIntermediary;

            let tokensPrices = await getTokensPricesMap(['AVAX', 'USDC'], "avalanche", getRedstonePrices, []);
            AVAX_PRICE = tokensPrices.get('AVAX')!;
            USD_PRICE = tokensPrices.get('USDC')!;

            await sut.initialize(pangolinRouterAddress, tokenManager.address, [
                TOKEN_ADDRESSES['AVAX'],
                TOKEN_ADDRESSES['USDC']
            ]);

            wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
            usdToken = new ethers.Contract(TOKEN_ADDRESSES['USDC'], erc20ABI, provider);
            usdTokenDecimalPlaces = await usdToken.decimals();
            router = await new ethers.Contract(pangolinRouterAddress, UniswapV2IntermediaryAbi);

            lpTokenAddress = await sut.connect(owner).getPair(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']);
            lpToken = new ethers.Contract(lpTokenAddress, erc20ABI, provider);

            await wavaxToken.connect(owner).deposit({value: toWei("1000")});
        });

        it('should fail to swap LP token', async () => {
            await wavaxToken.connect(owner).transfer(sut.address, toWei("1"));
            await expect(sut.connect(owner).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['PNG_AVAX_USDC_LP'], toWei("1"), 1)).to.be.revertedWith('Trying to buy unsupported token');
        });

        it('should swap tokens', async () => {
            const usdTokenPurchaseAmount = 100;
            const usdTokenPurchaseAmountWei = parseUnits(usdTokenPurchaseAmount.toString(), usdTokenDecimalPlaces);
            const estimatedAvax = (await router.connect(owner).getAmountsIn(usdTokenPurchaseAmountWei, [TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']]))[0];

            await wavaxToken.connect(owner).transfer(sut.address, estimatedAvax);

            await sut.connect(owner).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], estimatedAvax, usdTokenPurchaseAmountWei);
        });


        it('provide liquidity', async () => {
            expect(await lpToken.balanceOf(owner.address)).to.be.equal(0);
            await wavaxToken.connect(owner).transfer(sut.address, toWei("3"));
            await usdToken.connect(owner).transfer(sut.address, parseUnits((AVAX_PRICE * 3).toFixed(6), BigNumber.from("6")));

            await sut.connect(owner).addLiquidity(
                TOKEN_ADDRESSES['AVAX'],
                TOKEN_ADDRESSES['USDC'],
                toWei("3"),
                parseUnits((AVAX_PRICE * 3).toFixed(6), BigNumber.from("6")),
                toWei("2.5"),
                parseUnits((AVAX_PRICE * 2.5).toFixed(6), BigNumber.from("6"))
            );
            expect(await lpToken.balanceOf(owner.address)).to.be.gt(0);
        });


        it('remove liquidity', async () => {
            const lpBalanceBeforeRemove = await lpToken.balanceOf(owner.address);
            expect(lpBalanceBeforeRemove).to.be.gt(0);

            await lpToken.connect(owner).transfer(sut.address, lpBalanceBeforeRemove);

            await sut.connect(owner).removeLiquidity(
                TOKEN_ADDRESSES['AVAX'],
                TOKEN_ADDRESSES['USDC'],
                lpBalanceBeforeRemove,
                toWei("2"),
                parseUnits((AVAX_PRICE * 2).toFixed(6), BigNumber.from("6"))
            );
            expect(await lpToken.balanceOf(owner.address)).to.be.equal(0);
        });
    });

    describe('Whitelist and delist tokens', () => {
        let sut: PangolinIntermediary,
        tokenManager: TokenManager;

        const token1Address = '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70';
        const token2Address = '0x6a7e213F8ad56bEA9d85cC8a59c1f940fD5d176B';
        const token3Address = '0x5947BB275c521040051D82396192181b413227A3';
        const token4Address = "0x3cc936b795a188f0e246cbb2d74c5bd190aecf18";

        before("deploy a contract with a predefined supported assets", async () => {
            let owner: SignerWithAddress;

            [owner] = await getFixedGasSigners(10000000);

            tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(
                [
                    new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                    new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                ],
                []
            );

            let exchangeFactory = await ethers.getContractFactory("PangolinIntermediary");
            sut = (await exchangeFactory.deploy()).connect(owner) as PangolinIntermediary;

            await sut.initialize(pangolinRouterAddress, tokenManager.address, [TOKEN_ADDRESSES['AVAX'], token1Address]);
        });

        it("should add asset at a contract deploy", async () => {
            expect((await sut.getAllWhitelistedTokens()).length).to.equal(2);

            expect((await sut.getAllWhitelistedTokens())[0])
                .to.be.equal(TOKEN_ADDRESSES['AVAX']);
            expect((await sut.getAllWhitelistedTokens())[1])
                .to.be.equal(token1Address);
        });

        it("should add new assets without changing the sequence of previous ones", async () => {

            await sut.whitelistTokens([token2Address]);

            expect((await sut.getAllWhitelistedTokens()).length).to.equal(3);

            await expect((await sut.getAllWhitelistedTokens())[0])
                .to.be.equal(TOKEN_ADDRESSES['AVAX']);

            await expect((await sut.getAllWhitelistedTokens())[1])
                .to.be.equal(token1Address);

            await expect((await sut.getAllWhitelistedTokens())[2])
                .to.be.equal(token2Address);
        });


        it("should correctly remove an asset", async () => {
            await sut.delistTokens([token1Address]);

            await expect((await sut.getAllWhitelistedTokens()).includes(token1Address))
                .to.be.false
            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token2Address}`)
        });


        it("should not add a new asset if already supported", async () => {
            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token2Address}`);

            await expect(sut.whitelistTokens([token2Address])).to.be.revertedWith('Token already whitelisted');

            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token2Address}`)
        });


        it("should correctly whitelist and delist multiple tokens", async () => {
            await sut.whitelistTokens([token1Address, token3Address]);

            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token2Address},${token1Address},${token3Address}`)

            await sut.delistTokens([token1Address, token2Address]);

            await expect((await sut.getAllWhitelistedTokens()).includes(token1Address))
                .to.be.false;
            await expect((await sut.getAllWhitelistedTokens()).includes(token2Address))
                .to.be.false;

            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token3Address}`)
        });


        it("should not add any assets if one of them is corrupted", async () => {
            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token3Address}`)

            await expect(sut.whitelistTokens([
                ethers.constants.AddressZero, token4Address
            ]))
                .to.be.revertedWith("Cannot whitelist a zero address");

            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token3Address}`)
        });

        it("should correctly add assets", async () => {
            await sut.whitelistTokens([
                token2Address
            ]);

            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token3Address},${token2Address}`)
        });


        it("should not remove assets if some are corrupted", async () => {
            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token3Address},${token2Address}`)

            let randomAddress = '0x6e5fb70ee18388b54faba431cd84ca05099444ff';
            await expect(sut.delistTokens([token3Address, randomAddress])).to.be.revertedWith('Token was not whitelisted before');

            await expect((await sut.getAllWhitelistedTokens()).join(","))
                .to.be.equal(`${TOKEN_ADDRESSES['AVAX']},${token3Address},${token2Address}`)
        });


        it("should revert whitelisting for a wrong format address", async () => {
            await expect(sut.whitelistTokens(["bad_address"]))
                .to.be.reverted;
        });


        it("should revert whitelisting for a zero address", async () => {
            await expect(sut.whitelistTokens(["0x"]))
                .to.be.reverted;
        });


        it("should deploy a contract with an empty asset array", async () => {
            let owner2: SignerWithAddress,
                sut2: PangolinIntermediary;

            [, owner2] = await getFixedGasSigners(10000000);

            sut2 = await deployContract(owner2, PangolinIntermediaryArtifact) as PangolinIntermediary;
            await sut2.initialize(pangolinRouterAddress, tokenManager.address,[]);
            expect(await sut2.getAllWhitelistedTokens()).to.be.empty;
        });
    });
});
