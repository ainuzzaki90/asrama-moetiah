/* ==========================================================================
   MBMS — modules/keuangan.js  (Keuangan Asrama)
   ========================================================================== */
(function(){

  async function render(container){
    await Cache.refresh();
    const rows = await Api.list("keuangan");
    const pemasukan = rows.filter(r=>r.jenis==="Pemasukan").reduce((a,r)=>a+Number(r.jumlah||0),0);
    const pengeluaran = rows.filter(r=>r.jenis==="Pengeluaran").reduce((a,r)=>a+Number(r.jumlah||0),0);

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-sack-dollar" style="color:var(--gold);margin-right:8px"></i>Keuangan Asrama</h3>
          <p>Kas, denda, dan pengeluaran operasional asrama</p></div>
          <button class="btn btn-navy" id="btnAddTx"><i class="fa-solid fa-plus me-1"></i>Tambah Transaksi</button>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-4"><div class="stat-card"><div class="icon-wrap" style="background:var(--success-bg);color:var(--success)"><i class="fa-solid fa-arrow-down"></i></div>
            <div class="val">${Utils.fmtCurrency(pemasukan)}</div><div class="lbl">Total Pemasukan</div></div></div>
          <div class="col-md-4"><div class="stat-card"><div class="icon-wrap" style="background:var(--danger-bg);color:var(--danger)"><i class="fa-solid fa-arrow-up"></i></div>
            <div class="val">${Utils.fmtCurrency(pengeluaran)}</div><div class="lbl">Total Pengeluaran</div></div></div>
          <div class="col-md-4"><div class="stat-card"><div class="icon-wrap" style="background:var(--info-bg);color:var(--info)"><i class="fa-solid fa-wallet"></i></div>
            <div class="val">${Utils.fmtCurrency(pemasukan-pengeluaran)}</div><div class="lbl">Saldo Kas</div></div></div>
        </div>

        <div class="card-mbms mb-4">
          <div class="card-header-mbms"><h6>Tren Kas Bulanan</h6></div>
          <div class="card-body-mbms"><canvas id="chartKas" height="80"></canvas></div>
        </div>

        <div class="card-mbms">
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="kuTable" style="width:100%">
                <thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Keterangan</th><th>Santri</th><th>Jumlah</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    renderChart(rows);

    let dt;
    async function reload(){
      const data = (await Api.list("keuangan")).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
      if(dt) dt.destroy();
      document.querySelector("#kuTable tbody").innerHTML = data.map(r=>`<tr>
        <td>${Utils.fmtDate(r.tanggal)}</td>
        <td><span class="badge-mbms ${r.jenis==='Pemasukan'?'badge-success':'badge-danger'}">${r.jenis}</span></td>
        <td>${r.kategori}</td>
        <td>${Utils.escapeHtml(r.keterangan)}</td>
        <td>${r.siswaId ? Cache.siswaName(r.siswaId) : '-'}</td>
        <td class="fw-bold" style="color:${r.jenis==='Pemasukan'?'var(--success)':'var(--danger)'}">${r.jenis==='Pemasukan'?'+':'-'} ${Utils.fmtCurrency(r.jumlah)}</td>
        <td>
          <button class="btn btn-sm btn-soft-info me-1" data-act="edit" data-id="${r.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-soft-danger" data-act="delete" data-id="${r.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join("") || `<tr><td colspan="7" class="text-center text-muted py-4">Belum ada transaksi</td></tr>`;

      document.querySelectorAll("#kuTable [data-act]").forEach(btn=>{
        btn.onclick = async ()=>{
          const row = data.find(r=>r.id===btn.dataset.id);
          if(btn.dataset.act==="edit") return openTxForm(row, ()=>{ reload(); render(container); });
          const ok = await Utils.confirmDelete(row.keterangan||"transaksi ini");
          if(!ok) return;
          await Api.remove("keuangan", row.id);
          Utils.toast("success","Transaksi dihapus");
          render(container);
        };
      });
      dt = $("#kuTable").DataTable({ pageLength:10, order:[], columnDefs:[{orderable:false,targets:6}], language:{search:"Cari:",zeroRecords:"Data tidak ditemukan"} });
    }
    document.getElementById("btnAddTx").onclick = () => openTxForm(null, ()=>render(container));
    reload();
  }

  function renderChart(rows){
    const months = Array.from({length:6}).map((_,i)=>luxon.DateTime.now().minus({months:5-i}));
    new Chart(document.getElementById("chartKas"), {
      type:"line",
      data:{
        labels: months.map(m=>m.setLocale("id").toFormat("LLL yy")),
        datasets:[
          { label:"Pemasukan", data: months.map(m=>rows.filter(r=>r.jenis==="Pemasukan"&&luxon.DateTime.fromISO(r.tanggal).hasSame(m,"month")).reduce((a,r)=>a+Number(r.jumlah||0),0)), borderColor:"#1e8a5f", backgroundColor:"rgba(30,138,95,.12)", fill:true, tension:.35 },
          { label:"Pengeluaran", data: months.map(m=>rows.filter(r=>r.jenis==="Pengeluaran"&&luxon.DateTime.fromISO(r.tanggal).hasSame(m,"month")).reduce((a,r)=>a+Number(r.jumlah||0),0)), borderColor:"#c0392b", backgroundColor:"rgba(192,57,43,.10)", fill:true, tension:.35 },
        ]
      },
      options:{ plugins:{legend:{position:"bottom"}} }
    });
  }

  async function openTxForm(row, onSaved){
    const isEdit = !!row;
    const result = await Swal.fire({
      title: isEdit ? "Edit Transaksi" : "Tambah Transaksi", width:560, showCancelButton:true,
      confirmButtonColor:"#0a2540", confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<div class="row g-3 text-start">
        <div class="col-6"><label class="form-label-mbms">Tanggal</label><input type="date" id="f_tgl" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.tanggal||luxon.DateTime.now().toISODate()}"></div>
        <div class="col-6"><label class="form-label-mbms">Jenis</label><select id="f_jenis" class="form-select form-control-mbms" style="padding-left:16px">
          <option ${row?.jenis==='Pemasukan'?'selected':''}>Pemasukan</option><option ${row?.jenis==='Pengeluaran'?'selected':''}>Pengeluaran</option></select></div>
        <div class="col-6"><label class="form-label-mbms">Kategori</label><input id="f_kat" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.kategori||''}" placeholder="Kas Bulanan / Konsumsi / Denda ..."></div>
        <div class="col-6"><label class="form-label-mbms">Jumlah (Rp)</label><input type="number" id="f_jml" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.jumlah||''}"></div>
        <div class="col-12"><label class="form-label-mbms">Keterangan</label><input id="f_ket" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.keterangan||''}"></div>
        <div class="col-12"><label class="form-label-mbms">Santri Terkait (opsional)</label>
          <select id="f_siswa" class="form-select form-control-mbms" style="padding-left:16px"><option value="">-</option>
          ${Cache.allSiswa().map(s=>`<option value="${s.id}" ${row?.siswaId===s.id?'selected':''}>${s.nama}</option>`).join("")}</select></div>
      </div>`,
      preConfirm: () => ({
        tanggal: document.getElementById("f_tgl").value, jenis: document.getElementById("f_jenis").value,
        kategori: document.getElementById("f_kat").value, jumlah: Number(document.getElementById("f_jml").value),
        keterangan: document.getElementById("f_ket").value, siswaId: document.getElementById("f_siswa").value,
      })
    });
    if(!result.isConfirmed) return;
    if(isEdit) await Api.update("keuangan", row.id, result.value); else await Api.create("keuangan", result.value);
    Auth.logAudit(isEdit?"UPDATE":"CREATE", "Transaksi keuangan "+result.value.kategori);
    Utils.toast("success","Transaksi disimpan");
    onSaved();
  }

  Router.register("keuangan", render);
})();
