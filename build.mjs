// Encrypts src/app.html into index.html behind a password gate.
//
//   node build.mjs
//
// The password comes from the TRIP_PASSWORD environment variable, or from the
// first line of .trip-password. Both src/ and .trip-password are git-ignored:
// only the encrypted index.html is ever committed.
//
// Crypto: PBKDF2-SHA256 (600,000 iterations, random 16-byte salt) derives a
// 256-bit key; AES-GCM with a random 12-byte IV encrypts the page. A fresh salt
// and IV are used on every build, so a rebuild also invalidates any
// "remember on this phone" keys saved by the old build.

import { readFile, writeFile } from "node:fs/promises";
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 600_000;
const here = new URL(".", import.meta.url);

const b64 = (buf) => Buffer.from(buf).toString("base64");

async function readPassword() {
  if (process.env.TRIP_PASSWORD) return process.env.TRIP_PASSWORD.trim();
  try {
    return (await readFile(new URL(".trip-password", here), "utf8")).split("\n")[0].trim();
  } catch {
    throw new Error("No password. Set TRIP_PASSWORD or create .trip-password.");
  }
}

async function deriveKey(password, salt, usage) {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, base, 256);
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, [usage]);
}

const password = await readPassword();
if (password.length < 12) throw new Error("Password must be at least 12 characters.");

const app = await readFile(new URL("src/app.html", here), "utf8");
const gate = await readFile(new URL("gate.template.html", here), "utf8");
if (!gate.includes('"__PAYLOAD__"')) throw new Error("gate.template.html has no payload marker.");

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const key = await deriveKey(password, salt, "encrypt");
const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(app));

const payload = { v: 1, n: ITERATIONS, s: b64(salt), i: b64(iv), c: b64(ct) };
const out = gate.replace('"__PAYLOAD__"', JSON.stringify(payload));

// Round-trip check before writing anything.
const check = await deriveKey(password, salt, "decrypt");
const back = new TextDecoder().decode(
  await crypto.subtle.decrypt({ name: "AES-GCM", iv }, check, ct));
if (back !== app) throw new Error("Round-trip check failed. index.html not written.");

await writeFile(new URL("index.html", here), out);
console.log(`index.html written: ${out.length.toLocaleString()} bytes, ` +
  `${ITERATIONS.toLocaleString()} PBKDF2 iterations, round-trip OK.`);
