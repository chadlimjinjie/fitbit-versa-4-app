/**
 * Message contract shared between the device app (`app/`) and the companion
 * (`companion/`). Both peers import these constants so the string keys never
 * drift apart.
 *
 * Device  -> Companion: { type: RequestWeather }
 * Companion -> Device : { type: WeatherData, temp, unit, condition, location }
 * Companion -> Device : { type: WeatherError, reason }
 *
 * Device  -> Companion: { type: SendDiscord, stats: { steps, heartRate, calories, distance } }
 * Companion -> Device : { type: DiscordSent }
 * Companion -> Device : { type: DiscordError, reason }
 */
export const MessageType = {
  RequestWeather: "REQUEST_WEATHER",
  WeatherData: "WEATHER_DATA",
  WeatherError: "WEATHER_ERROR",

  SendDiscord: "SEND_DISCORD",
  DiscordSent: "DISCORD_SENT",
  DiscordError: "DISCORD_ERROR",
};
