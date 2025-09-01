const LOG = (() => {
  function jobs(name, status, details=''){ _append_(ORK_ENV.SHEETS.JOBS_LOG, [new Date(), name, status, details]); _maybeAlert_(name, status, details); }
  function audit(name, status, details=''){ _append_(ORK_ENV.SHEETS.AUDIT_LOG, [new Date(), name, status, details]); }
  function _append_(sheetName, row){
    let sh = ORK_ENV.ROOT.getSheetByName(sheetName);
    if (!sh) sh = ORK_ENV.ROOT.insertSheet(sheetName);
    if (sh.getLastRow()===0) sh.appendRow(['ts','name','status','details']);
    sh.appendRow(row);
  }
  function _maybeAlert_(name, status, details){
    if (status !== 'ok') {
      const to = [ORK_ENV.getRootEmail()];
      // try to infer station owner from details if present
      try {
        const stId = (details.match(/station=([a-z0-9\-]+)/)||[])[1];
        if (stId) {
          const st = ARCH.list('STATION').find(r => r.ID===stId);
          if (st && st.OWNER_EMAIL) to.push(st.OWNER_EMAIL);
        }
      } catch(e){}
      MailApp.sendEmail(to.join(','), `Orkestra Alert: ${name} [${status}]`, details || '—');
    }
  }
  return { jobs, audit };
})();

const ORK_Alerts = (() => {
  function toast(msg){ SpreadsheetApp.getActive().toast(msg, 'Orkestra', 5); }
  return { toast };
})();
