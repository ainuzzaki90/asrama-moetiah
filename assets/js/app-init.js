/* ==========================================================================
   MBMS — app-init.js
   Boots the login screen or the app shell depending on session state,
   wires dark mode, and registers the PWA service worker.
   ========================================================================== */

const ThemeManager = (() => {
  const KEY = "mbms_theme";
  function apply(theme){
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }
  function init(){ apply(localStorage.getItem(KEY) || "light"); }
  function toggle(isDark){ apply(isDark ? "dark" : "light"); }
  return { init, toggle };
})();

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();

  // Fill in static branded text
  document.querySelectorAll(".js-app-name").forEach(el=>el.textContent = APP_CONFIG.APP_NAME);
  document.querySelectorAll(".js-app-subtitle").forEach(el=>el.textContent = APP_CONFIG.SUBTITLE);
  document.querySelectorAll(".js-wali-asrama").forEach(el=>el.textContent = APP_CONFIG.WALI_ASRAMA);

  if(Session.get() && Session.isValid()){
    showApp();
  }else{
    Session.clear();
    showLogin();
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("btnLogin");
    btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa...`;
    const res = await Auth.login(username, password);
    btn.disabled = false; btn.innerHTML = "Masuk ke Sistem";
    if(!res.ok){
      Utils.toast("error", res.message);
      return;
    }
    Utils.toast("success", `Selamat datang, ${res.user.nama}`);
    setTimeout(showApp, 400);
  });

  // Register service worker for PWA support
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(()=>{ /* offline dev environments may block this */ });
  }
});

function showLogin(){
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("appShell").style.display = "none";
}

function showApp(){
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").style.display = "flex";

  const s = Session.get();
  document.getElementById("userNameChip").textContent = s.nama;
  document.getElementById("userRoleChip").textContent = s.role;
  document.getElementById("userAvatarInitials").textContent = Auth.initials(s.nama);

  Sidebar.build();
  Auth.startIdleWatcher();
  Notif.refreshBadge();
  Router.init();
}

function handleLogout(){
  Swal.fire({
    icon:"question", title:"Keluar dari sistem?", showCancelButton:true,
    confirmButtonText:"Ya, keluar", cancelButtonText:"Batal", confirmButtonColor:"#0a2540",
  }).then(r=>{ if(r.isConfirmed) Auth.logout(); });
}
