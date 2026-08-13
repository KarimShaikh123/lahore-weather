const AQI_CATEGORIES = [
  { max: 50, key: "good", label: "Good" },
  { max: 100, key: "moderate", label: "Moderate" },
  { max: 150, key: "usg", label: "Unhealthy for Sensitive Groups" },
  { max: 200, key: "unhealthy", label: "Unhealthy" },
  { max: 300, key: "very-unhealthy", label: "Very Unhealthy" },
  { max: Infinity, key: "hazardous", label: "Hazardous" },
];

const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Dense freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Light snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

function aqiCategory(aqi) {
  if (!Number.isFinite(aqi)) return { key: "unknown", label: "Unknown" };
  return AQI_CATEGORIES.find((c) => aqi <= c.max);
}

function weatherCodeLabel(code) {
  return WMO_CODES[code] ?? "Unknown";
}

function formatStaleness(recordedAt, now) {
  const min = Math.floor((new Date(now) - new Date(recordedAt)) / 60000);
  if (!Number.isFinite(min) || min < 1) return "Updated just now";
  if (min < 60) return `Updated ${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

function weatherIconKey(code) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 85 && code <= 86) return "snow-showers";
  if (code >= 95 && code <= 99) return "thunder";
  return "unknown";
}

function aqiPosition(aqi) {
  if (!Number.isFinite(aqi)) return 0;
  const v = Math.max(0, Math.min(500, aqi));
  const bands = [
    [0, 50],
    [51, 100],
    [101, 150],
    [151, 200],
    [201, 300],
    [301, 500],
  ];
  let i = 0;
  for (; i < bands.length; i++) if (v <= bands[i][1]) break;
  i = Math.min(i, bands.length - 1);
  const [lo, hi] = bands[i];
  const frac = (v - lo) / (hi - lo);
  return Math.max(0, Math.min(100, ((i + frac) / bands.length) * 100));
}

function buildForecastHours(hourly) {
  if (!hourly) return null;
  const labels = ["time", "temperature_2m", "precipitation_probability", "weather_code", "is_day"];
  const isArray = (k) => Array.isArray(hourly[k]) && hourly[k].length > 0;
  if (!labels.every(isArray)) return null;
  return hourly.time.map((t, i) => ({
    time: t,
    temp: hourly.temperature_2m[i],
    rain: hourly.precipitation_probability[i],
    code: hourly.weather_code[i],
    is_day: hourly.is_day[i],
  }));
}

const LWData = { aqiCategory, weatherCodeLabel, formatStaleness, weatherIconKey, aqiPosition, buildForecastHours };
if (typeof window !== "undefined") window.LWData = LWData;
if (typeof module !== "undefined" && module.exports) module.exports = LWData;