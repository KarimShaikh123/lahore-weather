const { test } = require("node:test");
const assert = require("node:assert");
const {
  isAuthorized,
  toEpochSeconds,
  formatOffset,
  buildReading,
  validateWeather,
  validateWaqi,
  validateFreshness,
} = require("../api/ingest.js");

const weather = {
  utc_offset_seconds: 18000,
  current_units: {
    time: "iso8601",
    interval: "seconds",
    temperature_2m: "°C",
    apparent_temperature: "°C",
    relative_humidity_2m: "%",
    weather_code: "wmo code",
    wind_speed_10m: "km/h",
    is_day: "",
  },
  current: {
    time: "2026-08-13T14:00",
    interval: 900,
    temperature_2m: 36.7,
    apparent_temperature: 42.9,
    relative_humidity_2m: 50,
    weather_code: 51,
    wind_speed_10m: 5.3,
    is_day: 1,
  },
};

const waqi = {
  status: "ok",
  data: {
    aqi: 179,
    idx: -471607,
    dominentpol: "pm25",
    city: { name: "Lahore", geo: [31.548, 74.344] },
    time: { iso: "2026-08-13T08:00:00Z" },
    iaqi: { h: { v: 48.64 }, pm1: { v: 154 }, pm10: { v: 77 }, pm25: { v: 179 }, t: { v: 26.17 } },
  },
};

test("isAuthorized requires a secret and a matching bearer", () => {
  assert.equal(isAuthorized({ authorization: "Bearer s3cr3t" }, "s3cr3t"), true);
  assert.equal(isAuthorized({ authorization: "Bearer wrong" }, "s3cr3t"), false);
  assert.equal(isAuthorized({ authorization: "Bearer s3cr3t" }, undefined), false);
  assert.equal(isAuthorized({ authorization: "Bearer s3cr3t" }, ""), false);
  assert.equal(isAuthorized({}, "s3cr3t"), false);
});

test("toEpochSeconds converts naive local + offset to epoch", () => {
  const expected = Math.round((Date.UTC(2026, 7, 13, 14, 0) - 18000 * 1000) / 1000);
  assert.equal(toEpochSeconds("2026-08-13T14:00", 18000), expected);
  assert.equal(toEpochSeconds("garbage", 18000), null);
});

test("buildReading maps both providers into the stored contract", () => {
  const r = buildReading(weather, waqi);
  assert.equal(r.recorded_at, "2026-08-13T14:00+05:00");
  assert.equal(r.temperature_c, 36.7);
  assert.equal(r.feels_like_c, 42.9);
  assert.equal(r.humidity_pct, 50);
  assert.equal(r.weather_code, 51);
  assert.equal(r.wind_kmh, 5.3);
  assert.equal(r.is_day, 1);
  assert.equal(r.aqi, 179);
  assert.equal(r.dominant_pollutant, "pm25");
  assert.equal(r.pm1, 154);
  assert.equal(r.pm25, 179);
  assert.equal(r.pm10, 77);
  assert.ok(!("no2" in r), "no2 must be absent when the station does not measure it");
  assert.ok(!("o3" in r));
  assert.ok(!("so2" in r));
  assert.ok(!("co" in r));
});

test("formatOffset renders an ISO offset from seconds", () => {
  assert.equal(formatOffset(18000), "+05:00");
  assert.equal(formatOffset(-18000), "-05:00");
  assert.equal(formatOffset(0), "+00:00");
  assert.equal(formatOffset(19800), "+05:30");
});

test("validateWeather accepts the live-shaped response", () => {
  assert.equal(validateWeather(weather), null);
});

test("validateWeather rejects error bodies, wrong units, and ranges", () => {
  assert.equal(validateWeather(null), "weather: empty body");
  assert.equal(validateWeather({ error: true, reason: "boom" }), "weather: boom");
  assert.equal(
    validateWeather({ ...weather, current_units: { ...weather.current_units, temperature_2m: "°F" } }),
    "weather: temperature unit °F"
  );
  assert.equal(
    validateWeather({ ...weather, current: { ...weather.current, temperature_2m: 999 } }),
    "weather: temperature out of range"
  );
  assert.equal(
    validateWeather({ ...weather, current: { ...weather.current, relative_humidity_2m: 120 } }),
    "weather: humidity out of range"
  );
  assert.equal(
    validateWeather({ ...weather, current: { ...weather.current, is_day: 2 } }),
    "weather: bad is_day"
  );
});

test("validateWaqi accepts the live-shaped response", () => {
  assert.equal(validateWaqi(waqi), null);
});

test("validateWaqi rejects offline, wrong station, and bad values", () => {
  assert.equal(validateWaqi(null), "aqi: empty body");
  assert.equal(validateWaqi({ status: "error", data: null }), "aqi: status error");
  assert.equal(validateWaqi({ status: "ok", data: null }), "aqi: station offline (data null)");
  assert.equal(
    validateWaqi({ status: "ok", data: { ...waqi.data, city: { name: "Shanghai" } } }),
    "aqi: wrong station Shanghai"
  );
  assert.equal(
    validateWaqi({ status: "ok", data: { ...waqi.data, aqi: 9999 } }),
    "aqi: bad value 9999"
  );
});

test("validateFreshness allows recent readings and rejects stale/future", () => {
  const now = Math.round(Date.UTC(2026, 7, 13, 9, 30) / 1000);
  assert.equal(validateFreshness("2026-08-13T14:00", 18000, now), null);
  assert.equal(
    validateFreshness("2026-08-13T06:00", 18000, now),
    "weather: reading too old"
  );
  assert.equal(
    validateFreshness("2026-08-13T17:00", 18000, now),
    "weather: reading in the future"
  );
  assert.equal(validateFreshness("garbage", 18000, now), "weather: unparseable time");
});