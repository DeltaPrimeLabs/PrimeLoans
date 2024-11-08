import { BehaviorSubject, combineLatest, debounceTime, filter, map, take } from "rxjs";

export const TokenType = {
  WOMBAT: 'WOMBAT',
  GMXV2: 'GMXV2',
  TJV2: 'TJV2',
  BALANCER: 'BALANCER',
  PANGOLIN: 'PANGOLIN',
  PENPIE: 'PENPIE',
  UNDEFINED: 'UNDEFINED'
}

export class AssetsEntry {
  id = '' // TokenType
  openInterest = 0;
  longToken = {
    symbol: '',
    value: 0,
  }
  shortToken = {
    symbol: '',
    value: 0
  }

  constructor(id, openInterest = 0.5, longToken, shortToken) {
    this.id = id
    this.openInterest = openInterest
    this.longToken = longToken
    this.shortToken = shortToken
  }
}

export default class BullScoreService{
  TOKENS_TO_CALCULATE_AVAX = [
    TokenType.WOMBAT,
    TokenType.GMXV2,
    TokenType.TJV2,
    TokenType.BALANCER,
    TokenType.PANGOLIN,
  ]
  STABLES_AVAX = ['USDC', 'USDT']
  ASSETS_AVAX = ['AVAX', 'BTC', 'ETH']
  TOKENS_TO_CALCULATE_ARB = [
    TokenType.PENPIE,
    TokenType.GMXV2,
    TokenType.TJV2,
  ]
  STABLES_ARB = ['USDC', 'USDT', 'DAI']
  ASSETS_ARB = ['ARB', 'BTC', 'ETH']
  chain$ = new BehaviorSubject(undefined)
  stablesToCalculate$ = this.chain$.pipe(filter(Boolean), map(chain => chain === 'avalanche' ? this.STABLES_AVAX : this.STABLES_ARB))
  assetsToCalculate$ = this.chain$.pipe(filter(Boolean), map(chain => chain === 'avalanche' ? this.ASSETS_AVAX : this.ASSETS_ARB))

  _assets$ = new BehaviorSubject(undefined)
  _collateral$ = new BehaviorSubject(undefined)
  _assetsBalances$ = new BehaviorSubject(undefined)
  _debtsPerAsset$ = new BehaviorSubject(undefined)
  _tokens$ = new BehaviorSubject({})

  assets$ = this._assets$.pipe(filter(Boolean), debounceTime(1000))
  collateral$ = this._collateral$.pipe(filter(Boolean), debounceTime(1000))
  assetsBalances$ = this._assetsBalances$.pipe(filter(Boolean), debounceTime(1000))
  debtsPerAsset$ = this._debtsPerAsset$.pipe(filter(Boolean), debounceTime(1000))
  tokens$ = this._tokens$.pipe(filter(Boolean), debounceTime(1000))

  netBorrowed$ = combineLatest(this.assets$, this.assetsBalances$, this.debtsPerAsset$, this.collateral$, this.stablesToCalculate$, this.assetsToCalculate$).pipe(
    map(([assets, assetsBalances, debtsPerAsset, collateral, stablesToCalculate, assetsToCalculate]) => {
      const result = {}
      assetsToCalculate.forEach(assetSymbol => {
        result[assetSymbol] = (debtsPerAsset[assetSymbol].debt - assetsBalances[assetSymbol]) * assets[assetSymbol].price
      })

      result.STABLES = stablesToCalculate.reduce((previousValue, currentValue) => {
        const assetDebt = debtsPerAsset[currentValue] ? debtsPerAsset[currentValue].debt : 0
        previousValue += (assetDebt - assetsBalances[currentValue]) * assets[currentValue].price;
        return previousValue
      }, 0) + collateral
      return result
    })
  )

  hedgedNonStableValues$ = combineLatest(this.tokens$, this.netBorrowed$, this.assetsToCalculate$).pipe(
    map(([tokens, netBorrowed, assetsToCalculate]) => {
      const result = {}
      assetsToCalculate.forEach(assetSymbol => result[assetSymbol] = -netBorrowed[assetSymbol])

      for (const tokensInType in tokens) {
        tokens[tokensInType].forEach(token => {
          if (assetsToCalculate.includes(token.longToken.symbol)) {
            result[token.longToken.symbol] += token.longToken.value + token.oiHedgeNecessary
          }
          if (assetsToCalculate.includes(token.shortToken.symbol)) {
            result[token.shortToken.symbol] += token.shortToken.value - token.oiHedgeNecessary
          }
        })
      }
      return result
    })
  )

  bullScorePerAsset$ = combineLatest(this.assetsToCalculate$, this.assetsBalances$, this.assets$, this.tokens$, this.hedgedNonStableValues$).pipe(
    map(([assetsToCalculate, assetsBalances, assets, tokens, hedgedNonStableValues]) => {
      const result = {}
      const dividers = {}
      assetsToCalculate.forEach(assetSymbol => {
        result[assetSymbol] = hedgedNonStableValues[assetSymbol];
        dividers[assetSymbol] = assetsBalances[assetSymbol] * assets[assetSymbol].price;
      })

      for (const tokensInType in tokens) {
        tokens[tokensInType].forEach(token => {
          if (assetsToCalculate.includes(token.longToken.symbol)) {
            dividers[token.longToken.symbol] += token.longToken.value
          }
          if (assetsToCalculate.includes(token.shortToken.symbol)) {
            dividers[token.shortToken.symbol] += token.shortToken.value
          }
        })
      }
      for (const assetSymbol in result) {
        result[assetSymbol] = Math.min(Math.max(result[assetSymbol] / dividers[assetSymbol], -1), 1)
      }
      return result
    })
  )

  bullScore$ = combineLatest(this.bullScorePerAsset$, this.tokens$, this.assetsToCalculate$).pipe(
    map(([bullScorePerAsset, tokens, assetsToCalculate]) => {
      let finalBullScore = 0
      const sumVolatileAssets = { ALL: 0 }
      assetsToCalculate.forEach(assetSymbol => {
        sumVolatileAssets[assetSymbol] = 0;
      })
      for (const tokensInType in tokens) {
        tokens[tokensInType].forEach(token => {
          if (assetsToCalculate.includes(token.longToken.symbol)) {
            sumVolatileAssets[token.longToken.symbol] += token.longToken.value
            sumVolatileAssets.ALL += token.longToken.value
          }
          if (assetsToCalculate.includes(token.shortToken.symbol)) {
            sumVolatileAssets[token.shortToken.symbol] += token.shortToken.value
            sumVolatileAssets.ALL += token.shortToken.value
          }
        })
      }
      assetsToCalculate.forEach(assetSymbol => {
        finalBullScore += bullScorePerAsset[assetSymbol] * sumVolatileAssets[assetSymbol] / sumVolatileAssets.ALL
      })
      return finalBullScore
    })
  )

  allBullScores$ = combineLatest(this.bullScorePerAsset$, this.bullScore$).pipe(
    map(([bullScorePerAsset, bullScore]) => ({
      ...bullScorePerAsset,
      ALL: bullScore
    }))
  )

  constructor() {
    this.chain$.pipe(filter(Boolean), take(1)).subscribe(chain => {
      const tokensToCalculate = chain === 'avalanche' ? this.TOKENS_TO_CALCULATE_AVAX : this.TOKENS_TO_CALCULATE_ARB
      this._tokens$.next(tokensToCalculate.reduce((previousValue, currentValue) => {
        previousValue[currentValue] = []
        return previousValue
      }, {}))
    })
    // this._tokens$.pipe(
    //   debounceTime(1000)
    // ).subscribe(x => console.log(x))
    //
    // this.netBorrowed$.pipe(
    //   debounceTime(1000)
    // ).subscribe(x => console.log('NETBORROWED: ', x))
    //
    // this.hedgedNonStableValues$.pipe(
    //   debounceTime(1000)
    // ).subscribe(x => console.log('hedgedNonStableValues$: ', x))
    //
    // this.bullScorePerAsset$.pipe(
    //   debounceTime(1000)
    // ).subscribe(x => console.log('bullScorePerAsset$: ', x))
    //
    // this.bullScore$.pipe(
    //   debounceTime(1000)
    // ).subscribe(x => console.log('BULL SCORE: ', x))
  }

  setAssets(assets) {
    this._assets$.next(assets)
  }

  setCollateral(collateral) {
    this._collateral$.next(collateral)
  }

  setAssetsBalances(assetsBalances) {
    this._assetsBalances$.next(assetsBalances)
  }

  setDebtsPerAsset(debts) {
    this._debtsPerAsset$.next(debts)
  }

  setToken(type, newAssetsEntry) {
    if (this._tokens$.value[type]) {
      const oi = newAssetsEntry.openInterest
      const assetToAdd = {
        ...newAssetsEntry,
        oiHedgeNecessary: -(oi - (1 - oi)) * 100
      }
      const currentTokens = this._tokens$.value
      const entryIndex = currentTokens[type].findIndex(entries => entries.id === assetToAdd.id)
      if (entryIndex > -1) {
        currentTokens[type][entryIndex] = assetToAdd
      } else {
        currentTokens[type].push(assetToAdd)
      }
      this._tokens$.next(currentTokens)
    }
  }

  setChain(chain) {
    this.chain$.next(chain)
  }
}
