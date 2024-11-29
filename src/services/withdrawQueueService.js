import {BehaviorSubject, combineLatest} from 'rxjs';
import POOL from '../abis/Pool.json';
import ERC_20_ABI from '../../test/abis/ERC20.json';
import {formatUnits, parseUnits} from '../utils/calculate';
import config from '../config';
import {BigNumber} from 'ethers';

const ethers = require('ethers');

export default class WithdrawQueueService {

  MOCK_POOL_CONTRACT = '0x6a495980FdBe315Dfc32Df2eD49488cABf84ce39';

  progressBarService;
  modalService;
  provider;
  account;
  poolContracts = [];
  pools = {};
  poolIntents = {};
  poolIntents$ = new BehaviorSubject({});
  mockTokenContract;

  constructor(providerService, accountService, progressBarService, modalService) {
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    combineLatest(providerService.observeProviderCreated(), accountService.observeAccountLoaded())
      .subscribe(async ([provider, account]) => {
        this.provider = provider;
        this.account = account;
        console.log(this.account);
        const mockPoolContract = new ethers.Contract(this.MOCK_POOL_CONTRACT, POOL.abi, provider);
        console.log(mockPoolContract);
        this.poolContracts.push(mockPoolContract);

        this.mockTokenContract = new ethers.Contract('0x5CE6eE56619d3EA3e54D5E9C7d92Bec266e872aF', ERC_20_ABI, provider);
        this.setupPoolContracts();
        this.getIntents();
        console.log(this.pools);
        console.log(this.poolIntents);
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
    combineLatest(Object.keys(this.pools).map(poolSymbol => this.getWithdrawalIntents(this.pools[poolSymbol].contract)))
      .subscribe(intents => {
        console.log(intents);
        intents.forEach((intent, i) => {
          if (intent.length > 0) {
            this.poolIntents[Object.keys(this.pools)[i]] = intent
          }
        })
        console.log(this.poolIntents);
        this.poolIntents$.next(this.poolIntents);
      })

  }

  async createWithdrawalIntent(amount) {
    await this.poolContracts[0].connect(this.provider.getSigner()).createWithdrawalIntent(parseUnits(amount.toString(), 18));
  }

  async getWithdrawalIntents(poolContract) {
    const userIntents = await poolContract.getUserIntents(this.account);
    console.log(userIntents);
    return userIntents.map(intent => ({
      amount: formatUnits(intent.amount, 18),
      amountBigNumber: intent.amount,
      actionableAt: Number(formatUnits(intent.actionableAt, 0)) * 1000,
      expiresAt: Number(formatUnits(intent.expiresAt, 0)) * 1000,
      isActionable: intent.isActionable,
      isExpired: intent.isExpired,
      isPending: intent.isPending
    })).filter(intent => !intent.isExpired);
  }

  async executeWithdrawalIntent(poolSymbol, indexes) {
    let sum = BigNumber.from(0);
    indexes.forEach(index => {
      console.log(this.poolIntents[poolSymbol].intents[index].amountBigNumber);
      sum = sum.add(this.poolIntents[poolSymbol].intents[index].amountBigNumber);
    })
    console.log(sum);
    const sumx = formatUnits(sum.toString(), 18);
    console.log(sumx);
    await this.pools[poolSymbol].contract.connect(this.provider.getSigner()).withdraw(sum, [indexes]);
  }


  async deposit(amount) {
    await this.mockTokenContract.connect(this.provider.getSigner()).approve(this.MOCK_POOL_CONTRACT, parseUnits(amount.toString(), 18));
    await this.poolContracts[0].connect(this.provider.getSigner()).deposit(parseUnits(amount.toString(), 18));
  }

  async flow() {
    const balance = await this.poolContracts[0].balanceOf(this.account);
    console.log(formatUnits(balance, 18));
  }

  observePoolIntents() {
    return this.poolIntents$.asObservable();
  }
}