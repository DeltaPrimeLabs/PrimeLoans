import { BehaviorSubject, combineLatest, filter } from 'rxjs';
import {formatUnits, mergeArrays, parseUnits} from '../utils/calculate';
import config from '../config';
import {awaitConfirmation, wrapContract} from '../utils/blockchain';


const ethers = require('ethers');
const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;

export default class PAWithdrawQueueService {

  progressBarService;
  modalService;
  fundsService;

  provider;
  account;
  smartLoanContract;
  assetIntents = {};
  assetIntents$ = new BehaviorSubject({});
  totalReady = 0;
  totalPending = 0;
  soonestIntent;
  queueData$ = new BehaviorSubject({});

  constructor(providerService, accountService, progressBarService, modalService, fundsService) {
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    this.fundsService = fundsService;
    combineLatest([providerService.observeProvider(), accountService.observeAccount(), accountService.observeSmartLoanContract()])
    .pipe(filter(([,, primeAccountContract]) => primeAccountContract))
      .subscribe(async ([provider, account, primeAccountContract]) => {
        this.provider = provider;
        this.account = account;
        this.smartLoanContract = primeAccountContract;
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

  async getIntentsPerAsset(assetSymbol) {
    let assetIntents = []
    try {
      assetIntents = await this.smartLoanContract.getUserIntents(toBytes32(assetSymbol))
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

  async createWithdrawalIntent(assetSymbol, amount) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();
    try {
      const transaction = await this.smartLoanContract
        .createWithdrawalIntent(
          toBytes32(assetSymbol),
          parseUnits(amount.toString(),
            config.ASSETS_CONFIG[assetSymbol].decimals)
        );
      await awaitConfirmation(transaction, this.provider, 'createWithdrawalIntent');

      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.getIntents();
      }, config.refreshDelay);
    } catch (error) {
      this.handleError(error);
    }
  }

  async executeWithdrawalIntent(assetSymbol, ids) {
    const loanAssets = mergeArrays([(
      await this.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
      (await this.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
      Object.keys(config.POOLS_CONFIG),
      'PRIME'
    ]);

    console.log(assetSymbol);
    console.log(ids);
    ids = ids.sort();
    this.progressBarService.requestProgressBar();
    const wrappedContract = await wrapContract(this.smartLoanContract, loanAssets);

    try {
      const transaction = await
        wrappedContract.executeWithdrawalIntent(toBytes32(assetSymbol), ids);

      await awaitConfirmation(transaction, this.provider, 'execute withdrawal intent');

      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.getIntents();
        this.fundsService.requestUpdateFunds();
      }, config.refreshDelay);
    } catch (error) {
      console.error(error)
      this.handleError(error)
    }
  }

  async cancelWithdrawalIntent(assetSymbol, id) {
    this.progressBarService.requestProgressBar();

    try {
      const transaction = await
        this.smartLoanContract
          .cancelWithdrawalIntent(toBytes32(assetSymbol), id, {gasLimit: 1000000});

      await awaitConfirmation(transaction, this.provider, 'cancel withdrawal intent');

      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.getIntents();
      }, config.refreshDelay);
    } catch (error) {
      this.handleError(error)
    }
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