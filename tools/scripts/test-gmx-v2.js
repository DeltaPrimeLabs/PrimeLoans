import hre, {ethers} from "hardhat";
import verifyContract from "./verify-contract";
import {deploy} from "./deploy-contract";
const fromWei = val => parseFloat(ethers.utils.formatEther(val));

const fs = require("fs");
export const toWei = ethers.utils.parseUnits;

const jsonRPC = "https://arb1.arbitrum.io/rpc";
const key = fs.readFileSync("./.secret-2").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const TEST_CONTRACT_ADDRESS = '0xd476c6Bcb7e6d53D08355f89f5553107630b76c7';
const abi = [
    {
        "inputs": [
            {
                "internalType": "contract Router",
                "name": "_router",
                "type": "address"
            },
            {
                "internalType": "contract RoleStore",
                "name": "_roleStore",
                "type": "address"
            },
            {
                "internalType": "contract DataStore",
                "name": "_dataStore",
                "type": "address"
            },
            {
                "internalType": "contract EventEmitter",
                "name": "_eventEmitter",
                "type": "address"
            },
            {
                "internalType": "contract IDepositHandler",
                "name": "_depositHandler",
                "type": "address"
            },
            {
                "internalType": "contract IWithdrawalHandler",
                "name": "_withdrawalHandler",
                "type": "address"
            },
            {
                "internalType": "contract IOrderHandler",
                "name": "_orderHandler",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "adjustedClaimableAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "claimedAmount",
                "type": "uint256"
            }
        ],
        "name": "CollateralAlreadyClaimed",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            }
        ],
        "name": "DisabledFeature",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "market",
                "type": "address"
            }
        ],
        "name": "DisabledMarket",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "market",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "EmptyAddressInMarketTokenBalanceValidation",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EmptyDeposit",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EmptyHoldingAddress",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EmptyMarket",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EmptyOrder",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "EmptyReceiver",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "EmptyTokenTranferGasLimit",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketsLength",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "tokensLength",
                "type": "uint256"
            }
        ],
        "name": "InvalidClaimAffiliateRewardsInput",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketsLength",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "tokensLength",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "timeKeysLength",
                "type": "uint256"
            }
        ],
        "name": "InvalidClaimCollateralInput",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketsLength",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "tokensLength",
                "type": "uint256"
            }
        ],
        "name": "InvalidClaimFundingFeesInput",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marketsLength",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "tokensLength",
                "type": "uint256"
            }
        ],
        "name": "InvalidClaimUiFeesInput",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "market",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "expectedMinBalance",
                "type": "uint256"
            }
        ],
        "name": "InvalidMarketTokenBalance",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "market",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "claimableFundingFeeAmount",
                "type": "uint256"
            }
        ],
        "name": "InvalidMarketTokenBalanceForClaimableFunding",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "market",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "collateralAmount",
                "type": "uint256"
            }
        ],
        "name": "InvalidMarketTokenBalanceForCollateralAmount",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "uiFeeFactor",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "maxUiFeeFactor",
                "type": "uint256"
            }
        ],
        "name": "InvalidUiFeeFactor",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "TokenTransferError",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "msgSender",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "role",
                "type": "string"
            }
        ],
        "name": "Unauthorized",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            }
        ],
        "name": "cancelDeposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            }
        ],
        "name": "cancelOrder",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            }
        ],
        "name": "cancelWithdrawal",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "markets",
                "type": "address[]"
            },
            {
                "internalType": "address[]",
                "name": "tokens",
                "type": "address[]"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            }
        ],
        "name": "claimAffiliateRewards",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "markets",
                "type": "address[]"
            },
            {
                "internalType": "address[]",
                "name": "tokens",
                "type": "address[]"
            },
            {
                "internalType": "uint256[]",
                "name": "timeKeys",
                "type": "uint256[]"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            }
        ],
        "name": "claimCollateral",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "markets",
                "type": "address[]"
            },
            {
                "internalType": "address[]",
                "name": "tokens",
                "type": "address[]"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            }
        ],
        "name": "claimFundingFees",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "markets",
                "type": "address[]"
            },
            {
                "internalType": "address[]",
                "name": "tokens",
                "type": "address[]"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            }
        ],
        "name": "claimUiFees",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "receiver",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "callbackContract",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "uiFeeReceiver",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "market",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "initialLongToken",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "initialShortToken",
                        "type": "address"
                    },
                    {
                        "internalType": "address[]",
                        "name": "longTokenSwapPath",
                        "type": "address[]"
                    },
                    {
                        "internalType": "address[]",
                        "name": "shortTokenSwapPath",
                        "type": "address[]"
                    },
                    {
                        "internalType": "uint256",
                        "name": "minMarketTokens",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bool",
                        "name": "shouldUnwrapNativeToken",
                        "type": "bool"
                    },
                    {
                        "internalType": "uint256",
                        "name": "executionFee",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "callbackGasLimit",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct DepositUtils.CreateDepositParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "createDeposit",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "components": [
                            {
                                "internalType": "address",
                                "name": "receiver",
                                "type": "address"
                            },
                            {
                                "internalType": "address",
                                "name": "callbackContract",
                                "type": "address"
                            },
                            {
                                "internalType": "address",
                                "name": "uiFeeReceiver",
                                "type": "address"
                            },
                            {
                                "internalType": "address",
                                "name": "market",
                                "type": "address"
                            },
                            {
                                "internalType": "address",
                                "name": "initialCollateralToken",
                                "type": "address"
                            },
                            {
                                "internalType": "address[]",
                                "name": "swapPath",
                                "type": "address[]"
                            }
                        ],
                        "internalType": "struct BaseOrderUtils.CreateOrderParamsAddresses",
                        "name": "addresses",
                        "type": "tuple"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint256",
                                "name": "sizeDeltaUsd",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "initialCollateralDeltaAmount",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "triggerPrice",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "acceptablePrice",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "executionFee",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "callbackGasLimit",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "minOutputAmount",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct BaseOrderUtils.CreateOrderParamsNumbers",
                        "name": "numbers",
                        "type": "tuple"
                    },
                    {
                        "internalType": "enum Order.OrderType",
                        "name": "orderType",
                        "type": "uint8"
                    },
                    {
                        "internalType": "enum Order.DecreasePositionSwapType",
                        "name": "decreasePositionSwapType",
                        "type": "uint8"
                    },
                    {
                        "internalType": "bool",
                        "name": "isLong",
                        "type": "bool"
                    },
                    {
                        "internalType": "bool",
                        "name": "shouldUnwrapNativeToken",
                        "type": "bool"
                    },
                    {
                        "internalType": "bytes32",
                        "name": "referralCode",
                        "type": "bytes32"
                    }
                ],
                "internalType": "struct BaseOrderUtils.CreateOrderParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "createOrder",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "receiver",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "callbackContract",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "uiFeeReceiver",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "market",
                        "type": "address"
                    },
                    {
                        "internalType": "address[]",
                        "name": "longTokenSwapPath",
                        "type": "address[]"
                    },
                    {
                        "internalType": "address[]",
                        "name": "shortTokenSwapPath",
                        "type": "address[]"
                    },
                    {
                        "internalType": "uint256",
                        "name": "minLongTokenAmount",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "minShortTokenAmount",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bool",
                        "name": "shouldUnwrapNativeToken",
                        "type": "bool"
                    },
                    {
                        "internalType": "uint256",
                        "name": "executionFee",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "callbackGasLimit",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct WithdrawalUtils.CreateWithdrawalParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "createWithdrawal",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "dataStore",
        "outputs": [
            {
                "internalType": "contract DataStore",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "depositHandler",
        "outputs": [
            {
                "internalType": "contract IDepositHandler",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "eventEmitter",
        "outputs": [
            {
                "internalType": "contract EventEmitter",
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
                "internalType": "bytes[]",
                "name": "data",
                "type": "bytes[]"
            }
        ],
        "name": "multicall",
        "outputs": [
            {
                "internalType": "bytes[]",
                "name": "results",
                "type": "bytes[]"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "orderHandler",
        "outputs": [
            {
                "internalType": "contract IOrderHandler",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "roleStore",
        "outputs": [
            {
                "internalType": "contract RoleStore",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "router",
        "outputs": [
            {
                "internalType": "contract Router",
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
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "sendNativeToken",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "sendTokens",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "sendWnt",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "market",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "callbackContract",
                "type": "address"
            }
        ],
        "name": "setSavedCallbackContract",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "uiFeeFactor",
                "type": "uint256"
            }
        ],
        "name": "setUiFeeFactor",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "address[]",
                        "name": "primaryTokens",
                        "type": "address[]"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint256",
                                "name": "min",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "max",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct Price.Props[]",
                        "name": "primaryPrices",
                        "type": "tuple[]"
                    }
                ],
                "internalType": "struct OracleUtils.SimulatePricesParams",
                "name": "simulatedOracleParams",
                "type": "tuple"
            }
        ],
        "name": "simulateExecuteDeposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "address[]",
                        "name": "primaryTokens",
                        "type": "address[]"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint256",
                                "name": "min",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "max",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct Price.Props[]",
                        "name": "primaryPrices",
                        "type": "tuple[]"
                    }
                ],
                "internalType": "struct OracleUtils.SimulatePricesParams",
                "name": "simulatedOracleParams",
                "type": "tuple"
            }
        ],
        "name": "simulateExecuteOrder",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "address[]",
                        "name": "primaryTokens",
                        "type": "address[]"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint256",
                                "name": "min",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "max",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct Price.Props[]",
                        "name": "primaryPrices",
                        "type": "tuple[]"
                    }
                ],
                "internalType": "struct OracleUtils.SimulatePricesParams",
                "name": "simulatedOracleParams",
                "type": "tuple"
            }
        ],
        "name": "simulateExecuteWithdrawal",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "sizeDeltaUsd",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "acceptablePrice",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "triggerPrice",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "minOutputAmount",
                "type": "uint256"
            }
        ],
        "name": "updateOrder",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawalHandler",
        "outputs": [
            {
                "internalType": "contract IWithdrawalHandler",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


function printDecodedArguments(values){
    for(const [index, arg] of Object.entries([
        'receiver',
        'callbackContract',
        'uiFeeReceiver',
        'market',
        'initialLongToken',
        'initialShortToken',
        'longTokenSwapPath',
        'shortTokenSwapPath',
        'minMarketTokens',
        'shouldUnwrapNativeToken',
        'executionFee',
        'callbackGasLimit',
    ])){
        console.log(`${arg}: ${values[0][index]}`)
    }
}
async function deposit() {
    const weth = await ethers.getContractAt("WETH9", '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');
    const tokenAmount = toWei('0.0005');
    const maxFee = toWei('0.0015');
    // await setBalances();
    await weth.connect(wallet).deposit({ value: tokenAmount});
    const testAddress = TEST_CONTRACT_ADDRESS;
    const test = await ethers.getContractAt('TestGmxV2', testAddress)
    await weth.connect(wallet).transfer(testAddress, tokenAmount);

    try {
        await test.connect(wallet).depositEthUsdc(true, tokenAmount, 0, maxFee, { gasLimit: 2000000, value: maxFee });
    } catch (e) {
        console.log(e);
    }
}

async function withdraw() {
    const gmAmount = toWei('0.01');
    const maxFee = toWei('0.0015');
    // await setBalances();
    const testAddress = TEST_CONTRACT_ADDRESS;
    const test = await ethers.getContractAt('TestGmxV2', testAddress)

    try {
        await test.connect(wallet).withdrawEthUsdc(gmAmount, 0, 0, maxFee, { gasLimit: 2000000, value: maxFee });
    } catch (e) {
        console.log(e);
    }
}

async function setBalances() {
    await provider.send(
"tenderly_setBalance",
[
            [
                wallet.address
            ],
            "0x152D02C7E14AF6800000" // 100.000
        ],
    );
}

async function deployContract(contractName) {
    // We get the name of contract to deploy
    let result = await deploy('TestGmxV2', {
        from: deployer,
        // gasLimit: 8000000,
        args: []
    });

    console.log(`Deployed TestGmxV2 at address: ${result.address}`);
}

async function verify() {
    await verifyContract(hre, {
        address: TEST_CONTRACT_ADDRESS
    });
}
// deposit();
// withdraw();

// verify();
