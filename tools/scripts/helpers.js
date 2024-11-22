module.exports.getChainIdForNetwork = function getChainIdForNetwork(networkName) {
  switch (networkName) {
    case 'localhost':
      return 1337;
    case 'fuji':
      return 43113;
    case 'mainnet':
      return 43114;
    case 'avalanche':
      return 43114;
  }
}

module.exports.getUrlForNetwork = function getUrlForNetwork(networkName) {
  switch (networkName) {
    case 'localhost':
      return 'http://localhost:8545';
    case 'fuji':
      return 'https://api.avax-test.network/ext/bc/C/rpc';
    case 'mainnet':
      return 'https://api.avax.network/ext/bc/C/rpc';
    case 'avalanche':
      // return 'https://api.avax.network/ext/bc/C/rpc';
      return 'https://rpc.ankr.com/avalanche';
    case 'arbitrum':
        return 'https://rpc.ankr.com/arbitrum';
  }
}
