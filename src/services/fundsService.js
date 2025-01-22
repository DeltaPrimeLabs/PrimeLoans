import {BehaviorSubject, Subject} from 'rxjs';

export default class FundsService {
  requestUpdateFunds$ = new Subject();

  observeRequestUpdateFunds() {
    console.log('observeRequestUpdateFunds');
    return this.requestUpdateFunds$.asObservable();
  }

  requestUpdateFunds() {
    console.log('requestUpdateFunds');
    this.requestUpdateFunds$.next(null);
  }
}