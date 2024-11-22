// const fs = require('fs');
// const { argv } = require('process');
//
// // Read the JSON file
// fs.readFile('primeVesting2.json', 'utf8', (err, data) => {
//     if (err) {
//         console.error('Error reading file:', err);
//         return;
//     }
//
//     try {
//         const participants = JSON.parse(data);
//
//         // Validate uniqueness of walletAddress
//         const uniqueWalletAddresses = new Set();
//         let duplicateFound = false;
//
//         participants.forEach(participant => {
//             if (uniqueWalletAddresses.has(participant.walletAddress.toLowerCase())) {
//                 console.error(`Duplicate walletAddress found: ${participant.walletAddress}`);
//                 duplicateFound = true;
//             } else {
//                 uniqueWalletAddresses.add(participant.walletAddress.toLowerCase());
//             }
//         });
//
//         if (duplicateFound) {
//             console.error('Duplicate walletAddress(es) found. Analysis aborted.');
//             return;
//         }
//
//         // Initialize variables for analysis
//         let totalParticipants = 0;
//         let participantsWithGrantClaimRightTo = 0;
//         let uniqueCliffDurations = new Set();
//         let cliffDurationsMap = new Map();
//         let uniqueVestingDurations = new Set();
//         let vestingDurationsMap = new Map();
//         let totalPrimeAmount = 0;
//         let grantClaimRightToAddresses = {};
//
//         // Process each participant
//         participants.forEach(participant => {
//             // Count total participants
//             totalParticipants++;
//
//             // Check grantClaimRightTo
//             if (participant.grantClaimRightTo !== null) {
//                 participantsWithGrantClaimRightTo++;
//                 if (!grantClaimRightToAddresses[participant.grantClaimRightTo]) {
//                     grantClaimRightToAddresses[participant.grantClaimRightTo] = [];
//                 }
//                 grantClaimRightToAddresses[participant.grantClaimRightTo].push(participant.walletAddress);
//             }
//
//             // Track cliff durations and sum primeAmounts
//             const cliffInSeconds = participant.cliffInSeconds;
//             uniqueCliffDurations.add(cliffInSeconds);
//             if (!cliffDurationsMap.has(cliffInSeconds)) {
//                 cliffDurationsMap.set(cliffInSeconds, { count: 0, sumPrimeAmount: 0, addresses: [] });
//             }
//             cliffDurationsMap.get(cliffInSeconds).count++;
//             cliffDurationsMap.get(cliffInSeconds).sumPrimeAmount += participant.primeAmount;
//             cliffDurationsMap.get(cliffInSeconds).addresses.push({
//                 walletAddress: participant.walletAddress,
//                 primeAmount: participant.primeAmount
//             });
//
//             // Track vesting durations and sum primeAmounts
//             const vestingInSeconds = participant.vestingInSeconds;
//             uniqueVestingDurations.add(vestingInSeconds);
//             if (!vestingDurationsMap.has(vestingInSeconds)) {
//                 vestingDurationsMap.set(vestingInSeconds, { count: 0, sumPrimeAmount: 0, addresses: [] });
//             }
//             vestingDurationsMap.get(vestingInSeconds).count++;
//             vestingDurationsMap.get(vestingInSeconds).sumPrimeAmount += participant.primeAmount;
//             vestingDurationsMap.get(vestingInSeconds).addresses.push({
//                 walletAddress: participant.walletAddress,
//                 primeAmount: participant.primeAmount
//             });
//
//             // Sum prime amounts
//             totalPrimeAmount += participant.primeAmount;
//         });
//
//         // Output results
//         console.log(`Total number of vesting participants: ${totalParticipants}`);
//
//         console.log(`Total number of participants with grantClaimRightTo not null: ${participantsWithGrantClaimRightTo}`);
//
//         console.log(`Number of unique cliff durations: ${uniqueCliffDurations.size}`);
//         if (argv.includes('--detailed')) {
//             console.log('Detailed cliff durations:');
//             cliffDurationsMap.forEach((data, duration) => {
//                 console.log(`- Duration ${duration} seconds (${duration/(60*60*24*30)} months): ${data.count} participant(s), Sum of tokens: ${data.sumPrimeAmount}`);
//                 console.log(`  Addresses: ${data.addresses.map(addr => `${addr.walletAddress} (${addr.primeAmount} tokens)`).join(', ')}`);
//             });
//         } else {
//             console.log('Unique cliff durations:');
//             cliffDurationsMap.forEach((data, duration) => {
//                 console.log(`- Duration ${duration} seconds (${duration/(60*60*24*30)} months): ${data.count} participant(s), Sum of tokens: ${data.sumPrimeAmount}`);
//             });
//         }
//
//         console.log(`Number of unique vesting durations: ${uniqueVestingDurations.size}`);
//         if (argv.includes('--detailed')) {
//             console.log('Detailed vesting durations:');
//             vestingDurationsMap.forEach((data, duration) => {
//                 console.log(`- Duration ${duration} seconds (${duration/(60*60*24*30)} months): ${data.count} participant(s), Sum of tokens: ${data.sumPrimeAmount}`);
//                 console.log(`  Addresses: ${data.addresses.map(addr => `${addr.walletAddress} (${addr.primeAmount} tokens)`).join(', ')}`);
//             });
//         } else {
//             console.log('Unique vesting durations:');
//             vestingDurationsMap.forEach((data, duration) => {
//                 console.log(`- Duration ${duration} seconds (${duration/(60*60*24*30)} months): ${data.count} participant(s), Sum of tokens: ${data.sumPrimeAmount}`);
//             });
//         }
//
//         console.log(`Sum of primeAmounts: ${totalPrimeAmount}`);
//
//         if (argv.includes('--detailed')) {
//             console.log('List of grantClaimRightToAddresses:');
//             Object.keys(grantClaimRightToAddresses).forEach(address => {
//                 console.log(`- Address ${address}: Participants [${grantClaimRightToAddresses[address].join(', ')}]`);
//             });
//         }
//
//     } catch (error) {
//         console.error('Error parsing JSON:', error);
//     }
// });
