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

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    assetDebtsExternalUpdateService: new AssetDebtsExternalUpdateService(),
    stakedExternalUpdateService: new StakedExternalUpdateService(),
    dataRefreshEventService: new DataRefreshEventService(),
    progressBarService: new ProgressBarService(),
    modalService: new ModalService(),
    healthService: new HealthService(),
    aprService: new AprService(),
    farmService: new FarmService(),
    lpService: new LpService(),
    providerService: new ProviderService(),
    accountService: new AccountService(),
    poolService: new PoolService(),
    priceService: new PriceService(),
  },
};
