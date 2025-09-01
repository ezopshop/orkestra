/**
 * Duplicate wrapper script temizleyici
 * - Default: eski wrapper’ları Drive çöpüne taşır
 * - Opsiyon: {hardDelete:true} verilirse kalıcı siler
 */
function WRAPPERS_cleanupDuplicates(opts = {}) {
  const hardDelete = opts.hardDelete === true;
  const seen = {};
  let trashed = 0, deleted = 0;

  ARCH.list('STATION').forEach(st => {
    if (!st.SCRIPT_ID) return;

    // Bu istasyon için Drive'da tüm wrapper projelerini bul
    const folderId = st.FOLDER_ID;
    if (!folderId) return;

    const scripts = Drive.Files.list({
      q: `'${folderId}' in parents and title contains '[WRAPPER] ${st.ID}' and trashed=false`
    }).items || [];

    if (scripts.length > 1) {
      // Sort by createdDate (yeniler üstte)
      scripts.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
      const keep = scripts[0].id; // en yenisini sakla

      scripts.slice(1).forEach(old => {
        try {
          if (hardDelete) {
            Drive.Files.remove(old.id);
            deleted++;
          } else {
            Drive.Files.trash(old.id);
            trashed++;
          }
        } catch (e) {
          LOG.audit('WRAPPER_CLEANUP','error', `${st.ID} ${e}`);
        }
      });

      LOG.audit('WRAPPER_CLEANUP','ok', `${st.ID} kept=${keep} removed=${scripts.length-1}`);
    }
  });

  if (hardDelete) {
    _toast_(`Wrapper cleanup done. ${deleted} kalıcı silindi.`);
  } else {
    _toast_(`Wrapper cleanup done. ${trashed} çöp kutusuna taşındı.`);
  }
}
