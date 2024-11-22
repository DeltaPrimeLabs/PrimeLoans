const {upgradeProxy} = require("./upgrade-proxy");


module.exports.upgradePangolinIntermediary = function upgradePangolinIntermediary(networkName, contractName) {
    const FACTORY_TUP = require(`../../../deployments/${networkName}/PangolinIntermediaryTUP.json`);

    upgradeProxy(networkName, contractName, FACTORY_TUP, "PangolinIntermediary").then(
        res => console.log(res),
        err => console.error(err)
    )
}

