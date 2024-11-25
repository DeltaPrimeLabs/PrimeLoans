// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "./facets/avalanche/IYieldYakFacet.sol";
import "./facets/avalanche/IGMDFacet.sol";
import "./facets/avalanche/IYieldYakSwapFacet.sol";
import "./facets/avalanche/IParaSwapFacet.sol";
import "./facets/avalanche/ICaiFacet.sol";
import "./facets/avalanche/IGLPFacet.sol";
import "./facets/avalanche/IPangolinDEXFacet.sol";
import "./facets/avalanche/ITraderJoeDEXFacet.sol";
import "./facets/IUniswapV2DEXFacet.sol";
import "./facets/IAssetsOperationsFacet.sol";
import "./facets/IOwnershipFacet.sol";
import "./facets/ISmartLoanViewFacet.sol";
import "./facets/ISmartLoanLiquidationFacet.sol";
import "./facets/ISmartLoanWrappedNativeTokenFacet.sol";
import "./facets/ISolvencyFacetProd.sol";
import "./facets/IHealthMeterFacetProd.sol";
import "./IDiamondLoupe.sol";
import "./facets/celo/IUbeswapDEXFacet.sol";
import "./facets/IGmxV2Facet.sol";
import "./facets/IGmxV2PlusFacet.sol";
import "./facets/avalanche/IVectorFinanceFacet.sol";
import "./facets/avalanche/IVectorFinanceFacetOld.sol";
import "./facets/avalanche/IBeefyFinanceFacet.sol";
import "./facets/avalanche/ICurveFacet.sol";
import "./facets/avalanche/ISteakHutFinanceFacet.sol";
import "./facets/avalanche/ITraderJoeV2Facet.sol";
import "./facets/avalanche/IUniswapV3Facet.sol";
import "./facets/avalanche/ITraderJoeV2AutopoolsFacet.sol";
import "./facets/avalanche/IBalancerV2Facet.sol";
import "./facets/avalanche/IGogoPoolFacet.sol";
import "./facets/arbitrum/ISushiSwapDEXFacet.sol";
import "./facets/arbitrum/IBeefyFinanceArbitrumFacet.sol";
import "./facets/arbitrum/ISushiSwapFacet.sol";
import "./facets/arbitrum/ILevelFinanceFacet.sol";
import "./facets/arbitrum/IPenpieFacet.sol";
import "./facets/arbitrum/ILTIPFacet.sol";
import "./facets/avalanche/IWombatFacet.sol";
import "./facets/avalanche/IYieldYakWombatFacet.sol";

interface SmartLoanGigaChadInterface is
    IGMDFacet,
    IHealthMeterFacetProd,
    IGLPFacet,
    IYieldYakSwapFacet,
    IParaSwapFacet,
    ICaiFacet,
    IDiamondLoupe,
    IBeefyFinanceFacet,
    IBeefyFinanceArbitrumFacet,
    ISushiSwapFacet,
    ILevelFinanceFacet,
    IPenpieFacet,
    ILTIPFacet,
    IWombatFacet,
    IYieldYakWombatFacet,
    ISmartLoanWrappedNativeTokenFacet,
    IPangolinDEXFacet,
    IUniswapV2DEXFacet,
    IAssetsOperationsFacet,
    IOwnershipFacet,
    ISmartLoanLiquidationFacet,
    ISmartLoanViewFacet,
    ISolvencyFacetProd,
    IYieldYakFacet,
    IVectorFinanceFacet,
    IVectorFinanceFacetOld,
    IUbeswapDEXFacet,
    ITraderJoeDEXFacet,
    ICurveFacet,
    ISteakHutFinanceFacet,
    ITraderJoeV2Facet,
    IUniswapV3Facet,
    ITraderJoeV2AutopoolsFacet,
    ISushiSwapDEXFacet,
    IGmxV2Facet,
    IGmxV2PlusFacet,
    IBalancerV2Facet,
    IGogoPoolFacet
{}
