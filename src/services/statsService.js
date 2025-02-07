import ApolloClient from 'apollo-boost';
import config from '../config';
import gql from 'graphql-tag';

export default class StatsService {

//where: {user: {id: 0xC6ba6BB819f1Be84EFeB2E3f2697AD9818151e5D}}
  async getTransactionHistory() {
    let query = `
      {
        transactions(first: 20, orderBy: timestamp, orderDirection: desc) {
          fromAmount
          fromAsset
          id
          timestamp
          toAmount
          toAsset
          txType
          user {
            id
          }
        }
      }
    `;

    const client = new ApolloClient({
      uri: config.subgraph
    });

    return await client.query({query: gql(query)})
  }

  async getUserTransactionHistory(smartLoanAddress, page, pageSize) {
    const skip = page * config.TRANSACTION_HISTORY_PAGE_SIZE;
    const query = `
    {
      user(id: "${smartLoanAddress.toLowerCase()}") {
        collateralAmount
        collateralAsset
        id
        numTransactions
        transactions(first: ${pageSize}, skip: ${skip} orderBy: timestamp, orderDirection: desc) {
          id
          fromAmount
          fromAsset
          timestamp
          toAmount
          toAsset
          txType
        }
      }
    }`

    const client = new ApolloClient({
      uri: config.subgraph
    });

    const data = await client.query({query: gql(query)});

    return data

  }

}