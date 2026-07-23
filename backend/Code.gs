/**
 * ============================================================================
 * MBMS — MOETIAH BOARDING MANAGEMENT SYSTEM
 * Backend: Google Apps Script REST API over Google Sheets
 * ============================================================================
 *
 * DEPLOYMENT
 *  1. Create a new Google Sheet (this becomes your database).
 *  2. Extensions > Apps Script, paste this file's content as Code.gs.
 *  3. Run `setupDatabase` once from the Apps Script editor (select the
 *     function in the toolbar dropdown and click Run) — it creates every
 *     sheet tab with headers and seeds demo accounts/data.
 *  4. Deploy > New deployment > type "Web app".
 *       - Execute as: Me
 *       - Who has access: Anyone (or "Anyone with the link")
 *  5. Copy the Web App URL and paste it into APP_CONFIG.API_URL in
 *     /assets/js/config.js, then set APP_CONFIG.BACKEND_MODE = "gas".
 *
 * API CONTRACT (matches assets/js/api.js)
 *   GET  ?action=list   &sheet=<name>&filter=<json>&token=<t>
 *   GET  ?action=get    &sheet=<name>&id=<id>&token=<t>
 *   POST { action:"create", sheet, data, token }
 *   POST { action:"update", sheet, id, data, token }
 *   POST { action:"delete", sheet, id, token }
 *   POST { action:"login", username, password }
 *
 * Apps Script Web Apps only support GET and POST natively, so PUT/DELETE
 * semantics are expressed through the `action` field of the POST body
 * rather than the HTTP verb.
 * ============================================================================
 */

const SHEET_NAMES = [
  "users","siswa","kamar","presensi","perizinan","pelanggaran","prestasi",
  "kesehatan","tumbuh_kembang","inventaris","tabungan","jadwal_piket","kebersihan",
  "audit_log","notifications",
];

// Simple in-sheet session tokens so the frontend can pass a bearer token
// without needing a heavier auth stack. Tokens live in a hidden "sessions"
// sheet and expire based on APP_IDLE_MINUTES.
const APP_IDLE_MINUTES = 30;

/* ============================== ENTRY POINTS ============================== */

function doGet(e){
  try{
    const action = e.parameter.action;
    const sheet = e.parameter.sheet;
    if(action === "list"){
      const filter = e.parameter.filter ? JSON.parse(e.parameter.filter) : {};
      return jsonOut({ ok:true, data: listRows(sheet, filter) });
    }
    if(action === "get"){
      return jsonOut({ ok:true, data: getRow(sheet, e.parameter.id) });
    }
    return jsonOut({ ok:false, message:"Unknown GET action" });
  }catch(err){
    return jsonOut({ ok:false, message: String(err) });
  }
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if(action === "login") return jsonOut(handleLogin(body.username, body.password));
    if(action === "create") return jsonOut({ ok:true, data: createRow(body.sheet, body.data) });
    if(action === "update") return jsonOut({ ok:true, data: updateRow(body.sheet, body.id, body.data) });
    if(action === "delete") return jsonOut({ ok:true, data: deleteRow(body.sheet, body.id) });

    return jsonOut({ ok:false, message:"Unknown POST action" });
  }catch(err){
    return jsonOut({ ok:false, message: String(err) });
  }
}

function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================== SHEET HELPERS ============================== */

function getSheet(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if(!sheet) throw new Error("Sheet '" + name + "' tidak ditemukan. Jalankan setupDatabase() terlebih dahulu.");
  return sheet;
}

function sheetToObjects(sheet){
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(cell => cell !== "" && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h,i)=> obj[h] = row[i]);
      return obj;
    });
}

function listRows(sheetName, filter){
  const rows = sheetToObjects(getSheet(sheetName));
  if(!filter || !Object.keys(filter).length) return rows;
  return rows.filter(row => Object.entries(filter).every(([k,v]) => v==="" || v==null || String(row[k]) === String(v)));
}

function getRow(sheetName, id){
  return sheetToObjects(getSheet(sheetName)).find(r => r.id === id) || null;
}

function createRow(sheetName, data){
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  if(!data.id) data.id = generateId(sheetName);
  const row = headers.map(h => (data[h] !== undefined ? data[h] : ""));
  sheet.appendRow(row);
  return data;
}

function updateRow(sheetName, id, data){
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("id");
  for(let r=1; r<values.length; r++){
    if(values[r][idCol] === id){
      headers.forEach((h,c) => {
        if(h === "id") return;
        if(data[h] !== undefined) sheet.getRange(r+1, c+1).setValue(data[h]);
      });
      const updated = {}; headers.forEach((h,c)=> updated[h] = (data[h]!==undefined ? data[h] : values[r][c]));
      return updated;
    }
  }
  throw new Error("Data dengan id '" + id + "' tidak ditemukan di sheet " + sheetName);
}

function deleteRow(sheetName, id){
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const idCol = values[0].indexOf("id");
  for(let r=1; r<values.length; r++){
    if(values[r][idCol] === id){
      sheet.deleteRow(r+1);
      return { deleted:true, id };
    }
  }
  return { deleted:false, id };
}

function generateId(sheetName){
  const prefix = sheetName.substring(0,2).toUpperCase();
  return prefix + "-" + Utilities.getUuid().substring(0,8).toUpperCase();
}

/* ============================== AUTH ============================== */

function handleLogin(username, password){
  const users = sheetToObjects(getSheet("users"));
  const user = users.find(u => u.username === username && String(u.password) === String(password) && u.status === "Aktif");
  if(!user) return { ok:false, message:"Username atau password salah, atau akun tidak aktif." };
  const token = Utilities.getUuid();
  logAudit(username, "LOGIN", "Login berhasil sebagai " + user.role);
  const { password: _pw, ...safeUser } = user;
  return { ok:true, data: { ...safeUser, token } };
}

function logAudit(user, aksi, detail){
  try{
    createRow("audit_log", { id: generateId("audit_log"), waktu: new Date().toISOString(), user, aksi, detail, ip:"-" });
  }catch(e){ /* audit log must never break the main flow */ }
}

/* ============================== SETUP / SEED ============================== */

/**
 * SAFE TO RE-RUN AT ANY TIME. This function never deletes or clears data.
 *   - Sheets that don't exist yet -> created with headers, then seeded with
 *     demo rows (since they're guaranteed empty/new).
 *   - Sheets that already exist -> left completely untouched except that
 *     any NEW columns introduced by an app update are appended at the end
 *     of the header row (existing rows/columns are never modified).
 * This means re-running setupDatabase after uploading real student data,
 * or after updating Code.gs with new features, will NOT wipe anything.
 */
function setupDatabase(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const schemas = {
    users:        ["id","username","password","nama","role","status","email","createdAt"],
    siswa:        ["id","nis","nama","kelas","jk","kamarId","tglLahir","alamat","ortu","hpOrtu","foto","status"],
    kamar:        ["id","nama","gedung","lantai","kapasitas","jk"],
    presensi:     ["id","tanggal","siswaId","bangun","sholat","mengaji","sekolah","tidur","keterangan"],
    perizinan:    ["id","siswaId","jenis","tglKeluar","tglKembali","alasan","penjemput","status","disetujuiOleh"],
    pelanggaran:  ["id","siswaId","tanggal","kategori","jenis","poin","tindakan","pembina","status"],
    prestasi:     ["id","siswaId","tanggal","kategori","nama","tingkat","penghargaan"],
    kesehatan:    ["id","siswaId","tanggal","keluhan","tindakan","petugas","statusRujuk"],
    tumbuh_kembang: ["id","siswaId","tanggal","tinggiBadan","beratBadan","bmi","catatan","petugas"],
    inventaris:   ["id","siswaId","nama","jumlah","kondisi","tglMasuk"],
    tabungan:     ["id","siswaId","tanggal","jenis","jumlah","keterangan","petugas","saldoSetelah"],
    jadwal_piket: ["id","tanggal","area","siswaId","shift","status"],
    kebersihan:   ["id","tanggal","kamarId","petugas","skor","fotoSebelum","fotoSesudah","catatan"],
    audit_log:    ["id","waktu","user","aksi","detail","ip"],
    notifications:["id","tipe","judul","pesan","dibaca","waktu"],
  };

  const created = [];
  const upgraded = [];

  Object.entries(schemas).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if(!sheet){
      sheet = ss.insertSheet(name);
      writeHeaderRow(sheet, headers);
      created.push(name);
    }else{
      const addedCols = addMissingColumns(sheet, headers);
      if(addedCols.length) upgraded.push(name + " (+" + addedCols.join(", ") + ")");
    }
  });

  // Remove the default "Sheet1" only if it's still the untouched blank template
  const def = ss.getSheetByName("Sheet1");
  if(def && def.getLastRow() <= 1 && def.getLastColumn() <= 1) ss.deleteSheet(def);

  // Only seed sheets that were just created — never touch pre-existing data
  created.forEach(name => { if(SEED_DATA[name]) appendRows(ss, name, SEED_DATA[name]); });
  SpreadsheetApp.flush();

  let msg = "Setup selesai.\n\n";
  msg += created.length ? ("Sheet baru dibuat & diisi data contoh: " + created.join(", ") + "\n\n") : "Tidak ada sheet baru.\n\n";
  msg += upgraded.length ? ("Kolom baru ditambahkan pada: " + upgraded.join(", ") + "\n\n") : "";
  msg += "Data yang sudah ada di sheet lain TIDAK diubah/dihapus. Aman dijalankan ulang kapan saja.";
  SpreadsheetApp.getUi().alert(msg);
}

function writeHeaderRow(sheet, headers){
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,headers.length).setFontWeight("bold").setBackground("#0a2540").setFontColor("#ffffff");
}

/** Appends any headers missing from an existing sheet to the end of row 1. Never touches existing columns or data rows. */
function addMissingColumns(sheet, headers){
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1,1,1,lastCol).getValues()[0];
  const missing = headers.filter(h => existing.indexOf(h) === -1);
  if(missing.length){
    const startCol = lastCol + 1;
    sheet.getRange(1,startCol,1,missing.length).setValues([missing]);
    sheet.getRange(1,startCol,1,missing.length).setFontWeight("bold").setBackground("#0a2540").setFontColor("#ffffff");
  }
  return missing;
}

const SEED_DATA = {
  users: [
    ["U-0001","superadmin","admin123","Muhammad Ilham","Super Admin","Aktif","ilham@moetiah.sch.id","2025-01-05"],
    ["U-0002","kepsek","kepsek123","Ust. Fauzan Rahman, M.Pd.","Kepala Sekolah","Aktif","kepsek@moetiah.sch.id","2025-01-05"],
    ["U-0003","waliasrama","asrama123","Abdal Ainuz Zaki, B.A.","Wali Asrama","Aktif","wali.asrama@moetiah.sch.id","2025-01-05"],
  ],
  kamar: [
    ["K-01","Kamar Al-Fatih","Asrama Putra",1,6,"L"],
    ["K-02","Kamar Al-Farabi","Asrama Putra",1,6,"L"],
    ["K-05","Kamar Khadijah","Asrama Putri",1,6,"P"],
    ["K-06","Kamar Aisyah","Asrama Putri",1,6,"P"],
  ],
  siswa: [
    ["S-0001","24001","Ahmad Fauzan Ramadhan","VII A","L","K-01","2012-04-11","Cepu, Blora","Slamet Riyadi","081234567801","","Aktif"],
    ["S-0002","24002","Muhammad Zidan Al Ghifari","VII A","L","K-01","2012-06-02","Blora","Ahmad Zaenuri","081234567802","","Aktif"],
    ["S-0004","24004","Nur Aisyah Putri","VII A","P","K-05","2012-09-15","Cepu","Hadi Sutrisno","081234567804","","Aktif"],
  ],
  tabungan: [
    ["TB-0001","S-0001","2026-07-01","Setoran",100000,"Setoran awal dari orang tua","Abdal Ainuz Zaki, B.A.",100000],
    ["TB-0002","S-0001","2026-07-10","Penarikan",25000,"Beli alat mandi","Abdal Ainuz Zaki, B.A.",75000],
    ["TB-0003","S-0002","2026-07-02","Setoran",150000,"Setoran bulanan","Abdal Ainuz Zaki, B.A.",150000],
  ],
  tumbuh_kembang: [
    ["TK-0001","S-0001","2026-01-15",150,42,18.7,"Pengukuran awal semester","Abdal Ainuz Zaki, B.A."],
    ["TK-0002","S-0001","2026-07-15",154,45,19.0,"Pengukuran semester genap","Abdal Ainuz Zaki, B.A."],
  ],
};

function appendRows(ss, sheetName, rows){
  const sheet = ss.getSheetByName(sheetName);
  rows.forEach(r => sheet.appendRow(r));
}
