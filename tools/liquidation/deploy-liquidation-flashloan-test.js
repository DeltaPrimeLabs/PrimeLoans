const {deployLiquidationFlashloan} = require('./deploy-liquidation-flashloan');

deployLiquidationFlashloan('0xf3cdfA877bB0615b50D066e41404668f016feE1E').then(console.log);

// npx hardhat run tools/scripts/deploy-liquidation-flashloan-test.js --network localhost