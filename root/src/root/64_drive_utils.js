/** DRIVE UTILS — güvenli ensure helpers */
const DRIVE_UTILS = (() => {

  function ensureFolder(parentId, name){
    const res = Drive.Files.list({
      q: `'${parentId}' in parents and name='${name}' and trashed=false and mimeType='application/vnd.google-apps.folder'`,
      maxResults: 1
    });
    if (res.items && res.items.length) return res.items[0].id;
    const created = Drive.Files.insert({
      title: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents:[{id: parentId}]
    });
    return created.id;
  }

  function ensureFile(folderId, name, mimeType, content){
    if (!mimeType) mimeType = 'application/json';
    const res = Drive.Files.list({
      q: `'${folderId}' in parents and name='${name}' and trashed=false`,
      maxResults: 1
    });
    if (res.items && res.items.length) return res.items[0].id;
    const blob = Utilities.newBlob(content || '', mimeType, name);
    const created = Drive.Files.insert({ title: name, parents:[{id: folderId}] }, blob);
    return created.id;
  }

  return { ensureFolder, ensureFile };

})();
