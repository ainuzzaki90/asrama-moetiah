/* ==========================================================================
   MBMS — modules/piket.js  (Jadwal Piket)
   ----------------------------------------------------------------------
   Matches the boarding house's real duty-roster format ("Putaran" system):
     - A "Putaran" (round) is a 7-day cycle (Sabtu → Jumat) assigned to
       one gender wing (Putra/Putri).
     - Ketua Kamar (room leader) and Petugas Piket (duty officers) counts
       are fully DYNAMIC — 1, 2, 3, or more people can be assigned to
       either role, chosen freely via checkboxes.
   Data model: one row per Putaran in sheet `piket_putaran`:
     ketuaKamarIds  -> JSON array of siswaId, e.g. ["S-01","S-02"]
     petugasHarian  -> JSON object { "Sabtu":[siswaId,...], "Minggu":[...], ... }
   ========================================================================== */
(function(){

  const HARI = ["Sabtu","Minggu","Senin","Selasa","Rabu","Kamis","Jumat"];

  const TUGAS_KETUA_KAMAR = [
    "Membangunkan teman-temannya setelah musyrif membangunkan ketua kamar untuk persiapan salat Subuh",
    "Mengontrol ketertiban salat berjamaah lima waktu termasuk salat sunnah dan dzikir",
    "Mengontrol pakaian kotor agar tidak ada pakaian kotor yang lebih dari dua stel",
    "Mengontrol petugas piket harian agar menjalankan kewajibannya dengan tertib",
    "Mengontrol pencucian handuk, mukena, sandal, dan sepatu di hari yang telah dijadwalkan",
    "Mengontrol petugas piket",
    "Menyetorkan hafalan kosakata ke pembina setelah makan malam",
    "Menyimak hafalan kosakata teman sejawatnya setelah jam belajar",
    "Menghitung jumlah hanger di setiap Hari Minggu",
    "Mengisi ceklis jurnal harian kegiatan siswa",
    "Melaporkan anak sakit, dan setiap pelanggaran kepada musyrif",
  ];
  const TUGAS_PIKET = [
    "Menyapu kamar tiga kali sehari pada pagi, siang, dan sore hari",
    "Membuang sampah kamar dua kali sehari pada pagi dan sore hari",
    "Membersihkan jendela dan pintu dengan kemoceng",
    "Menertibkan barang-barang yang tidak terletak pada tempatnya",
    "Mengontrol ketertiban dan kerapian kasur dan lemari",
    "Memastikan lampu dan kipas angin tidak menyala saat tidak digunakan",
    "Menata piring, sendok garpu, gelas, dan alat prasmanan sebelum makan sarapan, makan siang, dan makan malam",
    "Memastikan kebersihan meja makan setelah makan dengan memindahkan makanan sisa ke wadah kosong lalu menumpuk alat prasmanan di wastafel dan mengelap meja",
    "Mencuci alat prasmanan setelah makan khusus jadwal piket Sabtu dan Minggu dan tanggal merah",
    "Memastikan kipas angin dan lampu telah dimatikan setelah penggunaan ruang makan",
    "Membuka dan menutup jendela di pagi dan malam hari",
    "Mengontrol area jemuran dan memastikan kerapian",
    "Mengontrol kamar mandi dan mengecek barang-barang yang tidak rapi",
    "Mengontrol kerapian lemari dan selorokan",
  ];

  function parseHarian(json){ try{ const v = JSON.parse(json||"{}"); return v && typeof v==="object" ? v : {}; }catch(e){ return {}; } }
  function getKetuaIds(row){
    if(row.ketuaKamarIds){
      try{ const v = JSON.parse(row.ketuaKamarIds); if(Array.isArray(v)) return v; }catch(e){}
    }
    return row.ketuaKamarId ? [row.ketuaKamarId] : []; // backward-compat with older single-leader records
  }
  function periodeLabel(tanggalMulai){
    const start = luxon.DateTime.fromISO(tanggalMulai);
    const end = start.plus({days:6});
    return `${Utils.fmtDate(start.toISODate())} – ${Utils.fmtDate(end.toISODate())}`;
  }
  function checkboxList(idPrefix, pool, selectedIds){
    return `<div style="max-height:230px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:left">
      ${pool.map(s=>`<div class="form-check">
        <input class="form-check-input" type="checkbox" value="${s.id}" id="${idPrefix}_${s.id}" ${selectedIds.includes(s.id)?'checked':''}>
        <label class="form-check-label" for="${idPrefix}_${s.id}" style="font-size:13px">${s.nama}</label>
      </div>`).join("") || `<span class="text-muted" style="font-size:12.5px">Belum ada siswa di gedung ini</span>`}
    </div>`;
  }
  function readCheckboxList(idPrefix, pool){
    return pool.filter(s => document.getElementById(`${idPrefix}_${s.id}`)?.checked).map(s=>s.id);
  }

  async function render(container){
    await Cache.refresh();
    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-rotate" style="color:var(--gold);margin-right:8px"></i>Jadwal Piket</h3>
          <p>Rotasi Ketua Kamar &amp; Petugas Piket per putaran (7 hari, Sabtu–Jumat) — jumlah orang per peran bebas ditentukan</p></div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-navy" id="btnGenPutra"><i class="fa-solid fa-wand-magic-sparkles me-1"></i>Generate Putaran Putra</button>
            <button class="btn btn-outline-navy" id="btnGenPutri"><i class="fa-solid fa-wand-magic-sparkles me-1"></i>Generate Putaran Putri</button>
          </div>
        </div>

        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <div class="card-mbms h-100">
              <div class="card-header-mbms"><h6><i class="fa-solid fa-user-tie me-2" style="color:var(--gold)"></i>Tugas Ketua Kamar</h6></div>
              <div class="card-body-mbms" style="max-height:220px;overflow-y:auto">
                <ol style="padding-left:18px;font-size:12.5px;color:var(--muted);margin:0">
                  ${TUGAS_KETUA_KAMAR.map(t=>`<li class="mb-1">${t}</li>`).join("")}
                </ol>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card-mbms h-100">
              <div class="card-header-mbms"><h6><i class="fa-solid fa-broom me-2" style="color:var(--gold)"></i>Tugas Piket</h6></div>
              <div class="card-body-mbms" style="max-height:220px;overflow-y:auto">
                <ol style="padding-left:18px;font-size:12.5px;color:var(--muted);margin:0">
                  ${TUGAS_PIKET.map(t=>`<li class="mb-1">${t}</li>`).join("")}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div class="card-mbms">
          <div class="card-header-mbms"><h6>Daftar Putaran</h6></div>
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="piketTable" style="width:100%">
                <thead><tr><th style="width:48px">No</th><th>Gedung</th><th>Putaran Ke</th><th>Periode</th><th>Ketua Kamar</th><th>Petugas (ringkas)</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    let dt;
    async function reload(){
      const rows = (await Api.list("piket_putaran")).sort((a,b)=> a.gedung.localeCompare(b.gedung) || Number(a.putaranKe)-Number(b.putaranKe));
      if(dt) dt.destroy();
      document.querySelector("#piketTable tbody").innerHTML = rows.map(r=>{
        const harian = parseHarian(r.petugasHarian);
        const ketuaNames = getKetuaIds(r).map(id=>Cache.siswaName(id)).join(", ") || "-";
        const ringkas = HARI.slice(0,3).map(h => (harian[h]||[]).map(id=>Cache.siswaName(id).split(" ")[0]).join("/")).join(" · ") + " ...";
        return `<tr>
          <td></td>
          <td><span class="badge-mbms ${r.gedung==='Putra'?'badge-info':'badge-warning'}">${r.gedung}</span></td>
          <td><b style="color:var(--navy)">Putaran ${r.putaranKe}</b></td>
          <td>${periodeLabel(r.tanggalMulai)}</td>
          <td>${ketuaNames}</td>
          <td style="font-size:12px;color:var(--muted)">${ringkas}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-navy" data-act="detail" data-id="${r.id}"><i class="fa-solid fa-list-check me-1"></i>Detail</button>
            <button class="btn btn-sm btn-soft-danger" data-act="delete" data-id="${r.id}"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      }).join("") || `<tr><td colspan="7" class="text-center text-muted py-4">Belum ada putaran piket. Klik "Generate Putaran" untuk membuat otomatis.</td></tr>`;

      document.querySelectorAll("#piketTable [data-act]").forEach(btn=>{
        btn.onclick = async () => {
          const row = rows.find(r=>r.id===btn.dataset.id);
          if(btn.dataset.act==="detail") return openDetail(row, reload);
          if(btn.dataset.act==="delete"){
            const ok = await Utils.confirmDelete(`Putaran ${row.putaranKe} (${row.gedung})`);
            if(!ok) return;
            await Api.remove("piket_putaran", row.id);
            Auth.logAudit("DELETE", `Menghapus putaran piket ${row.gedung} #${row.putaranKe}`);
            Utils.toast("success","Putaran dihapus");
            reload();
          }
        };
      });

      dt = $("#piketTable").DataTable({ pageLength:10, columnDefs:[TableUtil.numberColumnDef(0), {orderable:false,targets:6}], language:{search:"Cari:",zeroRecords:"Data tidak ditemukan"} });
    }

    document.getElementById("btnGenPutra").onclick = () => generatePutaran("Putra", reload);
    document.getElementById("btnGenPutri").onclick = () => generatePutaran("Putri", reload);
    reload();
  }

  async function generatePutaran(gedung, onDone){
    const jk = gedung === "Putra" ? "L" : "P";
    const pool = Cache.allSiswa().filter(s=>s.jk===jk && s.status==="Aktif");
    if(pool.length < 2){
      Utils.toast("error", `Minimal 2 siswa aktif ${gedung} diperlukan untuk membuat putaran`);
      return;
    }
    const cfg = await Swal.fire({
      title:`Generate Putaran ${gedung} Berikutnya?`, width:480,
      html:`<div class="row g-3 text-start">
        <div class="col-6"><label class="form-label-mbms">Jumlah Ketua Kamar</label><input type="number" id="f_jmlKetua" class="form-control form-control-mbms" style="padding-left:16px" min="1" max="${pool.length}" value="1"></div>
        <div class="col-6"><label class="form-label-mbms">Jumlah Petugas / Hari</label><input type="number" id="f_jmlPetugas" class="form-control form-control-mbms" style="padding-left:16px" min="1" max="${pool.length}" value="2"></div>
        <div class="col-12" style="font-size:12px;color:var(--muted)">Orang-orangnya dipilih otomatis dengan rotasi adil berdasarkan riwayat penugasan sebelumnya. Bisa diedit manual sesudahnya.</div>
      </div>`,
      showCancelButton:true, confirmButtonText:"Generate", cancelButtonText:"Batal", confirmButtonColor:"#0a2540",
      preConfirm: () => {
        const jmlKetua = Number(document.getElementById("f_jmlKetua").value);
        const jmlPetugas = Number(document.getElementById("f_jmlPetugas").value);
        if(!jmlKetua || jmlKetua<1 || !jmlPetugas || jmlPetugas<1){ Swal.showValidationMessage("Isi jumlah dengan angka valid (minimal 1)"); return false; }
        if(jmlKetua > pool.length || jmlPetugas > pool.length){ Swal.showValidationMessage(`Maksimal ${pool.length} siswa tersedia di gedung ini`); return false; }
        return { jmlKetua, jmlPetugas };
      }
    });
    if(!cfg.isConfirmed) return;
    const { jmlKetua, jmlPetugas } = cfg.value;

    const existing = (await Api.list("piket_putaran")).filter(p=>p.gedung===gedung);
    const putaranKe = existing.length ? Math.max(...existing.map(e=>Number(e.putaranKe))) + 1 : 1;

    const ketuaCount = {}, petugasCount = {};
    pool.forEach(s => { ketuaCount[s.id]=0; petugasCount[s.id]=0; });
    existing.forEach(p => {
      getKetuaIds(p).forEach(id => { if(ketuaCount[id] !== undefined) ketuaCount[id]++; });
      Object.values(parseHarian(p.petugasHarian)).flat().forEach(id => { if(petugasCount[id] !== undefined) petugasCount[id]++; });
    });

    const ketuaKamarIds = [...pool].sort((a,b)=>ketuaCount[a.id]-ketuaCount[b.id]).slice(0, jmlKetua).map(s=>s.id);

    const petugasQueue = [...pool].sort((a,b)=>petugasCount[a.id]-petugasCount[b.id]);
    let qi = 0;
    const nextPetugas = () => petugasQueue[qi++ % petugasQueue.length].id;
    const petugasHarian = {};
    HARI.forEach(h => { petugasHarian[h] = Array.from({length:jmlPetugas}).map(()=>nextPetugas()); });

    let tanggalMulai;
    if(existing.length){
      const lastStart = existing.map(e=>luxon.DateTime.fromISO(e.tanggalMulai)).sort((a,b)=>b-a)[0];
      tanggalMulai = lastStart.plus({days:7});
    }else{
      let d = luxon.DateTime.now();
      while(d.weekday !== 6) d = d.plus({days:1}); // next Saturday (luxon: 6 = Saturday)
      tanggalMulai = d;
    }

    await Api.create("piket_putaran", {
      gedung, putaranKe, tanggalMulai: tanggalMulai.toISODate(),
      ketuaKamarIds: JSON.stringify(ketuaKamarIds), petugasHarian: JSON.stringify(petugasHarian),
    });
    Auth.logAudit("CREATE", `Generate putaran piket ${gedung} #${putaranKe} (${jmlKetua} ketua, ${jmlPetugas} petugas/hari)`);
    Utils.toast("success", `Putaran ${gedung} ke-${putaranKe} berhasil dibuat`);
    onDone();
  }

  async function openDetail(putaran, onChanged){
    const jk = putaran.gedung === "Putra" ? "L" : "P";
    const pool = Cache.allSiswa().filter(s=>s.jk===jk);
    const harian = parseHarian(putaran.petugasHarian);
    const ketuaIds = getKetuaIds(putaran);

    const renderBody = () => `
      <div class="text-start">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span class="badge-mbms ${putaran.gedung==='Putra'?'badge-info':'badge-warning'}">${putaran.gedung}</span>
            <b style="margin-left:6px;color:var(--navy)">Putaran ${putaran.putaranKe}</b>
            <div style="font-size:12px;color:var(--muted)">${periodeLabel(putaran.tanggalMulai)}</div>
          </div>
          <div class="text-end">
            <div style="font-size:11px;color:var(--muted)">Ketua Kamar (${ketuaIds.length})</div>
            <b style="color:var(--navy)">${ketuaIds.map(id=>Cache.siswaName(id)).join(", ") || '-'}</b>
            <button class="btn btn-sm btn-soft-info ms-2" id="btnEditKetua"><i class="fa-solid fa-pen"></i></button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead><tr><th>Hari</th><th>Petugas Piket</th><th></th></tr></thead>
            <tbody>
              ${HARI.map(h => `<tr>
                <td>${h}</td>
                <td>${(harian[h]||[]).map(id=>Cache.siswaName(id)).join(", ") || '<span class="text-muted">-</span>'} <span class="badge-mbms badge-navy" style="font-size:10px">${(harian[h]||[]).length} orang</span></td>
                <td class="text-end"><button class="btn btn-sm btn-soft-info" data-hari="${h}"><i class="fa-solid fa-pen"></i></button></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    const result = await Swal.fire({
      title:"Detail Putaran Piket", html: renderBody(), width:640,
      showDenyButton:true, confirmButtonText:"Tutup", denyButtonText:'<i class="fa-solid fa-print me-1"></i>Cetak PDF', confirmButtonColor:"#0a2540",
      didOpen: () => {
        document.getElementById("btnEditKetua").onclick = () => editKetua(putaran, pool, onChanged);
        document.querySelectorAll("[data-hari]").forEach(btn=>{
          btn.onclick = () => editHari(putaran, btn.dataset.hari, pool, onChanged);
        });
      }
    });
    if(result.isDenied){
      const rows = HARI.map(h => [h, (harian[h]||[]).map(id=>Cache.siswaName(id)).join(", ") || "-"]);
      Reports.exportPdf(`Jadwal Piket - ${putaran.gedung} Putaran ${putaran.putaranKe}`, ["Hari","Petugas Piket"], rows);
    }
  }

  async function editKetua(putaran, pool, onChanged){
    const current = getKetuaIds(putaran);
    const result = await Swal.fire({
      title:"Ubah Ketua Kamar", width:420, showCancelButton:true, confirmButtonColor:"#0a2540",
      confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<p style="font-size:12px;color:var(--muted);text-align:left;margin-bottom:8px">Centang siapa saja yang menjadi Ketua Kamar pada putaran ini (bisa lebih dari satu).</p>${checkboxList("ketua", pool, current)}`,
      preConfirm: () => readCheckboxList("ketua", pool),
    });
    if(!result.isConfirmed) return;
    if(!result.value.length){ Utils.toast("error","Pilih minimal satu Ketua Kamar"); return; }
    await Api.update("piket_putaran", putaran.id, { ketuaKamarIds: JSON.stringify(result.value) });
    Auth.logAudit("UPDATE", `Mengubah ketua kamar putaran ${putaran.gedung} #${putaran.putaranKe}`);
    Utils.toast("success","Ketua kamar diperbarui");
    onChanged();
  }

  async function editHari(putaran, hari, pool, onChanged){
    const harian = parseHarian(putaran.petugasHarian);
    const current = harian[hari] || [];
    const result = await Swal.fire({
      title:`Petugas Piket — ${hari}`, width:420, showCancelButton:true, confirmButtonColor:"#0a2540",
      confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<p style="font-size:12px;color:var(--muted);text-align:left;margin-bottom:8px">Centang siapa saja yang bertugas piket hari ${hari} (jumlah bebas).</p>${checkboxList("petugas", pool, current)}`,
      preConfirm: () => readCheckboxList("petugas", pool),
    });
    if(!result.isConfirmed) return;
    harian[hari] = result.value;
    await Api.update("piket_putaran", putaran.id, { petugasHarian: JSON.stringify(harian) });
    Auth.logAudit("UPDATE", `Mengubah petugas piket ${hari} — putaran ${putaran.gedung} #${putaran.putaranKe}`);
    Utils.toast("success","Petugas piket diperbarui");
    onChanged();
  }

  Router.register("piket", render);
})();
