/** Minimal Apps Script API client (UrlFetch + OAuth) */
const GASAPI = (() => {
  const BASE = 'https://script.googleapis.com/v1';

  function _headers_() {
    return {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    };
  }

  function _call_(method, path, body) {
    const url = `${BASE}${path}`;
    const opt = {
      method,
      headers: _headers_(),
      muteHttpExceptions: true
    };
    if (body !== undefined) opt.payload = JSON.stringify(body);

    Logger.log('GASAPI %s %s body=%s', method, url, body ? JSON.stringify(body).slice(0,500) : '');

    try {
      const res   = UrlFetchApp.fetch(url, opt);
      const code  = res.getResponseCode();
      const txt   = res.getContentText() || '';
      if (code >= 200 && code < 300) return txt ? JSON.parse(txt) : {};
      throw new Error(`GASAPI ${code}: ${txt}`);
    } catch (e) {
      // UrlFetch/Network/Quota hatalarında ayrıntıyı kaçırmayalım
      Logger.log('GASAPI FETCH ERR: %s', e && e.stack ? e.stack : e);
      throw e;
    }
  }

  function get(path)        { return _call_('get',  path); }
  function post(path, body) { return _call_('post', path, body); }
  function put(path, body)  { return _call_('put',  path, body); }

  return { get, post, put };
})();
