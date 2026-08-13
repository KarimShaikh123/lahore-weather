(function () {
  const READINGS_URL = "/api/readings";
  const $ = (id) => document.getElementById(id);

  function showError(msg) {
    const banner = $("error-banner");
    banner.textContent = msg;
    banner.hidden = false;
    $("w-condition").textContent = "Unavailable";
    $("aqi-value").textContent = "—";
    $("aqi-value").dataset.cat = "unknown";
    $("aqi-label").textContent = "Unavailable";
    $("aqi-marker").hidden = true;
  }

  function tickClock() {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    $("clock").textContent = fmt.format(new Date()) + " · Lahore";
  }

  function startTicker(reading) {
    tickClock();
    setInterval(tickClock, 30000);
    setInterval(() => {
      $("staleness").textContent = LWData.formatStaleness(reading.recorded_at, new Date());
    }, 60000);
  }

  async function load() {
    try {
      const res = await fetch(READINGS_URL);
      if (!res.ok) throw new Error("bad status " + res.status);
      const payload = await res.json();
      const reading = payload.latest;
      if (!reading) {
        showError("No readings yet — the hourly collector will fill this in.");
        return;
      }
      LW.render(reading, $);
      const stale = LWData.formatStaleness(reading.recorded_at, new Date());
      $("staleness").textContent = stale;
      $("staleness").hidden = false;
      startTicker(reading);
    } catch (err) {
      showError("Couldn't load the latest reading (tried " + READINGS_URL + ").");
    }
  }

  load();
})();