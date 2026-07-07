/**
 * Device app: renders time + live health stats and asks the companion for
 * weather over the messaging channel.
 */
import document from "document";
import clock from "clock";
import { preferences } from "user-settings";
import { today } from "user-activity";
import { HeartRateSensor } from "heart-rate";
import { BodyPresenceSensor } from "body-presence";
import { battery } from "power";
import { me as appbit } from "appbit";
import * as messaging from "messaging";

import { MessageType } from "../common/messages";

// --- UI element handles -----------------------------------------------------
const timeLabel = document.getElementById("timeLabel");
const dateLabel = document.getElementById("dateLabel");
const stepsLabel = document.getElementById("stepsValue");
const hrLabel = document.getElementById("hrValue");
const calsLabel = document.getElementById("calsValue");
const distLabel = document.getElementById("distValue");
const battLabel = document.getElementById("battValue");
const weatherLabel = document.getElementById("weatherValue");

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// --- Clock ------------------------------------------------------------------
clock.granularity = "seconds";
clock.addEventListener("tick", ({ date }) => {
  const hours24 = date.getHours();
  const mins = zeroPad(date.getMinutes());
  const hours =
    preferences.clockDisplay === "12h" ? (hours24 % 12 || 12) : zeroPad(hours24);
  timeLabel.text = `${hours}:${mins}`;
  dateLabel.text = `${MONTHS[date.getMonth()]} ${date.getDate()}`;

  refreshActivity();
  refreshBattery();
});

// --- Battery ----------------------------------------------------------------
// Charge thresholds (%) that switch the readout colour.
const BATTERY_HEALTHY = 50; // above this -> green
const BATTERY_LOW = 20; // at/above this -> amber, below -> red

function batteryColor(level) {
  if (level > BATTERY_HEALTHY) return "#3ad07a"; // green
  if (level >= BATTERY_LOW) return "#f5c542"; // amber
  return "#e74c3c"; // red
}

function refreshBattery() {
  const level = Math.floor(battery.chargeLevel);
  battLabel.text = `${level}%`;
  battLabel.style.fill = batteryColor(level);
}

// --- Activity stats ---------------------------------------------------------
function refreshActivity() {
  if (!appbit.permissions.granted("access_activity")) {
    stepsLabel.text = calsLabel.text = distLabel.text = "--";
    return;
  }
  const t = today.adjusted;
  stepsLabel.text = formatNumber(t.steps || 0);
  calsLabel.text = formatNumber(t.calories || 0);
  // distance is in metres; show km with one decimal.
  distLabel.text = `${((t.distance || 0) / 1000).toFixed(1)}km`;
}

// --- Heart rate (only reads while the watch is on the wrist) ----------------
if (HeartRateSensor && appbit.permissions.granted("access_heart_rate")) {
  const hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", () => {
    hrLabel.text = hrm.heartRate != null ? `${hrm.heartRate}` : "--";
  });

  if (BodyPresenceSensor) {
    const body = new BodyPresenceSensor();
    body.addEventListener("reading", () => {
      if (body.present) {
        hrm.start();
      } else {
        hrm.stop();
        hrLabel.text = "--";
      }
    });
    body.start();
  } else {
    hrm.start();
  }
} else {
  hrLabel.text = "--";
}

// --- Weather over messaging -------------------------------------------------
function requestWeather() {
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send({ type: MessageType.RequestWeather });
  }
}

messaging.peerSocket.addEventListener("open", requestWeather);

messaging.peerSocket.addEventListener("message", (evt) => {
  const msg = evt.data;
  switch (msg.type) {
    case MessageType.WeatherData:
      weatherLabel.text = `${msg.temp}°${msg.unit} ${msg.condition}`;
      break;
    case MessageType.WeatherError:
      weatherLabel.text = "Weather --";
      break;
  }
});

// --- helpers ----------------------------------------------------------------
function zeroPad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatNumber(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}
