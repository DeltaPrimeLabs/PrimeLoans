import hre, {ethers} from "hardhat";

const poolABI = [
    // You need to include the ABI of the 'slot0' function
    {
        "inputs": [],
        "name": "slot0",
        "outputs": [
            {
                "internalType": "uint160",
                "name": "sqrtPriceX96",
                "type": "uint160"
            },
            {
                "internalType": "int24",
                "name": "tick",
                "type": "int24"
            },
            {
                "internalType": "uint16",
                "name": "observationIndex",
                "type": "uint16"
            },
            {
                "internalType": "uint16",
                "name": "observationCardinality",
                "type": "uint16"
            },
            {
                "internalType": "uint16",
                "name": "observationCardinalityNext",
                "type": "uint16"
            },
            {
                "internalType": "uint8",
                "name": "feeProtocol",
                "type": "uint8"
            },
            {
                "internalType": "bool",
                "name": "unlocked",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];
const jsonRpcUrl = 'https://rpc.ankr.com/avalanche';
const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);

const TOKEN_ADDRESSES = {
    'WAVAX': '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    'WETH': '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
    'USDC': '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
}

// 100 ppm: Represents a fee of 0.01%.
// 500 ppm: Represents a fee of 0.05%.
// 3000 ppm: Represents a fee of 0.30%.
// 10000 ppm: Represents a fee of 1.00%.
/**
 * Calculate the Uniswap V3 pool address for a given pair of tokens and fee
 * @param tokenA
 * @param tokenB
 * @param fee - Pool fee in ppm - parts per million (e.g., 3000 for 0.3%)
 * @returns {string}
 */
function calculateUniv3PoolAddress(tokenA, tokenB, fee) {
// Constants
    const FACTORY_ADDRESS = '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD'; // Uniswap V3 factory address

// Get the INIT_CODE_HASH from the Uniswap V3 Factory contract
    const INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54'; // This is a constant for Uniswap V3 pools

// Sort tokens to ensure the correct order
    const [token0, token1] = [tokenA, tokenB].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

// Encode the input parameters
    const feeHex = ethers.utils.hexZeroPad(ethers.utils.hexlify(fee), 3);
    const encoded = ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint24'],
        [token0, token1, fee]
    );

// Hash the encoded parameters
    const encodedHash = ethers.utils.keccak256(encoded);

// Encode the CREATE2 inputs
    const create2Inputs = [
        '0xff',
        FACTORY_ADDRESS,
        encodedHash,
        INIT_CODE_HASH
    ].map(i => i instanceof Uint8Array ? ethers.utils.hexlify(i) : i);

// Compute the CREATE2 address
    const create2Encoded = ethers.utils.keccak256(ethers.utils.concat(create2Inputs));
    const poolAddress = `0x${create2Encoded.slice(-40)}`;
    return poolAddress;
}

async function getCurrentTick(poolAddress) {
    const poolContract = new ethers.Contract(poolAddress, poolABI, provider);
    console.log(`Fetching current tick for ${poolAddress}...`)
    try {
        const slot0 = await poolContract.slot0();
        const currentTick = slot0.tick;
        console.log('Current Tick:', currentTick);
    } catch (error) {
        console.error('Error fetching current tick:', error);
    }
}

function calculateTickPerPrice(price){

    // Calculate the square root of the price scaled by 2^96
    const sqrtPriceX96 = Math.sqrt(price) * Math.pow(2, 96);

    // Calculate the tick
    const tick = Math.log(price) / Math.log(1.0001);

    console.log('sqrtPriceX96:', sqrtPriceX96.toString());
    console.log('Tick:', Math.floor(tick)); // Use Math.floor to get the closest tick
}

async function run(){
    const wavaxUsdcPoolAddress = calculateUniv3PoolAddress(TOKEN_ADDRESSES["WAVAX"], TOKEN_ADDRESSES["USDC"], 500);
    const wavaxWethPoolAddress = calculateUniv3PoolAddress(TOKEN_ADDRESSES["WETH"], TOKEN_ADDRESSES["WAVAX"], 500);
    console.log('Calculated wavaxUsdcPoolAddress:', wavaxUsdcPoolAddress);
    console.log('Calculated wavaxWethPoolAddress:', wavaxWethPoolAddress);

    await getCurrentTick(wavaxUsdcPoolAddress);
    await getCurrentTick(wavaxWethPoolAddress);

    calculateTickPerPrice(36.48);
}

run();
