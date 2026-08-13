const { Redis } = require("@upstash/redis");

const HISTORY_ROWS = 168;

function buildReadingsResponse(latestRows, historyRows) {
  return { latest: latestRows.length ? latestRows[0] : null, history: historyRows };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_READ_ONLY_TOKEN,
    });
    const latest = await redis.zrange("readings", -1, -1);
    const history = await redis.zrange("readings", -HISTORY_ROWS, -1);
    res.status(200).json(buildReadingsResponse(latest, history));
  } catch (err) {
    res.status(500).json({ error: "internal: " + err.message });
  }
};

module.exports.buildReadingsResponse = buildReadingsResponse;
module.exports.HISTORY_ROWS = HISTORY_ROWS;