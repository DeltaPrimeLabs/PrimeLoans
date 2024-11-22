import {Subject} from 'rxjs';

export default class ProgressBarService {

  progressBarRequested$ = new Subject();
  progressBarState$ = new Subject();

  requestProgressBar(duration = 1000) {
    console.log('request progress bar');
    this.progressBarRequested$.next({duration: duration});
    this.progressBarState$.next('MINING');
  }

  emitProgressBarErrorState() {
    this.requestProgressBar();
    this.progressBarState$.next('ERROR');
  }

  emitProgressBarCancelledState() {
    this.requestProgressBar();
    this.progressBarState$.next('CANCELLED');
  }

  emitProgressBarSuccessState() {
    this.progressBarState$.next('SUCCESS');
  }

  emitProgressBarInProgressState() {
    console.log('emit bar in progress');
    this.progressBarState$.next('IN_PROGRESS');
  }

  emitProgressBarState(state) {
    this.progressBarState$.next(state);
  }

};