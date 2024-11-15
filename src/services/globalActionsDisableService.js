import {BehaviorSubject, combineLatest, combineLatestWith, map} from "rxjs";

export const ActionSection = {
  'ASSETS': 'ASSETS',
  'POOLS': 'POOLS',
  'STAKING_PROTOCOL': 'STAKING_PROTOCOL',
  'STAKING_PROTOCOL_WOMBAT': 'STAKING_PROTOCOL_WOMBAT',
  'LP': 'LP',
  'GMXV2': 'GMXV2',
  'PENPIE': 'PENPIE',
  'WOMBAT_LP': 'WOMBAT_LP',
  'TRADER_JOE_LP': 'TRADER_JOE_LP',
  'LEVEL_LP': 'LEVEL_LP',
  'BALANCER_LP': 'BALANCER_LP',
  'CONCENTRATED_LP': 'CONCENTRATED_LP',
  'ZAPS': 'ZAPS',
  'SPRIME': 'SPRIME',
}

export default class GlobalActionsDisableService {
  appInReadonlyMode$ = new BehaviorSubject(false)
  assetsActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    SWAP: false,
    BORROW: true,
    REPAY: true,
    SWAP_DEBT: true,
    WRAP: true,
    CLAIM_GLP_REWARDS: true,
    WITHDRAW: true,
    BRIDGE_COLLATERAL: false,
  });
  poolsActions$ = new BehaviorSubject({
    DEPOSIT: false,
    BRIDGE: false,
    BRIDGE_DEPOSIT: false,
    WITHDRAW: false,
    SWAP_DEPOSIT: false,
    CLAIM_AVALANCHE_BOOST: false,
  });
  stakingProtocolActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    STAKE: false,
    WITHDRAW: false,
    UNSTAKE: false,
  });
  stakingProtocolWombatActions$ = new BehaviorSubject({
    DEPOSIT: false,
    DEPOSIT_AND_STAKE: false,
    MIGRATE: false,
    WITHDRAW: true,
    UNSTAKE_AND_WITHDRAW: true,
  });
  lpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
  });
  gmxV2Actions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
    PARTNER_PROFILE: false,
  });
  penpieActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    IMPORT_AND_STAKE: false,
    CREATE_LP: false,
    EXPORT_LP: true,
    UNSTAKE_AND_EXPORT: true,
    UNWIND: false,
    CLAIM_REWARDS: true,
  });
  wombatLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    CREATE_LP: false,
    EXPORT_LP: true,
    UNWIND: true,
    CLAIM_REWARDS: true,
  });
  traderJoeLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    WITHDRAW: true,
    ADD_LIQUIDITY: false,
    REMOVE_LIQUIDITY: true,
    CLAIM_TRADERJOE_REWARDS: true,
  });
  levelLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
    CLAIM_LEVEL_REWARDS: true,
    PARTNER_PROFILE: false,
  });
  balancerLpActions$ = new BehaviorSubject({
    FUND_AND_STAKE: false,
    STAKE: false,
    PROVIDE_LIQUIDITY: false,
    UNSTAKE_AND_WITHDRAW: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
    CLAIM_REWARDS: true,
  });
  concentratedLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
  });
  zapsActions$ = new BehaviorSubject({
    LONG: false,
    SHORT: false,
    CONVERT_GLP_TO_GM: false,
    CREATE_ACCOUNT: false,
  });
  sprimeActions$ = new BehaviorSubject({
    MINT: false,
    REBALANCE: false,
    REDEEM: false,
    BUY: false,
  });

  actionsSectionsRecord = {
    'ASSETS': this.assetsActions$,
    'POOLS': this.poolsActions$,
    'STAKING_PROTOCOL': this.stakingProtocolActions$,
    'STAKING_PROTOCOL_WOMBAT': this.stakingProtocolWombatActions$,
    'LP': this.lpActions$,
    'GMXV2': this.gmxV2Actions$,
    'PENPIE': this.penpieActions$,
    'WOMBAT_LP': this.wombatLpActions$,
    'TRADER_JOE_LP': this.traderJoeLpActions$,
    'LEVEL_LP': this.levelLpActions$,
    'BALANCER_LP': this.balancerLpActions$,
    'CONCENTRATED_LP': this.concentratedLpActions$,
    'ZAPS': this.zapsActions$,
    'SPRIME': this.sprimeActions$,
  }

  allSectionsSubjects = [
    this.assetsActions$,
    this.poolsActions$,
    this.stakingProtocolActions$,
    this.stakingProtocolWombatActions$,
    this.lpActions$,
    this.gmxV2Actions$,
    this.penpieActions$,
    this.wombatLpActions$,
    this.traderJoeLpActions$,
    this.levelLpActions$,
    this.balancerLpActions$,
    this.concentratedLpActions$,
    this.zapsActions$,
    this.sprimeActions$
  ]

  disableActionInSection(section, action) {
    const sectionSubject = this.actionsSectionsRecord[section]
    const newValue = {
      ...sectionSubject.value,
      [action]: true,
    }
    sectionSubject.next({
      ...sectionSubject.value,
      [action]: true,
    })
  }

  enableActionInSection(section, action) {
    const sectionSubject = this.actionsSectionsRecord[section]
    sectionSubject.next({
      ...sectionSubject.value,
      [action]: false,
    })
  }

  toggleActionInSection(section, action) {
    const sectionSubject = this.actionsSectionsRecord[section]
    sectionSubject.next({
      ...sectionSubject.value,
      [action]: !sectionSubject.value[action],
    })
  }

  disableActionGlobally(action) {
    this.allSectionsSubjects.forEach(sectionSubject => {
      sectionSubject.next({
        ...sectionSubject.value,
        [action]: true,
      })
    })
  }

  enableActionGlobally(action) {
    this.allSectionsSubjects.forEach(sectionSubject => {
      sectionSubject.next({
        ...sectionSubject.value,
        [action]: false,
      })
    })
  }

  disableAllActions() {
    this.allSectionsSubjects.forEach(sectionSubject => {
      const newValue = {}
      Object.keys(sectionSubject).forEach(key => {
        newValue[key] = true;
      })
      sectionSubject.next(newValue)
    })
  }

  enableAllActions() {
    this.allSectionsSubjects.forEach(sectionSubject => {
      const newValue = {}
      Object.keys(sectionSubject).forEach(key => {
        newValue[key] = false;
      })
      sectionSubject.next(newValue)
    })
  }

  enableReadonlyMode() {
    this.appInReadonlyMode$.next(true);
  }

  disableReadonlyMode() {
    this.appInReadonlyMode$.next(false);
  }

  getSectionActions$(section) {
    return this.actionsSectionsRecord[section].asObservable().pipe(
      combineLatestWith(this.appInReadonlyMode$.asObservable()),
      map(([actionSectionRecord, appInReadonlyMode]) => {
        if (appInReadonlyMode) {
          const newRecord = {};
          Object.keys(actionSectionRecord).forEach(key => {
            newRecord[key] = true;
          })
          return newRecord;
        } else {
          return actionSectionRecord;
        }
      })
    );
  }

  getReadonlyMode$() {
    return this.appInReadonlyMode$.asObservable();
  }
}
