const DB_NAME = "yiqi-aa-ledger";
const STORE_NAME = "ledger";
const LEDGER_KEY = "current";

const activityTypes = {
  meal: "吃饭聚餐",
  camping: "露营短途",
  travel: "多日旅行",
  other: "其他",
};

const splitModes = {
  default: "跟着活动默认",
  all_members: "大家一起 A",
  selected_members: "只和几个人 A",
  groups: "按家庭/小组 A",
  ignore: "这笔先不 A",
};

const defaultSplitModes = {
  group: "按家庭/小组 A",
  member: "按人头 A",
  custom: "自定义份数",
  none: "不设置默认",
};

const categories = {
  meal: "餐饮餐费",
  drink: "酒水饮品",
  food: "食材采购",
  hotel: "住宿费用",
  traffic: "交通出行",
  fuel: "油费高速",
  ticket: "车票机票",
  experience: "特色体验",
  equipment: "装备物资",
  children: "儿童相关",
  medical: "医药应急",
  service: "服务杂费",
  other: "其他费用",
};

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const money = (value) => `${roundMoney(value).toFixed(2)} 元`;
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

let state = createSampleState();

function createSampleState() {
  const activityId = uid("activity");
  const groupA = uid("group");
  const groupB = uid("group");
  const zhang = uid("member");
  const zhangWife = uid("member");
  const li = uid("member");
  const liWife = uid("member");
  const child = uid("member");
  const base = now();

  return {
    activity: {
      id: activityId,
      name: "五一露营试算",
      type: "camping",
      startDate: today(),
      endDate: today(),
      defaultSplitMode: "group",
      enableInternalSettlement: true,
      createdAt: base,
      updatedAt: base,
    },
    groups: [
      { id: groupA, activityId, name: "张三家" },
      { id: groupB, activityId, name: "李四家" },
    ],
    members: [
      createMember(activityId, groupA, zhang, "张三", "adult"),
      createMember(activityId, groupA, zhangWife, "张三妻子", "adult"),
      createMember(activityId, groupB, li, "李四", "adult"),
      createMember(activityId, groupB, liWife, "李四妻子", "adult"),
      createMember(activityId, groupB, child, "李四孩子", "child"),
    ],
    expenses: [
      createExpense(activityId, zhang, 1200, "hotel", "营地住宿", "groups"),
      createExpense(activityId, li, 523, "meal", "餐厅储值卡扣款", "groups", {
        useRechargeDiscount: true,
        rechargeAmount: 1000,
        bonusAmount: 300,
        deductedAmount: 523,
      }),
      createExpense(activityId, zhangWife, 188, "drink", "酒水，只和大人 A", "selected_members", {
        memberIds: [zhang, zhangWife, li, liWife],
      }),
    ],
  };
}

function createMember(activityId, groupId, id, name, type) {
  const isChild = type === "child";
  return {
    id,
    activityId,
    groupId,
    name,
    type,
    canPay: !isChild,
    joinDefaultAA: !isChild,
    joinInternalAA: !isChild,
  };
}

function createExpense(activityId, payerId, amount, category, content, splitMode, extra = {}) {
  const date = today();
  const expense = {
    id: uid("expense"),
    activityId,
    payerId,
    amount,
    splitAmount: amount,
    category,
    content,
    expenseDate: date,
    splitMode,
    memberIds: [],
    groupIds: [],
    useRechargeDiscount: false,
    rechargeAmount: undefined,
    bonusAmount: undefined,
    deductedAmount: undefined,
    createdAt: now(),
    updatedAt: now(),
    ...extra,
  };

  expense.splitAmount = getEffectiveAmount(expense);
  return expense;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  try {
    const db = await openDatabase();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(LEDGER_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (result?.activity && Array.isArray(result.groups) && Array.isArray(result.members)) {
      state = result;
    }
  } catch (error) {
    console.warn("IndexedDB 读取失败，使用示例账本。", error);
  }
}

async function saveState() {
  state.activity.updatedAt = now();
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(state, LEDGER_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getEffectiveAmount(expense) {
  if (!expense.useRechargeDiscount) return roundMoney(expense.amount);
  const recharge = Number(expense.rechargeAmount) || 0;
  const bonus = Number(expense.bonusAmount) || 0;
  const deducted = Number(expense.deductedAmount) || 0;
  if (recharge <= 0 || deducted <= 0 || recharge + bonus <= 0) return 0;
  return roundMoney(deducted * (recharge / (recharge + bonus)));
}

function getMember(id) {
  return state.members.find((member) => member.id === id);
}

function getGroup(id) {
  return state.groups.find((group) => group.id === id);
}

function getUnitForMember(memberId) {
  const member = getMember(memberId);
  if (!member) return null;
  if (member.groupId) {
    const group = getGroup(member.groupId);
    return group ? { id: group.id, name: group.name, type: "group" } : null;
  }
  return { id: member.id, name: member.name, type: "member" };
}

function settleBalances(balanceMap) {
  const payers = [];
  const receivers = [];

  for (const [id, amount] of balanceMap.entries()) {
    const rounded = roundMoney(amount);
    if (rounded < -0.01) payers.push({ id, amount: -rounded });
    if (rounded > 0.01) receivers.push({ id, amount: rounded });
  }

  const transfers = [];
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

function calculateSettlement() {
  const includedExpenses = state.expenses
    .map((expense) => ({ ...expense, splitAmount: getEffectiveAmount(expense) }))
    .filter((expense) => expense.splitMode !== "ignore" && expense.splitAmount > 0);

  const unitNames = new Map();
  const unitBalances = new Map();
  const unitStats = new Map();
  const memberPaid = new Map();
  const memberOwed = new Map();
  const categoryStats = new Map();
  const payerStats = new Map();

  const ensureUnit = (unit) => {
    if (!unit) return;
    unitNames.set(unit.id, unit.name);
    if (!unitBalances.has(unit.id)) unitBalances.set(unit.id, 0);
    if (!unitStats.has(unit.id)) unitStats.set(unit.id, { paid: 0, share: 0 });
  };

  for (const expense of includedExpenses) {
    const payer = getMember(expense.payerId);
    const payerUnit = getUnitForMember(expense.payerId);
    ensureUnit(payerUnit);

    unitBalances.set(payerUnit.id, roundMoney((unitBalances.get(payerUnit.id) || 0) + expense.splitAmount));
    unitStats.get(payerUnit.id).paid = roundMoney(unitStats.get(payerUnit.id).paid + expense.splitAmount);
    memberPaid.set(expense.payerId, roundMoney((memberPaid.get(expense.payerId) || 0) + expense.splitAmount));
    categoryStats.set(expense.category, roundMoney((categoryStats.get(expense.category) || 0) + expense.splitAmount));
    payerStats.set(expense.payerId, roundMoney((payerStats.get(expense.payerId) || 0) + expense.splitAmount));

    const mode = expense.splitMode === "default" ? state.activity.defaultSplitMode : expense.splitMode;

    if (mode === "groups" || mode === "group") {
      const groups = expense.groupIds?.length
        ? expense.groupIds.map(getGroup).filter(Boolean)
        : state.groups;
      const activeGroups = groups.filter(Boolean);
      if (!activeGroups.length) continue;
      const share = expense.splitAmount / activeGroups.length;
      for (const group of activeGroups) {
        ensureUnit({ id: group.id, name: group.name, type: "group" });
        unitBalances.set(group.id, roundMoney((unitBalances.get(group.id) || 0) - share));
        unitStats.get(group.id).share = roundMoney(unitStats.get(group.id).share + share);
        const internalMembers = state.members.filter((member) => member.groupId === group.id && member.joinInternalAA);
        const memberShare = internalMembers.length ? share / internalMembers.length : 0;
        for (const member of internalMembers) {
          memberOwed.set(member.id, roundMoney((memberOwed.get(member.id) || 0) + memberShare));
        }
      }
      continue;
    }

    if (mode === "none") continue;

    const participants = mode === "selected_members"
      ? (expense.memberIds || []).map(getMember).filter(Boolean)
      : state.members.filter((member) => member.joinDefaultAA);
    if (!participants.length) continue;

    const share = expense.splitAmount / participants.length;
    for (const member of participants) {
      const unit = getUnitForMember(member.id);
      ensureUnit(unit);
      unitBalances.set(unit.id, roundMoney((unitBalances.get(unit.id) || 0) - share));
      unitStats.get(unit.id).share = roundMoney(unitStats.get(unit.id).share + share);
      memberOwed.set(member.id, roundMoney((memberOwed.get(member.id) || 0) + share));
    }
  }

  const totalAmount = includedExpenses.reduce((sum, expense) => roundMoney(sum + expense.splitAmount), 0);
  const ignoredAmount = state.expenses
    .filter((expense) => expense.splitMode === "ignore")
    .reduce((sum, expense) => roundMoney(sum + getEffectiveAmount(expense)), 0);

  const groupSettlements = settleBalances(unitBalances).map((transfer) => ({
    ...transfer,
    fromName: unitNames.get(transfer.fromId) || "未知",
    toName: unitNames.get(transfer.toId) || "未知",
  }));

  const internalSettlements = [];
  for (const group of state.groups) {
    const members = state.members.filter((member) => member.groupId === group.id && member.joinInternalAA);
    if (members.length < 2) continue;
    const balances = new Map();
    for (const member of members) {
      balances.set(member.id, roundMoney((memberPaid.get(member.id) || 0) - (memberOwed.get(member.id) || 0)));
    }
    const transfers = settleBalances(balances).map((transfer) => ({
      groupId: group.id,
      groupName: group.name,
      fromName: getMember(transfer.fromId)?.name || "未知",
      toName: getMember(transfer.toId)?.name || "未知",
      amount: transfer.amount,
    }));
    internalSettlements.push(...transfers);
  }

  return {
    totalAmount,
    ignoredAmount,
    categoryStats,
    payerStats,
    unitStats,
    groupSettlements,
    internalSettlements,
  };
}

function compactSummary(result) {
  const title = `【${state.activity.name || "本次活动"}费用总结】`;
  const groupCount = state.groups.length;
  const settlementText = result.groupSettlements.length
    ? result.groupSettlements.map((item) => `${item.fromName} 转给 ${item.toName} ${money(item.amount)}`).join("；")
    : "大家已经基本持平，不用互相转啦。";
  const internalText = result.internalSettlements.length
    ? result.internalSettlements.map((item) => `${item.groupName}：${item.fromName} 可转给 ${item.toName} ${money(item.amount)}`).join("；")
    : "暂无需要展示的家庭内部参考。";

  return `${title}

本次活动共有 ${groupCount} 个家庭/小组参加，计入大家一起 A 的费用为 ${money(result.totalAmount)}。

结算建议：
${settlementText}

家庭内部参考：
${internalText}，仅供参考。`;
}

function detailedSummary(result) {
  const categoryLines = [...result.categoryStats.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `- ${categories[category] || category}：${money(amount)}`)
    .join("\n") || "- 暂无分类费用";

  const unitLines = [...result.unitStats.entries()]
    .map(([unitId, stat]) => `- ${getGroup(unitId)?.name || getMember(unitId)?.name || "未知"}：多垫付 ${money(stat.paid)}，参与分摊 ${money(stat.share)}`)
    .join("\n") || "- 暂无家庭/小组统计";

  return `${compactSummary(result)}

分类统计：
${categoryLines}

家庭/小组统计：
${unitLines}

没有计入共同结算的记录：${money(result.ignoredAmount)}。`;
}

function optionList(options, selected) {
  return Object.entries(options)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

function memberCheckboxes(selectedIds = []) {
  return state.members
    .map((member) => `
      <label class="row muted">
        <input type="checkbox" name="memberIds" value="${member.id}" ${selectedIds.includes(member.id) ? "checked" : ""} />
        ${member.name}
      </label>
    `)
    .join("");
}

function groupCheckboxes(selectedIds = []) {
  return state.groups
    .map((group) => `
      <label class="row muted">
        <input type="checkbox" name="groupIds" value="${group.id}" ${selectedIds.includes(group.id) ? "checked" : ""} />
        ${group.name}
      </label>
    `)
    .join("");
}

function render() {
  const result = calculateSettlement();
  const app = document.querySelector("#app");
  app.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <h1>一起A了吧</h1>
        <p>本地单人记账原型。先把家庭/成员、费用和结算建议跑通，适合今晚验证真实聚餐、露营、旅行账本。</p>
      </header>

      <section class="stats">
        <div class="stat"><span>计入 AA</span><strong class="money">${money(result.totalAmount)}</strong></div>
        <div class="stat"><span>记录但先不 A</span><strong class="money">${money(result.ignoredAmount)}</strong></div>
        <div class="stat"><span>家庭/小组</span><strong>${state.groups.length}</strong></div>
        <div class="stat"><span>成员</span><strong>${state.members.length}</strong></div>
      </section>

      <div class="layout">
        <div>
          ${renderActivityPanel()}
          ${renderPeoplePanel()}
          ${renderExpenseForm()}
        </div>
        <div>
          ${renderExpenseList()}
          ${renderSettlementPanel(result)}
        </div>
      </div>
    </main>
  `;

  bindEvents();
}

function renderActivityPanel() {
  return `
    <section class="panel">
      <div class="section-title">
        <h2>活动设置</h2>
        <span class="pill">${activityTypes[state.activity.type]}</span>
      </div>
      <form id="activityForm" class="grid">
        <div class="field">
          <label>活动名称</label>
          <input name="name" value="${state.activity.name}" />
        </div>
        <div class="grid two">
          <div class="field">
            <label>活动类型</label>
            <select name="type">${optionList(activityTypes, state.activity.type)}</select>
          </div>
          <div class="field">
            <label>默认怎么算</label>
            <select name="defaultSplitMode">${optionList(defaultSplitModes, state.activity.defaultSplitMode)}</select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>开始日期</label>
            <input type="date" name="startDate" value="${state.activity.startDate || ""}" />
          </div>
          <div class="field">
            <label>结束日期</label>
            <input type="date" name="endDate" value="${state.activity.endDate || ""}" />
          </div>
        </div>
        <label class="row muted">
          <input type="checkbox" name="enableInternalSettlement" ${state.activity.enableInternalSettlement ? "checked" : ""} />
          显示家庭内部参考
        </label>
        <div class="toolbar">
          <button class="btn primary" type="submit">保存活动</button>
          <button class="btn soft" type="button" data-action="export">导出 JSON</button>
          <label class="btn soft">
            导入 JSON
            <input hidden type="file" accept="application/json" data-action="import" />
          </label>
          <button class="btn danger" type="button" data-action="reset-sample">恢复示例</button>
        </div>
      </form>
    </section>
  `;
}

function renderPeoplePanel() {
  return `
    <section class="panel">
      <div class="section-title">
        <h2>家庭和成员</h2>
      </div>
      <form id="groupForm" class="row">
        <input name="name" placeholder="新增家庭/小组，例如 王五家" />
        <button class="btn primary" type="submit">添加</button>
      </form>
      <div class="divider"></div>
      <form id="memberForm" class="grid">
        <div class="grid two">
          <div class="field">
            <label>成员姓名</label>
            <input name="name" placeholder="例如 张三" />
          </div>
          <div class="field">
            <label>所属家庭</label>
            <select name="groupId">
              ${state.groups.map((group) => `<option value="${group.id}">${group.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>成员类型</label>
            <select name="type">
              <option value="adult">大人</option>
              <option value="child">孩子</option>
              <option value="other">其他</option>
            </select>
          </div>
          <button class="btn primary" type="submit">添加成员</button>
        </div>
      </form>
      <div class="divider"></div>
      <div class="list">
        ${state.groups.map(renderGroupCard).join("") || `<div class="empty">还没有家庭/小组。</div>`}
      </div>
    </section>
  `;
}

function renderGroupCard(group) {
  const members = state.members.filter((member) => member.groupId === group.id);
  return `
    <article class="card">
      <div class="card-title">
        <strong>${group.name}</strong>
        <button class="btn ghost" data-action="delete-group" data-id="${group.id}">删除</button>
      </div>
      <div class="list">
        ${members.map((member) => `
          <div class="row">
            <span class="pill">${member.type === "child" ? "孩子" : member.type === "adult" ? "大人" : "其他"}</span>
            <span>${member.name}</span>
            <button class="btn ghost" data-action="delete-member" data-id="${member.id}">移除</button>
          </div>
        `).join("") || `<div class="muted">还没有成员。</div>`}
      </div>
    </article>
  `;
}

function renderExpenseForm() {
  return `
    <section class="panel">
      <div class="section-title">
        <h2>新增费用</h2>
      </div>
      <form id="expenseForm" class="grid">
        <div class="grid two">
          <div class="field">
            <label>金额</label>
            <input required min="0" step="0.01" type="number" name="amount" placeholder="例如 328" />
          </div>
          <div class="field">
            <label>付款人</label>
            <select required name="payerId">
              ${state.members.filter((member) => member.canPay).map((member) => `<option value="${member.id}">${member.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>类别</label>
            <select name="category">${optionList(categories, "meal")}</select>
          </div>
          <div class="field">
            <label>日期</label>
            <input type="date" name="expenseDate" value="${today()}" />
          </div>
        </div>
        <div class="field">
          <label>具体内容</label>
          <input name="content" placeholder="例如 从酒店到景区打车费" />
        </div>
        <div class="field">
          <label>这笔钱怎么算</label>
          <select name="splitMode">${optionList(splitModes, "default")}</select>
        </div>
        <details>
          <summary class="muted">选择参与成员/家庭，仅在对应分摊方式下使用</summary>
          <div class="grid two">
            <div class="card">
              <strong>成员</strong>
              ${memberCheckboxes()}
            </div>
            <div class="card">
              <strong>家庭/小组</strong>
              ${groupCheckboxes()}
            </div>
          </div>
        </details>
        <details>
          <summary class="muted">充值赠送折算</summary>
          <label class="row muted">
            <input type="checkbox" name="useRechargeDiscount" />
            这笔使用充值赠送折算
          </label>
          <div class="grid two">
            <div class="field"><label>充值金额</label><input type="number" step="0.01" name="rechargeAmount" /></div>
            <div class="field"><label>赠送金额</label><input type="number" step="0.01" name="bonusAmount" /></div>
            <div class="field"><label>本次扣款金额</label><input type="number" step="0.01" name="deductedAmount" /></div>
          </div>
          <p class="notice">公式：计入 AA 金额 = 本次扣款金额 × 充值金额 /（充值金额 + 赠送金额）。</p>
        </details>
        <button class="btn primary" type="submit">记一笔</button>
      </form>
    </section>
  `;
}

function renderExpenseList() {
  return `
    <section class="panel">
      <div class="section-title">
        <h2>费用记录</h2>
        <small>${state.expenses.length} 笔</small>
      </div>
      <div class="list">
        ${state.expenses.map((expense) => {
          const payer = getMember(expense.payerId);
          const effective = getEffectiveAmount(expense);
          return `
            <article class="card">
              <div class="card-title">
                <div>
                  <strong>${expense.content || categories[expense.category]}</strong>
                  <div class="muted">${categories[expense.category]} · ${payer?.name || "未知付款人"} · ${splitModes[expense.splitMode] || defaultSplitModes[expense.splitMode] || expense.splitMode}</div>
                </div>
                <div class="money"><strong>${money(effective)}</strong></div>
              </div>
              ${expense.useRechargeDiscount ? `<p class="muted">原扣款 ${money(expense.deductedAmount)}，按充值赠送折算计入 ${money(effective)}</p>` : ""}
              <div class="row">
                <button class="btn ghost" data-action="delete-expense" data-id="${expense.id}">删除</button>
              </div>
            </article>
          `;
        }).join("") || `<div class="empty">还没有费用，先记一笔。</div>`}
      </div>
    </section>
  `;
}

function renderSettlementPanel(result) {
  return `
    <section class="panel">
      <div class="section-title">
        <h2>结算结果</h2>
        <button class="btn soft" data-action="copy-summary">复制总结</button>
      </div>
      <div class="grid">
        <div class="card">
          <strong>主结算建议</strong>
          <div class="list">
            ${result.groupSettlements.map((item) => `
              <div class="row">
                <span>${item.fromName}</span>
                <span class="pill">转给</span>
                <span>${item.toName}</span>
                <strong class="money">${money(item.amount)}</strong>
              </div>
            `).join("") || `<div class="muted">大家已经基本持平。</div>`}
          </div>
        </div>
        <details ${state.activity.enableInternalSettlement ? "open" : ""}>
          <summary class="muted">家庭内部参考</summary>
          <div class="card">
            ${result.internalSettlements.map((item) => `
              <div class="row">
                <span>${item.groupName}：</span>
                <span>${item.fromName}</span>
                <span class="pill">可转给</span>
                <span>${item.toName}</span>
                <strong class="money">${money(item.amount)}</strong>
              </div>
            `).join("") || `<div class="muted">暂无需要展示的家庭内部参考。</div>`}
          </div>
        </details>
        <div>
          <div class="section-title">
            <h3>简洁版总结</h3>
          </div>
          <div class="summary">${compactSummary(result)}</div>
        </div>
        <details>
          <summary class="muted">详细版总结</summary>
          <div class="summary">${detailedSummary(result)}</div>
        </details>
      </div>
    </section>
  `;
}

function bindEvents() {
  document.querySelector("#activityForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.activity = {
      ...state.activity,
      name: form.get("name").trim() || "未命名活动",
      type: form.get("type"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
      defaultSplitMode: form.get("defaultSplitMode"),
      enableInternalSettlement: form.get("enableInternalSettlement") === "on",
    };
    await persistAndRender();
  });

  document.querySelector("#groupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    if (!name) return;
    state.groups.push({ id: uid("group"), activityId: state.activity.id, name });
    await persistAndRender();
  });

  document.querySelector("#memberForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    if (!name) return;
    const type = form.get("type");
    state.members.push(createMember(state.activity.id, form.get("groupId"), uid("member"), name, type));
    await persistAndRender();
  });

  document.querySelector("#expenseForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expense = createExpense(
      state.activity.id,
      form.get("payerId"),
      Number(form.get("amount")) || 0,
      form.get("category"),
      form.get("content").trim(),
      form.get("splitMode"),
      {
        expenseDate: form.get("expenseDate"),
        memberIds: form.getAll("memberIds"),
        groupIds: form.getAll("groupIds"),
        useRechargeDiscount: form.get("useRechargeDiscount") === "on",
        rechargeAmount: Number(form.get("rechargeAmount")) || undefined,
        bonusAmount: Number(form.get("bonusAmount")) || undefined,
        deductedAmount: Number(form.get("deductedAmount")) || undefined,
      },
    );
    expense.splitAmount = getEffectiveAmount(expense);
    state.expenses.unshift(expense);
    await persistAndRender();
  });

  document.querySelector("#app").onclick = handleClick;
  document.querySelector("[data-action='import']")?.addEventListener("change", handleImport, { once: true });
}

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "delete-group") {
    state.members = state.members.map((member) => member.groupId === id ? { ...member, groupId: undefined } : member);
    state.groups = state.groups.filter((group) => group.id !== id);
    await persistAndRender();
    return;
  }

  if (action === "delete-member") {
    state.members = state.members.filter((member) => member.id !== id);
    state.expenses = state.expenses.filter((expense) => expense.payerId !== id);
    await persistAndRender();
    return;
  }

  if (action === "delete-expense") {
    state.expenses = state.expenses.filter((expense) => expense.id !== id);
    await persistAndRender();
    return;
  }

  if (action === "reset-sample") {
    state = createSampleState();
    await persistAndRender();
    return;
  }

  if (action === "export") {
    exportLedger();
  }

  if (action === "copy-summary") {
    await navigator.clipboard.writeText(compactSummary(calculateSettlement()));
    target.textContent = "已复制";
  }
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const nextState = JSON.parse(text);
    if (!nextState.activity || !Array.isArray(nextState.groups) || !Array.isArray(nextState.members) || !Array.isArray(nextState.expenses)) {
      throw new Error("账本结构不完整");
    }
    state = nextState;
    await persistAndRender();
  } catch (error) {
    alert(`导入失败：${error.message}`);
  }
}

function exportLedger() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.activity.name || "一起A了吧"}-账本.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function persistAndRender() {
  await saveState();
  render();
}

await loadState();
render();
