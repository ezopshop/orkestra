/**
 * ============================================
 *  ORKESTRA - STANDARD WORKFLOW INFO
 * ============================================
 * ✨ Çalışma Düzeni ✨
 * 1) Kod geliştirmeyi Google Sheets → Extensions → Apps Script üzerinden yap.
 * 2) Kodları test et, kaydet.
 * 3) İşin bitince terminalde:
 *      ./sync.sh   # App Script → Repo → GitHub
 *
 * 📌 Not:
 * - Repo’daki kod sadece referans içindir.
 * - Asıl güncellemeler App Script editöründe yapılır.
 * - Repo her zaman sync.sh ile güncel tutulur.
 * ============================================
 */


/** ORKESTRA — ROOT entrypoints & menu bootstrap (V8) */
function onOpen() {
  ORK_Menu.build();
}

function ORK_Init_All() {
  ORK_ENV.ensureTimezone();
  ARCH.ensureAllSections();
  ARCH.seedDefaults(); // module orders-sync v0.1.0, jobs, roles, etc.
  ATLAS.generateStatic();
  Logger.log('Init done');
  ORK_Alerts.toast('Orkestra: Init completed');
}

/** Wrapper-delegated public API (RootLib) — keep names stable */
function ORK_Station_ApplyModules(stationId) { return MODULES.applyAllForStation(stationId); }
function ORK_Station_Backup(stationId)      { return BACKUP.backupStation(stationId); }
function ORK_Station_RestoreLast(stationId) { return BACKUP.restoreStationLast(stationId); }
function ORK_Station_Repair(stationId)      { return REPAIR.repairStation(stationId); }
function ORK_Orders_Pull(stationId, dryRun) { return MOD_ORDERS.pull(stationId, {dryRun: !!dryRun}); }
function ORK_Wrapper_Info(stationId)        { return WRAPPERS.info(stationId); }

function ORK_Run_All_Jobs() { JOBS.runAllNow(); }
function ORK_Sync_Triggers() { JOBS.syncTriggers(); }
function ORK_Backup_ARCH()   { BACKUP.backupARCH(); }
function ORK_Restore_ARCH()  { BACKUP.restoreARCHLatest(); }

function ORK_Provision_Pilot() {
  const pilots = [
    {id: 'commerce', owner: 'bycmdgnmail@gmail.com', ring: 'pilot'},
    {id: 'family',   owner: 'bycdmail@gmail.com',    ring: 'pilot'},
    {id: 'news',     owner: 'boilingworldmail@gmail.com', ring: 'pilot'},
    {id: 'youtube',  owner: 'boilingworldmail@gmail.com', ring: 'pilot'},
  ];
  pilots.forEach(STATIONS.ensureStation);
  WRAPPERS.deployMany(pilots.map(p => p.id));
  STATIONS.backfillUrlsForAll();
  ORK_Alerts.toast('Pilot stations provisioned');
}



function ORK_Migrate_Ordersync_Id() {
  const changed = ARCH.migrateModuleId('orders-sync','mod_ordersync');
  SpreadsheetApp.getActive().toast(`ARCH migrate: changed rows = ${changed}`);
}
