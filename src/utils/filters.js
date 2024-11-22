import Vue from 'vue';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';
import {removePaddedTrailingZeros} from './calculate';

TimeAgo.addDefaultLocale(en);

export default function setupFilters() {
  const timeAgo = new TimeAgo('en');

  Vue.filter('usd', function (value, precision = 2) {
    if (value == null) return null;
    return '$ ' + Math.abs(value).toLocaleString(
      undefined, // use the visitor's browser
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: precision
      }
    );
  });

  Vue.filter('usd-precise', function (value) {
    if (value == null) return null;
    return '$' + value.toFixed(12);
  });

  Vue.filter('avax', function (value, precision = 2) {
    if (value == null) return null;
    return value.toFixed(precision);
  });

  Vue.filter('full', function (value, avaxPrice) {
    if (value == null) return null;
    let usd = value * avaxPrice;
    return value.toFixed(2) + ' AVAX ($' + usd.toFixed(2) + ')';
  });

  Vue.filter('units', function (value) {
    if (value == null) return null;
    return value.toPrecision(3);
  });

  Vue.filter('percent', function (value, precision = 2) {
    if (value == null) return null;
    return (value * 100).toFixed(precision) + '%';
  });

  Vue.filter('tx', function (value, short) {
    if (value == null) return null;
    if (short) {
      return value.substr(0, 3) + '...' + value.substr(value.length - 2);
    } else {
      return value.substr(0, 6) + '...' + value.substr(value.length - 4);
    }
  });

  Vue.filter('date', function (value) {
    return timeAgo.format(value.getTime());
  });

  Vue.filter('smartRound', function (value, precision = 8, toFixed = false) {
    if (Number.isNaN(value)) {
      return '0';
    }
    if (value < 0) {
      value = Math.abs(value);
    }
    const valueOrderOfMagnitudeExponent = String(value).split('.')[0].length - 1;
    const precisionMultiplierExponent = precision - valueOrderOfMagnitudeExponent;
    const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
    if (!toFixed) {
      return value !== null ? String(Math.round(value * precisionMultiplier) / precisionMultiplier) : '';
    } else {
      return value !== null ? removePaddedTrailingZeros((Math.round(value * precisionMultiplier) / precisionMultiplier).toFixed(precision)) : '';
    }
  });
}
