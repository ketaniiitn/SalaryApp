# Bug list

Reviewed 24 Nov 2026: `server`, `supabase`, `billing`, `mobile`. All High items and all but one part of the Medium items are fixed (see the notes under each). Low items are still open.

**Automated checks**
- Server typecheck: passes.
- Billing `npm run check` and typecheck: pass. They only cover the in-memory store, not Supabase.
- Mobile typecheck: passes.
- Mobile `expo lint`: 10 errors and 1 warning (see L-lint). None crashes the app.

Items marked ✅ were re-checked by hand against the code. The rest come from a code read and still need to be reproduced.

---

## High — wrong money, lost data, or security

> **Fixed 24 Nov 2026.**
>
> **You must do one thing:** run `supabase/pay-by-month.sql` once in the Supabase SQL editor before using the new API. Until you do, adding a person fails with an error that names that file.
>
> **H1–H3, pay:**
> - What changed: pay for any month is now worked out from that month's attendance and money given (`settleMonth` in `server/src/store.ts`). The running `days_worked` count is gone.
> - Days already worked: the days entered when adding a person are stored as `days_before_app`. They count only in the month the person was added. Saving the profile can no longer change days.
> - Day cap: only a monthly salary is capped at working days.
> - Last month: the person screen now shows pay for whichever month you're viewing, so you can settle last month after it ends.
>
> **H4, attendance:** the screen ignores responses for a day you've already left, and blocks every marking action until the day on screen has loaded.
>
> **H5, invoice preview:** the `message` listener is gone. The app already calls `__setInvoice` directly.
>
> **H6, Android preview APK:** `expo-build-properties` allows plain http only when `ALLOW_HTTP=1`. `eas.json` sets it for the preview profile only. Production stays https-only.
>
> **How the fixes were checked:**
> - All three typechecks pass. Billing checks pass. Lint has the same 11 problems as before, with no new ones.
> - A memory-store test covers H1–H3.
> - The API boots, and organisation routes still return 401 without a token.
>
> **Not checked yet:**
> - The Supabase code path, because a test would write to your database.
> - Any of this on a real phone.
>
> **Still open:** salary paid after the month ends gets recorded as "Money given" in the new month. The app has no separate "salary paid for last month" entry yet.

- [x] **H1 ✅ Advances are not deducted from last month's pay.** Files: `server/src/store.ts:128`, `:403-416`, `:651-658`
  - "Earned" uses the stored `days_worked`. "Given" counts only advances from the current calendar month.
  - What goes wrong: on 1–5 Dec, when you pay November salary, November's ₹5,000 advance is not subtracted, so you overpay by ₹5,000. Once any December attendance is saved, "earned" switches to December.
  - Fix: calculate earned and given for the month asked for (`?month=`), directly from the attendance and advance rows.

- [x] **H2 ✅ Per-day workers are capped at the month's working days.** Files: `server/src/store.ts:124`, `:583`, `supabase/schema.sql:38`
  - What goes wrong: ₹500 a day, 26 working days, present all 30 days → paid ₹13,000 instead of ₹15,000.
  - Fix: cap only when `salaryBasis === "month"`, and relax the DB check to match.

- [x] **H3 "Days already worked" is wiped by the first attendance save.** Files: `mobile/src/app/organisation/[id]/add.tsx:84`, `server/src/store.ts:569-590`, `index.ts:550`
  - Every attendance save recalculates `daysWorked` for **every** employee in the organisation from that month's marks.
  - What goes wrong: add a person with 10 prior days, then mark anyone present → they drop to 0–1 days and lose about 10 days of pay. A stale settings screen can also write an old count back over the new one.
  - Fix: store pre-app days as a separate offset and always derive the rest from attendance. Remove `daysWorked` from PATCH.

- [x] **H4 ✅ Attendance from one day can be saved onto another.** File: `mobile/src/app/organisation/[id]/attendance.tsx:40-54`, `70-111`
  - `load()` has no guard against stale responses.
  - What goes wrong: tap "Earlier day" twice quickly. Day D-1's response arrives while the header shows D-2, and the next tap saves D-1's marks as D-2's. "Clear the day" and Undo stay enabled while loading and can do the same.
  - Fix: tag each load with its date or a request id and ignore stale responses. Disable the mark buttons while `loadingDay`.

- [x] **H5 ✅ The invoice preview page accepts HTML from any website (XSS, web build).** Files: `billing/src/invoice-html.ts:304-306`, `mobile/src/billing/invoice-frame.web.tsx:36`
  - The `message` listener puts any string starting with `<div` into `innerHTML` without checking who sent it. The iframe has no sandbox, so it runs with the app's origin.
  - What goes wrong: another site can run script with the app's origin and read the signed-in session.
  - Fix: remove the listener (`__setInvoice` is already called directly), or check `event.source === window.parent`. Add `sandbox="allow-scripts"` to the iframe.

- [x] **H6 The Android preview APK probably can't reach the API over HTTP** (check on a device). Files: `mobile/app.json`, `eas.json`, `lib/server-url.tsx:5`
  - Release builds block cleartext HTTP, and the README's setup uses `http://192.168.x.x:4000`.
  - Fix: use `expo-build-properties` with `android.usesCleartextTraffic: true` (or serve HTTPS), and set `EXPO_PUBLIC_API_URL` per EAS profile.

## Medium

> **Fixed 24 Nov 2026, except the email-verification half of M8.** No database migration is needed for these.
>
> **What changed:**
> - **M1, GST split:** CGST is rounded at half the rate and SGST equals it.
>   - ₹10.03 at 18% now gives 0.90 + 0.90.
>   - For prices that include GST, the taxable value moves by a paisa where needed, so the line still adds up to the price.
>   - Two existing check values changed for this reason: a ₹10.10 line at 5% now has tax 0.50, and a bill total is 10.60.
> - **M2, attendance save:** marks are now upserted, then only the people no longer chosen are deleted. A failure leaves the day's earlier marks in place; it never empties the day.
> - **M3, India time:** dates use India time (set `APP_TIME_ZONE` to change it). "Money given" errors now show the server's reason.
> - **M4, refresh failures:** the server returns 502 for a sign-in service outage, and the phone signs out only on a real 401.
> - **M5, bill steps:** jumping ahead runs one step per render, so customers and items are no longer saved twice.
> - **M6, invoice retries:** a retry with a matching `clientRef` returns the saved bill only if it is the same bill, otherwise 409. Supabase now looks up the `clientRef` first, as the memory store does.
> - **M7, invoice search:**
>   - The text search now runs in the database, before the 500-row limit.
>   - Searches typed as dates (YYYY, YYYY-MM or YYYY-MM-DD) become date ranges. Partial dates like "11-24" no longer match.
> - **M8, sign-in limits (half):** rate limits added in `server/src/rate-limit.ts`:
>   - Sign-up: 5 an hour per IP.
>   - Login: 20 per 15 minutes per IP, and 10 per 15 minutes per email.
>   - Refresh: 60 per 15 minutes per IP.
> - **M9, secure tokens:** `expo-secure-store` added.
>   - On phones, only the refresh token and the signed-in admin are kept, in the Keychain or Keystore. The access token stays in memory.
>   - Old plain-storage sessions are moved over once, then deleted.
>   - The web build still uses browser storage.
> - **M10, Android keyboard:** `KeyboardAvoidingView` now uses `behavior="height"` on Android.
> - **M11, memory mode:** with no Supabase keys, the API now has its own in-memory sign-in (scrypt-hashed passwords; accounts vanish on restart). It is never enabled when `NODE_ENV=production`.
>
> **How the fixes were checked:**
> - All three typechecks pass, and the billing checks pass (including new GST and retry cases).
> - Lint has the same 11 problems as before, with no new ones.
> - A UTC-clock test for India-time dates passes.
> - A memory-mode API run passed: sign-up, login, a wrong password, a duplicate account, refresh and refresh reuse, the 429 after 10 bad logins, and pay.
>
> **Not checked yet:**
> - Supabase paths (attendance upsert, invoice search filter, invoice retry lookup), because a test would write to your database.
> - M5, M9 and M10 on a real phone.
>
> **Still open:** M8 email verification. It needs Supabase to send emails (SMTP set up) and a "check your email" step in the app, so it needs your decision.

- [x] **M1 ✅ CGST and SGST can differ by 1 paisa, and their total can be 1 paisa too high.** File: `billing/src/gst.ts:86-87`
  - The whole tax is rounded first and then split, so ₹10.03 at 18% gives CGST 0.90 and SGST 0.91 (should be 0.90 + 0.90).
  - Fix: round CGST at half the rate and set SGST = CGST.

- [x] **M2 Saving attendance in Supabase isn't atomic.** File: `server/src/store.ts:556-567`
  - All of the day's marks are deleted first, then the new ones are inserted. If the insert fails, the whole day is wiped.
  - Fix: do it in one Postgres RPC or transaction, or upsert and delete only the marks that changed.

- [x] **M3 "Today" and "this month" use the server's clock, not India time.** Files: `server/src/dates.ts`, `index.ts:136`
  - On a UTC host, between 00:00 and 05:30 IST on the 1st, today's advance is rejected.
  - On top of that, `advances.tsx:246` replaces the server's message with "Couldn't save. Try again."
  - Fix: use `Asia/Kolkata` on the server, as billing already does, and show the server's error text in the app.

- [x] **M4 Any failed token refresh logs the user out.** Files: `mobile/src/lib/session.tsx:66`, `server/src/index.ts:302`
  - The server returns 401 even when Supabase is unreachable, and the client clears the session on any error.
  - Fix: the server returns 502 for upstream failures, and the client clears the session only on a 401.

- [x] **M5 ✅ Jumping ahead several steps on the bill screen repeats the same step.** File: `mobile/src/app/billing/[id]/bill.tsx:232-248`
  - The `advance()` loop reads a stale `draft`.
  - What goes wrong: tapping "4. Review" from step 1 saves the customer 3 times and lands on step 2. From step 2 with "Save to my items" ticked, it creates duplicate catalogue items.
  - Fix: walk the steps using a ref to the latest draft, or only allow jumping one step at a time.

- [x] **M6 Retrying an invoice save with the same `clientRef` returns the old invoice even if it was edited.** Files: `billing/src/store.ts:150`, `billing/sql/invoices-v2.sql:86`
  - What goes wrong: the first save commits but the response times out. The user edits a line and saves again, and the server returns the earlier invoice as if the edit was saved.
  - Fix: compare the total or a hash of the lines with the stored invoice and return 409 if they differ.

- [x] **M7 Invoice search in Supabase only looks at the newest 500 invoices.** File: `billing/src/store.ts:648-650`
  - Fix: filter in SQL (`ilike`) before the `limit`.

- [ ] **M8 Sign-up has no email verification, and nothing is rate-limited.** Files: `server/src/auth.ts:94-104`, `index.ts:256-308`
  - Anyone can register any email address. Login can be brute-forced. Supabase's limits only see the server's one IP, so one attacker can lock out everyone.
  - Fix: use the normal Supabase sign-up with email confirmation, and add `express-rate-limit` on `/api/auth/*`.

- [x] **M9 Login tokens are stored in plain AsyncStorage (localStorage on web).** File: `mobile/src/lib/session.tsx:29`
  - Fix: use `expo-secure-store` on native.

- [x] **M10 On Android the keyboard may cover form fields and the Save button** (check on a device). File: `mobile/src/components/page.tsx:101`
  - `KeyboardAvoidingView` gets `behavior={undefined}` on Android.
  - Fix: use `behavior="height"` or `react-native-keyboard-controller`.

- [x] **M11 Memory mode is unusable.** Files: `server/src/auth.ts:51`, `index.ts:221`
  - Without the Supabase keys, auth is off and every organisation route returns 503, even though `/health` reports "memory".
  - Fix: add a dev-only local sign-in, or remove memory mode and update the README.

## Low

- [ ] **L1 Re-running `supabase/schema.sql` deletes all data.**
  - It has unconditional `drop table` statements, and the server's error message tells users to run it.
  - Fix: use `create table if not exists`, and move the drops into a separate reset script.
- [ ] **L2 Deleting an admin cascade-deletes all their payroll history.** Files: `supabase/auth.sql:17`, `schema.sql:24`
  - Fix: use `on delete restrict`.
- [ ] **L3 An id that isn't a valid UUID returns 500 instead of 404 (Supabase mode).**
  - Fix: validate route params with `z.string().uuid()`.
- [ ] **L4 Database errors are matched by keyword in the message, so constraint violations say "table missing, run X.sql".** Files: `server/src/index.ts:174-185`, `billing/src/routes.ts:542`
  - Includes creating a second business for the same organisation, which hits a unique index.
  - Fix: branch on the error `code` first.
- [ ] **L5 Attendance can be marked for tomorrow and is counted right away.** File: `server/src/dates.ts:15-20`
- [ ] **L6 Totals above the database column limit (`numeric(12,2)`) give a 500.** Files: `billing/src/routes.ts:14-17`, `gst.ts:200`
  - Amount in words prints "undefined" for ₹1,000 crore and above.
- [ ] **L7 Invalid dates like `2026-02-31` pass validation.** File: `billing/src/routes.ts:34`, `168`
- [ ] **L8 GSTIN validation skips the state code and checksum, so a bad GSTIN can lead to the wrong tax type.** Files: `billing/src/routes.ts:12`, `states.ts:85`
- [ ] **L9 Reprints of old invoices use the current logo, not the one from when the invoice was made.** File: `billing/src/invoice-html.ts:31`
- [ ] **L10 Supabase returns 409/400 on retries where memory mode returns the saved invoice** (`prepareInvoice` runs before the `clientRef` lookup). File: `billing/src/store.ts:677`
- [ ] **L11 The "Saved" stamp on the employee screen never goes away.** File: `mobile/src/app/organisation/[id]/employee/[employeeId]/index.tsx:31-37`
- [ ] **L12 Rupee input is parsed inconsistently.**
  - An empty item price saves ₹0, and "1,200" is rejected: `items.tsx:49`, `invoice/[invoiceId].tsx:112`, `compose.tsx:664`.
  - Fix: use one shared parser.
- [ ] **L13 A forced logout leaves the old account's screens in the back stack.** File: `mobile/src/app/_layout.tsx:53`
- [ ] **L14 The prefilled business address can be longer than the server's 200-character limit.** File: `mobile/src/app/organisation/[id]/billing.tsx:29`
- [ ] **L15 A non-JSON 200 response (wrong host, captive portal) shows a raw `SyntaxError`.** File: `mobile/src/lib/api.ts:72`
- [ ] **L16 A salary with paise is silently rounded on save.** Files: `settings.tsx:51`, `pay-fields.tsx:9`
- [ ] **L17 A storage failure in `server-url.tsx:24` causes an unhandled promise rejection.**
- [ ] **L18 CORS allows every origin, and the API is plain HTTP.**
  - Fine on a LAN for development. Put HTTPS in front of it and restrict origins before real use.
- [ ] **L-lint 10 errors from `expo lint`.**
  - Calling `setState` inside effects: 5.
  - Reading refs during render: 4, in `book.tsx` and `month-calendar.tsx`. The React Compiler skips optimising those components.
  - Unescaped entity: 1.

## Checked and found OK

- Data separation: every `/api/organisations/:id/*` route and every billing route checks ownership, so one admin can't reach another's data.
- Error handling: every async handler has try/catch.
- Client and server agree: every call in the app matches a route, method and payload shape on the server.
- Invoice numbers: duplicate numbers are prevented by a row lock and a unique index.
- Invoice HTML: every user string is escaped.
- GST rules:
  - The choice between CGST/SGST and IGST is correct.
  - The discount comes off before tax.
  - Prices that already include tax are handled correctly.
  - Amount in words (lakh, crore, paise) is correct below ₹1,000 crore.
- Billing calculations: the phone and server share the same code (`engine.ts` re-exports `billing/src`), so the preview and the saved invoice always agree.
- Secrets: `server/.env.local` holds a real Supabase secret key and is gitignored. Keep it that way when you `git init`.
