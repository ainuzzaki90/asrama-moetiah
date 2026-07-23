/* ==========================================================================
   MBMS — modules/aiAssistant.js  (AI Assistant — floating button)
   ----------------------------------------------------------------------
   Ships as a data-grounded rule engine that reads live boarding data
   (pelanggaran, presensi, kesehatan, prestasi) to summarize students,
   flag at-risk cases, and draft guidance notes — no external API key
   required, works fully offline.

   To upgrade to a true generative LLM: point AI_ENDPOINT (below) to a
   small server-side proxy (e.g. an Apps Script doPost, or any backend
   you control) that holds your model API key and forwards the prompt
   built in buildPrompt(). Never place a real API key in this frontend
   file. If AI_ENDPOINT is left null, the local rule engine is used.
   ========================================================================== */
(function(){

  const AI_ENDPOINT = null; // e.g. "https://your-server.example.com/ai-proxy"

  function mountWidget(){
    if(document.getElementById("aiFab")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <button class="ai-fab" id="aiFab" title="AI Assistant"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
      <div class="ai-chat-window" id="aiChatWindow">
        <div class="ai-chat-head">
          <span class="status"></span>
          <div>
            <b style="font-size:13.5px">MBMS AI Assistant</b>
            <div style="font-size:10.5px;opacity:.8">Analisis data asrama secara instan</div>
          </div>
          <button class="btn-close btn-close-white ms-auto" style="font-size:11px" id="aiClose"></button>
        </div>
        <div class="ai-chat-body" id="aiChatBody"></div>
        <div class="px-3 pb-2 d-flex flex-wrap" id="aiSuggestions"></div>
        <div class="ai-chat-foot">
          <input type="text" id="aiInput" placeholder="Tanyakan sesuatu tentang santri...">
          <button class="btn btn-navy" id="aiSend"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>`);

    document.getElementById("aiFab").onclick = () => {
      document.getElementById("aiChatWindow").classList.toggle("show");
      if(!document.getElementById("aiChatBody").dataset.greeted) greet();
    };
    document.getElementById("aiClose").onclick = () => document.getElementById("aiChatWindow").classList.remove("show");
    document.getElementById("aiSend").onclick = sendMessage;
    document.getElementById("aiInput").addEventListener("keydown", e => { if(e.key==="Enter") sendMessage(); });
  }

  function greet(){
    const body = document.getElementById("aiChatBody");
    body.dataset.greeted = "1";
    addMsg("bot", `Assalamu'alaikum, ${Session.get().nama.split(" ")[0]}! Saya asisten AI MBMS. Saya bisa membantu meringkas perkembangan santri, mendeteksi santri bermasalah, memberi rekomendasi pembinaan, atau membuatkan draft laporan. Ada yang bisa saya bantu?`);
    renderSuggestions([
      "Deteksi santri bermasalah",
      "Ringkasan perkembangan santri",
      "Rekomendasi pembinaan",
      "Buatkan laporan bulanan",
    ]);
  }

  function renderSuggestions(list){
    document.getElementById("aiSuggestions").innerHTML = list.map(s=>`<button class="ai-suggest">${s}</button>`).join("");
    document.querySelectorAll(".ai-suggest").forEach(btn=>{
      btn.onclick = () => { document.getElementById("aiInput").value = btn.textContent; sendMessage(); };
    });
  }

  function addMsg(role, html){
    const body = document.getElementById("aiChatBody");
    body.insertAdjacentHTML("beforeend", `<div class="ai-msg ${role}">${html}</div>`);
    body.scrollTop = body.scrollHeight;
  }

  async function sendMessage(){
    const input = document.getElementById("aiInput");
    const text = input.value.trim();
    if(!text) return;
    addMsg("user", Utils.escapeHtml(text));
    input.value = "";
    document.getElementById("aiSuggestions").innerHTML = "";
    addMsg("bot", `<i class="fa-solid fa-circle-notch fa-spin"></i> Menganalisis data...`);
    const reply = AI_ENDPOINT ? await callRemote(text) : await localAnswer(text);
    const body = document.getElementById("aiChatBody");
    body.lastElementChild.remove();
    addMsg("bot", reply.html);
    if(reply.suggestions) renderSuggestions(reply.suggestions);
  }

  async function callRemote(text){
    try{
      const res = await fetch(AI_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ prompt: text }) });
      const data = await res.json();
      return { html: Utils.escapeHtml(data.answer || "Tidak ada jawaban.") };
    }catch(e){
      return { html: "Gagal menghubungi layanan AI eksternal. Menggunakan analisis lokal sebagai cadangan.<br>" + (await localAnswer(text)).html };
    }
  }

  // ---- Local rule-based data analysis ------------------------------------
  async function localAnswer(text){
    const t = text.toLowerCase();
    const [siswa, pelanggaran, presensi, kesehatan, prestasi] = await Promise.all([
      Api.list("siswa"), Api.list("pelanggaran"), Api.list("presensi"), Api.list("kesehatan"), Api.list("prestasi"),
    ]);

    if(t.includes("bermasalah") || t.includes("deteksi")) return detectAtRisk(siswa, pelanggaran, presensi);
    if(t.includes("rekomendasi")) return recommendGuidance(siswa, pelanggaran);
    if(t.includes("laporan")) return draftReport(siswa, pelanggaran, presensi, kesehatan, prestasi);
    const found = siswa.find(s => t.includes(s.nama.toLowerCase().split(" ")[0]));
    if(t.includes("ringkasan") || found) return summarizeStudent(found, siswa, pelanggaran, presensi, kesehatan, prestasi);

    return {
      html: `Saya belum sepenuhnya memahami pertanyaan itu. Coba salah satu topik berikut:`,
      suggestions: ["Deteksi santri bermasalah","Ringkasan perkembangan santri","Rekomendasi pembinaan","Buatkan laporan bulanan"],
    };
  }

  function detectAtRisk(siswa, pelanggaran, presensi){
    const scores = siswa.map(s=>{
      const poin = pelanggaran.filter(p=>p.siswaId===s.id).reduce((a,p)=>a+Number(p.poin||0),0);
      const alpa = presensi.filter(p=>p.siswaId===s.id && [p.bangun,p.sholat,p.mengaji,p.sekolah].includes("Alpa")).length;
      return { s, risk: poin + alpa*10 };
    }).filter(r=>r.risk>0).sort((a,b)=>b.risk-a.risk);

    if(!scores.length) return { html:"Kabar baik — tidak ada indikasi santri bermasalah signifikan berdasarkan data pelanggaran & presensi saat ini." };

    const html = `Berdasarkan akumulasi poin pelanggaran &amp; ketidakhadiran, berikut santri yang perlu perhatian ekstra:<br><br>` +
      scores.slice(0,5).map((r,i)=>`<b>${i+1}. ${r.s.nama}</b> — skor risiko ${r.risk} <span style="color:var(--muted)">(${r.s.kelas})</span>`).join("<br>") +
      `<br><br>Disarankan untuk menjadwalkan sesi pembinaan personal dengan santri berskor tertinggi.`;
    return { html, suggestions:["Rekomendasi pembinaan", `Ringkasan ${scores[0].s.nama.split(" ")[0]}`] };
  }

  function recommendGuidance(siswa, pelanggaran){
    const grouped = {};
    pelanggaran.forEach(p=>{ grouped[p.siswaId] = (grouped[p.siswaId]||0) + Number(p.poin||0); });
    const top = Object.entries(grouped).sort((a,b)=>b[1]-a[1])[0];
    if(!top) return { html:"Belum ada data pelanggaran yang cukup untuk memberi rekomendasi pembinaan." };
    const s = siswa.find(x=>x.id===top[0]);
    const level = top[1] >= 30 ? "intensif (melibatkan orang tua)" : top[1] >= 15 ? "terstruktur (bimbingan mingguan)" : "ringan (teguran & pemantauan)";
    return { html: `Untuk <b>${s?.nama||top[0]}</b> dengan total poin pelanggaran ${top[1]}, rekomendasi pembinaan: <b>${level}</b>. Sertakan dokumentasi tertulis dan evaluasi progres setiap 2 minggu.` };
  }

  function summarizeStudent(found, siswa, pelanggaran, presensi, kesehatan, prestasi){
    if(!found) return { html:"Sebutkan nama santri yang ingin diringkas, misalnya: \"ringkasan Ahmad\"." };
    const pl = pelanggaran.filter(p=>p.siswaId===found.id);
    const pr = prestasi.filter(p=>p.siswaId===found.id);
    const ks = kesehatan.filter(p=>p.siswaId===found.id);
    const html = `<b>${found.nama}</b> (${found.kelas}) — Kamar: ${found.kamarId}<br><br>` +
      `• Pelanggaran: ${pl.length} catatan, total poin ${pl.reduce((a,p)=>a+Number(p.poin||0),0)}<br>` +
      `• Prestasi: ${pr.length} pencapaian${pr[0]?` — terbaru: ${pr[pr.length-1].nama}`:""}<br>` +
      `• Kesehatan: ${ks.length} kunjungan UKS tercatat<br><br>` +
      (pl.length===0 ? "Santri menunjukkan perilaku yang baik secara umum." : "Perlu pemantauan berkelanjutan terkait catatan pelanggaran.");
    return { html };
  }

  function draftReport(siswa, pelanggaran, presensi, kesehatan, prestasi){
    const bulan = luxon.DateTime.now().setLocale("id").toFormat("LLLL yyyy");
    const html = `<b>Draft Laporan Bulanan — ${bulan}</b><br><br>` +
      `• Total santri aktif: ${siswa.filter(s=>s.status==="Aktif").length}<br>` +
      `• Pelanggaran tercatat: ${pelanggaran.length}<br>` +
      `• Prestasi diraih: ${prestasi.length}<br>` +
      `• Kunjungan kesehatan: ${kesehatan.length}<br><br>` +
      `Buka menu <b>Laporan &amp; Export</b> untuk mengekspor versi lengkap ke PDF/Excel.`;
    return { html, suggestions:["Buka menu laporan"] };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const check = setInterval(()=>{
      if(Session.get()){ mountWidget(); clearInterval(check); }
    }, 500);
  });
})();
