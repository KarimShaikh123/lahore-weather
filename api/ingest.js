const { Redis } = require("@upstash/redis");

const MAX_READINGS = 720;
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const LAT = "31.558";
const LON = "74.35071";
const WAQI_URL = "https://api.waqi.info/feed/A471607/";

function isAuthorized(headers, secret) {
  return Boolean(secret) && headers.authorization === "Bearer " + secret;
}

function toEpochSeconds(naiveLocal, utcOffsetSeconds) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(naiveLocal);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return Math.round((Date.UTC(y, mo - 1, d, h, mi) - utcOffsetSeconds * 1000) / 1000);
}

function formatOffset(utcOffsetSeconds) {
  const sign = utcOffsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(utcOffsetSeconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return sign + hh + ":" + mm;
}

function buildReading(weather, waqi) {
  const current = weather.current;
  const iaqi = (waqi.data && waqi.data.iaqi) || {};
  const value = (k) => (iaqi[k] && typeof iaqi[k].v === "number" ? iaqi[k].v : undefined);
  const reading = {
    recorded_at: current.time + formatOffset(weather.utc_offset_seconds),
    temperature_c: current.temperature_2m,
    feels_like_c: current.apparent_temperature,
    humidity_pct: current.relative_humidity_2m,
    weather_code: current.weather_code,
    wind_kmh: current.wind_speed_10m,
    is_day: current.is_day,
    aqi: waqi.data.aqi,
    dominant_pollutant: waqi.data.dominentpol || null,
  };
  for (const key of ["pm1", "pm25", "pm10", "no2", "o3", "so2", "co"]) {
    const v = value(key);
    if (v !== undefined) reading[key] = v;
  }
  return reading;
}

function validateWeather(weather) {
  if (!weather) return "weather: empty body";
  if (weather.error) return "weather: " + (weather.reason || "API error");
  const u = weather.current_units || {};
  const c = weather.current;
  if (!c) return "weather: missing current";
  if (u.temperature_2m !== "°C") return "weather: temperature unit " + u.temperature_2m;
  if (u.wind_speed_10m !== "km/h") return "weather: wind unit " + u.wind_speed_10m;
  if (u.relative_humidity_2m !== "%") return "weather: humidity unit " + u.relative_humidity_2m;
  if (typeof c.temperature_2m !== "number" || c.temperature_2m < -40 || c.temperature_2m > 60)
    return "weather: temperature out of range";
  if (typeof c.relative_humidity_2m !== "number" || c.relative_humidity_2m < 0 || c.relative_humidity_2m > 100)
    return "weather: humidity out of range";
  if (typeof c.wind_speed_10m !== "number" || c.wind_speed_10m < 0 || c.wind_speed_10m > 200)
    return "weather: wind out of range";
  if (c.is_day !== 0 && c.is_day !== 1) return "weather: bad is_day";
  if (typeof c.weather_code !== "number") return "weather: bad weather_code";
  if (typeof c.time !== "string") return "weather: bad time";
  return null;
}

function validateWaqi(waqi) {
  if (!waqi) return "aqi: empty body";
  if (waqi.status !== "ok") return "aqi: status " + waqi.status;
  if (!waqi.data) return "aqi: station offline (data null)";
  const name = waqi.data.city && waqi.data.city.name;
  if (typeof name !== "string" || !name.toLowerCase().includes("lahore"))
    return "aqi: wrong station " + name;
  if (typeof waqi.data.aqi !== "number" || waqi.data.aqi < 0 || waqi.data.aqi > 500)
    return "aqi: bad value " + waqi.data.aqi;
  return null;
}

function validateFreshness(recordedAt, utcOffsetSeconds, nowSeconds) {
  const s = toEpochSeconds(recordedAt, utcOffsetSeconds);
  if (s === null) return "weather: unparseable time";
  if (nowSeconds - s > 2 * 3600) return "weather: reading too old";
  if (s - nowSeconds > 3600) return "weather: reading in the future";
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!isAuthorized(req.headers, process.env.CRON_SECRET)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const params =
      `latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
      `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;
    const [weatherRes, waqiRes] = await Promise.all([
      fetch(`${WEATHER_URL}?${params}`),
      fetch(`${WAQI_URL}?token=${process.env.AQI_API_KEY}`),
    ]);
    const weather = await weatherRes.json().catch(() => null);
    const waqi = await waqiRes.json().catch(() => null);

    const weatherErr = validateWeather(weather);
    if (weatherErr) {
      res.status(502).json({ error: weatherErr });
      return;
    }
    const waqiErr = validateWaqi(waqi);
    if (waqiErr) {
      res.status(502).json({ error: waqiErr });
      return;
    }
    const offset = weather.utc_offset_seconds || 18000;
    const freshErr = validateFreshness(weather.current.time, offset, Math.floor(Date.now() / 1000));
    if (freshErr) {
      res.status(502).json({ error: freshErr });
      return;
    }

    const reading = buildReading(weather, waqi);
    const score = toEpochSeconds(reading.recorded_at, offset);

    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    await redis.zremrangebyscore("readings", score, score);
    await redis.zadd("readings", { score, member: JSON.stringify(reading) });
    await redis.zremrangebyrank("readings", 0, -(MAX_READINGS + 1));
    const count = await redis.zcard("readings");

    res.status(200).json({ ok: true, recorded_at: reading.recorded_at, score, count });
  } catch (err) {
    res.status(500).json({ error: "internal: " + err.message });
  }
};

module.exports.isAuthorized = isAuthorized;
module.exports.toEpochSeconds = toEpochSeconds;
module.exports.formatOffset = formatOffset;
module.exports.buildReading = buildReading;
module.exports.validateWeather = validateWeather;
module.exports.validateWaqi = validateWaqi;
module.exports.validateFreshness = validateFreshness;