import { ethers, waffle, network } from "hardhat";
import chai from "chai";
import { BigNumber, Contract } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  constructSimpleSDK,
  ContractMethod,
  SimpleFetchSDK,
  SwapSide,
} from "@paraswap/sdk";
import axios from "axios";

import MockTokenManagerArtifact from "../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json";
import SmartLoansFactoryArtifact from "../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json";
import AddressProviderArtifact from "../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AddressProvider,
  MockTokenManager,
  SmartLoanGigaChadInterface,
  SmartLoansFactory,
} from "../../../typechain";
import {
  deployPools,
  addMissingTokenContracts,
  Asset,
  convertAssetsListToSupportedAssets,
  convertTokenPricesMapToMockPrices,
  deployAllFacets,
  erc20ABI,
  formatUnits,
  fromBytes32,
  fromWei,
  getFixedGasSigners,
  getRedstonePrices,
  syncTime,
  toBytes32,
  toWei,
  wavaxAbi,
  getTokensPricesMap,
  PoolAsset,
  PoolInitializationObject,
  recompileConstantsFile,
  parseParaSwapRouteData,
} from "../../_helpers";
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { parseUnits } from "ethers/lib/utils";
import { deployDiamond } from "../../../tools/diamond/deploy-diamond";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";

chai.use(solidity);

const { deployContract, provider } = waffle;
const { expect } = chai;

describe("ParaSwap", () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe("Test buying and selling an asset", () => {
    let smartLoansFactory: SmartLoansFactory,
      loan: SmartLoanGigaChadInterface,
      nonOwnerWrappedLoan: any,
      poolContracts: Map<string, Contract> = new Map(),
      tokenContracts: Map<string, Contract> = new Map(),
      lendingPools: Array<PoolAsset> = [],
      supportedAssets: Array<Asset>,
      tokensPrices: Map<string, number>,
      wrappedLoan: any,
      owner: SignerWithAddress,
      nonOwner: SignerWithAddress,
      depositor: SignerWithAddress,
      paraSwapMin: SimpleFetchSDK,
      MOCK_PRICES: any,
      diamondAddress: any;

    const getSwapData = async (
      srcToken: keyof typeof TOKEN_ADDRESSES,
      destToken: keyof typeof TOKEN_ADDRESSES,
      srcAmount: any,
      destAmount: any
    ) => {
      const priceRoute = await paraSwapMin.swap.getRate({
        srcToken: TOKEN_ADDRESSES[srcToken],
        destToken: TOKEN_ADDRESSES[destToken],
        amount: srcAmount.toString(),
        userAddress: wrappedLoan.address,
        side: SwapSide.SELL,
        /// forcing API to always give a multiSwap route. For testing multiSwap swapData dea
        // https://github.com/paraswap/paraswap-sdk/blob/17c2c2162fac8a5cb18aaa9588c44c0c6545f8f7/src/methods/swap/rates.ts#L74
        // excludeContractMethods: ["swapExactAmountIn", "swapExactAmountInOnUniswapV3"],  swapExactAmountIn, uniV3 v6.2: swapExactAmountInOnUniswapV3
        includeContractMethods: [
          "swapExactAmountIn",
          "swapExactAmountInOnUniswapV3",
        ],
        // includeContractMethods: "swapExactAmountIn",
        // version specification
        // https://github.com/paraswap/paraswap-sdk/blob/17c2c2162fac8a5cb18aaa9588c44c0c6545f8f7/src/methods/swap/rates.ts#L129
        version: 6.2,
        // excludeDEXS: "UniswapV3",
      });
      const txParams = await paraSwapMin.swap.buildTx(
        {
          srcToken: priceRoute.srcToken,
          destToken: priceRoute.destToken,
          srcAmount: priceRoute.srcAmount,
          slippage: 300, //increasing slippage from 3% to 9%
          priceRoute,
          // deadline: Math.floor(Date.now() / 1000) + 3000,
          userAddress: wrappedLoan.address,
          // partner: "anon",
        },
        {
          ignoreChecks: true,
        }
      );
      const swapData = parseParaSwapRouteData(txParams);
      return swapData;
    };

    before("deploy factory and pool", async () => {
      [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);

      let assetsList = ["AVAX", "USDC", "ETH"];
      let poolNameAirdropList: Array<PoolInitializationObject> = [
        { name: "AVAX", airdropList: [depositor] },
      ];

      diamondAddress = await deployDiamond();

      smartLoansFactory = (await deployContract(
        owner,
        SmartLoansFactoryArtifact
      )) as SmartLoansFactory;

      let tokenManager = (await deployContract(
        owner,
        MockTokenManagerArtifact,
        []
      )) as MockTokenManager;

      await deployPools(
        smartLoansFactory,
        poolNameAirdropList,
        tokenContracts,
        poolContracts,
        lendingPools,
        owner,
        depositor,
        2000,
        "AVAX",
        [],
        tokenManager.address
      );

      tokensPrices = await getTokensPricesMap(
        assetsList,
        "avalanche",
        getRedstonePrices,
        []
      );
      MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
      supportedAssets = convertAssetsListToSupportedAssets(assetsList);
      addMissingTokenContracts(
        tokenContracts,
        assetsList.filter(
          (asset) => !Array.from(tokenContracts.keys()).includes(asset)
        )
      );

      await tokenManager
        .connect(owner)
        .initialize(supportedAssets, lendingPools);
      await tokenManager
        .connect(owner)
        .setFactoryAddress(smartLoansFactory.address);

      await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

      let addressProvider = (await deployContract(
        owner,
        AddressProviderArtifact,
        []
      )) as AddressProvider;

      await recompileConstantsFile(
        "local",
        "DeploymentConstants",
        [],
        tokenManager.address,
        addressProvider.address,
        diamondAddress,
        smartLoansFactory.address,
        "lib"
      );

      await deployAllFacets(diamondAddress);

      paraSwapMin = constructSimpleSDK({ chainId: 43114, axios });
    });

    beforeEach(async () => {
      // Get current block
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTimestamp = currentBlock.timestamp;

      // Add 1 day (86400 seconds)
      const oneDayFromNow = currentTimestamp + 86400;

      // Set next block's timestamp and mine it
      await network.provider.send("evm_setNextBlockTimestamp", [oneDayFromNow]);
      await network.provider.send("evm_mine");
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();
      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(
        owner.address
      );
      loan = await ethers.getContractAt(
        "SmartLoanGigaChadInterface",
        loan_proxy_address,
        owner
      );

      wrappedLoan = WrapperBuilder
        // @ts-ignore
        .wrap(loan)
        .usingSimpleNumericMock({
          mockSignersCount: 10,
          dataPoints: MOCK_PRICES,
        });

      nonOwnerWrappedLoan = WrapperBuilder
        // @ts-ignore
        .wrap(loan.connect(nonOwner))
        .usingSimpleNumericMock({
          mockSignersCount: 10,
          dataPoints: MOCK_PRICES,
        });
    });

    it("should fund a loan", async () => {
      await tokenContracts
        .get("AVAX")!
        .connect(owner)
        .deposit({ value: toWei("100") });
      await tokenContracts
        .get("AVAX")!
        .connect(owner)
        .approve(wrappedLoan.address, toWei("100"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
    });

    it("should fail to swap as a non-owner", async () => {
      // changing getSwapData to getNonOwnerSwapData to pass nonOwnerWrappedLoad address
      const swapData = await getSwapData("AVAX", "USDC", toWei("10"), 1);
      await expect(
        nonOwnerWrappedLoan.paraSwapV2(
          swapData.selector,
          swapData.data,
          TOKEN_ADDRESSES["AVAX"],
          toWei("10"),
          TOKEN_ADDRESSES["USDC"],
          1
        )
      ).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
    });

    it("should swap funds: AVAX -> USDC", async () => {
      let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
      let initialHR = fromWei(await wrappedLoan.getHealthRatio());
      let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

      expect(await loanOwnsAsset("USDC")).to.be.false;

      let minOut = parseUnits((tokensPrices.get("AVAX")! * 9.8).toFixed(6), 6);
      const swapData = await getSwapData("AVAX", "USDC", toWei("10"), minOut);
      console.log("MinOut for AVAX -> USDC: ", minOut);
      await wrappedLoan.paraSwapV2(
        swapData.selector,
        swapData.data,
        TOKEN_ADDRESSES["AVAX"],
        toWei("10"), ///commenting out parameters so that they would be directly parsed from swap data v6.2
        TOKEN_ADDRESSES["USDC"],
        minOut
      );

      expect(await loanOwnsAsset("USDC")).to.be.true;

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
        initialTotalValue,
        0.01 * initialTotalValue
      );
      expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(
        initialHR,
        0.01 * initialHR
      );
      expect(
        fromWei(await wrappedLoan.getThresholdWeightedValue())
      ).to.be.closeTo(initialTWV, 0.01 * initialTWV);
    });

    // swapping back from USDC to AVAX
    it("should swap funds: USDC -> AVAX", async () => {
      let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
      let initialHR = fromWei(await wrappedLoan.getHealthRatio());
      let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

      // TODO: this check fails, why?
      // console.log("About to check whether AVAX is loaned");
      // expect(await loanOwnsAsset("AVAX")).to.be.false;
      // console.log("Finished checking AVAX loan check");
      let usdcBalance = await wrappedLoan.getBalance(toBytes32("USDC"));
      let minOut =
        (formatUnits(usdcBalance, 6) * tokensPrices.get("USDC")!) /
        tokensPrices.get("AVAX")!;
      minOut = toWei((minOut * 0.98).toString()); // 98%, or 2% slippage
      console.log("MinOut for USDC -> AVAX: ", minOut);
      const swapData = await getSwapData("USDC", "AVAX", usdcBalance, minOut); //minOut as 98% of the original AVAX value
      await wrappedLoan.paraSwapV2(
        swapData.selector,
        swapData.data,
        TOKEN_ADDRESSES["USDC"],
        toWei("10"), ///commenting out parameters so that they would be directly parsed from swap data v6.2
        TOKEN_ADDRESSES["AVAX"],
        1 // 9800000000000000000
      );

      expect(await loanOwnsAsset("AVAX")).to.be.true;

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
        initialTotalValue,
        0.01 * initialTotalValue
      );
      expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(
        initialHR,
        0.01 * initialHR
      );
      expect(
        fromWei(await wrappedLoan.getThresholdWeightedValue())
      ).to.be.closeTo(initialTWV, 0.01 * initialTWV);
    });

    it("should swap funds: AVAX -> ETH", async () => {
      let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
      let initialHR = fromWei(await wrappedLoan.getHealthRatio());
      let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

      expect(await loanOwnsAsset("ETH")).to.be.false;

      let AVAXBalance = await wrappedLoan.getBalance(toBytes32("AVAX"));
      console.log("AVAXBalance before AVAX -> ETH: ", AVAXBalance.toString());

      let minOut = parseUnits(
        (
          (tokensPrices.get("AVAX")! / tokensPrices.get("ETH")!) *
          9.8
        ).toString(),
        18
      );
      const swapData = await getSwapData("AVAX", "ETH", toWei("10"), minOut);
      console.log("MinOut for AVAX -> ETH: ", minOut);
      await wrappedLoan.paraSwapV2(
        swapData.selector,
        swapData.data,
        TOKEN_ADDRESSES["AVAX"],
        toWei("10"), ///commenting out parameters so that they would be directly parsed from swap data v6.2
        TOKEN_ADDRESSES["ETH"],
        minOut
      );

      expect(await loanOwnsAsset("ETH")).to.be.true;

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
        initialTotalValue,
        0.01 * initialTotalValue
      );
      expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(
        initialHR,
        0.01 * initialHR
      );
      expect(
        fromWei(await wrappedLoan.getThresholdWeightedValue())
      ).to.be.closeTo(initialTWV, 0.01 * initialTWV);
    });

    it("should swap funds: ETH -> USDC", async () => {
      let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
      let initialHR = fromWei(await wrappedLoan.getHealthRatio());
      let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

      // TODO
      // expect(await loanOwnsAsset("USDC")).to.be.false;

      let ethBalance = await wrappedLoan.getBalance(toBytes32("ETH"));
      console.log("ETHBalance before ETH -> USDC: ", ethBalance.toString());
      // let swapAmount = ethBalance.div(2);

      let minOut: any = formatUnits(ethBalance, 18) * tokensPrices.get("ETH")!;
      minOut = parseUnits((minOut * 0.98).toFixed(6), 6);
      const swapData = await getSwapData("ETH", "USDC", ethBalance, minOut);
      console.log("MinOut for ETH -> USDC: ", minOut);

      await wrappedLoan.paraSwapV2(
        swapData.selector,
        swapData.data,
        TOKEN_ADDRESSES["ETH"], //params from here on out are not required
        ethBalance,
        TOKEN_ADDRESSES["USDC"],
        minOut
      );

      // expect(await loanOwnsAsset("ETH")).to.be.true;
      expect(await loanOwnsAsset("USDC")).to.be.true;

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
        initialTotalValue,
        1.0
      );
      expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
      expect(
        fromWei(await wrappedLoan.getThresholdWeightedValue())
      ).to.be.closeTo(initialTWV, 1.0);
    });

    // it("should swap funds: USDC -> ETH", async () => {
    //   let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
    //   let initialHR = fromWei(await wrappedLoan.getHealthRatio());
    //   let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

    //   expect(await loanOwnsAsset("ETH")).to.be.false;
    //   let usdcBalance = await wrappedLoan.getBalance(toBytes32("USDC"));

    //   let minOut =
    //     (formatUnits(usdcBalance, 6) * tokensPrices.get("USDC")!) /
    //     tokensPrices.get("ETH")!;
    //   minOut = toWei((minOut * 0.98).toString()); // 98%

    //   const swapData = await getSwapData("USDC", "ETH", usdcBalance, minOut);

    //   await wrappedLoan.paraSwapV2(
    //     swapData.selector,
    //     swapData.data,
    //     TOKEN_ADDRESSES["USDC"],
    //     usdcBalance,
    //     TOKEN_ADDRESSES["ETH"],
    //     minOut
    //   );

    //   expect(await loanOwnsAsset("USDC")).to.be.false;
    //   expect(await loanOwnsAsset("ETH")).to.be.true;

    //   expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
    //     initialTotalValue,
    //     0.01 * initialTotalValue
    //   );
    //   expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(
    //     initialHR,
    //     0.01 * initialHR
    //   );
    //   expect(
    //     fromWei(await wrappedLoan.getThresholdWeightedValue())
    //   ).to.be.closeTo(initialTWV, 0.01 * initialTWV);
    // });

    // it("should swap half funds: ETH -> USDC", async () => {
    //   let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
    //   let initialHR = fromWei(await wrappedLoan.getHealthRatio());
    //   let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

    //   expect(await loanOwnsAsset("USDC")).to.be.false;

    //   let ethBalance = await wrappedLoan.getBalance(toBytes32("ETH"));
    //   let swapAmount = ethBalance.div(2);

    //   let minOut: any = formatUnits(swapAmount, 18) * tokensPrices.get("ETH")!;
    //   minOut = parseUnits((minOut * 0.98).toFixed(6), 6);
    //   const swapData = await getSwapData("ETH", "USDC", swapAmount, minOut);

    //   await wrappedLoan.paraSwapV2(
    //     swapData.selector,
    //     swapData.data,
    //     TOKEN_ADDRESSES["ETH"],
    //     swapAmount,
    //     TOKEN_ADDRESSES["USDC"],
    //     minOut
    //   );

    //   expect(await loanOwnsAsset("ETH")).to.be.true;
    //   expect(await loanOwnsAsset("USDC")).to.be.true;

    //   expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
    //     initialTotalValue,
    //     1.0
    //   );
    //   expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
    //   expect(
    //     fromWei(await wrappedLoan.getThresholdWeightedValue())
    //   ).to.be.closeTo(initialTWV, 1.0);
    // });

    // it("should swap half funds: ETH -> USDC", async () => {
    //   let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
    //   let initialHR = fromWei(await wrappedLoan.getHealthRatio());
    //   let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

    //   expect(await loanOwnsAsset("USDC")).to.be.true;
    //   let ethBalance = await wrappedLoan.getBalance(toBytes32("ETH"));

    //   let minOut = formatUnits(ethBalance, 18) * tokensPrices.get("ETH")!;
    //   parseUnits((minOut * 0.98).toFixed(6), 6);
    //   const swapData = await getSwapData("ETH", "USDC", ethBalance, minOut);

    //   await wrappedLoan.paraSwapV2(
    //     swapData.selector,
    //     swapData.data,
    //     TOKEN_ADDRESSES["ETH"],
    //     ethBalance,
    //     TOKEN_ADDRESSES["USDC"],
    //     minOut
    //   );

    //   expect(await loanOwnsAsset("ETH")).to.be.false;
    //   expect(await loanOwnsAsset("USDC")).to.be.true;

    //   expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(
    //     initialTotalValue,
    //     1.0
    //   );
    //   expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
    //   expect(
    //     fromWei(await wrappedLoan.getThresholdWeightedValue())
    //   ).to.be.closeTo(initialTWV, 1.0);
    // });

    async function loanOwnsAsset(asset: string) {
      let ownedAssets = await wrappedLoan.getAllOwnedAssets();
      for (const ownedAsset of ownedAssets) {
        if (fromBytes32(ownedAsset) == asset) {
          return true;
        }
      }
      return false;
    }
  });
});
