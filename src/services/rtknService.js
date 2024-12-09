import RTKN_TO_PRIME_CONVERTER
  from '/artifacts/contracts/interfaces/IRtknToPrimeConverter.sol/IRtknToPrimeConverter.json';
import ERC_20_ABI from '../../test/abis/ERC20.json';
import {BehaviorSubject, combineLatest, forkJoin, Subject} from 'rxjs';
import {formatUnits, parseUnits} from '../utils/calculate';
import {awaitConfirmation} from '../utils/blockchain';
import config from '../config';

const ethers = require('ethers');

export default class RtknService {

  progressBarService;
  modalService;

  CONVERTER_CONTRACT_ADDRESS = '0xAd2E3761f071026ed1619876937a0eeC5c3c98B4';
  ABI = RTKN_TO_PRIME_CONVERTER.abi;

  convertedContract;
  rtknTokenContract;
  rtkn2TokenContract;
  provider;

  data$ = new BehaviorSubject({});

  constructor(providerService, accountService, progressBarService, modalService) {
    this.progressBarService = progressBarService;
    this.modalService = modalService;
    combineLatest(providerService.observeProviderCreated(), accountService.observeAccountLoaded())
      .subscribe(async ([provider, account]) => {
        this.provider = provider;
        this.account = account;
        this.convertedContract = new ethers.Contract(this.CONVERTER_CONTRACT_ADDRESS, this.ABI, provider);
        this.setup();
      });
  }

  async setup() {
    if (config.chainSlug === 'arbitrum') {
      this.rtknTokenContract = new ethers.Contract(config.RTKN_ADDRESS, ERC_20_ABI, this.provider);
    }

    this.rtkn2TokenContract = new ethers.Contract(config.RTKN_2_ADDRESS, ERC_20_ABI, this.provider);
    await this.getData();
  }

  async getData() {
    const maxCap = Number(formatUnits(await this.convertedContract.rRTKNMaxCap(), 18))
    const totalPledged = Number(formatUnits(await this.convertedContract.totalrTKNPledged(), 18))
    const totalUsers = Number(formatUnits(await this.convertedContract.getTotalUsers(), 0))
    const yourPledge = Number(formatUnits(await this.convertedContract.userrTKNPledged(this.account), 18))
    const eligiblePrime = Number(formatUnits(await this.convertedContract.previewFuturePrimeAmountBasedOnPledgedAmountForUser(this.account), 18))
    // const conversionRatio = Number(formatUnits(await this.contract.CONVERSION_RATIO(), 18))
    const conversionRatio = 0.808015513897867;

    let rtknBalance = 0, rtkn2Balance;

    if (config.chainSlug === 'arbitrum') {
      rtknBalance = formatUnits(await this.rtknTokenContract.balanceOf(this.account), 18);
    }
    rtkn2Balance = formatUnits(await this.rtkn2TokenContract.balanceOf(this.account), 18);

    this.data$.next({
      maxCap,
      totalPledged,
      totalUsers,
      yourPledge,
      eligiblePrime,
      conversionRatio,
      rtknBalance,
      rtkn2Balance
    });
  }

  async pledge(amount) {
    this.progressBarService.requestProgressBar();
    this.modalService.closeModal();

    await this.rtknTokenContract.connect(this.provider.getSigner()).approve(this.CONVERTER_CONTRACT_ADDRESS, parseUnits(amount.toString(), 18));
    const contractConnected = await this.convertedContract.connect(this.provider.getSigner());
    const transaction = await contractConnected.pledgerTKN(parseUnits(amount.toString(), 18));
    const tx = await awaitConfirmation(transaction, this.provider, 'pledge rTKN');
    this.progressBarService.emitProgressBarInProgressState();
    setTimeout(() => {
      this.progressBarService.emitProgressBarSuccessState();
      this.getData();
    }, 1000);
  }

  observeData() {
    return this.data$.asObservable();
  }
}