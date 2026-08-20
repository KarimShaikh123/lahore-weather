(function () {
  const FORECAST_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=31.558&longitude=74.35071" +
    "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
    "&forecast_hours=24&timezone=auto";
  const $ = (id) => document.getElementById(id);

  function renderForecast(hourly, utcOffsetSeconds) {
    const strip = $("forecast-strip");
    const hours = LWData.buildForecastHours(hourly, utcOffsetSeconds);
    if (!hours) throw new Error("malformed forecast payload");
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    strip.innerHTML = "";
    for (const h of hours) {
      const li = document.createElement("li");
      li.className = "forecast-slot";
      li.dataset.day = h.is_day === 1 ? "day" : "night";
      const hourEl = document.createElement("span");
      hourEl.className = "forecast-hour";
      hourEl.textContent = fmt.format(new Date(h.time));
      const iconEl = document.createElement("span");
      iconEl.className = "forecast-icon";
      iconEl.innerHTML = LW_ICONS[LWData.weatherIconKey(h.code)] || LW_ICONS.unknown;
      const tempEl = document.createElement("span");
      tempEl.className = "forecast-temp";
      tempEl.textContent = Math.round(h.temp) + "°";
      li.append(hourEl, iconEl, tempEl);
      if (h.rain > 0) {
        const rainEl = document.createElement("span");
        rainEl.className = "forecast-rain";
        rainEl.textContent = h.rain + "%";
        li.append(rainEl);
      }
      strip.append(li);
    }
  }

  async function load() {
    const panel = $("forecast");
    const note = $("forecast-note");
    try {
      const res = await fetch(FORECAST_URL);
      if (!res.ok) throw new Error("bad status " + res.status);
      const payload = await res.json();
      renderForecast(payload.hourly, payload.utc_offset_seconds);
      panel.hidden = false;
    } catch (err) {
      note.textContent = "Forecast unavailable right now.";
      note.hidden = false;
      panel.hidden = false;
    }
  }

  load();
})();