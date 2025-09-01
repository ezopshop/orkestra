const ATLAS = (() => {
  function generateStatic(){}

  function generateDynamic(){
    // ATLAS_ARCH (istasyonlar)
    const stations = ARCH.list('STATION');
    _writeSheet_(
      ORK_ENV.SHEETS.ATLAS_ARCH,
      ['ID','OWNER','RING','URL_SPREADSHEET'],
      stations.map(a => [a.ID, a.OWNER_EMAIL, a.RING, a.URL_SPREADSHEET])
    );

    // YENİ: ATLAS_MODULES
    _writeSheet_(
      'ATLAS_MODULES',
      ['ID','NAME','ACTIVE','SEMVER','TIER','DESC'],
      ARCH.list('MODULE').map(m => [m.ID, m.NAME, m.ACTIVE, m.SEMVER, m.TIER, m.DESC])
    );

    // YENİ: ATLAS_STATION_MODULES
    _writeSheet_(
      'ATLAS_STATION_MODULES',
      ['STATION_ID','MODULE_ID','STATE','appliedVersion','schemaVersion','lastRunAt','lastStatus'],
      ARCH.list('STATION_MODULE').map(sm => [sm.STATION_ID, sm.MODULE_ID, sm.STATE, sm.appliedVersion, sm.schemaVersion, sm.lastRunAt, sm.lastStatus])
    );

    LOG.audit('ATLAS_DYNAMIC','ok', 'arch/modules/station_modules written');
  }

  function _writeSheet_(name, hdr, rows){
    let s = ORK_ENV.ROOT.getSheetByName(name);
    if(!s) s = ORK_ENV.ROOT.insertSheet(name);
    s.clear();
    s.getRange(1,1,1,hdr.length).setValues([hdr]);
    if (rows.length) s.getRange(2,1,rows.length, hdr.length).setValues(rows);
  }

  return { generateStatic, generateDynamic };
})();
