const MOD_TEMPLATES = (() => {
  const MODULE_ID = 'mod_templates';
  function apply(st){ LOG.audit('MOD_TEMPLATES_APPLY','ok', `station=${st.ID}`); }
  function repair(stId){ LOG.audit('MOD_TEMPLATES_REPAIR','ok', `station=${stId}`); }
  function info(){ return {id:MODULE_ID, desc:'Template catalog & apply'}; }
  return { apply, repair, info };
})();
