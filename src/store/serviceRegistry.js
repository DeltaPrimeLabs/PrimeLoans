import AssetBalancesExternalUpdateService from '../services/assetBalancesExternalUpdateService';
import StakedExternalUpdateService from '../services/stakedExternalUpdateService';
import DataRefreshEventService from '../services/dataRefreshEventService';
import ProgressBarService from '../services/progressBarService';
import ModalService from '../services/modalService';
import HealthService from '../services/healthService';
import FarmService from "../services/farmService";
import LpService from "../services/lpService";
import AprService from '../services/aprService';
import ProviderService from '../services/providerService';
import AccountService from '../services/accountService';
import PoolService from "../services/poolService";
import PriceService from "../services/priceService";
import AssetDebtsExternalUpdateService from '../services/assetDebtsExternalUpdateService';
import CollateralService from '../services/collateralService';
import DebtService from '../services/debtService';
import ThemeService from "../services/themeService";
import StatsService from '../services/statsService';
import LoanHistoryService from "../services/loanHistoryService";
import WalletAssetBalancesService from '../services/walletAssetBalancesService';
import LifiService from '../services/lifiService';
import NotifiService from '../services/notifiService';
import TraderJoeService from '../services/traderJoeService';
import UniswapV3Service from '../services/uniswapV3Service';
import TermsService from '../services/termsService';
import DeprecatedAssetsService from '../services/deprecatedAssetsService';
import LtipService from "../services/ltipService";
import GgpIncentivesService from "../services/ggpIncentivesService";
import sPrimeService from "../services/sPrimeService";
import vPrimeService from "../services/vPrimeService";
import GlobalActionsDisableService from "../services/globalActionsDisableService";
import AvalancheBoostService from '../services/avalancheBoostService';
import RtknService from '../services/rtknService';
import PoolWithdrawQueueService from '../services/poolWithdrawQueueService';
import PAWithdrawQueueService from '../services/paWithdrawQueueService';
import FundsService from '../services/fundsService';

const providerService = new ProviderService();
const accountService = new AccountService();
const progressBarService = new ProgressBarService();
const modalService = new ModalService();
const poolService = new PoolService();
const fundsService = new FundsService();

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    assetDebtsExternalUpdateService: new AssetDebtsExternalUpdateService(),
    stakedExternalUpdateService: new StakedExternalUpdateService(),
    dataRefreshEventService: new DataRefreshEventService(),
    progressBarService: progressBarService,
    modalService: modalService,
    healthService: new HealthService(),
    aprService: new AprService(),
    farmService: new FarmService(),
    lpService: new LpService(),
    providerService: providerService,
    accountService: accountService,
    poolService: poolService,
    priceService: new PriceService(),
    collateralService: new CollateralService(),
    debtService: new DebtService(),
    themeService: new ThemeService(),
    statsService: new StatsService(),
    loanHistoryService: new LoanHistoryService(),
    walletAssetBalancesService: new WalletAssetBalancesService(),
    lifiService: new LifiService(),
    notifiService: new NotifiService(),
    traderJoeService: new TraderJoeService(),
    uniswapV3Service: new UniswapV3Service(),
    termsService: new TermsService(),
    deprecatedAssetsService: new DeprecatedAssetsService(),
    ltipService: new LtipService(),
    ggpIncentivesService: new GgpIncentivesService(),
    sPrimeService: new sPrimeService(),
    vPrimeService: new vPrimeService(),
    globalActionsDisableService: new GlobalActionsDisableService(),
    avalancheBoostService: new AvalancheBoostService(),
    rtknService: new RtknService(providerService, accountService, progressBarService, modalService),
    poolWithdrawQueueService: new PoolWithdrawQueueService(providerService, accountService, progressBarService, modalService, poolService),
    paWithdrawQueueService: new PAWithdrawQueueService(providerService, accountService, progressBarService, modalService, fundsService),
    fundsService: fundsService
  },
};
