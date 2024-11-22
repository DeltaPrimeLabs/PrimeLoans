import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {MockTokenManager, TokenManager} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import {fromBytes32, getFixedGasSigners, PoolAsset, Asset, toBytes32, toWei, fromWei} from "../../_helpers";
import {Contract} from "ethers";
const addresses = require("../../../common/addresses/avax/token_addresses.json");

const {deployContract} = waffle;
chai.use(solidity);

describe('Token Manager tests', () => {
    let
        admin: SignerWithAddress,
        nonAdmin: SignerWithAddress,
        owner: SignerWithAddress,
        tokenManager: Contract;

    before(async () => {
        [admin, owner, nonAdmin] = await getFixedGasSigners(10000000);

        tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact
        ) as MockTokenManager;

        await tokenManager.connect(owner).initialize([], []);
    })

    it("should check that owner is the admin", async () => {
        expect(await tokenManager.owner()).to.be.equal(owner.address);
    });

    it("should fail adding a Pool Asset to the TokenManager that is not a contract", async () => {
        await expect(tokenManager.addPoolAssets([new PoolAsset(toBytes32("TEST1"), admin.address)])).to.be.revertedWith("TokenManager: Pool must be a contract");
    });

    it("should add pool assets", async () => {
        let newAssets = [
            new PoolAsset(toBytes32("AVAX"), addresses.AVAX),
            new PoolAsset(toBytes32("BTC"), addresses.BTC)
        ];
        await tokenManager.connect(owner).addPoolAssets(newAssets);
        let poolAssets = await tokenManager.getAllPoolAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("AVAX"), toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.BTC))).to.be.equal("");
    });

    it("should fail to add an already existing asset", async () => {
        let newAssets = [
            new PoolAsset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await expect(tokenManager.connect(owner).addPoolAssets(newAssets)).to.be.revertedWith("Asset's pool already exists");
    });

    it("should remove pool asset", async () => {
        let assetsToRemove = [
            toBytes32("AVAX")
        ];
        await tokenManager.connect(owner).removePoolAssets(assetsToRemove);
        let poolAssets = await tokenManager.getAllPoolAssets();
        expect(poolAssets.length).to.be.equal(1);
        expect(poolAssets).to.be.eql([toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.BTC))).to.be.equal("");
    });

    it("should add pool asset back", async () => {
        let newAssets = [
            new PoolAsset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await tokenManager.connect(owner).addPoolAssets(newAssets);
        let poolAssets = await tokenManager.getAllPoolAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("BTC"), toBytes32("AVAX")]);
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.BTC))).to.be.equal("");
    });

    it("should add token assets", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX"), addresses.AVAX),
            new Asset(toBytes32("BTC"), addresses.BTC)
        ];
        await tokenManager.connect(owner).addTokenAssets(newAssets);
        let poolAssets = await tokenManager.getAllTokenAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("AVAX"), toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("AVAX");
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.BTC))).to.be.equal("BTC");
    });

    it("should fail to add an already existing asset", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await expect(tokenManager.connect(owner).addTokenAssets(newAssets)).to.be.revertedWith("Asset's token already exists");
    });

    it("should remove token asset", async () => {
        let assetsToRemove = [
            toBytes32("AVAX")
        ];
        await tokenManager.connect(owner).removeTokenAssets(assetsToRemove);
        let poolAssets = await tokenManager.getAllTokenAssets();
        expect(poolAssets.length).to.be.equal(1);
        expect(poolAssets).to.be.eql([toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.BTC))).to.be.equal("BTC");
    });

    it("should add token asset back", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await tokenManager.connect(owner).addTokenAssets(newAssets);
        let poolAssets = await tokenManager.getAllTokenAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("BTC"), toBytes32("AVAX")]);
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("AVAX");
        expect(fromBytes32(await tokenManager.connect(owner).tokenAddressToSymbol(addresses.BTC))).to.be.equal("BTC");
    });

    it("should fail to add new asset with an already-existing address", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX1"), addresses.AVAX)
        ];
        await expect(tokenManager.connect(owner).addTokenAssets(newAssets)).to.be.revertedWith("Asset address is already in use");
    });

    it("should change token leverage", async () => {
        expect(fromWei(await tokenManager.connect(owner).debtCoverage(addresses.AVAX))).to.be.equal(0.8333333333333333);
        await tokenManager.connect(owner).setDebtCoverage(addresses.AVAX, toWei("0.5"));
        expect(fromWei(await tokenManager.connect(owner).debtCoverage(addresses.AVAX))).to.be.equal(0.5);
    });

    it("should not accept leverage higher than x5", async () => {
        await expect(tokenManager.connect(owner).setDebtCoverage(addresses.AVAX, toWei("0.8333333333333334"))).to.be.revertedWith("Debt coverage higher than maximum acceptable'");
    });

    it("should not accept leverage lower than 0", async () => {
        await expect(tokenManager.connect(owner).setDebtCoverage(addresses.AVAX, toWei("-0.1"))).to.be.reverted;
    });

    it("should not accept leverage change by a non-admin", async () => {
        await expect(tokenManager.connect(nonAdmin).setDebtCoverage(addresses.AVAX, toWei("0.6"))).to.be.revertedWith("Ownable: caller is not the owner");
    });
});