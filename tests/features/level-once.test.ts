import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDexieStore, openDb } from "@/repositories/local/db";
import { createRepositories } from "@/repositories/create";
import { createMemoryStore } from "@/repositories/store";
import { DEFAULT_PROFILE, sameLevels, type ProfileRecord } from "@/domain/model";
import { reconcilePulled } from "@/domain/sync/session";
import { forgetLevels, hasLevelsMarker, levelCheck, rememberLevels, welcomeIntent, welcomeUrlWithoutIntent, type LevelCheckInput } from "@/lib/first-visit";

/**
 * The level screen is shown once (DECISIONS L2): never again after a reload,
 * a browser restart, a sign-out and sign-in, or on another device of the same
 * account; never for a learner who already has progress.
 */

const guest: LevelCheckInput = { levelSource: null, hasProgress: false, deviceMarker: false, accountReady: true, signedIn: false, syncStatus: null, timedOut: false };
const signedIn: LevelCheckInput = { ...guest, signedIn: true };

async function readCheck(repos: ReturnType<typeof createRepositories>, rest: Partial<LevelCheckInput> = {}) {
  const p = await repos.profile.get();
  const hasProgress = p.levelSource === null ? await repos.data.hasProgress() : false;
  return levelCheck({ ...guest, levelSource: p.levelSource, hasProgress, ...rest });
}

describe("F5 reload and browser restart (IndexedDB)", () => {
  it("a placement result saved before the reload is read back after it, and the test is not shown", async () => {
    const indexedDB = new IDBFactory();
    const name = "level-once-f5";
    const before = openDb({ indexedDB, IDBKeyRange }, name);
    const repos1 = createRepositories({ store: createDexieStore(before) });
    expect(await readCheck(repos1)).toBe("unknown"); // first visit: asked once
    await repos1.profile.save({ levels: sameLevels("B1"), levelSource: "placement", levelsAt: 1 });
    before.close(); // the page goes away (F5, tab or PWA closed)

    const after = openDb({ indexedDB, IDBKeyRange }, name);
    const repos2 = createRepositories({ store: createDexieStore(after) });
    expect((await repos2.profile.get()).levelSource).toBe("placement");
    expect(await readCheck(repos2)).toBe("known");
    // Signed in: the stored level decides at once, without waiting for the sync.
    expect(await readCheck(repos2, { signedIn: true, syncStatus: "syncing" })).toBe("known");
    after.close();
  });

  it("a skip is remembered the same way", async () => {
    const repos = createRepositories({ store: createMemoryStore() });
    await repos.profile.save({ levels: sameLevels("A2"), levelSource: "skip", levelsAt: 1 });
    expect(await readCheck(repos)).toBe("known");
  });

  it("nothing is decided before local data is read (no flash of the test on load)", () => {
    expect(levelCheck({ ...guest, levelSource: undefined })).toBe("wait");
    expect(levelCheck({ ...signedIn, levelSource: undefined, syncStatus: "synced" })).toBe("wait");
  });
});

describe("learners who already have progress (old accounts without the level flag)", () => {
  it("are never sent to the test", async () => {
    const repos = createRepositories({ store: createMemoryStore() });
    expect(await repos.data.hasProgress()).toBe(false);
    await repos.games.saveSession({ mode: "listen", stageId: null, items: 10, correct: 8, points: 50, maxCombo: 3, seconds: 60, at: 1, missed: [] }, 0);
    expect(await repos.data.hasProgress()).toBe(true);
    expect(await readCheck(repos)).toBe("known");
    expect(await readCheck(repos, { signedIn: true, syncStatus: "synced" })).toBe("known");
  });

  it("deleted rows and settings alone are not progress", async () => {
    const store = createMemoryStore();
    const repos = createRepositories({ store });
    await store.put("srs", { id: "w-a", wordId: "w-a", ease: 2.5, interval: 1, reps: 0, lapses: 1, due: 1, lastReviewed: 1, updatedAt: 2, deletedAt: 2 });
    await repos.profile.save({ dailyGoalMinutes: 20 });
    await repos.dictionary.add("kitaba");
    expect(await repos.data.hasProgress()).toBe(false);
  });
});

/** A browser's localStorage for the device marker (the tests run in Node). */
function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("guests and deleting progress from the device", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: fakeLocalStorage(), configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("are asked once per device while its progress is kept", () => {
    expect(levelCheck(guest)).toBe("unknown");
    rememberLevels();
    expect(levelCheck({ ...guest, deviceMarker: hasLevelsMarker() })).toBe("known");
  });

  // Mirrors "delete all my data" (Settings) and sign-out with "delete my progress" (account-provider):
  // forgetLevels() first, then the store is cleared.
  async function deleteFromDevice(store: ReturnType<typeof createMemoryStore>) {
    forgetLevels();
    await store.clear();
  }

  it("delete → the device is fresh, and the test is offered again", async () => {
    const store = createMemoryStore();
    const repos = createRepositories({ store });
    await repos.profile.save({ levels: sameLevels("B1"), levelSource: "placement", levelsAt: 1 });
    await repos.games.saveSession({ mode: "listen", stageId: null, items: 5, correct: 5, points: 20, maxCombo: 5, seconds: 30, at: 1, missed: [] }, 0);
    rememberLevels();
    expect(await readCheck(repos, { deviceMarker: hasLevelsMarker() })).toBe("known");

    await deleteFromDevice(store);
    expect(hasLevelsMarker()).toBe(false);
    expect(await readCheck(repos, { deviceMarker: hasLevelsMarker() })).toBe("unknown");
  });

  it("delete → sign in → no test: the gate waits for the pull and uses the account's level", async () => {
    const store = createMemoryStore();
    const repos = createRepositories({ store });
    await repos.profile.save({ levels: sameLevels("B2"), levelSource: "placement", levelsAt: 7 });
    const inAccount = await repos.profile.get(); // already synced to the account
    rememberLevels();

    await deleteFromDevice(store);
    const fresh = { deviceMarker: hasLevelsMarker() };
    // "Already have an account? Sign in" on /welcome: signed in, first pull running.
    expect(await readCheck(repos, { ...fresh, signedIn: true, syncStatus: null })).toBe("wait");
    expect(await readCheck(repos, { ...fresh, signedIn: true, syncStatus: "syncing" })).toBe("wait");

    const pulled = reconcilePulled("profile", await store.get("profile", "me"), inAccount);
    if (pulled.toLocal) await store.put("profile", pulled.toLocal);
    expect(await readCheck(repos, { ...fresh, signedIn: true, syncStatus: "synced" })).toBe("known");
    expect((await repos.profile.get()).levels).toEqual(sameLevels("B2"));
  });

  it("storage blocked: forgetting and reading the marker never throw", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      },
      configurable: true,
    });
    expect(() => forgetLevels()).not.toThrow();
    expect(hasLevelsMarker()).toBe(false);
  });
});

describe("signed-in learners", () => {
  it("on a new device: wait for the first pull, then use what it brought", () => {
    expect(levelCheck({ ...signedIn, accountReady: false })).toBe("wait");
    expect(levelCheck({ ...signedIn, syncStatus: null })).toBe("wait");
    expect(levelCheck({ ...signedIn, syncStatus: "idle" })).toBe("wait");
    expect(levelCheck({ ...signedIn, syncStatus: "syncing" })).toBe("wait");
    expect(levelCheck({ ...signedIn, syncStatus: "synced", levelSource: "placement" })).toBe("known");
    // The account really has no level and no progress: asked once.
    expect(levelCheck({ ...signedIn, syncStatus: "synced" })).toBe("unknown");
  });

  it("are never forced into the test when the account cannot be read", () => {
    expect(levelCheck({ ...signedIn, syncStatus: "offline" })).toBe("known");
    expect(levelCheck({ ...signedIn, syncStatus: "error" })).toBe("known");
    expect(levelCheck({ ...signedIn, syncStatus: "syncing", timedOut: true })).toBe("known");
  });

  it("the level syncs: a pulled profile gives a new device the level", async () => {
    const remote: ProfileRecord = { ...DEFAULT_PROFILE, updatedAt: 10, levels: sameLevels("B2"), levelSource: "placement", levelsAt: 10 };
    const pulled = reconcilePulled("profile", undefined, remote);
    expect(pulled.toLocal?.levelSource).toBe("placement");

    const store = createMemoryStore();
    if (pulled.toLocal) await store.put("profile", pulled.toLocal);
    expect(await readCheck(createRepositories({ store }), { signedIn: true, syncStatus: "synced" })).toBe("known");
  });

  it("a newer device profile without a level never erases the account's level", () => {
    const local: ProfileRecord = { ...DEFAULT_PROFILE, updatedAt: 20, dailyGoalMinutes: 15 };
    const remote: ProfileRecord = { ...DEFAULT_PROFILE, updatedAt: 10, levels: sameLevels("C1"), levelSource: "placement", levelsAt: 10 };
    const r = reconcilePulled("profile", local, remote);
    expect(r.toLocal?.levelSource).toBe("placement");
    expect(r.toLocal?.levels).toEqual(sameLevels("C1"));
    expect(r.toLocal?.dailyGoalMinutes).toBe(15);
  });
});

describe("/welcome address", () => {
  const params = (q: string) => new URLSearchParams(q);
  it("retake is manual only (Settings), and starts the test", () => {
    expect(welcomeIntent(params("retake=1"))).toEqual({ retake: true, test: true });
    expect(welcomeIntent(params("test=1"))).toEqual({ retake: false, test: true });
    expect(welcomeIntent(params("next=%2Fplay"))).toEqual({ retake: false, test: false });
  });

  it("drops test and retake from the address, so F5 on the result screen does not restart the test", () => {
    expect(welcomeUrlWithoutIntent("https://x.invalid/welcome?test=1")).toBe("/welcome");
    expect(welcomeUrlWithoutIntent("https://x.invalid/welcome?retake=1&next=%2Fwrite")).toBe("/welcome?next=%2Fwrite");
    expect(welcomeUrlWithoutIntent("https://x.invalid/welcome?next=%2Fwrite")).toBeNull();
  });

  it("after the reload, a learner with a level is sent on instead of seeing the screen", () => {
    // WelcomeView leaves for `next` when the check is "known" and no retake was asked for.
    expect(levelCheck({ ...guest, levelSource: "placement" })).toBe("known");
  });
});
