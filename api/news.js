const https = require('https');
const { TextDecoder } = require('util');

function fetchPage(url, encoding) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (encoding === 'euc-kr') {
          try { resolve(new TextDecoder('euc-kr').decode(buf)); }
          catch (e) { resolve(buf.toString('utf-8')); }
        } else {
          resolve(buf.toString('utf-8'));
        }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  try {
    // 네이버 증권 메인 뉴스 (EUC-KR 인코딩)
    const html = await fetchPage('https://finance.naver.com/news/mainnews.naver', 'euc-kr');
    const news = [];

    // block1 리스트 아이템 파싱
    const itemRegex = /<li\s+class="block1">([\s\S]*?)<\/li>/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null && news.length < 30) {
      const block = match[1];

      // dd.articleSubject 안의 a 태그에서 제목과 URL 추출
      const titleMatch = block.match(/<dd\s+class="articleSubject">\s*(?:<span[^>]*>[^<]*<\/span>\s*)?<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      const summaryMatch = block.match(/<dd\s+class="articleSummary">([\s\S]*?)<span\s+class="press"/);
      const sourceMatch = block.match(/<span\s+class="press">([\s\S]*?)<\/span>/);
      const dateMatch = block.match(/<span\s+class="wdate">([\s\S]*?)<\/span>/);

      if (titleMatch) {
        const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
        const url = titleMatch[1].startsWith('http') ? titleMatch[1] : 'https://finance.naver.com' + titleMatch[1];
        const summary = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 120) : '';
        const source = sourceMatch ? sourceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        const date = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        if (title.length > 2) {
          news.push({ title, url, summary, source, date });
        }
      }
    }

    // 폴백: block1에서 못 가져오면 news_read 링크로 시도
    if (news.length === 0) {
      const altRegex = /<a[^>]*href="(\/news\/news_read\.naver[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      while ((match = altRegex.exec(html)) !== null && news.length < 30) {
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        if (title.length > 5) {
          news.push({
            title,
            url: 'https://finance.naver.com' + match[1],
            summary: '', source: '네이버증권', date: ''
          });
        }
      }
    }

    res.status(200).json({ success: true, data: news, count: news.length });
  } catch (e) {
    console.error('뉴스 에러:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
