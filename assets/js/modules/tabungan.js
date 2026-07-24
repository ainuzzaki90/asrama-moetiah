/* ==========================================================================
   MBMS — modules/tabungan.js  (Tabungan Siswa)
   ----------------------------------------------------------------------
   Design notes (technical):
   - One row per transaction (Setoran/Penarikan), each storing `saldoSetelah`
     — a running-balance snapshot — so a student's history can be printed
     as an authentic bank-style passbook without recomputation.
   - The *current* balance shown in the UI is always recomputed live from
     the full transaction sum (source of truth), not read from the last
     snapshot — this keeps the figure correct even if rows are edited
     directly in the Google Sheet.
   - Withdrawals are blocked client-side if they would push the balance
     negative, and a low-balance notification is raised automatically.
   ========================================================================== */
(function(){

  const LOW_BALANCE_THRESHOLD = 10000; // Rp — triggers a notification to Wali Asrama

  function computeBalance(rows, siswaId){
    return rows.filter(r=>r.siswaId===siswaId)
      .reduce((bal,r)=> bal + (r.jenis==="Setoran" ? Number(r.jumlah||0) : -Number(r.jumlah||0)), 0);
  }

  async function render(container){
    await Cache.refresh();
    const rows = await Api.list("tabungan");
    const totalSaldo = Cache.allSiswa().reduce((a,s)=>a + computeBalance(rows, s.id), 0);
    const now = luxon.DateTime.now();
    const setoranBulanIni = rows.filter(r=>r.jenis==="Setoran" && luxon.DateTime.fromISO(r.tanggal).hasSame(now,"month")).reduce((a,r)=>a+Number(r.jumlah||0),0);
    const penarikanBulanIni = rows.filter(r=>r.jenis==="Penarikan" && luxon.DateTime.fromISO(r.tanggal).hasSame(now,"month")).reduce((a,r)=>a+Number(r.jumlah||0),0);
    const siswaMenabung = Cache.allSiswa().filter(s=>rows.some(r=>r.siswaId===s.id)).length;

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-piggy-bank" style="color:var(--gold);margin-right:8px"></i>Tabungan Siswa</h3>
          <p>Kelola setoran, penarikan, dan saldo tabungan setiap siswa</p></div>
          <button class="btn btn-navy" id="btnAddTx"><i class="fa-solid fa-plus me-1"></i>Tambah Transaksi</button>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-3 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--info-bg);color:var(--info)"><i class="fa-solid fa-wallet"></i></div>
            <div class="val">${Utils.fmtCurrency(totalSaldo)}</div><div class="lbl">Total Saldo Seluruh Siswa</div></div></div>
          <div class="col-md-3 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--success-bg);color:var(--success)"><i class="fa-solid fa-arrow-down"></i></div>
            <div class="val">${Utils.fmtCurrency(setoranBulanIni)}</div><div class="lbl">Setoran Bulan Ini</div></div></div>
          <div class="col-md-3 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--danger-bg);color:var(--danger)"><i class="fa-solid fa-arrow-up"></i></div>
            <div class="val">${Utils.fmtCurrency(penarikanBulanIni)}</div><div class="lbl">Penarikan Bulan Ini</div></div></div>
          <div class="col-md-3 col-6"><div class="stat-card"><div class="icon-wrap" style="background:var(--warning-bg);color:var(--warning)"><i class="fa-solid fa-user-group"></i></div>
            <div class="val">${siswaMenabung}</div><div class="lbl">Siswa Aktif Menabung</div></div></div>
        </div>

        <div class="card-mbms mb-4">
          <div class="card-header-mbms"><h6>Tren Setoran &amp; Penarikan (6 Bulan Terakhir)</h6></div>
          <div class="card-body-mbms"><canvas id="chartTabungan" height="80"></canvas></div>
        </div>

        <div class="card-mbms">
          <div class="card-header-mbms"><h6>Saldo per Siswa</h6></div>
          <div class="card-body-mbms">
            <div class="table-responsive">
              <table class="table table-hover align-middle" id="saldoTable" style="width:100%">
                <thead><tr><th style="width:48px">No</th><th>Siswa</th><th>Kelas</th><th>Kamar</th><th>Saldo Saat Ini</th><th>Aksi</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    renderChart(rows);

    let dt;
    async function reload(){
      const data = await Api.list("tabungan");
      const siswaRows = Cache.allSiswa().map(s => ({ s, saldo: computeBalance(data, s.id) }));
      if(dt) dt.destroy();
      document.querySelector("#saldoTable tbody").innerHTML = siswaRows.map(({s,saldo})=>`<tr>
        <td></td>
        <td><b style="color:var(--navy)">${Utils.escapeHtml(s.nama)}</b></td>
        <td>${s.kelas}</td>
        <td>${Cache.kamarName(s.kamarId)}</td>
        <td class="fw-bold" style="color:${saldo<0?'var(--danger)':'var(--navy)'}">${Utils.fmtCurrency(saldo)}</td>
        <td>
          <button class="btn btn-sm btn-outline-navy" data-act="passbook" data-id="${s.id}"><i class="fa-solid fa-book me-1"></i>Buku Tabungan</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-4">Belum ada data siswa</td></tr>`;

      document.querySelectorAll("#saldoTable [data-act]").forEach(btn=>{
        btn.onclick = () => openPassbook(btn.dataset.id, data);
      });
      dt = $("#saldoTable").DataTable({ pageLength:10, columnDefs:[TableUtil.numberColumnDef(0), {orderable:false,targets:5}], language:{search:"Cari siswa:",zeroRecords:"Data tidak ditemukan"} });
    }

    document.getElementById("btnAddTx").onclick = () => openTxForm(null, async ()=>{ await reload(); render(container); });
    reload();
  }

  function renderChart(rows){
    const months = Array.from({length:6}).map((_,i)=>luxon.DateTime.now().minus({months:5-i}));
    new Chart(document.getElementById("chartTabungan"), {
      type:"line",
      data:{
        labels: months.map(m=>m.setLocale("id").toFormat("LLL yy")),
        datasets:[
          { label:"Setoran", data: months.map(m=>rows.filter(r=>r.jenis==="Setoran"&&luxon.DateTime.fromISO(r.tanggal).hasSame(m,"month")).reduce((a,r)=>a+Number(r.jumlah||0),0)), borderColor:"#1e8a5f", backgroundColor:"rgba(30,138,95,.12)", fill:true, tension:.35 },
          { label:"Penarikan", data: months.map(m=>rows.filter(r=>r.jenis==="Penarikan"&&luxon.DateTime.fromISO(r.tanggal).hasSame(m,"month")).reduce((a,r)=>a+Number(r.jumlah||0),0)), borderColor:"#c0392b", backgroundColor:"rgba(192,57,43,.10)", fill:true, tension:.35 },
        ]
      },
      options:{ plugins:{legend:{position:"bottom"}} }
    });
  }

  async function openTxForm(preSelectSiswaId, onSaved){
    const allRows = await Api.list("tabungan");
    const result = await Swal.fire({
      title:"Tambah Transaksi Tabungan", width:520, showCancelButton:true,
      confirmButtonColor:"#0a2540", confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<div class="row g-3 text-start">
        <div class="col-12"><label class="form-label-mbms">Siswa</label>
          <select id="f_siswa" class="form-select form-control-mbms" style="padding-left:16px">
          ${Cache.allSiswa().map(s=>`<option value="${s.id}" ${preSelectSiswaId===s.id?'selected':''}>${s.nama} (${s.kelas})</option>`).join("")}
          </select></div>
        <div class="col-6"><label class="form-label-mbms">Jenis Transaksi</label>
          <select id="f_jenis" class="form-select form-control-mbms" style="padding-left:16px">
            <option value="Setoran">Setoran</option><option value="Penarikan">Penarikan</option>
          </select></div>
        <div class="col-6"><label class="form-label-mbms">Tanggal</label><input type="date" id="f_tgl" class="form-control form-control-mbms" style="padding-left:16px" value="${luxon.DateTime.now().toISODate()}"></div>
        <div class="col-12"><label class="form-label-mbms">Jumlah (Rp)</label><input type="number" id="f_jml" class="form-control form-control-mbms" style="padding-left:16px" min="0"></div>
        <div class="col-12"><label class="form-label-mbms">Keterangan</label><input id="f_ket" class="form-control form-control-mbms" style="padding-left:16px" placeholder="mis. Setoran orang tua, beli alat mandi, dll"></div>
        <div class="col-12" id="saldoHint" style="font-size:12px;color:var(--muted)"></div>
      </div>`,
      didOpen: () => {
        const updateHint = () => {
          const sid = document.getElementById("f_siswa").value;
          const saldo = computeBalance(allRows, sid);
          document.getElementById("saldoHint").innerHTML = `Saldo saat ini: <b style="color:var(--navy)">${Utils.fmtCurrency(saldo)}</b>`;
        };
        document.getElementById("f_siswa").onchange = updateHint;
        updateHint();
      },
      preConfirm: () => {
        const siswaId = document.getElementById("f_siswa").value;
        const jenis = document.getElementById("f_jenis").value;
        const jumlah = Number(document.getElementById("f_jml").value);
        const tanggal = document.getElementById("f_tgl").value;
        const keterangan = document.getElementById("f_ket").value;
        if(!jumlah || jumlah <= 0){ Swal.showValidationMessage("Jumlah harus lebih dari 0"); return false; }
        const saldoSaatIni = computeBalance(allRows, siswaId);
        if(jenis === "Penarikan" && jumlah > saldoSaatIni){
          Swal.showValidationMessage(`Saldo tidak cukup. Saldo saat ini: ${Utils.fmtCurrency(saldoSaatIni)}`);
          return false;
        }
        const saldoSetelah = jenis === "Setoran" ? saldoSaatIni + jumlah : saldoSaatIni - jumlah;
        return { siswaId, jenis, jumlah, tanggal, keterangan, saldoSetelah, petugas: Session.get().nama };
      }
    });
    if(!result.isConfirmed) return;
    await Api.create("tabungan", result.value);
    Auth.logAudit("CREATE", `${result.value.jenis} tabungan ${Utils.fmtCurrency(result.value.jumlah)} — ${Cache.siswaName(result.value.siswaId)}`);

    if(result.value.jenis === "Penarikan" && result.value.saldoSetelah < LOW_BALANCE_THRESHOLD){
      await Api.create("notifications", {
        tipe:"Kesehatan", judul:"Saldo tabungan menipis",
        pesan:`${Cache.siswaName(result.value.siswaId)} — saldo tersisa ${Utils.fmtCurrency(result.value.saldoSetelah)}`,
        dibaca:false, waktu:new Date().toISOString(),
      });
      Notif.refreshBadge();
    }

    Utils.toast("success","Transaksi tabungan disimpan");
    onSaved();
  }

  async function openPassbook(siswaId, allRows){
    const s = Cache.siswaObj(siswaId);
    const history = allRows.filter(r=>r.siswaId===siswaId).sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
    const saldo = computeBalance(allRows, siswaId);

    const html = `<div class="text-start">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div><b style="color:var(--navy)">${s.nama}</b><div style="font-size:12px;color:var(--muted)">${s.kelas} · ${Cache.kamarName(s.kamarId)}</div></div>
        <div class="text-end"><div style="font-size:11px;color:var(--muted)">Saldo Saat Ini</div><b style="font-size:18px;color:var(--navy)">${Utils.fmtCurrency(saldo)}</b></div>
      </div>
      <div class="table-responsive" style="max-height:340px;overflow-y:auto">
        <table class="table table-sm">
          <thead><tr><th style="width:36px">No</th><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th class="text-end">Jumlah</th><th class="text-end">Saldo</th></tr></thead>
          <tbody>
            ${history.map((h,i)=>`<tr>
              <td>${i+1}</td>
              <td>${Utils.fmtDate(h.tanggal)}</td>
              <td><span class="badge-mbms ${h.jenis==='Setoran'?'badge-success':'badge-danger'}">${h.jenis}</span></td>
              <td>${Utils.escapeHtml(h.keterangan||'-')}</td>
              <td class="text-end">${h.jenis==='Setoran'?'+':'-'} ${Utils.fmtCurrency(h.jumlah)}</td>
              <td class="text-end">${Utils.fmtCurrency(h.saldoSetelah)}</td>
            </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada transaksi</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

    await Swal.fire({
      title:"Buku Tabungan", html, width:640, confirmButtonColor:"#0a2540",
      showDenyButton:true, confirmButtonText:"Tutup", denyButtonText:'<i class="fa-solid fa-print me-1"></i>Cetak PDF',
    }).then(r => {
      if(r.isDenied){
        Reports.exportPdf(`Buku Tabungan - ${s.nama}`, ["Tanggal","Jenis","Keterangan","Jumlah","Saldo"],
          history.map(h=>[Utils.fmtDate(h.tanggal), h.jenis, h.keterangan||"-", Utils.fmtCurrency(h.jumlah), Utils.fmtCurrency(h.saldoSetelah)]));
      }
    });
  }

  Router.register("tabungan", render);
})();
