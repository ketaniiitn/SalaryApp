# Salary

A small organisation and employee list for learning mobile development. One TypeScript codebase runs on Android and iOS. The phone talks to an Express API, and that API stores records in memory until you connect Supabase.

## Layout

- `mobile` — Expo SDK 58, React Native, Expo Router, and NativeWind
- `server` — Node.js and Express
- `supabase/schema.sql` — organisations and employees tables to create when you want the data to persist

## Run it on your phone

Install [Expo Go](https://expo.dev/go) from the App Store or Play Store. This project uses Expo SDK 58, which is the SDK that current Expo Go supports.

In one terminal:

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

The API prints a phone address, for example `http://192.168.1.10:4000`.

In a second terminal:

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. Keep the phone and the computer on the same Wi-Fi network. In the app, tap **Change address** and paste the phone URL from the API terminal. `localhost` works in a simulator. A physical phone cannot reach it.

From the repo root, `npm run server` and `npm run mobile` start the same two processes after each folder’s dependencies are installed.

## What you can do

The home screen lists organisations. **Create organisation** sends a name to `POST /api/organisations`. Open an organisation to see its employees, then **Add employee** sends a name and role to `POST /api/organisations/:id/employees`.

Nothing is seeded. Restarting the API clears records that were saved in memory. Records saved after Supabase is connected stay in the database.

## Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/schema.sql`. That drops the earlier `payslips` table and creates `organisations` and `employees`.
3. In `server/.env` or `server/.env.local`, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Also run `supabase/pay-by-month.sql`. It is safe to run again and never drops data. Pay for each month is worked out from attendance, and this adds the columns that needs.
5. Restart the API. The home screen says “Saved in Supabase.”

The service role key stays on the server. The app never sees it. With no policies on the tables, the publishable key cannot read or write organisations or employees.

## Cloud builds

An APK is a file you can install on an Android phone. An AAB is the bundle you upload to the Play Store. Both are built in the cloud with EAS, so you do not need Android Studio for the first installable file.

```bash
npm install -g eas-cli
cd mobile
eas login
eas init
eas build -p android --profile preview
eas build -p android --profile production
```

`preview` produces an APK. `production` produces an AAB. `eas login` needs a free Expo account, and `eas init` links this app to that account the first time.

`npm run typecheck` checks the app and the API.
