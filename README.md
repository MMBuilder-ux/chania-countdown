# Chania Countdown

A private, password-protected trip guide. One static page, hosted on GitHub
Pages. No server, no accounts, no build tools beyond Node.

## How the protection works

The readable app lives in `src/app.html`, which is **git-ignored** and never
leaves this Mac. `build.mjs` encrypts it into `index.html`, which is the only
page that is committed and published.

- **Key derivation:** PBKDF2-SHA256, 600,000 iterations, random 16-byte salt.
- **Encryption:** AES-GCM, 256-bit key, random 12-byte IV.
- A fresh salt and IV are generated on every build.
- The published `index.html` holds only the login screen and the ciphertext.
  Without the password, the trip details cannot be read, even in the source.
- "Remember on this phone" stores the derived key in that browser's
  `localStorage`. A new build changes the salt, which forgets every remembered
  key, so everyone must type the password again. "Lock this phone" on the
  Tickets tab forgets it on demand.

The page needs `https` (or `localhost`), because browsers only allow the Web
Crypto API on secure pages. GitHub Pages serves `https`.

## Build

```bash
node build.mjs
```

The password comes from `TRIP_PASSWORD`, or the first line of `.trip-password`
(git-ignored). The script checks that the output decrypts before it writes it.

To change the password: put the new one in `.trip-password`, run the build,
commit `index.html`, push.

## Files

| File | Committed | What it is |
| --- | --- | --- |
| `index.html` | yes | Encrypted page. This is what GitHub Pages serves. |
| `gate.template.html` | yes | The login screen, with a placeholder for the ciphertext. |
| `build.mjs` | yes | Encrypts `src/app.html` into `index.html`. |
| `src/app.html` | **no** | The readable app. Stays on this Mac. |
| `.trip-password` | **no** | The password. Stays on this Mac. |

## Photographs

Stock photographs from [Unsplash](https://unsplash.com), used under the
Unsplash Licence and credited on screen. They load from `images.unsplash.com`.
