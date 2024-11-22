// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {VRFV2WrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/VRFV2WrapperConsumerBase.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BtcEligibleUsersList.sol";


contract RandomTokenRewarder is VRFV2WrapperConsumerBase, ConfirmedOwner {
    event RequestSent(uint256 requestId, uint32 numWords);

    // event for transferring reward to winner
    event RewardTransferred(address indexed winner, address indexed rewardToken, uint256 amount, uint256 blockNumber);

    // Depends on the number of requested values that you want sent to the
    // fulfillRandomWords() function. Test and adjust
    // this limit based on the network that you select, the size of the request,
    // and the processing of the callback request in the fulfillRandomWords()
    // function.
    uint32 callbackGasLimit = 1000000;

    // The default is 3, but you can set this higher.
    uint16 requestConfirmations = 3;

    // For this example, retrieve 2 random values in one request.
    // Cannot exceed VRFV2Wrapper.getConfig().maxNumWords.
    uint32 numWords = 1;
    address public rewardToken = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    BtcEligibleUsersList public btcEligibleUsersList;

    function setRewardToken(address _rewardToken) external onlyOwner {
        rewardToken = _rewardToken;
    }

    // ERC20 withdraw owner only
    function withdrawERC20(address _token, address _to, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(_to, _amount);
    }

    // Address LINK
    address public linkAddress = 0x5947BB275c521040051D82396192181b413227A3;
    // Address WRAPPER
    address public wrapperAddress = 0x721DFbc5Cfe53d32ab00A9bdFa605d3b8E1f3f42;

    constructor(address _btcEligibleUsersList)
    ConfirmedOwner(msg.sender)
    VRFV2WrapperConsumerBase(linkAddress, wrapperAddress)
    {
        btcEligibleUsersList = BtcEligibleUsersList(_btcEligibleUsersList);
    }

    function requestRewardDistributionWithRandomWords()
    external
    onlyOwner
    returns (uint256 requestId)
    {
        requestId = requestRandomness(
            callbackGasLimit,
            requestConfirmations,
            numWords
        );
        emit RequestSent(requestId, numWords);
        return requestId;
    }


    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        uint256 randomWord = _randomWords[0];

        uint256 primeAccountCount = btcEligibleUsersList.getEligibleUsersCount();
        address primeAccountAddress = btcEligibleUsersList.eligibleUsersList(randomWord % primeAccountCount);

        uint256 rewardBalance = IERC20(rewardToken).balanceOf(address(this));
        IERC20(rewardToken).transfer(primeAccountAddress, rewardBalance);
        emit RewardTransferred(primeAccountAddress, rewardToken, rewardBalance, block.number);
    }
}

