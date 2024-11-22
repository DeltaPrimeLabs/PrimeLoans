// RUN: node -r esm -e "require('./tools/scripts/generate-interfaces.js').createFacetsInterfaces()"
import {execSync} from "child_process";
let fs = require('fs')
let path = require('path')

let facetSubDirMapping = {};
let interfaceToImportStatementsMaping = {
    'ISmartLoanViewFacet': 'import "../../facets/SmartLoanViewFacet.sol";'
};

function fixDataLocation() {
    const dir = './contracts/interfaces/facets'
    let files = getAllFiles(dir);
    files = files.map(facetDirName => facetDirName.split('facets')[1].slice(1));

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
                fileArray[index] = fileArray[index].replace(/uint256\[(.*)\]/, `uint256[${element[element.indexOf('uint256[') + 8]}] memory`)
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

// TODO: Add auto import statements for contracts containing structs being used in a given interface
function fixStructTuples() {
    const dir = './contracts/interfaces/facets';
    let files = getAllFiles(dir);
    files = files.map(facetDirName => facetDirName.split('facets')[1].slice(1));

    let structTupleFunctions = [
        'getAllAssetsBalances',
        'getAllAssetsPrices',
    ]

    let funcToStructNameMapping = {
        "getAllAssetsBalances": "SmartLoanViewFacet.AssetNameBalance[] memory",
        "getAllAssetsPrices": "SmartLoanViewFacet.AssetNamePrice[] memory"
    }

    for (const file of files) {
        let changes = 0;
        let fullPath = path.join(dir, file)
        console.log(`Processing interface: ${fullPath}`)
        let data = fs.readFileSync(fullPath, 'utf8')
        let fileArray = data.split('\n');
        let newFileArray = []
        fileArray.forEach((element, index) => {
            let elementToPush = element;
            let tupleStructFixed = false;
            for (const func of structTupleFunctions) {
                if (element.includes(func)) {
                    console.log(`Fixing tuple->struct return type in function: ${func}`)
                    newFileArray.push(elementToPush.replace('tuple[]', funcToStructNameMapping[func]));
                    tupleStructFixed = true;
                    changes++;
                    break;
                }
            }
            if(!tupleStructFixed) {
                newFileArray.push(elementToPush);
            }

        })
        let result = newFileArray.join("\n");

        fs.writeFileSync(fullPath, result, 'utf8');
        console.log(`Interface processed, fixed tuple->struct return type in ${changes} functions and saved to: ${fullPath}`)
    }
}

function fixPayableFunctions(payableFunctions) {
    const dir = './contracts/interfaces/facets';
    let files = getAllFiles(dir);
    files = files.map(facetDirName => facetDirName.split('facets')[1].slice(1));

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
    console.log('Hardhat compile...')
    execSync('npx hardhat compile', { encoding: 'utf-8' });
    for (const facet of facetsList) {
        console.log(`generating interface for ${facet}`);
        const output = execSync(`npx hardhat gen-interface ${facet}`, { encoding: 'utf-8' });
        console.log(output)
        let oldPath = '';
        let newPath = '';
        if(facetSubDirMapping[facet] !== undefined) {
            oldPath = path.join(`./contracts/facets/${facetSubDirMapping[facet]}`, `I${facet}.sol`);
            newPath = path.join(`./contracts/interfaces/facets/${facetSubDirMapping[facet]}`, `I${facet}.sol`);
        } else {
            oldPath = path.join('./contracts/facets', `I${facet}.sol`);
            newPath = path.join('./contracts/interfaces/facets', `I${facet}.sol`);
        }
        fs.rename(oldPath, newPath, (err) => {if(err !== null) console.log(err)});
        console.log(`Moved ${oldPath} -> ${newPath}`)
    }

}

function addMissingImportStatements() {
    console.log('Adding missing import statements...')
    const dir = './contracts/interfaces/facets';
    let files = getAllFiles(dir);
    files = files.map(facetDirName => facetDirName.split('facets')[1].slice(1));

    for (const file of files) {
        let fullPath = path.join(dir, file)
        console.log(`Processing interface: ${fullPath}`)
        let facetName = file.split('.')[0];
        let newFileArray = []

        if(interfaceToImportStatementsMaping[facetName] !== undefined) {
            newFileArray.push(interfaceToImportStatementsMaping[facetName]);

            let data = fs.readFileSync(fullPath, 'utf8')

            let fileArray = data.split('\n');
            newFileArray = newFileArray.concat(fileArray);
            let result = newFileArray.join("\n");

            fs.writeFileSync(fullPath, result, 'utf8');
        }

    }
}

function removeObsoleteFunctions(functionsToRemove) {
    const dir = './contracts/interfaces/facets';
    let files = getAllFiles(dir);
    files = files.map(facetDirName => facetDirName.split('facets')[1].slice(1));

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

function getFacetsList() {
    const dir = './contracts/facets'
    const excludedFiles = [
        'DiamondCutFacet',
        'DiamondLoupeFacet',
    ]
    // return fs.readdirSync(dir, {withFileTypes: true}).filter(file => file.isFile()).map(file => (file.name).split(".")[0]).filter(file => !excludedFiles.includes(file));
    let res = getAllFiles('./contracts/facets');
    res = res.map(facetDirName => facetDirName.split('facets')[1].slice(1).split('.')[0])
        .filter(facet => !excludedFiles.includes(facet))
        .filter(facet => !facet.includes('mock'))
        .map(function (facet) {
            if (facet.includes('\\')) {
                let [facetSubDir, facetName] = facet.split('\\');
                facetSubDirMapping[facetName] = facetSubDir;
                return facetName;
            } else if (facet.includes('/')){
                let [facetSubDir, facetName] = facet.split('/');
                facetSubDirMapping[facetName] = facetSubDir;
                return facetName;
            } else {
                return facet;
            }
        });
    return res;
}

const getAllFiles = function(dirPath, arrayOfFiles) {
    let files = fs.readdirSync(dirPath)

    arrayOfFiles = arrayOfFiles || []

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
        } else {
            arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
        }
    })

    return arrayOfFiles
}

function getContractsPayableMethodsNames(interfaceFullDir) {
    let methodsList = []
    let data = fs.readFileSync(interfaceFullDir, 'utf8');
    let fileArray = data.split('\n');
    for(const line of fileArray) {
        // search for lines that are FUNCTIONS & payable but the payable word is not in the context of an address payable
        if(line.includes("function") && line.includes("payable") && line.substring(line.lastIndexOf("payable") - 8, 7) !== "address") {
            methodsList.push(line.split("function")[1].split(" ")[1].split("(")[0]);
        }
    }
    return methodsList;
}

function createFacetsInterfaces() {
    const facetsList = getFacetsList()
    // TODO: Automate obtaining the list
    const functionsToRemove = [
        '_getHealth',
        'executeGetPricesFromMsg',
        'getExchangeIntermediaryContract',
    ]
    let payableFunctions = []
    generateFacetsInterfaces(facetsList);
    facetsList.forEach(el => {
        let result = [];
        if(facetSubDirMapping[el] !== undefined) {
            result = getContractsPayableMethodsNames(`./contracts/facets/${facetSubDirMapping[el]}/${el}.sol`);
        } else {
            result = getContractsPayableMethodsNames(`./contracts/facets/${el}.sol`);
        }
        if (result.length > 0) {
            payableFunctions = payableFunctions.concat(result);
        }

    })
    fixDataLocation();
    removeObsoleteFunctions(functionsToRemove);
    fixPayableFunctions(payableFunctions);
    fixStructTuples();
    addMissingImportStatements();
}

module.exports.createFacetsInterfaces = createFacetsInterfaces;