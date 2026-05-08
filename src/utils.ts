export const today = () => new Date().toISOString().slice(0, 10);
export const timestamp = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}_${createId()}`;
export const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
export const money = (value: number) => `${roundMoney(value).toFixed(2)} 元`;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${timePart}_${randomPart}`;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
