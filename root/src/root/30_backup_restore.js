/** BACKUP/RESTORE — ARCH + STATION CSV snapshots (last-only) */
const BACKUP = (() => {
  const ROOT = ORK_ENV.ROOT;
  const TZ = ORK_ENV.TIMEZONE || 'Europe/Amsterdam';

  // Klasör yapısı
  const FPATH = {
    ARCH: 'Orkestra/_Backups/ARCH',
    STATIONS: 'Orkestra/_Backups/Stations', // altına <stationId>
  };

  // İstasyonda yedeklenecek bilinen sheet adları (var olanları alır)
  const STATION_SHEETS = ['INDEX','README','LOG','CONFIG','ORDERS_SOURCE','ORDERS','SYNC_LOG','META'];

  /** === PUBLIC API === */

  /** ARCH → CSV (tek dosya, last-only) */
  function snapshotArch() {
    const arch = ROOT.getSheetByName(ORK_ENV.SHEETS.ARCH);
    if (!arch) throw new Error('ARCH sheet bulunamadı.');
    const data = arch.getDataRange().getValues();
    const csv = _toCsv(data);
    const folder = _ensureFolderPath_(FPATH.ARCH.split('/'));
    _writeLastOnly_(folder, 'arch_snapshot.csv', csv);
    LOG.audit('ARCH_BACKUP','ok','snapshot created');
    ORK_Alerts.toast('ARCH snapshot alındı.');
  }

  /** ARCH ← CSV (last) — mevcut ARCH içeriğini silip CSV’yi yazar */
  function restoreArch() {
    const folder = _ensureFolderPath_(FPATH.ARCH.split('/'));
    const file = _findFile_(folder, 'arch_snapshot.csv');
    if (!file) throw new Error('arch_snapshot.csv bulunamadı.');
    const csv = file.getBlob().getDataAsString('UTF-8');
    const rows = Utilities.parseCsv(csv);
    if (!rows || rows.length === 0) throw new Error('ARCH CSV boş.');
    // HEADER uyumlandırma: mevcut HEADER ile CSV başlığını aynı uzunluğa çeker
    const sh = _getOrCreate_(ORK_ENV.SHEETS.ARCH);
    sh.clear();
    const hdr = rows[0];
    // Sistem HEADER'ını kullan
    const SYS_HDR = (function(){ // ARCH.HEADER’a doğrudan erişim yoksa uyumla
      const tmp = ROOT.getSheetByName(ORK_ENV.SHEETS.ARCH);
      const cur = tmp && tmp.getLastRow() ? tmp.getRange(1,1,1,tmp.getLastColumn()).getValues()[0] : null;
      // Çoğu durumda `02_store_arch.gs` HEADER’ını zaten yazıyoruz:
      return (typeof ARCH !== 'undefined' && ARCH && ARCH.Sections) ? _archHeaderFromStore_() : (cur || hdr);
    })();

    sh.getRange(1,1,1,SYS_HDR.length).setValues([SYS_HDR]);

    // CSV gövdesini sistem header’ına map et
    const indexCsv = Object.fromEntries(hdr.map((h,i)=>[h,i]));
    const rowsBody = rows.slice(1).map(r => SYS_HDR.map(h => r[indexCsv[h]] ?? ''));
    if (rowsBody.length) sh.getRange(2,1,rowsBody.length,SYS_HDR.length).setValues(rowsBody);

    LOG.audit('ARCH_RESTORE','ok', `rows=${rowsBody.length}`);
    ORK_Alerts.toast(`ARCH restore: rows=${rowsBody.length}`);
  }

  /** Station → CSV (sheet sheet, last-only) */
  function snapshotStation(stationId) {
    const st = _getStation_(stationId);
    const ss = SpreadsheetApp.openById(st.SPREADSHEET_ID);
    const base = _ensureFolderPath_([FPATH.STATIONS, st.ID]);
    // last-only: önce eski dosyaları temizle
    _purgeFiles_(base);
    let count = 0;
    STATION_SHEETS.forEach(name => {
      const sh = ss.getSheetByName(name);
      if (!sh) return;
      const vals = sh.getDataRange().getValues();
      const csv = _toCsv(vals);
      _writeLastOnly_(base, `${name}.csv`, csv);
      count++;
    });
    LOG.audit('STATION_BACKUP','ok', `station=${st.ID} files=${count}`);
    ORK_Alerts.toast(`Station backup (${st.ID}): ${count} dosya.`);
  }

  /** Station ← CSV (last) — eksik sheet’i yaratır, olanı silip üstüne yazar */
  function restoreStation(stationId) {
    const st = _getStation_(stationId);
    const ss = SpreadsheetApp.openById(st.SPREADSHEET_ID);
    const base = _ensureFolderPath_([FPATH.STATIONS, st.ID]);

    let restored = 0;
    STATION_SHEETS.forEach(name => {
      const f = _findFile_(base, `${name}.csv`);
      if (!f) return;
      const csv = f.getBlob().getDataAsString('UTF-8');
      const rows = Utilities.parseCsv(csv);
      let sh = ss.getSheetByName(name);
      if (!sh) sh = ss.insertSheet(name);
      sh.clear();
      if (rows.length) sh.getRange(1,1,rows.length, rows[0].length).setValues(rows);
      restored++;
    });
    LOG.audit('STATION_RESTORE','ok', `station=${st.ID} files=${restored}`);
    ORK_Alerts.toast(`Station restore (${st.ID}): ${restored} dosya.`);
  }

  /** === HELPERS === */

  function _getOrCreate_(name){ let s = ROOT.getSheetByName(name); if(!s) s = ROOT.insertSheet(name); return s; }

  function _getStation_(id){
    const st = ARCH.list('STATION').find(r => String(r.ID)===String(id));
    if (!st) throw new Error(`Station not found: ${id}`);
    return st;
  }

  function _ensureFolderPath_(parts){
    let cur = DriveApp.getRootFolder();
    for (const p of parts){
      const it = cur.getFoldersByName(p);
      cur = it.hasNext() ? it.next() : cur.createFolder(p);
    }
    return cur;
  }

  function _findFile_(folder, name){
    const it = folder.getFilesByName(name);
    return it.hasNext() ? it.next() : null;
  }

  function _purgeFiles_(folder){
    const it = folder.getFiles();
    const toDel = [];
    while (it.hasNext()) toDel.push(it.next());
    toDel.forEach(f => folder.removeFile ? folder.removeFile(f) : f.setTrashed(true)); // eski API uyumu
  }

  function _writeLastOnly_(folder, name, content){
    // varsa eskiyi çöpe at
    const old = _findFile_(folder, name);
    if (old) (folder.removeFile ? folder.removeFile(old) : old.setTrashed(true));
    folder.createFile(name, content, MimeType.CSV);
  }

  function _toCsv(matrix){
    // basit, güvenli CSV; virgül ve çift tırnak kaçışları
    return matrix.map(row => row.map(v => {
      const s = (v === null || v === undefined) ? '' : String(v);
      const needs = /[",\n]/.test(s);
      const esc = s.replace(/"/g, '""');
      return needs ? `"${esc}"` : esc;
    }).join(',')).join('\n');
  }

  function _archHeaderFromStore_(){
    // 02_store_arch.gs içindeki HEADER ile aynı sırayı hedefler
    // HEADER'ı garanti eden ensureAllSections zaten çağrılmış oluyor
    const sh = ROOT.getSheetByName(ORK_ENV.SHEETS.ARCH);
    if (sh && sh.getLastRow() >= 1) {
      const hdr = sh.getRange(1,1,1, sh.getLastColumn()).getValues()[0];
      return hdr;
    }
    return ['SECTION','ID','NAME','ACTIVE']; // fallback
  }

  return { snapshotArch, restoreArch, snapshotStation, restoreStation };
})();
