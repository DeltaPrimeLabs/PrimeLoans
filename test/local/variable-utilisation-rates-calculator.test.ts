import {waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";

import AvalancheWavaxVariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/deployment/avalanche/WavaxVariableUtilisationRatesCalculator.sol/WavaxVariableUtilisationRatesCalculator.json';
import AvalancheUsdcVariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/deployment/avalanche/UsdcVariableUtilisationRatesCalculator.sol/UsdcVariableUtilisationRatesCalculator.json';
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import {
    MockVariableUtilisationRatesCalculator,
    UsdcVariableUtilisationRatesCalculator,
    WavaxVariableUtilisationRatesCalculator
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {BigNumber, Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

// From left: pool utilisation, expected Borrowing Rate, expected Deposit Rate
const MOCK_TEST_TABLE_RATES = [
    [ 0, 0.03, 0 ],
    [ 0.01, 0.03, 0.00024 ],
    [ 1e-8, 0.03, 2.4e-10 ],
    [ 0.1, 0.03, 0.0024 ],
    [ 0.15, 0.03, 0.0036 ],
    [ 0.2, 0.03, 0.0048 ],
    [ 0.3, 0.03, 0.0072 ],
    [ 0.4, 0.03, 0.0096 ],
    [ 0.5, 0.03, 0.012 ],
    [ 0.52, 0.03, 0.01248 ],
    [ 0.599999, 0.03, 0.014399976 ],
    [ 0.6, 0.03, 0.0144 ],
    [ 0.6000001, 0.030000045, 0.0144000240000036 ],
    [ 0.7, 0.075, 0.042 ],
    [ 0.79, 0.1155, 0.072996 ],
    [ 0.8, 0.12, 0.0768 ],
    [ 0.799999, 0.11999955, 0.07679961600036 ],
    [ 0.8057, 0.137955, 0.0889202748 ],
    [ 0.800001, 0.12000315, 0.07680211200252 ],
    [ 0.825, 0.19875, 0.131175 ],
    [ 0.85, 0.2775, 0.1887 ],
    [ 0.875, 0.35625, 0.249375 ],
    [ 0.9, 0.435, 0.3132 ],
    [ 0.925, 0.51375, 0.380175 ],
    [ 0.95, 0.5925, 0.4503 ],
    [ 0.975, 0.67125, 0.523575 ],
    [ 0.999, 0.74685, 0.59688252 ],
    [ 1, 0.75, 0.6 ]
]

const AVALANCHE_WAVAX_TEST_TABLE_RATES = [
    [ 0, 0, 0 ],
    [ 0.01, 0.0005, 0.000004999995 ],
    [ 1e-8, 5e-10, 4e-18 ],
    [ 0.1, 0.005, 0.0004999995 ],
    [ 0.15, 0.0075, 0.001124998875 ],
    [ 0.2, 0.01, 0.001999998 ],
    [ 0.3, 0.015, 0.0044999955 ],
    [ 0.4, 0.02, 0.007999992 ],
    [ 0.5, 0.025, 0.0124999875 ],
    [ 0.52, 0.026, 0.01351998648 ],
    [ 0.599999, 0.02999995, 0.01799992200011 ],
    [ 0.6, 0.03, 0.017999982 ],
    [ 0.4586, 0.02293, 0.010515687484302 ],
    [ 0.7, 0.05, 0.034999965 ],
    [ 0.79, 0.068, 0.05371994628 ],
    [ 0.8, 0.07, 0.055999944 ],
    [ 0.799999, 0.0699998, 0.05599971400043 ],
    [ 0.7982, 0.06964, 0.055586592413352 ],
    [ 0.8057, 0.07285, 0.058695186304755 ],
    [ 0.800001, 0.0700005, 0.05600041400003 ],
    [ 0.825, 0.0825, 0.0680624319375 ],
    [ 0.85, 0.095, 0.08074991925 ],
    [ 0.875, 0.1075, 0.0940624059375 ],
    [ 0.9, 0.12, 0.107999892 ],
    [ 0.925, 0.865, 0.800124199875 ],
    [ 0.95, 1.61, 1.5294984705 ],
    [ 0.975, 2.355, 2.296122703875 ],
    [ 0.999, 3.0702, 3.0671267328702 ],
    [ 1, 3.1, 3.0999969 ]
]

const AVALANCHE_USDC_TEST_TABLE_RATES = [
    [ 0, 0, 0 ],
    [ 0.01, 0.0005, 0.0000045 ],
    [ 1e-8, 5e-10, 4e-18 ],
    [ 0.1, 0.005, 0.00045 ],
    [ 0.15, 0.0075, 0.0010125 ],
    [ 0.2, 0.01, 0.0018 ],
    [ 0.3, 0.015, 0.00405 ],
    [ 0.4, 0.02, 0.0072 ],
    [ 0.5, 0.025, 0.01125 ],
    [ 0.52, 0.026, 0.012168 ],
    [ 0.599999, 0.02999995, 0.016199946000045 ],
    [ 0.6, 0.03, 0.0162 ],
    [ 0.68, 0.046, 0.028152 ],
    [ 0.7, 0.05, 0.0315 ],
    [ 0.725, 0.055, 0.0358875 ],
    [ 0.8, 0.07, 0.0504 ],
    [ 0.799999, 0.0699998, 0.05039979300018 ],
    [ 0.8057, 0.07285, 0.0528257205 ],
    [ 0.800001, 0.0700005, 0.05040042300045 ],
    [ 0.825, 0.0825, 0.06125625 ],
    [ 0.85, 0.095, 0.072675 ],
    [ 0.8695, 0.10475, 0.0819721125 ],
    [ 0.875, 0.1075, 0.08465625 ],
    [ 0.9, 0.12, 0.0972 ],
    [ 0.925, 0.315, 0.2622375 ],
    [ 0.95, 0.51, 0.43605 ],
    [ 0.975, 0.705, 0.6186375 ],
    [ 0.999, 0.8922, 0.80217702 ],
    [ 1, 0.9, 0.81 ]
]

// From left: totalLoans, totalDeposits, expected pool utilisation
const POOL_UTILISATION = [
    [1, 10, 0.1],
    [1, 100000, 0.00001],
    [0.001, 100000000, 0.00000000001],
    [1.1, 1, 1.1],
    [1e-5, 1e5, 1e-10],
    // maximum test accuracy
    [1e-5, 1e7, 1e-12],
    // above maximum test accuracy
    [1e-5, 1e8, 0],
    [4321.432, 5710432.34217984, 0.0007567609142]
]

const AVALANCHE_WAVAX_SPREAD = toWei('0.000001');
const AVALANCHE_USDC_SPREAD = toWei('0.1');

describe('VariableUtilisationRatesCalculator', () => {
    let mockCalculator: MockVariableUtilisationRatesCalculator,
        avalancheWavaxCalculator: WavaxVariableUtilisationRatesCalculator,
        avalancheUsdcCalculator: UsdcVariableUtilisationRatesCalculator,
        owner: SignerWithAddress,
        nonOwner: SignerWithAddress,
        deposits: number;

    before(async () => {
        [owner, nonOwner] = await getFixedGasSigners(10000000);
        mockCalculator = (await deployContract(
            owner,
            VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;

        avalancheWavaxCalculator = (await deployContract(
            owner,
            AvalancheWavaxVariableUtilisationRatesCalculatorArtifact)) as WavaxVariableUtilisationRatesCalculator;

        await avalancheWavaxCalculator.setSpread(AVALANCHE_WAVAX_SPREAD);

        avalancheUsdcCalculator = (await deployContract(
            owner,
            AvalancheUsdcVariableUtilisationRatesCalculatorArtifact)) as UsdcVariableUtilisationRatesCalculator;

        await avalancheUsdcCalculator.setSpread(AVALANCHE_USDC_SPREAD);

        deposits = 100;
    });

    it('Test calculators', async () => {
        POOL_UTILISATION.forEach(
            testCase => {
                it(`should calculate pool utilisation for ${testCase[0]} totalLoans and ${testCase[1]} totalDeposits`, async function () {
                    expect(fromWei(await mockCalculator.getPoolUtilisation(
                        toWei(testCase[0].toFixed(18).toString()),
                        toWei(testCase[1].toFixed(18).toString()))))
                        .to.be.closeTo(testCase[2], 1e-13);
                });
            }
        );

        console.log('----MOCK----')
        await testRates(MOCK_TEST_TABLE_RATES, mockCalculator);
        console.log('----AVAX----')
        await testRates(AVALANCHE_WAVAX_TEST_TABLE_RATES, avalancheWavaxCalculator);
        console.log('----USDC----')
        await testRates(AVALANCHE_USDC_TEST_TABLE_RATES, avalancheUsdcCalculator);

        async function testRates(testTable: Array<any>, ratesContract: Contract) {
            for (const testCase of testTable) {
                const percentageUtilisation = testCase[0] * 100;
                console.log(`should calculate rates for ${percentageUtilisation}% utilisation`);
                let loansInWei = toWei((testCase[0] * deposits).toFixed(12).toString());
                let depositsInWei = toWei(deposits.toString());

                const borrowingRate = fromWei(await ratesContract.calculateBorrowingRate(loansInWei, depositsInWei));
                const depositRate = fromWei(await ratesContract.calculateDepositRate(loansInWei, depositsInWei));

                console.log('borrowing Rate: ', borrowingRate)
                expect(borrowingRate).to.be.closeTo(testCase[1], 1e-11);
                expect(depositRate).to.be.closeTo(testCase[2], 1e-11);
            }
        }
    });
});
