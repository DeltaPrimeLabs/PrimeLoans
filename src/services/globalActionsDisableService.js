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
    BORROW: false,
    REPAY: false,
    SWAP_DEBT: false,
    WRAP: false,
    CLAIM_GLP_REWARDS: false,
    WITHDRAW: true,
    BRIDGE_COLLATERAL: true,
  });
  poolsActions$ = new BehaviorSubject({
    DEPOSIT: false,
    BRIDGE: true,
    BRIDGE_DEPOSIT: true,
    WITHDRAW: false,
    SWAP_DEPOSIT: true,
    CLAIM_AVALANCHE_BOOST: true,
  });
  stakingProtocolActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    STAKE: true,
    WITHDRAW: true,
    UNSTAKE: true,
  });
  stakingProtocolWombatActions$ = new BehaviorSubject({
    DEPOSIT: true,
    DEPOSIT_AND_STAKE: true,
    MIGRATE: true,
    WITHDRAW: true,
    UNSTAKE_AND_WITHDRAW: true,
  });
  lpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    PROVIDE_LIQUIDITY: true,
    WITHDRAW: true,
    REMOVE_LIQUIDITY: true,
  });
  gmxV2Actions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: true,
    REMOVE_LIQUIDITY: false,
    PARTNER_PROFILE: false,
  });
  penpieActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    IMPORT_AND_STAKE: true,
    CREATE_LP: true,
    EXPORT_LP: true,
    UNSTAKE_AND_EXPORT: true,
    UNWIND: true,
    CLAIM_REWARDS: true,
  });
  wombatLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    CREATE_LP: true,
    EXPORT_LP: true,
    UNWIND: true,
    CLAIM_REWARDS: true,
  });
  traderJoeLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    WITHDRAW: true,
    ADD_LIQUIDITY: false,
    REMOVE_LIQUIDITY: false,
    CLAIM_TRADERJOE_REWARDS: true,
  });
  levelLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    PROVIDE_LIQUIDITY: true,
    WITHDRAW: true,
    REMOVE_LIQUIDITY: true,
    CLAIM_LEVEL_REWARDS: true,
    PARTNER_PROFILE: true,
  });
  balancerLpActions$ = new BehaviorSubject({
    FUND_AND_STAKE: true,
    STAKE: true,
    PROVIDE_LIQUIDITY: true,
    UNSTAKE_AND_WITHDRAW: true,
    WITHDRAW: true,
    REMOVE_LIQUIDITY: true,
    CLAIM_REWARDS: true,
  });
  concentratedLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: true,
    PROVIDE_LIQUIDITY: true,
    WITHDRAW: true,
    REMOVE_LIQUIDITY: true,
  });
  zapsActions$ = new BehaviorSubject({
    LONG: true,
    SHORT: true,
    CONVERT_GLP_TO_GM: true,
    CREATE_ACCOUNT: true,
  });
  sprimeActions$ = new BehaviorSubject({
    MINT: true,
    REBALANCE: true,
    REDEEM: true,
    BUY: true,
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
