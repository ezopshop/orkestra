const MOD_JOBS = (() => {
  const MODULE_ID = 'mod_jobs';
  function apply(st){ LOG.audit('MOD_JOBS_APPLY','ok', `station=${st.ID}`); }
  function repair(stId){ LOG.audit('MOD_JOBS_REPAIR','ok', `station=${stId}`); }
  function info(){ return {id:MODULE_ID, desc:'Cron/workflow orchestration'}; }
  return { apply, repair, info };
})();
