const https = require('https');
const { TextDecoder } = require('util');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const indices = [];

    // 1) 국내지수 (polling API)
    try {
      const dJson = await fetchJson('https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:KOSPI,KOSDAQ');
      if (dJson.result && dJson.result.areas && dJson.result.areas[0]) {
        dJson.result.areas[0].datas.forEach(d => {
          indices.push({
            name: d.cd === 'KOSPI' ? '코스피' : '코스닥',
            value: (d.nv / 100).toFixed(2),
            change: (d.cv / 100).toFixed(2),
            changeRate: d.cr
          });
        });
      }
    } catch(e) {}

    // 2) 해외지수 (네이버 세계증시 페이지 스크래핑)
    try {
      const buf = await fetchBuffer('https://finance.naver.com/world/');
      const html = new TextDecoder('euc-kr').decode(buf);

      const worldCodes = [
        { code: 'NAS@IXIC', name: '나스닥' },
        { code: 'DJI@DJI', name: '다우' },
        { code: 'SPI@SPX', name: 'S&P500' }
      ];

      worldCodes.forEach(({ code, name }) => {
        const idx = html.indexOf('"' + code + '"');
        if (idx === -1) return;
        const end = html.indexOf('}', idx);
        const obj = html.substring(idx + code.length + 4, end);
        const lastM = obj.match(/"last":([\d.]+)/);
        const diffM = obj.match(/"diff":([\d.-]+)/);
        const rateM = obj.match(/"rate":([\d.-]+)/);
        if (lastM) {
          indices.push({
            name,
            value: parseFloat(lastM[1]),
            change: diffM ? parseFloat(diffM[1]) : 0,
            changeRate: rateM ? parseFloat(rateM[1]) : 0
          });
        }
      });
    } catch(e) {}

    res.status(200).json({ success: true, data: indices });
  } catch (e) {
    console.error('지수 에러:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
