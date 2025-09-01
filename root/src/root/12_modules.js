const MODULES = (() => {
  function applyAllForStation(stationId) {
    const st = _getStation_(stationId);
    // aktif modülleri ARCH'tan oku (ileride genişletiriz). Şimdilik ordersync'i uygula:
    MOD_ORDERS.apply(st); // MOD_ORDERS MODULE_ID'si artık 'mod_ordersync'
    ARCH.upsertRow(ARCH.Sections.STATION_MODULE, {
      STATION_ID: stationId, MODULE_ID:'mod_ordersync',
      appliedVersion:'0.1.0', schemaVersion:1, STATE:'ok', appliedAt:new Date()
    });
  }

  function applyAllActive() {
    ARCH.list('STATION').filter(r => (r.ACTIVE+''==='true')).forEach(s => applyAllForStation(s.ID));
  }

  function seedActiveForPilotStations() {
    const modules = ARCH.list('MODULE').filter(m => (m.ACTIVE+''==='true'));
    const stations = ARCH.list('STATION').filter(s => (s.RING==='pilot') && (s.ACTIVE+''==='true'));
    stations.forEach(s => {
      modules.forEach(m => {
        const isOrderSync = (m.ID === 'mod_ordersync');
        ARCH.upsertRow(ARCH.Sections.STATION_MODULE, {
          STATION_ID: s.ID,
          MODULE_ID: m.ID,
          schemaVersion: isOrderSync ? 1 : '',
          appliedVersion: isOrderSync ? '0.1.0' : '',
          STATE: isOrderSync ? 'ok' : 'pending',
          appliedAt: isOrderSync ? new Date() : ''
        });
      });
    });
    LOG.audit('STATION_MODULE_SEED','ok', `stations=${stations.length} modules=${modules.length}`);
  }

  function _getStation_(id){
    const rows = ARCH.list('STATION');
    const st = rows.find(r => r.ID === id);
    if (!st) throw new Error(`Station not found: ${id}`);
    return st;
  }

  return { applyAllForStation, applyAllActive, seedActiveForPilotStations };
})();
