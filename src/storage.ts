import type { LedgerState } from "./types";
import { createSampleState } from "./sample";

const DB_NAME = "yiqi-aa-ledger";
const STORE_NAME = "ledger";
const LEDGER_KEY = "current";
const CURRENT_ID_KEY = "currentActivityId";
const activityKey = (activityId: string) => `activity:${activityId}`;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLedger(): Promise<LedgerState> {
  try {
    const db = await openDatabase();
    const currentId = await getValue<string>(db, CURRENT_ID_KEY);
    if (currentId) {
      const currentLedger = await getValue<LedgerState>(db, activityKey(currentId));
      if (currentLedger) return validateLedger(currentLedger);
    }

    const result = await new Promise<LedgerState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(LEDGER_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return result ? validateLedger(result) : createSampleState();
  } catch (error) {
    console.warn("读取本地账本失败，使用示例账本。", error);
    return createSampleState();
  }
}

export async function saveLedger(ledger: LedgerState): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(ledger, LEDGER_KEY);
    store.put(ledger, activityKey(ledger.activity.id));
    store.put(ledger.activity.id, CURRENT_ID_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLedgers(): Promise<LedgerState[]> {
  try {
    const db = await openDatabase();
    const items = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const ledgers = items
      .filter((item): item is LedgerState => item !== null && typeof item === "object" && "activity" in item)
      .map((item) => {
        try {
          return validateLedger(item);
        } catch {
          return null;
        }
      })
      .filter((item): item is LedgerState => Boolean(item));

    return dedupeLedgers(ledgers).sort((a, b) => b.activity.updatedAt.localeCompare(a.activity.updatedAt));
  } catch {
    return [];
  }
}

export async function setCurrentLedger(activityId: string): Promise<void> {
  const db = await openDatabase();
  await putValue(db, CURRENT_ID_KEY, activityId);
}

export async function deleteLedger(activityId: string): Promise<void> {
  const db = await openDatabase();
  const legacyCurrent = await getValue<LedgerState>(db, LEDGER_KEY);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(activityKey(activityId));
    if (legacyCurrent?.activity.id === activityId) store.delete(LEDGER_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getValue<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putValue(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dedupeLedgers(ledgers: LedgerState[]) {
  const byId = new Map<string, LedgerState>();
  for (const ledger of ledgers) {
    const previous = byId.get(ledger.activity.id);
    if (!previous || previous.activity.updatedAt < ledger.activity.updatedAt) byId.set(ledger.activity.id, ledger);
  }
  return [...byId.values()];
}

export function validateLedger(input: unknown): LedgerState {
  if (!input || typeof input !== "object") throw new Error("账本不是有效 JSON 对象");
  const ledger = input as Partial<LedgerState>;
  if (!ledger.activity || typeof ledger.activity !== "object") throw new Error("缺少活动信息");
  if (!Array.isArray(ledger.groups)) throw new Error("缺少家庭列表");
  if (!Array.isArray(ledger.members)) throw new Error("缺少成员列表");
  if (!Array.isArray(ledger.expenses)) throw new Error("缺少费用列表");

  const activity = ledger.activity as LedgerState["activity"];
  if (!activity.id || !activity.name || !activity.defaultSplitMode) throw new Error("活动信息不完整");

  for (const group of ledger.groups) {
    if (!group.id || !group.name) throw new Error("家庭信息不完整");
  }

  const memberIds = new Set(ledger.members.map((member) => member.id));
  for (const member of ledger.members) {
    if (!member.id || !member.name || !member.type) throw new Error("成员信息不完整");
  }

  for (const expense of ledger.expenses) {
    if (!expense.id || !expense.payerId || !memberIds.has(expense.payerId)) throw new Error("费用付款人无效");
    if (!expense.category || !expense.splitMode) throw new Error("费用信息不完整");
    if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) < 0) throw new Error("费用金额无效");
  }

  return ledger as LedgerState;
}
