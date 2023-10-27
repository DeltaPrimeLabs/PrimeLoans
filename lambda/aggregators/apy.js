const ethers = require("ethers");
const fetch = require("node-fetch");

const { newChrome } = require("../utils/chrome");
const { dynamoDb } = require("../utils/helpers");

const vectorApyConfig = require('../config/vectorApy.json');
const yieldYakConfig = require('../config/yieldYakApy.json');
const tokenAddresses = require('../config/token_addresses.json');
const lpAssets = require('../config/lpAssets.json');
const steakHutApyConfig = require('../config/steakHutApy.json');
const traderJoeConfig = require('../config/traderJoeApy.json');
const sushiConfig = require('../config/sushiApy.json');
const beefyConfig = require('../config/beefyApy.json');
const levelConfig = require('../config/levelApy.json');

const formatUnits = (val, decimals) => parseFloat(ethers.utils.formatUnits(val, decimals));

const levelTvlAggregator = async (event) => {
  console.log('fetching TVLs from Level..');
  const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";

  // fetch APYs from Level on Arbitrum
  const resp = await fetch(levelApiUrl);
  const liquidityPerformance = await resp.json();

  const arbLP = liquidityPerformance.find(item => item.chainId == 42161);
  for (const lpInfo of arbLP.lpInfos) {
    const liquidityInUsd = formatUnits(lpInfo.totalSupply, 18) * formatUnits(lpInfo.price, 12);
    console.log(liquidityInUsd);

    const params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: levelConfig[lpInfo.name].symbol
      },
      AttributeUpdates: {
        tvl: {
          Value: Number(liquidityInUsd) ? liquidityInUsd : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();
  }

  return event;
}

const glpAprAggregator = async (event) => {
  // parse GLP APR from GMX website
  const URL = "https://gmx.io/";

  const { browser, page } = await newChrome();

  // navigate gmx website and wait till fully load
  await page.goto(URL, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  // wait until the apy element load
  // const glpApySelector = "div.Home-token-card-option-apr";
  // await page.mainFrame().waitForFunction(
  //   selector => !!document.querySelector(selector).innerText,
  //   {},
  //   glpApySelector
  // )

  const glpApy = await page.evaluate(() => {
    // select the elements with relevant class
    const items = document.querySelectorAll(".Home-token-card-option-apr");

    // parse APR of GLP on Avalanche
    return parseFloat(items[1].innerText.split(':').at(-1).trim().replaceAll('%', ''));
  });

  console.log(glpApy);

  const params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "GLP"
    },
    AttributeUpdates: {
      apy: {
        Value: Number(glpApy) ? glpApy : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  await browser.close();

  return event;
}

const vectorApyAggregator = async (event) => {
  const URL = "https://vectorfinance.io/pools";

  const { browser, page } = await newChrome();

  // navigate pools page and wait till javascript fully load.
  await page.goto(URL, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  // wait until the apy element load
  // const vtxPriceSelector = "header.not-landing-page div[title='VTX']";
  // await page.mainFrame().waitForFunction(
  //   selector => !!document.querySelector(selector).innerText,
  //   {},
  //   vtxPriceSelector
  // )

  console.log("parsing auto compounding APYs...");
  const [avaxApy, savaxApy, usdcApy, usdtApy] = await page.evaluate(() => {
    const parseApyFromTable = (pools, keyword) => {
      const assetPool = Array.from(pools).find(pool => pool.innerText.replace(/\s+/g, "").toLowerCase().startsWith(keyword));
      const assetColumns = assetPool.querySelectorAll("p.MuiTypography-root.MuiTypography-body1");
      const assetApy = parseFloat(assetColumns[2].innerText.split('%')[0].trim());
    
      return assetApy;
    }

    // select the pools with the class and find relevant records
    const pools = document.querySelectorAll("div.MuiAccordionSummary-content");

    // parsing USDT main auto APY
    const avaxApy = parseApyFromTable(pools, "avaxautopairedwithsavax");

    // parsing USDT main auto APY
    const savaxApy = parseApyFromTable(pools, "savaxautopairedwithavax");

    // parsing USDC main auto APY
    const usdcApy = parseApyFromTable(pools, "usdcautomainpool");

    // parsing USDT main auto APY
    const usdtApy = parseApyFromTable(pools, "usdtautomainpool");

    return [avaxApy, savaxApy, usdcApy, usdtApy];
  });

  console.log(avaxApy, savaxApy, usdcApy, usdtApy);

  // update APYs in db
  let params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "AVAX"
    },
    AttributeUpdates: {
      VF_AVAX_SAVAX_AUTO: {
        Value: Number(avaxApy) ? avaxApy / 100 : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "sAVAX"
    },
    AttributeUpdates: {
      VF_SAVAX_MAIN_AUTO: {
        Value: Number(savaxApy) ? savaxApy / 100 : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "USDC"
    },
    AttributeUpdates: {
      VF_USDC_MAIN_AUTO: {
        Value: Number(usdcApy) ? usdcApy / 100 : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "USDT"
    },
    AttributeUpdates: {
      VF_USDT_MAIN_AUTO: {
        Value: Number(usdtApy) ? usdtApy / 100 : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  // close browser
  await browser.close();

  return event;
}

const lpAndFarmApyAggregator = async (event) => {
  const VECTOR_APY_URL = "https://vector-api-git-overhaul-vectorfinance.vercel.app/api/v1/vtx/apr";
  const YIELDYAK_APY_AVA_URL = "https://staging-api.yieldyak.com/apys";
  const YIELDYAK_APY_ARB_URL = "https://staging-api.yieldyak.com/42161/apys";

  // fetching lp APYs
  try {
    for (const [asset, data] of Object.entries(lpAssets)) {
      let apy;
      if (data.dex === "Pangolin") {
        apy = await getPangolinLpApr(data.url);
      } else if (data.dex === "TraderJoe") {
        apy = await getTraderJoeLpApr(tokenAddresses[asset], data.appreciation);
      }

      console.log(asset, apy);

      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: asset
        },
        AttributeUpdates: {
          lp_apy: {
            Value: Number(apy) ?apy : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
    }

    console.log(`Fetching lp APYs finished.`);
  } catch (error) {
    console.log(`Fetching lp APYs failed. Error: ${error}`);
  };

  // fetching farm APYs
  const apys = {};
  const urls = [
    VECTOR_APY_URL,
    YIELDYAK_APY_AVA_URL,
    YIELDYAK_APY_ARB_URL
  ];

  try {
    Promise.all(urls.map(url =>
      fetch(url).then(resp => resp.json())
    )).then(async ([vectorAprs, yieldYakAvaApys, yieldYakArbApys]) => {

      if (!vectorAprs["Staking"]) console.log('APRs not available from Vector.');
      const stakingAprs = vectorAprs['Staking'];

      // fetching Vector APYs
      for (const [token, farm] of Object.entries(vectorApyConfig)) {
        if (Object.keys(stakingAprs).includes(farm.vectorId)) {
          // manual weekly APY
          const aprTotal = parseFloat(stakingAprs[farm.vectorId].total);
          const weeklyApy = (1 + aprTotal / 100 / 52) ** 52 - 1;

          if (token in apys) {
            apys[token][farm.protocolIdentifier] = weeklyApy;
          } else {
            apys[token] = {
              [farm.protocolIdentifier]: weeklyApy
            };
          }
        }
      }

      // fetching YieldYak APYs Avalanche
      for (const [token, farm] of Object.entries(yieldYakConfig.avalanche)) {
        if (!yieldYakAvaApys[farm.stakingContractAddress]) continue

        const yieldApy = yieldYakAvaApys[farm.stakingContractAddress].apy / 100;

        if (token in apys) {
          apys[token][farm.protocolIdentifier] = yieldApy;
        } else {
          apys[token] = {
            [farm.protocolIdentifier]: yieldApy
          };
        }
      }

      // fetching YieldYak APYs Arbitrum
      for (const [token, farm] of Object.entries(yieldYakConfig.arbitrum)) {
        if (!yieldYakArbApys[farm.stakingContractAddress]) continue

        const yieldApy = yieldYakArbApys[farm.stakingContractAddress].apy / 100;

        if (token in apys) {
          apys[token][farm.protocolIdentifier] = yieldApy;
        } else {
          apys[token] = {
            [farm.protocolIdentifier]: yieldApy
          };
        }
      }

      console.log(apys);
      // write apys to db
      for (const [token, apyData] of Object.entries(apys)) {
        const attributes = {};

        for (const [identifier, apy] of Object.entries(apyData)) {
          attributes[identifier] = {
            Value: Number(apy) ?apy : null,
            Action: "PUT"
          }
        }

        params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: token
          },
          AttributeUpdates: attributes
        };
        await dynamoDb.update(params).promise();
      }

      console.log(`Fetching farm APYs finished.`);
    });

  } catch (error) {
    console.log(`Fetching farm APYs failed. Error: ${error}`);
  }

  return event;
}

const steakHutApyAggregator = async (event) => {
  const URL = "https://app.steakhut.finance/pool/";

  const { browser, page } = await newChrome();

  for (const [asset, address] of Object.entries(steakHutApyConfig)) {

    // navigate pools page and wait till javascript fully load.
    await page.goto(URL + address, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    console.log("parsing APR (7-Day)...");

    const apy = await page.evaluate(() => {
      const fields = document.querySelectorAll(".chakra-heading");
      return fields[1].innerText.replace("%", "").trim();
    });

    console.log(asset, apy)

    // update APY in db
    const params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: asset
      },
      AttributeUpdates: {
        apy: {
          Value: Number(apy) ? apy / 100 : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();
  }

  // close browser
  await browser.close();

  return event;
}

const traderJoeApyAggregator = async (event) => {

  const { browser, page } = await newChrome();

  // fetch APYs for Avalanche and Arbitrum
  for (const [network, pools] of Object.entries(traderJoeConfig)) {
    for (const [pool, poolData] of Object.entries(pools)) {
      // navigate pools page and wait till javascript fully load.
      const URL = `https://traderjoexyz.com/${network}/pool/v21/`;
      await page.goto(URL + `${poolData.assetX}/${poolData.assetY}/${poolData.binStep}`, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      // await page.evaluate(() => {
      //   const tabs = document.querySelectorAll(".chakra-tabs__tab");
      //   tabs[4].click();
      //   return tabs;
      // })
      const tabs = await page.$$(".chakra-tabs__tab");
      tabs[4].click();
      await new Promise((resolve, reject) => setTimeout(resolve, 6000));

      const stats = await page.$$(".chakra-stat__number");
      const apy = (await (await stats[3].getProperty('textContent')).jsonValue()).replace('%', '');
      console.log(pool, apy);

      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: pool
        },
        AttributeUpdates: {
          lp_apy: {
            Value: Number(apy) ? apy / 100 : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
      await page.close();
    }
  }

  // close browser
  await browser.close();

  return event;
}

const sushiApyAggregator = async (event) => {

  const { browser, page } = await newChrome();

  // fetch APYs for Avalanche and Arbitrum
  for (const [network, pools] of Object.entries(sushiConfig)) {
    for (const [pool, poolData] of Object.entries(pools)) {
      // navigate pools page and wait till javascript fully load.
      const URL = "https://www.sushi.com/pool";
      await page.goto(URL + `/${network}%3A${poolData.address}`, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      const stats = await page.$$(".decoration-dotted");
      const apy = (await (await stats[0].getProperty('textContent')).jsonValue()).replace('%', '');
      console.log(pool, apy);

      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: pool
        },
        AttributeUpdates: {
          lp_apy: {
            Value: Number(apy) ? apy : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
    }
  }

  // close browser
  await browser.close();

  return event;
}

const beefyApyAggregator = async (event) => {

  const { browser, page } = await newChrome();

  // fetch APYs for Avalanche and Arbitrum
  for (const [protocol, networks] of Object.entries(beefyConfig)) {
    for (const [network, pools] of Object.entries(networks)) {
      for (const [pool, poolData] of Object.entries(pools)) {
        // navigate pools page and wait till javascript fully load.
        const URL = `https://app.beefy.com/vault/${protocol}-${network}-${pool}`;

        await page.goto(URL, {
          waitUntil: "networkidle0",
          timeout: 60000
        });

        const apy = await page.evaluate(() => {      
          const boxes = document.querySelectorAll("div.MuiBox-root");
          let apy;
          Array.from(boxes).map(box => {
            const content = box.innerText.replace(/\s+/g, "").toLowerCase();
            if (content.startsWith('apy')) {
              apy = content.replace('apy', '').replace('%', '').trim();
            }
          });

          return apy;
        });

        console.log(poolData.symbol, apy);

        const params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: poolData.symbol
          },
          AttributeUpdates: {
            [poolData.protocolIdentifier]: {
              Value: Number(apy) ? apy / 100 : null,
              Action: "PUT"
            }
          }
        };
        await dynamoDb.update(params).promise();
      }
    }
  }

  // close browser
  await browser.close();

  return event;
}

const levelApyAggregator = async (event) => {
  const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";
  const redstoneFeedUrl = "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod";

  const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
  const redstonePriceData = await redstonePriceDataRequest.json();

  // fetch APYs from Level on Arbitrum
  const resp = await fetch(levelApiUrl);
  const liquidityPerformance = await resp.json();

  const arbLP = liquidityPerformance.find(item => item.chainId == 42161);
  for (const lpInfo of arbLP.lpInfos) {
    const liquidityInUsd = formatUnits(lpInfo.totalSupply, 18) * formatUnits(lpInfo.price, 12);

    let tradingFees = 0;

    for (const [address, fees] of Object.entries(lpInfo.feeDetailsPerWeek)) {
      Object.values(fees).forEach(fee => {
        tradingFees += formatUnits(fee, levelConfig.lpSymbols[address].decimals) * redstonePriceData[levelConfig.lpSymbols[address].symbol][0].dataPoints[0].value;
      });
    }

    const profit =
      (formatUnits(lpInfo.lvlRewards, 18) * formatUnits(lpInfo.lvlPrice, 12)) +
      formatUnits(lpInfo.mintingFee, 6) +
      formatUnits(lpInfo.pnlVsTrader, 30) +
      tradingFees;

    const apy = profit / liquidityInUsd / 7 * 365 * 100;
    console.log(levelConfig[lpInfo.name].symbol, levelConfig[lpInfo.name].protocolIdentifier, apy);

    const params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: levelConfig[lpInfo.name].symbol
      },
      AttributeUpdates: {
        [levelConfig[lpInfo.name].protocolIdentifier]: {
          Value: Number(apy) ? apy : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();
  }

  return event;
}

module.exports = {
  levelTvlAggregator,
  glpAprAggregator,
  vectorApyAggregator,
  lpAndFarmApyAggregator,
  steakHutApyAggregator,
  traderJoeApyAggregator,
  sushiApyAggregator,
  beefyApyAggregator,
  levelApyAggregator
}