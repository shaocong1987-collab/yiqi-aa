import type { Expense, LedgerState, Member, MemberType } from "./types";
import { getEffectiveAmount } from "./settlement";
import { timestamp, today, uid } from "./utils";

export function createMember(activityId: string, groupId: string | undefined, name: string, type: MemberType): Member {
  const isChild = type === "child";
  return {
    id: uid("member"),
    activityId,
    groupId,
    name,
    type,
    canPay: !isChild,
    joinDefaultAA: !isChild,
    joinInternalAA: !isChild,
  };
}

export function createExpense(input: Omit<Expense, "id" | "splitAmount" | "createdAt" | "updatedAt">): Expense {
  const expense: Expense = {
    ...input,
    id: uid("expense"),
    splitAmount: 0,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
  expense.splitAmount = getEffectiveAmount(expense);
  return expense;
}

export function createSampleState(): LedgerState {
  const activityId = uid("activity");
  const groupA = uid("group");
  const groupB = uid("group");
  const createdAt = timestamp();
  const zhang = createMember(activityId, groupA, "张三", "adult");
  const zhangWife = createMember(activityId, groupA, "张三妻子", "adult");
  const li = createMember(activityId, groupB, "李四", "adult");
  const liWife = createMember(activityId, groupB, "李四妻子", "adult");
  const child = createMember(activityId, groupB, "李四孩子", "child");

  return {
    activity: {
      id: activityId,
      name: "五一露营试算",
      type: "camping",
      startDate: today(),
      endDate: today(),
      defaultSplitMode: "group",
      enableInternalSettlement: true,
      createdAt,
      updatedAt: createdAt,
    },
    groups: [
      { id: groupA, activityId, name: "张三家" },
      { id: groupB, activityId, name: "李四家" },
    ],
    members: [zhang, zhangWife, li, liWife, child],
    expenses: [
      createExpense({
        activityId,
        payerId: zhang.id,
        amount: 1200,
        category: "hotel",
        content: "营地住宿",
        expenseDate: today(),
        splitMode: "groups",
        groupIds: [],
        memberIds: [],
        useRechargeDiscount: false,
      }),
      createExpense({
        activityId,
        payerId: li.id,
        amount: 523,
        category: "meal",
        content: "餐厅储值卡扣款",
        expenseDate: today(),
        splitMode: "groups",
        groupIds: [],
        memberIds: [],
        useRechargeDiscount: true,
        rechargeAmount: 1000,
        bonusAmount: 300,
        deductedAmount: 523,
      }),
      createExpense({
        activityId,
        payerId: zhangWife.id,
        amount: 188,
        category: "drink",
        content: "酒水，只和大人 A",
        expenseDate: today(),
        splitMode: "selected_members",
        memberIds: [zhang.id, zhangWife.id, li.id, liWife.id],
        groupIds: [],
        useRechargeDiscount: false,
      }),
    ],
  };
}
