/** JOBS — zamanlanmış işler ve elle koşturma */
const JOBS = (() => {

  /** Tüm tetikleyicileri sıfırla → 03:00 / 03:15 / 05:10 cronlarını kur */
  function syncTriggers() {
    // Projedeki tüm mevcut tetikleyicileri sil
    ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

    // Günlük tetikleyiciler (Europe/Amsterdam saat dilimi projenin ayarından alınır)
    _createDailyAt_('JOBS.run_backup_arch',   3,  0);  // 03:00
    _createDailyAt_('JOBS.run_audit_nightly', 3, 15);  // 03:15
    _createDailyAt_('JOBS.run_orders_pull',   5, 10);  // 05:10

    LOG.audit('TRIGGERS_SYNC', 'ok', 'count=3');
    if (typeof ORK_Alerts !== 'undefined') ORK_Alerts.toast('Triggers synced (3)');
  }

  /** Hepsini şimdi çalıştır (elle) */
  function runAllNow() {
    run_backup_arch();
    run_audit_nightly();
    run_orders_pull();
  }

  /** 03:00 — ARCH yedeği (CSV, last-only) */
  function run_backup_arch() {
    try {
      BACKUP.snapshotArch(); // 30_backup_restore.gs içindeki fonksiyon
      LOG.job('BACKUP_DAILY', 'ok', 'ARCH snapshot');
    } catch (e) {
      LOG.job('BACKUP_DAILY', 'error', String(e));
      throw e;
    }
  }

  /** 03:15 — ATLAS güncelle (dokümantasyon/envanter) */
  function run_audit_nightly() {
    try {
      ATLAS.generateDynamic();
      LOG.job('AUDIT_NIGHTLY', 'ok', 'atlas updated');
    } catch (e) {
      LOG.job('AUDIT_NIGHTLY', 'error', String(e));
      throw e;
    }
  }

  /** 05:10 — Pilot istasyonlarda Orders Sync pull */
  function run_orders_pull() {
    const stations = ARCH.list('STATION')
      .filter(s => (s.RING === 'pilot') && (s.ACTIVE + '' === 'true'));

    let ok = 0, fail = 0;
    stations.forEach(s => {
      try {
        MOD_ORDERS.pull(s.ID, { dryRun: false });
        ok++;
      } catch (e) {
        fail++;
        LOG.job('ORDERS_PULL', 'error', `station=${s.ID} err=${e}`);
      }
    });

    LOG.job('ORDERS_PULL', 'ok', `stations=${stations.length} ok=${ok} fail=${fail}`);
  }

  /** Yardımcı: her gün saat:dk tetikleyici kur */
  function _createDailyAt_(fnName, hour, minute) {
    ScriptApp.newTrigger(fnName)
      .timeBased()
      .atHour(hour)
      .nearMinute(minute)
      .everyDays(1)
      .create();
  }

  return {
    syncTriggers,
    runAllNow,
    run_backup_arch,
    run_audit_nightly,
    run_orders_pull,
  };
})();
