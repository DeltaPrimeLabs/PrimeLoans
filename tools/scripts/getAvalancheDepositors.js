const axios = require('axios');
const fs = require('fs');

const CHAINBASE_API_KEY = 'your-api-key-here'; // Replace with your actual API key
const network_id = '43114'; // Chain ID for Avalanche
const token_addr = '0xD26E504fc642B96751fD55D3E68AF295806542f5'; // Token address

const options = {
    url: `https://api.chainbase.online/v1/token/holders`,
    method: 'GET',
    headers: {
        'x-api-key': CHAINBASE_API_KEY,
        'accept': 'application/json'
    },
    params: {
        chain_id: network_id,
        contract_address: token_addr,
        page: 1,
        limit: 100
    }
};

async function fetchTokenHolders() {
    let results = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await axios({
                ...options,
                params: { ...options.params, page }
            });
            const data = response.data.data;

            if (data && data.length > 0) {
                results = results.concat(data);
                page++;
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`Error fetching data from page ${page}:`, error);
            hasMore = false;
        }
    }

    return results;
}

fetchTokenHolders().then(results => {
    fs.writeFileSync('token_holders.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Data has been saved to token_holders.json');
}).catch(error => {
    console.error('Error fetching token holders:', error);
});
