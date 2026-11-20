# Keyflow — typing test

A static typing-practice website. You can improve your typing speed and accuracy, and learn short school topics while you type.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Home page |
| `Free Style.html` | 60-second test with 300 random words (`Free Style Function.js` generates the words) |
| `Practice.html` + `Typing Test Practicepage1–20.html` | 20 timed practice paragraphs with a sidebar (`Practice Sidebar Function.js`) |
| `Learn While Typing.html` + `lesson-*.html` | 26 short lessons; the timer counts up instead of down |
| About / Contact / Privacy Policy / Terms of Use | Info pages |

## Scripts

- `Typing Test Function.js`: countdown test used by Free Style and the practice pages. Set the length with `data-duration` on `<body>` (default 60 s).
- `Lesson Typing Function.js`: count-up test used by the lesson pages.
- `Theme Function.js`: light/dark toggle, saved in `localStorage`.

The text to type is read from the `data-text` attribute on `<body>`.

## How results are calculated

- **WPM** = (correct characters ÷ 5) ÷ minutes elapsed. It is hidden for the first 2 seconds to avoid a spike.
- **Accuracy** = correct keystrokes ÷ total character keystrokes. A mistake still counts after you correct it. Backspace does not count against you.
- Pasting and drag-and-drop into the input are blocked.

## IGNs, PRs and the leaderboard

Players can save results without an account:

1. After a test, the **Save your PR** panel (`PR Function.js`) asks for an IGN (3–16 letters, numbers or `_`).
2. The server gives back a public `#tag` (so names can repeat, e.g. `Micro_Angel#4821`) and a secret key (`KF-XXXX-XXXX-XXXX-XXXX-XXXX`).
3. The player downloads the key as a `.txt` file. The browser also remembers it, so later results save automatically.
4. `leaderboard.html` has three tabs, all requiring at least 85% accuracy:
   - **Free Style**: best 60-second result.
   - **Practice**: **Overall** (average of a player's best WPM across the paragraphs they've completed, minimum 5) or any single paragraph from the menu.
   - **Learn**: the same, for lessons.

   Links can open a board directly: `leaderboard.html#practice`, `#learn`, `#practice-7`, `#lesson-maps`. The page also has the **My stats** card (download stats or the key) and **Restore my IGN** (paste the key or upload the key file).

| File | Role |
| --- | --- |
| `Player Function.js` | Saved player, API calls, key/stats file downloads |
| `PR Function.js` | Save-your-PR panel on every test page (reads `data-test-id` on `<body>`) |
| `Leaderboard Function.js` | Leaderboard table, My stats, restore |
| `netlify/functions/scores.mjs` | Netlify Function serving `/api/register`, `/api/score`, `/api/me`, `/api/leaderboard` |
| `netlify/lib/keyflow-api.mjs` | The API logic (validation, anti-cheat checks, storage) |

Data is stored in **Netlify Blobs** (store name `keyflow`). The server stores only a SHA-256 hash of each secret key. It works out WPM itself from correct characters and time. It rejects impossible results (over 250 WPM, wrong test length, unknown tests) and limits how often results and new IGNs can be sent.

## Running locally

The static pages work without any setup: open `index.html`, or run `npx serve .`. Saving PRs and the leaderboard need the API, so run the site with the Netlify CLI:

```
npm install
npx netlify-cli dev
```

## Deploying

Deploy from Git (or with `netlify deploy`), not by drag-and-drop, so Netlify builds the function. `netlify.toml` sets Node 22, which `@netlify/blobs` requires.

## Desktop app (Windows)

The `desktop/` folder wraps the site in an Electron app. It loads the same HTML/CSS/JS files from the project root, so changes to the website are included the next time you build. It has its own `package.json`, so it doesn't affect the Netlify build.

1. Set `API_BASE` in `desktop/config.js` to your live Netlify address. The app forwards every `/api/...` request there, so Save-your-PR, the leaderboard and Restore my IGN work. If it's empty, the tests still work but saving is turned off.
2. Install and run:

   ```
   cd desktop
   npm install
   node node_modules/electron/install.js   # only if npm skipped Electron's download
   npm start                               # run the app
   npm run dist                            # build desktop/dist/Keyflow Setup <version>.exe
   ```

- `npm run icon` remakes `desktop/build/icon.png` from `favicon.svg`.
- AdSense scripts are blocked in the app, because AdSense doesn't allow ads inside desktop apps.
- The installer isn't code-signed, so Windows SmartScreen shows a warning the first time it runs ("More info" → "Run anyway").
