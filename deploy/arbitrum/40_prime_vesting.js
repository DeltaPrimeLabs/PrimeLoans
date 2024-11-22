import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash("PrimeVesting", "./contracts");

    const args = [
        "0x944d29Db15E704DC1D358083598E27F466cb27FE",
        1719522000,
        [
            "0x003E3336764DE10a898916B84C626B69D7294339",
            "0xFC078F7ea5c7648CD78E0cA40799B6d2090f83Dd",
            "0x72bf67eCBaaB144a84Fb4a81f011Cd27b3cF05a1",
            "0xE214fba86BeED196AaC68934bF4822C1Cff6B0b8"
        ],
        [
            {
                cliffPeriod: 6 * 3600,
                vestingPeriod: 48 * 3600,
                grantClaimRightTo: ethers.constants.AddressZero,
                totalAmount: ethers.utils.parseEther("999"),
            },
            {
                cliffPeriod: 0,
                vestingPeriod: 72 * 3600,
                grantClaimRightTo: "0x83C3c4B58b70067BFb23B7875FEb63241F9e7668",
                totalAmount: ethers.utils.parseEther("12345"),
            },
            {
                cliffPeriod: 2 * 3600,
                vestingPeriod: 48 * 3600,
                grantClaimRightTo: ethers.constants.AddressZero,
                totalAmount: ethers.utils.parseEther("40000"),
            },
            {
                cliffPeriod: 8 * 3600,
                vestingPeriod: 72 * 3600,
                grantClaimRightTo: "0xC29ee4509F01e3534307645Fc62F30Da3Ec65751",
                totalAmount: ethers.utils.parseEther("2137"),
            },
        ]
    ];
    const PrimeVesting = await deploy("PrimeVesting", {
        from: deployer,
        args,
    });

    console.log(
        `PrimeVesting deployed at address: ${PrimeVesting.address}`
    );

    await verifyContract(hre,
        {
            address: PrimeVesting.address,
            contract: `contracts/PrimeVesting.sol:PrimeVesting`,
            constructorArguments: args
        });
    console.log(`Verified PrimeVesting`);
};

module.exports.tags = ["arbitrum-prime-vesting"];
