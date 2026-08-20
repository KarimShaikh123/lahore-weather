const { test } = require("node:test");
const assert = require("node:assert");
const {
  isAuthorized,
  toEpochSeconds,
  formatOffset,
  buildReading,
  validateWeather,
  validateWaqi,
  validateAir,
  validateFreshness,
  validateFreshnessIso,
  hourScore,
  impliedPm25,
  sensorsDisagree,
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

const air = {
  utc_offset_seconds: 18000,
  current: {
    time: "2026-08-13T14:00",
    interval: 3600,
    pm10: 59.5,
    pm2_5: 56.1,
    carbon_monoxide: 605,
    nitrogen_dioxide: 4.6,
    sulphur_dioxide: 18.3,
    ozone: 259,
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
  const r = buildReading(weather, waqi, air);
  assert.equal(r.recorded_at, "2026-08-13T14:00+05:00");
  assert.equal(r.temperature_c, 36.7);
  assert.equal(r.feels_like_c, 42.9);
  assert.equal(r.humidity_pct, 50);
  assert.equal(r.weather_code, 51);
  assert.equal(r.wind_kmh, 5.3);
  assert.equal(r.is_day, 1);
  assert.equal(r.aqi, 179);
  assert.equal(r.dominant_pollutant, "pm25");
  assert.equal(r.pm25, 56.1);
  assert.equal(r.pm10, 59.5);
  assert.equal("pm1" in r, false);
});

test("buildReading ignores WAQI iaqi particles — stale sub-indexes on the provider", () => {
  const r = buildReading(weather, waqi, air);
  assert.notEqual(r.pm25, waqi.data.iaqi.pm25.v);
  assert.notEqual(r.pm10, waqi.data.iaqi.pm10.v);
  assert.equal(r.pm1, undefined);
});

test("buildReading fills gases from CAMS when the station does not measure them", () => {
  const r = buildReading(weather, waqi, air);
  assert.equal(r.no2, 4.6);
  assert.equal(r.so2, 18.3);
  assert.equal(r.o3, 259);
  assert.equal(r.co, 605);
});

test("buildReading keeps station gas values over CAMS when the station measures them", () => {
  const stationWaqi = {
    status: "ok",
    data: {
      aqi: 150,
      dominentpol: "pm25",
      city: { name: "Lahore" },
      iaqi: { no2: { v: 88 } },
    },
  };
  const r = buildReading(weather, stationWaqi, air);
  assert.equal(r.no2, 88);
});

test("validateAir accepts the live-shaped response and rejects bad ones", () => {
  assert.equal(validateAir(air), null);
  assert.equal(validateAir(null), "air: empty body");
  assert.equal(validateAir({ error: true, reason: "nope" }), "air: nope");
  assert.equal(validateAir({ current: null }), "air: missing current");
  assert.equal(validateAir({ current: { pm10: -1 } }), "air: bad pm10");
  assert.equal(validateAir({ current: { ozone: "hi" } }), "air: bad ozone");
  assert.equal(validateAir({ current: { pm10: 59.5, carbon_monoxide: undefined } }), null);
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

test("validateFreshnessIso checks offset-stamped times (WAQI shape)", () => {
  const now = Math.round(Date.UTC(2026, 7, 13, 9, 30) / 1000);
  assert.equal(validateFreshnessIso("2026-08-13T08:00:00Z", now), null);
  assert.equal(validateFreshnessIso("2026-08-13T05:00:00Z", now), "aqi: reading too old");
  assert.equal(validateFreshnessIso("2026-08-13T12:00:00Z", now), "aqi: reading in the future");
  assert.equal(validateFreshnessIso("garbage", now), "aqi: unparseable time");
  assert.equal(validateFreshnessIso("2026-08-13T05:00:00Z", now, "air"), "air: reading too old");
});

test("hourScore floors the reading to its hour", () => {
  assert.equal(hourScore("2026-08-13T14:15", 18000), Math.round(Date.UTC(2026, 7, 13, 9, 0) / 1000));
  assert.equal(hourScore("2026-08-13T14:45", 18000), Math.round(Date.UTC(2026, 7, 13, 9, 0) / 1000));
  assert.equal(hourScore("garbage", 18000), null);
});

test("impliedPm25 inverts the US EPA breakpoints", () => {
  assert.equal(impliedPm25(0), 0);
  assert.equal(impliedPm25(50), 12);
  assert.equal(impliedPm25(100), 35.4);
  assert.equal(impliedPm25(150), 55.4);
  assert.equal(impliedPm25(200), 150.4);
  assert.equal(impliedPm25(300), 250.4);
  assert.equal(impliedPm25(500), 500.4);
  assert.ok(Math.abs(impliedPm25(75) - 23.51) < 0.01);
  assert.equal(impliedPm25("nope"), null);
});

test("sensorsDisagree flags big station/model divergence only", () => {
  assert.equal(sensorsDisagree(54, 53.4), true);
  assert.equal(sensorsDisagree(0, 30), true);
  assert.equal(sensorsDisagree(179, 56.1), false);
  assert.equal(sensorsDisagree(300, 250), false);
  assert.equal(sensorsDisagree(54, undefined), false);
  assert.equal(sensorsDisagree(null, 53.4), false);
});

test("buildReading stamps sensors_disagree from the aqi/pm25 cross-check", () => {
  assert.equal(buildReading(weather, waqi, air).sensors_disagree, false);
  const agreeing = { status: "ok", data: { ...waqi.data, aqi: 54 } };
  const camsAir = { ...air, current: { ...air.current, pm2_5: 53.4 } };
  assert.equal(buildReading(weather, agreeing, camsAir).sensors_disagree, true);
});