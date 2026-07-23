/* ==========================================================================
   MBMS — auth.js
   Session storage, login/logout, idle timeout, RBAC helpers.
   ========================================================================== */

const Session = (() => {
  const KEY = "mbms_session_v1";

  function get(){
    try{ return JSON.parse(sessionStorage.getItem(KEY)); }
    catch(e){ return null; }
  }
  function set(user){
    const session = {
      token: user.token || "TK-" + Date.now(),
      id: user.id, username: user.username, nama: user.nama, role: user.role,
      loginAt: Date.now(), lastActivity: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }
  function touch(){
    const s = get();
    if(s){ s.lastActivity = Date.now(); sessionStorage.setItem(KEY, JSON.stringify(s)); }
  }
  function clear(){ sessionStorage.removeItem(KEY); }
  function isValid(){
    const s = get();
    if(!s) return false;
    const idleMs = APP_CONFIG.IDLE_TIMEOUT_MINUTES * 60 * 1000;
    return (Date.now() - s.lastActivity) < idleMs;
  }
  return { get, set, touch, clear, isValid };
})();

const Auth = (() => {

  function initials(name){
    return (name||"?").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  }

  function can(moduleId){
    const menuItem = MENU.flatMap(s=>s.items).find(i=>i.id===moduleId);
    if(!menuItem) return true;
    if(!menuItem.roles) return true;
    const s = Session.get();
    return s && menuItem.roles.includes(s.role);
  }

  function isSuperAdmin(){ return Session.get()?.role === ROLES.SUPERADMIN; }

  async function logAudit(aksi, detail){
    const s = Session.get();
    try{
      await Api.create("audit_log", {
        waktu: new Date().toISOString(),
        user: s?.username || "system",
        aksi, detail, ip: "-",
      });
    }catch(e){ /* silent — audit logging must never break the UI */ }
  }

  async function login(username, password){
    const user = await Api.login(username, password);
    if(!user) return { ok:false, message:"Username atau password salah, atau akun tidak aktif." };
    Session.set(user);
    await logAudit("LOGIN", "Login berhasil sebagai " + user.role);
    return { ok:true, user };
  }

  function logout(showToast=true){
    logAudit("LOGOUT", "Logout dari sistem");
    Session.clear();
    localStorage.setItem("mbms_logout_flag","1");
    window.location.hash = "";
    window.location.reload();
  }

  // ---- Idle watcher ---------------------------------------------------
  let idleTimer = null;
  function startIdleWatcher(){
    ["click","keydown","mousemove","scroll","touchstart"].forEach(evt=>{
      document.addEventListener(evt, ()=>Session.touch(), { passive:true });
    });
    idleTimer = setInterval(()=>{
      if(Session.get() && !Session.isValid()){
        clearInterval(idleTimer);
        Swal.fire({
          icon:"warning", title:"Sesi Berakhir",
          text:"Anda tidak aktif selama " + APP_CONFIG.IDLE_TIMEOUT_MINUTES + " menit. Silakan login kembali.",
          confirmButtonColor:"#0a2540",
        }).then(()=>logout(false));
      }
    }, 15000);
  }

  return { login, logout, can, isSuperAdmin, initials, startIdleWatcher, logAudit };
})();
