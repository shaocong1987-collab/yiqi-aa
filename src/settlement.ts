import type {
  Category,
  Expense,
  LedgerState,
  Member,
  SettlementResult,
  UnitStat,
} from "./types";
import { categories } from "./constants";
import { money, roundMoney } from "./utils";

interface Unit {
  id: string;
  name: string;
}

interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

export function getEffectiveAmount(expense: Pick<Expense, "amount" | "useRechargeDiscount" | "rechargeAmount" | "bonusAmount" | "deductedAmount">) {
  if (!expense.useRechargeDiscount) return roundMoney(expense.amount);
  const recharge = Number(expense.rechargeAmount) || 0;
  const bonus = Number(expense.bonusAmount) || 0;
  const deducted = Number(expense.deductedAmount) || 0;
  if (recharge <= 0 || deducted <= 0 || recharge + bonus <= 0) return 0;
  return roundMoney(deducted * (recharge / (recharge + bonus)));
}

function settleBalances(balanceMap: Map<string, number>): Transfer[] {
  const payers: { id: string; amount: number }[] = [];
  const receivers: { id: string; amount: number }[] = [];

  for (const [id, amount] of balanceMap.entries()) {
    const rounded = roundMoney(amount);
    if (rounded < -0.01) payers.push({ id, amount: -rounded });
    if (rounded > 0.01) receivers.push({ id, amount: rounded });
  }

  const transfers: Transfer[] = [];
  let payerIndex = 0;
  let receiverIndex = 0;

  while (payerIndex < payers.length && receiverIndex < receivers.length) {
    const payer = payers[payerIndex];
    const receiver = receivers[receiverIndex];
    const amount = roundMoney(Math.min(payer.amount, receiver.amount));
    if (amount > 0) transfers.push({ fromId: payer.id, toId: receiver.id, amount });
    payer.amount = roundMoney(payer.amount - amount);
    receiver.amount = roundMoney(receiver.amount - amount);
    if (payer.amount <= 0.01) payerIndex += 1;
    if (receiver.amount <= 0.01) receiverIndex += 1;
  }

  return transfers;
}

export function calculateSettlement(ledger: LedgerState): SettlementResult {
  const includedExpenses = ledger.expenses
    .map((expense) => ({ ...expense, splitAmount: getEffectiveAmount(expense) }))
    .filter((expense) => expense.splitMode !== "ignore" && expense.splitAmount > 0);

  const memberById = new Map(ledger.members.map((member) => [member.id, member]));
  const groupById = new Map(ledger.groups.map((group) => [group.id, group]));
  const unitNames = new Map<string, string>();
  const unitBalances = new Map<string, number>();
  const unitStats = new Map<string, UnitStat>();
  const memberPaid = new Map<string, number>();
  const memberOwed = new Map<string, number>();
  const categoryStats = new Map<Category, number>();
  const payerStats = new Map<string, number>();

  const ensureUnit = (unit: Unit | null) => {
    if (!unit) return;
    unitNames.set(unit.id, unit.name);
    if (!unitBalances.has(unit.id)) unitBalances.set(unit.id, 0);
    if (!unitStats.has(unit.id)) unitStats.set(unit.id, { paid: 0, share: 0 });
  };

  const getUnitForMember = (memberId: string): Unit | null => {
    const member = memberById.get(memberId);
    if (!member) return null;
    if (member.groupId) {
      const group = groupById.get(member.groupId);
      return group ? { id: group.id, name: group.name } : null;
    }
    return { id: member.id, name: member.name };
  };

  const addMemberOwed = (member: Member, amount: number) => {
    memberOwed.set(member.id, roundMoney((memberOwed.get(member.id) || 0) + amount));
  };

  const addUnitShare = (unit: Unit | null, amount: number) => {
    if (!unit) return;
    ensureUnit(unit);
    unitBalances.set(unit.id, roundMoney((unitBalances.get(unit.id) || 0) - amount));
    unitStats.get(unit.id)!.share = roundMoney(unitStats.get(unit.id)!.share + amount);
  };

  for (const expense of includedExpenses) {
    const payerUnit = getUnitForMember(expense.payerId);
    ensureUnit(payerUnit);

    if (payerUnit) {
      unitBalances.set(payerUnit.id, roundMoney((unitBalances.get(payerUnit.id) || 0) + expense.splitAmount));
      unitStats.get(payerUnit.id)!.paid = roundMoney(unitStats.get(payerUnit.id)!.paid + expense.splitAmount);
    }

    memberPaid.set(expense.payerId, roundMoney((memberPaid.get(expense.payerId) || 0) + expense.splitAmount));
    categoryStats.set(expense.category, roundMoney((categoryStats.get(expense.category) || 0) + expense.splitAmount));
    payerStats.set(expense.payerId, roundMoney((payerStats.get(expense.payerId) || 0) + expense.splitAmount));

    const mode = expense.splitMode === "default" ? ledger.activity.defaultSplitMode : expense.splitMode;

    if (mode === "groups" || mode === "group") {
      const groups = expense.groupIds?.length
        ? expense.groupIds.map((id) => groupById.get(id)).filter(Boolean)
        : ledger.groups;
      if (!groups.length) continue;
      const share = expense.splitAmount / groups.length;
      for (const group of groups) {
        if (!group) continue;
        addUnitShare({ id: group.id, name: group.name }, share);
        const internalMembers = ledger.members.filter((member) => member.groupId === group.id && member.joinInternalAA);
        const memberShare = internalMembers.length ? share / internalMembers.length : 0;
        for (const member of internalMembers) addMemberOwed(member, memberShare);
      }
      continue;
    }

    if (mode === "none") continue;

    const participants = mode === "selected_members"
      ? (expense.memberIds || []).map((id) => memberById.get(id)).filter(Boolean)
      : ledger.members.filter((member) => member.joinDefaultAA);
    if (!participants.length) continue;

    const share = expense.splitAmount / participants.length;
    for (const member of participants) {
      if (!member) continue;
      addUnitShare(getUnitForMember(member.id), share);
      addMemberOwed(member, share);
    }
  }

  const totalAmount = includedExpenses.reduce((sum, expense) => roundMoney(sum + expense.splitAmount), 0);
  const ignoredAmount = ledger.expenses
    .filter((expense) => expense.splitMode === "ignore")
    .reduce((sum, expense) => roundMoney(sum + getEffectiveAmount(expense)), 0);

  return {
    totalAmount,
    ignoredAmount,
    categoryStats,
    payerStats,
    unitStats,
    groupSettlements: settleBalances(unitBalances).map((transfer) => ({
      ...transfer,
      fromName: unitNames.get(transfer.fromId) || "未知",
      toName: unitNames.get(transfer.toId) || "未知",
    })),
    internalSettlements: ledger.groups.flatMap((group) => {
      const members = ledger.members.filter((member) => member.groupId === group.id && member.joinInternalAA);
      if (members.length < 2) return [];
      const balances = new Map<string, number>();
      for (const member of members) {
        balances.set(member.id, roundMoney((memberPaid.get(member.id) || 0) - (memberOwed.get(member.id) || 0)));
      }
      return settleBalances(balances).map((transfer) => ({
        groupId: group.id,
        groupName: group.name,
        fromId: transfer.fromId,
        toId: transfer.toId,
        fromName: memberById.get(transfer.fromId)?.name || "未知",
        toName: memberById.get(transfer.toId)?.name || "未知",
        amount: transfer.amount,
      }));
    }),
  };
}

export function compactSummary(ledger: LedgerState, result: SettlementResult) {
  const settlementText = result.groupSettlements.length
    ? result.groupSettlements.map((item) => `${item.fromName} 转给 ${item.toName} ${money(item.amount)}`).join("；")
    : "大家已经基本持平，不用互相转啦。";
  const internalText = result.internalSettlements.length
    ? result.internalSettlements.map((item) => `${item.groupName}：${item.fromName} 可转给 ${item.toName} ${money(item.amount)}`).join("；")
    : "暂无需要展示的家庭内部参考。";

  return `【${ledger.activity.name || "本次活动"}费用总结】

本次活动共有 ${ledger.groups.length} 个家庭参加，计入大家一起 A 的费用为 ${money(result.totalAmount)}。

结算建议：
${settlementText}

家庭内部参考：
${internalText}，仅供参考。`;
}

export function detailedSummary(ledger: LedgerState, result: SettlementResult) {
  const categoryLines = [...result.categoryStats.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `- ${categories[category] || category}：${money(amount)}`)
    .join("\n") || "- 暂无分类费用";

  const unitLines = [...result.unitStats.entries()]
    .map(([unitId, stat]) => {
      const group = ledger.groups.find((item) => item.id === unitId);
      const member = ledger.members.find((item) => item.id === unitId);
      return `- ${group?.name || member?.name || "未知"}：多垫付 ${money(stat.paid)}，参与分摊 ${money(stat.share)}`;
    })
    .join("\n") || "- 暂无家庭统计";

  return `${compactSummary(ledger, result)}

分类统计：
${categoryLines}

家庭统计：
${unitLines}

没有计入共同结算的记录：${money(result.ignoredAmount)}。`;
}

export function generateBillSummary(ledger: LedgerState, result: SettlementResult) {
  // 分类统计
  const categoryLines = [...result.categoryStats.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `${categories[category] || category}  ${money(amount)}`)
    .join("\n") || "(无)";

  // 参与人员统计
  const memberCount = ledger.members.length;
  const groupCount = ledger.groups.length;

  // 家庭/人员统计
  const unitLines = [...result.unitStats.entries()]
    .map(([unitId, stat]) => {
      const group = ledger.groups.find((item) => item.id === unitId);
      const member = ledger.members.find((item) => item.id === unitId);
      const unitName = group?.name || member?.name || "未知";
      const diff = stat.paid - stat.share;
      const diffStr = diff > 0.01 ? `(多垫 ${money(diff)})` : diff < -0.01 ? `(少垫 ${money(-diff)})` : "(平)";
      return `${unitName}  支付${money(stat.paid)}  ${diffStr}`;
    })
    .join("\n") || "(无)";

  // 结算转账
  const settlementLines = result.groupSettlements.length
    ? result.groupSettlements.map((item) => {
        const padName = (name: string) => {
          const len = name.length;
          const padding = Math.max(0, 8 - len * 2); // 按字符宽度估算
          return name + " ".repeat(padding);
        };
        return `${padName(item.fromName)} -> ${padName(item.toName)} ${money(item.amount)}`;
      }).join("\n")
    : "(大家已持平)";

  // 内部结算
  const internalLines = result.internalSettlements.length
    ? result.internalSettlements.map((item) => {
        const padName = (name: string) => {
          const len = name.length;
          const padding = Math.max(0, 8 - len * 2);
          return name + " ".repeat(padding);
        };
        return `${item.groupName}  ${padName(item.fromName)} -> ${padName(item.toName)} ${money(item.amount)}`;
      }).join("\n")
    : "(无)";

  // 详细费用记录
  const expenseLines = ledger.expenses
    .filter((expense) => expense.splitMode !== "ignore" && getEffectiveAmount(expense) > 0)
    .map((expense) => {
      const payer = ledger.members.find((m) => m.id === expense.payerId);
      const payerName = payer?.name || "未知";
      const effectiveAmount = getEffectiveAmount(expense);
      const date = expense.expenseDate ? expense.expenseDate.slice(5) : "无日期"; // 只显示月-日
      return `${date}  ${payerName}  ${categories[expense.category]}  ${money(effectiveAmount)}  ${expense.content}`;
    })
    .join("\n") || "(无)";

  return `【${ledger.activity.name || "活动"}】费用汇总账单

======= 账单汇总 =======
活动: ${ledger.activity.name || "未命名活动"}
时间: ${new Date().toLocaleDateString("zh-CN")}
家庭: ${groupCount}个  人数: ${memberCount}人
总计: ${money(result.totalAmount)}

======= 分类统计 =======
${categoryLines}

======= 人员统计 =======
${unitLines}

======= 结算建议 =======
${settlementLines}

======= 家庭内部 =======
${internalLines}

======= 费用详单 =======
${expenseLines}
${result.ignoredAmount > 0 ? `\n未计入: ${money(result.ignoredAmount)}` : ""}

生成: ${new Date().toLocaleString("zh-CN")}`;
}
