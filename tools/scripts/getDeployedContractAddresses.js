// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const path = require('path');
const fs = require('fs');
const chain = 'arbitrum'
const explorer = chain === 'arbitrum' ? 'arbiscan' : 'snowtrace'

// Specify the directory
const directoryPath = `/Users/kamilovsky/WebstormProjects/deltaprime-primeloans/deployments/${chain}`;

// Initialize the lists
let filenames = [];
let addresses = [];
let links = [];

async function main() {
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }

        // Loop through all the files in the directory
        files.forEach((file) => {
            // Only process .json files
            if (path.extname(file) === '.json') {
                // Read the file
                let rawdata = fs.readFileSync(path.join(directoryPath, file));
                let json = JSON.parse(rawdata);

                // Add the filename (without extension) to the list
                filenames.push(path.basename(file, '.json'));

                // Add the address to the list
                addresses.push(json.address);

                // Construct the link and add it to the list
                links.push(`[${json.address}](https://${explorer}.io/address/${json.address})`);
            }
        });

        // Print the lists
        console.log('Filenames:');
        for(const x of filenames){
            console.log(x)
        }
        console.log('Addresses:');
        for(const x of addresses){
            console.log(x)
        }
        console.log('Links:');
        for(const x of links){
            console.log(x)
        }
    });
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});