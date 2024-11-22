import {ethers, waffle} from "hardhat";

const {provider} = waffle;

export const toWei = ethers.utils.parseUnits;
export const toBytes32 = ethers.utils.formatBytes32String;
export const fromBytes32 = ethers.utils.parseBytes32String;

export async function syncTime(rpcUrl = "https://api.avax.network/ext/bc/C/rpc") {
    const now = Math.ceil(new Date().getTime() / 1000);
    try {
        await provider.send('evm_setNextBlockTimestamp', [now]);
    } catch (error) {
        await provider._hardhatNetwork.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: rpcUrl
                    },
                },
            ],
        });

        await syncTime(rpcUrl);
    }
}

