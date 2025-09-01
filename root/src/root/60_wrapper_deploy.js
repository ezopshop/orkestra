/** WRAPPERS — bound script deploy (create + push files + manifest pin) */
const WRAPPERS = (() => {

  /** Pilot ring’deki tüm aktif istasyonlara wrapper deploy */
  function deployPilot(versionInt = ORK_ENV.LIB_ROOT_VER) {
    const stations = ARCH.list('STATION').filter(s => (s.RING === 'pilot') && (s.ACTIVE + '' === 'true'));
    stations.forEach(s => deployOne(s.ID, versionInt));
    LOG.audit('WRAPPER_DEPLOY_PILOT', 'ok', `stations=${stations.length} v=${versionInt}`);
    if (typeof ORK_Alerts?.toast === 'function') ORK_Alerts.toast(`Wrapper deploy pilot: ${stations.length} station`);
  }

  /** Tek istasyona wrapper deploy (bound project + manifest pin) */
  function deployOne(stationId, versionInt = ORK_ENV.LIB_ROOT_VER) {
    const st = _getStation_(stationId);

    // Bound script projesini oluştur
    const created = GASAPI.post('/projects', {
      title: `[WRAPPER] ${st.ID}`,
      parentId: st.SPREADSHEET_ID
    });
    const scriptId = created.scriptId;

    // İçeriği (manifest + GS dosyaları) push et
    GASAPI.put(`/projects/${scriptId}/content`, {
      scriptId,
      files: _wrapperFiles_(st, versionInt)
    });

    // ARCH.STATION’a SCRIPT_ID ve URL yaz
    const urlScript = `https://script.google.com/d/${scriptId}/edit`;
    ARCH.upsertRow(ARCH.Sections.STATION, { ID: st.ID, SCRIPT_ID: scriptId, URL_SCRIPT: urlScript });

    LOG.audit('WRAPPER_DEPLOY', 'ok', st.ID);
    return scriptId;
  }

  /** Wrapper dosya seti (manifest + menü + küçük info) */
  function _wrapperFiles_(st, libVersionInt) {
    // Manifest — kütüphaneler dependencies.libraries altında olmalı
    const manifest = {
      timeZone: ORK_ENV.TZ || 'Europe/Amsterdam',
      dependencies: {
        libraries: [
          {
            userSymbol: "RootLib",
            libraryId: ORK_ENV.LIB_ROOT_ID,          // 01_env.gs’de Script ID
            version: String(Number(libVersionInt)),  // Apps Script library version = INTEGER (string olarak)
            developmentMode: false
          }
        ]
      }
    };

    // Debug: push öncesi manifesti logla
    Logger.log('WRAPPER manifest JSON = %s', JSON.stringify(manifest, null, 2));

    const menuGs = `
function onOpen(){
  SpreadsheetApp.getUi()
    .createMenu('Orders Sync')
    .addItem('Pull Now', 'WRAP_pullNow')
    .addItem('Dry-run', 'WRAP_dry')
    .addToUi();
}
function WRAP_pullNow(){
  try {
    RootLib && RootLib.MOD_ORDERS
      ? RootLib.MOD_ORDERS.pull('${st.ID}', {dryRun:false})
      : SpreadsheetApp.getActive().toast('RootLib not loaded');
  } catch(e){ SpreadsheetApp.getActive().toast('Pull error: '+e); throw e; }
}
function WRAP_dry(){
  try {
    RootLib && RootLib.MOD_ORDERS
      ? RootLib.MOD_ORDERS.pull('${st.ID}', {dryRun:true})
      : SpreadsheetApp.getActive().toast('RootLib not loaded');
  } catch(e){ SpreadsheetApp.getActive().toast('Dry error: '+e); throw e; }
}
`.trim();

    const infoGs = `
function Wrapper_Info(){
  var ui = SpreadsheetApp.getUi();
  ui.alert('Wrapper Info',
    'Station: ${st.ID}\\nOwner: ${st.OWNER_EMAIL}\\nRing: ${st.RING}',
    ui.ButtonSet.OK);
}
`.trim();

    return [
      { name: 'appsscript', type: 'JSON',      source: JSON.stringify(manifest, null, 2) },
      { name: 'WrapperMenu', type: 'SERVER_JS', source: menuGs },
      { name: 'WrapperInfo', type: 'SERVER_JS', source: infoGs }
    ];
  }

  function _getStation_(id) {
    const st = ARCH.list('STATION').find(r => r.ID === id);
    if (!st) throw new Error(`Station not found: ${id}`);
    if (!ORK_ENV.LIB_ROOT_ID) throw new Error('ORK_ENV.LIB_ROOT_ID missing (Root library Script ID)');
    return st;
  }

  // ⬇️ ÖNEMLİ: IIFE dönüşü (global WRAPPERS objesini oluşturur)
  return { deployPilot, deployOne, _wrapperFiles_ };
})();


function DEBUG_deployOne_commerce(){
  Logger.log('typeof WRAPPERS = %s', typeof WRAPPERS);
  WRAPPERS.deployOne('commerce', ORK_ENV.LIB_ROOT_VER);
}


function deployOne(stationId, versionInt = ORK_ENV.LIB_ROOT_VER, opts = {}) {
  const st = _getStation_(stationId);
  const created = GASAPI.post('/projects', { title: `[WRAPPER] ${st.ID}`, parentId: st.SPREADSHEET_ID });
  const scriptId = created.scriptId;

  // içerik
  GASAPI.put(`/projects/${scriptId}/content`, {
    scriptId,
    files: _wrapperFiles_(st, versionInt, opts)
  });

  const urlScript = `https://script.google.com/d/${scriptId}/edit`;
  ARCH.upsertRow(ARCH.Sections.STATION, { ID: st.ID, SCRIPT_ID: scriptId, URL_SCRIPT: urlScript });
  LOG.audit('WRAPPER_DEPLOY','ok', st.ID);
  return scriptId;
}

function _wrapperFiles_(st, libVersionInt, opts = {}) {
  const manifest = {
    timeZone: ORK_ENV.TZ || 'Europe/Amsterdam',
    dependencies: {
      libraries: [{
        userSymbol: "RootLib",
        libraryId: ORK_ENV.LIB_ROOT_ID,
        version: String(Number(libVersionInt)),
        developmentMode: false
      }]
    }
  };

  // Eğer _Bootstrap/wrappers/<stationId> altında .gs dosyaları varsa al
  const customFiles = [];
  try {
    if (opts.customFilesPath) {
      const file = DriveApp.getFileById(ORK_ENV.ROOT.getId());
      const rootFolder = file.getParents().hasNext() ? file.getParents().next() : DriveApp.getRootFolder();
      const parts = String(opts.customFilesPath).split('/').filter(Boolean);
      let cur = rootFolder;
      for (let i=0;i<parts.length;i++){
        const it = cur.getFoldersByName(parts[i]);
        if (!it.hasNext()) { cur = null; break; }
        cur = it.next();
      }
      if (cur){
        const it = cur.getFiles();
        while (it.hasNext()){
          const f = it.next();
          const name = f.getName();
          if (name.toLowerCase().endsWith('.gs')) {
            customFiles.push({ name: name.replace(/\.gs$/i,''), type: 'SERVER_JS', source: f.getBlob().getDataAsString('UTF-8') });
          } else if (name.toLowerCase()==='appsscript.json') {
            // manifest override’ı şimdilik es geç (ileride merge edilebilir)
          }
        }
      }
    }
  } catch(e){ /* sessiz geç */ }

  if (customFiles.length) {
    return [{ name:'appsscript', type:'JSON', source: JSON.stringify(manifest, null, 2) }, ...customFiles];
  }

  // Minimal varsayılan menü/handlers
  const menuGs = `
function onOpen(){
  SpreadsheetApp.getUi()
    .createMenu('Orders Sync')
    .addItem('Pull Now', 'WRAP_pullNow')
    .addItem('Dry-run', 'WRAP_dry')
    .addToUi();
}
function WRAP_pullNow(){
  try {
    RootLib && RootLib.MOD_ORDERS
      ? RootLib.MOD_ORDERS.pull('${st.ID}', {dryRun:false})
      : SpreadsheetApp.getActive().toast('RootLib not loaded');
  } catch(e){ SpreadsheetApp.getActive().toast('Pull error: '+e); throw e; }
}
function WRAP_dry(){
  try {
    RootLib && RootLib.MOD_ORDERS
      ? RootLib.MOD_ORDERS.pull('${st.ID}', {dryRun:true})
      : SpreadsheetApp.getActive().toast('RootLib not loaded');
  } catch(e){ SpreadsheetApp.getActive().toast('Dry error: '+e); throw e; }
}`.trim();

  const infoGs = `
function Wrapper_Info(){
  var ui = SpreadsheetApp.getUi();
  ui.alert('Wrapper Info','Station: ${st.ID}\\nOwner: ${st.OWNER_EMAIL}\\nRing: ${st.RING}',ui.ButtonSet.OK);
}`.trim();

  return [
    { name: 'appsscript', type: 'JSON',       source: JSON.stringify(manifest, null, 2) },
    { name: 'WrapperMenu', type: 'SERVER_JS', source: menuGs },
    { name: 'WrapperInfo', type: 'SERVER_JS', source: infoGs }
  ];
}

