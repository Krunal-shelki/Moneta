# Moneta

A private, offline-first money manager. No accounts, no cloud, no tracking.

## What it does

- **Multi-currency accounts** — cash, bank, wallet and investment accounts, each in its own currency.
- **Manual or fetched exchange rates** — rates are stored by you. A **Fetch live rates** button optionally refreshes them from [open.er-api.com](https://www.exchangerate-api.com) (free, no key); nothing is fetched unless you press it.
- **Activity** — expenses, income and transfers with categories, notes, filters and search.
- **Borrow & lend** — track money you lent or borrowed, record repayments and see what is still outstanding.
- **Credit cards** — balances, limits, utilisation, due dates, minimum payments, card spending and payments from any account.
- **Appearance** — light, dark, or follow your system preference.
- **SQLite ledger file** — optionally keep the whole ledger in a real `.sqlite` database on your device. Pick the file once; Moneta remembers it and reopens it in later sessions.
- **Local backup** — export/import a JSON backup, download a copy of the SQLite file, or export transactions as CSV.
- **Offline/PWA** — installable app with a service worker that caches the shell, the SQLite engine, icons and manifest so it launches without a connection.

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.

There is no build step, no package manager, no install and no configuration.

## Install it as an app

Moneta is a PWA, so it can be installed like a native app and launched in its own window.

1. Serve it over HTTP (or HTTPS) as shown above — installation needs a secure context (`localhost` counts).
2. Open **Settings → Install app**.
3. Chrome/Edge: press **Install app** (or use the browser menu → *Install*). Safari on iOS: **Share → Add to Home Screen**. Firefox: **Install** from the address bar.
4. The installed app opens offline, has its own icon and respects your light/dark preference.

Once loaded, `sw.js` caches the shell (`index.html`, scripts, styles, icons, manifest and the SQLite engine in `vendor/`) so it starts without a network. New versions are fetched in the background and applied on the next load.

## Deploy on GitHub Pages

Yes — Moneta is a static site with no build step, so GitHub Pages can host it as-is.

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`. Save.
4. Open `https://<your-user>.github.io/<repo>/`.

Everything uses relative paths (including the manifest, icons and service-worker scope), so the app also works from a subfolder such as `/moneta/`. The `.nojekyll` file stops Jekyll from processing the folder. Navigation uses `#` routes, so there are no 404s on refresh.

Because GitHub Pages serves over HTTPS, the PWA is installable and the service worker works. After changing app files, bump `CACHE_NAME` in `sw.js` (for example `moneta-static-v16`) so installed copies replace their cached assets.

## Where the data lives

Moneta writes every change to two local places:

1. **A SQLite file you choose** (primary, when connected) — on first launch Moneta asks whether to create a ledger file. If you accept, the browser's save dialog lets you choose the name and folder (`moneta-ledger.sqlite` is suggested). After that, every change is written to that file automatically.
2. **`localStorage`** (`moneta.ledger.v1`) — a synchronous mirror and fallback. It is also what the app uses when no file is connected.

The file handle itself is remembered in IndexedDB (`moneta.ledger.files`) so later sessions can reopen the same file without asking you to pick it again. Browsers may still require a single **Reconnect file** click after a restart to re-grant access — the card in **Settings → Data & backup** shows whether the file is connected, needs permission, or has a problem. Choosing **Use browser storage** is remembered too, and you can create or open a file later from Settings.

Nothing is uploaded. The app only makes a network request when you explicitly press **Fetch live rates** in Settings; only currency codes are sent, never your ledger.

### Browser support

Writing to a chosen file uses the File System Access API, which currently means **Chrome or Edge on desktop** (and Chromium-based browsers). In other browsers — Safari, Firefox, mobile browsers — Moneta keeps the ledger in browser storage and shows that in Settings. The core app, backups and PWA install still work there.

The feature also needs a secure context (`https://` or `localhost`) and the page must be served over HTTP(S), not opened as a `file://` URL.

### What is inside the file

The file is an ordinary SQLite database, so you can inspect it with any SQLite tool:

```sql
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

The single `ledger` row stores the complete app state as JSON (settings, currencies, accounts, transactions, debts). `meta` records `app = moneta` and `schema_version = 1`.

### Backups and moving devices

- **Settings → Export backup** still produces the same portable JSON of the ledger.
- **Download copy** on the ledger card writes the current database bytes to a `.sqlite` file — useful for keeping a snapshot or moving to another browser.
- Clearing browser/site data removes Moneta's mirror and the remembered handle, but **does not delete the file you chose**. Create or open a file again from **Settings → Data & backup**.
- Moving or deleting the file breaks the connection; Moneta will show a file error and offer to reconnect or open another file.
- Avoid editing the file with another app while Moneta has it open, and avoid using the same file in two tabs at once — the last write wins.

### Credits

SQLite support is provided by [sql.js](https://github.com/sql-js/sql.js) 1.13.0, vendored in `vendor/` (MIT licence, included as `vendor/sql.js-LICENSE`). The WASM engine is cached by the service worker, so it works offline too.

## Notes

The built-in currency rates are approximate starting points and are not live. Edit them by hand in **Settings → Currencies & rates**, or press **Fetch live rates** to update every currency already in your ledger from open.er-api.com. Fetching is always manual and never happens on load. Changing the base currency recalculates the rates to preserve the relative value of existing balances.

For card payments, use **Pay card** on the card or log a transfer from an account to the card. Purchases on a card should be entered as expenses against the card account. Both update the card balance and net worth automatically.
