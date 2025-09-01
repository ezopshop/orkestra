/** Orders Sync (CSV_SHEET → ORDERS upsert) */
const MOD_ORDERS = (() => {
  const MODULE_ID = 'mod_ordersync'; // ← tek standard
  const SCHEMA_VERSION = 1;
  const APPLIED_VERSION = '0.1.0';

  // ---- column layout for ORDERS ----
  const ORDERS_HDR = ['orderId','source','status','currency','amount','buyerEmail','createdAt','updatedAt','syncStamp','hash'];
  const COL = { // 1-based for setValues convenience
    orderId:1, source:2, status:3, currency:4, amount:5, buyerEmail:6, createdAt:7, updatedAt:8, syncStamp:9, hash:10
  };

  function apply(station) {
    const ss = SpreadsheetApp.openById(station.SPREADSHEET_ID);
    STATION_SCAFFOLD.ensure(ss);
    const meta = ss.getSheetByName('META');
    _writeMeta_(meta, {module:MODULE_ID, schemaVersion:SCHEMA_VERSION, appliedVersion:APPLIED_VERSION, lastAppliedAt:new Date()});
    _writeIndexCard_(ss, station);
  }

  function pull(stationId, {dryRun=false}={}) {
    const station = _getStation_(stationId);
    const ss = SpreadsheetApp.openById(station.SPREADSHEET_ID);
    const src = ss.getSheetByName('ORDERS_SOURCE');
    const tgt = ss.getSheetByName('ORDERS');
    const log = ss.getSheetByName('SYNC_LOG');

    // -- read source
    const srcVals = src.getDataRange().getValues();
    if (srcVals.length < 2) { _logSync_(log, {result:'ok', inserted:0, updated:0, skipped:0}); return {inserted:0,updated:0,skipped:0}; }
    const srcHdr = srcVals[0].map(h => (h||'').toString().trim());
    const sIdx = _indexer_(srcHdr, ['orderId','createdAt','updatedAt','status','amount','currency','buyerEmail','source']);

    // -- read target index (keep row numbers!)
    const tInfo = _readTargetIndex_(tgt); // {map: Map<orderId,{row,hash}>, lastRow:int}
    const nowIso = new Date().toISOString();

    let inserted=0, updated=0, skipped=0;
    const appendRows = [];
    const updatePackets = []; // {row:int, values:Array}

    for (let i=1;i<srcVals.length;i++){
      const r = srcVals[i];
      const record = {
        orderId: r[sIdx.orderId],
        source : r[sIdx.source],
        status : r[sIdx.status],
        currency: r[sIdx.currency],
        amount : _num_(r[sIdx.amount]),
        buyerEmail: r[sIdx.buyerEmail],
        createdAt: r[sIdx.createdAt],
        updatedAt: r[sIdx.updatedAt],
      };
      if (!record.orderId) { skipped++; continue; }

      const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(record))
          .map(b => (('0'+(b & 0xFF).toString(16)).slice(-2))).join('');
      const rowArr = [record.orderId, record.source, record.status, record.currency, record.amount, record.buyerEmail, record.createdAt, record.updatedAt, nowIso, hash];

      const hit = tInfo.map.get(record.orderId);
      if (!hit) {
        inserted++; appendRows.push(rowArr);
      } else {
        if ((hit.hash||'') !== hash) {
          updated++;
          updatePackets.push({row: hit.row, values: rowArr});
        } else {
          skipped++;
        }
      }
    }

    if (!dryRun) {
      if (appendRows.length) {
        tgt.getRange(tInfo.lastRow+1, 1, appendRows.length, ORDERS_HDR.length).setValues(appendRows);
        tInfo.lastRow += appendRows.length;
      }
      // batch update per row (Apps Script sheet API doesn't support scattered multi-range in one call)
      updatePackets.forEach(p => tgt.getRange(p.row, 1, 1, ORDERS_HDR.length).setValues([p.values]));
    }

    _logSync_(log, {result:'ok', inserted, updated, skipped});
    ARCH.upsertRow(ARCH.Sections.STATION_MODULE, {STATION_ID:stationId, MODULE_ID:MODULE_ID, lastRunAt:new Date(), lastStatus:'ok'});
    ORK_Alerts.toast(`Orders Sync: ${stationId} — ins:${inserted} upd:${updated} skip:${skipped}`);
    return {inserted, updated, skipped, dryRun};
  }

  // --- helpers
  function _getStation_(id){ return ARCH.list('STATION').find(r => r.ID===id); }
  function _indexer_(hdr, keys){ const m={}; keys.forEach(k=>{ m[k]=hdr.indexOf(k); }); return m; }
  function _num_(v){ if (typeof v === 'number') return v; const s = (v||'').toString().replace(',','.'); const n = Number(s); return isNaN(n)?0:n; }

  function _readTargetIndex_(tgtSh){
    const vals = tgtSh.getDataRange().getValues();
    let lastRow = 1;
    const map = new Map();
    if (vals.length >= 2) {
      // assume row1 is header == ORDERS_HDR
      for (let r=1; r<vals.length; r++){
        const orderId = vals[r][COL.orderId-1];
        if (!orderId) continue;
        const hash = vals[r][COL.hash-1] || '';
        map.set(orderId, {row: r+1, hash}); // +1 because sheet rows are 1-based
      }
      lastRow = vals.length;
    } else {
      // ensure header if empty
      if (vals.length === 0) tgtSh.appendRow(ORDERS_HDR);
      else if ((vals[0]||[]).join(',') !== ORDERS_HDR.join(',')) {
        tgtSh.getRange(1,1,1,ORDERS_HDR.length).setValues([ORDERS_HDR]);
      }
      lastRow = 1;
    }
    return {map, lastRow};
  }

  function _logSync_(logSh, {result, inserted, updated, skipped}) {
    logSh.appendRow([new Date(), new Date(), new Date(), result, inserted, updated, skipped, '']);
  }

  function _writeMeta_(metaSh, kv){
    const header = metaSh.getDataRange().getValues()[0] || ['module','schemaVersion','appliedVersion','lastAppliedAt'];
    if (metaSh.getLastRow()===0) metaSh.appendRow(header);
    metaSh.appendRow([kv.module, kv.schemaVersion, kv.appliedVersion, kv.lastAppliedAt]);
  }
  function _writeIndexCard_(ss, station){
    const sh = ss.getSheetByName('INDEX');
    const ring = station.RING||'pilot';
    const rows = [['Station', station.ID], ['Owner', station.OWNER_EMAIL], ['Ring', ring], ['Last Sync','-'], ['Last Backup','-']];
    sh.getRange(2,1,rows.length,2).setValues(rows);
    const actions = ss.getSheetByName('README');
    actions.getRange(2,1,4,2).setValues([
      ['Pull Now','Orders Sync → Pull Now'],
      ['Dry-run','Orders Sync → Dry-run'],
      ['Repair','Station → Repair Station'],
      ['Logs','SYNC_LOG']
    ]);
  }

  return { apply, pull };
})();


