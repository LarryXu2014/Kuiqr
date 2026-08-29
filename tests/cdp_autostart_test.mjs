import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9230');
const page = b.contexts()[0].pages()[0];
const r = await page.evaluate(async () => {
  const out = {};
  out.version = await window.qrAPI.getAppVersion();
  // Fresh profile: backend should NOT be configured yet.
  const s = await window.qrAPI.getSettings();
  out.beforeUrl = s.dynamicBackendUrl || '(empty)';
  out.beforeKey = s.dynamicApiKey ? 'set' : '(empty)';
  // This should auto-start the local backend and succeed.
  const created = await window.qrAPI.createDynamicCode({ destination: 'I am Larry', type: 'text' });
  out.created = created;
  if (created && created.ok && created.data) {
    out.lookup = await window.qrAPI.lookupDynamicCode({ code: created.data.code });
    out.stats = await window.qrAPI.getDynamicStats({ code: created.data.code });
  }
  const s2 = await window.qrAPI.getSettings();
  out.afterUrl = s2.dynamicBackendUrl || '(empty)';
  out.afterKey = s2.dynamicApiKey ? 'set' : '(empty)';
  return out;
});
console.log('version       :', r.version);
console.log('backend before:', r.beforeUrl, '/', r.beforeKey);
console.log('backend after :', r.afterUrl, '/', r.afterKey);
console.log('created       :', JSON.stringify(r.created));
console.log('lookup        :', JSON.stringify(r.lookup));
console.log('stats         :', r.stats && r.stats.data ? 'total=' + r.stats.data.total + ' type=' + r.stats.data.type : JSON.stringify(r.stats));
await b.close();
