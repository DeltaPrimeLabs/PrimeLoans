const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ERC20 ABI for symbol() function
const ERC20_ABI = [
    "function symbol() view returns (string)"
];

// Oracle ABI from your original script
const ORACLE_ABI  = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "DivisionByZero",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EmptyPools",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidBaseAsset",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidInput",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "LengthMismatch",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "MissingBaseAssetPrice",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoValidPrice",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TWAPDeviationTooHigh",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TokenNotConfigured",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint8",
                "name": "version",
                "type": "uint8"
            }
        ],
        "name": "Initialized",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "pool",
                "type": "address"
            }
        ],
        "name": "PoolAdded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "pool",
                "type": "address"
            }
        ],
        "name": "PoolRemoved",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "TokenConfigured",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "TokenRemoved",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "poolAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "bool",
                        "name": "isCL",
                        "type": "bool"
                    },
                    {
                        "internalType": "int24",
                        "name": "tickSpacing",
                        "type": "int24"
                    },
                    {
                        "internalType": "uint32",
                        "name": "shortTwap",
                        "type": "uint32"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint32",
                                "name": "duration",
                                "type": "uint32"
                            },
                            {
                                "internalType": "uint256",
                                "name": "maxDeviation",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct BaseOracle.TWAPCheck[]",
                        "name": "twapChecks",
                        "type": "tuple[]"
                    },
                    {
                        "internalType": "address",
                        "name": "baseAsset",
                        "type": "address"
                    },
                    {
                        "internalType": "enum BaseOracle.Protocol",
                        "name": "protocol",
                        "type": "uint8"
                    }
                ],
                "internalType": "struct BaseOracle.PoolConfig[]",
                "name": "pools",
                "type": "tuple[]"
            }
        ],
        "name": "configureToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "getFullTokenConfig",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "bool",
                        "name": "isConfigured",
                        "type": "bool"
                    },
                    {
                        "components": [
                            {
                                "internalType": "address",
                                "name": "poolAddress",
                                "type": "address"
                            },
                            {
                                "internalType": "bool",
                                "name": "isCL",
                                "type": "bool"
                            },
                            {
                                "internalType": "int24",
                                "name": "tickSpacing",
                                "type": "int24"
                            },
                            {
                                "internalType": "uint32",
                                "name": "shortTwap",
                                "type": "uint32"
                            },
                            {
                                "components": [
                                    {
                                        "internalType": "uint32",
                                        "name": "duration",
                                        "type": "uint32"
                                    },
                                    {
                                        "internalType": "uint256",
                                        "name": "maxDeviation",
                                        "type": "uint256"
                                    }
                                ],
                                "internalType": "struct BaseOracle.TWAPCheck[]",
                                "name": "twapChecks",
                                "type": "tuple[]"
                            },
                            {
                                "internalType": "address",
                                "name": "baseAsset",
                                "type": "address"
                            },
                            {
                                "internalType": "enum BaseOracle.Protocol",
                                "name": "protocol",
                                "type": "uint8"
                            }
                        ],
                        "internalType": "struct BaseOracle.PoolConfig[]",
                        "name": "pools",
                        "type": "tuple[]"
                    }
                ],
                "internalType": "struct BaseOracle.TokenConfig",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "asset",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bool",
                        "name": "useTwapChecks",
                        "type": "bool"
                    },
                    {
                        "internalType": "address[]",
                        "name": "baseAssets",
                        "type": "address[]"
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "baseAssetPrices",
                        "type": "uint256[]"
                    }
                ],
                "internalType": "struct BaseOracle.GetDollarValueParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "getTokenDollarPrice",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_initialOwner",
                "type": "address"
            }
        ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "enum BaseOracle.Protocol",
                "name": "",
                "type": "uint8"
            }
        ],
        "name": "quoterConfigs",
        "outputs": [
            {
                "internalType": "address",
                "name": "clQuoter",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "removeToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "tokenConfigs",
        "outputs": [
            {
                "internalType": "bool",
                "name": "isConfigured",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const Protocol = {
    UNISWAP: 0,
    AERODROME: 1
};

// Configuration object for all tokens
const tokenConfigurations = [
    {
        address: "0x768be13e1680b5ebe0024c42c896e3db59ec0149", //SKI
        pools: [
            {
                poolAddress: "0xe782B72A1157b7bEa1A9452835Cce214962aD43B",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x6d6391B9bD02Eefa00FA711fB1Cb828A6471d283",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            },
        ]
    },
    {
        address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", //DEGEN
        pools: [
            {
                poolAddress: "0xaFB62448929664Bfccb0aAe22f232520e765bA88",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x2C4909355b0C036840819484c3A882A95659aBf3",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0xc9034c3E7F58003E6ae0C8438e7c8f4598d5ACAA",
                isCL: true,
                tickSpacing: 60,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            }
        ]
    },
    {
        address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4", //TOSHI
        pools: [
            {
                poolAddress: "0x74E4c08Bb50619b70550733D32b7e60424E9628e",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x4b0Aaf3EBb163dd45F663b38b6d93f6093EBC2d3",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            },
            {
                poolAddress: "0x5aa4AD647580bfE86258d300Bc9852F4434E2c61",
                isCL: true,
                tickSpacing: 60,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            },
            {
                poolAddress: "0xFc131B9981fB053C2cAb7373DAf70DeF1436c4BB",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                protocol: Protocol.UNISWAP
            }
        ]
    },
    {
        address: "0x9a26f5433671751c3276a065f57e5a02d2817973", //KEYCAT
        pools: [
            {
                poolAddress: "0xB211a9DDff3a10806c8fdb92Dbc4c34596A23F84",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0xd82403772cB858219cfb58bFab46Ba7a31073474",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            },
            {
                poolAddress: "0x377FeeeD4820B3B28D1ab429509e7A0789824fCA",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            }
        ]
    },
    {
        address: "0x52b492a33e447cdb854c7fc19f1e57e8bfa1777d", //BASED PEPE
        pools: [
            {
                poolAddress: "0x47f6F4b438B9D91E7387d6c1CF953A86BF5de1A5",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x0FB597D6cFE5bE0d5258A7f017599C2A4Ece34c7",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            }
        ]
    },
    {
        address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", //VIRTUAL
        pools: [
            {
                poolAddress: "0xC200F21EfE67c7F41B81A854c26F9cdA80593065",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x21594b992F68495dD28d605834b58889d0a727c7",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x9c087Eb773291e50CF6c6a90ef0F4500e349B903",
                isCL: true,
                tickSpacing: 10,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            },
            {
                poolAddress: "0xE31c372a7Af875b3B5E0F3713B17ef51556da667",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            }
        ]
    },
    {
        address: "0x2da56acb9ea78330f947bd57c54119debda7af71", //MOG
        pools: [
            {
                poolAddress: "0xC29dc26B28FFF463e32834Ce6325B5c74fAC7098",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x4A311ac4563abc30E71D0631C88A6232C1309ac5",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0xC5C5F65927a4011864fcB261D7499267e101118F",
                isCL: true,
                tickSpacing: 200,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            },
            {
                poolAddress: "0xE0762Ad040bb6f8B22ec4A20fD1a1C7E74C6ac6E",
                isCL: true,
                tickSpacing: 60,
                shortTwap: 60,
                twapChecks: [
                    {
                        duration: 3600,
                        maxDeviation: ethers.utils.parseUnits("0.05", 18)
                    }
                ],
                baseAsset: "0x4200000000000000000000000000000000000006",
                protocol: Protocol.UNISWAP
            }
        ]
    },
];

async function main() {
    // Setup provider - you'll need to modify this based on your network
    const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");

    // Initialize the oracle interface
    const oracleInterface = new ethers.utils.Interface(ORACLE_ABI);

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "oracle-configs");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Process each token configuration
    for (const tokenConfig of tokenConfigurations) {
        try {
            // Create ERC20 contract instance
            const tokenContract = new ethers.Contract(
                tokenConfig.address,
                ERC20_ABI,
                provider
            );

            // Get token symbol
            const symbol = await tokenContract.symbol();

            // Generate calldata
            const calldata = oracleInterface.encodeFunctionData(
                "configureToken",
                [tokenConfig.address, tokenConfig.pools]
            );

            // Create output object
            const output = {
                token: {
                    address: tokenConfig.address,
                    symbol: symbol
                },
                calldata: calldata,
                pools: tokenConfig.pools
            };

            // Write to file
            const filename = `${symbol.toLowerCase()}_oracle_config.json`;
            fs.writeFileSync(
                path.join(outputDir, filename),
                JSON.stringify(output, null, 2)
            );

            console.log(`Generated config for ${symbol} (${tokenConfig.address})`);
        } catch (error) {
            console.error(`Error processing token ${tokenConfig.address}:`, error);
        }
    }
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });