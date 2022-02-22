module.exports.getChainIdForNetwork = function getChainIdForNetwork(networkName) {
  switch (networkName) {
    case 'localhost':
      return 1337;
    case 'fuji':
      return 43113;
  }
}

module.exports.getUrlForNetwork = function getUrlForNetwork(networkName) {
  switch (networkName) {
    case 'localhost':
      return 'http://localhost:8545';
    case 'fuji':
      return 'https://api.avax-test.network/ext/bc/C/rpc';
  }
}
