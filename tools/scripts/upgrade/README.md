NETWORK_NAME should be defined the same way as in `hardhat.config.ts`

####1. Check `.admin` and `.deployer` addresses in `.secrets/{NETWORK_NAME}`

####2. Update contracts JSONs directory for frontend in `webpack.common.js` (`@contracts`)

####3. Deploy main contracts

    npx hardhat deploy --network NETWORK_NAME --tags init

####4. Deploy upgraded contracts

Location is `deploy/upgrade` directory. For Competition contracts tag is `competition`

    npx hardhat deploy --network NETWORK_NAME --tags TAG_NAME

####5. Upgrade pool

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-pool.js").upgradePool("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-pool.js').upgradePool('NETWORK_NAME', "UPGRADE_CONTRACT_NAME')"


####6. Upgrade SmartLoansFactory

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loans-factory.js").upgradeSmartLoansFactory("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loans-factory.js').upgradeSmartLoansFactory('NETWORK_NAME', 'UPGRADE_CONTRACT_NAME')"


####7. Deploy new Smart Loan implementation

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loan.js").upgradeSmartLoan("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loan.js').upgradeSmartLoan('NETWORK_NAME', 'UPGRADE_CONTRACT_NAME')"

####8. Upgrade PangolinIntermediary

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-pangolin-exchange.js").upgradePangolinIntermediary("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-pangolin-exchange.js').upgradePangolinIntermediary('NETWORK_NAME', 'UPGRADE_CONTRACT_NAME')"
