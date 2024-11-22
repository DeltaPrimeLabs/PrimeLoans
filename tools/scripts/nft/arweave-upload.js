const Arweave = require('arweave');
const fs = require("fs");
const path = require('path');

async function uploadNFTs() {
    const base_path = './tools/scripts/nft/images';

    fs.truncate('./tools/scripts/nft/uris.txt', 0, function(){console.log('File truncated')})

    fs.readdir(base_path, function(err, filenames) {
        if (err) {
            console.log(err)
            return;
        }
        filenames.forEach(async function(filename) {
            uploadNFT(base_path + '/' + filename).then(
                () => console.log('Success for ' + filename),
                err => console.log('Error for ' + filename + ', error message: ' + err)
            )
        });

    });
}

async function uploadNFT(filePath){
    console.log('Loading file from path ', filePath);
    const key = JSON.parse(fs.readFileSync('./.secrets/arweave/deployer.json', 'utf8'));
    const filename = path.parse(path.basename(filePath)).name;
    const metadataPath = `./tools/scripts/nft/metadata-template.json`;
    const attributesPath = `./tools/scripts/nft/metadata/${filename}.json`;
    console.log(`Reading metadata from path: ${metadataPath}`);
    let metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const attributes = JSON.parse(fs.readFileSync(attributesPath, 'utf8'));
    // const nftNumber = filename.substring(
    //     filename.indexOf("_") + 1,
    //     filename.length
    // );
    metadata.attributes = attributes.attributes;
    // metadata.name = `THE TRADER - Player #${nftNumber}/100`
    console.log(`NFT name: ${metadata.name}`)

    const file = fs.readFileSync(filePath);

    const arweave = Arweave.init({
        host: 'arweave.net',
        port: 443,
        protocol: 'https',
        timeout: 60000
    });


    //uploading an NFT file (image etc.)
    console.log('NFT image transaction');
    const transaction = await arweave.createTransaction({
        data: file
    }, key);

    await arweave.transactions.sign(transaction, key);

    let uploader = await arweave.transactions.getUploader(transaction);

    while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }

    await awaitTransaction(arweave, transaction.id);

    //uploading JSON metadata
    console.log('Metadata transaction');

    metadata.image = 'https://arweave.net/' + transaction.id;

    const metadataTransaction = await arweave.createTransaction({
        data: JSON.stringify(metadata)
    }, key);

    await arweave.transactions.sign(metadataTransaction, key);

    await arweave.transactions.post(metadataTransaction);

    await awaitTransaction(arweave, metadataTransaction.id);

    console.log('Successfully uploaded to Arweave! NFT metadata transaction id: ', metadataTransaction.id)

    if (fs.readFileSync('./tools/scripts/nft/uris.txt').length !== 0) {
        fs.appendFileSync('./tools/scripts/nft/uris.txt', '\n');
    }

    fs.appendFile('./tools/scripts/nft/uris.txt', 'https://arweave.net/' + metadataTransaction.id + `|${filename}`, function (err) {
        if (err) throw err;
        console.log('Successfully saved to uris.txt to for transaction id: ' + metadataTransaction.id);
    });
}

async function awaitTransaction(arweave, id) {
    console.log('awaitTransaction, ', id)

    let status = {};

    await sleep(async () => {
        let res = await arweave.transactions.getStatus(id)

        console.log(res)
        status = res;
        console.log('Confirmed: ', status.confirmed);

        //TODO: in production number of confirmation should be 10/20

        if (!status.confirmed || status.confirmed.number_of_confirmations < 1) {
            await awaitTransaction(arweave, id);
        } else {
            console.log('Transaction confirmed, ', id)
            return true;
        }
    });
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sleep(fn) {
    await timeout(30000);
    return fn();
}

uploadNFTs().then(() => console.log('Files uploaded!'));

