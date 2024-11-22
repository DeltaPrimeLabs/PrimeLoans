import config from '@/config';
import ApolloClient, {gql} from 'apollo-boost';


export async function fetchLiquidatedEvents(address) {
  let query = `
    {
      liquidatedEvents(where: { smartLoan: "${address.toString()}"}, orderBy: timestamp) {
        id
        timestamp
      }
    }
   `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  return (await client.query({query: gql(query)})).data.liquidatedEvents;
}