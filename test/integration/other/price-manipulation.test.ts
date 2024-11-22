import {ethers, waffle} from 'hardhat';
import chai, {expect} from 'chai';
import {BigNumber, Contract} from 'ethers';
import {solidity} from "ethereum-waffle";
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {PangolinIntermediary, TokenManager} from '../../../typechain';
import {
    Asset,
    erc20ABI,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    syncTime,
    toBytes32,
    toWei
} from "../../_helpers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const ERC20Abi = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function transfer(address _to, uint256 _value) public returns (bool success)',
    'function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)'
]

const WavaxAbi = [
    'function deposit() public payable',
    ...ERC20Abi
]

const UniswapV2IntermediaryAbi = [
    'function getAmountsIn (uint256 amountOut, address[] path) view returns (uint256[])',
    'function getAmountsOut (uint256 amountIn, address[] path) view returns (uint256[])'
]

//illiquid token
const rocoAddress = '0xb2a85C5ECea99187A977aC34303b80AcbDdFa208';
const pngRocoAvaxLp = '0x4a2cb99e8d91f82cf10fb97d43745a1f23e47caa'

describe('Price manipulation test', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('Test manipulation with illiquid token', () => {
        let sut: PangolinIntermediary,
            AVAX_PRICE: number,
            wavaxToken: Contract,
            rocoToken: Contract,
            lpToken: Contract,
            router: Contract,
            owner: SignerWithAddress,
            badActor: SignerWithAddress,
            depositor: SignerWithAddress,
            primeAccount: SignerWithAddress,
            rocoTokenDecimalPlaces: BigNumber;

        before('Deploy contracts', async () => {
            [, owner, badActor, primeAccount, depositor] = await getFixedGasSigners(10000000);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(
                [
                    new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                    new Asset(toBytes32('ROCO'), rocoAddress)
                ],
                []
            );

            let exchangeFactory = await ethers.getContractFactory("PangolinIntermediary");
            sut = (await exchangeFactory.deploy()).connect(owner) as PangolinIntermediary;

            AVAX_PRICE = (await getRedstonePrices(['AVAX']))[0];

            await sut.initialize(pangolinRouterAddress, tokenManager.address, [
                TOKEN_ADDRESSES['AVAX'],
                rocoAddress
            ]);

            wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], WavaxAbi, provider);
            rocoToken = new ethers.Contract(rocoAddress, ERC20Abi, provider);
            rocoTokenDecimalPlaces = await rocoToken.decimals();
            router = await new ethers.Contract(pangolinRouterAddress, UniswapV2IntermediaryAbi);
            lpToken = new ethers.Contract(pngRocoAvaxLp, erc20ABI, provider);
        });

        it('should buy token with EOA, use Prime Account to pump the price and dump with EOA', async () => {
            //badActor initial funds (120k $ in AVAX)
            let badActorInitialFunds = 120000;
            let badActorInitialAvax = badActorInitialFunds / AVAX_PRICE;

            await wavaxToken.connect(badActor).deposit({value: toWei(badActorInitialAvax.toString())});

            //badActor sells 100k$ of AVAX and buys token
            let soldAvax = 100000 / AVAX_PRICE;
            await wavaxToken.connect(badActor).deposit({value: toWei(soldAvax.toString())});
            await wavaxToken.connect(badActor).transfer(sut.address, toWei(soldAvax.toString()));

            await sut.connect(badActor).swap(TOKEN_ADDRESSES['AVAX'], rocoAddress, toWei(soldAvax.toString()), 1);
            let badActorRoco = fromWei(await rocoToken.balanceOf(badActor.address));

            //badActor provides the rest of his funds as collateral to Prime Account, "borrows" 5x AVAX and uses these funds to pump the token
            let collateral = badActorInitialAvax - soldAvax;
            let borrowedAmount = collateral * 5; //LTV = 5
            let swappedAmount = 0.99 * (borrowedAmount + collateral);

            //collateral
            await wavaxToken.connect(badActor).transfer(primeAccount.address, toWei(collateral.toString()));

            //borrowed
            await wavaxToken.connect(depositor).deposit({value: toWei(borrowedAmount.toString())});
            await wavaxToken.connect(depositor).transfer(primeAccount.address, toWei(borrowedAmount.toString()));

            //swap everything to pump the price
            await wavaxToken.connect(primeAccount).transfer(sut.address, toWei(swappedAmount.toString()));
            await sut.connect(primeAccount).swap(TOKEN_ADDRESSES['AVAX'], rocoAddress, toWei(swappedAmount.toString()), 1);

            let rocoPrice = fromWei(await wavaxToken.balanceOf(lpToken.address))
                    / fromWei(await rocoToken.balanceOf(lpToken.address)) * AVAX_PRICE;
            let debt = borrowedAmount * AVAX_PRICE;
            let totalValue = rocoPrice * fromWei(await rocoToken.balanceOf(primeAccount.address));
            let ltv = debt / (totalValue - debt);

            expect(ltv).to.be.lt(5); //to ensure that this transaction would pass

            //badActor dumps his tokens
            await rocoToken.connect(badActor).transfer(sut.address, toWei(badActorRoco.toString()));

            await sut.connect(badActor).swap(rocoAddress, TOKEN_ADDRESSES['AVAX'], toWei(badActorRoco.toString()), 1);

            let badActorAvax = fromWei(await wavaxToken.balanceOf(badActor.address));

            console.log(`Bad actor profit in AVAX: ${badActorAvax - badActorInitialAvax}`)
        });
    });
});
