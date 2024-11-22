export default function updateConstants(chain, exchanges, tokenManager, addressProviderAddress, diamondBeaconAddress, smartLoansFactoryAddress, maxLTV, maxSelloutHealthRatio, maxLiquidationBonus, nativeAssetSymbol, nativeAssetAddress) {
    var fs = require('fs')
    const replace = require('replace-in-file');

    replace.sync({
        files: './contracts/**/*.sol',
        from: /lib\/.*\/DeploymentConstants\.sol/g,
        to: `lib/${chain}/DeploymentConstants.sol`,
    });

    replace.sync({
        files: './contracts/**/*.sol',
        from: /_MAX_HEALTH_AFTER_LIQUIDATION = .*/g,
        to: `_MAX_HEALTH_AFTER_LIQUIDATION = ${maxSelloutHealthRatio};`,
    });

    replace.sync({
        files: './contracts/**/*.sol',
        from: /_MAX_LIQUIDATION_BONUS = .*/g,
        to: `_MAX_LIQUIDATION_BONUS = ${maxLiquidationBonus};`,
    });

    let constantsFile = fs.readFileSync(`./contracts/lib/${chain}/DeploymentConstants.sol`, 'utf8')

    let fileArray = constantsFile.split('\n');

    //Pool Manager

    let lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_TOKEN_MANAGER_ADDRESS')
    );

    let newLine = `    address private constant _TOKEN_MANAGER_ADDRESS = ${tokenManager};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    // Address Provider

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_ADDRESS_PROVIDER')
    );

    newLine = `    address private constant _ADDRESS_PROVIDER = ${addressProviderAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //SmartLoansFactory address

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_SMART_LOANS_FACTORY_ADDRESS =')
    );

    newLine = `    address private constant _SMART_LOANS_FACTORY_ADDRESS = ${smartLoansFactoryAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //Diamond beacon address

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_DIAMOND_BEACON_ADDRESS =')
    );

    newLine = `    address private constant _DIAMOND_BEACON_ADDRESS = ${diamondBeaconAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    // native asset

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_NATIVE_TOKEN_SYMBOL')
    );

    newLine = `    bytes32 private constant _NATIVE_TOKEN_SYMBOL = '${nativeAssetSymbol}';`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_NATIVE_ADDRESS')
    );

    newLine = `    address private constant _NATIVE_ADDRESS = ${nativeAssetAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //write changes to DeploymentConstants.sol

    let result = fileArray.join("\n");

    fs.writeFileSync(`./contracts/lib/${chain}/DeploymentConstants.sol`, result, 'utf8');

    // exchanges

    for (const exchange of exchanges) {
        let exchangeContract = fs.readFileSync(exchange.facetPath, 'utf8');
        let fileArray = exchangeContract.split('\n');
        lineWithFunctionDeclaration = fileArray.findIndex(
            line => line.includes('getExchangeIntermediary')
        );

        newLine = `        return ${exchange.contractAddress};`;

        fileArray.splice(lineWithFunctionDeclaration + 1, 1, newLine);

        fs.writeFileSync(exchange.facetPath, fileArray.join("\n"), 'utf8');
    }

    return `./contracts/lib/${chain}/DeploymentConstants.sol, PangolinIntermediary.sol and UbeswapIntermediary.sol updated!`;
}