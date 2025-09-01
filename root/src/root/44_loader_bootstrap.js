/** LOADER — Bootstrap from Drive JSON (default < ring < station) */
const LOADER = (() => {

  // === Public ===

  function ensureScaffold() {
    // klasör ağacı
    _ensureFolderPath_('_Bootstrap');
    _ensureFolderPath_('_Bootstrap/rings');
    _ensureFolderPath_('_Bootstrap/stations');
    _ensureFolderPath_('_Bootstrap/wrappers');

    // default.json yoksa yaz
    if (!_findFile_('_Bootstrap/default.json')) {
      const seed = {
        tabs: [
          {"name":"INDEX","ensure":true},
          {"name":"README","ensure":true},
          {"name":"LOG","ensure":true},
          {"name":"CONFIG","ensure":true},
          {"name":"ORDERS_SOURCE","ensure":true}
        ],
        modules: [
          {"id":"mod_ordersync","state":"ok","version":"0.1.0"},
          {"id":"mod_jobs","state":"pending"},
          {"id":"mod_templates","state":"pending"},
          {"id":"mod_backup","state":"pending"}
        ],
        wrapper: { "libVersion": ORK_ENV.LIB_ROOT_VER || 1 },
        jobs: [
          {"id":"backup-daily","cron":"0 3 * * *","active":true},
          {"id":"audit-nightly","cron":"15 3 * * *","active":true},
          {"id":"orders-sync:pull","cron":"10 5 * * *","active":true}
        ],
        rbac: []
      };
      _writeJsonByPath_('_Bootstrap/default.json', seed);
    }

    // ring bazlı dosyaları garanti et
    if (!_findFile_('_Bootstrap/rings/pilot.json'))  _copyJson_('_Bootstrap/default.json', '_Bootstrap/rings/pilot.json');
    if (!_findFile_('_Bootstrap/rings/beta.json'))   _writeJsonByPath_('_Bootstrap/rings/beta.json',  {});
    if (!_findFile_('_Bootstrap/rings/stable.json')) _writeJsonByPath_('_Bootstrap/rings/stable.json', {});

    LOG.audit('LOADER_SCAFFOLD','ok','Bootstrap folders/files ensured');
    _toast_('Bootstrap scaffold hazır.');
  }

  function runAll({ ring = 'pilot' } = {}) {
    BACKUP.snapshotArch(); // güvence
    const stations = ARCH.list('STATION')
      .filter(s => (s.ACTIVE + '' === 'true') && (ring === 'ALL' || s.RING === ring));
    let ok = 0, err = 0;
    stations.forEach(s => { try { runOne(s.ID); ok++; } catch(e){ err++; LOG.audit('LOADER_ONE','error', `${s.ID} ${e}`); } });
    LOG.audit('LOADER_ALL','ok', `ring=${ring} ok=${ok} err=${err}`);
    _toast_(`Loader (ring=${ring}) → ok=${ok}, err=${err}`);
    return { ok, err };
  }

  function runOne(stationId) {
    BACKUP.snapshotArch(); // station bazlı güvence
    const st = _station_(stationId);

    // 1) default + ring + station bootstrap json merge
    const manifest = _readAndMerge_(st);              // {tabs,modules,wrapper,jobs,rbac}

    // 2) Tabs
    _applyTabs_(st, manifest.tabs || []);

    // 3) Modules → ARCH.STATION_MODULE
    _applyModules_(st, manifest.modules || []);

    // 4) Wrapper → RootLib pin (custom dosya varsa kullan)
    _applyWrapper_(st, manifest.wrapper || {});

    // 5) Jobs → ARCH.JOB + trigger sync
    _applyJobs_(manifest.jobs || []);

    // 6) RBAC → ARCH.ROLE
    _applyRBAC_(st, manifest.rbac || []);

    LOG.audit('LOADER_ONE','ok', st.ID);
    _toast_(`Loader ok: ${st.ID}`);
    return true;
  }

  // === Internals ===

  function _station_(id) {
    const s = ARCH.list('STATION').find(r => r.ID === id);
    if (!s) throw new Error(`station not found: ${id}`);
    return s;
  }

  function _readAndMerge_(st) {
    const def  = _readJsonByPath_('_Bootstrap/default.json') || {};
    const ring = _readJsonByPath_(`_Bootstrap/rings/${st.RING}.json`) || {};
    const sta  = st.BOOTSTRAP_URL
      ? _readJsonById_(st.BOOTSTRAP_URL)
      : (_readJsonByPath_(`_Bootstrap/stations/${st.ID}.json`) || {});
    return _deepMerge_(def, _deepMerge_(ring, sta)); // sağdaki baskın
  }

  function _applyTabs_(st, tabs) {
    const ss = SpreadsheetApp.openById(st.SPREADSHEET_ID);
    tabs.filter(t => t.ensure).forEach(t => {
      let sh = ss.getSheetByName(t.name);
      if (!sh) sh = ss.insertSheet(t.name);
      // ileride: templateId varsa kopyala/biçim uygula vs.
    });
  }

  function _applyModules_(st, list) {
    list.forEach(m => {
      ARCH.upsertRow(ARCH.Sections.STATION_MODULE, {
        STATION_ID: st.ID,
        MODULE_ID: m.id,
        STATE: m.state || 'pending',
        appliedVersion: m.version || '',
        schemaVersion: '1'
      });
    });
  }

  function _applyWrapper_(st, w) {
    const versionInt = Number(w.libVersion || ORK_ENV.LIB_ROOT_VER || 1);
    // _Bootstrap/wrappers/<stationId> altındaki custom dosyaları varsa WRAPPERS.deployOne bunları push’lar
    WRAPPERS.deployOne(st.ID, versionInt, { customFilesPath: `_Bootstrap/wrappers/${st.ID}` });
  }

  function _applyJobs_(jobs) {
    jobs.forEach(j => {
      ARCH.upsertRow(ARCH.Sections.JOB, {
        ID: j.id, NAME: j.id,
        ACTIVE: (j.active ? 'TRUE' : 'FALSE'),
        CRON_EXPR: j.cron || '',
        HANDLER: _handlerOf_(j.id)
      });
    });
    JOBS.syncTriggers();
  }

  function _applyRBAC_(st, rbac) {
    rbac.forEach(r => {
      ARCH.upsertRow(ARCH.Sections.ROLE, {
        EMAIL: r.email,
        ROLE: r.role,
        SCOPE_REF: r.scope || `station:${st.ID}`
      });
    });
  }

  function _handlerOf_(jobId) {
    if (jobId === 'backup-daily')      return 'JOBS.run_backup_arch';
    if (jobId === 'audit-nightly')     return 'JOBS.run_audit_nightly';
    if (jobId === 'orders-sync:pull')  return 'JOBS.run_orders_pull';
    return '';
  }

  // ---- Drive JSON helpers (ID tabanlı ensureFolder/ensureFile ile uyumlu) ----

  function _rootFolderId_() {
    const file = DriveApp.getFileById(ORK_ENV.ROOT.getId());
    const it = file.getParents();
    return it.hasNext() ? it.next().getId() : DriveApp.getRootFolder().getId();
  }

  function _ensureFolderPath_(rel) {
    let curId = _rootFolderId_();
    rel.split('/').filter(Boolean).forEach(part => {
      curId = ensureFolder(curId, part); // 64_drive_utils.gs → ensureFolder(parentId,name)
    });
    return curId;
  }

  function _findFile_(rel) {
    // sadece var/yok kontrol için DriveApp ile hızlı tarama
    const parts = rel.split('/').filter(Boolean);
    let cur = DriveApp.getFolderById(_rootFolderId_());
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        const it = cur.getFilesByName(p);
        return it.hasNext() ? it.next() : null;
      } else {
        const it = cur.getFoldersByName(p);
        if (!it.hasNext()) return null;
        cur = it.next();
      }
    }
    return null;
  }

  function _readJsonByPath_(rel) {
    try {
      const f = _findFile_(rel);
      if (!f) return null;
      return JSON.parse(f.getBlob().getDataAsString('UTF-8'));
    } catch (e) { return null; }
  }

  function _writeJsonByPath_(rel, obj) {
    const parts = rel.split('/').filter(Boolean);
    const name = parts.pop();
    const folderId = _ensureFolderPath_(parts.join('/'));

    // varsa sil-yaz (idempotent)
    const folder = DriveApp.getFolderById(folderId);
    const it = folder.getFilesByName(name);
    while (it.hasNext()) it.next().setTrashed(true);

    // güvenli mimeType: JSON
    const fileId = ensureFile(folderId, name, MimeType.JSON, JSON.stringify(obj, null, 2)); // 64_drive_utils.gs → ensureFile
    return fileId;
  }

  function _copyJson_(fromRel, toRel) {
    const js = _readJsonByPath_(fromRel) || {};
    _writeJsonByPath_(toRel, js);
  }

  function _readJsonById_(fileId) {
    try { return JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8')); }
    catch (e) { return null; }
  }

  // ---- misc ----
  function _deepMerge_(a, b) {
    if (a == null) return b; if (b == null) return a;
    if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
    if (typeof a === 'object' && typeof b === 'object') {
      const out = { ...a };
      Object.keys(b).forEach(k => out[k] = _deepMerge_(a[k], b[k]));
      return out;
    }
    return b; // sağdaki baskın
  }

  function _toast_(msg) {
    try { ORK_Alerts.toast(msg); }
    catch (_) { SpreadsheetApp.getActive().toast(String(msg)); }
  }

  return { ensureScaffold, runAll, runOne };
})();
