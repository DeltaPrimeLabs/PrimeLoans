const tokenManagerAddress = "0x0a0D954d4b0F0b47a5990C0abd179A90fF74E255";
const smartLoansFactoryAddress = "0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20";
const diamondAddress = '0x62Cf82FB0484aF382714cD09296260edc1DC0c6c';
const jsonRPC = "https://nd-762-566-527.p2pify.com/4514bd12de6723b94346752e90e95cf4";

const ethers = require("ethers");

const OwnableAbi = [
    'function owner() external view returns (address)',
    'function admin() external returns (address)',
]

const poolMapping = {
    "LinkPoolTUP": "0x2D99ee2Fed53b0eC85fE32ABB8135Df44fF42A03",
    "UniPoolTUP": "0xF9a12a4759500Df05983fD3EBd7F8A8F262A2967",
    "BtcPoolTUP": "0x5CdE36c23f0909960BA4D6E8713257C6191f8C35",
    "FraxPoolTUP": "0x431290dF15777d46174b83C9E01F87d7b70D3073",
    "DaiPoolTUP": "0xd5E8f691756c3d7b86FD8A89A06497D38D362540",
    "UsdcPoolTUP": "0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0",
    "WethPoolTUP": "0x0BeBEB5679115f143772CfD97359BBcc393d46b3",
    "UsdtPoolTUP": "0x5fAe0ebE49a920FA8350c0396683244824eECE74",
    "ArbPoolTUP": "0x2B8C610F3fC6F883817637d15514293565C3d08A"
};

const knownAddresses = {
    "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD": "MULTISIG OWNER",
    "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0": "MUTLISIG ADMIN",
    "0x43D9A211BDdC5a925fA2b19910D44C51D5c9aa93": "Timelock24h",
};

function getReadableName(address) {
    return knownAddresses[address] || "Unknown";
}

async function getInfo(contractAddress) {
    const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
    const contract = new ethers.Contract(contractAddress, OwnableAbi, provider);
    const owner = await contract.owner();

    const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    const adminValue = await provider.getStorageAt(contractAddress, ethers.BigNumber.from(adminSlot));
    const [admin] = ethers.utils.defaultAbiCoder.decode(["address"], adminValue);

    return { admin, owner };
}

async function main() {
    let data = [];

    let { admin: diamondAdmin, owner: diamondOwner } = await getInfo(diamondAddress);
    data.push({ Contract: "Diamond", Admin: `${diamondAdmin} (${getReadableName(diamondAdmin)})`, Owner: `${diamondOwner} (${getReadableName(diamondOwner)})` });

    let { admin: tokenManagerAdmin, owner: tokenManagerOwner } = await getInfo(tokenManagerAddress);
    data.push({ Contract: "TokenManager", Admin: `${tokenManagerAdmin} (${getReadableName(tokenManagerAdmin)})`, Owner: `${tokenManagerOwner} (${getReadableName(tokenManagerOwner)})` });

    let { admin: smartLoansFactoryAdmin, owner: smartLoansFactoryOwner } = await getInfo(smartLoansFactoryAddress);
    data.push({ Contract: "SmartLoansFactory", Admin: `${smartLoansFactoryAdmin} (${getReadableName(smartLoansFactoryAdmin)})`, Owner: `${smartLoansFactoryOwner} (${getReadableName(smartLoansFactoryOwner)})` });

    for (let pool in poolMapping) {
        let poolAddress = poolMapping[pool];
        let { admin: poolAdmin, owner: poolOwner } = await getInfo(poolAddress);
        data.push({ Contract: pool, Admin: `${poolAdmin} (${getReadableName(poolAdmin)})`, Owner: `${poolOwner} (${getReadableName(poolOwner)})` });
    }

    console.table(data);
}
main();
