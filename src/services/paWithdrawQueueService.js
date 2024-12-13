import { BehaviorSubject, combineLatest, filter } from 'rxjs';
import POOL from '../abis/Pool.json';
import ERC_20_ABI from '../../test/abis/ERC20.json';
import {formatUnits, parseUnits} from '../utils/calculate';
import config from '../config';
import {BigNumber} from 'ethers';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import {awaitConfirmation} from '../utils/blockchain';


const ethers = require('ethers');
const toBytes32 = require('ethers').utils.formatBytes32String;

export default class PAWithdrawQueueService {

  progressBarService;
  modalService;

  provider;
  account;
  primeAccountContract;
  assetIntents = {};
  assetIntents$ = new BehaviorSubject({});
  totalReady = 0;
  totalPending = 0;
  soonestIntent;
  queueData$ = new BehaviorSubject({});

  constructor(providerService, accountService, progressBarService, modalService) {
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    combineLatest([providerService.observeProviderCreated(), accountService.observeAccountLoaded(), accountService.observeSmartLoanContract()])
    .pipe(filter(([,, primeAccountContract]) => primeAccountContract))
      .subscribe(async ([provider, account, primeAccountContract]) => {
        this.provider = provider;
        this.account = account;
        this.primeAccountContract = primeAccountContract;
        this.getIntents();
      });
  }

  observeAssetIntents() {
    return this.assetIntents$.asObservable();
  }

  observeQueueData() {
    return this.queueData$.asObservable();
  }

  async getIntents() {
    combineLatest(Object.keys(config.ASSETS_CONFIG).map(assetSymbol => this.getIntentsPerAsset(assetSymbol)))
    .subscribe(intents => {
      intents.forEach((intent, i) => {
        if (intent.length > 0) {
          this.assetIntents[Object.keys(config.ASSETS_CONFIG)[i]] = intent
        }
      })
      this.assetIntents$.next(this.assetIntents);
      console.log(JSON.stringify(this.assetIntents));
      this.soonestIntent = this.findMostRecentIntent(this.assetIntents);

      this.queueData$.next({
        totalReady: this.totalReady,
        totalPending: this.totalPending,
        soonestIntent: this.soonestIntent,
      })
    })
  }

  async createIntent() {
    await this.primeAccountContract.createWithdrawalIntent(toBytes32('BNB'), parseUnits('0.05', 6));
    this.getIntents()
  }

  async getIntentsPerAsset(assetSymbol) {
    let assetIntents = []
    try {
      assetIntents = await this.primeAccountContract.getUserIntents(toBytes32(assetSymbol))
    } catch (e) {
      console.error('error while getting intents for ' + assetSymbol)
    }

    const resultIntents = assetIntents.map((intent, index) => ({
      id: index,
      amount: formatUnits(intent.amount, config.ASSETS_CONFIG[assetSymbol].decimals),
      amountBigNumber: intent.amount,
      actionableAt: Number(formatUnits(intent.actionableAt, 0)) * 1000,
      expiresAt: Number(formatUnits(intent.expiresAt, 0)) * 1000,
      isActionable: intent.isActionable,
      isExpired: intent.isExpired,
      isPending: intent.isPending,
    })).filter(intent => !intent.isExpired);

    this.totalReady += resultIntents.filter(intent => intent.isActionable).length;
    this.totalPending += resultIntents.filter(intent => intent.isPending).length;

    return resultIntents.sort((a, b) => {
      if (a.isActionable && !b.isActionable) return -1;
      if (!a.isActionable && b.isActionable) return 1;

      if (a.isActionable && b.isActionable) {
        return a.expiresAt - b.expiresAt;
      }

      if (a.isPending && b.isPending) {
        return a.actionableAt - b.actionableAt;
      }
      return 0;
    });
  }

  findMostRecentIntent(assetIntents) {
    let actionableIntents = [];

    for (const token in assetIntents) {
      actionableIntents.push(
        ...assetIntents[token]
        .filter(intent => intent.isActionable)
        .map(intent => ({...intent, symbol: token}))
      );
    }

    return actionableIntents.reduce((lowest, current) => {
      return !lowest || current.actionableAt < lowest.actionableAt
        ? current
        : lowest;
    }, null);
  }

  handleError(error) {
    switch (error.code) {
      case 4001:
        this.progressBarService.emitProgressBarCancelledState()
        break;
      default:
        this.progressBarService.emitProgressBarErrorState();
    }
  }
}