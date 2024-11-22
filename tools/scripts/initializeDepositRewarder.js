const fs = require('fs');
const { ethers } = require('ethers');

// Load JSON data
const data = JSON.parse(fs.readFileSync('token_holders.json'));

// Define the ABI
const abi = [
    "function addDeposits(address[] memory accounts) external"
];

// Define your provider and signer
const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/avalanche');
const wallet = (new ethers.Wallet("<WALLET_KEY>"))
    .connect(provider);

// Define the contract address and create a contract instance
const contractAddress = '0x8D40B3475b8bE805A35ae4102c69Dfa80421EEC2'; // Replace with your contract address
const contract = new ethers.Contract(contractAddress, abi, wallet);

async function processBatches() {
    const batchSize = 300;
    const totalBatches = Math.ceil(data.length / batchSize);
    let processedBatches = 0;
    let totalProcessingTime = 0;

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        try {
            const startTime = Date.now();
            const tx = await contract.addDeposits(batch);
            console.log(`Batch ${processedBatches + 1}/${totalBatches} sent, waiting for confirmation...`);

            const receipt = await provider.waitForTransaction(tx.hash);
            const endTime = Date.now();
            const processingTime = (endTime - startTime) / 1000; // Convert to seconds

            totalProcessingTime += processingTime;
            const averageProcessingTime = totalProcessingTime / (processedBatches + 1);

            if (receipt.status === 1) {
                console.log(`Batch ${processedBatches + 1}/${totalBatches} confirmed in ${processingTime.toFixed(2)} seconds`);
            } else {
                console.error(`Batch ${processedBatches + 1}/${totalBatches} failed`);
            }

            processedBatches++;
            console.log(`Progress: ${(processedBatches / totalBatches * 100).toFixed(2)}%`);

            const remainingBatches = totalBatches - processedBatches;
            const estimatedTimeRemaining = averageProcessingTime * remainingBatches / 60; // Convert to minutes
            console.log(`Estimated time remaining: ${estimatedTimeRemaining.toFixed(2)} minutes`);
        } catch (error) {
            console.error(`Error processing batch ${processedBatches + 1}:`, error);
        }
    }
}

processBatches().then(() => {
    console.log('All batches processed');
}).catch(error => {
    console.error('Error in processing batches:', error);
});
