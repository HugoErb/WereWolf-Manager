export const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

export function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const clone = (value) => structuredClone(value);
export const formatTime = (seconds) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
export const downloadJson = (data, filename) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: filename });
  anchor.click();
  URL.revokeObjectURL(url);
};

export function focusFirst(container) {
  requestAnimationFrame(() => container?.querySelector("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus());
}
