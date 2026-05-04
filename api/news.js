const https = require('https');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  try {
    // 네이버 증권 메인 뉴스
    const html = await fetchPage('https://finance.naver.com/news/mainnews.naver');
    const news = [];

    // 뉴스 항목 파싱
    const itemRegex = /<li[^>]*class="block1"[^>]*>([\s\S]*?)<\/li>/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null && news.length < 30) {
      const block = match[1];
      const titleMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*class="articleSubject"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/);
      const summaryMatch = block.match(/<span class="articleSummary">([\s\S]*?)<\/span>/);
      const sourceMatch = block.match(/<span class="press">([\s\S]*?)<\/span>/);
      const dateMatch = block.match(/<span class="wdate">([\s\S]*?)<\/span>/);

      if (titleMatch) {
        news.push({
          title: titleMatch[2].replace(/<[^>]+>/g, '').trim(),
          url: titleMatch[1].startsWith('http') ? titleMatch[1] : 'https://finance.naver.com' + titleMatch[1],
          summary: summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 100) : '',
          source: sourceMatch ? sourceMatch[1].replace(/<[^>]+>/g, '').trim() : '',
          date: dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : ''
        });
      }
    }

    // 첫 번째 방식으로 못 가져오면 다른 패턴 시도
    if (news.length === 0) {
      const altRegex = /<a[^>]*href="(\/news\/news_read\.naver[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      while ((match = altRegex.exec(html)) !== null && news.length < 30) {
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        if (title.length > 5) {
          news.push({
            title,
            url: 'https://finance.naver.com' + match[1],
            summary: '',
            source: '네이버증권',
            date: ''
          });
        }
      }
    }

    // 그래도 없으면 네이버 뉴스 검색으로 폴백
    if (news.length === 0) {
      const searchHtml = await fetchPage('https://search.naver.com/search.naver?where=news&query=%EC%A6%9D%EA%B6%8C+%EC%A3%BC%EC%8B%9D&sort=1&sm=tab_smr');
      const newsRegex = /<a[^>]*class="news_tit"[^>]*href="([^"]*)"[^>]*title="([^"]*)"/g;
      const pressRegex = /<a[^>]*class="info press"[^>]*>([\s\S]*?)<\/a>/g;
      let m2;
      while ((m2 = newsRegex.exec(searchHtml)) !== null && news.length < 20) {
        const pressM = pressRegex.exec(searchHtml);
        news.push({
          title: m2[2].trim(),
          url: m2[1],
          summary: '',
          source: pressM ? pressM[1].replace(/<[^>]+>/g, '').trim() : '',
          date: ''
        });
      }
    }

    res.status(200).json({ success: true, data: news, count: news.length });
  } catch (e) {
    console.error('뉴스 에러:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
