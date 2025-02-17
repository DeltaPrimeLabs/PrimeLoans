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
        address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825",
        pools: [
            {
                poolAddress: "0xF3E7E359b75a7223BA9D71065C57DDd4F5D8747e",
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
                poolAddress: "0x22A52bB644f855ebD5ca2edB643FF70222D70C31",
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
                poolAddress: "0xf1Fdc83c3A336bdbDC9fB06e318B08EadDC82FF4",
                isCL: true,
                tickSpacing: 60,
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
        address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
        pools: [
            {
                poolAddress: "0x43BBb129b56A998732767725A183b7a566843dBA",
                isCL: false,
                tickSpacing: 0,
                shortTwap: 0,
                twapChecks: [
                    {
                        duration: 0,
                        maxDeviation: 0
                    }
                ],
                baseAsset: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
                protocol: Protocol.AERODROME
            },
            {
                poolAddress: "0x4e829F8A5213c42535AB84AA40BD4aDCCE9cBa02",
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
                poolAddress: "0xBA3F945812a83471d709BCe9C3CA699A19FB46f7",
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
                poolAddress: "0x76Bf0abD20f1e0155Ce40A62615a90A709a6C3D8",
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
    }
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