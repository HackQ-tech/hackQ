// Rank ladder: points - rank, daily post limit
const RANKS = [
  { name: 'Newbie', min: 0, dailyPosts: 1 },
  { name: 'Rookie', min: 100, dailyPosts: 1 },
  { name: 'Hacker', min: 300, dailyPosts: 2 },
  { name: 'Elite', min: 700, dailyPosts: 3 },
  { name: 'Guru', min: 1500, dailyPosts: 5 },
  { name: 'Legend', min: 3000, dailyPosts: 10 }
];
const POINTS = { post: 5, comment: 3, reactionsPerPoint: 3, autoApproveAt: 100, commentsPerDayRewarded: 10, bugReward: 1000 };

function getRank(points = 0) {
  let i = 0;
  RANKS.forEach((r, idx) => { if (points >= r.min) i = idx; });
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  const progress = next ? Math.round(((points - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { name: cur.name, level: i + 1, dailyPosts: cur.dailyPosts, next: next && { name: next.name, min: next.min }, progress };
}
module.exports = { RANKS, POINTS, getRank };
