const ORK_Menu = (() => {
  function build() {
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu('Orkestra');

    // — Stations —
    menu.addSubMenu(
      ui.createMenu('Stations')
        .addItem('Provision Pilot', 'ORK_Provision_Pilot')
        .addItem('Apply Modules… (this station)', 'UI_applyModulesForCurrent')
        .addItem('Backup a Station…', 'UI_backupStation')
        .addItem('Restore a Station…', 'UI_restoreStation')
        .addItem('Repair Station…', 'UI_repairStation')
    );

    // — Modules —
    menu.addSubMenu(
      ui.createMenu('Modules')
        .addItem('Apply All Modules (ALL active)', 'MODULES.applyAllActive')
    );

    // — Backup (tek menü) —
    menu.addSubMenu(
      ui.createMenu('Backup')
        .addItem('Backup Now (ARCH)', 'BACKUP.snapshotArch')
        .addItem('Restore ARCH (last)', 'BACKUP.restoreArch')
        .addSeparator()
        .addItem('Backup a Station…', 'UI_backupStation')
        .addItem('Restore a Station…', 'UI_restoreStation')
    );

    // — Jobs —
    menu.addSubMenu(
      ui.createMenu('Jobs')
        .addItem('Run All Jobs', 'ORK_Run_All_Jobs')
        .addItem('Sync Triggers', 'ORK_Sync_Triggers')
    );

    // — Tools (backup yok; sadece araçlar) —
    menu.addSubMenu(ui.createMenu('Tools')
      .addItem('Init All (Auto)', 'ORK_Init_All')
      .addItem('Ensure ARCH Sheet', 'ARCH.ensureAllSections')
      .addItem('Backfill Station URLs', 'STATIONS.backfillUrlsForAll')
      .addItem('Import Module Catalog', 'CATALOG.importModules')
      .addItem('Clean Legacy ARCH Rows', 'UI_cleanLegacyArch')
      .addItem('Normalize STATION_MODULEs (pilot, hard)', 'UI_normalizeSM_pilot_hard')
      .addSeparator()
      .addItem('Deploy Wrappers (pilot)', 'UI_deployWrappersPilot')
      .addItem('Wrapper Info (pilot → console)', 'UI_wrapperInfoPilot')
      .addItem('Wrapper Bump (pilot)…', 'UI_wrapperBumpPilot')
      .addItem('Wrapper Cleanup…', 'UI_wrapperCleanup')   // ⬅️ yeni
      .addSeparator()
      .addItem('Generate README/HELP', 'DOCS.generateAll')
      .addItem('Generate ATLAS', 'ATLAS.generateDynamic')
    );


    // — Loader —
    menu.addSubMenu(
      ui.createMenu('Loader')
        .addItem('Ensure Bootstrap Scaffold', 'UI_LOADER_EnsureScaffold')
        .addItem('Run Loader (one station)…', 'UI_LOADER_RunOne')
        .addItem('Run Loader (ring: pilot)', 'UI_LOADER_RunPilot')
        .addItem('Run Loader (ALL rings)', 'UI_LOADER_RunAll')
    );
    menu.addSubMenu(ui.createMenu('Wrappers')
      .addItem('Cleanup Duplicates', 'WRAPPERS_cleanupDuplicates')
    );

    menu.addToUi();
  }




  // lightweight UI prompts
  function promptStationId_(title) {
    const res = SpreadsheetApp.getUi().prompt(title, 'station id:', SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return null;
    const v = res.getResponseText().trim();
    return v || null;
  }

  globalThis.UI_applyModulesForCurrent = () => {
    const id = promptStationId_('Apply Modules for Station');
    if (!id) return;
    RBAC.require('operator', `station:${id}`);
    MODULES.applyAllForStation(id);
    ORK_Alerts.toast(`Modules applied for ${id}`);
  };
  globalThis.UI_backupStation = () => {
    const id = promptStationId_('Backup Station');
    if (!id) return;
    RBAC.require('admin', `station:${id}`);
    BACKUP.backupStation(id);
  };
  globalThis.UI_restoreStation = () => {
    const id = promptStationId_('Restore Station');
    if (!id) return;
    RBAC.requireTwoAdmins_(); // dual control for safety
    BACKUP.restoreStationLast(id);
  };
  globalThis.UI_repairStation = () => {
    const id = promptStationId_('Repair Station');
    if (!id) return;
    RBAC.require('operator', `station:${id}`);
    REPAIR.repairStation(id);
  };

  return { build };
})();

globalThis.UI_cleanLegacyArch = () => {
  const ui = SpreadsheetApp.getUi();
  const a = ui.alert('Clean ARCH', 'Geçersiz/legacy SECTION satırlarını silmek istiyor musun?', ui.ButtonSet.OK_CANCEL);
  if (a !== ui.Button.OK) return;
  const n = ARCH.cleanLegacyRows();
  ORK_Alerts.toast(`ARCH cleaned: removed ${n} rows`);
};



globalThis.UI_normalizeSM_pilot_hard = () => {
  const ui = SpreadsheetApp.getUi();
  const a = ui.alert(
    'Normalize STATION_MODULEs',
    'Önce ARCH snapshot alınacak, sonra PILOT istasyonlar için TÜM modüllerde fazlalık satırlar HARD DELETE ile temizlenecek. Devam?',
    ui.ButtonSet.OK_CANCEL
  );
  if (a !== ui.Button.OK) return;

  try {
    // 1) Snapshot (ARCH)
    if (typeof JOBS?.run_backup_arch === 'function') {
      JOBS.run_backup_arch(); // mevcut job varsa kullan
    } else if (typeof BACKUP?.snapshotArch === 'function') {
      BACKUP.snapshotArch();  // alternatif
    }

    // 2) Normalize
    const res = ARCH.normalizeStationModules({ ringFilter:'pilot', hard:true, modules:'ALL' });

    ORK_Alerts.toast(`Normalized (pilot): kept=${res.kept} removed=${res.removed} archived=${res.archived}`);
    LOG.audit('UI_NORMALIZE_SM','ok', JSON.stringify(res));
  } catch (e) {
    LOG.audit('UI_NORMALIZE_SM','error', String(e));
    SpreadsheetApp.getActive().toast('Normalize hata: ' + e);
    throw e;
  }
};


globalThis.UI_normalizeSM_all_hard = () => {
  const ui = SpreadsheetApp.getUi();
  const a = ui.alert(
    'Normalize STATION_MODULEs (ALL)',
    'Önce ARCH snapshot alınacak, sonra TÜM ring’lerde TÜM modüller için fazlalık satırlar HARD DELETE ile temizlenecek. Devam?',
    ui.ButtonSet.OK_CANCEL
  );
  if (a !== ui.Button.OK) return;

  // 1) Snapshot
  try {
    if (typeof JOBS?.run_backup_arch === 'function') JOBS.run_backup_arch();
    else if (typeof BACKUP?.snapshotArch === 'function') BACKUP.snapshotArch();

    // 2) Normalize (ALL rings)
    const res = ARCH.normalizeStationModules({ ringFilter:'ALL', hard:true, modules:'ALL' });
    ORK_Alerts.toast(`Normalized (ALL): kept=${res.kept} removed=${res.removed} archived=${res.archived}`);
    LOG.audit('UI_NORMALIZE_SM_ALL','ok', JSON.stringify(res));
  } catch (e) {
    LOG.audit('UI_NORMALIZE_SM_ALL','error', String(e));
    SpreadsheetApp.getActive().toast('Normalize hata: ' + e);
    throw e;
  }
};



globalThis.UI_backupStation = () => {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.prompt('Backup Station', 'Station ID gir (örn: commerce):', ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK) return;
  const id = (ans.getResponseText()||'').trim();
  if (!id) return;
  try {
    BACKUP.snapshotStation(id);
  } catch (e) {
    LOG.audit('UI_BACKUP_STATION','error', String(e));
    SpreadsheetApp.getActive().toast('Backup hata: ' + e);
  }
};

globalThis.UI_restoreStation = () => {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.prompt('Restore Station', 'Station ID gir (örn: commerce):', ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK) return;
  const id = (ans.getResponseText()||'').trim();
  if (!id) return;
  const again = ui.alert('Onay', `DİKKAT: ${id} istasyonundaki sheet içerikleri CSV’den geri yüklenecek (üzerine yazar). Devam?`, ui.ButtonSet.OK_CANCEL);
  if (again !== ui.Button.OK) return;
  try {
    BACKUP.restoreStation(id);
  } catch (e) {
    LOG.audit('UI_RESTORE_STATION','error', String(e));
    SpreadsheetApp.getActive().toast('Restore hata: ' + e);
  }
};


globalThis.UI_deployWrappersPilot = () => {
  const ui = SpreadsheetApp.getUi();
  const v = ui.prompt('Deploy Wrappers (pilot)', 'RootLib VERSION (integer, örn: 1):', ui.ButtonSet.OK_CANCEL);
  if (v.getSelectedButton() !== ui.Button.OK) return;
  const ver = parseInt((v.getResponseText()||'').trim(), 10);
  if (isNaN(ver)) return ui.alert('Lütfen integer bir sürüm gir (örn: 1, 2, 3)');
  try { WRAPPERS.deployPilot(ver); }
  catch(e){ LOG.audit('UI_DEPLOY_WRAPPERS','error', String(e)); SpreadsheetApp.getActive().toast('Deploy error: ' + e); }
};

globalThis.UI_wrapperBumpPilot = () => {
  const ui = SpreadsheetApp.getUi();
  const v = ui.prompt('Wrapper Bump (pilot)', 'Yeni RootLib VERSION (integer, örn: 2):', ui.ButtonSet.OK_CANCEL);
  if (v.getSelectedButton() !== ui.Button.OK) return;
  const ver = parseInt((v.getResponseText()||'').trim(), 10);
  if (isNaN(ver)) return ui.alert('Lütfen integer bir sürüm gir (örn: 2)');
  try { WRAPPER_UPD.bumpPilot(ver); }
  catch(e){ LOG.audit('UI_WRAPPER_BUMP','error', String(e)); SpreadsheetApp.getActive().toast('Bump error: ' + e); }
};

function UI_LOADER_EnsureScaffold(){ LOADER.ensureScaffold(); }

function UI_LOADER_RunPilot(){ LOADER.runAll({ring:'pilot'}); }

function UI_LOADER_RunAll(){ LOADER.runAll({ring:'ALL'}); }

function UI_LOADER_RunOne(){
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Run Loader (one)', 'Station ID ?', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() === ui.Button.OK) {
    const id = String(r.getResponseText()||'').trim();
    if (id) LOADER.runOne(id);
  }
}



