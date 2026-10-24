/* =========================================================
   Moneta — SQLite ledger file
   Stores the ledger in a real SQLite database on the user's
   device. The file is chosen once through the File System
   Access API and remembered in IndexedDB for later sessions.
   ========================================================= */

const MONETA_FILE_IDB = "moneta.ledger.files";
const MONETA_FILE_STORE = "handles";
const MONETA_FILE_KEY = "ledger";
const MONETA_FILE_PROMPT_KEY = "moneta.filePromptDismissed";
const MONETA_FILE_SCHEMA = 1;
const MONETA_FILE_SUGGESTED = "moneta-ledger.sqlite";

let monetaSql = null;
let monetaFileDb = null;
let monetaFileHandle = null;
let monetaFileStatus = {
  mode: "browser",
  name: "",
  lastSavedAt: "",
  size: 0,
  error: ""
};
let monetaFileListeners = new Set();
let monetaFileSaveTimer = 0;
let monetaFileSaveChain = Promise.resolve();
let monetaFilePendingJson = null;

/* ---------------------------------------------------------
   Status and subscriptions
   --------------------------------------------------------- */

function ledgerFileSupported() {
  return (
    typeof window.showSaveFilePicker === "function" &&
    typeof window.showOpenFilePicker === "function" &&
    typeof window.indexedDB !== "undefined"
  );
}

function getLedgerFileStatus() {
  return { ...monetaFileStatus };
}

function onLedgerFileChange(listener) {
  if (typeof listener !== "function") return () => {};
  monetaFileListeners.add(listener);
  return () => monetaFileListeners.delete(listener);
}

function notifyLedgerFileChange(detail = {}) {
  const snapshot = getLedgerFileStatus();
  monetaFileListeners.forEach((listener) => {
    try {
      listener(snapshot, detail);
    } catch (error) {
      console.warn("Moneta ledger file listener failed:", error);
    }
  });
}

function setLedgerFileStatus(patch) {
  monetaFileStatus = { ...monetaFileStatus, ...patch };
}

function ledgerFilePromptDismissed() {
  try {
    return window.localStorage.getItem(MONETA_FILE_PROMPT_KEY) === "1";
  } catch (error) {
    return true;
  }
}

function dismissLedgerFilePrompt() {
  try {
    window.localStorage.setItem(MONETA_FILE_PROMPT_KEY, "1");
  } catch (error) {
    /* Browser storage unavailable; the prompt will simply not persist. */
  }
  if (monetaFileStatus.mode === "first-run") {
    setLedgerFileStatus({ mode: ledgerFileSupported() ? "browser" : "unsupported" });
    notifyLedgerFileChange();
  }
}

/* ---------------------------------------------------------
   Remembering the handle in IndexedDB
   --------------------------------------------------------- */

function openHandleStore() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(MONETA_FILE_IDB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MONETA_FILE_STORE)) {
        db.createObjectStore(MONETA_FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the file handle store."));
  });
}

async function withHandleStore(mode, action) {
  const db = await openHandleStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MONETA_FILE_STORE, mode);
      const store = tx.objectStore(MONETA_FILE_STORE);
      let result;
      const request = action(store);
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error || new Error("File handle operation failed."));
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error("File handle transaction aborted."));
    });
  } finally {
    db.close();
  }
}

function rememberLedgerFileHandle(handle) {
  return withHandleStore("readwrite", (store) => store.put(handle, MONETA_FILE_KEY));
}

function recallLedgerFileHandle() {
  return withHandleStore("readonly", (store) => store.get(MONETA_FILE_KEY));
}

function forgetLedgerFileHandle() {
  return withHandleStore("readwrite", (store) => store.delete(MONETA_FILE_KEY));
}

/* ---------------------------------------------------------
   Permissions
   --------------------------------------------------------- */

async function ledgerHandleAllowed(handle, ask) {
  if (!handle) return false;
  if (typeof handle.queryPermission !== "function") return true;
  const options = { mode: "readwrite" };
  try {
    if (ask && typeof handle.requestPermission === "function") {
      return (await handle.requestPermission(options)) === "granted";
    }
    return (await handle.queryPermission(options)) === "granted";
  } catch (error) {
    return false;
  }
}

/* ---------------------------------------------------------
   SQLite engine
   --------------------------------------------------------- */

async function sqliteEngine() {
  if (monetaSql) return monetaSql;
  if (typeof initSqlJs !== "function") {
    throw new Error("The SQLite engine did not load.");
  }
  monetaSql = await initSqlJs({
    locateFile: (file) => new URL(`vendor/${file}`, document.baseURI).href
  });
  return monetaSql;
}

async function createLedgerDatabase(bytes) {
  const SQL = await sqliteEngine();
  let db;
  try {
    db = bytes && bytes.byteLength ? new SQL.Database(bytes) : new SQL.Database();
    db.run(
      "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    );
    db.run(
      "CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)"
    );
  } catch (error) {
    try {
      if (db) db.close();
    } catch (closeError) {
      /* Nothing to close. */
    }
    throw new Error("That file is not a readable SQLite database.");
  }
  return db;
}

function readLedgerDatabase(db) {
  try {
    const statement = db.prepare("SELECT data FROM ledger WHERE id = 1");
    try {
      if (!statement.step()) return null;
      const row = statement.getAsObject();
      return typeof row.data === "string" ? row.data : null;
    } finally {
      statement.free();
    }
  } catch (error) {
    return null;
  }
}

function writeLedgerDatabase(db, json) {
  db.run(
    "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)"
  );
  db.run("BEGIN");
  try {
    db.run(
      "INSERT INTO ledger (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
      [json, new Date().toISOString()]
    );
    db.run(
      "INSERT INTO meta (key, value) VALUES ('app', 'moneta') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    db.run(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(MONETA_FILE_SCHEMA)]
    );
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      /* The transaction is already gone. */
    }
    throw error;
  }
}

async function writeDatabaseToHandle(handle, db) {
  const bytes = db.export();
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch (abortError) {
      /* Nothing else to do. */
    }
    throw error;
  }
  return bytes.byteLength;
}

/* ---------------------------------------------------------
   Attaching a file
   --------------------------------------------------------- */

async function attachLedgerFileHandle(handle, options = {}) {
  const initializeFromState = Boolean(options.initializeFromState);
  const payload = options.payload || JSON.stringify(state);

  if (!handle) throw new Error("No file was selected.");

  /* Finish any write to the current file before switching databases. */
  try {
    await flushLedgerFile();
  } catch (error) {
    /* A failed write is reported by the save path; the switch can continue. */
  }
  await monetaFileSaveChain.catch(() => {});

  let file = null;
  let bytes = new Uint8Array();
  try {
    file = await handle.getFile();
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    /* A file chosen through the save picker may not exist until it is written. */
    if (!initializeFromState) throw error;
  }

  const db = await createLedgerDatabase(bytes);
  let stored = readLedgerDatabase(db);

  if (initializeFromState) {
    writeLedgerDatabase(db, payload);
    const size = await writeDatabaseToHandle(handle, db);
    setLedgerFileStatus({
      mode: "file",
      name: handle.name || MONETA_FILE_SUGGESTED,
      lastSavedAt: new Date().toISOString(),
      size,
      error: ""
    });
    stored = payload;
  } else {
    if (!stored) {
      db.close();
      throw new Error("That SQLite file does not contain a Moneta ledger.");
    }
    setLedgerFileStatus({
      mode: "file",
      name: handle.name || MONETA_FILE_SUGGESTED,
      lastSavedAt: new Date(file && file.lastModified ? file.lastModified : Date.now()).toISOString(),
      size: file ? file.size : 0,
      error: ""
    });
  }

  if (monetaFileDb && monetaFileDb !== db) {
    try {
      monetaFileDb.close();
    } catch (error) {
      /* Already closed. */
    }
  }

  monetaFileDb = db;
  monetaFileHandle = handle;

  try {
    await rememberLedgerFileHandle(handle);
  } catch (error) {
    console.warn("Moneta could not remember the file handle:", error);
  }

  return {
    stored,
    initialized: initializeFromState,
    name: handle.name || MONETA_FILE_SUGGESTED
  };
}

/* ---------------------------------------------------------
   Create, open, reconnect, disconnect
   --------------------------------------------------------- */

async function createLedgerFile() {
  if (!ledgerFileSupported()) {
    throw new Error("This browser cannot create local database files.");
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: MONETA_FILE_SUGGESTED,
    types: [
      {
        description: "SQLite database",
        accept: { "application/vnd.sqlite3": [".sqlite", ".sqlite3", ".db"] }
      }
    ]
  });
  const result = await attachLedgerFileHandle(handle, { initializeFromState: true });
  dismissLedgerFilePrompt();
  notifyLedgerFileChange({ created: true, name: result.name });
  return result;
}

async function openLedgerFile() {
  if (!ledgerFileSupported()) {
    throw new Error("This browser cannot open local database files.");
  }
  const handles = await window.showOpenFilePicker({ multiple: false });
  const handle = handles && handles[0];
  if (!handle) return null;
  const allowed = await ledgerHandleAllowed(handle, true);
  if (!allowed) {
    throw new Error("Permission to edit that ledger file was not granted.");
  }
  const result = await attachLedgerFileHandle(handle, { initializeFromState: false });
  notifyLedgerFileChange({ loadedJson: result.stored, reason: "opened" });
  return result;
}

async function reconnectLedgerFile() {
  const handle = monetaFileHandle || (await recallLedgerFileHandle());
  if (!handle) throw new Error("No ledger file is remembered on this device.");
  const allowed = await ledgerHandleAllowed(handle, true);
  if (!allowed) throw new Error("Permission to open the ledger file was not granted.");
  const result = await attachLedgerFileHandle(handle, { initializeFromState: false });
  notifyLedgerFileChange({ loadedJson: result.stored, reason: "restored" });
  return result;
}

async function disconnectLedgerFile() {
  window.clearTimeout(monetaFileSaveTimer);
  monetaFilePendingJson = null;
  await monetaFileSaveChain.catch(() => {});
  if (monetaFileDb) {
    try {
      monetaFileDb.close();
    } catch (error) {
      /* Already closed. */
    }
  }
  monetaFileDb = null;
  monetaFileHandle = null;
  try {
    await forgetLedgerFileHandle();
  } catch (error) {
    /* The handle may not have been stored. */
  }
  setLedgerFileStatus({
    mode: ledgerFileSupported() ? "browser" : "unsupported",
    name: "",
    lastSavedAt: "",
    size: 0,
    error: ""
  });
  notifyLedgerFileChange({ disconnected: true });
}

/* ---------------------------------------------------------
   Saving
   --------------------------------------------------------- */

function scheduleLedgerFileSave(currentState) {
  if (!monetaFileDb || monetaFileStatus.mode !== "file") return;
  monetaFilePendingJson = JSON.stringify(currentState);
  window.clearTimeout(monetaFileSaveTimer);
  monetaFileSaveTimer = window.setTimeout(() => {
    flushLedgerFile();
  }, 350);
}

async function flushLedgerFile() {
  window.clearTimeout(monetaFileSaveTimer);
  if (!monetaFileDb || monetaFileStatus.mode !== "file") return;

  const json = monetaFilePendingJson;
  if (!json) return;
  monetaFilePendingJson = null;

  const db = monetaFileDb;
  const handle = monetaFileHandle;

  monetaFileSaveChain = monetaFileSaveChain.then(async () => {
    try {
      const hadError = Boolean(monetaFileStatus.error);
      writeLedgerDatabase(db, json);
      const size = await writeDatabaseToHandle(handle, db);
      setLedgerFileStatus({
        mode: "file",
        lastSavedAt: new Date().toISOString(),
        size,
        error: ""
      });
      const time = new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(monetaFileStatus.lastSavedAt));
      document.querySelectorAll("[data-ledger-saved]").forEach((node) => {
        node.textContent = `saved ${time}`;
      });
      if (hadError) notifyLedgerFileChange();
    } catch (error) {
      console.warn("Moneta could not write the ledger file:", error);
      setLedgerFileStatus({
        error: error.message || "Could not write to the ledger file."
      });
      notifyLedgerFileChange({ writeFailed: true });
      showToast("Could not save to the ledger file.", "error");
    }
  }).catch((error) => {
    console.warn("Moneta ledger file queue failed:", error);
  });

  return monetaFileSaveChain;
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */

function describeLedgerFileError(error) {
  if (!error) return "Could not open the ledger file.";
  if (error.name === "NotFoundError") {
    return "The ledger file could not be found. It may have been moved, renamed or deleted.";
  }
  if (error.name === "NotAllowedError") {
    return "Permission to open the ledger file was not granted.";
  }
  return error.message || "Could not open the ledger file.";
}

async function initLedgerFile() {
  if (!ledgerFileSupported()) {
    setLedgerFileStatus({ mode: "unsupported" });
    notifyLedgerFileChange();
    return getLedgerFileStatus();
  }

  let handle = null;
  try {
    handle = await recallLedgerFileHandle();
  } catch (error) {
    console.warn("Moneta could not read the saved file handle:", error);
  }

  if (!handle) {
    setLedgerFileStatus({ mode: ledgerFilePromptDismissed() ? "browser" : "first-run" });
    notifyLedgerFileChange();
    return getLedgerFileStatus();
  }

  monetaFileHandle = handle;
  const allowed = await ledgerHandleAllowed(handle, false);
  if (!allowed) {
    setLedgerFileStatus({
      mode: "reconnect",
      name: handle.name || MONETA_FILE_SUGGESTED
    });
    notifyLedgerFileChange();
    return getLedgerFileStatus();
  }

  try {
    const result = await attachLedgerFileHandle(handle, { initializeFromState: false });
    if (result.stored) {
      notifyLedgerFileChange({ loadedJson: result.stored, reason: "restored" });
    } else {
      notifyLedgerFileChange();
    }
  } catch (error) {
    setLedgerFileStatus({
      mode: "error",
      name: handle.name || MONETA_FILE_SUGGESTED,
      error: describeLedgerFileError(error)
    });
    notifyLedgerFileChange();
  }

  return getLedgerFileStatus();
}

function exportLedgerFileBytes() {
  return monetaFileDb ? monetaFileDb.export() : null;
}

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushLedgerFile();
});

window.addEventListener("pagehide", () => {
  flushLedgerFile();
});

window.MonetaFileStorage = {
  available: ledgerFileSupported,
  init: initLedgerFile,
  create: createLedgerFile,
  open: openLedgerFile,
  reconnect: reconnectLedgerFile,
  disconnect: disconnectLedgerFile,
  scheduleSave: scheduleLedgerFileSave,
  flush: flushLedgerFile,
  getStatus: getLedgerFileStatus,
  onChange: onLedgerFileChange,
  dismissPrompt: dismissLedgerFilePrompt,
  downloadCopy: exportLedgerFileBytes
};
