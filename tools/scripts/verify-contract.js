import hre from "hardhat";

export default async function verifyContract(hre, args) {
    if (hre.network.name !== 'localhost') {
        try {
            await hre.run("verify:verify", args);
        } catch (error) {
            const message = error.message;
            if(message.includes("Reason: Already Verified") || message.includes("Contract source code already verified")) {
                console.log("Contract code already verified. Continuing...");
            } else {
                throw(error);
            }
        }
    }
}