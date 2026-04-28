const https = require('https');

function pad(d) {
  return String(d).padStart(2, '0');
}

function getDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

function fetchChart(symbol, timeframe, startTime, endTime) {
  return new Promise((resolve, reject) => {
    const url = `https://fchart.stock.naver.com/siseJson.naver?symbol=${symbol}&requestType=1&startTime=${startTime}&endTime=${endTime}&timeframe=${timeframe}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Response is JS array format, not pure JSON
          // Remove trailing whitespace and parse
          const cleaned = data.trim().replace(/'/g, '"');
          const rows = eval(cleaned); // safe: server-side, known source
          if (!rows || rows.length < 2) {
            resolve([]);
            return;
          }
          // Skip header row, parse data
          const result = [];
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            result.push({
              date: r[0].trim(),
              open: parseInt(r[1]),
              high: parseInt(r[2]),
              low: parseInt(r[3]),
              close: parseInt(r[4]),
              volume: parseInt(r[5])
            });
          }
          resolve(result);
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const { symbol, period } = req.query;
  if (!symbol) {
    return res.status(400).json({ success: false, error: 'symbol required' });
  }

  try {
    const today = getDateStr(0);
    let timeframe, startTime;

    switch(period) {
      case 'day':
        timeframe = 'minute';
        startTime = today;
        break;
      case '1w':
        timeframe = 'day';
        startTime = getDateStr(7);
        break;
      case '1m':
        timeframe = 'day';
        startTime = getDateStr(30);
        break;
      case '3m':
        timeframe = 'day';
        startTime = getDateStr(90);
        break;
      case '1y':
        timeframe = 'day';
        startTime = getDateStr(365);
        break;
      default:
        timeframe = 'day';
        startTime = getDateStr(30);
    }

    const data = await fetchChart(symbol, timeframe, startTime, today);
    res.status(200).json({ success: true, data, period: period || '1m' });
  } catch(e) {
    console.error('차트 데이터 에러:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
