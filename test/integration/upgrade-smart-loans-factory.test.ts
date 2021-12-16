import {Asset, deployAndInitPangolinExchangeContract, syncTime, toBytes32} from "../_helpers";
import {
    MockUpgradedSmartLoansFactory,
    PangolinExchange,
    Pool,
    SmartLoansFactory,
    TransparentUpgradeableProxy,
} from "../../typechain";
import MockSmartLoansFactoryArtifact
    from '../../artifacts/contracts/mock/MockUpgradedSmartLoansFactory.sol/MockUpgradedSmartLoansFactory.json';
import TransparentUpgradeableProxyArtifact
    from '../../artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json';
import MockUpgradedSmartLoansFactoryArtifact from '../../artifacts/contracts/mock/MockUpgradedSmartLoansFactory.sol/MockUpgradedSmartLoansFactory.json';
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import chai, {expect} from "chai";
import {deployContract, solidity} from "ethereum-waffle";
import {ethers} from "hardhat";
import {getFixedGasSigners} from "../_helpers";

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';

describe('Smart loans factory - upgrading',  () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Check basic logic before and after upgrade', () => {
        let smartLoansFactory: SmartLoansFactory,
            pool: Pool,
            exchange: PangolinExchange,
            owner: SignerWithAddress,
            admin: SignerWithAddress,
            proxy: TransparentUpgradeableProxy,
            ownerLoanAddress: any;
        before("should deploy provider, exchange, loansFactory and pool", async () => {
            [, owner, admin] = await getFixedGasSigners(10000000);
            pool = await deployContract(owner, PoolArtifact) as Pool;
            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [new Asset(toBytes32('USD'), usdTokenAddress)]);
            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            proxy = await deployContract(owner, TransparentUpgradeableProxyArtifact, [smartLoansFactory.address, admin.address, []]) as TransparentUpgradeableProxy;
            smartLoansFactory = (await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory).attach(proxy.address);

            await smartLoansFactory.connect(owner).initialize(pool.address, exchange.address);

            await smartLoansFactory.createLoan();
            ownerLoanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
        });

        it("should not allow to upgrade from non-admin", async () => {
            const smartLoansFactoryV2 = await deployContract(owner, MockUpgradedSmartLoansFactoryArtifact) as MockUpgradedSmartLoansFactory;
            await expect(proxy.connect(owner).upgradeTo(smartLoansFactoryV2.address))
                .to.be.revertedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
        });


        it("should upgrade", async () => {
            const smartLoansFactoryV2 = await deployContract(owner, MockUpgradedSmartLoansFactoryArtifact) as MockUpgradedSmartLoansFactory;

            await proxy.connect(admin).upgradeTo(smartLoansFactoryV2.address);

            let smartLoansFactoryUpgraded = (await new ethers.Contract(smartLoansFactory.address, MockSmartLoansFactoryArtifact.abi)) as MockUpgradedSmartLoansFactory;

            //The mock exchange has a hardcoded return value of 1337
            expect(await smartLoansFactoryUpgraded.connect(owner).newMockedFunction()).to.be.equal(1337);
            // The contract's borrowers registry should stay unchanged
            expect(ownerLoanAddress).to.be.equal(await smartLoansFactory.getLoanForOwner(owner.address));
        });
    });
});