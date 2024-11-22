const { ethers } = require("hardhat");

async function deployContract(contractName) {
    // We get the name of contract to deploy
    const Contract = await ethers.getContractFactory(contractName);
    const contract = await Contract.deploy();

    console.log("Contract deployed to:", contract.address);
}

export function deploy(name) {
    deployContract(name)
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
