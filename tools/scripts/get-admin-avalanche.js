const tokenManagerAddress = "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e";
const smartLoansFactoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const diamondAddress = '0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D';
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ethers = require("ethers");

const OwnableAbi = [
    'function owner() external view returns (address)',
    'function admin() external returns (address)',
]

const poolMapping = {
    "WavaxPoolTUP": "0xD26E504fc642B96751fD55D3E68AF295806542f5",
    "UsdcPoolTUP": "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",
    "btcPoolTUP": "0x475589b0Ed87591A893Df42EC6076d2499bB63d0",
    "ethPoolTUP": "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148",
    "usdtPoolTUP": "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1"
};

const knownAddresses = {
    "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c": "MULTISIG OWNER",
    "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a": "MUTLISIG ADMIN",
    "0x5C31bF6E2E9565B854E7222742A9a8e3f78ff358": "Timelock24h",
    "0x2fEA1f3F0c21F757B89918a884cdEEF1B74AB9a5": "Timelock10MIN",
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
