<template>
  <div class="container">
    <div class="main-content">
      <div class="protocol-stats">
        <div class="tvl">
          <div class="label">TVL: </div>
          <div class="number">${{ numberWithCommas(tvl.toFixed(2)) }}</div>
          <br>
          <div  class="borrow-collateral">
            <div class="borrow">
              <div class="label">Total collateral: </div>
              <div class="number">${{ numberWithCommas(parseFloat(protocolCollateral.toFixed(2))) }} </div>
            </div>
            <div class="collateral">
              <div class="label">Total borrowed: </div>
              <div class="number">${{ numberWithCommas(parseFloat(totalBorrowed.toFixed(2))) }} </div>
            </div>
          </div>
        </div>
        <div class="pools">
          <Block v-for="pool of pools" v-bind:key="pool.asset.symbol">
            <div class="title">{{pool.asset.symbol}} pool</div>
            <div class="stat">
              <div class="desc">Provided:</div>
              <div class="value">{{pool.asset.symbol}} {{numberWithCommas(parseFloat(pool.tvl).toFixed(2))}}</div>
            </div>
            <div class="stat">
              <div class="desc">Borrowed:</div>
              <div class="value">{{pool.asset.symbol}} {{numberWithCommas(parseFloat(pool.totalBorrowed).toFixed(2))}}</div>
            </div>
            <div class="stat">
              <div class="desc">Utilisation:</div>
              <div class="value">{{pool.totalBorrowed / pool.tvl | percent}}</div>
            </div>
            <div class="stat">
              <div class="desc">Deposit APY:</div>
              <div class="value">{{pool.apy | percent}}</div>
            </div>
            <div class="stat">
              <div class="desc">Borrow APY:</div>
              <div class="value">{{pool.borrowingAPY | percent}}</div>
            </div>
          </Block>
        </div>
        <div class="factory">
          <Block>
            <div class="title">Accounts</div>
            <div class="stat">
              <div class="desc">Number of loans:</div>
              <div class="value">{{loanAddresses.length}}</div>
            </div>
            <div class="liquidators">
              <div class="desc">Liquidators:</div>
              <div class="liquidator-info" v-for="liquidator in liquidators">
                <div class="account"><a :href="`https://snowtrace.io/address/${liquidator.account}`" target="_blank">{{liquidator.account | tx}}</a></div>
                <div class="balance">{{liquidator.balance.toFixed(2)}}</div>
              </div>
            </div>
            <div class="loan-list">
              <div class="loan-list-header">
                <div>Address</div>
                <div>Health</div>
                <div>Total value</div>
                <div>Debt</div>
                <div>Collateral</div>
                <div>Solvent</div>
              </div>
              <div
                  v-for="loan of loans" v-bind:key="loan.address"
                  class="loan"
                  v-bind:class="{
                    'endangered': loan.health < 1.04,
                    'insolvent': loan.health <= 1 || !loan.solvent,
                  }"
              >
                <div><a :href="`https://snowtrace.io/address/${loan.address}`" target="_blank">{{loan.address | tx}}</a></div>
                <div>{{parseFloat(loan.health).toFixed(3)}}</div>
                <div>{{parseFloat(loan.totalValue).toFixed(2)}}</div>
                <div>{{parseFloat(loan.debt).toFixed(2)}}</div>
                <div>{{parseFloat(loan.collateral).toFixed(2)}}</div>
                <div>{{loan.solvent}}</div>
              </div>
            </div>
          </Block>
        </div>
    </div>
  </div>
</div>
</template>

<script>

import config from '../config';
import Block from './Block';
import {mapActions, mapState} from 'vuex';
import {wrapContract} from "../utils/blockchain";
const ethers = require('ethers');
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import {fromWei} from "../utils/calculate";

// This could be abstracted in separate store
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, getDocs, orderBy, where, limit } from 'firebase/firestore/lite';
import {combineLatest} from 'rxjs';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyByOwbJLGxjKkAdHzD4cTaDVj7eGeACeec",
  authDomain: "delta-prime-db.firebaseapp.com",
  projectId: "delta-prime-db",
  storageBucket: "delta-prime-db.appspot.com",
  messagingSenderId: "499112502554",
  appId: "1:499112502554:web:5d89f34de8f958bf5df8a3"
};

// Initialize Firebase
const fireStore = getFirestore(initializeApp(firebaseConfig));
const liquidatorAccounts = ["0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6","0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0xCD7D50FDD7481C3ffdeBc4F4d35B8C508986F5aa"];

export default {
  name: 'ProtocolStats',
  components: {
    Block,
  },
  async mounted() {
    this.initStoresWhenProviderAndAccountCreated();
    this.watchPools();
  },

  data() {
    return {
      funds: config.ASSETS_CONFIG,
      protocolCollateral: 0,
      totalBorrowed: 0,
      loanAddresses: [],
      loans: [],
      liquidators: [],
      tvl: 0
    };
  },
  computed: {
    ...mapState('poolStore', ['pools']),
    ...mapState('fundsStore', ['smartLoanFactoryContract']),
    ...mapState('network', ['provider']),
    ...mapState('serviceRegistry', ['providerService', 'accountService', 'poolService', 'priceService'])
  },

  watch: {
    smartLoanFactoryContract: {
      async handler(factory) {
        if (factory) {
          this.loanAddresses = await factory.getAllLoans();
          await this.fetchLoansFromFireBase();
        }
      }
    },
  },

  methods: {
    ...mapActions('poolStore', ['poolStoreSetup']),
    ...mapActions('fundsStore', ['fundsStoreSetup']),

    initStoresWhenProviderAndAccountCreated() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
        .subscribe(async ([provider, account]) => {
          await this.poolStoreSetup();
          await this.fundsStoreSetup();
          await this.liquidatorAccountsSetup();
        });
    },

    watchPools() {
      combineLatest([this.poolService.observePools(), this.priceService.observeRefreshPrices()])
          .subscribe(async () => {
            const avaxPool = this.pools.find(pool => pool.asset.symbol === 'AVAX');
            const usdcPool = this.pools.find(pool => pool.asset.symbol === 'USDC');
            this.tvl = parseFloat(avaxPool.tvl) * parseFloat(avaxPool.asset.price) + parseFloat(usdcPool.tvl) * parseFloat(usdcPool.asset.price) + parseFloat(this.protocolCollateral);
          });
    },

    async liquidatorAccountsSetup() {
      for (const account of liquidatorAccounts) {
        this.liquidators.push({
          account: account,
          balance: fromWei(await this.provider.getBalance(account))
        })
      }
    },

    numberWithCommas(x) {
      let parts = x.toString().split(".");
      parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,".");
      return parts.join(",");
    },

    async fetchLoansFromFireBase() {
      console.log("Getting loans stats");
      const loansCol = collection(fireStore, 'loans');
      
      //Get latest update time
      let max = null;
      const maxQ = query(loansCol, orderBy("time", "desc"), limit(1));
      const querySnapshot = await getDocs(maxQ);
      querySnapshot.forEach((doc) => {
        max = doc.data().time;
      });
      console.log("Max timestamp: " + max);

      //Get loans
      const loansQ = query(loansCol, where("time", "==", max), orderBy("health", "asc"));
      const loansQuerySnapshot = await getDocs(loansQ);
      this.protocolCollateral = 0;
      this.totalBorrowed = 0;
      loansQuerySnapshot.forEach((doc) => {
        this.loans.push({
          address: doc.data().address,
          health: doc.data().health,
          debt: doc.data().debt,
          collateral: doc.data().collateral,
          totalValue: doc.data().total         
        });
        this.protocolCollateral += doc.data().collateral;
        this.totalBorrowed += doc.data().debt; 
      });
      console.log("Loans fetched: " + this.loans.length);
      console.log("Last updated: " + new Date(max).toTimeString());
    },

    async setupLoans() {
      const assets = Object.keys(addresses);

      let sumCollateral = 0;
      let sumBorrowed = 0;

      let loansUnsorted = [];
      for (let address of this.loanAddresses) {
        const smartLoanContract = new ethers.Contract(address, SMART_LOAN.abi, provider.getSigner());
        const wrapped = await wrapContract(smartLoanContract, assets);
        const status = await wrapped.getFullLoanStatus();
        loansUnsorted.push({
          address: address,
          totalValue: fromWei(status[0]),
          debt: fromWei(status[1]),
          collateral: fromWei(status[0]) - fromWei(status[1]),
          twv: fromWei(status[2]),
          health: fromWei(status[3]),
          solvent: fromWei(status[4]) === 1e-18
        })

        sumCollateral += fromWei(status[0]) - fromWei(status[1]);
        sumBorrowed += fromWei(status[1]);
      }

      this.protocolCollateral = sumCollateral;
      this.totalBorrowed = sumBorrowed;

      this.loans = loansUnsorted.sort((a, b) => {
        return a.health - b.health;
      });

    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
.pools {
  display: flex;
  justify-content: space-between;

  .block-wrapper {
    width: 48%;

    .title {
      margin-bottom: 20px;
    }
  }
}

.factory {
  margin-top: 30px;
}

.borrow-collateral {
  display: flex;
  width: 900px;
  justify-content: space-between;
}

.loan-list {
  width: 100%;
  margin-top: 40px;
  color: $dark-gray;

  .loan-list-header {
    display: flex;
    justify-content: space-between;
    text-align: left;
    font-weight: 500;

    > div {
      width: 100px;
    }
  }

  .loan {
    display: flex;
    justify-content: space-between;
    text-align: left;

    > div {
      width: 100px;
    }


    a {
      text-decoration: none;
      font-weight: 500;
      color: #7d7d7d;
    }

    &.insolvent {
      color: #f64254;
    }

    &.endangered {
      color: #F4D35E;
    }
  }
}

.borrow, .collateral {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat {
  display: flex;
  width: 100%;
  color: #7d7d7d;
  margin-top: 10px;

  .desc {
    font-weight: 600;
    font-size: 18px;
  }

  .value {
    font-size: 16px;
    margin-left: 50px;
  }
}

.tvl {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;

  .label {
    font-size: 40px;
    font-weight: bold;
    color: black;
  }

  .number {
    font-size: 60px;
    margin-top: 50px;
    margin-bottom: 50px;
    color: #7d7d7d;
  }
}

.liquidators {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  color: #7d7d7d;
  height: 100px;
  width: 100%;
  margin-top: 40px;

  .desc {
    font-weight: 600;
    font-size: 18px;
    margin-bottom: 5px;
  }

  .liquidator-info {
    display: flex;

    .account {
      a {
        text-decoration: none;
        font-weight: 500;
        color: #7d7d7d;
      }
    }

    .balance {
      margin-left: 30px;
    }
  }
}

</style>