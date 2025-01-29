import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import "hardhat-watcher";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "hardhat-interface-generator";
// import * as tdly from "@tenderly/hardhat-tenderly";
// tdly.setup({ automaticVerifications: false });
require('hardhat-deploy');

const fs = require('fs');
function getKey(network: string, filename: string) { return fs.readFileSync(`.secrets/${network}/${filename}`).toString().trim() }

export default {
  solidity: {
    compilers: [
      {
        version: "0.4.18",
      },
      {
        version: "0.7.6",
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10
          }
        }
      },
    ]
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: "https://arb1.arbitrum.io/rpc",
      },
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      timeout: 1800000,
      url: 'http://127.0.0.1:8545/',
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      // accounts: [getKey('avalanche', 'deployer'), getKey('avalanche', 'admin')]
    },
    arbitrum_devnet: {
      timeout: 1800000,
      url: 'https://rpc.vnet.tenderly.co/devnet/arbi-0-gas/f5ecbccf-4ea7-4e7f-9faf-34c49ccc1121',
      chainId: 42161,
      // accounts: [getKey('arbitrum', 'deployer'), getKey('arbitrum', 'admin')]
    },
    arbitrum: {
      timeout: 1800000,
      url: 'https://nd-762-566-527.p2pify.com/4514bd12de6723b94346752e90e95cf4',
      gasPrice: 100000000,
      chainId: 42161,
      accounts: [getKey('arbitrum', 'deployer'), getKey('arbitrum', 'admin')]
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: [getKey('fuji', 'deployer'), getKey('fuji', 'admin')]
    },
    base: {
      url: 'https://mainnet.base.org',
      chainId: 8453,
      accounts: [getKey('base', 'deployer'), getKey('base', 'admin')]
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      gasPrice: 100000000000,
      chainId: 43114,
      accounts: [getKey('avalanche', 'deployer'), getKey('avalanche', 'admin')]
    },
    mainnet_test: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      gasPrice: 100000000000,
      chainId: 43114,
      accounts: [getKey('avalanche', 'deployer'), getKey('avalanche', 'admin')]
    }
  },
  paths: {
    tests: "./test"
  },
  watcher: {
    compilation: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
    ci: {
      tasks: [
        "clean",
        {command: "compile", params: {quiet: true}},
        {command: "test", params: {noCompile: true}}
      ],
    },
    test: {
      tasks: [{command: 'test', params: {noCompile: true, testFiles: ['{path}']}}],
      files: ['./test/*.ts'],
      verbose: true
    }
  },
  mocha: {
    "allow-uncaught": true,
    timeout: 5000000
  },
  namedAccounts: {
      deployer: 0,
      admin: 1
  },
  etherscan: {
    apiKey: {
      base: "<READCETD>",
      avalanche: "8ZZX5UV18YJKIK4FNQCF3M699VU5D6AGC4",
      arbitrumOne: "XGXPCAQEJHHTZWC6YBR8JMX8HWZW61RGAQ",
      avalancheFujiTestnet: "8ZZX5UV18YJKIK4FNQCF3M699VU5D6AGC4"
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
  deploy: {
    skipIfAlreadyDeployed: true
  }
};
