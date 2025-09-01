const DOCS = (() => {
  function generateAll(){
    const sh = ORK_ENV.ROOT.getSheetByName(ORK_ENV.SHEETS.ROOT_HELP) || ORK_ENV.ROOT.insertSheet(ORK_ENV.SHEETS.ROOT_HELP);
    sh.clear();
    sh.getRange(1,1,8,2).setValues([
      ['Orkestra','ROOT help'],
      ['Init','Orkestra → Tools → Ensure ARCH, Generate ATLAS'],
      ['Stations','Provision Pilot, Apply Modules, Repair'],
      ['Modules','orders-sync v0.1.0'],
      ['Backup','03:00 daily (ARCH)'],
      ['Jobs','Run All Jobs / Sync Triggers'],
      ['Alerts','Only root + station owner (no CC)'],
      ['Version','RootLib 0.1.0']
    ]);
  }
  return { generateAll };
})();
