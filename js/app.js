(function () {
  const READINGS_URL = "./sample-reading.json";
  const $ = (id) => document.getElementById(id);

  function showError(msg) {
    const banner = $("error-banner");
    banner.textContent = msg;
    banner.hidden = false;
    $("w-condition").textContent = "Unavailable";
    $("aqi-value").textContent = "—";
    $("aqi-label").textContent = "Unavailable";
  }

  async function load() {
    try {
      const res = await fetch(READINGS_URL);
      if (!res.ok) throw new Error("bad status " + res.status);
      const reading = await res.json();
      LW.render(reading, $);
      const stale = LWData.formatStaleness(reading.recorded_at, new Date());
      $("staleness").textContent = stale;
      $("staleness").hidden = false;
    } catch (err) {
      showError("Couldn't load the latest reading. Check back in a few minutes.");
    }
  }

  load();
})();