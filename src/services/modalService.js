import {Subject} from 'rxjs';

export default class ModalService {

  closeModal$ = new Subject();

  closeModal() {
    this.closeModal$.next(null);
  }

  watchCloseModal() {
    return this.closeModal$.asObservable();
  }
}