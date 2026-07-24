/* ==========================================================================
   MBMS — modules/reports.js  (Laporan & Export)
   Reusable Excel/PDF export helpers (Reports.*) + the report-builder page.
   ========================================================================== */
const Reports = (() => {

  function exportExcel(rows, filename){
    if(!rows.length){ Utils.toast("error","Tidak ada data untuk diekspor"); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}_${luxon.DateTime.now().toFormat("yyyyLLdd")}.xlsx`);
    Utils.toast("success","File Excel berhasil diunduh");
  }

  function readExcel(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = (e) => {
        try{
          const wb = XLSX.read(e.target.result, { type:"binary" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(sheet));
        }catch(err){ reject(err); }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  }

  function exportPdf(title, columns, rows){
    if(!rows.length){ Utils.toast("error","Tidak ada data untuk diekspor"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: columns.length>5 ? "landscape":"portrait" });
    doc.setFontSize(14); doc.setTextColor(10,37,64);
    doc.text(APP_CONFIG.APP_NAME, 14, 16);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(APP_CONFIG.SUBTITLE, 14, 22);
    doc.setFontSize(12); doc.setTextColor(20);
    doc.text(title, 14, 32);
    doc.autoTable({
      startY: 38,
      head: [columns],
      body: rows,
      headStyles: { fillColor: [10,37,64], textColor: 255 },
      alternateRowStyles: { fillColor: [245,247,250] },
      styles: { fontSize: 8.5 },
    });
    const pageCount = doc.internal.getNumberOfPages();
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Wali Asrama: ${APP_CONFIG.WALI_ASRAMA}  ·  Dicetak ${luxon.DateTime.now().toFormat("dd/LL/yyyy HH:mm")}`, 14, doc.internal.pageSize.getHeight()-8);
    }
    doc.save(`${title.replace(/\s+/g,"_")}_${luxon.DateTime.now().toFormat("yyyyLLdd")}.pdf`);
    Utils.toast("success","File PDF berhasil diunduh");
  }

  const REPORT_TYPES = [
    { id:"siswa", label:"Data Siswa", cols:["NIS","Nama","Kelas","Kamar","Status"], map:(r,c)=>[r.nis,r.nama,r.kelas,c.kamarName(r.kamarId),r.status] },
    { id:"presensi", label:"Presensi Harian", cols:["Tanggal","Siswa","Bangun","Sholat","Mengaji","Sekolah","Tidur"], map:(r,c)=>[Utils.fmtDate(r.tanggal),c.siswaName(r.siswaId),r.bangun,r.sholat,r.mengaji,r.sekolah,r.tidur] },
    { id:"pelanggaran", label:"Pelanggaran & Pembinaan", cols:["Tanggal","Siswa","Kategori","Jenis","Poin","Status"], map:(r,c)=>[Utils.fmtDate(r.tanggal),c.siswaName(r.siswaId),r.kategori,r.jenis,r.poin,r.status] },
    { id:"prestasi", label:"Prestasi Siswa", cols:["Tanggal","Siswa","Kategori","Prestasi","Tingkat"], map:(r,c)=>[Utils.fmtDate(r.tanggal),c.siswaName(r.siswaId),r.kategori,r.nama,r.tingkat] },
    { id:"kesehatan", label:"Kesehatan Siswa", cols:["Tanggal","Siswa","Keluhan","Dirujuk"], map:(r,c)=>[Utils.fmtDate(r.tanggal),c.siswaName(r.siswaId),r.keluhan,r.statusRujuk] },
    { id:"tumbuh_kembang", label:"Tumbuh Kembang Siswa", cols:["Tanggal","Siswa","Tinggi (cm)","Berat (kg)","IMT"], map:(r,c)=>[Utils.fmtDate(r.tanggal),c.siswaName(r.siswaId),r.tinggiBadan,r.beratBadan,r.bmi] },
    { id:"tabungan", label:"Tabungan Siswa", cols:["Tanggal","Siswa","Jenis","Keterangan","Jumlah","Saldo Setelah"], map:(r,c)=>[Utils.fmtDate(r.tanggal),c.siswaName(r.siswaId),r.jenis,r.keterangan,Utils.fmtCurrency(r.jumlah),Utils.fmtCurrency(r.saldoSetelah)] },
    { id:"perizinan", label:"Perizinan Siswa", cols:["Siswa","Jenis","Keluar","Kembali","Status"], map:(r,c)=>[c.siswaName(r.siswaId),r.jenis,Utils.fmtDate(r.tglKeluar),Utils.fmtDate(r.tglKembali),r.status] },
    { id:"piket_putaran", label:"Jadwal Piket", cols:["Gedung","Putaran Ke","Tanggal Mulai","Ketua Kamar"], map:(r,c)=>{
      let ketuaIds = []; try{ ketuaIds = JSON.parse(r.ketuaKamarIds||"[]"); }catch(e){}
      return [r.gedung, r.putaranKe, Utils.fmtDate(r.tanggalMulai), ketuaIds.map(id=>c.siswaName(id)).join(", ") || "-"];
    } },
  ];

  async function renderPage(container){
    await Cache.refresh();
    container.innerHTML = `<div class="page-content">
      <div class="page-header"><div><h3><i class="fa-solid fa-file-export" style="color:var(--gold);margin-right:8px"></i>Laporan &amp; Export</h3>
      <p>Buat laporan per siswa, per kamar, bulanan, atau semester — ekspor ke PDF/Excel</p></div></div>

      <div class="card-mbms card-body-mbms mb-4">
        <div class="row g-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label-mbms">Jenis Laporan</label>
            <select id="repType" class="form-select form-control-mbms" style="padding-left:16px">
              ${REPORT_TYPES.map(r=>`<option value="${r.id}">${r.label}</option>`).join("")}
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label-mbms">Filter Siswa (opsional)</label>
            <select id="repSiswa" class="form-select form-control-mbms" style="padding-left:16px"><option value="">Semua Siswa</option>
              ${Cache.allSiswa().map(s=>`<option value="${s.id}">${s.nama}</option>`).join("")}</select>
          </div>
          <div class="col-md-2">
            <label class="form-label-mbms">Dari Tanggal</label>
            <input type="date" id="repFrom" class="form-control form-control-mbms" style="padding-left:16px">
          </div>
          <div class="col-md-2">
            <label class="form-label-mbms">Sampai Tanggal</label>
            <input type="date" id="repTo" class="form-control form-control-mbms" style="padding-left:16px">
          </div>
          <div class="col-md-1">
            <button class="btn btn-navy w-100" id="btnFilterRep"><i class="fa-solid fa-filter"></i></button>
          </div>
        </div>
      </div>

      <div class="card-mbms">
        <div class="card-header-mbms">
          <h6 id="repTitle">Data Siswa</h6>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-navy btn-sm" id="btnExpExcel"><i class="fa-solid fa-file-excel me-1"></i>Excel</button>
            <button class="btn btn-outline-navy btn-sm" id="btnExpPdf"><i class="fa-solid fa-file-pdf me-1"></i>PDF</button>
          </div>
        </div>
        <div class="card-body-mbms">
          <div class="table-responsive"><table class="table table-hover" id="repTable" style="width:100%"><thead></thead><tbody></tbody></table></div>
        </div>
      </div>
    </div>`;

    let currentRows = [], currentDef = REPORT_TYPES[0], repDt = null;

    async function loadReport(){
      const typeId = document.getElementById("repType").value;
      currentDef = REPORT_TYPES.find(r=>r.id===typeId);
      document.getElementById("repTitle").textContent = currentDef.label;
      let data = await Api.list(typeId);
      const siswaFilter = document.getElementById("repSiswa").value;
      const from = document.getElementById("repFrom").value;
      const to = document.getElementById("repTo").value;
      if(siswaFilter) data = data.filter(r=>r.siswaId===siswaFilter);
      if(from) data = data.filter(r=> (r.tanggal||r.tglKeluar||"") >= from);
      if(to) data = data.filter(r=> (r.tanggal||r.tglKeluar||"") <= to);

      currentRows = data.map(r => currentDef.map(r, Cache));
      if(repDt){ repDt.destroy(); repDt = null; }
      document.querySelector("#repTable thead").innerHTML = `<tr><th style="width:48px">No</th>${currentDef.cols.map(c=>`<th>${c}</th>`).join("")}</tr>`;
      document.querySelector("#repTable tbody").innerHTML = currentRows.map(row=>`<tr><td></td>${row.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${currentDef.cols.length+1}" class="text-center text-muted py-4">Tidak ada data pada filter ini</td></tr>`;
      if(currentRows.length){
        repDt = $("#repTable").DataTable({ pageLength:10, columnDefs:[TableUtil.numberColumnDef(0)], language:{search:"Cari:",zeroRecords:"Data tidak ditemukan"}, destroy:true });
      }
    }

    document.getElementById("btnFilterRep").onclick = loadReport;
    document.getElementById("repType").onchange = loadReport;
    document.getElementById("btnExpExcel").onclick = () => {
      const objs = currentRows.map(row => Object.fromEntries(currentDef.cols.map((c,i)=>[c,row[i]])));
      exportExcel(objs, currentDef.label.replace(/\s+/g,"_"));
    };
    document.getElementById("btnExpPdf").onclick = () => exportPdf(currentDef.label, currentDef.cols, currentRows);

    loadReport();
  }

  Router.register("reports", renderPage);

  return { exportExcel, readExcel, exportPdf };
})();
