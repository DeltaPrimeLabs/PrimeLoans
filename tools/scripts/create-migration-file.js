import {mkdirSync} from "fs";

export default function createMigrationFile(networkName, contractName, deploymentAddress, transactionHash) {
    var fs = require('fs')

    const path = `./deployments/${networkName}/by-factory`;
    fs.mkdirSync(path, { recursive: true }, (err) => {
        if (err) throw err;
    });

    let json = {};

    json.address = deploymentAddress;
    json.transactionHash = transactionHash;

    fs.writeFileSync(`${path}/${contractName}.json`, JSON.stringify(json), 'utf8');

    return 'Migration JSON file created!'
}
