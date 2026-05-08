import { describe, expect, it } from "vitest";
import { createSampleState } from "./sample";
import { validateLedger } from "./storage";

describe("ledger import validation", () => {
  it("accepts a complete exported ledger", () => {
    const ledger = createSampleState();
    expect(validateLedger(ledger).activity.id).toBe(ledger.activity.id);
  });

  it("rejects expenses with unknown payers", () => {
    const ledger = createSampleState();
    ledger.expenses[0] = { ...ledger.expenses[0], payerId: "missing_member" };
    expect(() => validateLedger(ledger)).toThrow("费用付款人无效");
  });

  it("rejects invalid expense amounts", () => {
    const ledger = createSampleState();
    ledger.expenses[0] = { ...ledger.expenses[0], amount: -1 };
    expect(() => validateLedger(ledger)).toThrow("费用金额无效");
  });

  it("rejects non-ledger JSON", () => {
    expect(() => validateLedger({ hello: "world" })).toThrow("缺少活动信息");
  });
});
