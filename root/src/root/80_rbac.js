const RBAC = (() => {
  function require(role, scopeRef){
    // MVP: root user always allowed; others allowed for demo
    const me = Session.getActiveUser().getEmail() || 'unknown';
    const root = ORK_ENV.getRootEmail();
    if (me === root) return true;
    // later: check ARCH.ROLE for (me, role, scopeRef)
    return true;
  }
  function requireTwoAdmins_(){
    const ui = SpreadsheetApp.getUi();
    const a = ui.alert('Dual Control', 'Another admin must confirm. Continue?', ui.ButtonSet.OK_CANCEL);
    if (a !== ui.Button.OK) throw new Error('Aborted by user');
  }
  return { require, requireTwoAdmins_ };
})();
