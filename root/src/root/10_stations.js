/** STATIONS — station bootstrap & ARCH kayıt */
const STATIONS = (() => {

  function ensureStation({id, owner, ring='pilot', name=null}) {
    const rootFolderId = DriveApp.getRootFolder().getId();
    const orkFolderId  = DRIVE_UTILS.ensureFolder(rootFolderId, 'Orkestra');
    const stationFolderId = DRIVE_UTILS.ensureFolder(orkFolderId, id);
    const sheetsFolderId  = DRIVE_UTILS.ensureFolder(stationFolderId, 'Sheets');
    const scriptsFolderId = DRIVE_UTILS.ensureFolder(stationFolderId, 'Scripts');
    const backupsFolderId = DRIVE_UTILS.ensureFolder(stationFolderId, '_Backups');

    const ss = _ensureSpreadsheet_(sheetsFolderId, `${id}`);

    ARCH.upsertRow(ARCH.Sections.STATION, {
      ID: id,
      NAME: (name || id),
      ACTIVE: true,
      OWNER_EMAIL: owner,
      FOLDER_ID: stationFolderId,
      SPREADSHEET_ID: ss.getId(),
      URL_FOLDER: DriveApp.getFolderById(stationFolderId).getUrl(),
      URL_SPREADSHEET: ss.getUrl(),
      TIMEZONE: ORK_ENV.TZ,
      RING: ring
    });

    STATION_SCAFFOLD.ensure(ss);
    return id;
  }

  function backfillUrlsForAll() {
    // Eğer ARCH tablosunda boş URL varsa burada doldur
  }

  function _ensureSpreadsheet_(folderId, name){
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(name);
    if (files.hasNext()) return SpreadsheetApp.open(files.next());
    const ss = SpreadsheetApp.create(name);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    return ss;
  }

  return { ensureStation, backfillUrlsForAll };

})();
