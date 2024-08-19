import {BehaviorSubject, Subject} from 'rxjs';

export default class ThemeService {
  themeChange$ = new BehaviorSubject('LIGHT');
  degenMode$ = new BehaviorSubject(false);

  emitThemeChange(theme) {
    this.themeChange$.next(theme);
  }

  observeThemeChange() {
    return this.themeChange$.asObservable();
  }

  changeDegenMode(isDegen) {
    this.degenMode$.next(isDegen);
  }

  observeDegenMode() {
    return this.degenMode$.asObservable();
  }
};
