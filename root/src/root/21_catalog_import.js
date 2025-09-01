/** CATALOG import — Drive CSV → ARCH.MODULE seed + STATION_MODULE tohum */
const CATALOG = (() => {
  const CATALOG_PATH = 'Orkestra/_Catalog';
  const CATALOG_FILE = 'orkestra_modules_catalog.csv';
  const DEFAULT_SEMVER = '0.1.0';
  const ACTIVE_TRUE = new Set(['mod_ordersync','mod_backup','mod_jobs','mod_templates']);
  const TIER_MAP = {
    mod_mailmerge:'pro', mod_styles:'pro', mod_docnav:'pro', mod_compare:'pro',
    mod_youtube:'enterprise', mod_finance:'enterprise', mod_audit:'enterprise',
    mod_ordersync:'basic', mod_backup:'basic', mod_jobs:'basic',
    mod_templates:'basic', mod_datamerge:'basic', mod_cleaner:'basic', mod_atlas:'basic', mod_rbac:'basic'
  };

  /** Menüden çağrı: CSV’yi oku → ARCH.MODULE upsert → pilot istasyonlara aktif modülleri seed et */
  function importModules() {
    const csv = _ensureAndReadCsv_();
    const rows = Utilities.parseCsv(csv);
    const hdr = rows[0].map(h => h.trim());
    const idx = _indexer_(hdr, ['ModuleName','CodeName','Description','PackageOpportunity']);

    for (let i=1;i<rows.length;i++){
      const r = rows[i];
      if (!r[idx.CodeName]) continue;
      const code = r[idx.CodeName].trim();
      const name = (r[idx.ModuleName]||'').trim();
      const desc = (r[idx.Description]||'').trim();
      const active = ACTIVE_TRUE.has(code);
      const tier = TIER_MAP[code] || 'basic';

      ARCH.upsertRow(ARCH.Sections.MODULE, {
        ID: code, NAME: name, ACTIVE: active, SEMVER: DEFAULT_SEMVER, TIER: tier, DESC: desc
      });
    }

    MODULES.seedActiveForPilotStations();
    ORK_Alerts.toast('Catalog import: MODULE + STATION_MODULE seed tamam.');
    LOG.audit('CATALOG_IMPORT','ok','modules & station_modules seeded');
  }

  /** CSV yoksa klasör+dosya oluşturup varsayılan içeriği yazar */
  function _ensureAndReadCsv_(){
    const folder = _ensureFolderPath_(CATALOG_PATH.split('/'));
    let file = _findFile_(folder, CATALOG_FILE);
    if (!file) {
      const defaultCsv = _defaultCsv_();
      file = folder.createFile(CATALOG_FILE, defaultCsv, MimeType.CSV);
      LOG.audit('CATALOG_INIT','ok', `created ${CATALOG_PATH}/${CATALOG_FILE}`);
      return defaultCsv;
    }
    return file.getBlob().getDataAsString('UTF-8');
  }

  function _defaultCsv_(){
    // Burada senin verdiğin tabloyu gömüyoruz; ileride CSV’yi dışarıdan güncelleyebilirsin.
    return [
      'ModuleName,CodeName,Description,PackageOpportunity',
      'MailMergeEngine,mod_mailmerge,Sheets’ten kişiselleştirilmiş e-posta/teklif gönderimi,CRM/Marketing Kampanya Paketi',
      'DocStyler,mod_styles,Google Docs şablon + kurumsal stil standardizasyonu,Kurumsal Doküman Yönetim Modülü',
      'DocNavigator,mod_docnav,Büyük dokümanlarda hızlı arama & gezinme,Araştırma / Akademik Paket',
      'SheetCleaner,mod_cleaner,Duplicate/boş satır temizleme, format düzeltme,Veri Hazırlık Modülü',
      'SheetCompare,mod_compare,İki sheet arasındaki farkları işaretleme,Rapor/versiyon kıyaslama',
      'DataMerge,mod_datamerge,Çoklu kaynaktan (CSV/REST) veri toplama & normalize etme,Merkezi Raporlama Modülü',
      'BackupRestore,mod_backup,ARCH + Station snapshot al/g geri yükle,Kurumsal Güvenlik & Süreklilik',
      'YouTubeAutomation,mod_youtube,YouTube API ile yükleme, istatistik, içerik takvimi,Ajans/Influencer Paketi',
      'ECommerceOrders,mod_ordersync,E-ticaret siparişlerini REST/CSV’den senkronize etme,Shopify/Amazon/Hepsiburada Entegrasyonu',
      'FinanceLedger,mod_finance,Gelir/gider, fatura, KDV raporlama,Muhasebe & Vergi Paketi',
      'AuditLogger,mod_audit,Tüm işlemlerde denetim izi (kim, ne zaman, ne yaptı),Compliance / ISO Modülü',
      'RBACPortal,mod_rbac,Rol/scope bazlı self-service portal,Abonelik/Lisanslama Paketi',
      'AtlasDocs,mod_atlas,Dinamik envanter & dokümantasyon üretimi,Developer/Operasyon Paketi',
      'WorkflowScheduler,mod_jobs,Cron tabanlı workflow/job orkestrasyonu,Automation Suite',
      'TemplateCatalog,mod_templates,Hazır tablo/doküman şablon kataloğu,HR/CRM/YouTube Şablon Paketleri'
    ].join('\n');
  }

  // helpers
  function _ensureFolderPath_(parts){
    let cur = DriveApp.getRootFolder();
    for (const p of parts){
      const it = cur.getFoldersByName(p);
      cur = it.hasNext() ? it.next() : cur.createFolder(p);
    }
    return cur;
  }
  function _findFile_(folder, name){
    const it = folder.getFilesByName(name);
    return it.hasNext() ? it.next() : null;
  }
  function _indexer_(hdr, keys){ const m={}; keys.forEach(k=>m[k]=hdr.indexOf(k)); return m; }

  return { importModules };
})();
