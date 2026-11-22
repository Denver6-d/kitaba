import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createDexieStore, openDb } from "@/repositories/local/db";
import { createDexieOutbox } from "@/repositories/local/outbox";
import { createRepositories } from "@/repositories/create";
import { sameLevels } from "@/domain/model";
import { cursorKey, decideFirstSync, LINKED_KEY } from "@/domain/sync/session";
import { markLinked, markSignedOut, noteGuestWrite, readFirstSyncInput } from "@/features/account/first-sync";

/**
 * "You have progress on this device" (the merge dialog) is asked once: the first
 * time real guest progress meets an account (DECISIONS A9). These run the same
 * reads and writes as AccountProvider, on a real IndexedDB (fake-indexeddb).
 */

let n = 0;
function device() {
  const indexedDB = new IDBFactory();
  const name = `merge-once-${++n}`;
  let db = openDb({ indexedDB, IDBKeyRange }, name);
  let store = createDexieStore(db);
  let outbox = createDexieOutbox(db);
  let repos = createRepositories({ store });
  // Getters: after reload() every handle points at the new connection.
  const dev = {
    get db() {
      return db;
    },
    get store() {
      return store;
    },
    get outbox() {
      return outbox;
    },
    get repos() {
      return repos;
    },
    /** F5 / browser restart: a new connection to the same database. */
    reload() {
      db.close();
      db = openDb({ indexedDB, IDBKeyRange }, name);
      store = createDexieStore(db);
      outbox = createDexieOutbox(db);
      repos = createRepositories({ store });
      return dev;
    },
  };
  return dev;
}

type Dev = ReturnType<typeof device>;
const onLoad = async (d: Pick<Dev, "store" | "outbox">, userId: string) => decideFirstSync(await readFirstSyncInput(d.store, d.outbox, userId));
const playGame = (d: Pick<Dev, "repos">) =>
  d.repos.games.saveSession({ mode: "listen", stageId: null, items: 5, correct: 4, points: 20, maxCombo: 2, seconds: 30, at: 1, missed: [] }, 0);

describe("the reported bug: signed in, 'delete all my data', then every F5 asked", () => {
  it("never asks: deleting progress keeps the device linked to the account", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await d.repos.profile.save({ levels: sameLevels("B1"), levelSource: "placement", levelsAt: 1 });
    expect(await onLoad(d, "u1")).toBe("sync");

    await d.repos.data.clearAll(); // Settings → "Delete all my data", still signed in
    expect(await d.outbox.getMeta(LINKED_KEY)).toBe("u1");
    await playGame(d); // the account's progress is pulled back down

    for (let i = 0; i < 3; i++) expect(await onLoad(d.reload(), "u1")).toBe("sync"); // F5, F5, F5
    d.db.close();
  });

  it("a device already left in that state by the old build recovers without the dialog", async () => {
    const d = device();
    // Old build: the link was wiped, then the engine re-pulled and stored a new pull position.
    await d.outbox.setMeta(cursorKey("u1"), "2026-11-22T10:00:00.000Z");
    await playGame(d);
    expect(await onLoad(d, "u1")).toBe("relink");
    await markLinked(d.outbox, "u1"); // what AccountProvider does for "relink"
    expect(await onLoad(d.reload(), "u1")).toBe("sync");
    d.db.close();
  });

  it("an import that replaces local data keeps the link too", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await playGame(d);
    await d.repos.data.importAll(await d.repos.data.exportAll(), "replace");
    expect(await onLoad(d.reload(), "u1")).toBe("sync");
    d.db.close();
  });
});

describe("a level or the marker alone never ask", () => {
  it("a guest who only took the level test signs in: no dialog", async () => {
    const d = device();
    await d.repos.profile.save({ levels: sameLevels("A2"), levelSource: "skip", levelsAt: 1 });
    expect(await onLoad(d, "u1")).toBe("adopt-remote");
  });
});

describe("real guest progress: asked once, then never again", () => {
  it("merge → reload, restart and later sign-ins never ask", async () => {
    const d = device();
    await playGame(d);
    await noteGuestWrite(d.outbox, "sessions");
    expect(await onLoad(d, "u1")).toBe("ask");

    await markLinked(d.outbox, "u1"); // "Merge"
    expect(await onLoad(d.reload(), "u1")).toBe("sync");
    expect(await onLoad(d.reload(), "u1")).toBe("sync");

    await markSignedOut(d.outbox, true); // sign out, keep progress
    expect(await onLoad(d.reload(), "u1")).toBe("relink"); // same account again: no dialog
    d.db.close();
  });

  it("replace (keep separate) → reload never asks", async () => {
    const d = device();
    await playGame(d);
    expect(await onLoad(d, "u1")).toBe("ask");
    await d.store.clear(); // "Keep separate": local progress replaced by the account's
    await markLinked(d.outbox, "u1");
    await playGame(d); // the account's data arrives
    expect(await onLoad(d.reload(), "u1")).toBe("sync");
    d.db.close();
  });

  it("signed out keeping progress, then played as a guest: asked before mixing that in", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await playGame(d);
    await markSignedOut(d.outbox, true);
    await noteGuestWrite(d.outbox, "sessions"); // a game played while signed out
    expect(await onLoad(d.reload(), "u1")).toBe("ask");
    d.db.close();
  });

  it("a level change while signed out is not guest progress", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await playGame(d);
    await markSignedOut(d.outbox, true);
    await noteGuestWrite(d.outbox, "profile");
    expect(await onLoad(d.reload(), "u1")).toBe("relink");
    d.db.close();
  });

  it("writes while linked are never guest progress", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await noteGuestWrite(d.outbox, "sessions");
    await markSignedOut(d.outbox, true);
    await playGame(d);
    expect(await onLoad(d, "u1")).toBe("relink");
    d.db.close();
  });
});

describe("sign-out with 'delete my progress', and other accounts", () => {
  it("sign out deleting progress → sign in again: nothing to ask, the account's data is adopted", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await playGame(d);
    await markSignedOut(d.outbox, false);
    await d.store.clear();
    expect(await onLoad(d.reload(), "u1")).toBe("adopt-remote");
    d.db.close();
  });

  it("another account's progress on this device is never mixed in silently", async () => {
    const d = device();
    await markLinked(d.outbox, "u1");
    await playGame(d);
    await markSignedOut(d.outbox, true);
    expect(await onLoad(d.reload(), "u2")).toBe("ask");
    d.db.close();
  });
});
