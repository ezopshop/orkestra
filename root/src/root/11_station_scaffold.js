const STATION_SCAFFOLD = (() => {
  function ensure(ss) {
    _ensureSheet_(ss,'INDEX', ['Station','Owner','Ring','Last Sync','Last Backup']);
    _ensureSheet_(ss,'README', ['Key','Value']);
    _ensureSheet_(ss,'LOG', ['ts','actor','action','details']);
    _ensureSheet_(ss,'CONFIG', ['Key','Value']);
    // Orders module tabs (MVP)
    _ensureSheet_(ss,'ORDERS_SOURCE', ['orderId','createdAt','updatedAt','status','amount','currency','buyerEmail','source']);
    _ensureSheet_(ss,'ORDERS', ['orderId','source','status','currency','amount','buyerEmail','createdAt','updatedAt','syncStamp','hash']);
    _ensureSheet_(ss,'SYNC_LOG', ['runId','startedAt','endedAt','result','inserted','updated','skipped','errorMsg']);
    _ensureSheet_(ss,'META', ['module','schemaVersion','appliedVersion','lastAppliedAt']);
  }
  function _ensureSheet_(ss, name, header){
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0 && header && header.length) sh.appendRow(header);
    return sh;
  }
  return { ensure };
})();
