// const fs = require('fs');
// const path = require('path');
// const csv = require('csv-parser');
//
// const inputFilePath = path.join(__dirname, 'sourceExcel.csv');
// const outputFilePath = path.join(__dirname, 'sourceExcelConverted.json');
//
// const convertMonthsToSeconds = (months) => {
//     const daysInMonth = 30;
//     const secondsInDay = 86400;
//     return months * daysInMonth * secondsInDay;
// };
//
// const results = [];
//
// fs.createReadStream(inputFilePath)
//     .pipe(csv())
//     .on('data', (row) => {
//         const convertedData = {
//             walletAddress: row.Wallet,
//             cliffInSeconds: convertMonthsToSeconds(parseFloat(row.Cliff, 10)),
//             vestingInSeconds: convertMonthsToSeconds(parseFloat(row.Vest, 10)),
//             primeAmount: parseFloat(row.Tokens, 10),
//             grantClaimRightTo: null,
//         };
//         results.push(convertedData);
//     })
//     .on('end', () => {
//         fs.writeFile(outputFilePath, JSON.stringify(results, null, 2), (err) => {
//             if (err) {
//                 console.error('Error writing to JSON file', err);
//             } else {
//                 console.log('CSV file successfully converted to JSON');
//             }
//         });
//     });
