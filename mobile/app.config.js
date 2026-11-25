// Extends app.json.
//
// The preview APK talks to the API on your Wi-Fi over plain http (for example http://192.168.1.10:4000).
// Android release builds block plain http unless the app allows it, so the APK would only ever show
// "The server did not respond". eas.json sets ALLOW_HTTP=1 for the preview profile only.
// Production builds keep http blocked: serve the API over https before shipping to the Play Store.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ["expo-build-properties", { android: { usesCleartextTraffic: process.env.ALLOW_HTTP === "1" } }],
  ],
});
