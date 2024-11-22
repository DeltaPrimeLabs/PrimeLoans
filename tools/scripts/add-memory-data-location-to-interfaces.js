import {execSync} from "child_process";
let fs = require('fs')
let path = require('path')

function fixDataLocation() {
    const dir = './contracts/interfaces/facets'
    const files = fs.readdirSync(dir)

    for (const file of files) {
        let changes = 0;
        let fullPath = path.join(dir, file)
        console.log(`Processing interface: ${fullPath}`)
        let data = fs.readFileSync(fullPath, 'utf8')
        let fileArray = data.split('\n');
        fileArray.forEach((element, index) => {
            if(element.includes('uint256[]') && !element.includes('uint256[] memory')) {
                fileArray[index] = fileArray[index].replace('uint256[]', 'uint256[] memory')
                changes++
            } else if (element.includes('uint256[')) {
                console.log(`before: ${fileArray[index]}`)
                fileArray[index] = fileArray[index].replace(/uint256\[(.*)\]/, `uint256[${element[element.indexOf('uint256[') + 8]}] memory`)
                console.log(`after: ${fileArray[index]}`)
                changes++
            }
            if(element.includes('bytes32[]') && !element.includes('bytes32[] memory')) {
                fileArray[index] = fileArray[index].replace('bytes32[]', 'bytes32[] memory')
                changes++
            }
        })
        let result = fileArray.join("\n");

        fs.writeFileSync(fullPath, result, 'utf8');
        console.log(`Interface processed (${changes} changes) and saved to: ${fullPath}`)
    }
    return 'interfaces updated!'
}

function fixPayableFunctions(payableFunctions) {
    const dir = './contracts/interfaces/facets'
    const files = fs.readdirSync(dir)

    for (const file of files) {
        let changes = 0;
        let fullPath = path.join(dir, file)
        console.log(`Processing interface: ${fullPath}`)
        let data = fs.readFileSync(fullPath, 'utf8')
        let fileArray = data.split('\n');
        let newFileArray = []
        fileArray.forEach((element, index) => {
            let elementToPush = element;
            let payableAdded = false;
            for (const func of payableFunctions) {
                if (element.includes(func)) {
                    console.log(`Adding payable to function: ${func}`)
                    newFileArray.push(elementToPush.replace('external', 'payable external'));
                    payableAdded = true;
                    changes++;
                    break;
                }
            }
            if(!payableAdded) {
                newFileArray.push(elementToPush);
            }

        })
        let result = newFileArray.join("\n");

        fs.writeFileSync(fullPath, result, 'utf8');
        console.log(`Interface processed, added payable to ${changes} functions and saved to: ${fullPath}`)
    }
}

function generateFacetsInterfaces(facetsList) {
    for (const facet of facetsList) {
        const output = execSync(`npx hardhat gen-interface ${facet}`, { encoding: 'utf-8' });
        console.log(output)
        let oldPath = path.join('./contracts/facets', `I${facet}.sol`);
        let newPath = path.join('./contracts/interfaces/facets', `I${facet}.sol`);
        fs.rename(oldPath, newPath, (err) => {if(err !== null) console.log(err)});
        console.log(`Moved ${oldPath} -> ${newPath}`)
    }

}

function removeObsoleteFunctions(functionsToRemove) {
    const dir = './contracts/interfaces/facets'
    const files = fs.readdirSync(dir)

    for (const file of files) {
        let changes = 0;
        let fullPath = path.join(dir, file)
        console.log(`Processing interface: ${fullPath}`)
        let data = fs.readFileSync(fullPath, 'utf8')
        let fileArray = data.split('\n');
        let newFileArray = []
        fileArray.forEach((element, index) => {
           let shouldInclude = true;
           for (const func of functionsToRemove) {
               if (element.includes(func)) {
                   console.log(`Removing: ${func}`)
                   shouldInclude = false;
                   changes++;
                   break;
               }
           }
           if (shouldInclude === true) {
               newFileArray.push(element);
           }
        })
        let result = newFileArray.join("\n");

        fs.writeFileSync(fullPath, result, 'utf8');
        console.log(`Interface processed, removed ${changes} functions and saved to: ${fullPath}`)
    }
}

function createFacetsInterfaces() {
    const facetsList = [
        'AssetsOperationsFacet',
        'OwnershipFacet',
        'PangolinDEXFacet',
        'TraderJoeDEXFacet',
        'UbeswapDEXFacet',
        'SmartLoanLiquidationFacet',
        'SmartLoanViewFacet',
        'SolvencyFacet'
    ]
    const functionsToRemove = [
        '_getLTV',
        'routerContractAddress',
        'isTimestampValid',
        'isSignerAuthorized',
        'getExchangeIntermediary',
        'getMaxDataTimestampDelay',
        'getERC20TokenInstance',
    ]
    const payableFunctions = [
        'deposit',
        'repay',
        'depositNativeToken',
        'unsafeLiquidateLoan',
        'liquidateLoan',
        'unwrapAndWithdraw',
    ]
    generateFacetsInterfaces(facetsList);
    fixDataLocation();
    removeObsoleteFunctions(functionsToRemove);
    fixPayableFunctions(payableFunctions);
}

module.exports.generateFacetsInterfaces = generateFacetsInterfaces;
module.exports.fixDataLocation = fixDataLocation;
module.exports.removeObsoleteFunctions = removeObsoleteFunctions;
module.exports.createFacetsInterfaces = createFacetsInterfaces;