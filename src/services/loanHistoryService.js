import fetch from "node-fetch";

export default class LoanHistoryService {
  weekBefore = new Date().getTime() - 7 * 25 * 60 * 60 * 1000;
  monthBefore =  new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
  endDate = new Date().getTime();

  async getLoanHistoryData(walletAddress) {
    const startDate = 1673352000000;

    const response = await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/loan-stats?address=${walletAddress}&from=${startDate}&to=${this.endDate}&network=${window.chain}`);
    const body = await response.json()

    return {
      week: body.data.filter(dataEntry => dataEntry.timestamp > this.weekBefore),
      month: body.data.filter(dataEntry => dataEntry.timestamp > this.monthBefore),
      all: body.data
    }
  }

  async getPnLData(walletAddress) {
    const response = await fetch(`https://4vj2ob8u5b.execute-api.eu-west-2.amazonaws.com/prod?chain=Avalanche&address=${walletAddress}`);
    const body = await response.json()
    const data = JSON.parse(body.body).data.map(entry => ({
      ...entry,
      timestamp: entry.timestamp * 1000
    }))
    return {
      weekData: data.filter(dataEntry => dataEntry.timestamp > this.weekBefore),
      monthData: data.filter(dataEntry => dataEntry.timestamp > this.monthBefore),
      allData: data
    }
  }
};
