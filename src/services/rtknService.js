import RTKN_TO_PRIME_CONVERTER from '../abis/IRtknToPrimeConverter.json';
import ERC_20_ABI from '../../test/abis/ERC20.json';
import {BehaviorSubject, combineLatest, from} from 'rxjs';
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
  crossChainMaxCap = 1709910 + 1935797 + 314611;
  crossChainData = {};
  chain;

  rtknsConfig = {
    avalanche: [
      {
        chain: 'avalanche',
        symbol: 'rTKN2',
        crossChainSymbol: 'rTKN2',
        order: 0,
        launchDate: '15.11.2024',
        converterAddress: '0x6632409698454E3FAE685Eaa4d6fdC5b6e9b7716',
        tokenAddress: '0x0E31136cD6742B4656eD46E28306080620eD70a7',
        conversionRatio: 0.808015513897867,
        maxCap: 1709910.945,
      }
    ],
    arbitrum: [
      {
        chain: 'arbitrum',
        symbol: 'rTKN',
        crossChainSymbol: 'rTKN1',
        order: 0,
        launchDate: '16.09.2024',
        converterAddress: '0xAd2E3761f071026ed1619876937a0eeC5c3c98B4',
        tokenAddress: '0xF3EaA614dAb459FD4E9f4BC5460BD9b965ed6c76',
        conversionRatio: 0.808015513897867,
        maxCap: 1935797.242
      },
      {
        chain: 'arbitrum',
        symbol: 'rTKN2',
        crossChainSymbol: 'rTKN2',
        order: 1,
        launchDate: '15.11.2024',
        converterAddress: '0xC1E3efF128c090A434927B0ff779d555bB3F75E5',
        tokenAddress: '0x47f655e3B4D0b686D26FBAD9C6378f66D6388af7',
        conversionRatio: 0.808015513897867,
        maxCap: 314611.8132
      }
    ]
  }

  rtknsData = [];

  data$ = new BehaviorSubject({});
  crossChainData$ = new BehaviorSubject({});

  constructor(providerService, accountService, progressBarService, modalService) {
    console.log(config.chainSlug);
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    combineLatest([providerService.observeProviderCreated(), accountService.observeAccountLoaded(), from(this.loadCrossChainPledgedData())])
      .subscribe(async ([provider, account, crossChainData]) => {
        this.provider = provider;
        this.account = account;
        this.chain = config.chainSlug;
        console.log(this.rtknsConfig);
        this.rtknsConfig[this.chain].forEach(rtkn => {
          const converterContract = new ethers.Contract(rtkn.converterAddress, this.CONVERTER_ABI, provider);
          const tokenContract = new ethers.Contract(rtkn.tokenAddress, ERC_20_ABI, provider);
          rtkn.converterContract = converterContract;
          rtkn.tokenContract = tokenContract;
        })
        this.crossChainData = crossChainData;
        this.loadData(crossChainData, true);
        this.emitCrossChainData(crossChainData);
      });
  }

  async loadData(crossChainData, initialLoad = false) {
    console.log('setup');
    console.log(this.rtknsConfig);
    this.rtknsConfig[this.chain].forEach(rtknConfig => {
      this.getData(rtknConfig, crossChainData).then(data => {
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
    const response = await fetch('https://dcjibi6y724m2.cloudfront.net/conversion.json');
    return response.json();
  }

  async getData(rtknConfig, crossChainData) {
    const maxCap = rtknConfig.maxCap;
    const totalCommited = Number(formatUnits(crossChainData[rtknConfig.chain][rtknConfig.crossChainSymbol], 18))
    const totalPledged = totalCommited !== 0 ? totalCommited : 1;
    const totalUsers = Number(formatUnits(await rtknConfig.converterContract.getTotalUsers(), 0))
    const yourPledge = Number(formatUnits(await rtknConfig.converterContract.userrTKNPledged(this.account), 18))
    const rtknBalance = formatUnits(await rtknConfig.tokenContract.balanceOf(this.account), 18);

    const rtknUtilized = maxCap < totalPledged ? (1 / (totalPledged / maxCap)) * yourPledge : yourPledge;
    const eligiblePrime = Number(formatUnits(await rtknConfig.converterContract.previewFuturePrimeAmountBasedOnPledgedAmountForUser(this.account), 18))


    console.log(maxCap);

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

  emitCrossChainData(crossChainData) {
    let totalPledged = 0;
    Object.keys(crossChainData).forEach(chain => {
      Object.keys(crossChainData[chain]).forEach(token => {
        const pledged = Number(formatUnits(crossChainData[chain][token], 18));
        totalPledged += pledged;
      })
    })
    this.crossChainData$.next({
      maxCap: this.crossChainMaxCap,
      totalPledged: totalPledged,
    });
  }

  async pledge(amount, tokenSymbol) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();
    const tokenContract = this.rtknsConfig[this.chain].find(config => config.symbol === tokenSymbol).tokenContract;
    const converterContract = this.rtknsConfig[this.chain].find(config => config.symbol === tokenSymbol).converterContract;

    try {
      const approveTx = await tokenContract.connect(this.provider.getSigner()).approve(converterContract.address, parseUnits(amount.toString(), 18));
      await awaitConfirmation(approveTx, this.provider, 'approve rTKN');
      const contractConnected = await converterContract.connect(this.provider.getSigner());
      const transaction = await contractConnected.pledgerTKN(parseUnits(amount.toString(), 18));
      const tx = await awaitConfirmation(transaction, this.provider, 'pledge rTKN');
      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.loadData(this.crossChainData);
      }, 1000);
    } catch (error) {
      console.log(error);
      this.handleError(error);
    }
  }

  async cancel(amount, tokenSymbol) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();
    const converterContract = this.rtknsConfig[this.chain].find(config => config.symbol === tokenSymbol).converterContract;

    try {
      const transaction = await converterContract.connect(this.provider.getSigner()).cancelPledge(parseUnits(amount.toString(), 18));
      const tx = await awaitConfirmation(transaction, this.provider, 'cancel rTKN pledge');
      this.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        this.progressBarService.emitProgressBarSuccessState();
        this.loadData(this.crossChainData);
      }, 1000);
    } catch (error) {
      this.handleError(error);
    }
  }

  observeData() {
    return this.data$.asObservable();
  }

  observeCrossChainData() {
    return this.crossChainData$.asObservable();
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