// Weather App — fetches current weather for a city from the UAPI Weather API
// and renders the temperature, condition and an appropriate weather icon.

(function () {
  "use strict";

  var API_ENDPOINT = "https://uapis.cn/api/v1/misc/weather";

  var form = document.getElementById("weather-form");
  var input = document.getElementById("weather-input");
  var statusEl = document.getElementById("weather-status");
  var resultEl = document.getElementById("weather-result");
  var cityEl = document.getElementById("weather-city");
  var iconEl = document.getElementById("weather-icon");
  var tempEl = document.getElementById("weather-temp");
  var conditionEl = document.getElementById("weather-condition");
  var forecastEl = document.getElementById("weather-forecast");
  var forecastDaysEl = document.getElementById("forecast-days");
  var unitBtns = document.querySelectorAll(".weather-unit");

  if (!form || !input || !statusEl || !resultEl || !forecastEl || !forecastDaysEl) return;

  /* ---- Temperature unit state ---- */
  var currentUnit = "c";   // "c" = Celsius, "f" = Fahrenheit
  var lastData = null;     // last API response, kept for unit re-rendering

  /* ---- Status helpers ---- */
  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "weather-status" + (type ? " is-" + type : "");
    statusEl.hidden = false;
  }

  /* ---- Icon mapping (weather_icon codes + text fallback) ---- */
  function weatherEmoji(iconCode, text) {
    var code = parseInt(iconCode, 10);

    if (!isNaN(code)) {
      if (code === 100 || code === 150) return "☀️";                                  // clear / sunny
      if (code === 101 || code === 102 || code === 103 ||
          code === 151 || code === 152 || code === 153) return "🌤️";                   // partly cloudy
      if (code === 104) return "☁️";                                                   // overcast
      if (code >= 200 && code <= 213) return "💨";                                     // wind / dust
      if (code >= 300 && code <= 313) {                                                // rain
        if (code === 302 || code === 303 || code === 304) return "⛈️";                 // thundershower
        return "🌧️";
      }
      if (code >= 400 && code <= 410) return "❄️";                                     // snow / sleet
      if (code === 500 || code === 501 || code === 502) return "🌫️";                  // mist / fog / haze
      if (code >= 503 && code <= 515) return "💨";                                     // sand / dust storm
      if (code === 900) return "🔥";                                                   // hot
      if (code === 901) return "🥶";                                                   // cold
    }

    // Fallback: match the condition text (Chinese first, then English)
    var t = String(text || "").trim();
    if (!t) return "🌡️";
    if (t.indexOf("雪") !== -1) return "❄️";
    if (t.indexOf("雷") !== -1) return "⛈️";
    if (t.indexOf("雨") !== -1) return "🌧️";
    if (t.indexOf("雾") !== -1 || t.indexOf("霾") !== -1) return "🌫️";
    if (t.indexOf("沙") !== -1 || t.indexOf("尘") !== -1 || t.indexOf("风") !== -1) return "💨";
    if (t.indexOf("阴") !== -1) return "☁️";
    if (t.indexOf("云") !== -1) return "🌤️";
    if (t.indexOf("晴") !== -1) return "☀️";

    var e = t.toLowerCase();
    if (e.indexOf("snow") !== -1) return "❄️";
    if (e.indexOf("thunder") !== -1) return "⛈️";
    if (e.indexOf("rain") !== -1 || e.indexOf("drizzle") !== -1) return "🌧️";
    if (e.indexOf("fog") !== -1 || e.indexOf("haze") !== -1 || e.indexOf("mist") !== -1) return "🌫️";
    if (e.indexOf("wind") !== -1) return "💨";
    if (e.indexOf("cloud") !== -1 || e.indexOf("overcast") !== -1) return "☁️";
    if (e.indexOf("clear") !== -1 || e.indexOf("sun") !== -1) return "☀️";

    return "🌡️";
  }

  /* ---- Render the result card ---- */
  function unitLabel() {
    return currentUnit === "f" ? "°F" : "°C";
  }

  // The API returns Celsius; convert for display when Fahrenheit is selected.
  function convertTemp(value) {
    var n = Number(value);
    if (isNaN(n)) return String(value);
    if (currentUnit === "f") n = n * 9 / 5 + 32;
    return String(Math.round(n));
  }

  // Re-write the current temperature and forecast highs/lows for the active unit.
  function applyTemps() {
    if (!lastData) return;
    tempEl.textContent = convertTemp(lastData.temperature) + unitLabel();

    var cells = forecastDaysEl.querySelectorAll(".forecast-day");
    var days = Array.isArray(lastData.forecast) ? lastData.forecast.slice(0, 3) : [];
    Array.prototype.forEach.call(cells, function (cell, i) {
      var day = days[i];
      if (!day) return;
      var high = cell.querySelector(".forecast-max");
      var low = cell.querySelector(".forecast-min");
      if (high) high.textContent = convertTemp(day.temp_max) + "°";
      if (low) low.textContent = convertTemp(day.temp_min) + "°";
    });
  }

  function renderForecast(days) {
    forecastDaysEl.innerHTML = "";

    days.forEach(function (day) {
      var cell = document.createElement("div");
      cell.className = "forecast-day";

      var week = document.createElement("span");
      week.className = "forecast-week";
      week.textContent = day.week || day.date || "";

      var icon = document.createElement("span");
      icon.className = "forecast-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = weatherEmoji(null, day.weather_day);

      var temps = document.createElement("div");
      temps.className = "forecast-temps";
      var high = document.createElement("span");
      high.className = "forecast-max";
      high.textContent = convertTemp(day.temp_max) + "°";
      var low = document.createElement("span");
      low.className = "forecast-min";
      low.textContent = convertTemp(day.temp_min) + "°";
      temps.appendChild(high);
      temps.appendChild(low);

      var cond = document.createElement("span");
      cond.className = "forecast-cond";
      cond.textContent = day.weather_day || "";

      cell.appendChild(week);
      cell.appendChild(icon);
      cell.appendChild(temps);
      cell.appendChild(cond);
      forecastDaysEl.appendChild(cell);
    });
  }

  function render(data, searchedCity) {
    lastData = data;
    tempEl.textContent = convertTemp(data.temperature) + unitLabel();
    cityEl.textContent = data.city || data.province || searchedCity;
    conditionEl.textContent = data.weather || "";
    iconEl.textContent = weatherEmoji(data.weather_icon, data.weather);

    statusEl.hidden = true;
    resultEl.hidden = false;

    // 3-day forecast (uses the same API response)
    if (Array.isArray(data.forecast) && data.forecast.length) {
      renderForecast(data.forecast.slice(0, 3));
      forecastEl.hidden = false;
    } else {
      forecastEl.hidden = true;
    }
  }

  /* ---- Fetch + display ---- */
  function search(city) {
    resultEl.hidden = true;
    forecastEl.hidden = true;
    showStatus("Loading…", "loading");

    fetch(API_ENDPOINT + "?city=" + encodeURIComponent(city) + "&forecast=true")
      .then(function (res) {
        if (!res.ok) throw new Error("not-found");
        return res.json();
      })
      .then(function (data) {
        if (!data || data.temperature == null || (!data.city && !data.province)) {
          throw new Error("not-found");
        }
        render(data, city);
      })
      .catch(function (err) {
        if (err && err.message === "not-found") {
          showStatus("Couldn't find that city — check the spelling.", "error");
        } else {
          showStatus("Something went wrong — please try again.", "error");
        }
      });
  }

  /* ---- Unit toggle ---- */
  function setUnit(unit) {
    if (unit !== "c" && unit !== "f") return;
    currentUnit = unit;
    Array.prototype.forEach.call(unitBtns, function (btn) {
      var active = btn.getAttribute("data-unit") === unit;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    applyTemps();
  }

  Array.prototype.forEach.call(unitBtns, function (btn) {
    btn.addEventListener("click", function () {
      setUnit(btn.getAttribute("data-unit"));
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var city = input.value.trim();
    if (!city) {
      resultEl.hidden = true;
      forecastEl.hidden = true;
      showStatus("Enter a city first.", "error");
      return;
    }

    search(city);
  });
})();
