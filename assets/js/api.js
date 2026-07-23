/* ==========================================================================
   MBMS — api.js
   Unified data-access layer. Every module calls Api.list/get/create/update
   /remove(sheetName, ...) — the same call works whether BACKEND_MODE is
   "mock" (Google Sheets simulated with localStorage) or "gas" (the real
   Google Apps Script Web App defined in /backend/Code.gs).
   ========================================================================== */

const Api = (() => {

  const LS_KEY = "mbms_db_v1";

  // ---- Mock (localStorage) engine ---------------------------------------
  function loadDb(){
    let raw = localStorage.getItem(LS_KEY);
    if(!raw){
      const seed = cloneSeed();
      localStorage.setItem(LS_KEY, JSON.stringify(seed));
      return seed;
    }
    try{ return JSON.parse(raw); }
    catch(e){ const seed = cloneSeed(); localStorage.setItem(LS_KEY, JSON.stringify(seed)); return seed; }
  }
  function saveDb(db){ localStorage.setItem(LS_KEY, JSON.stringify(db)); }

  function genId(prefix){
    return prefix + "-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random()*90+10);
  }

  function mockList(sheet, params={}){
    const db = loadDb();
    let rows = db[sheet] ? [...db[sheet]] : [];
    if(params.filter){
      Object.entries(params.filter).forEach(([k,v])=>{
        if(v !== undefined && v !== null && v !== "") rows = rows.filter(r => String(r[k]) === String(v));
      });
    }
    return Promise.resolve(rows);
  }
  function mockGet(sheet, id){
    const db = loadDb();
    return Promise.resolve((db[sheet]||[]).find(r=>r.id===id) || null);
  }
  function mockCreate(sheet, data){
    const db = loadDb();
    if(!db[sheet]) db[sheet] = [];
    const row = { id: data.id || genId(sheet.slice(0,2).toUpperCase()), ...data };
    db[sheet].push(row);
    saveDb(db);
    return Promise.resolve(row);
  }
  function mockUpdate(sheet, id, data){
    const db = loadDb();
    const arr = db[sheet]||[];
    const idx = arr.findIndex(r=>r.id===id);
    if(idx===-1) return Promise.reject(new Error("Data tidak ditemukan"));
    arr[idx] = { ...arr[idx], ...data, id };
    saveDb(db);
    return Promise.resolve(arr[idx]);
  }
  function mockRemove(sheet, id){
    const db = loadDb();
    db[sheet] = (db[sheet]||[]).filter(r=>r.id!==id);
    saveDb(db);
    return Promise.resolve({ ok:true });
  }
  function mockReset(){
    localStorage.removeItem(LS_KEY);
    loadDb();
    return Promise.resolve({ ok:true });
  }

  // ---- Real Google Apps Script REST engine -------------------------------
  // Contract (see backend/Code.gs):
  //   GET    ?action=list&sheet=siswa&token=...
  //   GET    ?action=get&sheet=siswa&id=S-0001&token=...
  //   POST   { action:"create", sheet, data, token }
  //   POST   { action:"update", sheet, id, data, token }
  //   POST   { action:"delete", sheet, id, token }
  // Apps Script Web Apps only accept GET/POST, so PUT/DELETE are simulated
  // via the `action` field in the POST body (documented in README).
  function authToken(){ return Session.get()?.token || ""; }

  function gasGet(params){
    const url = new URL(APP_CONFIG.API_URL);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    url.searchParams.set("token", authToken());
    return fetch(url.toString())
      .then(r => r.json())
      .catch(err => { throw new Error("Gagal menghubungi backend Google Apps Script: " + err.message); });
  }
  function gasPost(body){
    return fetch(APP_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight on Apps Script
      body: JSON.stringify({ ...body, token: authToken() }),
    })
      .then(r => r.json())
      .catch(err => { throw new Error("Gagal menghubungi backend Google Apps Script: " + err.message); });
  }

  function unwrap(promise){
    return promise.then(r => {
      if(!r || r.ok === false) throw new Error(r?.message || "Backend mengembalikan respons tidak valid");
      return r.data;
    });
  }

  function gasList(sheet, params={}){ return unwrap(gasGet({ action:"list", sheet, filter: JSON.stringify(params.filter||{}) })); }
  function gasGetOne(sheet, id){ return unwrap(gasGet({ action:"get", sheet, id })); }
  function gasCreate(sheet, data){ return unwrap(gasPost({ action:"create", sheet, data })); }
  function gasUpdate(sheet, id, data){ return unwrap(gasPost({ action:"update", sheet, id, data })); }
  function gasRemove(sheet, id){ return gasPost({ action:"delete", sheet, id }); }

  // ---- Public unified API -------------------------------------------------
  const isMock = () => APP_CONFIG.BACKEND_MODE === "mock";

  return {
    list:   (sheet, params) => isMock() ? mockList(sheet, params)      : gasList(sheet, params),
    get:    (sheet, id)     => isMock() ? mockGet(sheet, id)           : gasGetOne(sheet, id),
    create: (sheet, data)   => isMock() ? mockCreate(sheet, data)      : gasCreate(sheet, data),
    update: (sheet, id, d)  => isMock() ? mockUpdate(sheet, id, d)     : gasUpdate(sheet, id, d),
    remove: (sheet, id)     => isMock() ? mockRemove(sheet, id)        : gasRemove(sheet, id),
    resetMockDb: mockReset,
    login: (username, password) => {
      if(isMock()){
        const db = loadDb();
        const u = (db.users||[]).find(u => u.username===username && u.password===password && u.status==="Aktif");
        return Promise.resolve(u ? { ...u, token: genId("TK") } : null);
      }
      return gasPost({ action:"login", username, password }).then(r=>r.data);
    },
  };
})();
