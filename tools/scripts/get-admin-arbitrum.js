const tokenManagerAddress = "0x0a0D954d4b0F0b47a5990C0abd179A90fF74E255";
const smartLoansFactoryAddress = "0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20";
const diamondAddress = '0x62Cf82FB0484aF382714cD09296260edc1DC0c6c';
const jsonRPC = "https://arb1.arbitrum.io/rpc";

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
    "ArbPoolTUP": "0x2B8C610F3fC6F883817637d15514293565C3d08A",
    "DepositIndex BTC": "0x7789BFf818C051c48e7EBA3550D72AC9bE2fCAF7",
    "DepositIndex DAI": "0x8894df0686b38d85d431F52660107b6F57609bC8",
    "DepositIndex USDC": "0x56F67141ba2197854D447128A8Aad9B517b8fD43",
    "DepositIndex WETH": "0x5C671Dae4C78f8beBa83aE67cee0f00B783E497C",
    "DepositIndex ARB": "0xdEab10Eb04525Ad8eb466d7A3634a4fB27040147",
    "BorrowIndex BTC": "0xD04E075E56194CFf489ec4941eF1FCb2BAB785AE",
    "BorrowIndex DAI": "0xF5aD6c5aa8d5a05F22B730743949Bf1Ff5ec8c48",
    "BorrowIndex USDC": "0xB13c4760CF2E9CD219Ec86EbE3660e520fDB8799",
    "BorrowIndex WETH": "0x9d0Ac60fDF8BF94EaFF4489ACCFff4c8F5CD51C1",
    "BorrowIndex ARB": "0xA508C3ceDb25aF7fBC3B9C339Fad6380470AFb74",
    "Prime_L2": "0x3De81CE90f5A27C5E6A5aDb04b54ABA488a6d14E",
    "sPrimeUniswapUP": "0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945",
    "vPrimeUP": "0x88fBaEa44b85fcC505c1aB1fD884c877A3b3dD42",
    "vPrimeControllerUP": "0xA0Ff5eA5fB3A7739791b81c83A8742044893CFaC",
    "SushiSwapIntermediary": "0xfd5665022359586Af38836b88E52E4690a3a7B79",
    "BTC Rates calculator": "0x7Cb9b83c91482C88aC2A3Cc1CB599872F10830E6",
    "BTC Rates calculator NEW": "0x290EBE564Fb778003f6D06cE6139848d3D2Aa14A",
    "DAI Rates calculator": "0x7Eef8C4190E4ef1dCF5071c70afC612AD2a49956",
    "DAI Rates calculator NEW": "0xd480d93BE366cd8fd4FC5EF0Df676F83944b5eBC",
    "USDC Rates calculator": "0x6715e7768b6a9C523046407E0354a21bB17acb39",
    "USDC Rates calculator NEW": "0xA24E8B383B1D8da473426768D5A85DB1Ae391DCe",
    "WETH Rates calculator": "0x0D184ADF34065598311233A1d37765f76fbC5a72",
    "WETH Rates calculator NEW": "0x02A4B9e27911513CFe62E5763f6A37f577c5AE5f",
    "ARB Rates calculator": "0x5d776f18289C1CaDbb11D77723c3D0605912b34f",
    "ARB Rates calculator NEW": "0xD4a3606A8b3e7b5F9e95C51500452a4c532Cfc45",
    "AddressProviderTUP [NOT USED]": "0x6Aa0Fe94731aDD419897f5783712eBc13E8F3982",
    "UsdtBorrowIndexTUP [NOT USED]": "0x42D8B0131EB247098a33bbA9f6446EE13Dd89202",
    "UniBorrowIndexTUP [NOT USED]": "0x6aA046437E0d055Fc0206Ef305A63D9B91c7ceDE",
    "ArbPoolTUP [NOT USED]": "0x91dA06b2B4C72563083091448282dE1014a33eF9",
    "ArbPoolTUP [NOT USED]": "0xA273EFD3BD9182C5b909Fcd65242860d8D948E2b",
    "UsdtDepositIndexTUP [NOT USED]": "0x36dF235a552Ae3FB47a0d9a74Ea3368a42cF7A23",
    "LinkDepositIndexTUP [NOT USED]": "0x10859B97E0C0B736C783a9A0F7a08E1E7a4B5CD1",
    "SmartLoansFactoryTUP [NOT USED]": "0x04F88DcB30C7E51B908758472F242abf8feC5C0f",
    "ArbBorrowIndexTUP [NOT USED]": "0x2692e83f2cF5647d111fc642fffEc6970BAbc4d9",
    "UniDepositIndexTUP [NOT USED]": "0xD86104a937D2C3E4175c80017339D94cA0B01e92",
    " [NOT USED]": "0x98C5Ce0c31E005809003a597b1d9AAeF401F0B41",
    // "DepositSwapArbitrumTUP": "0x889Cfe41a376CFeF8F28E48A848728D5377552b9",
};

const knownAddresses = {
    "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD": "MULTISIG OWNER",
    "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0": "MUTLISIG ADMIN",
    "0x1fa4DeD27b8d395BF16f76a1c633B7D33CfF15E7": "TIMELOCK ADMIN",
    "0x19a2e808BB716E20B7ceA28bc11930EF89B841ba": "TIMELOCK OWNER",
    "0x43D9A211BDdC5a925fA2b19910D44C51D5c9aa93": "Timelock24h",
    "0x8f430e5d18CCa67288c74c72bb3326F62cc1f7B7": "LEDGER Kamil1",
    "0x073b893284303708C515f4d246eE2f81e58d0ac4": "LEDGER Kamil3",
    "0x2D99ee2Fed53b0eC85fE32ABB8135Df44fF42A03": "LinkPoolTUP",
    "0xF9a12a4759500Df05983fD3EBd7F8A8F262A2967": "UniPoolTUP",
    "0x5CdE36c23f0909960BA4D6E8713257C6191f8C35": "BtcPoolTUP",
    "0x431290dF15777d46174b83C9E01F87d7b70D3073": "FraxPoolTUP",
    "0xd5E8f691756c3d7b86FD8A89A06497D38D362540": "DaiPoolTUP",
    "0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0": "UsdcPoolTUP",
    "0x0BeBEB5679115f143772CfD97359BBcc393d46b3": "WethPoolTUP",
    "0x5fAe0ebE49a920FA8350c0396683244824eECE74": "UsdtPoolTUP",
    "0x2B8C610F3fC6F883817637d15514293565C3d08A": "ArbPoolTUP",
    "0x40E4Ff9e018462Ce71Fa34aBdFA27B8C5e2B1AfB": "ADMIN COMPROMISED",
    "0xbAc44698844f13cF0AF423b19040659b688ef036": "OWNER COMPROMISED",
    "0xA273EFD3BD9182C5b909Fcd65242860d8D948E2b": "Arb Pool TUP",
    "0x2E2fE9Bc7904649b65B6373bAF40F9e2E0b883c5": "WETH pool TUP NEW",
    "0x14c82CFc2c651700a66aBDd7dC375c9CeEFDDD72": "ARB pool TUP NEW",
    "0x275Caecf5542bF4a3CF64aa78a3f57dc9939675C": "BTC pool TUP NEW",
    "0x7Dcf909B1E4b280bEe72C6A69b3a7Ed8adfb63f0": "DAI pool TUP NEW",
    "0x5f3DB5899a7937c9ABF0A5Fc91718E6F813e4195": "USDC pool TUP NEW",
    "0x788A8324943beb1a7A47B76959E6C1e6B87eD360": "WETH pool TUP V3",
    "0xc69d703a7Fc31ABb901F1cd3f8963a9f76C41671": "ARB pool TUP V3",
    "0xEA712a175D5E96Ca4CF15101c1C1133dbEB6E5F6": "BTC pool TUP V3",
    "0xFA354E4289db87bEB81034A3ABD6D465328378f1": "DAI pool TUP V3",
    "0x8Ac9Dc27a6174a1CC30873B367A60AcdFAb965cc": "USDC pool TUP V3",

};

const compromisedAddresses = {
    "0x40E4Ff9e018462Ce71Fa34aBdFA27B8C5e2B1AfB": "ADMIN COMPROMISED",
    "0xbAc44698844f13cF0AF423b19040659b688ef036": "OWNER COMPROMISED",
}

const extraOldPoolTUPs = {
    "PoolTUP1": "0x431290dF15777d46174b83C9E01F87d7b70D3073",
    // "PoolTUP2": "0x44F6aEAAC8C784fEe06cdc6eF9CeCE63423c50d4",
    // "PoolTUP3": "0x6F8e87538aAcC12E4a50f13b45F19c248561450E",
    // "PoolTUP4": "0x88f6F474185782095D19f3a8b08ed3cf1fa5a67d",
    // "PoolTUP5": "0xe7E35BEd5256E9d5C697b5486c3F5E07ba04F563",
    "PoolTUP6": "0xA273EFD3BD9182C5b909Fcd65242860d8D948E2b",
}

const newlyDeployedPools = {
    "WETH rates calculator": "0xCF547393005c7379FfF91d2de883EEfb0D5979d7",
    "WETH pool TUP": "0x2E2fE9Bc7904649b65B6373bAF40F9e2E0b883c5",
    "WETH deposit index TUP": "0x2b67D14eFBCe4E3c38713f9e87B503d8F0158324",
    "WETH borrow index TUP": "0x7eb84Ea770ff7532bd18FBb30B690DAf0B7A9C93",

    "ARB rates calculator": "0xF35884ab6f38414827c1D543B57BeFb690af4F9c",
    "ARB pool TUP": "0x14c82CFc2c651700a66aBDd7dC375c9CeEFDDD72",
    "ARB deposit index TUP": "0xeA3293d70675d8f8bf3FA9e05D0A7111F6092e08",
    "ARB borrow index TUP": "0xC3D4Ca62FfE4dCa0A86c8571Fc6e1Da1c041846B",

    "BTC rates calculator": "0xfD9babc65434C32d4da596958fC46D89F8bB9a1e",
    "BTC pool TUP": "0x275Caecf5542bF4a3CF64aa78a3f57dc9939675C",
    "BTC deposit index TUP": "0x5a65C978Ea93726EccB647a5aa3F5783A5EAf0b4",
    "BTC borrow index TUP": "0x0796A95E7F36301Caa30bE1a99Edb4C731AEB0E1",

    "DAI rates calculator": "0x255700194F34162405EEd34549B678d0E4D557f9",
    "DAI pool TUP": "0x7Dcf909B1E4b280bEe72C6A69b3a7Ed8adfb63f0",
    "DAI deposit index TUP": "0xE933cF769b277E64cc10bba02CAa34F233109353",
    "DAI borrow index TUP": "0x38C83DE2e8309A372a6629f941C70a14732AC967",

    "USDC rates calculator": "0x97886abb2BDBEA0e49a86eA1BCD2c4A7120B35D5",
    "USDC pool TUP": "0x5f3DB5899a7937c9ABF0A5Fc91718E6F813e4195",
    "USDC deposit index TUP": "0x87812e877c6909fe2784015F7c5C1059bA9A769C",
    "USDC borrow index TUP": "0xB86e7d51621d6dDb33ec37e972DE2A3F8f4F669F",
}


const newlyDeployedPoolsV3 = {
    "WETH rates calculator": "0x3Acd0A2717F295AA83D7FFD2fD44BE2FAB16c474",
    "WETH pool TUP": "0x788A8324943beb1a7A47B76959E6C1e6B87eD360",
    "WETH deposit index TUP": "0x6d641b350D7227b386453a29B69b9f17587BC335",
    "WETH borrow index TUP": "0x2c0eD57e398E8d4e2D86ee4aAc6E8d9E11570F04",

    "ARB rates calculator": "0x11DAa8Ce3D705E7Cb068601eC374567559066c26",
    "ARB pool TUP": "0xc69d703a7Fc31ABb901F1cd3f8963a9f76C41671",
    "ARB deposit index TUP": "0x3c9699f886493B006282B53c05B8154e3cb53249",
    "ARB borrow index TUP": "0x0f9C986e9fe3d7C9DE6e018CCb4E83Dc555558BE",

    "BTC rates calculator": "0xAD45F10F2F9ea66132097F2A86aeF6d7d71DAAF0",
    "BTC pool TUP": "0xEA712a175D5E96Ca4CF15101c1C1133dbEB6E5F6",
    "BTC deposit index TUP": "0x4Ae6513a0DD63A8Ca6939384759Bf7f5C4bE6557",
    "BTC borrow index TUP": "0x5E67f58BE8B989De26a2009a23c8da594Ed00F1f",

    "DAI rates calculator": "0x76531022B1Cf97d6Ff123762eb74F68FA9958Ef6",
    "DAI pool TUP": "0xFA354E4289db87bEB81034A3ABD6D465328378f1",
    "DAI deposit index TUP": "0xa6Af43652a62C23f6f27183746F69a46baE6F066",
    "DAI borrow index TUP": "0x636557Cf41D39092739f53A8fad50C333C3884C6",

    "USDC rates calculator": "0xb218DbE9d51b69DfB213a0d67579E3442B3Bae74",
    "USDC pool TUP": "0x8Ac9Dc27a6174a1CC30873B367A60AcdFAb965cc",
    "USDC deposit index TUP": "0x476156FD77091Fd2bbe058Db34BCd203Cd1531C8",
    "USDC borrow index TUP": "0x867F2a45733841484FDfC98642EFcf385f472994",
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

    // let { admin: diamondAdmin, owner: diamondOwner } = await getInfo(diamondAddress);
    // data.push({ Contract: "Diamond", Admin: `${diamondAdmin} (${getReadableName(diamondAdmin)})`, Owner: `${diamondOwner} (${getReadableName(diamondOwner)})` });

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

    let currentContractChangesData = require('./owners-admin-changes-arbitrum.json');
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
