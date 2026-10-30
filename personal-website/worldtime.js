// World Time App — fetches the current local time for a city from the
// UAPI World Time API and renders a live, ticking clock.

(function () {
  "use strict";

  var API_ENDPOINT = "https://uapis.cn/api/v1/misc/worldtime";

  var form = document.getElementById("worldtime-form");
  var input = document.getElementById("worldtime-input");
  var statusEl = document.getElementById("worldtime-status");
  var resultEl = document.getElementById("worldtime-result");
  var cityEl = document.getElementById("worldtime-city");
  var clockEl = document.getElementById("worldtime-clock");
  var dateEl = document.getElementById("worldtime-date");
  var zoneEl = document.getElementById("worldtime-zone");
  var offsetEl = document.getElementById("worldtime-offset");

  if (!form || !input || !statusEl || !resultEl) return;

  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  /* ---- Status helpers ---- */
  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "worldtime-status" + (type ? " is-" + type : "");
    statusEl.hidden = false;
  }

  /* ---- Live clock ---- */
  var clockTimer = null;

  function stopClock() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function formatOffset(seconds) {
    var sign = seconds < 0 ? "-" : "+";
    var abs = Math.abs(seconds);
    var h = Math.floor(abs / 3600);
    var m = Math.floor((abs % 3600) / 60);
    return "UTC" + sign + pad(h) + ":" + pad(m);
  }

  function startClock(data) {
    stopClock();

    // The API gives us a UTC epoch (timestamp_unix) plus the city's offset in
    // seconds. We anchor to the client clock so the display keeps ticking.
    var baseClientMs = Date.now();
    var baseCityMs = data.timestamp_unix * 1000 + data.offset_seconds * 1000;

    function tick() {
      var cityDate = new Date(baseCityMs + (Date.now() - baseClientMs));

      clockEl.textContent =
        pad(cityDate.getUTCHours()) + ":" +
        pad(cityDate.getUTCMinutes()) + ":" +
        pad(cityDate.getUTCSeconds());

      var dateText = MONTHS[cityDate.getUTCMonth()] + " " +
        cityDate.getUTCDate() + ", " + cityDate.getUTCFullYear();
      if (data.weekday) dateText += " · " + data.weekday;
      dateEl.textContent = dateText;
    }

    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ---- Fetch + display ---- */
  function search(city) {
    resultEl.hidden = true;
    stopClock();
    showStatus("Loading…", "loading");

    fetch(API_ENDPOINT + "?city=" + encodeURIComponent(city))
      .then(function (res) {
        if (res.status === 404) throw new Error("not-found");
        if (res.status === 429) throw new Error("rate-limited");
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then(function (data) {
        if (!data || data.datetime == null || data.timestamp_unix == null) {
          throw new Error("not-found");
        }

        cityEl.textContent = data.query || city;
        zoneEl.textContent = data.timezone || "—";
        offsetEl.textContent = formatOffset(Number(data.offset_seconds) || 0);

        statusEl.hidden = true;
        resultEl.hidden = false;
        startClock(data);
      })
      .catch(function (err) {
        if (err && err.message === "not-found") {
          showStatus("Couldn't find that city — check the spelling.", "error");
        } else if (err && err.message === "rate-limited") {
          showStatus("Too many requests right now — please wait a moment and try again.", "error");
        } else {
          showStatus("Something went wrong — please try again.", "error");
        }
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var city = input.value.trim();
    if (!city) {
      resultEl.hidden = true;
      stopClock();
      showStatus("Enter a city first.", "error");
      return;
    }

    search(city);
  });
})();
