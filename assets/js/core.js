/* ==========================================================================
   MBMS — core.js
   - Utils: toasts, confirmations, formatting
   - Router: hash-based SPA navigation + breadcrumb + RBAC guard
   - Sidebar: collapse / mobile toggle / active state
   - Notifications: bell panel
   - CrudModule: generic, config-driven CRUD screen (table + modal form)
     used by most simple modules (presensi, perizinan, pelanggaran, ...)
   ========================================================================== */

/* ---------------------------- TableUtil ------------------------------------
   Shared "No" (row number) column helper. Renders 1..N based on the row's
   position in the CURRENT sorted/filtered/paged view (DataTables' official
   "counter column" recipe), so numbering always matches what's on screen.
   ========================================================================== */
const TableUtil = (() => {
  function numberColumnDef(targetIndex=0){
    return {
      targets: targetIndex,
      orderable: false,
      render: function(data, type, row, meta){
        return type === "display" ? (meta.settings._iDisplayStart + meta.row + 1) : data;
      },
    };
  }
  return { numberColumnDef };
})();

/* ---------------------------- Utils -------------------------------------- */
const Utils = (() => {
  const toastMixin = Swal.mixin({
    toast:true, position:"top-end", showConfirmButton:false, timer:2600, timerProgressBar:true,
  });
  function toast(icon, title){ toastMixin.fire({ icon, title }); }

  function confirmDelete(itemLabel="data ini"){
    return Swal.fire({
      icon:"warning", title:"Hapus data?",
      html: `Anda yakin ingin menghapus <b>${itemLabel}</b>? Tindakan ini tidak dapat dibatalkan.`,
      showCancelButton:true, confirmButtonText:"Ya, hapus", cancelButtonText:"Batal",
      confirmButtonColor:"#c0392b", cancelButtonColor:"#64748b",
    }).then(r=>r.isConfirmed);
  }

  function fmtDate(iso){
    if(!iso) return "-";
    try{ return luxon.DateTime.fromISO(iso).setLocale("id").toFormat(APP_CONFIG.DATE_FORMAT); }
    catch(e){ return iso; }
  }
  function fmtDateTime(iso){
    if(!iso) return "-";
    try{ return luxon.DateTime.fromISO(iso).setLocale("id").toFormat(APP_CONFIG.DATETIME_FORMAT); }
    catch(e){ return iso; }
  }
  function fmtCurrency(n){
    n = Number(n)||0;
    return "Rp " + n.toLocaleString("id-ID");
  }
  function timeAgo(iso){
    try{ return luxon.DateTime.fromISO(iso).setLocale("id").toRelative(); }
    catch(e){ return ""; }
  }
  function escapeHtml(s){
    return String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }
  function skeletonRows(n=5){
    return Array.from({length:n}).map(()=>`<div class="skeleton skeleton-row"></div>`).join("");
  }
  function uid(prefix="ID"){ return prefix + "-" + Date.now().toString(36).toUpperCase(); }

  return { toast, confirmDelete, fmtDate, fmtDateTime, fmtCurrency, timeAgo, escapeHtml, skeletonRows, uid };
})();

/* ---------------------------- Data cache (siswa & kamar lookups) ---------- */
const Cache = (() => {
  let siswaMap = {}, kamarMap = {};
  async function refresh(){
    const [siswa, kamar] = await Promise.all([Api.list("siswa"), Api.list("kamar")]);
    siswaMap = Object.fromEntries(siswa.map(s=>[s.id,s]));
    kamarMap = Object.fromEntries(kamar.map(k=>[k.id,k]));
  }
  const siswaName = id => siswaMap[id]?.nama || "—";
  const siswaObj = id => siswaMap[id] || null;
  const kamarName = id => kamarMap[id]?.nama || "—";
  const allSiswa = () => Object.values(siswaMap);
  const allKamar = () => Object.values(kamarMap);
  return { refresh, siswaName, siswaObj, kamarName, allSiswa, allKamar };
})();

/* ---------------------------- Sidebar -------------------------------------- */
const Sidebar = (() => {
  function toggleCollapse(){
    document.getElementById("sidebar").classList.toggle("collapsed");
    document.getElementById("mainCol").classList.toggle("expanded");
  }
  function toggleMobile(){
    document.getElementById("sidebar").classList.toggle("mobile-open");
  }
  function setActive(moduleId){
    document.querySelectorAll(".nav-item").forEach(el=>{
      el.classList.toggle("active", el.dataset.module === moduleId);
    });
  }
  function build(){
    const nav = document.getElementById("sidebarNav");
    nav.innerHTML = MENU.map(section => {
      const items = section.items.filter(i => Auth.can(i.id));
      if(!items.length) return "";
      return `<div class="sidebar-section-label">${section.section}</div>` +
        items.map(i => `<div class="nav-item" data-module="${i.id}" onclick="Router.go('${i.id}')">
            <i class="${i.icon}"></i><span>${i.label}</span>
          </div>`).join("");
    }).join("");
  }
  return { toggleCollapse, toggleMobile, setActive, build };
})();

/* ---------------------------- Notifications -------------------------------- */
const Notif = (() => {
  async function refreshBadge(){
    const list = await Api.list("notifications");
    const unread = list.filter(n=>!n.dibaca).length;
    const badge = document.getElementById("notifBadgeDot");
    badge.style.display = unread ? "block" : "none";
    return list;
  }
  async function togglePanel(){
    const panel = document.getElementById("notifPanel");
    const willShow = !panel.classList.contains("show");
    panel.classList.toggle("show");
    if(willShow){
      const list = (await Api.list("notifications")).sort((a,b)=> new Date(b.waktu)-new Date(a.waktu));
      panel.innerHTML = list.length ? list.map(n=>{
        const color = { Pelanggaran:"var(--danger)", Perizinan:"var(--info)", Kesehatan:"var(--warning)" }[n.tipe] || "var(--navy)";
        return `<div class="notif-item">
          <div class="dot" style="background:${color}"></div>
          <div>
            <b style="font-size:12.5px;color:var(--navy)">${Utils.escapeHtml(n.judul)}</b>
            <div style="font-size:12px;color:var(--muted);margin:2px 0;">${Utils.escapeHtml(n.pesan)}</div>
            <small style="color:var(--muted);font-size:10.5px;">${Utils.timeAgo(n.waktu)||""}</small>
          </div>
        </div>`;
      }).join("") : `<div class="notif-item" style="justify-content:center;color:var(--muted)">Tidak ada notifikasi</div>`;
      // mark all as read
      list.forEach(n => { if(!n.dibaca) Api.update("notifications", n.id, { dibaca:true }); });
      setTimeout(refreshBadge, 400);
    }
  }
  return { refreshBadge, togglePanel };
})();

/* ---------------------------- Router --------------------------------------- */
const Router = (() => {
  const registry = {}; // id -> render(container) function
  let current = null;

  function register(id, renderFn){ registry[id] = renderFn; }

  function breadcrumb(moduleId){
    const item = MENU.flatMap(s=>s.items).find(i=>i.id===moduleId);
    const section = MENU.find(s=>s.items.some(i=>i.id===moduleId));
    document.getElementById("breadcrumbText").innerHTML =
      `${section?.section || "Menu"} <i class="fa-solid fa-chevron-right" style="font-size:9px;margin:0 6px;color:var(--muted)"></i> <b>${item?.label || moduleId}</b>`;
  }

  async function go(moduleId){
    if(!Auth.can(moduleId)){
      Utils.toast("error", "Anda tidak memiliki akses ke modul ini");
      return;
    }
    if(!registry[moduleId]){
      Utils.toast("error", "Modul belum tersedia");
      return;
    }
    current = moduleId;
    window.location.hash = moduleId;
    Sidebar.setActive(moduleId);
    breadcrumb(moduleId);
    document.getElementById("sidebar").classList.remove("mobile-open");
    const container = document.getElementById("pageContent");
    container.innerHTML = `<div class="page-content">${Utils.skeletonRows(4)}</div>`;
    try{
      await registry[moduleId](container);
    }catch(err){
      console.error(err);
      container.innerHTML = `<div class="page-content"><div class="card-mbms card-body-mbms text-center py-5">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:var(--danger)"></i>
        <p class="mt-3 mb-1">Terjadi kesalahan saat memuat modul ini.</p>
        <p style="font-size:12px;color:var(--muted);font-family:monospace">${Utils.escapeHtml(err.message || String(err))}</p></div></div>`;
    }
  }

  function init(){
    const initial = window.location.hash.replace("#","") || "dashboard";
    go(registry[initial] ? initial : "dashboard");
  }

  return { register, go, init };
})();

/* ==========================================================================
   CrudModule — generic list+form+CRUD screen factory.
   Most "simple" feature modules just call CrudModule.mount(container, cfg)
   ========================================================================== */
const CrudModule = (() => {

  function fieldInput(f, value=""){
    const req = f.required ? "required" : "";
    const val = value ?? "";
    if(f.type === "select"){
      const opts = (typeof f.options === "function" ? f.options() : f.options) || [];
      return `<select class="form-select form-control-mbms" style="padding-left:16px" id="fld_${f.name}" ${req}>
        <option value="">Pilih ${f.label}</option>
        ${opts.map(o => `<option value="${o.value}" ${String(o.value)===String(val)?"selected":""}>${o.label}</option>`).join("")}
      </select>`;
    }
    if(f.type === "textarea"){
      return `<textarea class="form-control form-control-mbms" style="padding-left:16px;height:auto;padding-top:10px" rows="${f.rows||3}" id="fld_${f.name}" ${req}>${Utils.escapeHtml(val)}</textarea>`;
    }
    const type = f.type || "text";
    return `<input type="${type}" class="form-control form-control-mbms" style="padding-left:16px" id="fld_${f.name}" value="${Utils.escapeHtml(val)}" ${req} ${f.step?`step="${f.step}"`:""}>`;
  }

  function buildFormHtml(cfg, row={}){
    return `<form id="crudForm" class="row g-3">
      ${cfg.formFields.map(f => `
        <div class="col-${f.col||12}">
          <label class="form-label-mbms">${f.label}${f.required?' <span style="color:var(--danger)">*</span>':''}</label>
          ${fieldInput(f, row[f.name])}
        </div>`).join("")}
    </form>`;
  }

  function readForm(cfg){
    const data = {};
    cfg.formFields.forEach(f => {
      const el = document.getElementById("fld_" + f.name);
      if(!el) return;
      data[f.name] = f.type === "number" ? Number(el.value) : el.value;
    });
    return data;
  }

  async function openForm(cfg, row=null){
    const isEdit = !!row;
    const result = await Swal.fire({
      title: isEdit ? `Edit ${cfg.title}` : `Tambah ${cfg.title}`,
      html: buildFormHtml(cfg, row||{}),
      width: cfg.modalWidth || 560,
      showCancelButton:true,
      confirmButtonText: isEdit ? "Simpan Perubahan" : "Simpan",
      cancelButtonText:"Batal",
      confirmButtonColor:"#0a2540",
      focusConfirm:false,
      preConfirm: () => {
        const data = readForm(cfg);
        const missing = cfg.formFields.filter(f=>f.required && !data[f.name] && data[f.name]!==0);
        if(missing.length){
          Swal.showValidationMessage("Lengkapi field wajib: " + missing.map(f=>f.label).join(", "));
          return false;
        }
        return data;
      }
    });
    if(!result.isConfirmed) return;
    let data = result.value;
    if(cfg.onBeforeSave) data = await cfg.onBeforeSave(data, row);
    try{
      if(isEdit) await Api.update(cfg.sheet, row.id, data);
      else await Api.create(cfg.sheet, data);
      Auth.logAudit(isEdit?"UPDATE":"CREATE", `${isEdit?"Mengubah":"Menambah"} data ${cfg.sheet} ${row?.id||""}`);
      Utils.toast("success", isEdit ? "Perubahan disimpan" : "Data berhasil ditambahkan");
      cfg._reload();
    }catch(e){
      Utils.toast("error", "Gagal menyimpan data");
    }
  }

  async function mount(container, cfg){
    cfg.canAdd = cfg.canAdd !== false;
    cfg.canEdit = cfg.canEdit !== false;
    cfg.canDelete = cfg.canDelete !== false;

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h3><i class="${cfg.icon}" style="color:var(--gold);margin-right:8px"></i>${cfg.title}</h3>
            <p>${cfg.subtitle||""}</p>
          </div>
          ${cfg.canAdd ? `<button class="btn btn-navy" id="btnAddCrud"><i class="fa-solid fa-plus me-1"></i> Tambah ${cfg.title}</button>` : ""}
        </div>
        <div class="card-mbms">
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="crudTable" style="width:100%">
                <thead><tr>
                  <th style="width:48px">No</th>
                  ${cfg.columns.map(c=>`<th>${c.title}</th>`).join("")}
                  ${(cfg.canEdit||cfg.canDelete||cfg.extraActions) ? "<th>Aksi</th>" : ""}
                </tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    if(cfg.canAdd) document.getElementById("btnAddCrud").onclick = () => openForm(cfg);

    let dt = null;
    cfg._reload = async () => {
      const rows = await Api.list(cfg.sheet, { filter: cfg.filter });
      if(dt) dt.destroy();
      const tbody = container.querySelector("#crudTable tbody");
      tbody.innerHTML = rows.map(row => `<tr>
          <td></td>
          ${cfg.columns.map(c => `<td>${c.render ? c.render(row) : Utils.escapeHtml(row[c.data]??"-")}</td>`).join("")}
          ${(cfg.canEdit||cfg.canDelete||cfg.extraActions) ? `<td class="text-nowrap">
            ${cfg.extraActions ? cfg.extraActions.map(a=>`<button class="btn btn-sm btn-soft-info me-1" title="${a.label}" data-act="${a.id}" data-id="${row.id}"><i class="${a.icon}"></i></button>`).join("") : ""}
            ${cfg.canEdit ? `<button class="btn btn-sm btn-soft-info me-1" title="Edit" data-act="edit" data-id="${row.id}"><i class="fa-solid fa-pen"></i></button>` : ""}
            ${cfg.canDelete ? `<button class="btn btn-sm btn-soft-danger" title="Hapus" data-act="delete" data-id="${row.id}"><i class="fa-solid fa-trash"></i></button>` : ""}
          </td>` : ""}
        </tr>`).join("") || `<tr><td colspan="${cfg.columns.length+2}" class="text-center text-muted py-4">Belum ada data</td></tr>`;

      tbody.querySelectorAll("[data-act]").forEach(btn=>{
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const act = btn.dataset.act;
          const row = rows.find(r=>r.id===id);
          if(act === "edit") return openForm(cfg, row);
          if(act === "delete"){
            const ok = await Utils.confirmDelete(row[cfg.columns[0].data] || id);
            if(!ok) return;
            await Api.remove(cfg.sheet, id);
            Auth.logAudit("DELETE", `Menghapus data ${cfg.sheet} ${id}`);
            Utils.toast("success","Data dihapus");
            cfg._reload();
            return;
          }
          const extra = cfg.extraActions?.find(a=>a.id===act);
          if(extra) extra.handler(row);
        };
      });

      dt = $(container.querySelector("#crudTable")).DataTable({
        pageLength: 10, lengthChange: true, language: {
          search:"Cari:", lengthMenu:"Tampilkan _MENU_ data", info:"_START_–_END_ dari _TOTAL_ data",
          paginate:{ previous:"‹", next:"›" }, zeroRecords:"Data tidak ditemukan", emptyTable: "Belum ada data",
        },
        columnDefs: [ TableUtil.numberColumnDef(0), { orderable:false, targets:-1 } ],
      });
    };
    await cfg._reload();
  }

  return { mount, openForm };
})();
