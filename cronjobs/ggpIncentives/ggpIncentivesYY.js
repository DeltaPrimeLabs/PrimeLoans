const ethers = require('ethers');
const fetch = require('node-fetch');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
  fetchAllDataFromDB,
  getRedstoneDataPackages
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const ggpTokens = require('../config/ggpTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');
const pingUrl = require('../.secrets/ping.json');
const incentivesRpcUrl = require('../.secrets/incentivesRpc.json');

const redstoneFeedUrl = constants.avalanche.redstoneFeedUrl;

const getHistoricalProvider = (network, rpc) => {
  return new ethers.providers.JsonRpcProvider(incentivesRpcUrl[network][rpc])
};

const getFactoryContract = (network, provider) => {
  const factoryAddress = constants[network].factory;
  const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

  return factoryContract;
}

const wrap = (contract, network, dataPackages) => {
  return WrapperBuilder.wrap(contract).usingDataPackages(dataPackages);
}

const getWrappedContracts = (addresses, network, provider, dataPackages) => {
  const wallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
    .connect(provider);

  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, wallet);
    const wrappedContract = wrap(loanContract, network, dataPackages);

    return wrappedContract;
  });
}

const getIncentivesMultiplier = async (now) => {
  const params = {
    TableName: "ggp-incentives-ava-prod",
  };

  const res = await fetchAllDataFromDB(params, true);

  if (res.length == 0){
    console.log('multiplier', 1)
    return 1;
  }

  res.sort((a, b) => b.timestamp - a.timestamp);

  const multiplier = Math.round((now - res[0].timestamp) / 3600);
  console.log('multiplier', multiplier)
  return multiplier;
};

const getEligibleTvl = async (batchLoanAddresses, network, provider, dataPackages) => {
  const loanQualifications = {};
  let totalEligibleTvl = 0;

  const wrappedContracts = getWrappedContracts(batchLoanAddresses, network, provider, dataPackages);

  const loanStats = await Promise.all(
    wrappedContracts.map(contract => Promise.all([contract.getFullLoanStatus(), contract.ggAvaxBalanceAvaxGgavaxYY()]))
  );

  const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
  const redstonePriceData = await redstonePriceDataRequest.json();

  if (loanStats.length > 0) {
    await Promise.all(
      loanStats.map(async (loan, batchId) => {
        const loanId = batchLoanAddresses[batchId].toLowerCase();
        const status = loan[0];
        const collateral = fromWei(status[0]) - fromWei(status[1]);

        const ggAvaxBalance = formatUnits(loan[1]);
        const ggAvaxPrice = redstonePriceData['WOMBAT_ggAVAX_AVAX_LP_ggAVAX'] ? redstonePriceData['WOMBAT_ggAVAX_AVAX_LP_ggAVAX'][0].dataPoints[0].value : 0;
        const loanggAvaxValue = ggAvaxBalance * ggAvaxPrice;

        const eligibleTvl = loanggAvaxValue - collateral > 0 ? loanggAvaxValue - collateral : 0;

        loanQualifications[loanId] = {
          eligibleTvl
        };

        totalEligibleTvl += eligibleTvl;
      })
    );
  }

  return [loanQualifications, totalEligibleTvl]
}

const ggpIncentives = async (network = 'avalanche', rpc = 'first') => {
  const now = Math.floor(Date.now() / 1000);
  const incentivesPerWeek = 125;
  const incentivesMultiplier = await getIncentivesMultiplier(now);

  if (incentivesMultiplier == 0) return;

  try {
    let provider = getHistoricalProvider(network, rpc);
    const factoryContract = getFactoryContract(network, provider);
    let loanAddresses = await factoryContract.getAllLoans();
    const totalLoans = loanAddresses.length;

    const incentivesPerInterval = incentivesPerWeek / (60 * 60 * 24 * 7) * (60 * 60) * incentivesMultiplier;
    const batchSize = 200;

    let loanQualifications = {};
    let totalEligibleTvl = 0;

    // calculate eligible ggAVAX of loan
    for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      let qualifications;
      let retryTime = 0;

      while (1) {
        try {
          const dataPackages = await getRedstoneDataPackages(network);
          qualifications = await getEligibleTvl(batchLoanAddresses, network, provider, dataPackages);
          break;
        } catch (error) {
          console.log(error)
          retryTime += 1;
          if (retryTime > 3) break;

          console.log('retryTime', retryTime)
          console.log('........will retry the function........');
          provider = getHistoricalProvider(network, rpc == 'first' ? 'second' : 'first');
          await new Promise((resolve, reject) => setTimeout(resolve, 10000));
        }
      }

      if (!qualifications) break;

      loanQualifications = {
        ...loanQualifications,
        ...qualifications[0]
      }

      totalEligibleTvl += qualifications[1];
    }

    console.log(`${Object.entries(loanQualifications).length} loans analyzed.`);

    if (Object.entries(loanQualifications).length == totalLoans) {
      // incentives of all loans
      const loanIncentives = {};

      Object.entries(loanQualifications).forEach(([loanId, loanData]) => {
        loanIncentives[loanId] = 0;

        if (loanData.eligibleTvl > 0) {
          loanIncentives[loanId] = incentivesPerInterval * loanData.eligibleTvl / totalEligibleTvl;
        }
      })

      // save boost APY to DB
      const boostApy = totalEligibleTvl > 0 ? (incentivesPerInterval / incentivesMultiplier) / totalEligibleTvl * 24 * 365 : 0;
      console.log(boostApy)

      const params = {
        TableName: "statistics-prod",
        Key: {
          id: "GGP_YY_ggAVAX"
        },
        AttributeUpdates: {
          boostApy: {
            Value: Number(boostApy) ? boostApy : null,
            Action: "PUT"
          }
        }
      };

      await dynamoDb.update(params).promise();

      console.log("GGP boost APY on Avalanche saved.");

      // save/update incentives values to DB
      await Promise.all(
        Object.entries(loanIncentives).map(async ([loanId, value]) => {
          const data = {
            id: loanId,
            timestamp: now,
            ggpCollected: value
          };

          const params = {
            TableName: "ggp-incentives-yy-ava-prod",
            Item: data
          };
          await dynamoDb.put(params).promise();
        })
      );

      console.log("GGP incentives successfully updated.")

      // ping healthcheck end point
      // await fetch(pingUrl.ggp.success);
    } else {
      // await fetch(pingUrl.ggp.fail, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     message: "reading from contracts failed. will recover incentives in next turn after an hour."
      //   })
      // });
    }
  } catch (error) {
    console.log('------------------function terminated-------------------------------')
    console.log('Error', error);

    // await fetch(pingUrl.ggp.fail, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     error,
    //     message: "function terminated. will recover incentives in next turn after an hour."
    //   })
    // });
  }
}

ggpIncentives('avalanche', 'first');