import {BehaviorSubject, Subject} from 'rxjs';

export default class accountService {

  accountLoaded$ = new Subject();
  smartLoanContract$ = new BehaviorSubject(null);
  account$ = new BehaviorSubject(null);
  balance$ = new BehaviorSubject(null);


  observeAccountLoaded() {
    return this.accountLoaded$.asObservable();
  }

  observeSmartLoanContract() {
    return this.smartLoanContract$.asObservable();
  }

  observeAccount() {
    return this.account$.asObservable();
  }

  observeBalance() {
    return this.balance$.asObservable();
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

  emitBalance(balance) {
    console.log('emitting account balance', balance);
    this.balance$.next(balance);
  }
}