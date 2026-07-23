/* ==========================================================================
   MBMS — modules/siswa.js  (Data Siswa)
   Custom module: photo upload, room-history drawer, QR ID card, Excel I/O.
   ========================================================================== */
(function(){

  const FORM_FIELDS = [
    { name:"nis", label:"NIS", col:4, required:true },
    { name:"nama", label:"Nama Lengkap", col:8, required:true },
    { name:"kelas", label:"Kelas", col:4, type:"select", required:true, options:[
      {value:"VII A",label:"VII A"},{value:"VII B",label:"VII B"},
      {value:"VIII A",label:"VIII A"},{value:"VIII B",label:"VIII B"},
      {value:"IX A",label:"IX A"},{value:"IX B",label:"IX B"} ] },
    { name:"jk", label:"Jenis Kelamin", col:4, type:"select", required:true, options:[{value:"L",label:"Laki-laki"},{value:"P",label:"Perempuan"}] },
    { name:"kamarId", label:"Kamar", col:4, type:"select", required:true, options:()=>Cache.allKamar().map(k=>({value:k.id,label:k.nama})) },
    { name:"tglLahir", label:"Tanggal Lahir", col:6, type:"date" },
    { name:"alamat", label:"Alamat", col:6 },
    { name:"ortu", label:"Nama Orang Tua/Wali", col:6 },
    { name:"hpOrtu", label:"No. HP Orang Tua/Wali", col:6 },
    { name:"status", label:"Status", col:6, type:"select", required:true, options:[{value:"Aktif",label:"Aktif"},{value:"Alumni",label:"Alumni"},{value:"Nonaktif",label:"Nonaktif"}] },
  ];

  async function render(container){
    await Cache.refresh();
    const siswa = await Api.list("siswa");

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-user-graduate" style="color:var(--gold);margin-right:8px"></i>Data Siswa</h3>
          <p>Kelola profil, kamar, dan riwayat siswa asrama</p></div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-navy" id="btnImportExcel"><i class="fa-solid fa-file-import me-1"></i>Import Excel</button>
            <button class="btn btn-outline-navy" id="btnExportExcel"><i class="fa-solid fa-file-export me-1"></i>Export Excel</button>
            <button class="btn btn-navy" id="btnAddSiswa"><i class="fa-solid fa-plus me-1"></i>Tambah Siswa</button>
          </div>
        </div>
        <input type="file" id="fileImport" accept=".xlsx,.xls,.csv" class="d-none">

        <div class="card-mbms">
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="siswaTable" style="width:100%">
                <thead><tr><th>Foto</th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Kamar</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    let dt;
    async function reload(){
      const rows = await Api.list("siswa");
      await Cache.refresh();
      if(dt) dt.destroy();
      document.querySelector("#siswaTable tbody").innerHTML = rows.map(s => `<tr>
        <td>${s.foto ? `<img src="${s.foto}" class="table-avatar">` : `<div class="table-avatar d-flex align-items-center justify-content-center" style="background:var(--navy);color:#fff;font-weight:700;font-size:12px">${Auth.initials(s.nama)}</div>`}</td>
        <td>${s.nis}</td>
        <td><b style="color:var(--navy)">${Utils.escapeHtml(s.nama)}</b></td>
        <td>${s.kelas}</td>
        <td>${Cache.kamarName(s.kamarId)}</td>
        <td><span class="badge-mbms ${s.status==='Aktif'?'badge-success':'badge-navy'}">${s.status}</span></td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-soft-info me-1" data-act="detail" data-id="${s.id}" title="Detail & QR"><i class="fa-solid fa-id-card"></i></button>
          <button class="btn btn-sm btn-soft-info me-1" data-act="edit" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-soft-danger" data-act="delete" data-id="${s.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join("");

      document.querySelectorAll("#siswaTable [data-act]").forEach(btn=>{
        btn.onclick = async () => {
          const row = rows.find(r=>r.id===btn.dataset.id);
          if(btn.dataset.act==="edit") return openSiswaForm(row, reload);
          if(btn.dataset.act==="detail") return openDetail(row);
          if(btn.dataset.act==="delete"){
            const ok = await Utils.confirmDelete(row.nama);
            if(!ok) return;
            await Api.remove("siswa", row.id);
            Auth.logAudit("DELETE","Menghapus data siswa "+row.nama);
            Utils.toast("success","Data siswa dihapus");
            reload();
          }
        };
      });

      dt = $("#siswaTable").DataTable({ pageLength:10, language:{ search:"Cari:", zeroRecords:"Data tidak ditemukan" }, columnDefs:[{orderable:false, targets:[0,6]}] });
    }

    document.getElementById("btnAddSiswa").onclick = () => openSiswaForm(null, reload);
    document.getElementById("btnExportExcel").onclick = () => Reports.exportExcel(siswa.map(s=>({
      NIS:s.nis, Nama:s.nama, Kelas:s.kelas, JK:s.jk, Kamar:Cache.kamarName(s.kamarId), Status:s.status, OrangTua:s.ortu, HP:s.hpOrtu,
    })), "Data_Siswa_MBMS");
    document.getElementById("btnImportExcel").onclick = () => document.getElementById("fileImport").click();
    document.getElementById("fileImport").onchange = async (e) => {
      const file = e.target.files[0]; if(!file) return;
      const rows = await Reports.readExcel(file);
      let count = 0;
      for(const r of rows){
        await Api.create("siswa", {
          nis: String(r.NIS||r.nis||""), nama: r.Nama||r.nama||"", kelas: r.Kelas||r.kelas||"VII A",
          jk: r.JK||r.jk||"L", kamarId: Cache.allKamar()[0]?.id||"", status:"Aktif",
          tglLahir:"", alamat:r.Alamat||"", ortu:r.OrangTua||"", hpOrtu:r.HP||"",
        });
        count++;
      }
      Utils.toast("success", `${count} data siswa berhasil diimpor`);
      reload();
    };

    reload();
  }

  async function openSiswaForm(row, onSaved){
    const isEdit = !!row;
    let photoData = row?.foto || "";
    const html = `
      <div class="row g-3">
        <div class="col-12">
          <div class="dropzone" id="dz">
            ${photoData ? `<img src="${photoData}" style="width:90px;height:90px;object-fit:cover;border-radius:10px">` : `<i class="fa-solid fa-camera fa-2x mb-2"></i><div>Klik atau drag & drop foto siswa</div>`}
            <input type="file" id="photoInput" accept="image/*" class="d-none">
          </div>
        </div>
        ${FORM_FIELDS.map(f=>{
          const optHtml = f.type==="select" ? (typeof f.options==='function'?f.options():f.options).map(o=>`<option value="${o.value}" ${row&&String(row[f.name])===String(o.value)?"selected":""}>${o.label}</option>`).join("") : "";
          return `<div class="col-${f.col}">
            <label class="form-label-mbms">${f.label}${f.required?' <span style="color:var(--danger)">*</span>':''}</label>
            ${f.type==="select"
              ? `<select class="form-select form-control-mbms" style="padding-left:16px" id="fld_${f.name}" ${f.required?"required":""}><option value="">Pilih</option>${optHtml}</select>`
              : `<input type="${f.type||'text'}" class="form-control form-control-mbms" style="padding-left:16px" id="fld_${f.name}" value="${Utils.escapeHtml(row?.[f.name]||'')}" ${f.required?"required":""}>`}
          </div>`;
        }).join("")}
      </div>`;

    const result = await Swal.fire({
      title: isEdit ? "Edit Data Siswa" : "Tambah Data Siswa",
      html, width: 680, showCancelButton:true, confirmButtonColor:"#0a2540",
      confirmButtonText: isEdit?"Simpan Perubahan":"Simpan", cancelButtonText:"Batal",
      didOpen: () => {
        const dz = document.getElementById("dz");
        const inp = document.getElementById("photoInput");
        dz.onclick = () => inp.click();
        dz.ondragover = (e)=>{ e.preventDefault(); dz.classList.add("dragover"); };
        dz.ondragleave = ()=> dz.classList.remove("dragover");
        dz.ondrop = (e)=>{ e.preventDefault(); dz.classList.remove("dragover"); handleFile(e.dataTransfer.files[0]); };
        inp.onchange = (e)=> handleFile(e.target.files[0]);
        function handleFile(file){
          if(!file) return;
          const reader = new FileReader();
          reader.onload = ev => { photoData = ev.target.result; dz.innerHTML = `<img src="${photoData}" style="width:90px;height:90px;object-fit:cover;border-radius:10px">`; };
          reader.readAsDataURL(file);
        }
      },
      preConfirm: () => {
        const data = { foto: photoData };
        let missing = [];
        FORM_FIELDS.forEach(f=>{
          const el = document.getElementById("fld_"+f.name);
          data[f.name] = el.value;
          if(f.required && !el.value) missing.push(f.label);
        });
        if(missing.length){ Swal.showValidationMessage("Lengkapi: "+missing.join(", ")); return false; }
        return data;
      }
    });
    if(!result.isConfirmed) return;
    if(isEdit) await Api.update("siswa", row.id, result.value);
    else await Api.create("siswa", result.value);
    Auth.logAudit(isEdit?"UPDATE":"CREATE", `${isEdit?"Mengubah":"Menambah"} data siswa ${result.value.nama}`);
    Utils.toast("success", isEdit?"Perubahan disimpan":"Siswa berhasil ditambahkan");
    onSaved();
  }

  async function openDetail(s){
    const qrId = "qr_" + s.id.replace(/\W/g,"");
    await Swal.fire({
      title: s.nama,
      html: `<div class="row g-3 text-start">
        <div class="col-4 text-center">
          ${s.foto ? `<img src="${s.foto}" style="width:100%;border-radius:12px;aspect-ratio:1/1;object-fit:cover">` : `<div style="width:100%;aspect-ratio:1/1;background:var(--navy);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700">${Auth.initials(s.nama)}</div>`}
          <div id="${qrId}" class="d-flex justify-content-center mt-3"></div>
          <small class="text-muted d-block mt-1">Kartu Identitas Digital</small>
        </div>
        <div class="col-8">
          <table class="table table-sm">
            <tr><td class="text-muted">NIS</td><td><b>${s.nis}</b></td></tr>
            <tr><td class="text-muted">Kelas</td><td>${s.kelas}</td></tr>
            <tr><td class="text-muted">Kamar</td><td>${Cache.kamarName(s.kamarId)}</td></tr>
            <tr><td class="text-muted">Tgl Lahir</td><td>${Utils.fmtDate(s.tglLahir)}</td></tr>
            <tr><td class="text-muted">Orang Tua</td><td>${s.ortu||"-"}</td></tr>
            <tr><td class="text-muted">No. HP</td><td>${s.hpOrtu||"-"}</td></tr>
            <tr><td class="text-muted">Status</td><td><span class="badge-mbms badge-success">${s.status}</span></td></tr>
          </table>
        </div>
      </div>`,
      width:640, confirmButtonText:"Tutup", confirmButtonColor:"#0a2540",
      didOpen: () => {
        if(window.QRCode){
          new QRCode(document.getElementById(qrId), { text: `MBMS|${s.id}|${s.nis}|${s.nama}`, width:110, height:110, colorDark:"#0a2540", colorLight:"#ffffff" });
        }
      }
    });
  }

  Router.register("siswa", render);
})();
