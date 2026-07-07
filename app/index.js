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

// Paging (page 1 = stats, page 2 = Discord button)
const page1 = document.getElementById("page1");
const page2 = document.getElementById("page2");
const dot1 = document.getElementById("dot1");
const dot2 = document.getElementById("dot2");
const gestureLayer = document.getElementById("gestureLayer");
const sendBtn = document.getElementById("sendBtn");
const sendStatus = document.getElementById("sendStatus");

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
// Latest reading is cached so the Discord snapshot can include it.
let currentHeartRate = null;

if (HeartRateSensor && appbit.permissions.granted("access_heart_rate")) {
  const hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", () => {
    currentHeartRate = hrm.heartRate != null ? hrm.heartRate : null;
    hrLabel.text = currentHeartRate != null ? `${currentHeartRate}` : "--";
  });

  if (BodyPresenceSensor) {
    const body = new BodyPresenceSensor();
    body.addEventListener("reading", () => {
      if (body.present) {
        hrm.start();
      } else {
        hrm.stop();
        currentHeartRate = null;
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

// Snapshot of the live stats to ship to the companion for the Discord embed.
function currentStats() {
  const t = appbit.permissions.granted("access_activity") ? today.adjusted : {};
  return {
    steps: t.steps || 0,
    calories: t.calories || 0,
    distance: t.distance || 0, // metres
    heartRate: currentHeartRate,
  };
}

// --- Paging + swipe ---------------------------------------------------------
// Fitbit has no native swipe event, so we detect a horizontal drag on a
// full-screen gesture layer: record the touch-down X and compare on release.
const SWIPE_THRESHOLD = 60; // px of horizontal travel to count as a swipe
let currentPage = 0;
let swipeStartX = null;

function showPage(n) {
  currentPage = n < 0 ? 0 : n > 1 ? 1 : n;
  page1.style.display = currentPage === 0 ? "inline" : "none";
  page2.style.display = currentPage === 1 ? "inline" : "none";
  dot1.class = currentPage === 0 ? "dot-active" : "dot";
  dot2.class = currentPage === 1 ? "dot-active" : "dot";
}

gestureLayer.addEventListener("mousedown", (evt) => {
  swipeStartX = evt.screenX;
});

gestureLayer.addEventListener("mouseup", (evt) => {
  if (swipeStartX == null) return;
  const dx = evt.screenX - swipeStartX;
  swipeStartX = null;
  if (dx <= -SWIPE_THRESHOLD) showPage(currentPage + 1); // swipe left -> next
  else if (dx >= SWIPE_THRESHOLD) showPage(currentPage - 1); // swipe right -> prev
});

showPage(0);

// --- Discord button ---------------------------------------------------------
let statusTimer = null;

function setSendStatus(text) {
  sendStatus.text = text;
  if (statusTimer) clearTimeout(statusTimer);
  if (text && text !== "Sending...") {
    statusTimer = setTimeout(() => {
      sendStatus.text = "";
    }, 3000);
  }
}

sendBtn.addEventListener("click", () => {
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send({ type: MessageType.SendDiscord, stats: currentStats() });
    setSendStatus("Sending...");
  } else {
    setSendStatus("No phone");
  }
});

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
    case MessageType.DiscordSent:
      setSendStatus("Sent!");
      break;
    case MessageType.DiscordError:
      setSendStatus("Failed");
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
