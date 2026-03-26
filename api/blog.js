const fetch = require('node-fetch');

function fmtDate(d) {
  if (!d) return null;
  const s = String(d).replace(/\D/g, '');
  if (s.length >= 8) return `${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`;
  return String(d);
}

function calcPeriod(d) {
  if (!d) return null;
  const s = String(d).replace(/\D/g, '');
  if (s.length < 8) return null;
  const created = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
  const now = new Date();
  const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  return (months / 12).toFixed(1) + '년';
}

function fmtNum(n, suffix = '명') {
  if (n == null) return null;
  return Number(n).toLocaleString('ko-KR') + suffix;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { blogId } = req.query;
  if (!blogId) return res.status(400).json({ error: 'blogId 파라미터가 필요합니다.' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': `https://blog.naver.com/${blogId}`,
  };

  const result = { blogId, sources: [] };

  // 1) 블로그 기본 API
  try {
    const apiRes = await fetch(`https://blog.naver.com/api/blogs/${blogId}`, { headers, timeout: 8000 });
    if (apiRes.ok) {
      const d = await apiRes.json();
      result.blogName        = d.blogName || d.name || '';
      result.nickName        = d.nickName || d.bloggerNickName || '';
      result.topic           = d.blogDirectoryName || d.categoryName || '';
      result.totalVisitor    = d.totalVisitor;
      result.todayVisitor    = d.todayVisitor;
      result.followerCount   = d.followerCount;
      result.followingCount  = d.followingCount;
      result.blogCreateDate  = d.blogCreateDate;
      result.totalPostCount  = d.totalPostCount;
      result.totalScrapCount = d.totalScrapCount;
      result.isAdPost        = d.isAdPost;
      result.sources.push('BlogAPI');
    }
  } catch(e) {
    result.blogApiError = e.message;
  }

  // 2) 방문자 전용 API
  if (result.todayVisitor == null) {
    try {
      const vRes = await fetch(`https://blog.naver.com/api/blogs/${blogId}/visitor`, { headers, timeout: 5000 });
      if (vRes.ok) {
        const d = await vRes.json();
        result.todayVisitor  = d.today ?? d.todayVisitor ?? result.todayVisitor;
        result.totalVisitor  = d.total ?? d.totalVisitor ?? result.totalVisitor;
        result.sources.push('VisitorAPI');
      }
    } catch(e) {}
  }

  // 3) 포스트 카운트 API
  if (result.totalPostCount == null) {
    try {
      const pRes = await fetch(`https://blog.naver.com/api/blogs/${blogId}/post/list?page=1&pageSize=1`, { headers, timeout: 5000 });
      if (pRes.ok) {
        const d = await pRes.json();
        result.totalPostCount = d.totalCount ?? d.postListData?.totalCount;
        if (result.totalPostCount) result.sources.push('PostAPI');
      }
    } catch(e) {}
  }

  // Format output
  const period = calcPeriod(result.blogCreateDate);

  return res.status(200).json({
    blogId,
    blogName:     result.blogName     || null,
    nickName:     result.nickName     || null,
    topic:        result.topic        || null,
    totalVisitor: fmtNum(result.totalVisitor),
    todayVisitor: fmtNum(result.todayVisitor),
    follower:     (result.followerCount != null && result.followingCount != null)
                    ? `${fmtNum(result.followerCount)}/${fmtNum(result.followingCount)}`
                    : null,
    created:      fmtDate(result.blogCreateDate),
    period:       period ? `${period} / 1번` : null,
    adpost:       result.isAdPost ?? null,
    totalPost:    fmtNum(result.totalPostCount, '개'),
    scrap:        fmtNum(result.totalScrapCount, '회'),
    sources:      result.sources,
    fetchedAt:    new Date().toISOString(),
  });
};
