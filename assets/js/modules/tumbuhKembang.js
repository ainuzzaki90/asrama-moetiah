/* ==========================================================================
   MBMS — modules/tumbuhKembang.js  (Tumbuh Kembang Siswa)
   ----------------------------------------------------------------------
   Periodic physical growth monitoring, separate from Kesehatan Siswa
   (which is incident-based). Each row is one measurement session; IMT
   (BMI) is computed automatically and classified using the general adult
   WHO cut-offs as an INDICATIVE reference only. Real adolescent growth
   assessment should use age/gender IMT-for-age (IMT/U) percentile charts
   (Kemenkes) — a disclaimer is shown in the UI so staff don't over-trust
   the auto category.
   ========================================================================== */
(function(){

  function calcBmi(tinggiCm, beratKg){
    const m = Number(tinggiCm) / 100;
    if(!m || !beratKg) return null;
    return Number((Number(beratKg) / (m*m)).toFixed(1));
  }
  function bmiCategory(bmi){
    if(bmi == null) return { label:"-", cls:"badge-navy" };
    if(bmi < 18.5) return { label:"Kurus", cls:"badge-warning" };
    if(bmi < 25)   return { label:"Normal", cls:"badge-success" };
    if(bmi < 30)   return { label:"Gemuk", cls:"badge-warning" };
    return { label:"Obesitas", cls:"badge-danger" };
  }
  function latestFor(rows, siswaId){
    const list = rows.filter(r=>r.siswaId===siswaId).sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
    return list[list.length-1] || null;
  }

  async function render(container){
    await Cache.refresh();
    const rows = await Api.list("tumbuh_kembang");
    const withLatest = Cache.allSiswa().map(s => ({ s, latest: latestFor(rows, s.id) }));
    const terukur = withLatest.filter(w=>w.latest).length;
    const kurang = withLatest.filter(w=>w.latest && (bmiCategory(w.latest.bmi).label==="Kurus")).length;
    const lebih = withLatest.filter(w=>w.latest && ["Gemuk","Obesitas"].includes(bmiCategory(w.latest.bmi).label)).length;

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-ruler-vertical" style="color:var(--gold);margin-right:8px"></i>Tumbuh Kembang Siswa</h3>
          <p>Pemantauan tinggi &amp; berat badan berkala, lengkap dengan IMT otomatis</p></div>
          <button class="btn btn-navy" id="btnAddMeasure"><i class="fa-solid fa-plus me-1"></i>Catat Pengukuran</button>
        </div>

        <div class="row g-3 mb-3">
          <div class="col-md-4 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--info-bg);color:var(--info)"><i class="fa-solid fa-ruler-vertical"></i></div>
            <div class="val">${terukur}/${withLatest.length}</div><div class="lbl">Siswa Sudah Diukur</div></div></div>
          <div class="col-md-4 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--warning-bg);color:var(--warning)"><i class="fa-solid fa-arrow-down"></i></div>
            <div class="val">${kurang}</div><div class="lbl">Indikasi Kurus (IMT &lt; 18.5)</div></div></div>
          <div class="col-md-4 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--danger-bg);color:var(--danger)"><i class="fa-solid fa-arrow-up"></i></div>
            <div class="val">${lebih}</div><div class="lbl">Indikasi Gemuk/Obesitas</div></div></div>
        </div>

        <div class="card-mbms mb-1" style="background:var(--warning-bg);border:none">
          <div class="card-body-mbms py-2 px-3" style="font-size:11.5px;color:var(--gold-dark)">
            <i class="fa-solid fa-circle-info me-1"></i> Kategori IMT bersifat <b>indikatif</b> (rumus IMT umum dewasa). Untuk status gizi remaja yang akurat, rujuk tabel IMT/U (usia &amp; jenis kelamin) dari Kemenkes.
          </div>
        </div>

        <div class="card-mbms mt-3">
          <div class="card-header-mbms"><h6>Data Terkini per Siswa</h6></div>
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="tkTable" style="width:100%">
                <thead><tr><th>Siswa</th><th>Kelas</th><th>Tgl Ukur Terakhir</th><th>Tinggi</th><th>Berat</th><th>IMT</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    let dt;
    async function reload(){
      const data = await Api.list("tumbuh_kembang");
      const list = Cache.allSiswa().map(s => ({ s, latest: latestFor(data, s.id) }));
      if(dt) dt.destroy();
      document.querySelector("#tkTable tbody").innerHTML = list.map(({s,latest})=>{
        const cat = bmiCategory(latest?.bmi);
        return `<tr>
          <td><b style="color:var(--navy)">${Utils.escapeHtml(s.nama)}</b></td>
          <td>${s.kelas}</td>
          <td>${latest ? Utils.fmtDate(latest.tanggal) : '-'}</td>
          <td>${latest ? latest.tinggiBadan + ' cm' : '-'}</td>
          <td>${latest ? latest.beratBadan + ' kg' : '-'}</td>
          <td>${latest ? latest.bmi : '-'}</td>
          <td><span class="badge-mbms ${cat.cls}">${cat.label}</span></td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-navy" data-act="riwayat" data-id="${s.id}"><i class="fa-solid fa-chart-line me-1"></i>Riwayat</button>
          </td>
        </tr>`;
      }).join("") || `<tr><td colspan="8" class="text-center text-muted py-4">Belum ada data siswa</td></tr>`;

      document.querySelectorAll("#tkTable [data-act]").forEach(btn=>{
        btn.onclick = () => openHistory(btn.dataset.id, data);
      });
      dt = $("#tkTable").DataTable({ pageLength:10, columnDefs:[{orderable:false,targets:7}], language:{search:"Cari siswa:",zeroRecords:"Data tidak ditemukan"} });
    }

    document.getElementById("btnAddMeasure").onclick = () => openForm(null, async ()=>{ await reload(); });
    reload();
  }

  async function openForm(preSelectSiswaId, onSaved){
    const result = await Swal.fire({
      title:"Catat Pengukuran Fisik", width:520, showCancelButton:true,
      confirmButtonColor:"#0a2540", confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<div class="row g-3 text-start">
        <div class="col-12"><label class="form-label-mbms">Siswa</label>
          <select id="f_siswa" class="form-select form-control-mbms" style="padding-left:16px">
          ${Cache.allSiswa().map(s=>`<option value="${s.id}" ${preSelectSiswaId===s.id?'selected':''}>${s.nama} (${s.kelas})</option>`).join("")}
          </select></div>
        <div class="col-6"><label class="form-label-mbms">Tanggal Ukur</label><input type="date" id="f_tgl" class="form-control form-control-mbms" style="padding-left:16px" value="${luxon.DateTime.now().toISODate()}"></div>
        <div class="col-6"><label class="form-label-mbms">&nbsp;</label>
          <div id="bmiPreview" class="form-control form-control-mbms d-flex align-items-center" style="padding-left:16px;background:var(--bg);color:var(--muted);font-size:12.5px">IMT: -</div></div>
        <div class="col-6"><label class="form-label-mbms">Tinggi Badan (cm)</label><input type="number" step="0.1" id="f_tinggi" class="form-control form-control-mbms" style="padding-left:16px"></div>
        <div class="col-6"><label class="form-label-mbms">Berat Badan (kg)</label><input type="number" step="0.1" id="f_berat" class="form-control form-control-mbms" style="padding-left:16px"></div>
        <div class="col-12"><label class="form-label-mbms">Catatan (opsional)</label><input id="f_catatan" class="form-control form-control-mbms" style="padding-left:16px" placeholder="mis. kondisi umum, keluhan, dsb"></div>
      </div>`,
      didOpen: () => {
        const update = () => {
          const bmi = calcBmi(document.getElementById("f_tinggi").value, document.getElementById("f_berat").value);
          const cat = bmiCategory(bmi);
          document.getElementById("bmiPreview").innerHTML = bmi ? `IMT: <b style="color:var(--navy);margin:0 6px">${bmi}</b> <span class="badge-mbms ${cat.cls}">${cat.label}</span>` : "IMT: -";
        };
        document.getElementById("f_tinggi").oninput = update;
        document.getElementById("f_berat").oninput = update;
      },
      preConfirm: () => {
        const siswaId = document.getElementById("f_siswa").value;
        const tanggal = document.getElementById("f_tgl").value;
        const tinggiBadan = Number(document.getElementById("f_tinggi").value);
        const beratBadan = Number(document.getElementById("f_berat").value);
        const catatan = document.getElementById("f_catatan").value;
        if(!tinggiBadan || !beratBadan){ Swal.showValidationMessage("Isi tinggi dan berat badan"); return false; }
        const bmi = calcBmi(tinggiBadan, beratBadan);
        return { siswaId, tanggal, tinggiBadan, beratBadan, bmi, catatan, petugas: Session.get().nama };
      }
    });
    if(!result.isConfirmed) return;
    await Api.create("tumbuh_kembang", result.value);
    Auth.logAudit("CREATE", `Pengukuran fisik ${Cache.siswaName(result.value.siswaId)} — TB:${result.value.tinggiBadan}cm BB:${result.value.beratBadan}kg`);
    Utils.toast("success","Data pengukuran disimpan");
    onSaved();
  }

  async function openHistory(siswaId, allRows){
    const s = Cache.siswaObj(siswaId);
    const history = allRows.filter(r=>r.siswaId===siswaId).sort((a,b)=>a.tanggal.localeCompare(b.tanggal));

    await Swal.fire({
      title:`Riwayat Tumbuh Kembang — ${s.nama}`, width:680, confirmButtonColor:"#0a2540",
      showDenyButton:true, confirmButtonText:"Tutup", denyButtonText:'<i class="fa-solid fa-plus me-1"></i>Catat Baru',
      html:`<div class="text-start">
        <canvas id="chartTumbuhKembang" height="130"></canvas>
        <div class="table-responsive mt-3" style="max-height:220px;overflow-y:auto">
          <table class="table table-sm">
            <thead><tr><th>Tanggal</th><th>Tinggi</th><th>Berat</th><th>IMT</th><th>Status</th></tr></thead>
            <tbody>
              ${history.map(h=>{ const cat = bmiCategory(h.bmi); return `<tr>
                <td>${Utils.fmtDate(h.tanggal)}</td><td>${h.tinggiBadan} cm</td><td>${h.beratBadan} kg</td><td>${h.bmi}</td>
                <td><span class="badge-mbms ${cat.cls}">${cat.label}</span></td></tr>`; }).join("") || `<tr><td colspan="5" class="text-center text-muted py-3">Belum ada pengukuran</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`,
      didOpen: () => {
        new Chart(document.getElementById("chartTumbuhKembang"), {
          data:{
            labels: history.map(h=>Utils.fmtDate(h.tanggal)),
            datasets:[
              { type:"line", label:"Tinggi (cm)", data:history.map(h=>h.tinggiBadan), borderColor:"#0a2540", backgroundColor:"#0a2540", yAxisID:"y", tension:.3 },
              { type:"line", label:"Berat (kg)", data:history.map(h=>h.beratBadan), borderColor:"#d4af37", backgroundColor:"#d4af37", yAxisID:"y1", tension:.3 },
            ]
          },
          options:{
            plugins:{ legend:{ position:"bottom" } },
            scales:{
              y: { type:"linear", position:"left", title:{ display:true, text:"Tinggi (cm)" } },
              y1:{ type:"linear", position:"right", title:{ display:true, text:"Berat (kg)" }, grid:{ drawOnChartArea:false } },
            }
          }
        });
      }
    }).then(r => { if(r.isDenied) openForm(siswaId, ()=>{}); });
  }

  Router.register("tumbuhkembang", render);
})();
