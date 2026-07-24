/* ==========================================================================
   MBMS — modules/kesehatan.js  (Kesehatan Siswa)
   ----------------------------------------------------------------------
   Each visit/record can have any number of file attachments (surat
   keterangan sakit, hasil rontgen, foto luka, dll). Files are uploaded to
   Google Drive via Api.uploadFile (see api.js / Code.gs `uploadFile`
   action) and only the resulting shareable URL is stored in the sheet —
   this keeps cells small regardless of how large the original file is.
   In demo/mock mode (no backend), files are kept inline as data URLs so
   the feature still works fully offline.
   ========================================================================== */
(function(){

  function parseLampiran(json){ try{ const v = JSON.parse(json||"[]"); return Array.isArray(v)?v:[]; }catch(e){ return []; } }

  async function render(container){
    await Cache.refresh();
    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-kit-medical" style="color:var(--gold);margin-right:8px"></i>Kesehatan Siswa</h3>
          <p>Riwayat kunjungan UKS &amp; penanganan, lengkap dengan lampiran dokumen medis</p></div>
          <button class="btn btn-navy" id="btnAddKesehatan"><i class="fa-solid fa-plus me-1"></i>Tambah Catatan</button>
        </div>
        <div class="card-mbms">
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="ksTable" style="width:100%">
                <thead><tr><th style="width:48px">No</th><th>Tanggal</th><th>Siswa</th><th>Keluhan</th><th>Dirujuk?</th><th>Lampiran</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    let dt;
    async function reload(){
      const rows = (await Api.list("kesehatan")).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
      if(dt) dt.destroy();
      document.querySelector("#ksTable tbody").innerHTML = rows.map(r=>{
        const lamp = parseLampiran(r.lampiran);
        return `<tr>
          <td></td>
          <td>${Utils.fmtDate(r.tanggal)}</td>
          <td><b style="color:var(--navy)">${Cache.siswaName(r.siswaId)}</b></td>
          <td>${Utils.escapeHtml(r.keluhan)}</td>
          <td><span class="badge-mbms ${r.statusRujuk==='Ya'?'badge-danger':'badge-success'}">${r.statusRujuk}</span></td>
          <td>${lamp.length ? `<span class="badge-mbms badge-info"><i class="fa-solid fa-paperclip me-1"></i>${lamp.length} file</span>` : '<span class="text-muted" style="font-size:12px">-</span>'}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-navy me-1" data-act="riwayat" data-id="${r.id}" title="Riwayat siswa ini"><i class="fa-solid fa-clock-rotate-left"></i></button>
            <button class="btn btn-sm btn-soft-info me-1" data-act="edit" data-id="${r.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-soft-danger" data-act="delete" data-id="${r.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      }).join("") || `<tr><td colspan="7" class="text-center text-muted py-4">Belum ada catatan kesehatan</td></tr>`;

      document.querySelectorAll("#ksTable [data-act]").forEach(btn=>{
        btn.onclick = async () => {
          const row = rows.find(r=>r.id===btn.dataset.id);
          if(btn.dataset.act==="edit") return openForm(row, reload);
          if(btn.dataset.act==="riwayat") return openRiwayat(row.siswaId, rows);
          if(btn.dataset.act==="delete"){
            const ok = await Utils.confirmDelete("catatan kesehatan ini");
            if(!ok) return;
            await Api.remove("kesehatan", row.id);
            Auth.logAudit("DELETE", `Menghapus catatan kesehatan ${Cache.siswaName(row.siswaId)}`);
            Utils.toast("success","Catatan dihapus");
            reload();
          }
        };
      });

      dt = $("#ksTable").DataTable({ pageLength:10, columnDefs:[TableUtil.numberColumnDef(0), {orderable:false,targets:6}], language:{search:"Cari:",zeroRecords:"Data tidak ditemukan"} });
    }

    document.getElementById("btnAddKesehatan").onclick = () => openForm(null, reload);
    reload();
  }

  async function openForm(row, onSaved){
    const isEdit = !!row;
    let lampiran = parseLampiran(row?.lampiran);

    function renderLampiranList(){
      const el = document.getElementById("lampiranList");
      if(!el) return;
      el.innerHTML = lampiran.map((f,i)=>`
        <div class="d-flex align-items-center justify-content-between px-2 py-1 mb-1" style="background:var(--bg);border-radius:8px;font-size:12px">
          <a href="${f.url}" target="_blank" rel="noopener" style="color:var(--navy);text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%">
            <i class="fa-solid ${f.tipe && f.tipe.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'} me-1"></i>${Utils.escapeHtml(f.name)}
          </a>
          <button type="button" class="btn btn-sm btn-soft-danger py-0 px-2" data-remove="${i}"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join("") || `<span class="text-muted" style="font-size:12px">Belum ada lampiran</span>`;
      el.querySelectorAll("[data-remove]").forEach(btn=>{
        btn.onclick = () => { lampiran.splice(Number(btn.dataset.remove),1); renderLampiranList(); };
      });
    }

    const result = await Swal.fire({
      title: isEdit ? "Edit Catatan Kesehatan" : "Tambah Catatan Kesehatan", width:620,
      showCancelButton:true, confirmButtonColor:"#0a2540", confirmButtonText: isEdit?"Simpan Perubahan":"Simpan", cancelButtonText:"Batal",
      html:`<div class="row g-3 text-start">
        <div class="col-12"><label class="form-label-mbms">Siswa</label>
          <select id="f_siswa" class="form-select form-control-mbms" style="padding-left:16px">
          ${Cache.allSiswa().map(s=>`<option value="${s.id}" ${row?.siswaId===s.id?'selected':''}>${s.nama} (${s.kelas})</option>`).join("")}
          </select></div>
        <div class="col-6"><label class="form-label-mbms">Tanggal</label><input type="date" id="f_tgl" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.tanggal||luxon.DateTime.now().toISODate()}"></div>
        <div class="col-6"><label class="form-label-mbms">Dirujuk ke RS/Puskesmas?</label>
          <select id="f_rujuk" class="form-select form-control-mbms" style="padding-left:16px">
            <option value="Tidak" ${row?.statusRujuk!=='Ya'?'selected':''}>Tidak</option>
            <option value="Ya" ${row?.statusRujuk==='Ya'?'selected':''}>Ya</option>
          </select></div>
        <div class="col-12"><label class="form-label-mbms">Keluhan</label><textarea id="f_keluhan" class="form-control form-control-mbms" style="padding-left:16px;height:auto;padding-top:10px" rows="2">${row?.keluhan||''}</textarea></div>
        <div class="col-12"><label class="form-label-mbms">Tindakan/Penanganan</label><textarea id="f_tindakan" class="form-control form-control-mbms" style="padding-left:16px;height:auto;padding-top:10px" rows="2">${row?.tindakan||''}</textarea></div>
        <div class="col-12"><label class="form-label-mbms">Petugas Penanganan</label><input id="f_petugas" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.petugas||Session.get().nama}"></div>
        <div class="col-12">
          <label class="form-label-mbms">Lampiran (surat keterangan sakit, hasil rontgen, dll)</label>
          <div class="dropzone" id="dzLampiran" style="padding:16px">
            <i class="fa-solid fa-cloud-arrow-up mb-1"></i><div style="font-size:12.5px">Klik atau drag &amp; drop foto/PDF (maks. ±5MB per file)</div>
            <input type="file" id="inpLampiran" accept="image/*,.pdf" multiple class="d-none">
          </div>
          <div id="lampiranList" class="mt-2"></div>
        </div>
      </div>`,
      didOpen: () => {
        renderLampiranList();
        const dz = document.getElementById("dzLampiran");
        const inp = document.getElementById("inpLampiran");
        dz.onclick = () => inp.click();
        dz.ondragover = (e)=>{ e.preventDefault(); dz.classList.add("dragover"); };
        dz.ondragleave = ()=> dz.classList.remove("dragover");
        dz.ondrop = (e)=>{ e.preventDefault(); dz.classList.remove("dragover"); handleFiles(e.dataTransfer.files); };
        inp.onchange = (e) => handleFiles(e.target.files);

        async function handleFiles(fileList){
          for(const file of Array.from(fileList)){
            if(file.size > 6*1024*1024){
              Utils.toast("error", `${file.name} terlalu besar (maks ±5MB)`);
              continue;
            }
            const dataUrl = await new Promise((resolve,reject)=>{
              const reader = new FileReader();
              reader.onload = ev => resolve(ev.target.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            Swal.showLoading?.();
            try{
              const uploaded = await Api.uploadFile({ name:file.name, type:file.type, data:dataUrl });
              lampiran.push(uploaded);
              renderLampiranList();
              Utils.toast("success", `${file.name} berhasil diunggah`);
            }catch(err){
              Utils.toast("error", `Gagal mengunggah ${file.name}: ${err.message||err}`);
            }finally{
              Swal.hideLoading?.();
            }
          }
        }
      },
      preConfirm: () => {
        const siswaId = document.getElementById("f_siswa").value;
        const tanggal = document.getElementById("f_tgl").value;
        const statusRujuk = document.getElementById("f_rujuk").value;
        const keluhan = document.getElementById("f_keluhan").value;
        const tindakan = document.getElementById("f_tindakan").value;
        const petugas = document.getElementById("f_petugas").value;
        if(!keluhan){ Swal.showValidationMessage("Isi keluhan siswa"); return false; }
        return { siswaId, tanggal, statusRujuk, keluhan, tindakan, petugas, lampiran: JSON.stringify(lampiran) };
      }
    });
    if(!result.isConfirmed) return;
    if(isEdit) await Api.update("kesehatan", row.id, result.value);
    else await Api.create("kesehatan", result.value);
    Auth.logAudit(isEdit?"UPDATE":"CREATE", `Catatan kesehatan ${Cache.siswaName(result.value.siswaId)}`);

    await Api.create("notifications", { tipe:"Kesehatan", judul:"Catatan kesehatan baru", pesan:`${Cache.siswaName(result.value.siswaId)} — ${result.value.keluhan}`, dibaca:false, waktu:new Date().toISOString() });
    Notif.refreshBadge();

    Utils.toast("success", isEdit ? "Perubahan disimpan" : "Catatan kesehatan disimpan");
    onSaved();
  }

  async function openRiwayat(siswaId, allRows){
    const s = Cache.siswaObj(siswaId);
    const history = allRows.filter(r=>r.siswaId===siswaId).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));

    await Swal.fire({
      title:`Riwayat Kesehatan — ${s.nama}`, width:640, confirmButtonColor:"#0a2540", confirmButtonText:"Tutup",
      html:`<div class="text-start" style="max-height:400px;overflow-y:auto">
        ${history.map(h=>{
          const lamp = parseLampiran(h.lampiran);
          return `<div class="mb-3 pb-2" style="border-bottom:1px solid var(--border)">
            <div class="d-flex justify-content-between">
              <b style="color:var(--navy);font-size:13px">${Utils.fmtDate(h.tanggal)}</b>
              <span class="badge-mbms ${h.statusRujuk==='Ya'?'badge-danger':'badge-success'}">${h.statusRujuk==='Ya'?'Dirujuk':'Ditangani di UKS'}</span>
            </div>
            <div style="font-size:13px;margin:4px 0"><b>Keluhan:</b> ${Utils.escapeHtml(h.keluhan)}</div>
            ${h.tindakan ? `<div style="font-size:12.5px;color:var(--muted)"><b>Tindakan:</b> ${Utils.escapeHtml(h.tindakan)}</div>` : ""}
            ${lamp.length ? `<div class="mt-1">${lamp.map(f=>`<a href="${f.url}" target="_blank" rel="noopener" class="badge-mbms badge-info me-1" style="text-decoration:none"><i class="fa-solid fa-paperclip me-1"></i>${Utils.escapeHtml(f.name)}</a>`).join("")}</div>` : ""}
          </div>`;
        }).join("") || `<p class="text-muted text-center py-3">Belum ada riwayat kesehatan</p>`}
      </div>`,
    });
  }

  Router.register("kesehatan", render);
})();
