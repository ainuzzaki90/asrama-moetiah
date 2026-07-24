/* ==========================================================================
   MBMS — modules/simpleModules.js
   Straightforward feature modules built on top of CrudModule, plus a
   couple of lightly-customized ones (kebersihan photo checklist, settings).
   ========================================================================== */
(function(){

  const siswaOptions = () => Cache.allSiswa().map(s=>({ value:s.id, label: `${s.nama} (${s.kelas})` }));
  const siswaCol = { data:"siswaId", title:"Siswa", render: r => Cache.siswaName(r.siswaId) };

  /* ---------------- Presensi Harian --------------------------------- */
  Router.register("presensi", async (container) => {
    await Cache.refresh();
    CrudModule.mount(container, {
      title:"Presensi Harian", subtitle:"Rekap kehadiran bangun pagi, sholat, mengaji, sekolah, dan tidur malam",
      icon:"fa-solid fa-clipboard-check", sheet:"presensi",
      columns:[
        { data:"tanggal", title:"Tanggal", render:r=>Utils.fmtDate(r.tanggal) }, siswaCol,
        { data:"bangun", title:"Bangun", render:r=>statusBadge(r.bangun) },
        { data:"sholat", title:"Sholat", render:r=>statusBadge(r.sholat) },
        { data:"mengaji", title:"Mengaji", render:r=>statusBadge(r.mengaji) },
        { data:"sekolah", title:"Sekolah", render:r=>statusBadge(r.sekolah) },
        { data:"tidur", title:"Tidur", render:r=>statusBadge(r.tidur) },
      ],
      formFields:[
        { name:"tanggal", label:"Tanggal", type:"date", col:6, required:true },
        { name:"siswaId", label:"Siswa", type:"select", col:6, required:true, options: siswaOptions },
        { name:"bangun", label:"Bangun Pagi", type:"select", col:4, required:true, options: statusOpts() },
        { name:"sholat", label:"Sholat Berjamaah", type:"select", col:4, required:true, options: statusOpts() },
        { name:"mengaji", label:"Mengaji", type:"select", col:4, required:true, options: statusOpts() },
        { name:"sekolah", label:"Sekolah", type:"select", col:6, required:true, options: statusOpts() },
        { name:"tidur", label:"Tidur Malam", type:"select", col:6, required:true, options: statusOpts() },
        { name:"keterangan", label:"Keterangan", type:"textarea", col:12 },
      ],
    });
  });
  function statusOpts(){ return [{value:"Hadir",label:"Hadir"},{value:"Izin",label:"Izin"},{value:"Sakit",label:"Sakit"},{value:"Alpa",label:"Alpa"}]; }
  function statusBadge(v){
    const cls = v==="Hadir"?"badge-success":v==="Alpa"?"badge-danger":v==="Sakit"?"badge-warning":"badge-info";
    return `<span class="badge-mbms ${cls}">${v||"-"}</span>`;
  }

  /* ---------------- Perizinan Siswa ---------------------------------- */
  Router.register("perizinan", async (container) => {
    await Cache.refresh();
    CrudModule.mount(container, {
      title:"Perizinan Siswa", subtitle:"Catatan izin pulang, sakit, dan keperluan lain",
      icon:"fa-solid fa-right-from-bracket", sheet:"perizinan",
      columns:[
        siswaCol, { data:"jenis", title:"Jenis Izin" },
        { data:"tglKeluar", title:"Keluar", render:r=>Utils.fmtDate(r.tglKeluar) },
        { data:"tglKembali", title:"Kembali", render:r=>Utils.fmtDate(r.tglKembali) },
        { data:"status", title:"Status", render:r=>`<span class="badge-mbms ${r.status==='Kembali'?'badge-success':'badge-warning'}">${r.status}</span>` },
      ],
      formFields:[
        { name:"siswaId", label:"Siswa", type:"select", col:12, required:true, options: siswaOptions },
        { name:"jenis", label:"Jenis Izin", type:"select", col:6, required:true, options:[
          {value:"Pulang Akhir Pekan",label:"Pulang Akhir Pekan"},{value:"Sakit",label:"Sakit"},
          {value:"Acara Keluarga",label:"Acara Keluarga"},{value:"Lainnya",label:"Lainnya"} ] },
        { name:"status", label:"Status", type:"select", col:6, required:true, options:[{value:"Berjalan",label:"Berjalan"},{value:"Kembali",label:"Kembali"}] },
        { name:"tglKeluar", label:"Tanggal Keluar", type:"date", col:6, required:true },
        { name:"tglKembali", label:"Tanggal Kembali", type:"date", col:6 },
        { name:"penjemput", label:"Nama Penjemput", col:6 },
        { name:"disetujuiOleh", label:"Disetujui Oleh", col:6 },
        { name:"alasan", label:"Alasan", type:"textarea", col:12 },
      ],
    });
  });

  /* ---------------- Pelanggaran & Pembinaan --------------------------- */
  Router.register("pelanggaran", async (container) => {
    await Cache.refresh();
    CrudModule.mount(container, {
      title:"Pelanggaran & Pembinaan", subtitle:"Pencatatan pelanggaran dan tindak lanjut pembinaan siswa",
      icon:"fa-solid fa-triangle-exclamation", sheet:"pelanggaran",
      columns:[
        siswaCol, { data:"tanggal", title:"Tanggal", render:r=>Utils.fmtDate(r.tanggal) },
        { data:"kategori", title:"Kategori", render:r=>`<span class="badge-mbms ${r.kategori==='Berat'?'badge-danger':r.kategori==='Sedang'?'badge-warning':'badge-info'}">${r.kategori}</span>` },
        { data:"jenis", title:"Jenis Pelanggaran" }, { data:"poin", title:"Poin" },
        { data:"status", title:"Status", render:r=>`<span class="badge-mbms ${r.status==='Selesai'?'badge-success':'badge-warning'}">${r.status}</span>` },
      ],
      formFields:[
        { name:"siswaId", label:"Siswa", type:"select", col:12, required:true, options: siswaOptions },
        { name:"tanggal", label:"Tanggal", type:"date", col:6, required:true },
        { name:"kategori", label:"Kategori", type:"select", col:6, required:true, options:[{value:"Ringan",label:"Ringan"},{value:"Sedang",label:"Sedang"},{value:"Berat",label:"Berat"}] },
        { name:"jenis", label:"Jenis Pelanggaran", col:8, required:true },
        { name:"poin", label:"Poin", type:"number", col:4, required:true },
        { name:"tindakan", label:"Tindakan Pembinaan", type:"textarea", col:12 },
        { name:"pembina", label:"Pembina", col:6 },
        { name:"status", label:"Status", type:"select", col:6, required:true, options:[{value:"Proses",label:"Proses"},{value:"Selesai",label:"Selesai"}] },
      ],
      onBeforeSave: async (data) => {
        await Api.create("notifications", { tipe:"Pelanggaran", judul:"Pelanggaran baru", pesan:`${Cache.siswaName(data.siswaId)} — ${data.jenis}`, dibaca:false, waktu:new Date().toISOString() });
        Notif.refreshBadge();
        return data;
      }
    });
  });

  /* ---------------- Prestasi Siswa ------------------------------------ */
  Router.register("prestasi", async (container) => {
    await Cache.refresh();
    CrudModule.mount(container, {
      title:"Prestasi Siswa", subtitle:"Pencatatan pencapaian akademik, tahfidz, dan non-akademik",
      icon:"fa-solid fa-medal", sheet:"prestasi",
      columns:[ siswaCol, { data:"tanggal", title:"Tanggal", render:r=>Utils.fmtDate(r.tanggal) },
        { data:"kategori", title:"Kategori" }, { data:"nama", title:"Prestasi" }, { data:"tingkat", title:"Tingkat" } ],
      formFields:[
        { name:"siswaId", label:"Siswa", type:"select", col:12, required:true, options: siswaOptions },
        { name:"tanggal", label:"Tanggal", type:"date", col:6, required:true },
        { name:"kategori", label:"Kategori", type:"select", col:6, required:true, options:[{value:"Akademik",label:"Akademik"},{value:"Tahfidz",label:"Tahfidz"},{value:"Non-Akademik",label:"Non-Akademik"}] },
        { name:"nama", label:"Nama Prestasi", col:8, required:true },
        { name:"tingkat", label:"Tingkat", type:"select", col:4, options:[{value:"Internal Asrama",label:"Internal Asrama"},{value:"Sekolah",label:"Sekolah"},{value:"Kabupaten",label:"Kabupaten"},{value:"Provinsi",label:"Provinsi"},{value:"Nasional",label:"Nasional"}] },
        { name:"penghargaan", label:"Penghargaan", col:12 },
      ],
    });
  });

  /* ---------------- Inventaris Siswa ----------------------------------- */
  Router.register("inventaris", async (container) => {
    await Cache.refresh();
    CrudModule.mount(container, {
      title:"Inventaris Siswa", subtitle:"Barang milik siswa yang disimpan/digunakan di asrama",
      icon:"fa-solid fa-box-archive", sheet:"inventaris",
      columns:[ siswaCol, { data:"nama", title:"Nama Barang" }, { data:"jumlah", title:"Jumlah" },
        { data:"kondisi", title:"Kondisi", render:r=>`<span class="badge-mbms ${r.kondisi==='Baik'?'badge-success':r.kondisi==='Rusak Ringan'?'badge-warning':'badge-danger'}">${r.kondisi}</span>` },
        { data:"tglMasuk", title:"Tgl Masuk", render:r=>Utils.fmtDate(r.tglMasuk) } ],
      formFields:[
        { name:"siswaId", label:"Siswa", type:"select", col:12, required:true, options: siswaOptions },
        { name:"nama", label:"Nama Barang", col:8, required:true },
        { name:"jumlah", label:"Jumlah", type:"number", col:4, required:true },
        { name:"kondisi", label:"Kondisi", type:"select", col:6, required:true, options:[{value:"Baik",label:"Baik"},{value:"Rusak Ringan",label:"Rusak Ringan"},{value:"Rusak Berat",label:"Rusak Berat"}] },
        { name:"tglMasuk", label:"Tanggal Masuk", type:"date", col:6, required:true },
      ],
    });
  });

  /* ---------------- Kebersihan Kamar (custom: before/after photo) ------- */
  Router.register("kebersihan", async (container) => {
    await Cache.refresh();
    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-broom" style="color:var(--gold);margin-right:8px"></i>Kebersihan Kamar</h3>
          <p>Checklist kebersihan dengan dokumentasi foto sebelum/sesudah</p></div>
          <button class="btn btn-navy" id="btnAddKB"><i class="fa-solid fa-plus me-1"></i>Tambah Penilaian</button>
        </div>
        <div class="row g-3" id="kbGrid"></div>
      </div>`;

    async function reload(){
      const rows = (await Api.list("kebersihan")).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
      document.getElementById("kbGrid").innerHTML = rows.map(r=>`
        <div class="col-md-6 col-xl-4">
          <div class="card-mbms card-body-mbms">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div><b style="color:var(--navy)">${Cache.kamarName(r.kamarId)}</b><div style="font-size:12px;color:var(--muted)">${Utils.fmtDate(r.tanggal)} · ${Utils.escapeHtml(r.petugas)}</div></div>
              <span class="badge-mbms ${r.skor>=80?'badge-success':r.skor>=60?'badge-warning':'badge-danger'}">${r.skor}/100</span>
            </div>
            <div class="before-after mb-2">
              <div class="ph">${r.fotoSebelum?`<img src="${r.fotoSebelum}">`:"Sebelum"}</div>
              <div class="ph">${r.fotoSesudah?`<img src="${r.fotoSesudah}">`:"Sesudah"}</div>
            </div>
            <p style="font-size:12.5px;color:var(--muted);margin:0">${Utils.escapeHtml(r.catatan||"-")}</p>
            <div class="d-flex gap-1 mt-2">
              <button class="btn btn-sm btn-soft-info flex-fill" data-act="edit" data-id="${r.id}"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-soft-danger flex-fill" data-act="delete" data-id="${r.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>`).join("") || `<div class="col-12 text-center text-muted py-5">Belum ada penilaian kebersihan</div>`;

      document.querySelectorAll("#kbGrid [data-act]").forEach(btn=>{
        btn.onclick = async ()=>{
          const row = rows.find(r=>r.id===btn.dataset.id);
          if(btn.dataset.act==="edit") return openKbForm(row, reload);
          const ok = await Utils.confirmDelete("penilaian ini");
          if(!ok) return;
          await Api.remove("kebersihan", row.id);
          Utils.toast("success","Data dihapus");
          reload();
        };
      });
    }
    document.getElementById("btnAddKB").onclick = () => openKbForm(null, reload);
    reload();
  });

  async function openKbForm(row, onSaved){
    const isEdit = !!row;
    let before = row?.fotoSebelum || "", after = row?.fotoSesudah || "";
    const result = await Swal.fire({
      title: isEdit?"Edit Penilaian Kebersihan":"Tambah Penilaian Kebersihan", width:600, showCancelButton:true,
      confirmButtonColor:"#0a2540", confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<div class="row g-3 text-start">
        <div class="col-6"><label class="form-label-mbms">Tanggal</label><input type="date" id="f_tgl" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.tanggal||luxon.DateTime.now().toISODate()}"></div>
        <div class="col-6"><label class="form-label-mbms">Kamar</label><select id="f_kamar" class="form-select form-control-mbms" style="padding-left:16px">${Cache.allKamar().map(k=>`<option value="${k.id}" ${row?.kamarId===k.id?'selected':''}>${k.nama}</option>`).join("")}</select></div>
        <div class="col-6"><label class="form-label-mbms">Petugas Piket</label><input id="f_petugas" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.petugas||''}"></div>
        <div class="col-6"><label class="form-label-mbms">Skor (0-100)</label><input type="number" id="f_skor" min="0" max="100" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.skor||80}"></div>
        <div class="col-6"><label class="form-label-mbms">Foto Sebelum</label><div class="dropzone" id="dzBefore" style="padding:14px">${before?`<img src="${before}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`:'<i class="fa-solid fa-image"></i> Upload'}<input type="file" class="d-none" id="inpBefore" accept="image/*"></div></div>
        <div class="col-6"><label class="form-label-mbms">Foto Sesudah</label><div class="dropzone" id="dzAfter" style="padding:14px">${after?`<img src="${after}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`:'<i class="fa-solid fa-image"></i> Upload'}<input type="file" class="d-none" id="inpAfter" accept="image/*"></div></div>
        <div class="col-12"><label class="form-label-mbms">Catatan</label><textarea id="f_catatan" class="form-control form-control-mbms" style="padding-left:16px;height:auto;padding-top:10px" rows="2">${row?.catatan||''}</textarea></div>
      </div>`,
      didOpen: () => {
        wireDropzone("dzBefore","inpBefore", v=>before=v);
        wireDropzone("dzAfter","inpAfter", v=>after=v);
      },
      preConfirm: () => ({
        tanggal: document.getElementById("f_tgl").value, kamarId: document.getElementById("f_kamar").value,
        petugas: document.getElementById("f_petugas").value, skor: Number(document.getElementById("f_skor").value),
        catatan: document.getElementById("f_catatan").value, fotoSebelum: before, fotoSesudah: after,
      })
    });
    if(!result.isConfirmed) return;
    if(isEdit) await Api.update("kebersihan", row.id, result.value); else await Api.create("kebersihan", result.value);
    Auth.logAudit(isEdit?"UPDATE":"CREATE","Penilaian kebersihan kamar");
    Utils.toast("success","Penilaian kebersihan disimpan");
    onSaved();
  }
  function wireDropzone(dzId, inpId, onLoad){
    const dz = document.getElementById(dzId), inp = document.getElementById(inpId);
    dz.onclick = () => inp.click();
    inp.onchange = (e) => {
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ev => { onLoad(ev.target.result); dz.innerHTML = `<img src="${ev.target.result}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`; };
      reader.readAsDataURL(file);
    };
  }

  /* ---------------- Audit Log (Super Admin) ------------------------------ */
  Router.register("auditlog", async (container) => {
    if(!Auth.isSuperAdmin()){
      container.innerHTML = `<div class="page-content"><div class="card-mbms card-body-mbms text-center py-5"><i class="fa-solid fa-lock" style="font-size:32px;color:var(--danger)"></i><p class="mt-3 mb-0">Hanya Super Admin yang dapat mengakses Audit Log.</p></div></div>`;
      return;
    }
    CrudModule.mount(container, {
      title:"Audit Log", subtitle:"Jejak aktivitas seluruh pengguna sistem (read-only)",
      icon:"fa-solid fa-shield-halved", sheet:"audit_log", canAdd:false, canEdit:false,
      columns:[
        { data:"waktu", title:"Waktu", render:r=>Utils.fmtDateTime(r.waktu) },
        { data:"user", title:"Pengguna" }, { data:"aksi", title:"Aksi", render:r=>`<span class="badge-mbms badge-navy">${r.aksi}</span>` },
        { data:"detail", title:"Detail" },
      ],
      formFields:[],
    });
  });

  /* ---------------- Settings ---------------------------------------------- */
  Router.register("settings", async (container) => {
    const s = Session.get();
    const dark = document.documentElement.dataset.theme === "dark";
    container.innerHTML = `<div class="page-content">
      <div class="page-header"><div><h3><i class="fa-solid fa-gear" style="color:var(--gold);margin-right:8px"></i>Pengaturan</h3><p>Preferensi tampilan &amp; informasi akun</p></div></div>
      <div class="row g-3">
        <div class="col-lg-6">
          <div class="card-mbms card-body-mbms">
            <h6 class="mb-3">Tampilan</h6>
            <div class="d-flex align-items-center justify-content-between">
              <div><b style="font-size:13.5px">Dark Mode</b><div style="font-size:12px;color:var(--muted)">Ubah skema warna aplikasi</div></div>
              <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="darkSwitch" style="width:44px;height:24px" ${dark?"checked":""}></div>
            </div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card-mbms card-body-mbms">
            <h6 class="mb-3">Akun Saya</h6>
            <table class="table table-sm mb-0">
              <tr><td class="text-muted">Nama</td><td><b>${s.nama}</b></td></tr>
              <tr><td class="text-muted">Username</td><td>${s.username}</td></tr>
              <tr><td class="text-muted">Role</td><td><span class="badge-mbms badge-navy">${s.role}</span></td></tr>
            </table>
          </div>
        </div>
        ${APP_CONFIG.BACKEND_MODE==="mock" ? `<div class="col-12">
          <div class="card-mbms card-body-mbms">
            <h6 class="mb-2">Mode Demo (localStorage)</h6>
            <p style="font-size:12.5px;color:var(--muted)">Aplikasi berjalan dalam mode demo menggunakan penyimpanan lokal browser. Hubungkan ke backend Google Apps Script (lihat README) untuk data multi-pengguna yang persisten.</p>
            <button class="btn btn-outline-navy" id="btnResetDemo"><i class="fa-solid fa-rotate-left me-1"></i>Reset Data Demo</button>
          </div></div>` : ""}
      </div>
    </div>`;
    document.getElementById("darkSwitch").onchange = (e) => ThemeManager.toggle(e.target.checked);
    const btnReset = document.getElementById("btnResetDemo");
    if(btnReset) btnReset.onclick = async () => {
      const ok = await Utils.confirmDelete("seluruh data demo (kembali ke data awal)");
      if(!ok) return;
      await Api.resetMockDb();
      Utils.toast("success","Data demo direset");
      Router.go("dashboard");
    };
  });

})();
