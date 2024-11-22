// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/gmx-v2/Deposit.sol";
import "../interfaces/gmx-v2/Withdrawal.sol";
import "../interfaces/gmx-v2/Order.sol";
import "../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/gmx-v2/IDepositCallbackReceiver.sol";
import "../interfaces/gmx-v2/EventUtils.sol";
import "../interfaces/gmx-v2/IDepositUtils.sol";
import "../interfaces/gmx-v2/IWithdrawalUtils.sol";
import "../interfaces/gmx-v2/IGmxV2Router.sol";
import "../interfaces/gmx-v2/IWithdrawalCallbackReceiver.sol";
import "../interfaces/gmx-v2/IGasFeeCallbackReceiver.sol";

contract TestGmxV2 is IDepositCallbackReceiver, IWithdrawalCallbackReceiver, IGasFeeCallbackReceiver {

    address GMX_V2_ROUTER = 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    address GMX_V2_EXCHANGE_ROUTER = 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8;
    address GMX_V2_DEPOSIT_VAULT = 0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55;
    address GMX_V2_WITHDRAWAL_VAULT = 0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55;
    address GM_ETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address ETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    function getSelector(string memory _func) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes(_func)));
    }

    function depositEthUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) public payable returns (bytes[] memory) {
        address depositedToken = isLongToken ? ETH : USDC;

        IERC20(depositedToken).approve(GMX_V2_ROUTER, tokenAmount);

        bytes[] memory data = new bytes[](3);

        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            GMX_V2_DEPOSIT_VAULT,
            executionFee
        );
        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            depositedToken,
            GMX_V2_DEPOSIT_VAULT,
            tokenAmount
        );
        data[2] = abi.encodeWithSelector(
            IDepositUtils.createDeposit.selector,
            IDepositUtils.CreateDepositParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: GM_ETH_USDC, //market
                initialLongToken: ETH, //initialLongToken
                initialShortToken: USDC, //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 100000 //callbackGasLimit
            })
        );

        bytes[] memory results = BasicMulticall(GMX_V2_EXCHANGE_ROUTER).multicall{ value: msg.value }(data);

        //TODO: pause the Prime Account
        return results;
    }

    //TODO: withdrawal guard
    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) public payable returns (bytes[] memory) {
        bytes[] memory data = new bytes[](3);

        IERC20(GM_ETH_USDC).approve(GMX_V2_ROUTER, gmAmount);

        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            GMX_V2_WITHDRAWAL_VAULT,
            executionFee
        );

        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            GM_ETH_USDC,
            GMX_V2_WITHDRAWAL_VAULT,
            gmAmount
        );

        data[2] = abi.encodeWithSelector(
            IWithdrawalUtils.createWithdrawal.selector,
            IWithdrawalUtils.CreateWithdrawalParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: GM_ETH_USDC, //market
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minLongTokenAmount: minLongTokenAmount,
                minShortTokenAmount: minShortTokenAmount,
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 100000 //callbackGasLimit
            })
        );

        bytes[] memory results = BasicMulticall(GMX_V2_EXCHANGE_ROUTER).multicall{ value: msg.value }(data);

        //TODO: pause the Prime Account
        return results;
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external override {
        //TODO: recalculate asset exposure
        //TODO: add assets
        emit DepositExecuted();
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external override {
        //TODO: add assets (deposited in previous tx)
        emit DepositCancelled();
    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external override {
        //TODO: recalculate asset exposure
        //TODO: add assets
        emit WithdrawalExecuted();
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external override {
        //TODO: add assets (deposited in previous tx)
        emit WithdrawalCancelled();
    }

    function refundExecutionFee(bytes32 key, EventUtils.EventLogData memory eventData) external payable {
        emit GasFeeRefunded();
    }

    //TODO: remove, these are mock events
    event DepositExecuted();

    event DepositCancelled();

    event WithdrawalExecuted();

    event WithdrawalCancelled();

    event GasFeeRefunded();
}



