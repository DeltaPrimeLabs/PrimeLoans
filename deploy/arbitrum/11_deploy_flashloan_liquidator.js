import hre, { ethers } from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
const aavePoolAddressesProviderAdress =
  "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
import ARB_TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  embedCommitHash("LiquidationFlashloanArbitrum");

  let diamondBeacon = await ethers.getContract("SmartLoanDiamondBeacon");

  let result = await deploy("LiquidationFlashloanArbitrum", {
    from: deployer,
    gasLimit: 80000000,
    args: [
      aavePoolAddressesProviderAdress,
      ARB_TOKEN_ADDRESSES.ETH,
      "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
    ],
  });

  console.log(`Deployed LiquidationFlashloanArbitrum at address: ${result.address}`);

  let liquidationFacet = await ethers.getContractAt(
    "SmartLoanLiquidationFacet",
    "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
    deployer
  );
  await liquidationFacet.whitelistLiquidators([
    result.address,
    "0x0a14041CAE96Bf79F980bC4eb8DcF5aa8aEB8172",
    "0xc7E063ad6Bf1116397F50846C1B37D3beFA16013",
    "0x859cEdfD0a7EB0Cd9417Ab24A4e391C5203c2789",
    "0xcE9D26e6f4Cde069F618D2d1a7856Ab5DD6D1832",
    "0x895F79F2a9Ce1aA1320D79CA880f9dac57504016"
  ]);
  console.log(
    `Whitelisted flashloan liquidator: ${result.address} & "0x0a14041CAE96Bf79F980bC4eb8DcF5aa8aEB8172",
    "0xc7E063ad6Bf1116397F50846C1B37D3beFA16013",
    "0x859cEdfD0a7EB0Cd9417Ab24A4e391C5203c2789",
    "0xcE9D26e6f4Cde069F618D2d1a7856Ab5DD6D1832",
    "0x895F79F2a9Ce1aA1320D79CA880f9dac57504016"`
  );

  await verifyContract(hre,
      {
        address: "0x0D45A30F878895aF7510F7a23E82EcA253f6e375",
        contract: `contracts/LiquidationFlashloanArbitrum.sol:LiquidationFlashloanArbitrum`,
        constructorArguments: [
          aavePoolAddressesProviderAdress,
          ARB_TOKEN_ADDRESSES.ETH,
          "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
        ]
      });
  console.log(`Verified LiquidationFlashloanArbitrum`);
};

module.exports.tags = ["arbitrum-flashloan"];
