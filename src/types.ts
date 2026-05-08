export type ActivityType = "meal" | "camping" | "travel" | "other";
export type DefaultSplitMode = "group" | "member" | "custom" | "none";
export type MemberType = "adult" | "child" | "other";
export type Category =
  | "meal"
  | "drink"
  | "food"
  | "hotel"
  | "traffic"
  | "fuel"
  | "ticket"
  | "experience"
  | "equipment"
  | "children"
  | "medical"
  | "service"
  | "other";
export type ExpenseSplitMode = "default" | "all_members" | "selected_members" | "groups" | "ignore";

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  startDate?: string;
  endDate?: string;
  defaultSplitMode: DefaultSplitMode;
  enableInternalSettlement: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  activityId: string;
  name: string;
}

export interface Member {
  id: string;
  activityId: string;
  groupId?: string;
  name: string;
  type: MemberType;
  canPay: boolean;
  joinDefaultAA: boolean;
  joinInternalAA: boolean;
}

export interface Expense {
  id: string;
  activityId: string;
  payerId: string;
  amount: number;
  splitAmount: number;
  category: Category;
  content: string;
  expenseDate?: string;
  splitMode: ExpenseSplitMode;
  memberIds?: string[];
  groupIds?: string[];
  useRechargeDiscount: boolean;
  rechargeAmount?: number;
  bonusAmount?: number;
  deductedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerState {
  activity: Activity;
  groups: Group[];
  members: Member[];
  expenses: Expense[];
}

export interface SettlementTransfer {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  amount: number;
}

export interface InternalSettlement {
  groupId: string;
  groupName: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  amount: number;
}

export interface UnitStat {
  paid: number;
  share: number;
}

export interface SettlementResult {
  totalAmount: number;
  ignoredAmount: number;
  categoryStats: Map<Category, number>;
  payerStats: Map<string, number>;
  unitStats: Map<string, UnitStat>;
  groupSettlements: SettlementTransfer[];
  internalSettlements: InternalSettlement[];
}
