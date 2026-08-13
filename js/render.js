(function () {
  const SKY_BY_ICON = {
    clear: "clear",
    partly: "partly",
    cloud: "overcast",
    fog: "overcast",
    drizzle: "storm",
    rain: "storm",
    showers: "storm",
    snow: "storm",
    "snow-showers": "storm",
    thunder: "storm",
    unknown: "overcast",
  };

  function render(reading, $) {
    const iconKey = LWData.weatherIconKey(reading.weather_code);
    const iconEl = $("w-icon");
    iconEl.innerHTML = LW_ICONS[iconKey] || LW_ICONS.unknown;
    iconEl.dataset.weather = iconKey;

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
    marker.hidden = false;
    marker.style.left = LWData.aqiPosition(reading.aqi) + "%";
    marker.dataset.cat = cat.key;

    document.body.dataset.theme = reading.is_day === 1 ? "day" : "night";
    document.body.dataset.sky = SKY_BY_ICON[iconKey] || "overcast";
  }

  const MIN_POINTS = 4;

  function renderHistory(history, $) {
    const section = $("trend");
    if (!section || !history) return;
    const values = history.map((r) => r.aqi).filter(Number.isFinite);
    const note = $("trend-note");
    if (values.length < MIN_POINTS) {
      note.textContent = "Not enough readings yet — the hourly collector will fill this in.";
      note.hidden = false;
      $("trend-plot").hidden = true;
      section.hidden = false;
      return;
    }
    const path = LWData.sparklinePath(values, 1100, 120, 6);
    $("aqi-spark-path").setAttribute("d", path);
    $("trend-range").textContent = `${Math.min(...values)}–${Math.max(...values)} AQI`;
    $("trend-current").textContent = String(values[values.length - 1]);
    note.hidden = true;
    $("trend-plot").hidden = false;
    $("trend-meta").hidden = false;
    section.hidden = false;
  }

  window.LW = { render, renderHistory };
})();