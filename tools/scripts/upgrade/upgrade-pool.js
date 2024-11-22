const {upgradeProxy} = require("./upgrade-proxy");


module.exports.upgradePool = function upgradePool(networkName, contractName) {
    const POOL_TUP = require(`../../../deployments/${networkName}/WavaxPoolTUP.json`);

    upgradeProxy(networkName, contractName, POOL_TUP, "Pool").then(
        res => console.log(res),
        err => console.error(err)
    )
}

