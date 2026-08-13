(function () {
  function render(reading, $) {
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
  }

  window.LW = { render };
})();