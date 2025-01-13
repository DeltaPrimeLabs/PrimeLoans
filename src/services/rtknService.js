import RTKN_TO_PRIME_CONVERTER
  from '../abis/IRtknToPrimeConverter.json';
import ERC_20_ABI from '../../test/abis/ERC20.json';
import {BehaviorSubject, combineLatest, forkJoin, Subject} from 'rxjs';
import {formatUnits, parseUnits} from '../utils/calculate';
import {awaitConfirmation} from '../utils/blockchain';
import config from '../config';
import Vue from 'vue';

const ethers = require('ethers');

export default class RtknService {

  progressBarService;
  modalService;

  CONVERTER_ABI = RTKN_TO_PRIME_CONVERTER.abi;
  CROSS_CHAIN_PLEDGED_DATA_URL = 'https://dcjibi6y724m2.cloudfront.net/convertion.json';
  provider;
  pledgedData = {};

  rtknsConfig = config.chainId === 'avalanche' ? [
      // {
      //   symbol: 'rTKN2',
      //   order: 0,
      //   launchDate: '15.11.2024',
      //   converterAddress: '0x6632409698454E3FAE685Eaa4d6fdC5b6e9b7716',
      //   tokenAddress: '0x0E31136cD6742B4656eD46E28306080620eD70a7',
      // }
    ] :
    [
      {
        symbol: 'rTKN',
        order: 0,
        launchDate: '16.09.2024',
        converterAddress: '0xAd2E3761f071026ed1619876937a0eeC5c3c98B4',
        tokenAddress: '0xF3EaA614dAb459FD4E9f4BC5460BD9b965ed6c76',
        conversionRatio: 0.808015513897867
      },
      // {
      //   symbol: 'rTKN2',
      //   order: 1,
      //   launchDate: '15.11.2024',
      //   converterAddress: '0xC1E3efF128c090A434927B0ff779d555bB3F75E5',
      //   tokenAddress: '0x47f655e3B4D0b686D26FBAD9C6378f66D6388af7',
      // }
    ]

  rtknsData = [];

  data$ = new BehaviorSubject({});

  constructor(providerService, accountService, progressBarService, modalService) {
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    combineLatest(providerService.observeProviderCreated(), accountService.observeAccountLoaded())
      .subscribe(async ([provider, account]) => {
        this.provider = provider;
        this.account = account;
        console.log(this.rtknsConfig);
        // await this.loadCrossChainPledgedData();
        this.rtknsConfig.forEach(rtkn => {
          const converterContract = new ethers.Contract(rtkn.converterAddress, this.CONVERTER_ABI, provider);
          const tokenContract = new ethers.Contract(rtkn.tokenAddress, ERC_20_ABI, provider);
          rtkn.converterContract = converterContract;
          rtkn.tokenContract = tokenContract;
        })
        this.loadData(true);
      });
  }

  async loadData(initialLoad = false) {
    console.log('setup');
    console.log(this.rtknsConfig);
    this.rtknsConfig.forEach(rtknConfig => {
      this.getData(rtknConfig).then(data => {
        if (initialLoad) {
          Vue.set(this.rtknsData, rtknConfig.order, data);
        } else {
          const index = this.rtknsData.findIndex(data => data.symbol === rtknConfig.symbol);
          Vue.set(this.rtknsData, index, data);
        }
      })
    });
    this.data$.next(this.rtknsData);
  }

  async loadCrossChainPledgedData() {
    const response = await fetch('https://dcjibi6y724m2.cloudfront.net/convertion.json');
    const data = response.json();
    console.log(data);
    return data;
  }

  async getData(rtknConfig) {
    const maxCap = Number(formatUnits(await rtknConfig.converterContract.rRTKNMaxCap(), 18))
    const totalPledged = Number(formatUnits(await rtknConfig.converterContract.totalrTKNPledged(), 18))
    const totalUsers = Number(formatUnits(await rtknConfig.converterContract.getTotalUsers(), 0))
    const yourPledge = Number(formatUnits(await rtknConfig.converterContract.userrTKNPledged(this.account), 18))
    const eligiblePrime = Number(formatUnits(await rtknConfig.converterContract.previewFuturePrimeAmountBasedOnPledgedAmountForUser(this.account), 18))
    const rtknBalance = formatUnits(await rtknConfig.tokenContract.balanceOf(this.account), 18);

    const rtknUtilized = (1 / (totalPledged / maxCap)) * yourPledge;

    return {
      maxCap,
      totalPledged,
      totalUsers,
      yourPledge,
      eligiblePrime,
      rtknBalance,
      rtknUtilized,
      symbol: rtknConfig.symbol,
      launchDate: rtknConfig.launchDate,
      conversionRatio: rtknConfig.conversionRatio,
      order: rtknConfig.order
    }
  }

  async pledge(amount, tokenSymbol) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();
    const tokenContract = this.rtknsConfig.find(config => config.symbol === tokenSymbol).tokenContract;
    const converterContract = this.rtknsConfig.find(config => config.symbol === tokenSymbol).converterContract;

    await tokenContract.connect(this.provider.getSigner()).approve(converterContract.address, parseUnits(amount.toString(), 18));
    const contractConnected = await converterContract.connect(this.provider.getSigner());
    const transaction = await contractConnected.pledgerTKN(parseUnits(amount.toString(), 18));
    const tx = await awaitConfirmation(transaction, this.provider, 'pledge rTKN');
    this.progressBarService.emitProgressBarInProgressState();
    setTimeout(() => {
      this.progressBarService.emitProgressBarSuccessState();
      this.loadData();
    }, 1000);
  }

  async cancel(amount, tokenSymbol) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();
    const converterContract = this.rtknsConfig.find(config => config.symbol === tokenSymbol).converterContract;

    const transaction = await converterContract.connect(this.provider.getSigner()).cancelPledge(parseUnits(amount.toString(), 18));
    const tx = await awaitConfirmation(transaction, this.provider, 'cancel rTKN pledge');

    this.progressBarService.emitProgressBarInProgressState();
    setTimeout(() => {
      this.progressBarService.emitProgressBarSuccessState();
      this.loadData();
    }, 1000);
  }

  observeData() {
    return this.data$.asObservable();
  }
}