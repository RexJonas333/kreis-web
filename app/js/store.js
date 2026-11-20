/* Vaultline – lokaler Speicher. Alles wird verschlüsselt abgelegt (AES-GCM mit einem Datenschlüssel).
 * Mit App-Sperre ist der Datenschlüssel zusätzlich mit der PIN verschlossen.
 */
(function (G) {
  'use strict';
  const KC = G.KC || (typeof require !== 'undefined' ? require('./crypto.js') : null);
  const STORES = ['kv', 'msgs', 'files'];

  function idbBackend(name) {
    return new Promise((res, rej) => {
      const rq = indexedDB.open(name, 1);
      rq.onupgradeneeded = () => { for (const s of STORES) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s); };
      rq.onerror = () => rej(rq.error);
      rq.onsuccess = () => {
        const db = rq.result;
        const tx = (st, mode, fn) => new Promise((ok, bad) => {
          const t = db.transaction(st, mode), o = t.objectStore(st);
          const r = fn(o);
          t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
          t.onerror = () => bad(t.error);
        });
        res({
          get: (st, k) => tx(st, 'readonly', (o) => o.get(k)),
          put: (st, k, v) => tx(st, 'readwrite', (o) => o.put(v, k)),
          del: (st, k) => tx(st, 'readwrite', (o) => o.delete(k)),
          clear: (st) => tx(st, 'readwrite', (o) => o.clear()),
          all: (st) => new Promise((ok, bad) => {
            const out = [], t = db.transaction(st, 'readonly');
            const c = t.objectStore(st).openCursor();
            c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } };
            t.oncomplete = () => ok(out);
            t.onerror = () => bad(t.error);
          }),
        });
      };
    });
  }

  function memBackend() {
    const m = {}; for (const s of STORES) m[s] = new Map();
    return {
      get: async (st, k) => m[st].get(k), put: async (st, k, v) => { m[st].set(k, v); },
      del: async (st, k) => { m[st].delete(k); }, clear: async (st) => m[st].clear(),
      all: async (st) => Array.from(m[st].entries()),
    };
  }

  function lsMeta(name) {
    return {
      read: () => { try { return JSON.parse(localStorage.getItem(name + '.meta') || 'null'); } catch (e) { return null; } },
      write: (v) => { try { if (v === null) localStorage.removeItem(name + '.meta'); else localStorage.setItem(name + '.meta', JSON.stringify(v)); } catch (e) {} },
    };
  }
  function memMeta() { let v = null; return { read: () => v, write: (x) => { v = x; } }; }

  class Store {
    constructor(backend, meta) { this.b = backend; this.meta = meta; this.key = null; this.dk = null; }
    static async browser(name = 'kreis') { return new Store(await idbBackend(name), lsMeta(name)); }
    static memory() { return new Store(memBackend(), memMeta()); }

    state() { const m = this.meta.read(); return !m ? 'new' : m.lock ? 'locked' : 'open'; }
    async create() {
      this.dk = KC.rand(32);
      this.meta.write({ dk: KC.b64(this.dk) });
      this.key = await KC.aesKey(this.dk);
    }
    async open() {
      const m = this.meta.read();
      if (!m || !m.dk) throw new Error('gesperrt');
      this.dk = KC.ub64(m.dk);
      this.key = await KC.aesKey(this.dk);
    }
    async unlock(pin) {
      const m = this.meta.read();
      const r = await KC.unlockWithPass(pin, m.lock);
      this.dk = KC.ub64(r.dk);
      this.key = await KC.aesKey(this.dk);
    }
    async setPin(pin) {
      if (!pin) { this.meta.write({ dk: KC.b64(this.dk) }); return; }
      this.meta.write({ lock: await KC.lockWithPass(pin, { dk: KC.b64(this.dk) }) });
    }
    hasPin() { const m = this.meta.read(); return !!(m && m.lock); }

    async get(st, k) { const v = await this.b.get(st, k); return v == null ? null : KC.decJSON(this.key, v); }
    async put(st, k, v) { return this.b.put(st, k, await KC.encJSON(this.key, v)); }
    async del(st, k) { return this.b.del(st, k); }
    async all(st) {
      const out = [];
      for (const [k, v] of await this.b.all(st)) { try { out.push([k, await KC.decJSON(this.key, v)]); } catch (e) {} }
      return out;
    }
    async wipe() { for (const s of STORES) await this.b.clear(s); this.meta.write(null); }
  }

  G.KStore = Store;
  if (typeof module !== 'undefined') module.exports = Store;
})(typeof window !== 'undefined' ? window : globalThis);
