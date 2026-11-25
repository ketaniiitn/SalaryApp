# Salary — where we are

One TypeScript app for Android and iOS. The phone talks only to Express. Express stores organisations and employees in Supabase.

```
Expo Go  →  Express API (:4000)  →  Supabase project flbdllwugemxjjpcawku
```

## Built

- **mobile** — Expo SDK 58, React Native, TypeScript, Expo Router, NativeWind. Screens: organisation list, new organisation, organisation detail, add employee, server address.
- **server** — Express API. Create and list organisations. Add and list employees for one organisation.
- **supabase/schema.sql** — drops the earlier `payslips` table and creates `organisations` and `employees`. Row level security is on. The API uses the secret key, which bypasses it.

## Still needs the SQL editor

The payslip table was created in the development project, including one test row. This session cannot run `DROP TABLE` against that project. Open the Supabase SQL editor and run `supabase/schema.sql` once. Until then, organisation requests return an error that names that file.

## Config

- `server/.env.local` holds the project URL and the secret key. It is gitignored. The publishable key is not used.
- `.cursor/mcp.json` lists Expo, Supabase, GitHub, and Playwright. Supabase is scoped to `flbdllwugemxjjpcawku`. Sign-in for those servers is still manual. Details are in `docs/MCP_SETUP.md`.
- Cloud Android builds are described in `mobile/eas.json`: `preview` makes an APK, `production` makes an AAB. They have not been run.

## Not done yet

- The new screens have not been confirmed on a physical phone. Expo Go opens the Metro URL, then **Change address** should be the phone URL printed by the API.
- Expo, Supabase, and GitHub MCP servers are not signed in. GitHub still needs `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment Cursor can see.
- No git commit has been made.
