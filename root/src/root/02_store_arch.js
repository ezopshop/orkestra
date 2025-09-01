/** ARCH (tek header, SECTION sütununa göre filtre) */
const ARCH = (() => {
  const S = ORK_ENV.SHEETS.ARCH;

  // HEADER GENİŞLETİLDİ: TIER ayrı kolon oldu
  const HEADER = [
    'SECTION','ID','NAME','ACTIVE','OWNER_EMAIL',
    'FOLDER_ID','SPREADSHEET_ID','SCRIPT_ID',
    'URL_FOLDER','URL_SPREADSHEET','URL_SCRIPT',
    'TIMEZONE','RING',
    // MODULE
    'SEMVER','TIER','DESC',
    // STATION_MODULE
    'STATION_ID','MODULE_ID','appliedVersion','schemaVersion','STATE','appliedAt','lastRunAt','lastStatus',
    // JOB
    'CRON_EXPR','HANDLER',
    // ROLE
    'EMAIL','ROLE','SCOPE_REF',
    // LINK
    'TYPE','REF_ID','URL'
  ];

  const Sections = Object.freeze({
    STATION: 'STATION',
    MODULE: 'MODULE',
    STATION_MODULE: 'STATION_MODULE',
    JOB: 'JOB',
    ROLE: 'ROLE',
    LINK: 'LINK',
  });

  function ensureAllSections() {
    const sh = _getOrCreate_(S);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADER);
    } else {
      _ensureHeader_(sh, HEADER);
    }
  }

  function seedDefaults() {
    upsertRow(Sections.MODULE, {ID:'mod_ordersync', NAME:'ECommerceOrders', ACTIVE:true, SEMVER:'0.1.0', TIER:'basic', DESC:'CSV/REST → ORDERS upsert'});
    upsertRow(Sections.JOB, {ID:'backup-daily',  NAME:'Backup ARCH',  CRON_EXPR:'0 3 * * *',  HANDLER:'JOBS.run_backup_arch',  ACTIVE:true});
    upsertRow(Sections.JOB, {ID:'audit-nightly', NAME:'Audit Nightly', CRON_EXPR:'15 3 * * *', HANDLER:'JOBS.run_audit_nightly', ACTIVE:true});
    upsertRow(Sections.JOB, {ID:'orders-sync:pull', NAME:'Orders Pull', CRON_EXPR:'10 5 * * *', HANDLER:'JOBS.run_orders_pull', ACTIVE:true});
    upsertRow(Sections.ROLE, {EMAIL: ORK_ENV.getRootEmail(), ROLE:'admin', SCOPE_REF:'root', ACTIVE:true});
  }

  function list(section) {
    const sh = _getOrCreate_(S);
    const vals = sh.getDataRange().getValues();
    if (vals.length < 2) return [];
    const hdr = vals[0];
    const out = [];
    for (let i=1;i<vals.length;i++){
      const row = _rowToObj_(hdr, vals[i]);
      if ((row.SECTION||'').toString().toUpperCase() === section) out.push(row);
    }
    return out;
  }

  function upsertRow(section, obj) {
    const sh = _getOrCreate_(S);
    _ensureHeader_(sh, HEADER);
    const data = sh.getDataRange().getValues();
    const hdr = data[0];

    const pk = (section==='STATION') ? ['SECTION','ID']
            : (section==='MODULE') ? ['SECTION','ID']
            : (section==='STATION_MODULE') ? ['SECTION','STATION_ID','MODULE_ID']
            : (section==='JOB') ? ['SECTION','ID']
            : (section==='ROLE') ? ['SECTION','EMAIL','SCOPE_REF']
            : (section==='LINK') ? ['SECTION','ID']
            : ['SECTION','ID'];

    let matchRow = -1;
    for (let r=1;r<data.length;r++){
      const o = _rowToObj_(hdr, data[r]);
      if (pk.every(k => (o[k]||'')+'' === ( (k==='SECTION' ? section : (obj[k]||'')) + '' ))) { matchRow = r; break; }
    }

    const target = (matchRow===-1) ? {} : _rowToObj_(hdr, data[matchRow]);
    target.SECTION = section;
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') target[k] = v;
    });

    const line = hdr.map(h => target[h] ?? '');
    if (matchRow===-1) sh.appendRow(line);
    else sh.getRange(matchRow+1,1,1,hdr.length).setValues([line]);
  }

  // --- YENİ: temizlik ve ID migrasyonu ---
  function cleanLegacyRows() {
    const sh = _getOrCreate_(S);
    const vals = sh.getDataRange().getValues();
    if (vals.length<2) return 0;
    const hdr = vals[0];
    const allowed = new Set(Object.values(Sections));
    const toDelete = [];
    for (let r=1;r<vals.length;r++){
      const section = vals[r][0];
      // Eski yanlış başlık blokları: "SECTION" yazılı satırlar veya tanımsız SECTION değerleri
      if (section === 'SECTION' || !allowed.has((section||'').toString().toUpperCase())) {
        toDelete.push(r+1); // 1-based row index
      }
    }
    // from bottom to top delete
    for (let i=toDelete.length-1;i>=0;i--){
      sh.deleteRow(toDelete[i]);
    }
    LOG.audit('ARCH_CLEAN','ok', `removed=${toDelete.length}`);
    return toDelete.length;
  }

  function migrateModuleId(oldId, newId){
    const sh = _getOrCreate_(S);
    const vals = sh.getDataRange().getValues();
    if (vals.length<2) return 0;
    const hdr = vals[0];
    let changed = 0;
    for (let r=1;r<vals.length;r++){
      const row = _rowToObj_(hdr, vals[r]);
      if (row.SECTION==='MODULE' && row.ID===oldId){ row.ID=newId; sh.getRange(r+1,1,1,hdr.length).setValues([hdr.map(h=>row[h]??'')]); changed++; }
      if (row.SECTION==='STATION_MODULE' && row.MODULE_ID===oldId){ row.MODULE_ID=newId; sh.getRange(r+1,1,1,hdr.length).setValues([hdr.map(h=>row[h]??'')]); changed++; }
      if (row.SECTION==='JOB' && row.HANDLER && (row.HANDLER+'').indexOf(oldId)>=0){ /* isteğe bağlı */ }
    }
    LOG.audit('ARCH_MIGRATE_MODULE_ID','ok', `${oldId}→${newId} changed=${changed}`);
    return changed;
  }

  // helpers
  function _getOrCreate_(name){ let sh = ORK_ENV.ROOT.getSheetByName(name); if(!sh) sh = ORK_ENV.ROOT.insertSheet(name); return sh; }
  function _ensureHeader_(sh, hdr){
    if (sh.getLastRow()===0){ sh.appendRow(hdr); return; }
    if (sh.getLastColumn()<hdr.length) sh.insertColumnsAfter(sh.getLastColumn(), hdr.length - sh.getLastColumn());
    sh.getRange(1,1,1,hdr.length).setValues([hdr]);
  }
  function _rowToObj_(hdr, row){ const o={}; for (let i=0;i<hdr.length;i++) o[hdr[i]] = row[i] ?? ''; return o; }


/**
 * STATION_MODULE normalizer
 * - ringFilter: 'pilot' | 'beta' | 'stable' | 'ALL'
 * - hard: true (fazla/pending satırları fiziksel sil) | false (STATE='archived')
 * - modules: 'ALL' | Set<string> | string[] | string (örn: 'mod_ordersync')
 *
 * Kural:
 *  - Aynı (STATION_ID, MODULE_ID) için en iyi tek satır bırakılır:
 *    * Öncelik: STATE='ok' && appliedVersion dolu olanlar (en taze appliedAt/lastRunAt).
 *    * Aksi halde pending/boşlardan en taze.
 *  - Diğerleri hard=true ise deleteRow; hard=false ise STATE='archived'.
 *  - ID ve ring eşleştirmeleri için TRIM uygulanır; ring bilgisi boş ('') olan satırlar
 *    temizliğe DAHİL edilir (ringFilter != 'ALL' olsa bile).
 */
function normalizeStationModules({ ringFilter = 'pilot', hard = true, modules = 'ALL' } = {}) {
  const sh = _getOrCreate_(S);
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return { kept: 0, removed: 0, archived: 0 };
  const hdr = vals[0];
  const H = Object.fromEntries(hdr.map((h, i) => [h, i]));

  // modül filtresi
  const modSet =
    modules === 'ALL'
      ? null
      : modules instanceof Set
      ? modules
      : new Set(Array.isArray(modules) ? modules : [modules]);

  // STATION bölümünden ring haritası (trim’li id → ring)
  const stationRing = new Map();
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][H.SECTION] || '') !== 'STATION') continue;
    const id = String(vals[r][H.ID] || '').trim();
    const ring = String(vals[r][H.RING] || '').trim();
    if (id) stationRing.set(id, ring);
  }

  // STATION_MODULE satırlarını grupla
  const byKey = new Map(); // key = "stationId|moduleId" → { rows:[{r,obj}] }
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][H.SECTION] || '') !== 'STATION_MODULE') continue;
    const rowObj = _rowToObj_(hdr, vals[r]);

    // TRIM’li kimlikler
    const sid = String(rowObj.STATION_ID || '').trim();
    const mid = String(rowObj.MODULE_ID || '').trim();
    if (!sid || !mid) continue; // eksik anahtarları atla

    // ring filtresi (ring boş ise yine de temizliğe dahil ET)
    const ring = String(stationRing.get(sid) || '').trim();
    if (ringFilter !== 'ALL' && ring !== ringFilter && ring !== '') continue;

    // modül filtresi
    if (modSet && !modSet.has(mid)) continue;

    const key = `${sid}|${mid}`;
    if (!byKey.has(key)) byKey.set(key, { rows: [] });
    // hafızada TRIM’lenmiş versiyonla çalış
    const norm = { ...rowObj, STATION_ID: sid, MODULE_ID: mid, STATE: String(rowObj.STATE || '').trim() };
    byKey.get(key).rows.push({ r, obj: norm });
  }

  // en iyi satırı seçmek için skorlayıcı
  function score(o) {
    const ok = o.STATE.toLowerCase() === 'ok' && String(o.appliedVersion || '').trim() !== '';
    const ts =
      new Date(o.appliedAt || o.lastRunAt || 0).getTime() ||
      0;
    // "ok" olanlar her zaman önde, sonra zaman
    return (ok ? 2 : 1) * 1e15 + ts;
  }

  const deletions = []; // 1-based row indices
  let kept = 0,
    archived = 0;

  byKey.forEach(({ rows }) => {
    if (rows.length === 1) {
      kept++;
      return;
    }
    // en iyi satırı bul
    let best = rows[0];
    for (let i = 1; i < rows.length; i++) {
      if (score(rows[i].obj) > score(best.obj)) best = rows[i];
    }
    kept++;
    // gerisini temizle
    rows.forEach((item) => {
      if (item.r === best.r) return;
      if (hard) {
        deletions.push(item.r + 1); // sheet row (1-based)
      } else {
        const o = item.obj;
        o.STATE = 'archived';
        o.appliedVersion = o.appliedVersion || '';
        sh.getRange(item.r + 1, 1, 1, hdr.length).setValues([hdr.map((h) => o[h] ?? '')]);
        archived++;
      }
    });
  });

  // silmeleri tersten uygula
  deletions.sort((a, b) => b - a).forEach((rr) => sh.deleteRow(rr));

  const removed = deletions.length;
  LOG.audit(
    'ARCH_NORMALIZE_SM',
    'ok',
    `ring=${ringFilter} hard=${hard} kept=${kept} removed=${removed} archived=${archived}`
  );
  return { kept, removed, archived };
}

return {
  ensureAllSections,
  seedDefaults,
  list,
  upsertRow,
  cleanLegacyRows,
  migrateModuleId,
  normalizeStationModules,
  Sections,
};
})();

