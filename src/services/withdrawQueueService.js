import {BehaviorSubject, combineLatest} from 'rxjs';
import POOL from '../abis/Pool.json';
import ERC_20_ABI from '../../test/abis/ERC20.json';
import {formatUnits, parseUnits} from '../utils/calculate';
import config from '../config';
import {BigNumber} from 'ethers';
import {awaitConfirmation} from '../utils/blockchain';

const ethers = require('ethers');

export default class WithdrawQueueService {

  progressBarService;
  modalService;
  poolService;

  provider;
  account;
  poolContracts = [];
  pools = {};
  poolIntents = {};
  poolIntents$ = new BehaviorSubject({});
  totalReady = 0;
  totalPending = 0;
  soonestIntent;
  queueData$ = new BehaviorSubject({});

  constructor(providerService, accountService, progressBarService, modalService, poolService) {
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    this.poolService = poolService;
    combineLatest(providerService.observeProviderCreated(), accountService.observeAccountLoaded())
      .subscribe(async ([provider, account]) => {
        this.provider = provider;
        this.account = account;
        this.setupPoolContracts();
        this.getIntents();
      });
  }

  setupPoolContracts() {
    const poolsFromConfig = Object.keys(config.POOLS_CONFIG);
    poolsFromConfig.forEach(poolSymbol => {
      const poolContract = new ethers.Contract(config.POOLS_CONFIG[poolSymbol].address, POOL.abi, this.provider.getSigner());
      this.poolContracts.push(poolContract);
      this.pools[poolSymbol] = {
        contract: poolContract,
        decimals: config.ASSETS_CONFIG[poolSymbol].decimals,
      };
    })
  }

  getIntents() {
    this.totalPending = 0;
    this.totalReady = 0;
    combineLatest(Object.keys(this.pools).map(poolSymbol => this.getWithdrawalIntents(this.pools[poolSymbol].contract, poolSymbol)))
      .subscribe(intents => {
        intents.forEach((intent, i) => {
          if (intent.length > 0) {
            this.poolIntents[Object.keys(this.pools)[i]] = intent
          }
        })
        this.poolIntents$.next(this.poolIntents);
        console.log(JSON.stringify(this.poolIntents));
        this.soonestIntent = this.findMostRecentIntent(this.poolIntents);

        this.queueData$.next({
          totalReady: this.totalReady,
          totalPending: this.totalPending,
          soonestIntent: this.soonestIntent,
        })
      })
  }

  findMostRecentIntent(poolIntents) {
    let actionableIntents = [];

    for (const token in poolIntents) {
      actionableIntents.push(
        ...poolIntents[token]
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

  async createWithdrawalIntent(poolSymbol, amount) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();

    try {
      const transaction = await this.pools[poolSymbol].contract
        .connect(this.provider.getSigner())
        .createWithdrawalIntent(parseUnits(amount.toString(), config.ASSETS_CONFIG[poolSymbol].decimals), {gasLimit: 1000000});

      await awaitConfirmation(transaction, this.provider, 'create withdrawal intent');


      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.getIntents();
      }, config.refreshDelay);

    } catch (error) {
      this.handleError(error);
    }
  }

  async getWithdrawalIntents(poolContract, poolSymbol) {
    console.log(poolContract);
    const userIntents = await poolContract.getUserIntents(this.account);
    console.log(userIntents);
    const intents = userIntents.map((intent, index) => ({
      id: index,
      amount: formatUnits(intent.amount, config.ASSETS_CONFIG[poolSymbol].decimals),
      amountBigNumber: intent.amount,
      actionableAt: Number(formatUnits(intent.actionableAt, 0)) * 1000,
      expiresAt: Number(formatUnits(intent.expiresAt, 0)) * 1000,
      isActionable: intent.isActionable,
      isExpired: intent.isExpired,
      isPending: intent.isPending,
    })).filter(intent => !intent.isExpired);

    console.log(intents);

    this.totalReady += intents.filter(intent => intent.isActionable).length;
    this.totalPending += intents.filter(intent => intent.isPending).length;

    return intents.sort((a, b) => {
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

  async executeWithdrawalIntent(poolSymbol, ids) {
    ids = ids.sort();
    this.progressBarService.requestProgressBar();

    let sum = BigNumber.from(0);
    ids.forEach(id => {
      let intent = this.poolIntents[poolSymbol].find(intent => intent.id === id);
      sum = sum.add(intent.amountBigNumber);
    })
    const sumx = formatUnits(sum.toString(), config.ASSETS_CONFIG[poolSymbol].decimals);

    try {
      const transaction = await
        this.pools[poolSymbol].contract
          .connect(this.provider.getSigner())
          .withdraw(sum, ids, {gasLimit: 1000000});

      await awaitConfirmation(transaction, this.provider, 'execute withdrawal intent');

      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.getIntents();
        this.poolService.setupPools();
      }, config.refreshDelay);
    } catch (error) {
      this.handleError(error)
    }
  }

  async cancelWithdrawalIntent(poolSymbol, id) {
    this.progressBarService.requestProgressBar();

    try {
      const transaction = await
        this.pools[poolSymbol].contract
          .connect(this.provider.getSigner())
          .cancelWithdrawalIntent(id, {gasLimit: 1000000});

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



  observePoolIntents() {
    return this.poolIntents$.asObservable();
  }

  observeQueueData() {
    return this.queueData$.asObservable();
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