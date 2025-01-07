import addresses from '../common/addresses/arbitrum/token_addresses.json';
import USDC_POOL_TUP from '/deployments/arbitrum/UsdcPoolTUP.json';
import ARB_POOL_TUP from '/deployments/arbitrum/ArbPoolTUP.json';
import USDT_POOL_TUP from '/deployments/arbitrum/UsdtPoolTUP.json';
import BTC_POOL_TUP from '/deployments/arbitrum/BtcPoolTUP.json';
import WETH_POOL_TUP from '/deployments/arbitrum/WethPoolTUP.json';
import DAI_POOL_TUP from '/deployments/arbitrum/DaiPoolTUP.json';
import FRAX_POOL_TUP from '/deployments/arbitrum/FraxPoolTUP.json';
import LINK_POOL_TUP from '/deployments/arbitrum/LinkPoolTUP.json';
import SUSHISWAP_INTERMEDIARY_TUP from '../deployments/arbitrum/SushiSwapIntermediaryTUP.json';
import VPRIME_TUP from '/deployments/arbitrum/vPrimeUP.json';
import {yieldYakBalance} from './utils/calculate';
import subgraphConfig from '../.secrets/subgraph.json';

export default {
    isDegen: true,
    MIN_ALLOWED_HEALTH: 0.0182,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    disableAWSData: false,
    chainId: 42161,
    chainSlug: 'arbitrum',
    notifiEnabled: true,
    primeAccountsBlocked: true,
    pendleApiBaseUrl: 'https://api-v2.pendle.finance/sdk/api',
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
        "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ETHUSDT"},
        "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:USDCUSDT"},
        "ARB": {name: "ARB", symbol: "ARB", logoExt: "png", decimals: 18, address: addresses.ARB, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ARBUSDT"},
        "BTC": {name: "BTC", symbol: "BTC", logoExt: "png", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:BTCUSDT"},
        "DAI": {name: "DAI", symbol: "DAI", logoExt: "png", decimals: 18, isStableCoin: true, address: addresses.DAI, debtCoverage: 0.83333333333, tradingViewSymbol: "KRAKEN:DAIUSDT"},
        "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "COINBASE:USDTUSD"},
        "FRAX": {name: "FRAX", symbol: "FRAX", decimals: 18, isStableCoin: true, address: addresses.FRAX, debtCoverage: 0.83333333333, tradingViewSymbol: "POLONIEX:FRAXUSDT"},
        "USDC.e": {name: "USDC.e", symbol: "USDC.e", decimals: 6, address: addresses["USDC.e"], isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "TRADERJOE:USDTEUSDT_74B651"},
        "UNI": {name: "UNI", symbol: "UNI", logoExt: "png", decimals: 18, address: addresses.UNI, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:UNIUSDT"},
        "LINK": {name: "LINK", symbol: "LINK", decimals: 18, address: addresses.LINK, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:LINKUSDT"},
        "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:GMXUSDT"},
        "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333, tradingViewSymbol: "", hasIncentives: true},
        // "DPX": {name: "DPX", symbol: "DPX", logoExt: "png", decimals: 18, address: addresses.DPX, debtCoverage: 0.83333333333, tradingViewSymbol: "BYBIT:DPXUSDT"},
        "MAGIC": {name: "MAGIC", symbol: "MAGIC", logoExt: "png", decimals: 18, address: addresses.MAGIC, groupIdentifier: "MAGIC_GROUP", debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:MAGICUSDT"},
        "WOO": {name: "WOO", symbol: "WOO", logoExt: "png", decimals: 18, address: addresses.WOO, groupIdentifier: "WOO_GROUP", debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:WOOUSDT"},
        "wstETH": {name: "wstETH", symbol: "wstETH", logoExt: "png", decimals: 18, address: addresses.wstETH, debtCoverage: 0.83333333333, tradingViewSymbol: "UNISWAP3ETH:WSTETHUSDC"},
        "JOE": {name: "JOE", symbol: "JOE", logoExt: "png", decimals: 18, address: addresses.JOE, groupIdentifier: "JOE_GROUP", debtCoverage: 0.8, tradingViewSymbol: "BINANCE:JOEUSDT"},
        "GRAIL": {name: "GRAIL", symbol: "GRAIL", logoExt: "png", decimals: 18, address: addresses.GRAIL, groupIdentifier: "GRAIL_GROUP", debtCoverage: 0.8, tradingViewSymbol: "BITGET:GRAILUSDT"},
        "ezETH": {name: "ezETH", symbol: "ezETH", logoExt: "png", decimals: 18, address: addresses.ezETH, debtCoverage: 0.83333333333, tradingViewSymbol: "PYTH:EZETHUSD"},
        "weETH": {name: "weETH", symbol: "weETH", logoExt: "png", decimals: 18, address: addresses.weETH, debtCoverage: 0.83333333333, tradingViewSymbol: "CRYPTO:WEETHUSD"},
        "rsETH": {name: "rsETH", symbol: "rsETH", logoExt: "png", decimals: 18, address: addresses.rsETH, debtCoverage: 0.83333333333},
        // "SOL": {name: "SOL", symbol: "SOL", decimals: 18, address: addresses.SOL, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:SOLUSDT"},
    },
    RTKN_ADDRESS: "0xF3EaA614dAb459FD4E9f4BC5460BD9b965ed6c76",
    RTKN_2_ADDRESS: "0x47f655e3B4D0b686D26FBAD9C6378f66D6388af7",
    PRIME: {hide: true, name: "PRIME", symbol: "PRIME", decimals: 18, address: addresses.PRIME},
    SPRIME_CONFIG: {
        default: "UNISWAP",
        UNISWAP: {
            default: "ETH",
            ETH: {
                sPrimeAddress: "0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945",
                poolAddress: "0xB31273fD2dfC05e6Fd91A3B8a2a681aeb0FbCF48",
                positionManagerAddress: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
                secondAssetDecimals: 18,
                dexWebsite: "https://app.uniswap.org/swap?chain=arbitrum&outputCurrency=0x3De81CE90f5A27C5E6A5aDb04b54ABA488a6d14E",
                revenueAwsEndpoint: "https://im34modd75.execute-api.eu-west-3.amazonaws.com/processedLiquidationsArbitrum"
            }
        }
    },
    VPRIME_CONFIG: {
        address: "0x88fBaEa44b85fcC505c1aB1fD884c877A3b3dD42"
    },
    PENPIE_REWARDS_TOKENS: {
        "PENDLE": {name: "PENDLE", symbol: "PENDLE", logoExt: "png", decimals: 18, address: addresses.PENDLE},
        "PNP": {name: "PNP", symbol: "PNP", logoExt: "png", decimals: 18, address: addresses.PNP},
        "SILO": {name: "SILO", symbol: "SILO", logoExt: "png", decimals: 18, address: addresses.SILO},
    },
    SWAP_DEXS_CONFIG: {
        // ParaSwapV2: {
        //     displayName: 'ParaSwap',
        //         availableAssets: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH', 'GRAIL', 'WOO', 'MAGIC', 'JOE', 'ezETH', 'weETH', 'rsETH'],
        //     slippageMargin: 0.05
        // },
        YakSwap: {
            displayName: 'YakSwap',
            availableAssets: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH', 'GRAIL', 'WOO', 'MAGIC', 'JOE', 'ezETH', 'weETH', 'rsETH'],
            slippageMargin: 0.02
        },
        // Level: {
        //     availableAssets: [],
        //     slippageMargin: 0.1
        // },
        GmxV2: {
            availableAssets: [],
            slippageMargin: 0.1
        },
        Penpie: {
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
    paraSwapDefaultSlippage: 0.02,
    showYakSwapWarning: true,
    ASSET_FILTER_TOKENS_OPTIONS: ['ETH', 'DPX',],
    ASSET_FILTER_DEXES_OPTIONS: ['Sushi'],
    NATIVE_ASSET_TOGGLE_OPTIONS: ['ETH', 'WETH'],
    WRAPPED_TOKEN_ADDRESS: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    POOLS_CONFIG: {
        USDC: {
            address: '0x8Ac9Dc27a6174a1CC30873B367A60AcdFAb965cc',
            tokenAddress: addresses.USDC
        },
        ETH: {
            address: '0x788A8324943beb1a7A47B76959E6C1e6B87eD360',
            tokenAddress: addresses.ETH
        },
        ARB: {
            address: '0xC629E8889350F1BBBf6eD1955095C2198dDC41c2',
            tokenAddress: addresses.ARB
        },
        BTC: {
            address: '0x0ed7B42B74F039eda928E1AE6F44Eed5EF195Fb5',
            tokenAddress: addresses.BTC
        },
        DAI: {
            address: '0xFA354E4289db87bEB81034A3ABD6D465328378f1',
            tokenAddress: addresses.DAI,
        },
    },
    poolsUnlocking: true,
    TRADERJOEV2_LP_ASSETS_CONFIG: {
        'TJLB_ARB_ETH_2_2': { primary: 'ARB', secondary: 'ETH', name: 'ARB-ETH', dex: 'TraderJoe', version: '2.2', symbol: 'TJLB_ARB_ETH_2_2', routerAddress: "0x18556DA13313f3532c54711497A8FedAC273220E", decimals: 18, baseFee: '0.0004', address: addresses['TJLB_ARB_ETH_2_2'], hooksSimpleRewarder: "0x17A30137F30566a1F4c53216DCa027735cbcD261", rewardToken: "ARB", binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v22/0x912ce59144191c1204e64559fe8253a0e49e6548/ETH/10"},
        'TJLB_ETH_USDC_2_2': { primary: 'ETH', secondary: 'USDC', name: 'ETH-USDC', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDC_2_2', version: '2.2', routerAddress: "0x18556DA13313f3532c54711497A8FedAC273220E", decimals: 18, baseFee: '0.0004', address: addresses['TJLB_ETH_USDC_2_2'], hooksSimpleRewarder: "0xe514FEDbd050f575048617F0c8219AAE386abAF8", rewardToken: "ARB", binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v22/ETH/0xaf88d065e77c8cc2239327c5edb3a432268e5831/10"},
        'TJLB_ETH_USDT_2_2': { primary: 'ETH', secondary: 'USDT', name: 'ETH-USDT', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDT_2_2', version: '2.2', routerAddress: "0x18556DA13313f3532c54711497A8FedAC273220E", decimals: 18, baseFee: '0.0004', address: addresses['TJLB_ETH_USDT_2_2'], hooksSimpleRewarder: "0x54A7b0ad7ed040C313c2a21376FD9EF16b33ebb0", rewardToken: "ARB", binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v22/ETH/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9/10"},
        'TJLB_MAGIC_ETH': { primary: 'MAGIC', secondary: 'ETH', name: 'MAGIC-ETH', dex: 'TraderJoe', symbol: 'TJLB_MAGIC_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.0025', address: addresses['TJLB_MAGIC_ETH'], binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x539bdE0d7Dbd336b79148AA742883198BBF60342/ETH/25"},
        'TJLB_GMX_ETH': { primary: 'GMX', secondary: 'ETH', name: 'GMX-ETH', dex: 'TraderJoe', symbol: 'TJLB_GMX_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.002', address: addresses['TJLB_GMX_ETH'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a/ETH/20"},
        'TJLB_DAI_USDCe': { primary: 'DAI', secondary: 'USDC.e', name: 'DAI-USDCe', dex: 'TraderJoe', symbol: 'TJLB_DAI_USDCe', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.00005', address: addresses['TJLB_DAI_USDCe'], binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xda10009cbd5d07dd0cecc66161fc93d7c9000da1/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/1"},
        'TJLB_ETH_USDT': { primary: 'ETH', secondary: 'USDT', name: 'ETH-USDT', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDT', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDT'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9/15"},
        'TJLB_ETH_USDCe': { primary: 'ETH', secondary: 'USDC.e', name: 'ETH-USDCe', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDCe', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDCe'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/15"},
        'TJLB_ARB_ETH': { primary: 'ARB', secondary: 'ETH', name: 'ARB-ETH', dex: 'TraderJoe', symbol: 'TJLB_ARB_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.001', address: addresses['TJLB_ARB_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x912ce59144191c1204e64559fe8253a0e49e6548/ETH/10"},
        'TJLB_BTC_ETH': { primary: 'BTC', secondary: 'ETH', name: 'BTC-ETH', dex: 'TraderJoe', symbol: 'TJLB_BTC_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.001', address: addresses['TJLB_BTC_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f/ETH/10"},
        'TJLB_GRAIL_ETH': { primary: 'GRAIL', secondary: 'ETH', name: 'GRAIL-ETH', dex: 'TraderJoe', symbol: 'TJLB_GRAIL_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.0025', address: addresses['TJLB_GRAIL_ETH'], binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x3d9907f9a368ad0a51be60f7da3b97cf940982d8/ETH/25"},
        'TJLB_WOO_ETH': { primary: 'WOO', secondary: 'ETH', name: 'WOO-ETH', dex: 'TraderJoe', symbol: 'TJLB_WOO_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.0025', address: addresses['TJLB_WOO_ETH'], binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xcafcd85d8ca7ad1e1c6f82f651fa15e33aefd07b/ETH/25"},
        'TJLB_JOE_ETH': { primary: 'JOE', secondary: 'ETH', name: 'JOE-ETH', dex: 'TraderJoe', symbol: 'TJLB_JOE_ETH', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.002', address: addresses['TJLB_JOE_ETH'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x371c7ec6d8039ff7933a2aa28eb827ffe1f52f07/ETH/20"},
        'TJLB_USDT_USDCe': { primary: 'USDT', secondary: 'USDC.e', name: 'USDT-USDCe', dex: 'TraderJoe', symbol: 'TJLB_USDT_USDCe', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.00005', address: addresses['TJLB_USDT_USDCe'], binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/1"},
        'TJLB_ETH_USDC': { primary: 'ETH', secondary: 'USDC', name: 'ETH-USDC', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDC', routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDC'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xaf88d065e77c8cc2239327c5edb3a432268e5831/15"},
    },
    BALANCER_LP_ASSETS_CONFIG: {},
    PENPIE_LP_ASSETS_CONFIG: {
        'PENDLE_EZ_ETH_26_09_24': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'ezETH',
            assetNameToDisplay: 'ezETH',
            assetLogoName: 'ezETH',
            symbol: 'PENDLE_EZ_ETH_26_09_24',
            protocolIdentifier: 'PENDLE_EZ_ETH_26_09_24',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_EZ_ETH_26_09_24'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_EZ_ETH_26_09_24',
            pendleLpAddress: '0x35f3db08a6e9cb4391348b0b404f493e7ae264c0',
            feedSymbol: 'PENDLE_EZ_ETH_26_09_24',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_EZ_ETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0x35f3db08a6e9cb4391348b0b404f493e7ae264c0',
            maturity: '26/09/2024'
        },
        'PENDLE_WSTETH_26_06_25': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'wstETH',
            assetNameToDisplay: 'wstETH',
            assetLogoName: 'wstETH',
            symbol: 'PENDLE_WSTETH_26_06_25',
            protocolIdentifier: 'PENDLE_WSTETH_26_06_25',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_WSTETH_26_06_25'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_WSTETH_26_06_25',
            pendleLpAddress: '0x08a152834de126d2ef83d612ff36e4523fd0017f',
            feedSymbol: 'PENDLE_WSTETH_26_06_25',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_WSTETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0x08a152834de126d2ef83D612ff36e4523FD0017F',
            maturity: '26/06/2025'
        },
        'PENDLE_E_ETH_26_09_24': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'weETH',
            assetNameToDisplay: 'weETH',
            assetLogoName: 'weETH',
            symbol: 'PENDLE_E_ETH_26_09_24',
            protocolIdentifier: 'PENDLE_E_ETH_26_09_24',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_E_ETH_26_09_24'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_E_ETH_26_09_24',
            pendleLpAddress: '0xf9f9779d8ff604732eba9ad345e6a27ef5c2a9d6',
            feedSymbol: 'PENDLE_E_ETH_26_09_24',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_E_ETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0xf9F9779d8fF604732EBA9AD345E6A27EF5c2a9d6',
            maturity: '26/09/2024'
        },
        'PENDLE_RS_ETH_26_09_24': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'rsETH',
            assetNameToDisplay: 'rsETH',
            assetLogoName: 'rsETH',
            symbol: 'PENDLE_RS_ETH_26_09_24',
            protocolIdentifier: 'PENDLE_RS_ETH_26_09_24',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_RS_ETH_26_09_24'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_RS_ETH_26_09_24',
            pendleLpAddress: '0xED99fC8bdB8E9e7B8240f62f69609a125A0Fbf14',
            feedSymbol: 'PENDLE_RS_ETH_26_09_24',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_RS_ETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0xED99fC8bdB8E9e7B8240f62f69609a125A0Fbf14',
            maturity: '26/09/2024'
        },
        'PENDLE_SILO_ETH_WSTETH_LP': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'ETH',
            assetNameToDisplay: 'Silo ETH',
            assetLogoName: 'Silo_ETH',
            symbol: 'PENDLE_SILO_ETH_WSTETH_LP',
            protocolIdentifier: 'PENDLE_SILO_ETH_WSTETH_LP',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_SILO_ETH_WSTETH_LP'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_SILO_ETH_WSTETH_26_12_24',
            pendleLpAddress: '0xaccd9a7cb5518326bed715f90bd32cdf2fec2d14',
            feedSymbol: 'PENDLE_SILO_ETH_WSTETH_LP',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_SILO_ETH_WSTETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0xACcd9A7cb5518326BeD715f90bD32CDf2fEc2D14',
            maturity: '26/12/2024'
        },
        'PENDLE_EZ_ETH_LP': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'ezETH',
            assetNameToDisplay: 'ezETH',
            assetLogoName: 'ezETH',
            symbol: 'PENDLE_EZ_ETH_LP',
            protocolIdentifier: 'PENDLE_EZ_ETH_LP',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_EZ_ETH_LP'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_EZ_ETH',
            pendleLpAddress: '0x5e03c94fc5fb2e21882000a96df0b63d2c4312e2',
            feedSymbol: 'PENDLE_EZ_ETH_LP',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_EZ_ETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0x5E03C94Fc5Fb2E21882000A96Df0b63d2c4312e2',
            maturity: '27/06/2024'
        },
        'PENDLE_WSTETH_LP': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'wstETH',
            assetNameToDisplay: 'wstETH',
            assetLogoName: 'wstETH',
            symbol: 'PENDLE_WSTETH_LP',
            protocolIdentifier: 'PENDLE_WSTETH_LP',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_WSTETH_LP'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_WSTETH',
            pendleLpAddress: '0xFd8AeE8FCC10aac1897F8D5271d112810C79e022',
            feedSymbol: 'PENDLE_WSTETH_LP',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_WSTETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0xFd8AeE8FCC10aac1897F8D5271d112810C79e022',
            maturity: '27/06/2024'
        },
        'PENDLE_E_ETH_LP': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'weETH',
            assetNameToDisplay: 'weETH',
            assetLogoName: 'weETH',
            symbol: 'PENDLE_E_ETH_LP',
            protocolIdentifier: 'PENDLE_E_ETH_LP',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_E_ETH_LP'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_E_ETH',
            pendleLpAddress: '0x952083cde7aaa11ab8449057f7de23a970aa8472',
            feedSymbol: 'PENDLE_E_ETH_LP',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_E_ETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0x952083cde7aaa11ab8449057f7de23a970aa8472',
            maturity: '27/06/2024'
        },
        'PENDLE_RS_ETH_LP': {
            protocol: 'PENPIE',
            short: 'PENPIE LP',
            dex: 'Penpie',
            asset: 'rsETH',
            assetNameToDisplay: 'rsETH',
            assetLogoName: 'rsETH',
            symbol: 'PENDLE_RS_ETH_LP',
            protocolIdentifier: 'PENDLE_RS_ETH_LP',
            debtCoverage: 0.83333333333,
            decimals: 18,
            tvl: 5350000,
            address: addresses['PENDLE_RS_ETH_LP'],
            rewardTokens: ['PNP'],
            pendleLpSymbol: 'PENDLE_RS_ETH',
            pendleLpAddress: '0x6ae79089b2cf4be441480801bb741a531d94312b',
            feedSymbol: 'PENDLE_RS_ETH_LP',
            logoExt: 'png',
            groupIdentifier: 'PENDLE_RS_ETH_LP_GROUP',
            name: 'PENPIE',
            link: 'https://www.pendle.magpiexyz.io/stake/0x6Ae79089b2CF4be441480801bb741A531d94312b',
            maturity: '27/06/2024'
        }
    },
    WOMBAT_LP_ASSETS_CONFIG: {},
    WOMBAT_LP_ASSETS: {},
    LEVEL_LP_ASSETS_CONFIG: {
        "arbJnrLLP": {name: "Junior", symbol: "arbJnrLLP", pid: 2, short: "Jnr", decimals: 18, address: addresses.arbJnrLLP, debtCoverage: 0.83333333333, balanceMethod: "levelJnrBalance", groupIdentifier: 'STKD_JNR_LLP_GROUP', underlyingAssets: ['BTC', 'ETH', 'ARB', 'USDT', 'USDC'], link: 'https://app.level.finance/liquidity/junior-tranche/buy', disableAddTokenButton: true},
        "arbMzeLLP": {name: "Mezzanine", symbol: "arbMzeLLP", pid: 1, short: "Mze", decimals: 18, address: addresses.arbMzeLLP, debtCoverage: 0.83333333333, balanceMethod: "levelMzeBalance", groupIdentifier: 'STKD_MZE_LLP_GROUP', underlyingAssets: ['BTC', 'ETH', 'USDT', 'USDC'], link: 'https://app.level.finance/liquidity/mezzanine-tranche/buy', disableAddTokenButton: true},
        "arbSnrLLP": {name: "Senior", symbol: "arbSnrLLP", pid: 0, short: "Snr", decimals: 18, address: addresses.arbSnrLLP, debtCoverage: 0.83333333333, balanceMethod: "levelSnrBalance", groupIdentifier: 'STKD_SNR_LLP_GROUP', underlyingAssets: ['BTC', 'ETH', 'USDT', 'USDC'], link: 'https://app.level.finance/liquidity/senior-tranche/buy'},
    },
    GMX_V2_ASSETS_CONFIG: {
        "GM_ETH_WETH": {isGMXPlus: true, name: "ETH+", symbol: "GM_ETH_WETH", short: "GM", decimals: 18, address: addresses.GM_ETH_WETH, debtCoverage: 0.83333333333, longToken: 'ETH', shortToken: 'ETH', indexTokenAddress: addresses.ETH, link: 'https://app.gmx.io/#/stats', addMethod: 'depositEthGmxV2Plus', removeMethod: 'withdrawEthGmxV2Plus'},
        "GM_BTC_WBTC": {isGMXPlus: true, name: "BTC+", symbol: "GM_BTC_WBTC", short: "GM", logoExt: "png", decimals: 18, address: addresses.GM_BTC_WBTC, debtCoverage: 0.83333333333, longToken: 'BTC', shortToken: 'BTC', indexTokenAddress: addresses.BTC, link: 'https://app.gmx.io/#/stats', addMethod: 'depositBtcGmxV2Plus', removeMethod: 'withdrawBtcGmxV2Plus'},
        "GM_NEAR_WETH_USDC": {name: "NEAR-USDC", symbol: "GM_NEAR_WETH_USDC", short: "GM", logoExt: 'png', price: 1, decimals: 18, address: addresses.GM_NEAR_WETH_USDC, debtCoverage: 0.83333333333, iconToken: 'NEAR', longToken: 'ETH', shortToken: 'USDC', indexTokenAddress: "0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C", link: 'https://app.gmx.io/#/stats', addMethod: 'depositNearUsdcGmxV2', removeMethod: 'withdrawNearUsdcGmxV2'},
        "GM_ATOM_WETH_USDC": {name: "ATOM-USDC", symbol: "GM_ATOM_WETH_USDC", short: "GM", logoExt: 'svg', price: 1, decimals: 18, address: addresses.GM_ATOM_WETH_USDC, debtCoverage: 0.83333333333, iconToken: 'ATOM', longToken: 'ETH', shortToken: 'USDC', indexTokenAddress: "0x7D7F1765aCbaF847b9A1f7137FE8Ed4931FbfEbA", link: 'https://app.gmx.io/#/stats', addMethod: 'depositAtomUsdcGmxV2', removeMethod: 'withdrawAtomUsdcGmxV2'},
        "GM_GMX_GMX_USDC": {name: "GMX-USDC", symbol: "GM_GMX_GMX_USDC", short: "GM", logoExt: 'png', price: 1, decimals: 18, address: addresses.GM_GMX_GMX_USDC, debtCoverage: 0.83333333333, longToken: 'GMX', shortToken: 'USDC', indexTokenAddress: addresses.GMX, link: 'https://app.gmx.io/#/stats'},
        "GM_ETH_WETH_USDC": {name: "ETH-USDC", symbol: "GM_ETH_WETH_USDC", short: "GM", decimals: 18, address: addresses.GM_ETH_WETH_USDC, debtCoverage: 0.83333333333, longToken: 'ETH', shortToken: 'USDC', indexTokenAddress: addresses.ETH, link: 'https://app.gmx.io/#/stats'},
        "GM_BTC_WBTC_USDC": {name: "BTC-USDC", symbol: "GM_BTC_WBTC_USDC", short: "GM", logoExt: "png", price: 1, decimals: 18, address: addresses.GM_BTC_WBTC_USDC, debtCoverage: 0.83333333333, longToken: 'BTC', shortToken: 'USDC', indexTokenAddress: addresses.BTC, link: 'https://app.gmx.io/#/stats'},
        "GM_ARB_ARB_USDC": {name: "ARB-USDC", symbol: "GM_ARB_ARB_USDC", short: "GM", logoExt: "png", decimals: 18, address: addresses.GM_ARB_ARB_USDC, debtCoverage: 0.83333333333, longToken: 'ARB', shortToken: 'USDC', indexTokenAddress: addresses.ARB, link: 'https://app.gmx.io/#/stats'},
        "GM_UNI_UNI_USDC": {name: "UNI-USDC", symbol: "GM_UNI_UNI_USDC", short: "GM", logoExt: "png", price: 1, decimals: 18, address: addresses.GM_UNI_UNI_USDC, debtCoverage: 0.83333333333, longToken: 'UNI', shortToken: 'USDC', indexTokenAddress: addresses.UNI, link: 'https://app.gmx.io/#/stats'},
        "GM_LINK_LINK_USDC": {name: "LINK-USDC", symbol: "GM_LINK_LINK_USDC", short: "GM", price: 1, decimals: 18, address: addresses.GM_LINK_LINK_USDC, debtCoverage: 0.83333333333, longToken: 'LINK', shortToken: 'USDC', indexTokenAddress: addresses.LINK, link: 'https://app.gmx.io/#/stats'},
        // "GM_SOL_SOL_USDC": {name: "SOL-USDC", symbol: "GM_SOL_SOL_USDC", short: "GM", price: 1, decimals: 18, address: addresses.GM_SOL_SOL_USDC, debtCoverage: 0.83333333333, longToken: 'SOL', shortToken: 'USDC', indexTokenAddress: addresses.SOL, link: 'https://app.gmx.io/#/stats'},
    },
    LP_ASSETS_CONFIG: {
        // "SUSHI_DPX_ETH_LP": {
        //     primary: 'DPX',
        //     secondary: 'ETH',
        //     name: "DPX-ETH",
        //     dex: 'Sushi',
        //     symbol: 'SUSHI_DPX_ETH_LP',
        //     decimals: 18,
        //     address: addresses.SUSHI_DPX_ETH_LP,
        //     debtCoverage: 0.83333333333
        // },
    },
    CONCENTRATED_LP_ASSETS_CONFIG: {},
    DEX_CONFIG: {
        'Sushi': {
            intermediaryAddress: SUSHISWAP_INTERMEDIARY_TUP.address,
            routerAddress: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
            swapMethod: 'swapSushiSwap',
            addLiquidityMethod: 'addLiquiditySushiSwap',
            removeLiquidityMethod: 'removeLiquiditySushiSwap',
            logo: 'sushi.png'
        }
    },
    PROTOCOLS_CONFIG: {
        YIELD_YAK: {
            logo: 'yak.svg',
            name: 'Yield Yak'
        },
        BEEFY_FINANCE: {
            logo: 'beefy.png',
            name: 'Beefy Finance'
        },
        PENPIE: {
            logo: 'penpie.png',
            name: 'Penpie'
        },
        PENDLE: {
            logo: 'pendle.png',
            name: 'Pendle'
        },
    },
    FARMED_TOKENS_CONFIG: {
        "USDC.e": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_USDC.e',
                balance: async (address) => yieldYakBalance('0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C', address, 6),
                stakingContractAddress: '0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C',
                decimals: 6, //decimals of staking contract
                stakeMethod: 'stakeUSDCeYak',
                unstakeMethod: 'unstakeUSDCeYak',
                feedSymbol: 'YY_WOMBEX_USDC.e',
                symbol: 'YRT',
                token: 'USDC.e',
                isTokenLp: false,
                info: 'Provides liquidity to Wombex.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['USDC.e'],
                strategy: 'Wombex',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            }
        ],
        "USDT": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_USDT',
                balance: async (address) => yieldYakBalance('0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2', address, 6),
                stakingContractAddress: '0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2',
                decimals: 6, //decimals of staking contract
                stakeMethod: 'stakeUSDTYak',
                unstakeMethod: 'unstakeUSDTYak',
                feedSymbol: 'YY_WOMBEX_USDT',
                symbol: 'YRT',
                token: 'USDT',
                isTokenLp: false,
                info: 'Provides liquidity to Wombex.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['USDT'],
                strategy: 'Wombex',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            }
        ],
        "DAI": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_DAI',
                balance: async (address) => yieldYakBalance('0x1817fE376740b53CAe73224B7F0a57F23DD4C9b5', address, 18),
                stakingContractAddress: '0x1817fE376740b53CAe73224B7F0a57F23DD4C9b5',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeDAIYak',
                unstakeMethod: 'unstakeDAIYak',
                feedSymbol: 'YY_WOMBEX_DAI',
                symbol: 'YRT',
                token: 'DAI',
                isTokenLp: false,
                info: 'Provides liquidity to Wombex.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['DAI'],
                strategy: 'Wombex',
                refreshDelay: 60000,
                enableUnstakeOverride: true
            }
        ],
        "GMX": [
            {
                protocol: 'BEEFY_FINANCE',
                autoCompounding: true,
                protocolIdentifier: 'MOO_GMX',
                balance: async (address) => yieldYakBalance('0x5B904f19fb9ccf493b623e5c8cE91603665788b0', address),
                stakingContractAddress: '0x5B904f19fb9ccf493b623e5c8cE91603665788b0',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeGmxBeefy',
                unstakeMethod: 'unstakeGmxBeefy',
                feedSymbol: 'MOO_GMX',
                symbol: 'BEEFY',
                token: 'GMX',
                isTokenLp: false,
                info: 'Stakes GMX token.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['GMX'],
                strategy: 'GMX',
                refreshDelay: 60000
            }
        ],
        "GLP": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_GLP',
                balance: async (address) => yieldYakBalance('0x28f37fa106AA2159c91C769f7AE415952D28b6ac', address),
                stakingContractAddress: '0x28f37fa106AA2159c91C769f7AE415952D28b6ac',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeGLPYak',
                unstakeMethod: 'unstakeGLPYak',
                feedSymbol: 'YY_WOMBEX_GLP',
                symbol: 'YRT',
                token: 'GLP',
                isTokenLp: false,
                info: 'Continuously stakes esGMX in order to maximize GLP rewards.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['GLP'],
                strategy: 'GMX',
                refreshDelay: 60000,
                enableStakeOverride: true,
                enableUnstakeOverride: true
            }
        ],
    },
    WOMBAT_YY_FARMS: [],
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
        liquidation: '0c4d89ff2a3e4c7fb5745629bb9f6593',
        loanHealth: 'e4579eb840444c6d861ca150b0b96e57',
        borrowRate: '0d3997ffa82d4690a7c78574fe392769',
        lendingRate: '480cce24ab174f31b29ce1eb5f11e512'
    },
    yakRouterAddress: '0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3',
    yakWrapRouterAddress: '0x16f90031000d48ce2bc6577788282c232060c547',
    yieldYakGlpWrapperAddress: '0x80F2d9652Ed7F5306dB095882FA9Ff882003F6D1',
    glpRewardsRouterAddress: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1', //TODO: needs testing
    depositSwapAddress: "0xaa3A31fd272db802621Ee2CA691bBd8d01dd49e2",
    levelLiquidityCalculatorAddress: "0xf1e5D6c0ce39fDBb9682F1A3385f0d2067740C61",
    gmxV2ReaderAddress: "0x60a0fF4cDaF0f6D496d71e0bC0fFa86FE8E6B23c",
    gmxV2DataStoreAddress: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
    gmxV2HighExecutionFee: 0,
    gmxV2DepositCallbackGasLimit: 300000,
    gmxV2WithdrawalCallbackGasLimit: 300000,
    gmxV2GasPriceBuffer: 0.1,
    gmxV2GasPricePremium: 0,
    gmxV2UseMaxPriorityFeePerGas: false,
    nativeToken: "ETH",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-arbitrum-prod",
    dataProviderHistoricalPrices: "redstone",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod",
    subgraph: `https://gateway-arbitrum.network.thegraph.com/api/${subgraphConfig.apiKey}/subgraphs/id/FYfDHXCWtiMM98bhgY1kTzUPdW9PxiCJTq5s9aB4kz3z`,
    readRpcUrl: "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf",
    multicallAddress: "0x0674ee727f74752ea9dc630bd5c5d8a374187e7b",
    EMAIL_REGEX: /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/,
    refreshDelay: 6000,
    gmxV2RefreshDelay: 4000,
    penpieRefreshDelay: 4000,
    gmxV2IncentivesMilestone: 9000000,
    gmxV2IncentivesDeadline: 'February 5th',
    historicalRpcUrl: "https://nd-767-190-280.p2pify.com/8d546b2f3519965f0f1cb4332abe96b3",
    ltipAccountsLeaderboardEndpoint: "https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-loan-leaderboard",
    ltipPrimeAccountArbCollected: "https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-loan-for",
    ltipApyEndpoint: "https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-boost-apy",
    ltipPoolApyEndpoint: "https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-pool-boost-apy",
    ltipGrantTotalEndpoint: "https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/arbitrum-grant-total",
    previousLtipMilestone: 1500000,
    ltipMilestone: 17500000,
    ltipLastDistributionTimestamp: 1719234231,
    ltipProgramStart: 1717432200,
    lastMilestoneHit: 1721293803,
    geolocationServiceUrl: "https://geo-service-r9helgya1-deltaprimelabs.vercel.app",
    restrictedCountries: ['US', 'AS', 'GU', 'PR', 'MP', 'VI', 'BY', 'CU', 'KP', 'SY', 'CI', 'LR', 'SD', 'ZW', 'IQ']
}
