import verifyContract from "../../tools/scripts/verify-contract";

const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
const hre = require("hardhat");
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('PoolWithAccessNFT', './contracts/upgraded');
    embedCommitHash('SmartLoansFactoryWithAccessNFT', './contracts/upgraded');
    embedCommitHash('SmartLoanLimitedCollateral', './contracts/upgraded');
    embedCommitHash('BorrowAccessNFT', './contracts/ERC721');
    embedCommitHash('DepositAccessNFT', './contracts/ERC721');

    let result = await deploy('PoolWithAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: result.address,
        contract: "contracts/upgraded/PoolWithAccessNFT.sol:PoolWithAccessNFT"
    });

    console.log(`Deployed PoolWithAccessNFT implementation at address: ${result.address}`);

    result = await deploy('SmartLoansFactoryWithAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: result.address
    });

    console.log(`Deployed SmartLoansFactoryWithAccessNFT implementation at address: ${result.address}`);

    result = await deploy('SmartLoanLimitedCollateral', {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: result.address
    });

    console.log(`Deployed SmartLoanLimitedCollateral implementation at address: ${result.address}`);

    result = await deploy('BorrowAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: result.address,
        contract: "contracts/ERC721/BorrowAccessNFT.sol:BorrowAccessNFT"
    });

    console.log(`Deployed BorrowAccessNFT at address: ${result.address}`);

    result = await deploy('DepositAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: result.address,
        contract: "contracts/ERC721/DepositAccessNFT.sol:DepositAccessNFT"
    });

    console.log(`Deployed DepositAccessNFT at address: ${result.address}`);

};

module.exports.tags = ['competition'];
