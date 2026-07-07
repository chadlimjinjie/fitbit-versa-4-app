/**
 * Companion app (runs on the phone): fetches weather from Open-Meteo and
 * relays it to the watch. It has internet access; the device app does not.
 *
 * Open-Meteo is keyless (no registration/API key), so weather works out of the
 * box — the only user setting is the °C/°F toggle.
 */
import * as messaging from "messaging";
import { geolocation } from "geolocation";
import { settingsStorage } from "settings";
import { me as companion } from "companion";

import { MessageType } from "../common/messages";

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

// Discord incoming webhook. Lives only on the companion (has internet); the
// device never sees this URL.
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1523867220235653212/7NIRHf30nxEKK6rExIn53ljShQl_RTR3jMMV4id3-B58c1T5DKJDiw6PSNfp1Jl-TF2F";

// Compact labels for the WMO weather-interpretation codes Open-Meteo returns.
// https://open-meteo.com/en/docs -> "Weather variable documentation".
function conditionForCode(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow";
  return "Storm"; // 95, 96, 99
}

// --- Settings helpers -------------------------------------------------------
function useFahrenheit() {
  return settingsStorage.getItem("useFahrenheit") === "true";
}

// --- Messaging --------------------------------------------------------------
function send(msg) {
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send(msg);
  }
}

function sendError(reason) {
  console.log(`weather error: ${reason}`);
  send({ type: MessageType.WeatherError, reason });
}

// --- Weather fetch ----------------------------------------------------------
function fetchWeather() {
  geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const fahrenheit = useFahrenheit();
      const tempUnit = fahrenheit ? "fahrenheit" : "celsius";
      const unitLabel = fahrenheit ? "F" : "C";
      const url =
        `${OPEN_METEO_ENDPOINT}?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,weather_code&temperature_unit=${tempUnit}`;

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`http ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const current = data.current || {};
          send({
            type: MessageType.WeatherData,
            temp: Math.round(current.temperature_2m),
            unit: unitLabel,
            condition: conditionForCode(current.weather_code),
            location: "",
          });
        })
        .catch((err) => sendError(`fetch: ${err.message}`));
    },
    (err) => sendError(`geo: ${err.message}`),
    { timeout: 60000 },
  );
}

// --- Discord webhook --------------------------------------------------------
function sendDiscord() {
  fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Hello from Versa 4" }),
  })
    .then((res) => {
      // Discord returns 204 No Content on success.
      if (!res.ok) throw new Error(`http ${res.status}`);
      send({ type: MessageType.DiscordSent });
    })
    .catch((err) => {
      console.log(`discord error: ${err.message}`);
      send({ type: MessageType.DiscordError, reason: err.message });
    });
}

// A device peer asking for weather is the main trigger.
messaging.peerSocket.addEventListener("message", (evt) => {
  const msg = evt.data;
  if (msg.type === MessageType.RequestWeather) {
    fetchWeather();
  } else if (msg.type === MessageType.SendDiscord) {
    sendDiscord();
  }
});

// Also refresh when the companion is woken (e.g. by settings changes).
if (companion.launchReasons.wokenUp || companion.launchReasons.settingsChanged) {
  fetchWeather();
}
