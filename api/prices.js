const https = require('https');

const CODES = [
  '005930','000660','005380','373220','005490','035420','000270','068270',
  '051910','006400','055550','105560','003670','012330','066570','035720',
  '028260','003550','034730','032830','247540','086520','196170','403870',
  '277810','145020','328130','041510','293490','263750'
];

function fetchPrices() {
  return new Promise((resolve, reject) => {
    const url = 'https://polling.finance.naver.com/api/realtime/domestic/stock/' + CODES.join(',');
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const stocks = json.datas.map(s => ({
            code: s.itemCode,
            name: s.stockName,
            price: parseInt(s.closePrice.replace(/,/g, '')),
            change: parseInt((s.compareToPreviousClosePrice || '0').replace(/,/g, '')),
            changeRate: parseFloat(s.fluctuationsRatio),
            direction: s.compareToPreviousPrice.code,
            market: s.stockExchangeType.name
          }));
          resolve(stocks);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');

  try {
    const stocks = await fetchPrices();
    res.status(200).json({ success: true, data: stocks, timestamp: Date.now() });
  } catch (e) {
    console.error('시세 조회 에러:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
