import {Subject} from 'rxjs';
import EthereumProvider from '@walletconnect/ethereum-provider';

const ethers = require('ethers');
import config from '../config';

let ethereum = window.ethereum;

export default class ProviderService {
  accountService;
  poolService;
  priceService;

  provider$ = new Subject();
  providerCreated$ = new Subject();
  historicalProvider$ = new Subject();
  walletType$ = new Subject();


  constructor(accountService, poolService, priceService) {
    this.accountService = accountService;
    this.poolService = poolService;
    this.priceService = priceService;
  }

  initNetwork() {
    const lastUsedWallet = this.getLastUsedWallet();
    if (lastUsedWallet) {
      switch (lastUsedWallet) {
        case 'WALLET_CONNECT':
          this.initWalletConnectProvider();
          break;
        case 'RABBY':
          this.initMetamaskProvider();
          break;
        default:
          this.initMetamaskProvider();
      }
    }
  }

  emitProviderCreated(provider) {
    this.providerCreated$.next(provider);
  }

  async initWalletConnectProvider() {
    const provider = await EthereumProvider.init({
      projectId: 'b37251de649ba5a253d413f7558327cd',
      metadata: {
        name: 'My Website',
        description: 'My Website Description',
        url: 'https://mywebsite.com', // origin must match your domain & subdomain
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      },
      rpcMap: {
        43114: config.readRpcUrl,
        42161: 'https://api.avax.network/ext/bc/C/rpc',
      },
      showQrModal: true,
      optionalChains: [43114, 42161],

    })

    console.log(provider)

    await provider.connect()

    const account = await provider.request({method: 'eth_requestAccounts'})
    console.log(account)
    window.ownAccount = account[0];

    this.accountService.emitAccount(account[0]);

    const ethersProvider = new ethers.providers.Web3Provider(provider);
    window.provider = ethersProvider;

    this.emitProvider(ethersProvider);

    const historicalProvider = new ethers.providers.JsonRpcProvider(config.historicalRpcUrl);
    this.emitHistoricalProvider(historicalProvider);

    const accountBalance = parseFloat(ethers.utils.formatEther(await ethersProvider.getBalance(account[0])));

    this.accountService.emitBalance(accountBalance);

    this.saveLastUsedWallet('WALLET_CONNECT');
    this.poolService.setupPools(ethersProvider, account[0], this.priceService.prices).subscribe(pools => {
      this.poolService.emitPools(pools);
    });
  }

  async initMetamaskProvider() {
    await ethereum.request({method: 'eth_requestAccounts'});
    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    window.provider = provider;

    this.emitProvider(provider);
    this.emitProviderCreated(provider);

    const historicalProvider = new ethers.providers.JsonRpcProvider(config.historicalRpcUrl);
    this.emitHistoricalProvider(historicalProvider);

    let accounts = await provider.listAccounts();

    const mainAccount = accounts[0];
    this.accountService.emitAccount(mainAccount);
    this.accountService.emitAccountLoaded(mainAccount);

    const accountBalance = parseFloat(ethers.utils.formatEther(await provider.getBalance(mainAccount)));

    this.accountService.emitBalance(accountBalance);

    this.saveLastUsedWallet('RABBY');

    this.poolService.setupPools(provider, mainAccount, this.priceService.prices).subscribe(pools => {
      this.poolService.emitPools(pools);
    });
  }

  saveLastUsedWallet(walletId) {
    sessionStorage.setItem('LAST_USED_WALLET', walletId);
  }

  getLastUsedWallet() {
    return sessionStorage.getItem('LAST_USED_WALLET');
  }

  resetWallet() {
    sessionStorage.removeItem('LAST_USED_WALLET');
    window.location.reload();
  }


  observeProvider() {
    return this.provider$.asObservable();
  }

  observeProviderCreated() {
    return this.providerCreated$.asObservable();
  }

  observeHistoricalProvider() {
    return this.historicalProvider$.asObservable();
  }

  emitProvider(provider) {
    console.log('--___--___--__--___--___--____---____-EMITTING PROVIDER-------___---___--__--__--___--', provider);
    this.provider$.next(provider);
  }

  emitHistoricalProvider(provider) {
    this.historicalProvider$.next(provider);
  }
};