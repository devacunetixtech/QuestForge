import { readFile, writeFile } from "node:fs/promises";

const address = process.argv[2];
if (!/^0x[a-fA-F0-9]{40}$/.test(address ?? "")) {
  throw new Error("A valid deployed contract address is required.");
}

const target = new URL("../lib/deployment.ts", import.meta.url);
const current = await readFile(target, "utf8");
const next = current.replace(
  /export const QUESTFORGE_TESTNET_ADDRESS = .*;/,
  `export const QUESTFORGE_TESTNET_ADDRESS = "${address}" as const;`,
);

if (current === next) throw new Error("Could not update the deployment address.");
await writeFile(target, next);
