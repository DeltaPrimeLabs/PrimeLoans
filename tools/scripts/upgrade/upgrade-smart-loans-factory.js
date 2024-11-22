const {upgradeProxy} = require("./upgrade-proxy");


module.exports.upgradeSmartLoansFactory = function upgradeSmartLoansFactory(networkName, contractName) {
    const FACTORY_TUP = require(`../../../deployments/${networkName}/SmartLoansFactoryTUP.json`);

    upgradeProxy(networkName, contractName, FACTORY_TUP, "SmartLoansFactory").then(
        res => console.log(res),
        err => console.error(err)
    )
}

