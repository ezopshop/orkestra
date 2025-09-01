const ORK_ENV = (() => {
  const TZ = 'Europe/Amsterdam';
  const ROOT = SpreadsheetApp.getActiveSpreadsheet();

  function ensureTimezone() {
    if (ROOT.getSpreadsheetTimeZone() !== TZ) {
      ROOT.setSpreadsheetTimeZone(TZ);
    }
  }

  const SHEETS = {
    ARCH: 'ARCH',
    ATLAS_FILES: 'ATLAS_FILES',
    ATLAS_FUNCS: 'ATLAS_FUNCS',
    ATLAS_MENU: 'ATLAS_MENU',
    ATLAS_ARCH: 'ATLAS_ARCH',
    JOBS_LOG: 'JOBS_LOG',
    AUDIT_LOG: 'AUDIT_LOG',
    ROOT_HELP: 'ROOT_HELP',
  };

  const RINGS = ['pilot','beta','stable'];

  function getRootEmail() { return 'ezopshop@gmail.com'; } // root admin
  function getBackupRetentionDays() { return 7; }

  // 🔴 BURAYI DOLDUR (Script ID’yi yerine yapıştır, version bir tam sayı olmalı)
  const LIB_ROOT_ID  = '1lUARn29Am_ZHgMsDBn_hA0HpcFRNvaolJQi0e1T_-rR9PLybJg2qr3Z6'; // ← Script ID (1… ile başlar)
  const LIB_ROOT_VER = 1; // Library “Version 1” (Manage deployments → Library)


  return {
    TZ, ROOT, SHEETS, RINGS,
    ensureTimezone, getRootEmail, getBackupRetentionDays,
    LIB_ROOT_ID, LIB_ROOT_VER
  };
})();

