const { test } = require("node:test");
const assert = require("node:assert");
const { buildReadingsResponse, HISTORY_ROWS } = require("../api/readings.js");

const reading = {
  recorded_at: "2026-08-13T15:45",
  temperature_c: 36.2,
  feels_like_c: 41.9,
  humidity_pct: 51,
  weather_code: 51,
  wind_kmh: 3.9,
  is_day: 1,
  aqi: 171,
  dominant_pollutant: "pm25",
  pm25: 56.1,
  pm10: 59.5,
};

test("buildReadingsResponse exposes latest and history", () => {
  const out = buildReadingsResponse([reading], [reading, { ...reading, aqi: 160 }]);
  assert.deepEqual(out.latest, reading);
  assert.equal(out.history.length, 2);
  assert.equal(out.history[1].aqi, 160);
});

test("buildReadingsResponse handles an empty database", () => {
  const out = buildReadingsResponse([], []);
  assert.equal(out.latest, null);
  assert.deepEqual(out.history, []);
});

test("history window is capped at a week of hourly readings", () => {
  assert.equal(HISTORY_ROWS, 168);
});