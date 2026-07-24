/* ==========================================================================
   MBMS — modules/users.js  (Manajemen Pengguna — khusus Super Admin)
   ========================================================================== */
(function(){

  async function render(container){
    if(!Auth.isSuperAdmin()){
      container.innerHTML = `<div class="page-content"><div class="card-mbms card-body-mbms text-center py-5">
        <i class="fa-solid fa-lock" style="font-size:32px;color:var(--danger)"></i>
        <p class="mt-3 mb-0">Modul ini hanya dapat diakses oleh Super Admin.</p></div></div>`;
      return;
    }
    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div><h3><i class="fa-solid fa-users-gear" style="color:var(--gold);margin-right:8px"></i>Manajemen Pengguna</h3>
          <p>CRUD akun, penugasan peran, dan reset password</p></div>
          <button class="btn btn-navy" id="btnAddUser"><i class="fa-solid fa-user-plus me-1"></i>Tambah Pengguna</button>
        </div>
        <div class="card-mbms"><div class="card-body-mbms">
          <div class="table-responsive">
            <table class="table table-hover align-middle" id="userTable" style="width:100%">
              <thead><tr><th style="width:48px">No</th><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div></div>
      </div>`;

    let dt;
    async function reload(){
      const rows = await Api.list("users");
      if(dt) dt.destroy();
      document.querySelector("#userTable tbody").innerHTML = rows.map(u=>`<tr>
        <td></td>
        <td class="d-flex align-items-center gap-2">
          <div class="table-avatar d-flex align-items-center justify-content-center" style="background:var(--navy);color:#fff;font-weight:700;font-size:12px">${Auth.initials(u.nama)}</div>
          <b style="color:var(--navy)">${Utils.escapeHtml(u.nama)}</b>
        </td>
        <td>${u.username}</td>
        <td><span class="badge-mbms badge-navy">${u.role}</span></td>
        <td><span class="badge-mbms ${u.status==='Aktif'?'badge-success':'badge-danger'}">${u.status}</span></td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-soft-info me-1" data-act="reset" data-id="${u.id}" title="Reset Password"><i class="fa-solid fa-key"></i></button>
          <button class="btn btn-sm btn-soft-info me-1" data-act="edit" data-id="${u.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-soft-danger" data-act="delete" data-id="${u.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join("");

      document.querySelectorAll("#userTable [data-act]").forEach(btn=>{
        btn.onclick = async ()=>{
          const row = rows.find(r=>r.id===btn.dataset.id);
          if(btn.dataset.act==="edit") return openUserForm(row, reload);
          if(btn.dataset.act==="reset") return resetPassword(row);
          if(btn.dataset.act==="delete"){
            if(row.username === Session.get().username){ Utils.toast("error","Tidak bisa menghapus akun yang sedang login"); return; }
            const ok = await Utils.confirmDelete(row.nama);
            if(!ok) return;
            await Api.remove("users", row.id);
            Auth.logAudit("DELETE","Menghapus akun pengguna "+row.username);
            Utils.toast("success","Akun dihapus");
            reload();
          }
        };
      });
      dt = $("#userTable").DataTable({ pageLength:10, columnDefs:[TableUtil.numberColumnDef(0), {orderable:false,targets:[1,5]}], language:{search:"Cari:",zeroRecords:"Data tidak ditemukan"} });
    }

    document.getElementById("btnAddUser").onclick = () => openUserForm(null, reload);
    reload();
  }

  async function openUserForm(row, onSaved){
    const isEdit = !!row;
    const result = await Swal.fire({
      title: isEdit ? "Edit Pengguna" : "Tambah Pengguna", width:520, showCancelButton:true,
      confirmButtonColor:"#0a2540", confirmButtonText:"Simpan", cancelButtonText:"Batal",
      html:`<div class="row g-3 text-start">
        <div class="col-12"><label class="form-label-mbms">Nama Lengkap</label><input id="f_nama" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.nama||''}"></div>
        <div class="col-6"><label class="form-label-mbms">Username</label><input id="f_user" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.username||''}" ${isEdit?'disabled':''}></div>
        <div class="col-6"><label class="form-label-mbms">Role</label><select id="f_role" class="form-select form-control-mbms" style="padding-left:16px">
          ${Object.values(ROLES).map(r=>`<option ${row?.role===r?'selected':''}>${r}</option>`).join("")}</select></div>
        ${!isEdit ? `<div class="col-6"><label class="form-label-mbms">Password</label><input type="password" id="f_pass" class="form-control form-control-mbms" style="padding-left:16px"></div>` : ""}
        <div class="col-6"><label class="form-label-mbms">Status</label><select id="f_status" class="form-select form-control-mbms" style="padding-left:16px">
          <option ${row?.status==='Aktif'?'selected':''}>Aktif</option><option ${row?.status==='Nonaktif'?'selected':''}>Nonaktif</option></select></div>
        <div class="col-12"><label class="form-label-mbms">Email</label><input id="f_email" class="form-control form-control-mbms" style="padding-left:16px" value="${row?.email||''}"></div>
      </div>`,
      preConfirm: () => {
        const data = {
          nama: document.getElementById("f_nama").value, username: document.getElementById("f_user").value,
          role: document.getElementById("f_role").value, status: document.getElementById("f_status").value,
          email: document.getElementById("f_email").value,
        };
        if(!isEdit) data.password = document.getElementById("f_pass").value;
        if(!data.nama || !data.username || (!isEdit && !data.password)){ Swal.showValidationMessage("Lengkapi semua field wajib"); return false; }
        return data;
      }
    });
    if(!result.isConfirmed) return;
    if(isEdit) await Api.update("users", row.id, result.value); else await Api.create("users", result.value);
    Auth.logAudit(isEdit?"UPDATE":"CREATE", "Akun pengguna "+result.value.username);
    Utils.toast("success","Data pengguna disimpan");
    onSaved();
  }

  async function resetPassword(row){
    const result = await Swal.fire({
      title:"Reset Password", html:`Atur password baru untuk <b>${row.nama}</b> (${row.username})`,
      input:"password", inputPlaceholder:"Password baru minimal 6 karakter",
      showCancelButton:true, confirmButtonText:"Reset", cancelButtonText:"Batal", confirmButtonColor:"#0a2540",
      inputValidator:(v)=> !v || v.length<6 ? "Password minimal 6 karakter" : undefined,
    });
    if(!result.isConfirmed) return;
    await Api.update("users", row.id, { password: result.value });
    Auth.logAudit("UPDATE","Reset password akun "+row.username);
    Utils.toast("success","Password berhasil direset");
  }

  Router.register("users", render);
})();
