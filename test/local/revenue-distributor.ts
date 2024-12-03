import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import RevenueDistributorArtifact from "../../artifacts/contracts/RevenueDistributor.sol/RevenueDistributor.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { fromWei, getFixedGasSigners, toWei } from "../_helpers";
import { MockToken, RevenueDistributor } from "../../typechain";

chai.use(solidity);

const { deployContract } = waffle;

describe("Revenue Distributor", () => {
  let owner: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress,
    keeper: SignerWithAddress,
    mockToken: MockToken,
    distributor: RevenueDistributor;

  beforeEach("Deploy contracts", async () => {
    // Deploy the contracts before each test
    [owner, user1, user2, user3, keeper] = await getFixedGasSigners(10000000);

    mockToken = (await deployContract(owner, MockTokenArtifact, [
      [owner.address],
    ])) as MockToken;

    distributor = (await deployContract(
      owner,
      RevenueDistributorArtifact,
      []
    )) as RevenueDistributor;
  });

  it("should set and initiate an epoch", async () => {
    // Approve the distributor contract to spend tokens
    await mockToken.connect(owner).approve(distributor.address, toWei("10000"));

    // Set epoch rewards
    await distributor.setEpochReward(1, mockToken.address, [user1.address, user2.address], [toWei("5000"), toWei("5000")]);

    // Initiate the epoch
    await distributor.initiateEpoch(1);

    // Check if the epoch is active
    const epoch = await distributor.epochs(1);
    expect(epoch.active).to.be.true;
  });

  it("should allow users to claim rewards for a single epoch", async () => {
    // Approve the distributor contract to spend tokens
    await mockToken.connect(owner).approve(distributor.address, toWei("10000"));

    // Set and initiate epoch
    await distributor.setEpochReward(1, mockToken.address, [user1.address, user2.address], [toWei("5000"), toWei("5000")]);
    await distributor.initiateEpoch(1);

    // User1 claims rewards
    await distributor.connect(user1).claim(1);

    // Check user1's balance
    const user1Balance = await mockToken.balanceOf(user1.address);
    expect(fromWei(user1Balance)).to.equal(5000);
  });

  it("should allow users to claim rewards for multiple epochs", async () => {
    // Approve the distributor contract to spend tokens
    await mockToken.connect(owner).approve(distributor.address, toWei("20000"));

    // Set and initiate epochs
    await distributor.setEpochReward(1, mockToken.address, [user1.address], [toWei("5000")]);
    await distributor.initiateEpoch(1);

    await distributor.setEpochReward(2, mockToken.address, [user1.address], [toWei("3000")]);
    await distributor.initiateEpoch(2);

    // User1 claims rewards for multiple epochs
    await distributor.connect(user1).claimMultiple([1, 2]);

    // Check user1's balance
    const user1Balance = await mockToken.balanceOf(user1.address);
    expect(fromWei(user1Balance)).to.equal(8000);
  });

  it("should allow the owner to batch claim on behalf of users", async () => {
    // Approve the distributor contract to spend tokens
    await mockToken.connect(owner).approve(distributor.address, toWei("10000"));

    // Set and initiate epoch
    await distributor.setEpochReward(1, mockToken.address, [user1.address, user2.address], [toWei("3000"), toWei("2000")]);
    await distributor.initiateEpoch(1);

    // Owner batch claims for user1 and user2
    await distributor.batchClaim(1, [user1.address, user2.address]);

    // Check user balances
    const user1Balance = await mockToken.balanceOf(user1.address);
    const user2Balance = await mockToken.balanceOf(user2.address);
    expect(fromWei(user1Balance)).to.equal(3000);
    expect(fromWei(user2Balance)).to.equal(2000);
  });

  it("should revert if non-owner tries to set epoch rewards", async () => {
    // Attempt to set epoch rewards by non-owner
    await expect(
      distributor.connect(user1).setEpochReward(1, mockToken.address, [user1.address], [toWei("5000")])
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should revert if user tries to claim uninitiated epoch", async () => {
    // Set epoch rewards but do not initiate
    await distributor.setEpochReward(1, mockToken.address, [user1.address], [toWei("5000")]);

    // Attempt to claim rewards for uninitiated epoch
    await expect(distributor.connect(user1).claim(1)).to.be.revertedWith("Epoch not active");
  });
});
