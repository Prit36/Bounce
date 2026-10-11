/* Isolated browser test doubles; no writes to real browser storage. */
const testRecords = new Map();
const testStorage = {
  getItem: key => testRecords.get(String(key)) ?? null,
  setItem: (key, value) => testRecords.set(String(key), String(value)),
  removeItem: key => testRecords.delete(String(key)),
  key: index => [...testRecords.keys()][index] ?? null,
  get length() { return testRecords.size; }
};
Object.defineProperty(window, 'localStorage', { value: testStorage });
window.js2me = { config: {}, manifest: {}, loadScript() {} };
window.javaRoot = { $javax: { $microedition: { $lcdui: {} } } };
