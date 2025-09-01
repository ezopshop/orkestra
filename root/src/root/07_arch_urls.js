const STATION_URLS = (() => {
  function fill(stationId, fields) {
    ARCH.upsertRow(ARCH.Sections.STATION, Object.assign({ID:stationId}, fields));
  }
  return { fill };
})();
