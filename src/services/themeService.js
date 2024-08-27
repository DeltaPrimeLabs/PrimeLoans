import {BehaviorSubject, Subject} from 'rxjs';

export default class ThemeService {
  themeChange$ = new BehaviorSubject('LIGHT');

  emitThemeChange(theme) {
    this.themeChange$.next(theme);
  }

  observeThemeChange() {
    return this.themeChange$.asObservable();
  }
};
