const fs = require("fs");
const ethers = require("ethers");

const {getUrlForNetwork} = require("./helpers");
const PrimeBridgeArtifact = require("../../artifacts/contracts/token/PrimeBridge.sol/PrimeBridge.json");

const toWei = ethers.utils.parseUnits;
const IERC20ApproveAbi = [
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "type": "function"
    }
];

function initWallet(networkName) {
    const key = fs.readFileSync(`./.secrets/${networkName}/deployer`).toString().trim();
    console.log(getUrlForNetwork(networkName));
    const provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    return new ethers.Wallet(key, provider);
}

async function bridgeTokens(networkName) {
    const wallet = initWallet(networkName);

    const recipientAddress = '0xbAc44698844f13cF0AF423b19040659b688ef036'
    const primeTokenAddress = '0x3De81CE90f5A27C5E6A5aDb04b54ABA488a6d14E'
    const avalancheChainId = 106;
    const arbitrumChainId = 110;
    const bridgeContractAddress = '0x3De81CE90f5A27C5E6A5aDb04b54ABA488a6d14E'

    let defaultAdapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    const receiverBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [recipientAddress])
    const amountToSend =  toWei("0.01");
    const destinationChain = avalancheChainId;  // In case of Avalanche it should be 110
    const bridgeContract = new ethers.Contract(bridgeContractAddress, PrimeBridgeArtifact.abi, wallet);
    const primeTokenContract = new ethers.Contract(primeTokenAddress, IERC20ApproveAbi, wallet);
    await primeTokenContract.approve(bridgeContract.address, amountToSend);
    console.log('Approved')
    await new Promise(resolve => setTimeout(resolve, 10000));

    let nativeFee = (await bridgeContract.estimateSendFee(destinationChain, receiverBytes32, amountToSend, false, defaultAdapterParams)).nativeFee;

    console.log(`Briding ${amountToSend} from Arbitrum to Avalanche to ${recipientAddress} with fee ${nativeFee}`);
    await bridgeContract
        .sendFrom(
            wallet.address,
            destinationChain,
            receiverBytes32,
            amountToSend,
            [wallet.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee}
        );
}

bridgeTokens("arbitrum");