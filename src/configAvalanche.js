import addresses from '../common/addresses/avalanche/token_addresses.json';
import {
    vectorFinanceBalance,
    yieldYakBalance
} from "./utils/calculate";
import WAVAX_POOL_TUP from '/deployments/avalanche/WavaxPoolTUP.json';
import USDC_POOL_TUP from '/deployments/avalanche/UsdcPoolTUP.json';
import USDT_POOL_TUP from '/deployments/avalanche/UsdtPoolTUP.json';
import BTC_POOL_TUP from '/deployments/avalanche/BtcPoolTUP.json';
import ETH_POOL_TUP from '/deployments/avalanche/EthPoolTUP.json';
import PANGOLIN_INTERMEDIARY_TUP from '/deployments/avalanche/PangolinIntermediaryTUP.json';
import TRADERJOE_INTERMEDIARY_TUP from '/deployments/avalanche/TraderJoeIntermediaryTUP.json';
import subgraphConfig from '../.secrets/subgraph.json';

export default {
    MIN_ALLOWED_HEALTH: 0.0182,
    COMPETITION_START_BLOCK: 14858534,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    disableAWSData: false,
    chainId: 43114,
    chainSlug: 'avalanche',
    notifiEnabled: true,
    // chainId: 1337,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "AVAX": {name: "AVAX", symbol: "AVAX", decimals: 18, address: addresses.AVAX, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:AVAXUSDT"},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:USDCUSDT"},
      "BTC": {name: "BTC", symbol: "BTC", logoExt: "png", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:BTCUSDT"},
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ETHUSDT"},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "COINBASE:USDTUSD"},
      // "USDT.e": {droppingSupport: true, inactive: true, name: "USDT.e", symbol: "USDT.e", decimals: 6, address: addresses['USDT.e'],  isStableCoin: true, debtCoverage: 0, tradingViewSymbol: "TRADERJOE:USDTEUSDT_74B651"},
      "EUROC": {name: "EUROC", symbol: "EUROC", logoExt: "png", decimals: 6, address: addresses.EUROC, debtCoverage: 0.83333333333, groupIdentifier: "EUROC_GROUP", tradingViewSymbol: "COINBASE:EUROCUSD"},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333, swappableAssets: ['BTC', 'ETH', 'USDC'], tradingViewSymbol: ""},
      "sAVAX": {name: "sAVAX", symbol: "sAVAX", decimals: 18, address: addresses.sAVAX, debtCoverage: 0.83333333333, apy: 6.06, tradingViewSymbol: "TRADERJOE:SAVAXWAVAX_4B946C.USD"},
      "yyAVAX": {name: "yyAVAX", symbol: "yyAVAX", logoExt: "png", decimals: 18, address: addresses.yyAVAX, debtCoverage: 0.83333333333, apy: 4.86, tradingViewSymbol: "TRADERJOE:YYAVAXUSDC_0512AB.USD", warning: "This token will be sunsetted soon. Swap to ggAVAX for a Gogopool airdrop."},
      "ggAVAX": {name: "ggAVAX", symbol: "ggAVAX", logoExt: "png", decimals: 18, address: addresses.ggAVAX, debtCoverage: 0.83333333333, apy: 5.04, useParaSwapV2: true },
      "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333, groupIdentifier: "GMX_GROUP", tradingViewSymbol: "BINANCE:GMXUSDT"},
      "JOE": {name: "JOE", symbol: "JOE", logoExt: "png", decimals: 18, address: addresses.JOE, debtCoverage: 0.8, groupIdentifier: "JOE_GROUP", tradingViewSymbol: "BINANCE:JOEUSDT"},
      "QI": {name: "QI", symbol: "QI", logoExt: "svg", decimals: 18, address: addresses.QI, debtCoverage: 0, tradingViewSymbol: "BINANCE:QIUSDT"},
      "PNG": {name: "PNG", symbol: "PNG", logoExt: "png", decimals: 18, address: addresses.PNG, debtCoverage: 0, tradingViewSymbol: "COINBASE:PNGUSD"},
      // "PTP": {droppingSupport: true, name: "PTP", symbol: "PTP", logoExt: "png", decimals: 18, address: addresses.PTP, debtCoverage: 0, tradingViewSymbol: "COINEX:PTPUSDT"},
      "BAL": {unsupported: true, name: "BAL", symbol: "BAL", logoExt: "png", decimals: 18, address: addresses.BAL, debtCoverage: 0, tradingViewSymbol: "BINANCE:BALUSDT"},
      "GGP": {unsupported: true, name: "GGP", symbol: "GGP", logoExt: "png", decimals: 18, address: addresses.GGP, debtCoverage: 0, tradingViewSymbol: "TRADERJOE:GGPWAVAX_AE671E.USD", fetchPrice: true, priceEndpoint: "https://api.gogopool.com/prices", priceJsonField: "ggpInUSD"},
      "WOM": {unsupported: true, name: "WOM", symbol: "WOM", logoExt: "png", decimals: 18, address: addresses.WOM, debtCoverage: 0, tradingViewSymbol: "TRADERJOE:GGPWAVAX_AE671E.USD"},
    },
    RTKN_2_ADDRESS: "0x0E31136cD6742B4656eD46E28306080620eD70a7",
    PRIME: {hide: true, name: "PRIME", symbol: "PRIME", decimals: 18, address: addresses.PRIME},
    SPRIME_CONFIG: {
        default: "TRADERJOEV2",
        TRADERJOEV2: {
            default: "AVAX",
            AVAX: {
                sPrimeAddress: "0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E",
                positionManagerAddress: "0x13652F4a37235293a90a1dE5B878c9435EAf4c58",
                poolAddress: "0x8db6684838dBdA65952ae4bC576503f6eCC03864",
                binStep: 50,
                secondAssetDecimals: 18,
                dexWebsite: "https://lfj.gg/avalanche/trade?chain=avalanche&outputCurrency=0x33C8036E99082B0C395374832FECF70c42C7F298",
                revenueAwsEndpoint: "https://im34modd75.execute-api.eu-west-3.amazonaws.com/processedLiquidationsAvalanche"
            }
        }
    },
    VPRIME_CONFIG: {
        address: "0x228a19fC13932C67D538fEba858359E369e5a197"
    },
    VESTING_CONTRACT_CONFIG: {
        address: "0x881fa171A7b5bf5c84d213043037ab867ce4688c"
    },
    AVALANCHE_BOOST_CONFIG: {
        AVAX: {
            depositRewarderAddress: "0x6373122eD8Eda8ECA439415709318DCB6ddC1af3",
            depositRewarderOldAddress: "0x6d149Fcc150A3B097D7647408345898fe9db1ded",
            rewardToken: "sAVAX",
            duration: 1209600
        },
        USDC: {
            depositRewarderAddress: "0x596f6EFD98daF650CF98A1E62A53AB2a44e7E875",
            depositRewarderOldAddress: "0xB913aC229910d705297DEB1c168af3dA1416B227",
            rewardToken: "ggAVAX",
            duration: 1209600
        },
        USDT: {
            depositRewarderAddress: "0xBC6Ef309f2eC71698eA310D62FF2E0543472D965",
            depositRewarderOldAddress: "0x3750F8d6Df82699ada6bBd1463C4E91fCf37005D",
            rewardToken: "sAVAX",
            duration: 1209600
        },
        BTC: {
            depositRewarderAddress: "0x3FE9BE379eD15962AFAbE01c002B8c433C6Af4ec",
            depositRewarderOldAddress: "0x50b0b59f14bA882BD511Fe08d1cdc975807a94A4",
            rewardToken: "ggAVAX",
            duration: 1209600
        }
    },
    WOMBAT_REWARDS_TOKENS: {
        "WOM": {name: "WOM", symbol: "WOM", logoExt: "png", decimals: 18, address: addresses.WOM},
    },

    SWAP_DEXS_CONFIG: {
        // ParaSwapV2: {
        //     displayName: 'ParaSwap',
        //     availableAssets: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'sAVAX', 'QI', 'PNG', 'yyAVAX', 'ggAVAX'],
        //     slippageMargin: 0.05
        // },
        YakSwap: {
            displayName: 'YakSwap',
            availableAssets: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'EUROC', 'sAVAX', 'GMX', 'JOE', 'QI', 'PNG', 'yyAVAX', 'ggAVAX'],
            slippageMargin: 0.02
        },
        GLP_DIRECT: {
            displayName: 'Direct',
            availableAssets: ['GLP', 'ETH', 'AVAX', 'USDC', 'BTC'],
            coreAsset: 'GLP',
            slippageMargin: 0.02
        },
        GmxV2: {
            availableAssets: [],
            slippageMargin: 0.5
        },
        Wombat: {
            availableAssets: [],
            slippageMargin: 0.02
        }
    },

    SWAP_MODAL_SLIPPAGE_OPTIONS: {
        low: {value: 0.5, name: 'Low', imgSrc: 'src/assets/icons/check.png', tooltip: 'Ideal for stable market conditions and highly liquid tokens. High chance of transaction failing.'},
        medium: {value: 1, name: 'Medium', imgSrc: 'src/assets/icons/warning.svg', tooltip: 'Moderate price adjustment likely. Suitable for relatively steady markets. Moderate chance of transaction failing.'},
        high: {value: 2, name: 'High', imgSrc: 'src/assets/icons/error.svg', tooltip: 'Moderate price adjustment likely. Ideal for relatively steady markets.'},
        extreme: {value: 5, name: 'Extreme', imgSrc: 'src/assets/icons/error.svg', tooltip: 'Significant price variation expected. Recommended for use during more volatile market conditions.'},
    },

    paraSwapDefaultSlippage: 1,
    showParaSwapWarning: true,
    ASSET_FILTER_TOKENS_OPTIONS: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'sAVAX'],
    ASSET_FILTER_DEXES_OPTIONS: ['Pangolin', 'TraderJoe'],
    NATIVE_ASSET_TOGGLE_OPTIONS: ['AVAX', 'WAVAX'],
    WRAPPED_TOKEN_ADDRESS: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    POOLS_CONFIG: {
        AVAX: {
            address: '0xaa39f39802F8C44e48d4cc42E088C09EDF4daad4',
            tokenAddress: addresses.AVAX,
        },
        USDC: {
            address: '0x8027e004d80274FB320e9b8f882C92196d779CE8',
            tokenAddress: addresses.USDC,
        },
        USDT: {
            address: '0x1b6D7A6044fB68163D8E249Bce86F3eFbb12368e',
            tokenAddress: addresses.USDT,
        },
        BTC: {
            address: '0x70e80001bDbeC5b9e932cEe2FEcC8F123c98F738',
            tokenAddress: addresses.BTC,
        },
        ETH: {
            address: '0x2A84c101F3d45610595050a622684d5412bdf510',
            tokenAddress: addresses.ETH
        }
    },
    LP_ASSETS_CONFIG: {
        "PNG_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDC_LP', decimals: 18, address: addresses.PNG_AVAX_USDC_LP, debtCoverage: 0.83333333333},
        // "PNG_AVAX_USDT_LP": { inactive: true, primary: 'USDT', secondary: 'AVAX', name: "AVAX-USDT", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDT_LP', decimals: 18, address: addresses.PNG_AVAX_USDT_LP, debtCoverage: 0.83333333333},
        "PNG_AVAX_ETH_LP": { primary: 'ETH', secondary: 'AVAX', name: "AVAX-ETH", dex: 'Pangolin',  symbol: 'PNG_AVAX_ETH_LP', decimals: 18, address: addresses.PNG_AVAX_ETH_LP, debtCoverage: 0.83333333333},
        // "TJ_AVAX_USDC_LP": { inactive: true, primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDC_LP', decimals: 18, address: addresses.TJ_AVAX_USDC_LP, debtCoverage: 0.83333333333},
        // "TJ_AVAX_USDT_LP": { inactive: true, primary: 'USDT', secondary: 'AVAX', name: "AVAX-USDT", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDT_LP', decimals: 18, address: addresses.TJ_AVAX_USDT_LP, debtCoverage: 0.83333333333},
        // "TJ_AVAX_ETH_LP": { inactive: true, primary: 'ETH', secondary: 'AVAX', name: "AVAX-ETH", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_ETH_LP', decimals: 18, address: addresses.TJ_AVAX_ETH_LP, debtCoverage: 0.83333333333},
        // "TJ_AVAX_BTC_LP": { inactive: true, primary: 'BTC', secondary: 'AVAX', name: "AVAX-BTC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_BTC_LP', decimals: 18, address: addresses.TJ_AVAX_BTC_LP, debtCoverage: 0.83333333333},
        // "TJ_AVAX_sAVAX_LP": { inactive: true, primary: 'sAVAX', secondary: 'AVAX', name: "AVAX-sAVAX", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_sAVAX_LP', decimals: 18, address: addresses.TJ_AVAX_sAVAX_LP, debtCoverage: 0.83333333333},
    },
    CONCENTRATED_LP_ASSETS_CONFIG: {
        // "SHLB_AVAX-USDC_B": {inactive: true, primary: 'AVAX', secondary: 'USDC', name: "AVAX-USDC", dex: 'SteakHut',  symbol: 'SHLB_AVAX-USDC_B', addMethod: 'stakeSteakHutAVAXUSDC', removeMethod: 'unstakeSteakHutAVAXUSDC', decimals: 18, address: addresses["SHLB_AVAX-USDC_B"], tvl: 180000, debtCoverage: 0.83333333333},
        // "SHLB_BTC.b-AVAX_B": { inactive: true, primary: 'BTC', secondary: 'AVAX', name: "BTC.b-AVAX", dex: 'SteakHut',  symbol: 'SHLB_BTC.b-AVAX_B', addMethod: 'stakeSteakHutBTCAVAX', removeMethod: 'unstakeSteakHutBTCAVAX', decimals: 18, address: addresses["SHLB_BTC.b-AVAX_B"], tvl: 44000, debtCoverage: 0.83333333333},
        // "SHLB_USDT.e-USDt_C": { inactive: true, primary: 'USDT.e', secondary: 'USDT', name: "USDT.e-USDT", dex: 'SteakHut',  symbol: 'SHLB_USDT.e-USDt_C', addMethod: 'stakeSteakHutUSDTeUSDT', removeMethod: 'unstakeSteakHutUSDTeUSDT', decimals: 18, address: addresses["SHLB_USDT.e-USDt_C"], tvl: 513000, debtCoverage: 0},
        // "SHLB_EUROC-USDC_V2_1_B": { inactive: true, primary: 'EUROC', secondary: 'USDC', name: "EUROC-USDC", dex: 'SteakHut',  symbol: 'SHLB_EUROC-USDC_V2_1_B', addMethod: 'stakeSteakHutEUROCUSDC', removeMethod: 'unstakeSteakHutEUROCUSDC', decimals: 18, address: addresses["SHLB_EUROC-USDC_V2_1_B"], tvl: 1985000, debtCoverage: 0.83333333333},
    },
    BALANCER_LP_ASSETS_CONFIG: {
        'BAL_sAVAX_AVAX': { primary: 'sAVAX', secondary: 'AVAX', name: 'sAVAX-AVAX', dex: 'Balancer', symbol: 'BAL_sAVAX_AVAX', debtCoverage: 0.83333333333, decimals: 18, tvl: 5350000, address: addresses['BAL_sAVAX_AVAX'], gaugeAddress: addresses['BAL_S_AVAX_MAIN'], rewardTokens: ['QI'], addMethod: 'joinPoolAndStakeBalancerV2', removeMethod: 'unstakeAndExitPoolBalancerV2', gaugeBalanceMethod: 'balancerSAvaxBalance', poolId: '0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c'},
        'BAL_yyAVAX_AVAX': { primary: 'AVAX', secondary: 'yyAVAX', name: 'yyAVAX-AVAX', reverseOrder: true, dex: 'Balancer', symbol: 'BAL_yyAVAX_AVAX', debtCoverage: 0.83333333333, decimals: 18, tvl: 1680000, address: addresses['BAL_yyAVAX_AVAX'], gaugeAddress: addresses['BAL_YY_AVAX_MAIN'], rewardTokens: [], addMethod: 'joinPoolAndStakeBalancerV2', removeMethod: 'unstakeAndExitPoolBalancerV2', gaugeBalanceMethod: 'balancerYyAvaxBalance', poolId: '0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f', firstOfTokensIsPool: true},
        'BAL_ggAVAX_AVAX': { primary: 'ggAVAX', secondary: 'AVAX', name: 'ggAVAX-AVAX', dex: 'Balancer', symbol: 'BAL_ggAVAX_AVAX', debtCoverage: 0.83333333333, decimals: 18, tvl: 3700000, address: addresses['BAL_ggAVAX_AVAX'], gaugeAddress: addresses['BAL_GG_AVAX_MAIN'], rewardTokens: ['GGP'], addMethod: 'joinPoolAndStakeBalancerV2', removeMethod: 'unstakeAndExitPoolBalancerV2', gaugeBalanceMethod: 'balancerGgAvaxBalance', poolId: '0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d'}
    },
    PENPIE_LP_ASSETS_CONFIG: {},
    WOMBAT_LP_ASSETS_CONFIGx: {
        'sAVAX-AVAX': {

        }
    },
    WOMBAT_LP_ASSETS_CONFIG: {
      'sAVAX-AVAX': [
        {
          name: 'sAVAX',
          symbol: 'WOMBAT_sAVAX_AVAX_LP_sAVAX',
          depositMethod: 'depositSavaxToAvaxSavax',
          depositAndStakeMethod: 'depositAndStakeAvaxSavaxLpSavax',
          withdrawMethod: 'withdrawSavaxFromAvaxSavax',
          unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxSavaxLpSavax',
          pendingRewardsMethod: 'pendingRewardsForAvaxSavaxLpSavax',
          poolAddress: '0xE3Abc29B035874a9f6dCDB06f8F20d9975069D87',
          address: addresses['WOMBAT_sAVAX_AVAX_LP_sAVAX'],
          asset: 'sAVAX',
          short: 'Wombat LP',
          decimals: 18,
          apyKey: 'WOM_sAVAX_sAVAX',
          boostGGP: false,
          addTokenApy: true
        },
        {
          name: 'AVAX',
          symbol: 'WOMBAT_sAVAX_AVAX_LP_AVAX',
          depositMethod: 'depositAvaxToAvaxSavax',
          depositAndStakeMethod: 'depositAndStakeAvaxSavaxLpAvax',
          withdrawMethod: 'withdrawAvaxFromAvaxSavax',
          unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxSavaxLpAvax',
          pendingRewardsMethod: 'pendingRewardsForAvaxSavaxLpAvax',
          poolAddress: '0xE3Abc29B035874a9f6dCDB06f8F20d9975069D87',
          address: addresses['WOMBAT_sAVAX_AVAX_LP_AVAX'],
          asset: 'AVAX',
          short: 'Wombat LP',
          decimals: 18,
          apyKey: 'WOM_sAVAX_AVAX',
          boostGGP: false,
          addTokenApy: false
        },
      ],
      'ggAVAX-AVAX': [
        {
          name: 'ggAVAX',
          symbol: 'WOMBAT_ggAVAX_AVAX_LP_ggAVAX',
          depositMethod: 'depositGgavaxToAvaxGgavax',
          depositAndStakeMethod: 'depositAvaxGgavaxLpGgavax',
          withdrawMethod: 'withdrawGgavaxFromAvaxGgavax',
          unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxGgavaxLpGgavax',
          pendingRewardsMethod: 'pendingRewardsForAvaxGgavaxLpGgavax',
          poolAddress: '0xBbA43749efC1bC29eA434d88ebaf8A97DC7aEB77',
          address: addresses['WOMBAT_ggAVAX_AVAX_LP_ggAVAX'],
          asset: 'ggAVAX',
          short: 'Wombat LP',
          decimals: 18,
          apyKey: 'WOM_ggAVAX_ggAVAX',
          boostGGP: false,
          addTokenApy: true,
          aprWarning: false
        },
        {
          name: 'AVAX',
          symbol: 'WOMBAT_ggAVAX_AVAX_LP_AVAX',
          depositMethod: 'depositAvaxToAvaxGgavax',
          depositAndStakeMethod: 'depositAndStakeAvaxGgavaxLpAvax',
          withdrawMethod: 'withdrawAvaxFromAvaxGgavax',
          unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxGgavaxLpAvax',
          pendingRewardsMethod: 'pendingRewardsForAvaxGgavaxLpAvax',
          poolAddress: '0xBbA43749efC1bC29eA434d88ebaf8A97DC7aEB77',
          address: addresses['WOMBAT_ggAVAX_AVAX_LP_AVAX'],
          asset: 'AVAX',
          short: 'Wombat LP',
          decimals: 18,
          apyKey: 'WOM_ggAVAX_AVAX',
          boostGGP: false,
          addTokenApy: false
        },
      ],
    },
    WOMBAT_LP_ASSETS: {
      'WOMBAT_ggAVAX_AVAX_LP_AVAX': { decimals: 18, debtCoverage: 0.83333333333, balanceMethod: 'avaxBalanceAvaxGgavax', pendingRewardsMethod: 'pendingRewardsForAvaxGgavaxLpAvax', short: 'WOMBAT LP', logoExt: 'png', name: 'WOMBAT LP', addTokenApy: false, asset: 'AVAX', apyKey: 'WOM_ggAVAX_AVAX' },
      'WOMBAT_ggAVAX_AVAX_LP_ggAVAX': { decimals: 18, debtCoverage: 0.83333333333, balanceMethod: 'ggAvaxBalanceAvaxGgavax', pendingRewardsMethod: 'pendingRewardsForAvaxGgavaxLpGgavax', short: 'WOMBAT LP', logoExt: 'png', name: 'WOMBAT LP', addTokenApy: true, asset: 'ggAVAX', apyKey: 'WOM_ggAVAX_ggAVAX' },
      'WOMBAT_sAVAX_AVAX_LP_AVAX': { decimals: 18, debtCoverage: 0.83333333333, balanceMethod: 'avaxBalanceAvaxSavax', pendingRewardsMethod: 'pendingRewardsForAvaxSavaxLpAvax', short: 'WOMBAT LP', logoExt: 'png', name: 'WOMBAT LP', addTokenApy: false, asset: 'AVAX', apyKey: 'WOM_sAVAX_AVAX' },
      'WOMBAT_sAVAX_AVAX_LP_sAVAX': { decimals: 18, debtCoverage: 0.83333333333, balanceMethod: 'sAvaxBalanceAvaxSavax', pendingRewardsMethod: 'pendingRewardsForAvaxSavaxLpSavax', short: 'WOMBAT LP', logoExt: 'png', name: 'WOMBAT LP', addTokenApy: true, asset: 'sAVAX', apyKey: 'WOM_sAVAX_sAVAX' },
    },
    TRADERJOEV2_LP_ASSETS_CONFIG: {
        'TJLB_JOE-AVAX_2_2': { primary: 'JOE', secondary: 'AVAX', name: 'JOE-AVAX', dex: 'TraderJoe', version: '2.2', symbol: 'TJLB_JOE-AVAX_2_2', routerAddress: "0x18556DA13313f3532c54711497A8FedAC273220E", debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.25', address: addresses['TJLB_JOE-AVAX_2_2'], hooksSimpleRewarder: "0x0241e3cD944258e7F4658344E17669f3f85F3F43", rewardToken: 'AVAX', binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://lfj.gg/avalanche/pool/v22/0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd/AVAX/25", isIncentivized: true},
        'TJLB_USDT-USDC_2_2': { primary: 'USDT', secondary: 'USDC', name: 'USDT-USDC', dex: 'TraderJoe', version: '2.2',  symbol: 'TJLB_USDT-USDC_2_2', routerAddress: "0x18556DA13313f3532c54711497A8FedAC273220E", debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.01', address: addresses['TJLB_USDT-USDC_2_2'], hooksSimpleRewarder: "0x90014c5E78Bd8a3E2bbBaA8e5a0Aee2C1D2131CD", rewardToken: 'AVAX', binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://lfj.gg/avalanche/pool/v22/0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/1", isIncentivized: true},
        'TJLB_AVAX-USDC': { primary: 'AVAX', secondary: 'USDC', name: 'AVAX-USDC', dex: 'TraderJoe', version: '2.2', symbol: 'TJLB_AVAX-USDC', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.002', address: addresses['TJLB_AVAX-USDC'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://lfj.gg/avalanche/pool/v21/AVAX/0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e/20"},
        'TJLB_ETH-AVAX': { primary: 'ETH', secondary: 'AVAX', name: 'ETH-AVAX', dex: 'TraderJoe', symbol: 'TJLB_ETH-AVAX', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.001', address: addresses['TJLB_ETH-AVAX'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: 'https://lfj.gg/avalanche/pool/v21/0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab/AVAX/10'},
        'TJLB_BTC.b-AVAX': { primary: 'BTC', secondary: 'AVAX', name: 'BTC-AVAX', dex: 'TraderJoe', symbol: 'TJLB_BTCB-AVAX', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.1', address: addresses['TJLB_BTC.b-AVAX'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: 'https://lfj.gg/avalanche/pool/v21/0x152b9d0fdc40c096757f570a51e494bd4b943e50/AVAX/10'},
    },
    LEVEL_LP_ASSETS_CONFIG: {},
    GMX_V2_ASSETS_CONFIG: {
        "GM_AVAX_WAVAX": {isGMXPlus: true, name: "AVAX+", symbol: "GM_AVAX_WAVAX", short: "GM", decimals: 18, address: addresses.GM_AVAX_WAVAX, debtCoverage: 0.83333333333, longToken: 'AVAX', shortToken: 'AVAX', indexTokenAddress: addresses.AVAX, link: 'https://app.gmx.io/#/stats', addMethod: 'depositAvaxGmxV2Plus', removeMethod: 'withdrawAvaxGmxV2Plus'},
        "GM_BTC_BTCb": {isGMXPlus: true, name: "BTC+", symbol: "GM_BTC_BTCb", logoExt: "png", short: "GM", decimals: 18, address: addresses.GM_BTC_BTCb, debtCoverage: 0.83333333333, longToken: 'BTC', shortToken: 'BTC', indexTokenAddress: addresses.BTC, link: 'https://app.gmx.io/#/stats', addMethod: 'depositBtcGmxV2Plus', removeMethod: 'withdrawBtcGmxV2Plus'},
        "GM_ETH_WETHe": {isGMXPlus: true, name: "ETH+", symbol: "GM_ETH_WETHe", short: "GM", decimals: 18, address: addresses.GM_ETH_WETHe, debtCoverage: 0.83333333333, longToken: 'ETH', shortToken: 'ETH', indexTokenAddress: addresses.ETH, link: 'https://app.gmx.io/#/stats', addMethod: 'depositEthGmxV2Plus', removeMethod: 'withdrawEthGmxV2Plus'},
        "GM_AVAX_WAVAX_USDC": {name: "AVAX-USDC", symbol: "GM_AVAX_WAVAX_USDC", short: "GM", decimals: 18, address: addresses.GM_AVAX_WAVAX_USDC, debtCoverage: 0.83333333333, longToken: 'AVAX', shortToken: 'USDC', indexTokenAddress: addresses.AVAX, link: 'https://app.gmx.io/#/stats'},
        "GM_BTC_BTCb_USDC": {name: "BTC-USDC", symbol: "GM_BTC_BTCb_USDC", logoExt: "png", short: "GM", decimals: 18, address: addresses.GM_BTC_BTCb_USDC, debtCoverage: 0.83333333333, longToken: 'BTC', shortToken: 'USDC', indexTokenAddress: addresses.BTC, link: 'https://app.gmx.io/#/stats'},
        "GM_ETH_WETHe_USDC": {name: "ETH-USDC", symbol: "GM_ETH_WETHe_USDC", short: "GM", decimals: 18, address: addresses.GM_ETH_WETHe_USDC, debtCoverage: 0.83333333333, longToken: 'ETH', shortToken: 'USDC', indexTokenAddress: addresses.ETH, link: 'https://app.gmx.io/#/stats'},
    },
    maxTraderJoeV2Bins: 80,
    DEX_CONFIG: {
        'Pangolin': {
            intermediaryAddress: PANGOLIN_INTERMEDIARY_TUP.address,
            routerAddress: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
            swapMethod: 'swapPangolin',
            addLiquidityMethod: 'addLiquidityPangolin',
            removeLiquidityMethod: 'removeLiquidityPangolin',
            logo: 'png.png'
        },
        'TraderJoe': {
            intermediaryAddress: TRADERJOE_INTERMEDIARY_TUP.address,
            routerAddress: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
            addLiquidityMethod: 'addLiquidityTraderJoe',
            removeLiquidityMethod: 'removeLiquidityTraderJoe',
            logo: 'joe.png'
        }
    },
    PROTOCOLS_CONFIG: {
        YIELD_YAK: {
            logo: 'yak.svg',
            name: 'Yield Yak'
        },
        VECTOR_FINANCE: {
            logo: 'vector.png',
            name: 'Vector Finance'
        },
        WOMBAT: {
            logo: 'wom.png',
            name: 'Wombat'
        },
    },
    FARMED_TOKENS_CONFIG: {
        AVAX: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_AAVE_AVAX',
                balance: async (address) => yieldYakBalance('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakingContractAddress: '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeAVAXYak',
                unstakeMethod: 'unstakeAVAXYak',
                feedSymbol: 'YY_AAVE_AVAX',
                symbol: 'YRT',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Repeatedly lends and borrows AVAX on Aave to optimize rewards.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['AVAX'],
                strategy: 'AAVE',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_AVAX_SAVAX',
                balance: async (address) => vectorFinanceBalance('0xab42ed09F43DDa849aa7F62500885A973A38a8Bc', address),
                stakingContractAddress: '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc',
                receiptTokenAddress: '0x25dd42103b7da808e68a2bae5e14f48871488a85',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeWAVAX1',
                unstakeMethod: 'vectorUnstakeWAVAX1',
                migrateMethod: 'vectorMigrateAvax',
                migrateToProtocolIdentifier: 'VF_AVAX_SAVAX_AUTO',
                minAmount: 0.8,
                symbol: 'V-WAVAX-R',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000,
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_AVAX_SAVAX_AUTO',
                autoCompounding: true,
                stakingContractAddress: '0xe2406Af0E26769D3231682C80D4bB7bBdF329A88',
                decimals: 18, //decimals of staking contract
                balanceMethod: 'vectorWAVAX1BalanceAuto',
                stakeMethod: 'vectorStakeWAVAX1Auto',
                unstakeMethod: 'vectorUnstakeWAVAX1Auto',
                minAmount: 0.8,
                symbol: 'AVAX_SAVAX ACR',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            }
        ],
        sAVAX: [
            {
                droppingSupport: true,
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_PTP_sAVAX',
                autoCompounding: true,
                balance: async (address) => yieldYakBalance('0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977', address),
                stakingContractAddress: '0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeSAVAXYak',
                unstakeMethod: 'unstakeSAVAXYak',
                feedSymbol: 'YY_PTP_sAVAX',
                symbol: 'YRT',
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Yield Yak strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0,
                rewardTokens: ['sAVAX'],
                strategy: 'Platypus',
                banner: 'Due to the recent Platypus exploit, deposits in their farms have been disabled.',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_SAVAX_MAIN',
                balance: (address) => vectorFinanceBalance('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', address),
                stakingContractAddress: '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7',
                receiptTokenAddress: '0x8aa347d9a2bb8e32342f50939236251853604c79',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeSAVAX1',
                unstakeMethod: 'vectorUnstakeSAVAX1',
                migrateMethod: 'vectorMigrateSAvax',
                migrateToProtocolIdentifier: 'VF_SAVAX_MAIN_AUTO',
                minAmount: 0.8,
                symbol: 'V-SAVAX-R',
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_SAVAX_MAIN_AUTO',
                autoCompounding: true,
                balance: (address) => vectorFinanceBalance('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', address),
                stakingContractAddress: '0x1636bE3843E86826cB6aDC141B5d40d782763B85',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeSAVAX1Auto',
                unstakeMethod: 'vectorUnstakeSAVAX1Auto',
                minAmount: 0.8,
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            }
        ],
        USDC: [
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_USDC_MAIN',
                balance: (address) => vectorFinanceBalance('0xE5011Ab29612531727406d35cd9BcCE34fAEdC30', address, 6),
                stakingContractAddress: '0xE5011Ab29612531727406d35cd9BcCE34fAEdC30',
                receiptTokenAddress: '0x0adab2f0455987098059cfc10875c010800c659f',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeUSDC1',
                unstakeMethod: 'vectorUnstakeUSDC1',
                info: 'Depositing into Platypus\' main pool has been temporarily disabled. Read more in our <a href="https://discord.com/invite/9bwsnsHEzD" target="_blank">discord</a>.',
                minAmount: 0.8,
                symbol: 'V USDC-LP',
                token: 'USDC',
                isTokenLp: false,
                debtCoverage: 0,
                rewardTokens: ['PTP'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_USDC_MAIN_AUTO',
                autoCompounding: true,
                stakingContractAddress: '0x1DBd41f9Efde5b387E820e9B43BDa00c4154a82A',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeUSDC1Auto',
                unstakeMethod: 'vectorUnstakeUSDC1Auto',
                balanceMethod: 'vectorUSDC1BalanceAuto',
                minAmount: 0.8,
                symbol: 'USDC ACR',
                token: 'USDC',
                isTokenLp: false,
                debtCoverage: 0,
                rewardTokens: ['PTP'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
        ],
        USDT: [
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_USDT_MAIN_AUTO',
                autoCompounding: true,
                stakingContractAddress: '0x951CbF0DDA285FD8011F2cB7Ed435fA095f803a0',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeUSDT1Auto',
                unstakeMethod: 'vectorUnstakeUSDT1Auto',
                balanceMethod: 'vectorUSDT1BalanceAuto',
                minAmount: 0.9,
                symbol: 'USDT ACR',
                token: 'USDT',
                isTokenLp: false,
                debtCoverage: 0,
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
        ],
        GLP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_GLP',
                autoCompounding: true,
                balance: async (address) => yieldYakBalance('0x9f637540149f922145c06e1aa3f38dcDc32Aff5C', address),
                stakingContractAddress: '0x9f637540149f922145c06e1aa3f38dcDc32Aff5C',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeGLPYak',
                unstakeMethod: 'unstakeGLPYak',
                feedSymbol: 'YY_GLP',
                symbol: 'YRT',
                token: 'GLP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: false,
                debtCoverage: 0.83333333333,
                strategy: 'GMX',
                rewardTokens: ['GLP'],
                refreshDelay: 60000,
                enableStakeOverride: true,
                enableUnstakeOverride: true
            },
        ],
        PNG_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_PNG_AVAX_USDC_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656', address),
                stakingContractAddress: '0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakePNGAVAXUSDCYak',
                unstakeMethod: 'unstakePNGAVAXUSDCYak',
                feedSymbol: 'YY_PNG_AVAX_USDC_LP',
                symbol: 'YRT',
                token: 'PNG_AVAX_USDC_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'Pangolin',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            }
        ],
        PNG_AVAX_ETH_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_PNG_AVAX_ETH_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0xFCD2050E213cC54db2c9c99632AC870574FbC261', address),
                stakingContractAddress: '0xFCD2050E213cC54db2c9c99632AC870574FbC261',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakePNGAVAXETHYak',
                unstakeMethod: 'unstakePNGAVAXETHYak',
                feedSymbol: 'YY_PNG_AVAX_ETH_LP',
                symbol: 'YRT',
                token: 'PNG_AVAX_ETH_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'Pangolin',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            }
        ],
        // TJ_AVAX_USDC_LP: [
        //     {
        //         inactive: true,
        //         protocol: 'YIELD_YAK',
        //         protocolIdentifier: 'YY_TJ_AVAX_USDC_LP',
        //         autoCompounding: true,
        //         balance: (address) => yieldYakBalance('0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC', address),
        //         stakingContractAddress: '0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC',
        //         decimals: 18, //decimals of staking contract
        //         stakeMethod: 'stakeTJAVAXUSDCYak',
        //         unstakeMethod: 'unstakeTJAVAXUSDCYak',
        //         feedSymbol: 'YY_TJ_AVAX_USDC_LP',
        //         symbol: 'YRT',
        //         token: 'TJ_AVAX_USDC_LP',
        //         rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
        //         isTokenLp: true,
        //         debtCoverage: 0.83333333333,
        //         strategy: 'TraderJoe',
        //         refreshDelay: 60000
        //     }
        // ],
        // TJ_AVAX_ETH_LP: [
        //     {
        //         inactive: true,
        //         protocol: 'YIELD_YAK',
        //         protocolIdentifier: 'YY_TJ_AVAX_ETH_LP',
        //         autoCompounding: true,
        //         balance: (address) => yieldYakBalance('0x5219558ee591b030E075892acc41334A1694fd8A', address),
        //         stakingContractAddress: '0x5219558ee591b030E075892acc41334A1694fd8A',
        //         decimals: 18, //decimals of staking contract
        //         stakeMethod: 'stakeTJAVAXETHYak',
        //         unstakeMethod: 'unstakeTJAVAXETHYak',
        //         feedSymbol: 'YY_TJ_AVAX_ETH_LP',
        //         symbol: 'YRT',
        //         token: 'TJ_AVAX_ETH_LP',
        //         rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
        //         isTokenLp: true,
        //         debtCoverage: 0.83333333333,
        //         strategy: 'TraderJoe',
        //         refreshDelay: 60000
        //     }
        // ],
        // TJ_AVAX_sAVAX_LP: [
        //     {
        //         inactive: true,
        //         protocol: 'YIELD_YAK',
        //         protocolIdentifier: 'YY_TJ_AVAX_sAVAX_LP',
        //         autoCompounding: true,
        //         balance: (address) => yieldYakBalance('0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56', address),
        //         stakingContractAddress: '0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56',
        //         decimals: 18, //decimals of staking contract
        //         stakeMethod: 'stakeTJAVAXSAVAXYak',
        //         unstakeMethod: 'unstakeTJAVAXSAVAXYak',
        //         feedSymbol: 'YY_TJ_AVAX_sAVAX_LP',
        //         symbol: 'YRT',
        //         token: 'TJ_AVAX_sAVAX_LP',
        //         rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
        //         isTokenLp: true,
        //         debtCoverage: 0,
        //         strategy: 'TraderJoe',
        //         refreshDelay: 60000,
        //         banner: 'Rewards for this farm have been turned off, removing compounding benefits. Therefore, depositing into this farm has been disabled.'
        //     }
        // ],
    },
    WOMBAT_YY_FARMS: [
        {
            name: 'sAVAX LP',
            YRTName: 'YRT',
            assetToken: 'sAVAX',
            otherAssetToken: 'AVAX',
            lpAssetToken: 'WOMBAT_sAVAX_AVAX_LP_sAVAX',
            lpAssetTokenAddress: addresses.WOMBAT_sAVAX_AVAX_LP_sAVAX,
            lpTokenLogo: 'wombat_lp.png',
            YRTTokenLogo: 'yak.svg',
            apyKey: 'YY_WOM_sAVAX_AVAX_LP_sAVAX',
            apyToAdd: 'sAVAX',
            yrtKey: 'sAVAX_AVAX_YY_sAVAX',
            protocol: 'YIELD_YAK',
            balanceMethod: 'sAvaxBalanceAvaxSavaxYY',
            decimals: 18,
            depositMethod: 'depositSavaxToAvaxSavaxYY',
            depositLpMethod: 'depositAndStakeAvaxSavaxLpSavaxYY',
            withdrawMethod: 'withdrawSavaxFromAvaxSavaxYY',
            withdrawInOtherTokenMethod: 'withdrawAvaxFromAvaxSavaxInOtherTokenYY',
            unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxSavaxLpSavaxYY',
            migrateMethod: 'migrateAvaxSavaxLpSavaxFromWombatToYY',
            poolName: 'sAVAX Pool',
            debtCoverage: 0.83333333333,
            strategyContract: '0x9B5d890d563EE4c9255bB500a790Ca6B1FB9dB6b',
            apy: 7.46,
            aprWarning: false
        },
        {
            name: 'AVAX LP',
            YRTName: 'YRT',
            assetToken: 'AVAX',
            otherAssetToken: 'sAVAX',
            lpAssetToken: 'WOMBAT_sAVAX_AVAX_LP_AVAX',
            lpAssetTokenAddress: addresses.WOMBAT_sAVAX_AVAX_LP_AVAX,
            lpTokenLogo: 'wombat_lp.png',
            YRTTokenLogo: 'yak.svg',
            apyKey: 'YY_WOM_sAVAX_AVAX_LP_AVAX',
            yrtKey: 'sAVAX_AVAX_YY_AVAX',
            protocol: 'YIELD_YAK',
            balanceMethod: 'avaxBalanceAvaxSavaxYY',
            decimals: 18,
            depositMethod: 'depositAvaxToAvaxSavaxYY',
            depositLpMethod: 'depositAndStakeAvaxSavaxLpAvaxYY',
            withdrawMethod: 'withdrawAvaxFromAvaxSavaxYY',
            withdrawInOtherTokenMethod: 'withdrawSavaxFromAvaxSavaxInOtherTokenYY',
            unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxSavaxLpAvaxYY',
            migrateMethod: 'migrateAvaxSavaxLpAvaxFromWombatToYY',
            poolName: 'sAVAX Pool',
            debtCoverage: 0.83333333333,
            strategyContract: '0xa84D83787eA216F616C6Bd02C6edC6D6d63f042f',
            apy: 14.5,
            aprWarning: false
        },
        {
            name: 'ggAVAX LP',
            YRTName: 'YRT',
            assetToken: 'ggAVAX',
            otherAssetToken: 'AVAX',
            lpAssetToken: 'WOMBAT_ggAVAX_AVAX_LP_ggAVAX',
            lpAssetTokenAddress: addresses.WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            lpTokenLogo: 'wombat_lp.png',
            YRTTokenLogo: 'yak.svg',
            apyKey: 'YY_WOM_ggAVAX_AVAX_LP_ggAVAX',
            apyToAdd: 'ggAVAX',
            yrtKey: 'ggAVAX_AVAX_YY_ggAVAX',
            protocol: 'YIELD_YAK',
            balanceMethod: 'ggAvaxBalanceAvaxGgavaxYY',
            decimals: 18,
            depositMethod: 'depositGgavaxToAvaxGgavaxYY',
            depositLpMethod: 'depositAvaxGgavaxLpGgavaxYY',
            withdrawMethod: 'withdrawGgavaxFromAvaxGgavaxYY',
            withdrawInOtherTokenMethod: 'withdrawAvaxFromAvaxGgavaxInOtherTokenYY',
            unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxGgavaxLpGgavaxYY',
            migrateMethod: 'migrateAvaxGgavaxLpGgavaxFromWombatToYY',
            poolName: 'ggAVAX Pool',
            debtCoverage: 0.83333333333,
            strategyContract: '0x13404B1C715aF60869fc658d6D99c117e3543592',
            apy: 8.34,
            boostGGP: true,
            aprWarning: false
        },
        {
            name: 'AVAX LP',
            YRTName: 'YRT',
            assetToken: 'AVAX',
            otherAssetToken: 'ggAVAX',
            lpAssetToken: 'WOMBAT_ggAVAX_AVAX_LP_AVAX',
            lpAssetTokenAddress: addresses.WOMBAT_ggAVAX_AVAX_LP_AVAX,
            lpTokenLogo: 'wombat_lp.png',
            YRTTokenLogo: 'yak.svg',
            apyKey: 'YY_WOM_ggAVAX_AVAX_LP_AVAX',
            yrtKey: 'ggAVAX_AVAX_YY_AVAX',
            protocol: 'YIELD_YAK',
            balanceMethod: 'avaxBalanceAvaxGgavaxYY',
            decimals: 18,
            depositMethod: 'depositAvaxToAvaxGgavaxYY',
            depositLpMethod: 'depositAndStakeAvaxGgavaxLpAvaxYY',
            withdrawMethod: 'withdrawAvaxFromAvaxGgavaxYY',
            withdrawInOtherTokenMethod: 'withdrawGgavaxFromAvaxGgavaxInOtherTokenYY',
            unstakeAndWithdrawMethod: 'unstakeAndWithdrawAvaxGgavaxLpAvaxYY',
            migrateMethod: 'migrateAvaxGgavaxLpAvaxFromWombatToYY',
            poolName: 'ggAVAX Pool',
            debtCoverage: 0.83333333333,
            strategyContract: '0x7f0eB376eabF4b2B4290D09EFb2f4da99B3ea311',
            apy: 0.4,
            aprWarning: false
        },
    ],
    liquidityShapes: {
        spot: {
            name: "Spot",
            imgSrc: "src/assets/icons/liquidity_shape_spot_on.svg",
            distributionMethod: "getUniformDistributionFromBinRange"
        },
        curve: {
            name: "Curve",
            imgSrc: "src/assets/icons/liquidity_shape_curve_on.svg",
            distributionMethod: "getCurveDistributionFromBinRange"
        },
        bidAsk: {
            name: "Bid-Ask",
            imgSrc: "src/assets/icons/liquidity_shape_bid-ask_on.svg",
            distributionMethod: "getBidAskDistributionFromBinRange"
        },
    },
    fusionEventIds: {
        announcement: '8wwbhggwzord7a1n842d3h853ltobrcy',
        liquidation: 'f028438ad4f04bf4a39b255f58a39db8',
        loanHealth: '6bfd41237b134c1089dd33fe248bee5d',
        borrowRate: '2bc94bb1b957400a83c4ea7da093a335',
        lendingRate: '086961666c2a4234a6700721cf55848f'
    },
    yakRouterAddress: '0xC4729E56b831d74bBc18797e0e17A295fA77488c',
    yakWrapRouterAddress: '0x949B99c21B0B62B20cAADf912109929c78049112',
    yieldYakGlpWrapperAddress: '0x5d6fCD3108E016912Fa3448636e378B116167104',
    glpRewardsRouterAddress: '0x82147C5A7E850eA4E28155DF107F2590fD4ba327',
    depositSwapAddress: "0xa0170E529f94C955f77Fcf14F57C7A7cDf0FDb71",
    gmxV2ReaderAddress: "0x73BA021ACF4Bb6741E82690DdB821e7936050f8C",
    gmxV2DataStoreAddress: "0x2F0b22339414ADeD7D5F06f9D604c7fF5b2fe3f6",
    gmxV2HighExecutionFee: 0,
    gmxV2DepositCallbackGasLimit: 300000,
    gmxV2WithdrawalCallbackGasLimit: 300000,
    gmxV2GasPriceBuffer: 0.1,
    gmxV2GasPricePremium: 3000000000,
    gmxV2UseMaxPriorityFeePerGas: true,
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod",
    dataProviderHistoricalPrices: "redstone-avalanche",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-avalanche-prod",
    subgraph: `https://gateway-arbitrum.network.thegraph.com/api/${subgraphConfig.apiKey}/subgraphs/id/DPjhMarRUjoC6yoLGKaCDduf9xTKhzKVXU7pFc2FCDqN`,
    readRpcUrl: "https://avalanche-mainnet.core.chainstack.com/ext/bc/C/rpc/0968db18a01a90bac990ff00df6f7da1",
    fallbackRpcs: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc',
      'https://avax.meowrpc.com',
    ],
    multicallAddress: "0x271BcC10126A0B94EC5FaFf0B4f39A50fC4AC117",
    EMAIL_REGEX: /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/,
    refreshDelay: 5000,
    gmxV2RefreshDelay: 10000,
    wombatRefreshDelay: 4000,
    gmxV2IncentivesMilestone: 21000000,
    gmxV2IncentivesDeadline: 'March 3rd',
    historicalRpcUrl: "https://nd-875-171-632.p2pify.com/1e4e4e399220d21d56677b5be69f9326/ext/bc/C/rpc",
    ggpIncentivesEnpoints: {
      boostApy: 'https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ggp-boost-apy',
      collectedGGP: 'https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ggp-incentives-for'
    },
    ggpYieldYakIncentivesEnpoints : {
        boostApy: 'https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ggp-yy-boost-apy',
        collectedGGP: 'https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ggp-incentives-yy-for'
    },
    geolocationServiceUrl: "https://geo-service-r9helgya1-deltaprimelabs.vercel.app",
    restrictedCountries: ['US', 'AS', 'GU', 'PR', 'MP', 'VI', 'BY', 'CU', 'KP', 'SY', 'CI', 'LR', 'SD', 'ZW', 'IQ']
}
