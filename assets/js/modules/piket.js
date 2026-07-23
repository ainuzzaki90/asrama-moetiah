/* ==========================================================================
   MBMS — modules/piket.js  (Jadwal Piket)
   Fair-rotation generator: distributes duty areas evenly across active
   students using a round-robin pointer persisted between generations.
   ========================================================================== */
(function(){

  const AREAS = ["Dapur Umum","Musholla","Halaman","Kamar Mandi Umum","Ruang Belajar","Gudang"];

  async function render(container){
    await Cache.refresh();
    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-rotate" style="color:var(--gold);margin-right:8px"></i>Jadwal Piket</h3>
          <p>Generator otomatis dengan rotasi adil antar-siswa</p></div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-navy" id="btnGenerate"><i class="fa-solid fa-wand-magic-sparkles me-1"></i>Generate Jadwal Minggu Ini</button>
            <button class="btn btn-navy" id="btnAddPiket"><i class="fa-solid fa-plus me-1"></i>Tambah Manual</button>
          </div>
        </div>
        <div class="card-mbms">
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="piketTable" style="width:100%">
                <thead><tr><th>Tanggal</th><th>Area</th><th>Shift</th><th>Petugas</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    let dt;
    async function reload(){
      const rows = (await Api.list("jadwal_piket")).sort((a,b)=> a.tanggal.localeCompare(b.tanggal));
      if(dt) dt.destroy();
      document.querySelector("#piketTable tbody").innerHTML = rows.map(r=>`<tr>
        <td>${Utils.fmtDate(r.tanggal)}</td>
        <td>${r.area}</td>
        <td><span class="badge-mbms badge-info">${r.shift}</span></td>
        <td>${Cache.siswaName(r.siswaId)}</td>
        <td>
          <select class="form-select form-select-sm" style="width:120px" data-id="${r.id}" data-role="status">
            <option ${r.status==='Belum'?'selected':''}>Belum</option>
            <option ${r.status==='Selesai'?'selected':''}>Selesai</option>
          </select>
        </td>
        <td><button class="btn btn-sm btn-soft-danger" data-act="delete" data-id="${r.id}"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-4">Belum ada jadwal piket</td></tr>`;

      document.querySelectorAll('[data-role="status"]').forEach(sel=>{
        sel.onchange = async ()=>{ await Api.update("jadwal_piket", sel.dataset.id, { status: sel.value }); Utils.toast("success","Status piket diperbarui"); };
      });
      document.querySelectorAll('[data-act="delete"]').forEach(btn=>{
        btn.onclick = async ()=>{ const ok = await Utils.confirmDelete("jadwal ini"); if(!ok) return; await Api.remove("jadwal_piket", btn.dataset.id); reload(); };
      });

      dt = $("#piketTable").DataTable({ pageLength:10, order:[], columnDefs:[{orderable:false,targets:[4,5]}], language:{search:"Cari:",zeroRecords:"Data tidak ditemukan"} });
    }

    document.getElementById("btnGenerate").onclick = () => generateSchedule(reload);
    document.getElementById("btnAddPiket").onclick = () => CrudModule.openForm({
      title:"Piket", sheet:"jadwal_piket", _reload: reload,
      formFields:[
        { name:"tanggal", label:"Tanggal", type:"date", col:6, required:true },
        { name:"area", label:"Area", type:"select", col:6, required:true, options:AREAS.map(a=>({value:a,label:a})) },
        { name:"shift", label:"Shift", type:"select", col:6, required:true, options:[{value:"Pagi",label:"Pagi"},{value:"Sore",label:"Sore"}] },
        { name:"siswaId", label:"Petugas", type:"select", col:6, required:true, options:()=>Cache.allSiswa().map(s=>({value:s.id,label:s.nama})) },
        { name:"status", label:"Status", type:"select", col:12, required:true, options:[{value:"Belum",label:"Belum"},{value:"Selesai",label:"Selesai"}] },
      ]
    });

    reload();
  }

  async function generateSchedule(onDone){
    const confirm = await Swal.fire({
      icon:"question", title:"Generate Jadwal Minggu Ini?",
      html:"Sistem akan membuat jadwal piket 7 hari ke depan untuk semua area, dengan rotasi merata berdasarkan riwayat piket siswa.",
      showCancelButton:true, confirmButtonText:"Generate", cancelButtonText:"Batal", confirmButtonColor:"#0a2540",
    });
    if(!confirm.isConfirmed) return;

    const siswaAktif = Cache.allSiswa().filter(s=>s.status==="Aktif");
    if(!siswaAktif.length){ Utils.toast("error","Belum ada data siswa aktif"); return; }

    // Fairness: count existing duty assignments per student, sort ascending
    // so students with fewer past duties are picked first (round-robin).
    const existing = await Api.list("jadwal_piket");
    const dutyCount = {};
    siswaAktif.forEach(s => dutyCount[s.id] = existing.filter(e=>e.siswaId===s.id).length);
    const queue = [...siswaAktif].sort((a,b)=> dutyCount[a.id]-dutyCount[b.id]);

    let qi = 0;
    const nextStudent = () => { const s = queue[qi % queue.length]; qi++; return s; };

    const today = luxon.DateTime.now();
    let created = 0;
    for(let d=0; d<7; d++){
      const date = today.plus({days:d}).toISODate();
      for(const area of AREAS){
        for(const shift of ["Pagi","Sore"]){
          const s = nextStudent();
          await Api.create("jadwal_piket", { tanggal:date, area, shift, siswaId:s.id, status:"Belum" });
          created++;
        }
      }
    }
    Auth.logAudit("CREATE", `Generate jadwal piket otomatis (${created} entri)`);
    Utils.toast("success", `${created} jadwal piket berhasil digenerate dengan rotasi adil`);
    onDone();
  }

  Router.register("piket", render);
})();
