import {BehaviorSubject, Subject} from 'rxjs';

export default class accountService {

  accountLoaded$ = new Subject();
  smartLoanContract$ = new BehaviorSubject(null);

  observeAccountLoaded() {
    return this.accountLoaded$.asObservable();
  }

  observeSmartLoanContract() {
    return this.smartLoanContract$.asObservable();
  }

  emitAccountLoaded(account) {
    this.accountLoaded$.next(account);
  }

  emitSmartLoanContract(smartLoanContract) {
    this.smartLoanContract$.next(smartLoanContract);
  }
}