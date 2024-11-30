const tokenManagerAddress = "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e";
const smartLoansFactoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const diamondAddress = '0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D';
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ethers = require("ethers");
const currentContractChangesData = require("./owners-admin-changes-arbitrum.json");

const OwnableAbi = [
    'function owner() external view returns (address)',
    'function admin() external returns (address)',
]

const poolMapping = {
    // "WavaxPoolTUP": "0xD26E504fc642B96751fD55D3E68AF295806542f5",
    // "UsdcPoolTUP": "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",
    // "btcPoolTUP": "0x475589b0Ed87591A893Df42EC6076d2499bB63d0",
    // "ethPoolTUP": "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148",
    // "usdtPoolTUP": "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1",
    // "DepositIndex AVAX": "0xaB764b1E960E346a7f5c8CC92D5750D0F0782aD2",
    // "DepositIndex USDC": "0x58Da820738d3bC3583566ECFc5660B176AC446A6",
    // "DepositIndex BTC": "0x637FdB03d95b36Bb25B6b44964b4725482546A08",
    // "DepositIndex ETH": "0x796Dbe7Adc72158f08B0b79E20cAA4293d32132f",
    // "DepositIndex USDT": "0x5F6847cAc849d67AcfE2da9CCaff3DF11F9e1E9F",
    // "BorrowIndex WAVAX": "0x7201e8cB96fF5bDfa69377f2F29a21027FF7dBB1",
    // "BorrowIndex USDC": "0x93a0F1d983aE56ab19fE72961842e9e576830E80",
    // "BorrowIndex BTC": "0x8F0848B329Ad310ABadD7f85C3c0cFEcEB0a78FD",
    // "BorrowIndex ETH": "0x66b8Ad391b2d37E60B5B9ec7F96686E9Efedb2Cb",
    // "BorrowIndex USDT": "0x646aFd5FFF39962672bBbfAC80106F0f9d8ff9fe",
    // "PrimeBridge":	"0x35643752F4ea0ba70456F0CA1e2778f783206a20",
    // "PositionManager":	"0x13652F4a37235293a90a1dE5B878c9435EAf4c58",
    // "sPrimeUP":	"0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E",
    // "vPrimeUP":	"0x228a19fC13932C67D538fEba858359E369e5a197",
    // "vPrimeControllerUP":	"0x9289D0B4A3723b6F69b03e79fE9BfC79982764b8",
    // "PrimeVesting 1":	"0x881fa171A7b5bf5c84d213043037ab867ce4688c",
    // "PrimeVesting 2":	"0xE2C255Ed407fda4BDe67Fd9cBEe72654F6A09e3b",
    // "PangolinIntermediaryTUP":	"0xdB5D94B8Ed491B058F3e74D029775A14477cF7fA",
    // "TraderJoeIntermediaryTUP":	"0x4eEcb72b47a32786e08581D6226e95d9AE3bB1Af",
    // "AVAX Rates calculator": "0x4162f744F2478fE0f9b87e02191B166766542bb0",
    // "USDC Rates calculator": "0x8FfA4cA6327944ed4Da2cE3ca77c416121612E32",
    // "BTC Rates calculator": "0x994F4216769C4d9CC6A3dd80A9141Ba45Df4DAdF",
    // "ETH Rates calculator": "0xb354BC1329c523744c3E9C31140aa52F2953C89f",
    // "USDT Rates calculator": "0xDC39CC885BD5d766CA7f5a9Ab2814b74F33ab493",
    // "Spreadsheet 1": "0x843A5203f14c9A2451519395550Df80f1AB1f538",
    // "Spreadsheet 2": "0xdFef865EF5901b590B45128E0cFDCf7f505BfEEc",
    // "Spreadsheet 3": "0x3f06Cf31d5f7A7584A1E33D4C2FB5e362a830360",
    // "Spreadsheet 4": "0xE5B625dC76c42d5Fa96D66C5f8115FA5357C150E",
    // "Spreadsheet 5": "0xd7EaE5cCC11603Fe19f7Eff400bf38aFB023caDC",
    // "Spreadsheet 6": "0x082761F322ba3e5B4C8e848D6cd31Fd489abd4BC",
    // "Spreadsheet 7": "0xB7918417ADd60e9f2a48D00cf4caB6dE90ee2ba1",
    // "Spreadsheet 8": "0x636F2e0C9F4a99fb91feBb45c6682cE5Db60E0C0",
    // "Spreadsheet 9": "0xf3cdfA877bB0615b50D066e41404668f016feE1E",
    // "Spreadsheet 10": "0xa493b6fF3ea1d0BeD5766DD9F52A5828B6dFC643",
    // "Spreadsheet 11": "0x65602433458f95A6c57477C03fd18F6d52A6E5f6",
    // "Spreadsheet 12": "0x44F6aEAAC8C784fEe06cdc6eF9CeCE63423c50d4",
    // "Spreadsheet 13": "0x771B8299ec07Ae868fCd6C2bD76718F0f1BB4901",
    // "Spreadsheet 14": "0x88f6F474185782095D19f3a8b08ed3cf1fa5a67d",
    // "Spreadsheet 15": "0x6F8e87538aAcC12E4a50f13b45F19c248561450E",
    // "Spreadsheet 16": "0x431290dF15777d46174b83C9E01F87d7b70D3073",
    // "Spreadsheet 17": "0x82EA19989CB775D7914c06fFe3A5d996a6FE4435",
    // "Spreadsheet 18": "0x3eb97259ACE735304b7147AEc60BB4FD9AE52A3d",
    // "Spreadsheet 19": "0x03EfC13D0e7dd03167e03B2a56f7994655971c61",
    // "Spreadsheet 20": "0x554Da9108d3263Cfd593DF69c0a129Aa6bA1eA7e",
    // "Spreadsheet 21": "0x93DF597EbB125cD0B72CeB81c90614F43c68D91e",
    // "Spreadsheet 22": "0x5ff1DE6091871adAAe64E2Ec4feD754628482868",
    // "Spreadsheet 23": "0x251e8aDEFC9005148618A8789c87A37087291deF",
    // "Spreadsheet 24": "0x9FDb3940D8A91E89b4399Fbb0D038DC296A43C42",
    // "Spreadsheet 25": "0x83cD0AAef0c35C5A19a4081625BBcf1Cc5E1C3ed",
    // "Spreadsheet 26": "0x5C94E265D4Ce4E5B0F354E381598d068f0998845",
    // "Spreadsheet 27": "0x0278438423f433e277F65D14c0E002b8828702ba",
    // "Spreadsheet 28": "0x121b59880b70908AC34062F55fe4A72e8fAF97Fa",
    // "Spreadsheet 29": "0x035611d3237EbBE6f8eB2B7bDc580A3F53992AE5",
    // "Spreadsheet 30": "0x8D4e531A6808C1e0a15bb5F723a2F8c2A7348108",
    // "Spreadsheet 31": "0x6715e7768b6a9C523046407E0354a21bB17acb39",
    // "Spreadsheet 32": "0x6E41532bB8D1637a8F3D828aff816d49816D2aA4",
    // "Spreadsheet 33": "0x476df001a8c6058c4c809930c5D441E6bBE313Cb",
    // "Spreadsheet 34": "0x34cb5Fc3b28215713682De95DAF2b00a4619Db03",
    // "Spreadsheet 35": "0xC3c8818f728207Be8dDf8739f434811dD6654818",
    // "Spreadsheet 36": "0x0B5a12707249173cEAE9331e3e45563d24fa9492",
    // "Spreadsheet 37": "0x7C4E79831F56B1548e2347E480377e74A6A8456C",
    // "Spreadsheet 38": "0x034db1042fE58E795cF3f89C391443B2af97673d",
    // "Spreadsheet 39": "0x9884146A8f0dFCf96d4e6cDd98A091dC139A9D12",
    // "Spreadsheet 40": "0xe7E35BEd5256E9d5C697b5486c3F5E07ba04F563",
    // "Spreadsheet 41": "0x5429c83C6dD1B0a796FEF25eAA513e6164F36B54",
    // "Spreadsheet 42": "0x7FEEBFA556281f2803abF8cae7727D4F18C13CFa",
    // "Spreadsheet 43": "0x8f93C91957c846B00BbCD3d92906936cE9d13D23",
    // "Spreadsheet 44": "0xF5952b41c1ED1B2AFf3E5BF3411a620951D1e5fE"


};

const extraOldPoolTUPs = {
    // "PoolTUP1": "0x431290dF15777d46174b83C9E01F87d7b70D3073",
    // "PoolTUP2": "0x44F6aEAAC8C784fEe06cdc6eF9CeCE63423c50d4",
    // "PoolTUP3": "0x6F8e87538aAcC12E4a50f13b45F19c248561450E",
    // "PoolTUP4": "0x88f6F474185782095D19f3a8b08ed3cf1fa5a67d",
    // "PoolTUP5": "0xe7E35BEd5256E9d5C697b5486c3F5E07ba04F563",
    // "PoolTUP6": "0xA273EFD3BD9182C5b909Fcd65242860d8D948E2b",
    "oldBeacon1": "0x9523615C15d3743Cb3198B4464048B064f1530B2",
    "oldBeacon2": "0x5f8f0c0552243aC0138401344249C4fB1c1A6a7D",
    "oldBeacon3": "0x26f86888677439748A0F0Faec08Fc43546Fbcd10",
    "oldBeacon4": "0x7dBcB7b5019cfD15225E5aDc454B864CA1b7f2d1",
    "oldBeacon5": "0x023dA3e0D49Ee05704773271b11484C6D1E76cCb",
}

const newlyDeployedPoolsV3 = {
    "WAVAX rates calculator": "0x555B0CdAfd5869a2ddCA6033C88F5EEfBE64E372",
    "WAVAX pool TUP": "0xaa39f39802F8C44e48d4cc42E088C09EDF4daad4",
    "WAVAX deposit index TUP": "0x97886abb2BDBEA0e49a86eA1BCD2c4A7120B35D5",
    "WAVAX borrow index TUP": "0x5f3DB5899a7937c9ABF0A5Fc91718E6F813e4195",

    "USDT rates calculator": "0x7438F10eF07ee81Cd04d70b28647010913E3d8e8",
    "USDT pool TUP": "0x1b6D7A6044fB68163D8E249Bce86F3eFbb12368e",
    "USDT deposit index TUP": "0xE5CFfF71f2B19dEfa05655Cb4Bb34B9510537d41",
    "USDT borrow index TUP": "0xf526285F60e9373f47B88a2776c32C99245277f9",

    "BTC rates calculator": "0xd987b201Dab303d823D040c89bfe7AFDB1D7998c",
    "BTC pool TUP": "0x70e80001bDbeC5b9e932cEe2FEcC8F123c98F738",
    "BTC deposit index TUP": "0xeD66e0581200f8900f76D2c97667e4d2D59dBA53",
    "BTC borrow index TUP": "0x9A3502f32cc6844A028bC005E2F73ea17e956528",

    "ETH rates calculator": "0x7B73b03Bb444115F55e851c75BAA59359EfC711d",
    "ETH pool TUP": "0x2A84c101F3d45610595050a622684d5412bdf510",
    "ETH deposit index TUP": "0x918e0D8cC0B13FaCB83C1174CD1D3940517bf544",
    "ETH borrow index TUP": "0x22e97b2Fc82dE90faB7A68eF98144c165cc56856",

    "USDC rates calculator": "0xacF6D84E0620589Da3a0f17ABc7bF896945d7b72",
    "USDC pool TUP": "0x8027e004d80274FB320e9b8f882C92196d779CE8",
    "USDC deposit index TUP": "0x93B9d03BF70c50F469a7BB5623e78036B74B2556",
    "USDC borrow index TUP": "0x08245F89BF4712FdF9Fe3B25B85AC332Da99BE79",
}

const knownAddresses = {
    "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c": "MULTISIG OWNER",
    "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a": "MUTLISIG ADMIN",
    "0x3cF61b8628Ec980f26bE5AcC6B1052bE9F49f1d4": "TIMELOCK OWNER",
    "0x57AA5E3af98BddF2B1fF3115f2F0F3c2052F7F12": "TIMELOCK ADMIN",
    "0x5C31bF6E2E9565B854E7222742A9a8e3f78ff358": "Timelock24h",
    "0x2fEA1f3F0c21F757B89918a884cdEEF1B74AB9a5": "Timelock10MIN",
    "0x8f430e5d18CCa67288c74c72bb3326F62cc1f7B7": "LEDGER Kamil1",
    "0x073b893284303708C515f4d246eE2f81e58d0ac4": "LEDGER Kamil3",
    "0xD26E504fc642B96751fD55D3E68AF295806542f5": "WavaxPoolTUP",
    "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b": "UsdcPoolTUP",
    "0x475589b0Ed87591A893Df42EC6076d2499bB63d0": "btcPoolTUP",
    "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148": "ethPoolTUP",
    "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1": "usdtPoolTUP",
    "0x44F6aEAAC8C784fEe06cdc6eF9CeCE63423c50d4": "WavaxPoolTUP",
    "0x431290dF15777d46174b83C9E01F87d7b70D3073": "PoolTUP",
    "0x3eb97259ACE735304b7147AEc60BB4FD9AE52A3d": "PoolTUP",
    "0x88f6F474185782095D19f3a8b08ed3cf1fa5a67d": "UsdcPoolTUP",
    "0x6F8e87538aAcC12E4a50f13b45F19c248561450E": "UsdcPoolTUP",
    "0xe7E35BEd5256E9d5C697b5486c3F5E07ba04F563": "WavaxPoolTUP",
    "0x40E4Ff9e018462Ce71Fa34aBdFA27B8C5e2B1AfB": "ADMIN COMPROMISED",
    "0xbAc44698844f13cF0AF423b19040659b688ef036": "OWNER COMPROMISED",
    "0xaa39f39802F8C44e48d4cc42E088C09EDF4daad4": "WAVAX pool TUP V3",
    "0x1b6D7A6044fB68163D8E249Bce86F3eFbb12368e": "USDT pool TUP V3",
    "0x70e80001bDbeC5b9e932cEe2FEcC8F123c98F738": "BTC pool TUP V3",
    "0x2A84c101F3d45610595050a622684d5412bdf510": "ETH pool TUP V3",
    "0x8027e004d80274FB320e9b8f882C92196d779CE8": "USDC pool TUP V3",
};

const compromisedAddresses = {
    "0x40E4Ff9e018462Ce71Fa34aBdFA27B8C5e2B1AfB": "ADMIN COMPROMISED",
    "0xbAc44698844f13cF0AF423b19040659b688ef036": "OWNER COMPROMISED",
}

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

    for (let pool in newlyDeployedPoolsV3) {
        let poolAddress = newlyDeployedPoolsV3[pool];
        let { admin: poolAdmin, owner: poolOwner } = await getInfo(poolAddress);
        data.push({ Contract: pool, Admin: `${poolAdmin} (${getReadableName(poolAdmin)})`, Owner: `${poolOwner} (${getReadableName(poolOwner)})` });
    }

    console.table(data);
}

async function checkCurrentContractAdmins() {
    let data = [];
    let contractsWithCompromisedAddressAsOwnerOrAdmin = [];

    let currentContractChangesData = require('./owners-admin-changes-avalanche.json');
    for(const row of currentContractChangesData) {
        let [chain, contractAddress, contractName, currentController, newController, roleName] = row;
        let { admin: poolAdmin, owner: poolOwner } = await getInfo(contractAddress);
        data.push({ Contract: contractAddress, Admin: `${poolAdmin} (${getReadableName(poolAdmin)})`, Owner: `${poolOwner} (${getReadableName(poolOwner)})` });

        if(compromisedAddresses[poolAdmin] || compromisedAddresses[poolOwner]) {
            contractsWithCompromisedAddressAsOwnerOrAdmin.push({ Contract: contractAddress, Admin: `${poolAdmin} (${getReadableName(poolAdmin)})`, Owner: `${poolOwner} (${getReadableName(poolOwner)})` });
        }
    }
    console.table(data);
    console.log("Contracts with compromised address as owner or admin:");
    console.table(contractsWithCompromisedAddressAsOwnerOrAdmin);
}

main();
// checkCurrentContractAdmins();