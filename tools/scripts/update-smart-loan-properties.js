export default function updateSmartLoanProperties(poolAddress, dpRouterAddress, yieldYakRouter) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/SmartLoanProperties.sol', 'utf8')

    let result = data.replace(/return Pool(.*);/g,
        'return Pool(' + poolAddress + ');');

    result = result.replace(/return IYieldYakRouter(.*);/g,
        'return IYieldYakRouter(' + yieldYakRouter + ');');

    result = result.replace(/return DPRouterV1(.*);/g,
        'return DPRouterV1(' + dpRouterAddress + ');');

    fs.writeFileSync('./contracts/SmartLoanProperties.sol', result, 'utf8');

    return 'Properties updated!'
}
