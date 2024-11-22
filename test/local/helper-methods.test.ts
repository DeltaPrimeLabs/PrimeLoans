import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {Allowance, AssetBalanceLeverage, Debt, getLiquidationAmounts, Repayment} from "../_helpers";

chai.use(solidity);

describe('Helper methods', () => {

    describe('Calculating liquidation amounts', async () => {
        const TEST_TABLE = [
            {
                id: 1,
                balances: [
                    new AssetBalanceLeverage('AVAX', 300, 0.8333333),
                    new AssetBalanceLeverage('BTC', 0, 0.8333333),
                    new AssetBalanceLeverage('USDC', 0, 0.8333333),
                    new AssetBalanceLeverage('ETH', 0, 0.8333333)
                ],
                debts: [
                    new Debt('AVAX', 250),
                    new Debt('BTC', 0),
                    new Debt('USDC', 0),
                    new Debt('ETH', 0)
                ],
                repayAmounts: [
                    new Repayment('AVAX', 81.0546875),
                    new Repayment('BTC', 0),
                    new Repayment('USDC', 0),
                    new Repayment('ETH', 0),
                ],
                deliveredAmounts: [
                    new Allowance('AVAX', 0),
                    new Allowance('BTC', 0),
                    new Allowance('USDC', 0),
                    new Allowance('ETH', 0),
                ],
                targetHealthRatio: 1.04,
                bonus: 0.1,
                action: 'LIQUIDATE'
            },
            {
                id: 2,
                balances: [
                    new AssetBalanceLeverage('AVAX', 0, 0.8333333),
                    new AssetBalanceLeverage('BTC', 0, 0.8333333),
                    new AssetBalanceLeverage('USDC', 6000, 0.8333333),
                    new AssetBalanceLeverage('ETH', 0, 0.8333333)
                ],
                debts: [
                    new Debt('AVAX', 250),
                    new Debt('BTC', 0),
                    new Debt('USDC', 0),
                    new Debt('ETH', 0)
                ],
                repayAmounts: [
                    new Repayment('AVAX', 81.0546875),
                    new Repayment('BTC', 0),
                    new Repayment('USDC', 0),
                    new Repayment('ETH', 0),
                ],
                deliveredAmounts: [
                    new Allowance('AVAX', 81.0546875),
                    new Allowance('BTC', 0),
                    new Allowance('USDC', 0),
                    new Allowance('ETH', 0),
                ],
                targetHealthRatio: 1.04,
                bonus: 0.1,
                action: 'LIQUIDATE'
            },
            {
                id: 3,
                balances: [
                    new AssetBalanceLeverage('AVAX', 50, 0.8333333),
                    new AssetBalanceLeverage('BTC', 0.05, 0.8333333),
                    new AssetBalanceLeverage('USDC', 3000, 0.8333333),
                    new AssetBalanceLeverage('ETH', 1, 0.8333333)
                ],
                debts: [
                    new Debt('AVAX', 100),
                    new Debt('BTC', 0),
                    new Debt('USDC', 0),
                    new Debt('ETH', 3)
                ],
                repayAmounts: [
                    new Repayment('AVAX', 50),
                    new Repayment('BTC', 0),
                    new Repayment('USDC', 0),
                    new Repayment('ETH', 0.62109375),
                ],
                deliveredAmounts: [
                    new Allowance('AVAX', 0),
                    new Allowance('BTC', 0),
                    new Allowance('USDC', 0),
                    new Allowance('ETH', 0),
                ],
                targetHealthRatio: 1.04,
                bonus: 0.1,
                action: 'LIQUIDATE'
            }
        ];

        const MOCK_PRICES = [
            {
                dataFeedId: 'AVAX',
                value: 20
            },
            {
                dataFeedId: 'USDC',
                value: 1
            },
            {
                dataFeedId: 'ETH',
                value: 1000
            },
            {
                dataFeedId: 'BTC',
                value: 20000
            }
        ];

        TEST_TABLE.forEach(
            testCase => {
                it(`liquidation test case number ${testCase.id}`, async function () {
                    let totalValue = testCase.balances.reduce((x, y) => x + y.balance * MOCK_PRICES.find(price => price.dataFeedId == y.name)!.value, 0)
                    let debt = testCase.debts.reduce((x, y) => x + y.debt * MOCK_PRICES.find(price => price.dataFeedId == y.name)!.value, 0)

                    let {repayAmounts, deliveredAmounts} = getLiquidationAmounts(
                        'LIQUIDATE',
                        testCase.debts,
                        testCase.balances,
                        MOCK_PRICES,
                        testCase.targetHealthRatio,
                        testCase.bonus,
                        totalValue < debt
                    );

                    repayAmounts.forEach(
                        (calculated: any) => {
                            let expected = testCase.repayAmounts.find((el: any) => el.name == calculated.name)!;
                            expect(calculated.amount).to.be.closeTo(expected.amount, 0.001);
                        }
                    );

                    if (testCase.deliveredAmounts && testCase.deliveredAmounts.length > 0) {
                        deliveredAmounts.forEach(
                            (calculated: any) => {
                                //@ts-ignore
                                let expected = testCase.deliveredAmounts.find(el => el!.name == calculated.name)!;
                                //@ts-ignore
                                expect(calculated.amount).to.be.closeTo(expected.amount, 0.001);
                            }
                        );
                    }
                });
            }
        )
    });
});

