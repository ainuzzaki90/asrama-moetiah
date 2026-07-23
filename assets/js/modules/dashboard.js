/* ==========================================================================
   MBMS — modules/dashboard.js
   ========================================================================== */
(function(){

  async function render(container){
    const [siswa, kamar, presensiAll, izin, pelanggaran, keuangan] = await Promise.all([
      Api.list("siswa"), Api.list("kamar"), Api.list("presensi"),
      Api.list("perizinan"), Api.list("pelanggaran"), Api.list("keuangan"),
    ]);
    await Cache.refresh();

    const today = luxon.DateTime.now().toISODate();
    const presensiToday = presensiAll.filter(p=>p.tanggal===today);
    const izinBerjalan = izin.filter(i=>i.status==="Berjalan").length;
    const kapasitasTotal = kamar.reduce((a,k)=>a+Number(k.kapasitas||0),0);
    const terisi = siswa.filter(s=>s.status==="Aktif").length;
    const pemasukan = keuangan.filter(k=>k.jenis==="Pemasukan").reduce((a,k)=>a+Number(k.jumlah||0),0);
    const pengeluaran = keuangan.filter(k=>k.jenis==="Pengeluaran").reduce((a,k)=>a+Number(k.jumlah||0),0);
    const saldo = pemasukan - pengeluaran;
    const pelanggaranBulanIni = pelanggaran.filter(p=>luxon.DateTime.fromISO(p.tanggal).hasSame(luxon.DateTime.now(),"month")).length;

    const sakit = (await Api.list("kesehatan")).filter(k=>luxon.DateTime.fromISO(k.tanggal).hasSame(luxon.DateTime.now(),"day")).length;

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h3>Selamat datang, ${Session.get().nama.split(" ")[0]} 👋</h3>
            <p>Ringkasan aktivitas asrama — ${luxon.DateTime.now().setLocale("id").toFormat("cccc, dd LLLL yyyy")}</p>
          </div>
          <span class="badge-mbms badge-navy"><i class="fa-solid fa-circle" style="font-size:6px;color:var(--success);margin-right:6px"></i>Data live</span>
        </div>

        <div class="row g-3 mb-4">
          ${statCard("fa-solid fa-user-graduate","var(--info)","var(--info-bg)", terisi, "Total Santri Aktif", `${kamar.length} kamar tersedia`)}
          ${statCard("fa-solid fa-door-open","var(--gold-dark)","var(--warning-bg)", `${terisi}/${kapasitasTotal}`, "Okupansi Asrama", Math.round(terisi/kapasitasTotal*100)+"% terisi")}
          ${statCard("fa-solid fa-right-from-bracket","var(--danger)","var(--danger-bg)", izinBerjalan, "Izin Sedang Berjalan", izinBerjalan? "Perlu dipantau" : "Semua santri di asrama")}
          ${statCard("fa-solid fa-sack-dollar","var(--success)","var(--success-bg)", Utils.fmtCurrency(saldo), "Saldo Kas Asrama", "Bulan berjalan")}
        </div>

        <div class="row g-3 mb-4">
          <div class="col-lg-8">
            <div class="card-mbms h-100">
              <div class="card-header-mbms"><h6><i class="fa-solid fa-chart-line me-2" style="color:var(--gold)"></i>Grafik Keuangan 6 Bulan Terakhir</h6></div>
              <div class="card-body-mbms"><canvas id="chartKeuangan" height="95"></canvas></div>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="card-mbms h-100">
              <div class="card-header-mbms"><h6><i class="fa-solid fa-clipboard-check me-2" style="color:var(--gold)"></i>Presensi Hari Ini</h6></div>
              <div class="card-body-mbms"><canvas id="chartPresensi" height="180"></canvas></div>
            </div>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-lg-7">
            <div class="card-mbms">
              <div class="card-header-mbms">
                <h6><i class="fa-solid fa-triangle-exclamation me-2" style="color:var(--gold)"></i>Pelanggaran Terbaru</h6>
                <span class="badge-mbms badge-warning">${pelanggaranBulanIni} bulan ini</span>
              </div>
              <div class="card-body-mbms p-0">
                <table class="table mb-0">
                  <tbody>
                    ${pelanggaran.slice(-5).reverse().map(p=>`<tr>
                      <td style="width:44px"><div class="stat-card" style="padding:0;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:none;background:var(--danger-bg)"><i class="fa-solid fa-user" style="color:var(--danger);font-size:13px"></i></div></td>
                      <td><b style="font-size:13px;color:var(--navy)">${Cache.siswaName(p.siswaId)}</b><div style="font-size:12px;color:var(--muted)">${Utils.escapeHtml(p.jenis)}</div></td>
                      <td class="text-end"><span class="badge-mbms ${p.kategori==='Berat'?'badge-danger':p.kategori==='Sedang'?'badge-warning':'badge-info'}">${p.kategori}</span><div style="font-size:11px;color:var(--muted)">${Utils.fmtDate(p.tanggal)}</div></td>
                    </tr>`).join("") || `<tr><td class="text-center text-muted py-4">Tidak ada catatan pelanggaran</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="card-mbms">
              <div class="card-header-mbms"><h6><i class="fa-solid fa-kit-medical me-2" style="color:var(--gold)"></i>Ringkasan Kesehatan</h6></div>
              <div class="card-body-mbms">
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <div><div class="lbl" style="color:var(--muted);font-size:12.5px">Santri sakit hari ini</div><div class="val" style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--navy)">${sakit}</div></div>
                  <i class="fa-solid fa-thermometer" style="font-size:28px;color:var(--warning)"></i>
                </div>
                <hr class="hairline-gold">
                <div class="lbl mb-2" style="color:var(--muted);font-size:12.5px">Distribusi Santri per Kamar</div>
                <canvas id="chartKamar" height="140"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    renderCharts(keuangan, presensiToday, siswa, kamar);
  }

  function statCard(icon,color,bg,val,lbl,trend){
    return `<div class="col-sm-6 col-xl-3">
      <div class="stat-card">
        <div class="icon-wrap" style="background:${bg};color:${color}"><i class="${icon}"></i></div>
        <div class="val">${val}</div>
        <div class="lbl">${lbl}</div>
        <div class="trend up"><i class="fa-solid fa-arrow-trend-up me-1"></i>${trend}</div>
      </div>
    </div>`;
  }

  function renderCharts(keuangan, presensiToday, siswa, kamar){
    const months = Array.from({length:6}).map((_,i)=> luxon.DateTime.now().minus({months:5-i}));
    const income = months.map(m => keuangan.filter(k=>k.jenis==="Pemasukan" && luxon.DateTime.fromISO(k.tanggal).hasSame(m,"month")).reduce((a,k)=>a+Number(k.jumlah||0),0));
    const expense = months.map(m => keuangan.filter(k=>k.jenis==="Pengeluaran" && luxon.DateTime.fromISO(k.tanggal).hasSame(m,"month")).reduce((a,k)=>a+Number(k.jumlah||0),0));

    new Chart(document.getElementById("chartKeuangan"), {
      type:"bar",
      data:{
        labels: months.map(m=>m.setLocale("id").toFormat("LLL yy")),
        datasets:[
          { label:"Pemasukan", data:income, backgroundColor:"#0a2540", borderRadius:6 },
          { label:"Pengeluaran", data:expense, backgroundColor:"#d4af37", borderRadius:6 },
        ]
      },
      options:{ responsive:true, plugins:{legend:{position:"bottom"}}, scales:{ y:{ ticks:{ callback:v=>"Rp "+(v/1000)+"rb" } } } }
    });

    const hadir = presensiToday.filter(p=>p.sholat==="Hadir").length;
    const izin = presensiToday.filter(p=>p.sholat==="Izin").length;
    const alpa = presensiToday.filter(p=>p.sholat==="Alpa").length;
    new Chart(document.getElementById("chartPresensi"), {
      type:"doughnut",
      data:{ labels:["Hadir","Izin","Alpa"], datasets:[{ data:[hadir,izin,alpa||0], backgroundColor:["#1e8a5f","#2563a8","#c0392b"] }] },
      options:{ plugins:{legend:{position:"bottom"}}, cutout:"65%" }
    });

    new Chart(document.getElementById("chartKamar"), {
      type:"bar",
      data:{
        labels: kamar.map(k=>k.nama.replace("Kamar ","")),
        datasets:[{ label:"Terisi", data: kamar.map(k=>siswa.filter(s=>s.kamarId===k.id && s.status==="Aktif").length), backgroundColor:"#0a2540", borderRadius:6 }]
      },
      options:{ indexAxis:"y", plugins:{legend:{display:false}} }
    });
  }

  Router.register("dashboard", render);
})();
