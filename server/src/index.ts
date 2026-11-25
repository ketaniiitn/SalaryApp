import os from "node:os";

import { app, auth, store } from "./app";

const port = Number(process.env.PORT ?? 4000);

function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

app.listen(port, "0.0.0.0", () => {
  const phones = lanAddresses().map((address) => `http://${address}:${port}`);
  console.log(`Salary API listening (${store.kind})`);
  if (store.kind === "memory") {
    console.log(auth ? "  sign-in: development accounts in memory; they vanish on restart" : "  sign-in: off (NODE_ENV=production without Supabase keys)");
  }
  console.log(`  this computer: http://localhost:${port}`);
  if (phones.length === 0) {
    console.log("  phone: use your computer's LAN address, for example http://192.168.1.10:" + port);
  } else {
    for (const url of phones) console.log(`  phone: ${url}`);
  }
});
