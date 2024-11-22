import {Subject} from 'rxjs';

export default class accountService {

  accountLoaded$ = new Subject();

  observeAccountLoaded() {
    return this.accountLoaded$.asObservable();
  }

  emitAccountLoaded() {
    this.accountLoaded$.next(null);
  }
}