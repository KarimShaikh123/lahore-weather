(function () {
  const ICONS = {
    clear:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
    partly:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M9 2.5v1.5M2.5 8h1.5M4.3 3.8l1 1M4.3 12.2l1-1"/><path d="M16.5 19h-9a3.5 3.5 0 0 1 .5-6.9 5 5 0 0 1 9.6-1A3.8 3.8 0 0 1 16.5 19z"/></svg>',
    cloud:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 19H7a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17 11a3.5 3.5 0 0 1 0 7z"/></svg>',
    fog:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 12H7a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 17 6a3 3 0 0 1 0 6z"/><path d="M5 17h14M5 20h10"/></svg>',
    drizzle:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 12H7a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 17 6a3 3 0 0 1 0 6z"/><path d="M8 16l-1 2M12 16l-1 2M16 16l-1 2"/></svg>',
    rain:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 12H7a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 17 6a3 3 0 0 1 0 6z"/><path d="M7 16l-1.5 3M12 16l-1.5 3M17 16l-1.5 3"/></svg>',
    snow:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 12H7a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 17 6a3 3 0 0 1 0 6z"/><circle cx="8.5" cy="17.5" r=".9"/><circle cx="12.5" cy="17.5" r=".9"/><circle cx="16.5" cy="17.5" r=".9"/></svg>',
    showers:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="9" cy="7" r="2.6"/><path d="M9 2.5v1M4 7h1M5.2 3.7l.8.8"/><path d="M17 12H10a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 8.6-1A3 3 0 0 1 17 12z"/><path d="M8 16l-1 2M13 16l-1 2"/></svg>',
    "snow-showers":
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="9" cy="7" r="2.6"/><path d="M9 2.5v1M4 7h1M5.2 3.7l.8.8"/><path d="M17 12H10a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 8.6-1A3 3 0 0 1 17 12z"/><circle cx="9.5" cy="17" r=".9"/><circle cx="13.5" cy="17" r=".9"/></svg>',
    thunder:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 12H7a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 17 6a3 3 0 0 1 0 6z"/><path d="M12 13l-2 4h3l-2 4"/></svg>',
    unknown:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>',
  };

  function render(reading, $) {
    const iconEl = $("w-icon");
    iconEl.innerHTML = ICONS[LWData.weatherIconKey(reading.weather_code)] || ICONS.unknown;
    iconEl.dataset.weather = LWData.weatherIconKey(reading.weather_code);

    $("w-temp").textContent = Math.round(reading.temperature_c) + "°";
    $("w-condition").textContent = LWData.weatherCodeLabel(reading.weather_code);
    $("w-feels").textContent = Math.round(reading.feels_like_c) + "°";
    $("w-humidity").textContent = reading.humidity_pct + "%";
    $("w-wind").textContent = Math.round(reading.wind_kmh) + " km/h";

    const cat = LWData.aqiCategory(reading.aqi);
    const aqiEl = $("aqi-value");
    aqiEl.textContent = reading.aqi;
    aqiEl.dataset.cat = cat.key;
    $("aqi-label").textContent = cat.label;
    $("aqi-dominant").textContent = "Dominant: " + String(reading.dominant_pollutant || "—").toUpperCase();
    $("aqi-pm25").textContent = reading.pm25 ?? "—";
    $("aqi-pm10").textContent = reading.pm10 ?? "—";
    $("aqi-no2").textContent = reading.no2 ?? "—";
    $("aqi-o3").textContent = reading.o3 ?? "—";
    $("aqi-so2").textContent = reading.so2 ?? "—";
    $("aqi-co").textContent = reading.co ?? "—";

    const marker = $("aqi-marker");
    marker.style.left = LWData.aqiPosition(reading.aqi) + "%";
    marker.dataset.cat = cat.key;

    document.body.dataset.theme = reading.is_day === 1 ? "day" : "night";
  }

  window.LW = { render };
})();