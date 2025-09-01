/** WRAPPER UPDATE — info / bump / repair (manifest semver pin) */
const WRAPPER_UPD = (() => {

  /** manifest’teki RootLib sürümünü oku */
  function info(stationId){
    const st = _getStation_(stationId);
    if (!st.SCRIPT_ID) throw new Error(`No wrapper SCRIPT_ID for ${stationId}`);
    const content = GASAPI.get(`/projects/${st.SCRIPT_ID}/content`);
    const mf = (content.files || []).find(f => f.name === 'appsscript');
    if (!mf) throw new Error('Manifest not found in wrapper');
    const m = JSON.parse(mf.source || '{}');
    const libs = (((m.dependencies||{}).libraries)||[]);
    const lib = libs.find(l => l.userSymbol === 'RootLib') || {};
    const ver = lib.version || '(not pinned)';
    LOG.audit('WRAPPER_INFO','ok', `${stationId} v=${ver}`);
    return { stationId, version: ver, title: content.title || '' };
  }

  /** manifest’teki RootLib sürümünü yeni integer versiyona ayarla */
  function bump(stationId, newVersionInt){
    const st = _getStation_(stationId);
    if (!st.SCRIPT_ID) throw new Error(`No wrapper SCRIPT_ID for ${stationId}`);

    const content = GASAPI.get(`/projects/${st.SCRIPT_ID}/content`);
    const files = content.files || [];
    const mf = files.find(f => f.name === 'appsscript');
    if (!mf) throw new Error('Manifest not found');

    const m = JSON.parse(mf.source || '{}');
    if (!m.dependencies) m.dependencies = {};
    if (!m.dependencies.libraries) m.dependencies.libraries = [];
    const libs = m.dependencies.libraries;

    const verStr = String(Number(newVersionInt));
    const idx = libs.findIndex(l => l.userSymbol === 'RootLib');

    if (idx >= 0) libs[idx].version = verStr;
    else libs.push({ userSymbol:'RootLib', libraryId: ORK_ENV.LIB_ROOT_ID, version: verStr, developmentMode:false });

    mf.source = JSON.stringify(m, null, 2);
    GASAPI.put(`/projects/${st.SCRIPT_ID}/content`, { scriptId: st.SCRIPT_ID, files });

    LOG.audit('WRAPPER_BUMP','ok', `${stationId} -> v${verStr}`);
    ORK_Alerts && ORK_Alerts.toast && ORK_Alerts.toast(`Wrapper bumped: ${stationId} → v${verStr}`);
  }

  /** manifest + dosyaları baştan yazar (pin = targetVersionInt) */
  function repair(stationId, targetVersionInt){
    const st = _getStation_(stationId);
    if (!st.SCRIPT_ID) throw new Error(`No wrapper SCRIPT_ID for ${stationId}`);

    const ver = Number(targetVersionInt ?? ORK_ENV.LIB_ROOT_VER);
    const files = WRAPPERS._wrapperFiles_(st, ver); // 60_wrapper_deploy.gs içindeki factory
    GASAPI.put(`/projects/${st.SCRIPT_ID}/content`, { scriptId: st.SCRIPT_ID, files });

    LOG.audit('WRAPPER_REPAIR','ok', `${stationId} -> v${ver}`);
    ORK_Alerts && ORK_Alerts.toast && ORK_Alerts.toast(`Wrapper repaired: ${stationId} (v${ver})`);
  }

  function bumpPilot(newVersionInt){
    const stations = ARCH.list('STATION').filter(s => (s.RING==='pilot') && (s.ACTIVE+''==='true'));
    stations.forEach(s => bump(s.ID, Number(newVersionInt)));
    LOG.audit('WRAPPER_BUMP_PILOT','ok', `v=${newVersionInt} stations=${stations.length}`);
  }

  function infoPilot(){
    const stations = ARCH.list('STATION').filter(s => (s.RING==='pilot') && (s.ACTIVE+''==='true'));
    return stations.map(s => info(s.ID));
  }

  function _getStation_(id){
    const st = ARCH.list('STATION').find(r => r.ID===id);
    if (!st) throw new Error(`Station not found: ${id}`);
    return st;
  }

  return { info, bump, repair, bumpPilot, infoPilot };
})();



function DEBUG_deployOne_commerce() {
  WRAPPERS.deployOne('commerce', ORK_ENV.LIB_ROOT_VER);
}



function UI_wrapperCleanup() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Wrapper Cleanup',
    'Çift wrapper projelerini temizlemek istiyor musunuz?\n\n"OK" → Çöp kutusuna taşır\n"YES" → Kalıcı siler',
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (resp === ui.Button.YES) {
    WRAPPERS_cleanupDuplicates({hardDelete:true});
  } else if (resp === ui.Button.NO) {
    WRAPPERS_cleanupDuplicates();
  } else {
    ui.alert('İşlem iptal edildi.');
  }
}

