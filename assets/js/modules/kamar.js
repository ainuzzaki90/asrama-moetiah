/* ==========================================================================
   MBMS — modules/kamar.js  (Manajemen Kamar)
   Visual room-layout grid showing bed occupancy per room.
   ========================================================================== */
(function(){

  async function render(container){
    const [kamar, siswa] = await Promise.all([Api.list("kamar"), Api.list("siswa")]);

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-door-open" style="color:var(--gold);margin-right:8px"></i>Manajemen Kamar</h3>
          <p>Layout visual kamar &amp; okupansi santri secara real-time</p></div>
          <button class="btn btn-navy" id="btnAddRoom"><i class="fa-solid fa-plus me-1"></i>Tambah Kamar</button>
        </div>
        <div class="room-grid" id="roomGrid"></div>
      </div>`;

    async function reload(){
      const kamarList = await Api.list("kamar");
      const siswaList = await Api.list("siswa");
      const grid = document.getElementById("roomGrid");
      grid.innerHTML = kamarList.map(k => {
        const penghuni = siswaList.filter(s=>s.kamarId===k.id && s.status==="Aktif");
        const pct = Math.min(100, Math.round(penghuni.length / k.kapasitas * 100));
        const beds = Array.from({length:k.kapasitas}).map((_,i)=>{
          const s = penghuni[i];
          return s ? `<span class="bed-dot filled" title="${s.nama}">${Auth.initials(s.nama)}</span>`
                    : `<span class="bed-dot empty" title="Kosong"><i class="fa-solid fa-plus" style="font-size:9px"></i></span>`;
        }).join("");
        return `<div class="room-block">
          <span class="badge-mbms ${k.jk==='L'?'badge-info':'badge-warning'}" style="position:absolute;top:14px;right:14px">${k.jk==='L'?'Putra':'Putri'}</span>
          <h6>${k.nama}</h6>
          <small style="color:var(--muted)">${k.gedung} · Lantai ${k.lantai}</small>
          <div class="cap-bar"><div class="cap-fill" style="width:${pct}%"></div></div>
          <small style="color:var(--muted);font-size:11px">${penghuni.length}/${k.kapasitas} terisi (${pct}%)</small>
          <div class="mt-2">${beds}</div>
          <div class="d-flex gap-1 mt-3">
            <button class="btn btn-sm btn-outline-navy flex-fill" data-act="view" data-id="${k.id}"><i class="fa-solid fa-eye"></i></button>
            <button class="btn btn-sm btn-soft-info flex-fill" data-act="edit" data-id="${k.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-soft-danger flex-fill" data-act="delete" data-id="${k.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
      }).join("");

      grid.querySelectorAll("[data-act]").forEach(btn=>{
        btn.onclick = async () => {
          const room = kamarList.find(r=>r.id===btn.dataset.id);
          const penghuni = siswaList.filter(s=>s.kamarId===room.id);
          if(btn.dataset.act==="view"){
            Swal.fire({
              title: room.nama, confirmButtonColor:"#0a2540", confirmButtonText:"Tutup",
              html: `<div class="text-start">
                <p class="text-muted mb-2">${room.gedung} · Lantai ${room.lantai} · Kapasitas ${room.kapasitas}</p>
                <table class="table table-sm"><tbody>
                ${penghuni.map(s=>`<tr><td>${s.nama}</td><td class="text-muted">${s.kelas}</td></tr>`).join("") || '<tr><td class="text-muted">Belum ada penghuni</td></tr>'}
                </tbody></table></div>`
            });
          }
          if(btn.dataset.act==="edit") return openRoomForm(room, reload);
          if(btn.dataset.act==="delete"){
            if(penghuni.length){ Utils.toast("error","Tidak bisa menghapus kamar yang masih berpenghuni"); return; }
            const ok = await Utils.confirmDelete(room.nama);
            if(!ok) return;
            await Api.remove("kamar", room.id);
            Utils.toast("success","Kamar dihapus");
            reload();
          }
        };
      });
    }

    document.getElementById("btnAddRoom").onclick = () => openRoomForm(null, reload);
    reload();
  }

  async function openRoomForm(row, onSaved){
    const isEdit = !!row;
    const result = await Swal.fire({
      title: isEdit?"Edit Kamar":"Tambah Kamar", confirmButtonColor:"#0a2540",
      confirmButtonText: isEdit?"Simpan":"Simpan", cancelButtonText:"Batal", showCancelButton:true,
      html:`<div class="row g-3 text-start">
        <div class="col-12"><label class="form-label-mbms">Nama Kamar</label><input id="f_nama" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.nama||''}"></div>
        <div class="col-6"><label class="form-label-mbms">Gedung</label>
          <select id="f_gedung" class="form-select form-control-mbms" style="padding-left:16px">
            <option ${row?.gedung==='Asrama Putra'?'selected':''}>Asrama Putra</option>
            <option ${row?.gedung==='Asrama Putri'?'selected':''}>Asrama Putri</option>
          </select></div>
        <div class="col-6"><label class="form-label-mbms">Jenis Kelamin</label>
          <select id="f_jk" class="form-select form-control-mbms" style="padding-left:16px">
            <option value="L" ${row?.jk==='L'?'selected':''}>Putra</option>
            <option value="P" ${row?.jk==='P'?'selected':''}>Putri</option>
          </select></div>
        <div class="col-6"><label class="form-label-mbms">Lantai</label><input type="number" id="f_lantai" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.lantai||1}"></div>
        <div class="col-6"><label class="form-label-mbms">Kapasitas</label><input type="number" id="f_kap" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.kapasitas||6}"></div>
      </div>`,
      preConfirm: () => ({
        nama: document.getElementById("f_nama").value,
        gedung: document.getElementById("f_gedung").value,
        jk: document.getElementById("f_jk").value,
        lantai: Number(document.getElementById("f_lantai").value),
        kapasitas: Number(document.getElementById("f_kap").value),
      })
    });
    if(!result.isConfirmed) return;
    if(isEdit) await Api.update("kamar", row.id, result.value);
    else await Api.create("kamar", result.value);
    Utils.toast("success","Data kamar disimpan");
    onSaved();
  }

  Router.register("kamar", render);
})();
