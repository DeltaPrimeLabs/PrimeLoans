import {BehaviorSubject, Subject} from 'rxjs';

export default class accountService {

  accountLoaded$ = new Subject();
  smartLoanContract$ = new BehaviorSubject(null);
  account$ = new BehaviorSubject();

  observeAccountLoaded() {
    return this.accountLoaded$.asObservable();
  }

  observeSmartLoanContract() {
    return this.smartLoanContract$.asObservable();
  }

  observeAccount() {
    return this.account$.asObservable();
  }

  emitAccountLoaded(account) {
    this.accountLoaded$.next(account);
  }

  emitSmartLoanContract(smartLoanContract) {
    this.smartLoanContract$.next(smartLoanContract);
  }

  emitAccount(account) {
    this.account$.next(account);
  }
}