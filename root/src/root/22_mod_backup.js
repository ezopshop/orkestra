const MOD_BACKUP = (() => {
  const MODULE_ID = 'mod_backup';
  function apply(st){ LOG.audit('MOD_BACKUP_APPLY','ok', `station=${st.ID}`); }
  function repair(stId){ LOG.audit('MOD_BACKUP_REPAIR','ok', `station=${stId}`); }
  function info(){ return {id:MODULE_ID, desc:'Station snapshot CSV backup/restore'}; }
  return { apply, repair, info };
})();
