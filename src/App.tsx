import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Download,
  FileUp,
  Home,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { activityTypes, categories, defaultSplitModes, expenseSplitModes, memberTypes } from "./constants";
import { createExpense, createMember, createSampleState } from "./sample";
import { calculateSettlement, compactSummary, detailedSummary, generateBillSummary, getEffectiveAmount } from "./settlement";
import { deleteLedger as deleteStoredLedger, loadLedger, loadLedgers, saveLedger, setCurrentLedger, validateLedger } from "./storage";
import type { Category, DefaultSplitMode, Expense, ExpenseSplitMode, LedgerState, MemberType } from "./types";
import { downloadJson, money, timestamp, today, uid } from "./utils";

type ExpenseDraft = {
  amount: string;
  payerId: string;
  category: Category;
  content: string;
  expenseDate: string;
  splitMode: ExpenseSplitMode;
  memberIds: string[];
  groupIds: string[];
  useRechargeDiscount: boolean;
  rechargeAmount: string;
  bonusAmount: string;
  deductedAmount: string;
};

type Page = "activities" | "settings" | "expenses" | "settlement";

type CommonRoster = {
  id: string;
  name: string;
  groups: {
    name: string;
    members: {
      name: string;
      type: MemberType;
      canPay: boolean;
      joinDefaultAA: boolean;
      joinInternalAA: boolean;
    }[];
  }[];
};

const COMMON_ROSTERS_KEY = "yiqi-aa-common-rosters";
const DEFAULT_MEMBER_TYPE: MemberType = "adult";

const blankDraft = (ledger: LedgerState): ExpenseDraft => ({
  amount: "",
  payerId: ledger.members.find((member) => member.canPay)?.id || "",
  category: "meal",
  content: "",
  expenseDate: ledger.activity.startDate || today(),
  splitMode: "default",
  memberIds: [],
  groupIds: [],
  useRechargeDiscount: false,
  rechargeAmount: "",
  bonusAmount: "",
  deductedAmount: "",
});

const draftFromExpense = (expense: Expense): ExpenseDraft => ({
  amount: String(expense.amount),
  payerId: expense.payerId,
  category: expense.category,
  content: expense.content,
  expenseDate: expense.expenseDate || today(),
  splitMode: expense.splitMode,
  memberIds: expense.memberIds || [],
  groupIds: expense.groupIds || [],
  useRechargeDiscount: expense.useRechargeDiscount,
  rechargeAmount: expense.rechargeAmount ? String(expense.rechargeAmount) : "",
  bonusAmount: expense.bonusAmount ? String(expense.bonusAmount) : "",
  deductedAmount: expense.deductedAmount ? String(expense.deductedAmount) : "",
});

function toExpenseInput(ledger: LedgerState, draft: ExpenseDraft) {
  return {
    activityId: ledger.activity.id,
    payerId: draft.payerId,
    amount: Number(draft.amount) || 0,
    category: draft.category,
    content: draft.content.trim(),
    expenseDate: draft.expenseDate,
    splitMode: draft.splitMode,
    memberIds: draft.memberIds,
    groupIds: draft.groupIds,
    useRechargeDiscount: draft.useRechargeDiscount,
    rechargeAmount: Number(draft.rechargeAmount) || undefined,
    bonusAmount: Number(draft.bonusAmount) || undefined,
    deductedAmount: Number(draft.deductedAmount) || undefined,
  };
}

export function App() {
  const [ledger, setLedger] = useState<LedgerState>(() => createSampleState());
  const [activityList, setActivityList] = useState<LedgerState[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<Page>("expenses");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => blankDraft(createSampleState()));
  const [memberDraft, setMemberDraft] = useState({ name: "", type: DEFAULT_MEMBER_TYPE, groupId: "" });
  const [filters, setFilters] = useState({ keyword: "", category: "all", payerId: "all" });
  const [commonRosters, setCommonRosters] = useState<CommonRoster[]>(() => loadCommonRosters());
  const [message, setMessage] = useState("");
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    loadLedger().then((nextLedger) => {
      setLedger(nextLedger);
      setExpenseDraft(blankDraft(nextLedger));
      setMemberDraft((draft) => ({ ...draft, groupId: nextLedger.groups[0]?.id || "" }));
      setLoaded(true);
    });
    loadLedgers().then(setActivityList);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveLedger(ledger)
      .then(() => loadLedgers().then(setActivityList))
      .catch((error) => setMessage(`保存失败：${String(error)}`));
  }, [ledger, loaded]);

  useEffect(() => {
    const payers = ledger.members.filter((member) => member.canPay);
    if (payers.length && !payers.some((member) => member.id === expenseDraft.payerId)) {
      setExpenseDraft((draft) => ({ ...draft, payerId: payers[0].id }));
    }
    if (ledger.groups.length && !ledger.groups.some((group) => group.id === memberDraft.groupId)) {
      setMemberDraft((draft) => ({ ...draft, groupId: ledger.groups[0]?.id || "" }));
    }
  }, [expenseDraft.payerId, ledger.groups, ledger.members, memberDraft.groupId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const markReady = () => setOfflineReady(true);
    navigator.serviceWorker.ready.then(markReady).catch(() => undefined);
    navigator.serviceWorker.addEventListener("controllerchange", markReady);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", markReady);
  }, []);

  const canUsePwaOffline = window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  const result = useMemo(() => calculateSettlement(ledger), [ledger]);
  const filteredExpenses = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return ledger.expenses.filter((expense) => {
      const payer = ledger.members.find((member) => member.id === expense.payerId);
      const matchKeyword = !keyword
        || expense.content.toLowerCase().includes(keyword)
        || categories[expense.category].toLowerCase().includes(keyword)
        || payer?.name.toLowerCase().includes(keyword);
      const matchCategory = filters.category === "all" || expense.category === filters.category;
      const matchPayer = filters.payerId === "all" || expense.payerId === filters.payerId;
      return matchKeyword && matchCategory && matchPayer;
    });
  }, [filters, ledger.expenses, ledger.members]);

  const updateLedger = (updater: (current: LedgerState) => LedgerState) => {
    setLedger((current) => {
      const next = updater(current);
      return { ...next, activity: { ...next.activity, updatedAt: timestamp() } };
    });
  };

  const updateActivity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLedger((current) => ({
      ...current,
      activity: {
        ...current.activity,
        name: String(form.get("name") || "").trim() || "未命名活动",
        type: String(form.get("type")) as LedgerState["activity"]["type"],
        defaultSplitMode: String(form.get("defaultSplitMode")) as DefaultSplitMode,
        startDate: String(form.get("startDate") || ""),
        endDate: String(form.get("endDate") || ""),
        enableInternalSettlement: form.get("enableInternalSettlement") === "on",
        updatedAt: timestamp(),
      },
    }));
    setMessage("活动设置已保存。");
  };

  const addGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    const groupId = uid("group");
    setLedger((current) => {
      const group = { id: groupId, activityId: current.activity.id, name };
      const defaultMembers = [1, 2, 3].map((index) => createMember(current.activity.id, group.id, `${name}大人${index}`, "adult"));
      return {
        ...current,
        groups: [...current.groups, group],
        members: [...current.members, ...defaultMembers],
      };
    });
    setMemberDraft((draft) => ({ ...draft, groupId }));
    event.currentTarget.reset();
  };

  const addMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = memberDraft.name.trim();
    if (!name) return;
    const groupId = memberDraft.groupId || ledger.groups[0]?.id || undefined;
    setLedger((current) => ({
      ...current,
      members: [...current.members, createMember(current.activity.id, groupId, name, memberDraft.type)],
    }));
    setMemberDraft((draft) => ({ ...draft, name: "" }));
  };

  const deleteGroup = (groupId: string) => {
    updateLedger((current) => ({
      ...current,
      groups: current.groups.filter((group) => group.id !== groupId),
      members: current.members.map((member) => member.groupId === groupId ? { ...member, groupId: undefined } : member),
    }));
  };

  const deleteMember = (memberId: string) => {
    updateLedger((current) => ({
      ...current,
      members: current.members.filter((member) => member.id !== memberId),
      expenses: current.expenses.filter((expense) => expense.payerId !== memberId),
    }));
  };

  const saveExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expenseDraft.payerId) {
      setMessage("请先添加可付款成员。");
      return;
    }

    if (editingExpenseId) {
      updateLedger((current) => ({
        ...current,
        expenses: current.expenses.map((expense) => {
          if (expense.id !== editingExpenseId) return expense;
          const nextExpense = {
            ...expense,
            ...toExpenseInput(current, expenseDraft),
            updatedAt: timestamp(),
          };
          return { ...nextExpense, splitAmount: getEffectiveAmount(nextExpense) };
        }),
      }));
      setEditingExpenseId(null);
      setMessage("费用已更新。");
      setPage("expenses");
    } else {
      setLedger((current) => ({
        ...current,
        expenses: [createExpense(toExpenseInput(current, expenseDraft)), ...current.expenses],
      }));
      setMessage("已记一笔。");
      setPage("expenses");
    }
    setExpenseDraft(blankDraft(ledger));
  };

  const editExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseDraft(draftFromExpense(expense));
    setPage("expenses");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteExpense = (expenseId: string) => {
    updateLedger((current) => ({
      ...current,
      expenses: current.expenses.filter((expense) => expense.id !== expenseId),
    }));
  };

  const importLedger = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const nextLedger = validateLedger(JSON.parse(await file.text()));
      setLedger(nextLedger);
      setExpenseDraft(blankDraft(nextLedger));
      setEditingExpenseId(null);
      setPage("activities");
      setMessage("账本已导入。");
    } catch (error) {
      setMessage(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(generateBillSummary(ledger, result));
    setMessage("总账单已复制。");
  };

  const createNewActivity = () => {
    const nextLedger = createSampleState();
    nextLedger.activity.name = "新的活动";
    nextLedger.groups = [];
    nextLedger.members = [];
    nextLedger.expenses = [];
    setLedger(nextLedger);
    setExpenseDraft(blankDraft(nextLedger));
    setMemberDraft({ name: "", type: DEFAULT_MEMBER_TYPE, groupId: "" });
    setEditingExpenseId(null);
    setPage("settings");
    setMessage("已创建空白活动，可以先添加家庭和成员。");
  };

  const switchActivity = async (activityId: string, nextPage: Page = "expenses") => {
    const target = activityList.find((item) => item.activity.id === activityId);
    if (!target) return;
    await setCurrentLedger(activityId);
    setLedger(target);
    setExpenseDraft(blankDraft(target));
    setMemberDraft((draft) => ({ ...draft, name: "", groupId: target.groups[0]?.id || "" }));
    setEditingExpenseId(null);
    setPage(nextPage);
    setMessage(`已切换到「${target.activity.name}」。`);
  };

  const removeActivity = async (activityId: string) => {
    if (activityList.length <= 1) {
      setMessage("至少保留一个活动。");
      return;
    }
    await deleteStoredLedger(activityId);
    const nextList = await loadLedgers();
    setActivityList(nextList);
    if (ledger.activity.id === activityId) {
      const nextLedger = nextList[0] || createSampleState();
      await setCurrentLedger(nextLedger.activity.id);
      setLedger(nextLedger);
      setExpenseDraft(blankDraft(nextLedger));
    }
    setMessage("活动记录已移除。");
  };

  const saveCurrentRoster = () => {
    const roster = buildRosterFromLedger(ledger);
    if (!roster.groups.length) {
      setMessage("当前还没有可保存的家庭/成员。");
      return;
    }
    const nextRosters = [roster, ...commonRosters.filter((item) => item.name !== roster.name)].slice(0, 8);
    setCommonRosters(nextRosters);
    saveCommonRosters(nextRosters);
    setMessage("已保存为常用家庭/成员。");
  };

  const renameCommonRoster = (rosterId: string) => {
    const roster = commonRosters.find((item) => item.id === rosterId);
    if (!roster) return;
    const name = window.prompt("修改常用组合名称", roster.name)?.trim();
    if (!name) return;
    const nextRosters = commonRosters.map((item) => item.id === rosterId ? { ...item, name } : item);
    setCommonRosters(nextRosters);
    saveCommonRosters(nextRosters);
  };

  const replaceCommonRoster = (rosterId: string) => {
    const replacement = { ...buildRosterFromLedger(ledger), id: rosterId, name: commonRosters.find((item) => item.id === rosterId)?.name || "常用组合" };
    const nextRosters = commonRosters.map((item) => item.id === rosterId ? replacement : item);
    setCommonRosters(nextRosters);
    saveCommonRosters(nextRosters);
    setMessage("常用组合已用当前家庭成员更新。");
  };

  const deleteCommonRoster = (rosterId: string) => {
    const nextRosters = commonRosters.filter((item) => item.id !== rosterId);
    setCommonRosters(nextRosters);
    saveCommonRosters(nextRosters);
  };

  const applyCommonRoster = (roster: CommonRoster) => {
    setLedger((current) => {
      const existingGroupNames = new Set(current.groups.map((group) => group.name));
      const groupNameById = new Map(current.groups.map((group) => [group.id, group.name]));
      const existingMemberKeys = new Set(current.members.map((member) => `${groupNameById.get(member.groupId || "") || "未分配"}:${member.name}`));
      const newGroups = [...current.groups];
      const newMembers = [...current.members];

      for (const groupTemplate of roster.groups) {
        let group = newGroups.find((item) => item.name === groupTemplate.name);
        if (!group && !existingGroupNames.has(groupTemplate.name)) {
          group = { id: uid("group"), activityId: current.activity.id, name: groupTemplate.name };
          newGroups.push(group);
          existingGroupNames.add(group.name);
        }
        if (!group) continue;
        for (const memberTemplate of groupTemplate.members) {
          const key = `${group.name}:${memberTemplate.name}`;
          if (existingMemberKeys.has(key)) continue;
          newMembers.push({
            ...createMember(current.activity.id, group.id, memberTemplate.name, memberTemplate.type),
            canPay: memberTemplate.canPay,
            joinDefaultAA: memberTemplate.joinDefaultAA,
            joinInternalAA: memberTemplate.joinInternalAA,
          });
          existingMemberKeys.add(key);
        }
      }

      return { ...current, groups: newGroups, members: newMembers };
    });
    setMessage(`已添加「${roster.name}」里的家庭和成员。`);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-5 text-slate-800 sm:px-6 lg:px-8">
      <header className="pb-5">
        <h1 className="text-4xl font-semibold tracking-normal text-slate-900 sm:text-5xl">一起A了吧</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
          本地单人记账工具。先把家庭/成员、费用和结算建议跑通，适合聚餐、露营、旅行时快速记账。
        </p>
      </header>

      {message && (
        <div className="mb-4 rounded-lg border border-mint-100 bg-mint-50 px-3 py-2 text-sm text-mint-700">
          {message}
        </div>
      )}
      <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${offlineReady ? "border-mint-100 bg-mint-50 text-mint-700" : "border-slate-100 bg-white/80 text-slate-500"}`}>
        {offlineReady
          ? "离线访问已准备好。添加到手机主屏幕后，电脑关闭也能打开应用。"
          : canUsePwaOffline
            ? "正在准备离线访问，首次打开时请保持网络连接。"
            : "当前是局域网 HTTP 访问，可正常试用；要安装离线应用，需要通过 HTTPS 地址打开。"}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="计入 AA" value={money(result.totalAmount)} />
        <Stat label="记录但先不 A" value={money(result.ignoredAmount)} />
        <Stat label="家庭" value={String(ledger.groups.length)} />
        <Stat label="成员" value={String(ledger.members.length)} />
      </section>

      <nav className="mt-5 hidden rounded-lg border border-slate-100 bg-white/90 p-2 shadow-soft sm:flex sm:flex-wrap sm:gap-2">
        <NavButton icon={<Home size={16} />} active={page === "activities"} onClick={() => setPage("activities")}>活动</NavButton>
        <NavButton icon={<Users size={16} />} active={page === "settings"} onClick={() => setPage("settings")}>设置</NavButton>
        <NavButton icon={<ReceiptText size={16} />} active={page === "expenses"} onClick={() => setPage("expenses")}>费用</NavButton>
        <NavButton icon={<Calculator size={16} />} active={page === "settlement"} onClick={() => setPage("settlement")}>结算</NavButton>
      </nav>

      <div className="mt-5 grid gap-5">
        {page === "activities" && (
          <Panel title="活动列表" action={<Button icon={<Plus size={16} />} type="button" onClick={createNewActivity}>创建活动</Button>}>
            <div className="grid gap-3">
              {(activityList.length ? activityList : [ledger]).map((item) => (
                <article className={`rounded-lg border bg-white p-4 ${item.activity.id === ledger.activity.id ? "border-mint-100 ring-2 ring-mint-100" : "border-slate-100"}`} key={item.activity.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="text-lg">{item.activity.name}</strong>
                      <p className="mt-1 text-sm text-slate-500">
                        {activityTypes[item.activity.type]} · 默认{defaultSplitModes[item.activity.defaultSplitMode]} · {item.expenses.length} 笔费用
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.activity.startDate || "未设置日期"}{item.activity.endDate ? ` 至 ${item.activity.endDate}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.activity.id === ledger.activity.id ? (
                        <Button variant="soft" type="button" onClick={() => setPage("expenses")}>继续记账</Button>
                      ) : (
                        <Button variant="soft" type="button" onClick={() => switchActivity(item.activity.id)}>打开</Button>
                      )}
                      <Button variant="ghost" type="button" onClick={() => {
                        if (item.activity.id !== ledger.activity.id) void switchActivity(item.activity.id, "settings");
                        else setPage("settings");
                      }}>编辑</Button>
                      <Button variant="danger" type="button" onClick={() => removeActivity(item.activity.id)}>移除</Button>
                    </div>
                  </div>
                </article>
              ))}
              <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-sm leading-6 text-slate-600">
                活动记录保存在当前浏览器本地。换手机或清理浏览器数据前，记得导出 JSON 备份。
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Download size={16} />} variant="soft" type="button" onClick={() => downloadJson(`${ledger.activity.name}-账本.json`, ledger)}>导出 JSON</Button>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-slate-700">
                  <FileUp size={16} /> 导入 JSON
                  <input hidden type="file" accept="application/json" onChange={importLedger} />
                </label>
              </div>
            </div>
          </Panel>
        )}

        {page === "settings" && (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="活动设置">
            <form className="grid gap-3" onSubmit={updateActivity}>
              <Field label="活动名称"><input name="name" defaultValue={ledger.activity.name} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="活动类型">
                  <select name="type" defaultValue={ledger.activity.type}>{options(activityTypes)}</select>
                </Field>
                <Field label="默认怎么算">
                  <select name="defaultSplitMode" defaultValue={ledger.activity.defaultSplitMode}>{options(defaultSplitModes)}</select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="开始日期"><input type="date" name="startDate" defaultValue={ledger.activity.startDate} /></Field>
                <Field label="结束日期"><input type="date" name="endDate" defaultValue={ledger.activity.endDate} /></Field>
              </div>
              <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <input type="checkbox" name="enableInternalSettlement" defaultChecked={ledger.activity.enableInternalSettlement} />
                <span>
                  <span className="block text-slate-800">显示家庭内参考分摊</span>
                  <span className="block text-xs leading-5 text-slate-500">只给每个家庭自己看，例如夫妻之间谁多垫了多少；不会影响家庭之间的主结算。</span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Save size={16} />} type="submit">保存活动</Button>
                <Button icon={<Download size={16} />} variant="soft" type="button" onClick={() => downloadJson(`${ledger.activity.name}-账本.json`, ledger)}>导出 JSON</Button>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-slate-700">
                  <FileUp size={16} /> 导入 JSON
                  <input hidden type="file" accept="application/json" onChange={importLedger} />
                </label>
                <Button icon={<RotateCcw size={16} />} variant="danger" type="button" onClick={() => {
                  const sample = createSampleState();
                  setLedger(sample);
                  setExpenseDraft(blankDraft(sample));
                }}>恢复示例</Button>
              </div>
            </form>
          </Panel>

          <Panel title="家庭和成员">
            <form className="flex gap-2" onSubmit={addGroup}>
              <input name="name" placeholder="新增家庭，例如 王五家" />
              <Button icon={<Plus size={16} />} type="submit">添加</Button>
            </form>
            <form className="mt-4 grid gap-3" onSubmit={addMember}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="成员姓名"><input value={memberDraft.name} onChange={(event) => setMemberDraft({ ...memberDraft, name: event.target.value })} placeholder="例如 张三" /></Field>
                <Field label="所属家庭">
                  <select value={memberDraft.groupId} onChange={(event) => setMemberDraft({ ...memberDraft, groupId: event.target.value })}>
                    {ledger.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="成员类型"><select value={memberDraft.type} onChange={(event) => setMemberDraft({ ...memberDraft, type: event.target.value as MemberType })}>{options(memberTypes)}</select></Field>
                <div className="flex items-end"><Button icon={<Plus size={16} />} type="submit">添加成员</Button></div>
              </div>
            </form>
            <div className="mt-4 rounded-lg border border-slate-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">常用家庭/成员</strong>
                <Button variant="soft" type="button" onClick={saveCurrentRoster}>保存当前组合</Button>
              </div>
              <div className="mt-3 grid gap-2">
                {commonRosters.map((roster) => (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2" key={roster.id}>
                    <button
                      className="rounded-full bg-mint-50 px-3 py-2 text-sm text-mint-700 hover:bg-mint-100"
                      onClick={() => applyCommonRoster(roster)}
                      type="button"
                    >
                      {roster.name}
                    </button>
                    <span className="text-xs text-slate-500">{roster.groups.reduce((sum, group) => sum + group.members.length, 0)} 人</span>
                    <button className="ml-auto text-xs text-slate-500" onClick={() => renameCommonRoster(roster.id)} type="button">改名</button>
                    <button className="text-xs text-slate-500" onClick={() => replaceCommonRoster(roster.id)} type="button">更新</button>
                    <button className="text-xs text-rose-700" onClick={() => deleteCommonRoster(roster.id)} type="button">移除</button>
                  </div>
                ))}
                {!commonRosters.length && <span className="text-sm text-slate-500">还没有常用组合，保存一次当前家庭成员后会显示在这里。</span>}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-100 bg-white p-3">
              <strong className="text-sm">参与活动的成员</strong>
              <div className="mt-2 flex flex-wrap gap-2">
                {ledger.members.map((member) => (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-700" key={member.id}>
                    {member.name}
                    <button className="text-xs text-rose-700" onClick={() => deleteMember(member.id)} type="button">移除</button>
                  </span>
                ))}
                {!ledger.members.length && <span className="text-sm text-slate-500">还没有成员。</span>}
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {ledger.groups.map((group) => (
                <div className="rounded-lg border border-slate-100 bg-white p-3" key={group.id}>
                  <div className="flex items-start justify-between gap-3">
                    <strong>{group.name}</strong>
                    <button className="text-sm text-rose-700" onClick={() => deleteGroup(group.id)}>删除</button>
                  </div>
                  <div className="mt-2 grid gap-1">
                    {ledger.members.filter((member) => member.groupId === group.id).map((member) => (
                      <div className="flex items-center gap-2 text-sm" key={member.id}>
                        <span className="rounded-full bg-mint-50 px-2 py-1 text-xs text-mint-700">{memberTypes[member.type]}</span>
                        <span>{member.name}</span>
                        <button className="ml-auto text-slate-500" onClick={() => deleteMember(member.id)}>移除</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          </div>
        )}

        {page === "expenses" && (
          <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <Panel title={editingExpenseId ? "编辑费用" : "记一笔"}>
              <ExpenseForm
                draft={expenseDraft}
                ledger={ledger}
                editing={Boolean(editingExpenseId)}
                onCancel={() => {
                  setEditingExpenseId(null);
                  setExpenseDraft(blankDraft(ledger));
                }}
                onChange={setExpenseDraft}
                onSubmit={saveExpense}
              />
            </Panel>
            <Panel title="费用记录">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="搜索"><input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="内容/类别/付款人" /></Field>
                <Field label="类别">
                  <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                    <option value="all">全部类别</option>
                    {options(categories)}
                  </select>
                </Field>
                <Field label="付款人">
                  <select value={filters.payerId} onChange={(event) => setFilters({ ...filters, payerId: event.target.value })}>
                    <option value="all">全部付款人</option>
                    {ledger.members.filter((member) => member.canPay).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-4 grid gap-3">
                {filteredExpenses.map((expense) => {
                  const payer = ledger.members.find((member) => member.id === expense.payerId);
                  return (
                    <article className="rounded-lg border border-slate-100 bg-white p-3" key={expense.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong>{expense.content || categories[expense.category]}</strong>
                          <p className="mt-1 text-sm text-slate-500">
                            {categories[expense.category]} · {payer?.name || "未知"} · {expenseSplitModes[expense.splitMode]}
                          </p>
                        </div>
                        <strong className="tabular-nums">{money(getEffectiveAmount(expense))}</strong>
                      </div>
                      {expense.useRechargeDiscount && <p className="mt-2 text-sm text-slate-500">原扣款 {money(expense.deductedAmount || 0)}，已按充值赠送折算。</p>}
                      <div className="mt-3 flex gap-2">
                        <Button icon={<Pencil size={16} />} variant="ghost" type="button" onClick={() => editExpense(expense)}>编辑</Button>
                        <Button icon={<Trash2 size={16} />} variant="danger" type="button" onClick={() => deleteExpense(expense.id)}>删除</Button>
                      </div>
                    </article>
                  );
                })}
                {!filteredExpenses.length && <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">没有匹配的费用。</div>}
              </div>
            </Panel>
          </div>
        )}

        {page === "settlement" && (
          <Panel title="结算结果" action={<Button variant="soft" type="button" onClick={copySummary}>复制总账单</Button>}>
            <div className="grid gap-4">
              <div className="rounded-lg border border-slate-100 bg-gradient-to-br from-mint-50 to-slate-50 p-3">
                <strong className="text-mint-800">📊 费用汇总</strong>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded bg-white p-2">
                    <p className="text-xs text-slate-600">总计费用</p>
                    <p className="text-lg font-bold text-mint-700">{money(result.totalAmount)}</p>
                  </div>
                  <div className="rounded bg-white p-2">
                    <p className="text-xs text-slate-600">参与人数</p>
                    <p className="text-lg font-bold text-slate-700">{ledger.members.length}</p>
                  </div>
                  <div className="rounded bg-white p-2">
                    <p className="text-xs text-slate-600">参与家庭</p>
                    <p className="text-lg font-bold text-slate-700">{ledger.groups.length}</p>
                  </div>
                  <div className="rounded bg-white p-2">
                    <p className="text-xs text-slate-600">分类数</p>
                    <p className="text-lg font-bold text-slate-700">{result.categoryStats.size}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-200 pt-2">
                  <p className="text-xs font-semibold text-slate-600">分类占比</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[...result.categoryStats.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([category, amount]) => (
                        <span key={category} className="inline-block rounded-full bg-white px-2 py-1 text-xs text-slate-700">
                          {categories[category]}: {money(amount)}
                        </span>
                      ))}
                    {result.categoryStats.size > 5 && (
                      <span className="inline-block rounded-full bg-white px-2 py-1 text-xs text-slate-500">
                        ...还有 {result.categoryStats.size - 5} 项
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <strong>主结算建议</strong>
                <div className="mt-2 grid gap-2">
                  {result.groupSettlements.map((item) => (
                    <div className="flex flex-wrap items-center gap-2" key={`${item.fromId}-${item.toId}`}>
                      <span>{item.fromName}</span><span className="rounded-full bg-mint-50 px-2 py-1 text-xs text-mint-700">转给</span><span>{item.toName}</span><strong>{money(item.amount)}</strong>
                    </div>
                  ))}
                  {!result.groupSettlements.length && <p className="text-sm text-slate-500">大家已经基本持平。</p>}
                </div>
              </div>
              <details open={ledger.activity.enableInternalSettlement}>
                <summary className="cursor-pointer text-sm text-slate-600">家庭内部参考</summary>
                <div className="mt-2 rounded-lg border border-slate-100 bg-white p-3">
                  {result.internalSettlements.map((item) => (
                    <div className="mb-2 flex flex-wrap items-center gap-2" key={`${item.groupId}-${item.fromId}-${item.toId}`}>
                      <span>{item.groupName}：</span><span>{item.fromName}</span><span className="rounded-full bg-mint-50 px-2 py-1 text-xs text-mint-700">可转给</span><span>{item.toName}</span><strong>{money(item.amount)}</strong>
                    </div>
                  ))}
                  {!result.internalSettlements.length && <p className="text-sm text-slate-500">暂无需要展示的家庭内部参考。</p>}
                </div>
              </details>
              <SummaryBlock title="简洁版总结" text={compactSummary(ledger, result)} />
              <details>
                <summary className="cursor-pointer text-sm text-slate-600">详细版总结</summary>
                <SummaryBlock title="" text={detailedSummary(ledger, result)} />
              </details>
            </div>
          </Panel>
        )}
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-10 grid grid-cols-4 gap-1 rounded-lg border border-slate-100 bg-white/95 p-1 shadow-soft backdrop-blur sm:hidden">
        <MobileNavButton icon={<Home size={18} />} active={page === "activities"} onClick={() => setPage("activities")}>活动</MobileNavButton>
        <MobileNavButton icon={<Users size={18} />} active={page === "settings"} onClick={() => setPage("settings")}>设置</MobileNavButton>
        <MobileNavButton icon={<ReceiptText size={18} />} active={page === "expenses"} onClick={() => setPage("expenses")}>费用</MobileNavButton>
        <MobileNavButton icon={<Calculator size={18} />} active={page === "settlement"} onClick={() => setPage("settlement")}>结算</MobileNavButton>
      </nav>
    </main>
  );
}

function ExpenseForm({ draft, editing, ledger, onCancel, onChange, onSubmit }: {
  draft: ExpenseDraft;
  editing: boolean;
  ledger: LedgerState;
  onCancel: () => void;
  onChange: (draft: ExpenseDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const payers = ledger.members.filter((member) => member.canPay);
  const toggleId = (field: "memberIds" | "groupIds", id: string) => {
    onChange({
      ...draft,
      [field]: draft[field].includes(id) ? draft[field].filter((item) => item !== id) : [...draft[field], id],
    });
  };

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      {!payers.length && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
          先到“设置”里添加一位大人成员，再回来记账。孩子默认不能作为付款人。
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="金额"><input required min="0" step="0.01" type="number" value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} /></Field>
        <Field label="付款人">
          <select required value={draft.payerId} disabled={!payers.length} onChange={(event) => onChange({ ...draft, payerId: event.target.value })}>
            {!payers.length && <option value="">暂无可付款成员</option>}
            {payers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="类别"><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value as Category })}>{options(categories)}</select></Field>
        <Field label="日期"><input type="date" value={draft.expenseDate} onChange={(event) => onChange({ ...draft, expenseDate: event.target.value })} /></Field>
      </div>
      <Field label="具体内容"><input value={draft.content} onChange={(event) => onChange({ ...draft, content: event.target.value })} placeholder="例如 从酒店到景区打车费" /></Field>
      <Field label="这笔钱怎么算">
        <select value={draft.splitMode} onChange={(event) => onChange({ ...draft, splitMode: event.target.value as ExpenseSplitMode })}>{options(expenseSplitModes)}</select>
        <span className="text-xs leading-5 text-slate-500">
          活动默认当前是：{defaultSplitModes[ledger.activity.defaultSplitMode]}。普通费用不用纠结，直接用这个即可。
        </span>
      </Field>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">选择参与人/家庭</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <strong className="text-sm">成员</strong>
            <div className="mt-2 grid gap-1">
              {ledger.members.map((member) => (
                <label className="flex items-center gap-2 text-sm text-slate-600" key={member.id}>
                  <input type="checkbox" checked={draft.memberIds.includes(member.id)} onChange={() => toggleId("memberIds", member.id)} /> {member.name}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <strong className="text-sm">家庭</strong>
            <div className="mt-2 grid gap-1">
              {ledger.groups.map((group) => (
                <label className="flex items-center gap-2 text-sm text-slate-600" key={group.id}>
                  <input type="checkbox" checked={draft.groupIds.includes(group.id)} onChange={() => toggleId("groupIds", group.id)} /> {group.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>
      <details open={draft.useRechargeDiscount}>
        <summary className="cursor-pointer text-sm text-slate-600">充值赠送折算</summary>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={draft.useRechargeDiscount} onChange={(event) => onChange({ ...draft, useRechargeDiscount: event.target.checked })} />
          这笔使用充值赠送折算
        </label>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label="充值金额"><input type="number" step="0.01" value={draft.rechargeAmount} onChange={(event) => onChange({ ...draft, rechargeAmount: event.target.value })} /></Field>
          <Field label="赠送金额"><input type="number" step="0.01" value={draft.bonusAmount} onChange={(event) => onChange({ ...draft, bonusAmount: event.target.value })} /></Field>
          <Field label="本次扣款"><input type="number" step="0.01" value={draft.deductedAmount} onChange={(event) => onChange({ ...draft, deductedAmount: event.target.value })} /></Field>
        </div>
      </details>
      <div className="flex gap-2">
        <Button icon={<Save size={16} />} type="submit">{editing ? "保存修改" : "记一笔"}</Button>
        {editing && <Button variant="ghost" type="button" onClick={onCancel}>取消编辑</Button>}
      </div>
    </form>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white/90 p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function NavButton({ active, children, icon, onClick }: { active: boolean; children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-mint-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}

function MobileNavButton({ active, children, icon, onClick }: { active: boolean; children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`grid min-h-12 place-items-center rounded-lg px-1 py-1 text-[11px] ${active ? "bg-mint-600 text-white" : "text-slate-600"}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm text-slate-600"><span>{label}</span>{children}</label>;
}

function Button({ children, icon, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; variant?: "primary" | "soft" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-mint-600 text-white hover:bg-mint-700",
    soft: "bg-sky-50 text-slate-700 hover:bg-sky-100",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-50",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  };
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${styles[variant]}`} {...props}>{icon}{children}</button>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-soft"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-xl tabular-nums">{value}</strong></div>;
}

function SummaryBlock({ title, text }: { title: string; text: string }) {
  return <div>{title && <h3 className="mb-2 font-semibold">{title}</h3>}<pre className="whitespace-pre-wrap rounded-lg border border-dashed border-mint-100 bg-linen p-3 text-sm leading-7 text-slate-700">{text}</pre></div>;
}

function options<T extends string>(items: Record<T, string>) {
  return Object.entries(items).map(([value, label]) => <option key={value} value={value}>{String(label)}</option>);
}

function loadCommonRosters(): CommonRoster[] {
  try {
    const raw = localStorage.getItem(COMMON_ROSTERS_KEY);
    if (!raw) return [];
    const rosters = JSON.parse(raw);
    if (!Array.isArray(rosters)) return [];
    return rosters.filter((roster) => roster?.id && roster?.name && Array.isArray(roster.groups));
  } catch {
    return [];
  }
}

function saveCommonRosters(rosters: CommonRoster[]) {
  localStorage.setItem(COMMON_ROSTERS_KEY, JSON.stringify(rosters));
}

function buildRosterFromLedger(ledger: LedgerState): CommonRoster {
  return {
    id: uid("roster"),
    name: `${ledger.activity.name || "常用组合"}的成员`,
    groups: ledger.groups.map((group) => ({
      name: group.name,
      members: uniqueByName(ledger.members.filter((member) => member.groupId === group.id))
        .map((member) => ({
          name: member.name,
          type: member.type,
          canPay: member.canPay,
          joinDefaultAA: member.joinDefaultAA,
          joinInternalAA: member.joinInternalAA,
        })),
    })).filter((group) => group.members.length > 0),
  };
}

function uniqueByName<T extends { name: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
