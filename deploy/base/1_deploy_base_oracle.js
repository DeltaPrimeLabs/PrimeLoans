import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";
import BaseOracleArtifact from "../../artifacts/contracts/oracle/BaseOracle.sol/BaseOracle.json";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // multisig addresses (for ownership and proxy admin)
    const BASE_OWNER_MULTISIG_ADDRESS = "0xd6Ef2C4DeEcCD77E154b99bC2F039E5f82DCc7c9";
    const BASE_ADMIN_MULTISIG_ADDRESS = "0xCD053EeA1B82867c491dECe0A8833941849771D0";

    let deployedOracleContract = await deploy("BaseOracle", {
        from: deployer,
        args: [],
    });
    console.log(
        `BaseOracle implementation deployed at address: ${deployedOracleContract.address}`
    );

    // wait 5 seconds (for block finality before verification)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await verifyContract(hre, {
        address: deployedOracleContract.address,
        contract: "contracts/oracle/BaseOracle.sol:BaseOracle",
        constructorArguments: [],
    });
    console.log("Verified BaseOracle");

    const initCalldata = web3Abi.encodeFunctionCall(
        BaseOracleArtifact.abi.find((method) => method.name === "initialize"),
        [deployer]
    );

    const args = [deployedOracleContract.address, BASE_ADMIN_MULTISIG_ADDRESS, initCalldata];
    let deployedOracleTUPContract = await deploy("BaseOracleTUP", {
        from: deployer,
        args: args,
    });
    console.log(
        `BaseOracleTUP implementation deployed at address: ${deployedOracleTUPContract.address}`
    );

    // wait 5 seconds before verifying
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await verifyContract(hre, {
        address: deployedOracleTUPContract.address,
        contract: "contracts/oracle/BaseOracleTUP.sol:BaseOracleTUP",
        constructorArguments: args,
    });

    const { ethers } = hre;
    const oracle = await ethers.getContractAt("BaseOracle", deployedOracleTUPContract.address);

    const Protocol = {
        UNISWAP: 0,
        AERODROME: 1,
    };
    const tokenConfigurations = [
        {
            address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825", // AIXBT
            pools: [
                {
                    poolAddress: "0xF3E7E359b75a7223BA9D71065C57DDd4F5D8747e",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x22A52bB644f855ebD5ca2edB643FF70222D70C31",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0xf1Fdc83c3A336bdbDC9fB06e318B08EadDC82FF4",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0x47808DdBC91646b21B307FeFBaF7ee200B004CcC",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", // BRETT
            pools: [
                {
                    poolAddress: "0x43BBb129b56A998732767725A183b7a566843dBA",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x4e829F8A5213c42535AB84AA40BD4aDCCE9cBa02",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0xBA3F945812a83471d709BCe9C3CA699A19FB46f7",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0x76Bf0abD20f1e0155Ce40A62615a90A709a6C3D8",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x768be13e1680b5ebe0024c42c896e3db59ec0149", // SKI
            pools: [
                {
                    poolAddress: "0xe782B72A1157b7bEa1A9452835Cce214962aD43B",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x6d6391B9bD02Eefa00FA711fB1Cb828A6471d283",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", // DEGEN
            pools: [
                {
                    poolAddress: "0xaFB62448929664Bfccb0aAe22f232520e765bA88",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x2C4909355b0C036840819484c3A882A95659aBf3",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0xc9034c3E7F58003E6ae0C8438e7c8f4598d5ACAA",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4", // TOSHI
            pools: [
                {
                    poolAddress: "0x74E4c08Bb50619b70550733D32b7e60424E9628e",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x4b0Aaf3EBb163dd45F663b38b6d93f6093EBC2d3",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0x5aa4AD647580bfE86258d300Bc9852F4434E2c61",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0xFc131B9981fB053C2cAb7373DAf70DeF1436c4BB",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x9a26f5433671751c3276a065f57e5a02d2817973", // KEYCAT
            pools: [
                {
                    poolAddress: "0xB211a9DDff3a10806c8fdb92Dbc4c34596A23F84",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0xd82403772cB858219cfb58bFab46Ba7a31073474",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0x377FeeeD4820B3B28D1ab429509e7A0789824fCA",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x52b492a33e447cdb854c7fc19f1e57e8bfa1777d", // BASED PEPE
            pools: [
                {
                    poolAddress: "0x47f6F4b438B9D91E7387d6c1CF953A86BF5de1A5",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x0FB597D6cFE5bE0d5258A7f017599C2A4Ece34c7",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", // VIRTUAL
            pools: [
                {
                    poolAddress: "0xC200F21EfE67c7F41B81A854c26F9cdA80593065",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x21594b992F68495dD28d605834b58889d0a727c7",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0xb909F567c5c2Bb1A4271349708CC4637D7318b4A",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x9c087Eb773291e50CF6c6a90ef0F4500e349B903",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0x1D4daB3f27C7F656b6323C1D6Ef713b48A8f72F1",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0xE31c372a7Af875b3B5E0F3713B17ef51556da667",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
        {
            address: "0x2da56acb9ea78330f947bd57c54119debda7af71", // MOG
            pools: [
                {
                    poolAddress: "0xC29dc26B28FFF463e32834Ce6325B5c74fAC7098",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0x4A311ac4563abc30E71D0631C88A6232C1309ac5",
                    isCL: false,
                    shortTwap: 0,
                    twapChecks: [{ duration: 0, maxDeviation: 0 }],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.AERODROME,
                },
                {
                    poolAddress: "0xC5C5F65927a4011864fcB261D7499267e101118F",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
                {
                    poolAddress: "0xE0762Ad040bb6f8B22ec4A20fD1a1C7E74C6ac6E",
                    isCL: true,
                    shortTwap: 60,
                    twapChecks: [
                        { duration: 3600, maxDeviation: ethers.utils.parseUnits("0.05", 18) },
                    ],
                    baseAsset: "0x4200000000000000000000000000000000000006",
                    protocol: Protocol.UNISWAP,
                },
            ],
        },
    ];

    // 6. Configure tokens on the oracle contract.
    for (const config of tokenConfigurations) {
        console.log(`Configuring token: ${config.address}`);
        const tx = await oracle.configureToken(config.address, config.pools);
        await tx.wait();
        console.log(`Configured token: ${config.address}`);
    }

    // 7. Once configuration is complete, transfer ownership from the deployer to the multisig.
    console.log(`Transferring ownership to multisig: ${BASE_OWNER_MULTISIG_ADDRESS}`);
    const txOwnership = await oracle.transferOwnership(BASE_OWNER_MULTISIG_ADDRESS);
    await txOwnership.wait();
    console.log(`Ownership transferred to multisig: ${BASE_OWNER_MULTISIG_ADDRESS}`);
};

module.exports.tags = ["base-oracle"];
