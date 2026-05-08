import { describe, expect, it } from "vitest";
import { createSampleState } from "./sample";
import { calculateSettlement, getEffectiveAmount } from "./settlement";

describe("settlement", () => {
  it("calculates recharge discount by real cash cost", () => {
    expect(getEffectiveAmount({
      amount: 523,
      useRechargeDiscount: true,
      rechargeAmount: 1000,
      bonusAmount: 300,
      deductedAmount: 523,
    })).toBe(402.31);
  });

  it("builds group settlement for sample data", () => {
    const ledger = createSampleState();
    const result = calculateSettlement(ledger);
    expect(result.totalAmount).toBe(1790.31);
    expect(result.groupSettlements).toHaveLength(1);
    expect(result.groupSettlements[0].fromName).toBe("李四家");
    expect(result.groupSettlements[0].toName).toBe("张三家");
    expect(result.groupSettlements[0].amount).toBe(492.84);
  });

  it("keeps ignored expenses out of shared total", () => {
    const ledger = createSampleState();
    ledger.expenses[0] = { ...ledger.expenses[0], splitMode: "ignore" };
    const result = calculateSettlement(ledger);
    expect(result.totalAmount).toBe(590.31);
    expect(result.ignoredAmount).toBe(1200);
  });

  it("supports selected member split", () => {
    const ledger = createSampleState();
    const result = calculateSettlement(ledger);
    expect(result.categoryStats.get("drink")).toBe(188);
    expect(result.internalSettlements.length).toBeGreaterThan(0);
  });
});
