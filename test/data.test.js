const { test } = require("node:test");
const assert = require("node:assert");
const { aqiCategory, weatherCodeLabel, formatStaleness, weatherIconKey, aqiPosition, formatOffset, buildForecastHours, sparklinePath } = require("../js/data.js");

test("aqiCategory boundaries", () => {
  assert.equal(aqiCategory(0).key, "good");
  assert.equal(aqiCategory(50).key, "good");
  assert.equal(aqiCategory(51).key, "moderate");
  assert.equal(aqiCategory(100).key, "moderate");
  assert.equal(aqiCategory(101).key, "usg");
  assert.equal(aqiCategory(150).key, "usg");
  assert.equal(aqiCategory(151).key, "unhealthy");
  assert.equal(aqiCategory(180).key, "unhealthy");
  assert.equal(aqiCategory(201).key, "very-unhealthy");
  assert.equal(aqiCategory(300).key, "very-unhealthy");
  assert.equal(aqiCategory(301).key, "hazardous");
  assert.equal(aqiCategory(500).key, "hazardous");
});

test("aqiCategory rejects non-finite values", () => {
  assert.equal(aqiCategory(NaN).key, "unknown");
  assert.equal(aqiCategory(undefined).key, "unknown");
  assert.equal(aqiCategory(null).key, "unknown");
});

test("weatherCodeLabel maps known and unknown codes", () => {
  assert.equal(weatherCodeLabel(0), "Clear sky");
  assert.equal(weatherCodeLabel(51), "Light drizzle");
  assert.equal(weatherCodeLabel(95), "Thunderstorm");
  assert.equal(weatherCodeLabel(999), "Unknown");
});

test("formatStaleness buckets", () => {
  const now = new Date("2026-08-13T15:00:00Z");
  assert.equal(formatStaleness("2026-08-13T14:59:30Z", now), "Updated just now");
  assert.equal(formatStaleness("2026-08-13T14:10:00Z", now), "Updated 50m ago");
  assert.equal(formatStaleness("2026-08-13T14:00:00Z", now), "Updated 1h ago");
  assert.equal(formatStaleness("2026-08-13T13:00:00Z", now), "Updated 2h ago");
  assert.equal(formatStaleness("2026-08-12T15:00:00Z", now), "Updated 1d ago");
});

test("formatStaleness handles invalid input", () => {
  assert.equal(formatStaleness("not-a-date", new Date()), "Updated just now");
});

test("weatherIconKey maps WMO ranges", () => {
  assert.equal(weatherIconKey(0), "clear");
  assert.equal(weatherIconKey(1), "partly");
  assert.equal(weatherIconKey(2), "partly");
  assert.equal(weatherIconKey(3), "cloud");
  assert.equal(weatherIconKey(45), "fog");
  assert.equal(weatherIconKey(48), "fog");
  assert.equal(weatherIconKey(51), "drizzle");
  assert.equal(weatherIconKey(57), "drizzle");
  assert.equal(weatherIconKey(61), "rain");
  assert.equal(weatherIconKey(67), "rain");
  assert.equal(weatherIconKey(71), "snow");
  assert.equal(weatherIconKey(77), "snow");
  assert.equal(weatherIconKey(80), "showers");
  assert.equal(weatherIconKey(82), "showers");
  assert.equal(weatherIconKey(85), "snow-showers");
  assert.equal(weatherIconKey(86), "snow-showers");
  assert.equal(weatherIconKey(95), "thunder");
  assert.equal(weatherIconKey(99), "thunder");
  assert.equal(weatherIconKey(999), "unknown");
});

test("aqiPosition maps through six equal category bands", () => {
  assert.equal(aqiPosition(0), 0);
  assert.equal(aqiPosition(50).toFixed(1), "16.7");
  assert.equal(aqiPosition(51).toFixed(1), "16.7");
  assert.equal(aqiPosition(100).toFixed(1), "33.3");
  assert.equal(aqiPosition(150).toFixed(1), "50.0");
  assert.equal(aqiPosition(180).toFixed(1), "59.9");
  assert.equal(aqiPosition(200).toFixed(1), "66.7");
  assert.equal(aqiPosition(250).toFixed(1), "74.9");
  assert.equal(aqiPosition(300).toFixed(1), "83.3");
  assert.equal(aqiPosition(301).toFixed(1), "83.3");
  assert.equal(aqiPosition(500), 100);
  assert.equal(aqiPosition(1000), 100);
  assert.equal(aqiPosition(-10), 0);
  assert.equal(aqiPosition(NaN), 0);
});

test("formatOffset renders an ISO offset from seconds", () => {
  assert.equal(formatOffset(18000), "+05:00");
  assert.equal(formatOffset(-18000), "-05:00");
  assert.equal(formatOffset(0), "+00:00");
  assert.equal(formatOffset(19800), "+05:30");
});

test("buildForecastHours maps hourly arrays into slots", () => {
  const hours = buildForecastHours(
    {
      time: ["2026-08-13T14:00", "2026-08-13T15:00"],
      temperature_2m: [36.7, 35.9],
      precipitation_probability: [0, 45],
      weather_code: [51, 61],
      is_day: [1, 1],
    },
    18000
  );
  assert.equal(hours.length, 2);
  assert.deepEqual(hours[0], { time: "2026-08-13T14:00+05:00", temp: 36.7, rain: 0, code: 51, is_day: 1 });
  assert.equal(hours[1].rain, 45);
  assert.equal(hours[1].code, 61);
});

test("buildForecastHours falls back to the Karachi offset when missing", () => {
  const hours = buildForecastHours({
    time: ["2026-08-13T14:00"],
    temperature_2m: [36],
    precipitation_probability: [0],
    weather_code: [0],
    is_day: [1],
  });
  assert.equal(hours[0].time, "2026-08-13T14:00+05:00");
});

test("stamped forecast times parse to the same instant regardless of system timezone", () => {
  const hours = buildForecastHours(
    {
      time: ["2026-08-13T14:00"],
      temperature_2m: [36],
      precipitation_probability: [0],
      weather_code: [0],
      is_day: [1],
    },
    18000
  );
  assert.equal(Date.parse(hours[0].time), Date.parse("2026-08-13T09:00:00.000Z"));
});

test("buildForecastHours rejects malformed payloads", () => {
  assert.equal(buildForecastHours(null), null);
  assert.equal(buildForecastHours({}), null);
  assert.equal(buildForecastHours({ time: [], temperature_2m: [1] }), null);
});

test("sparklinePath builds a scaled path and rejects tiny series", () => {
  const p = sparklinePath([50, 100, 75], 1100, 120, 6);
  assert.equal(typeof p, "string");
  assert.match(p, /^M6\.0 /);
  assert.match(p, / L1094\.0 /);
  assert.equal(sparklinePath([], 1100, 120, 6), null);
  assert.equal(sparklinePath([42], 1100, 120, 6), null);
  assert.equal(sparklinePath([50, null, 90], 1100, 120, 6), "M6.0 114.0 L1094.0 6.0");
});