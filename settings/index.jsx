function StatsWeatherSettings(props) {
  return (
    <Page>
      <Section
        title={<Text bold align="center">Stats & Weather</Text>}
      >
        <Text>
          Weather is provided by Open-Meteo and works automatically — no account
          or API key needed. Just choose your temperature unit below.
        </Text>
      </Section>

      <Section title={<Text bold>Units</Text>}>
        <Toggle
          settingsKey="useFahrenheit"
          label="Use Fahrenheit (°F)"
        />
      </Section>
    </Page>
  );
}

registerSettingsPage(StatsWeatherSettings);
