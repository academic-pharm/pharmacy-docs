/**
 * CPE File Upload — Google Apps Script Web App
 *
 * วิธี deploy:
 * 1. ไปที่ https://script.google.com → New project
 * 2. วางโค้ดทั้งหมดนี้ลงใน Code.gs
 * 3. Deploy → New deployment → Web app
 *      Execute as : Me
 *      Who has access : Anyone
 * 4. คัดลอก Web app URL มาใส่ใน APPS_SCRIPT_URL ใน cpe-form-system.html
 */

var ROOT_FOLDER = 'CPE เอกสารต่ออายุ';   // ชื่อโฟลเดอร์หลักใน Drive

/* ─── Main POST handler ─── */
function doPost(e) {
  try {
    var data     = JSON.parse(e.postData.contents);
    var b64      = data.fileBase64;
    var name     = data.fileName   || 'file';
    var mime     = data.mimeType   || 'application/octet-stream';
    var orgName  = data.orgName    || 'ไม่ระบุหน่วยงาน';
    var docType  = data.docType    || 'document';

    var root      = getOrCreate(ROOT_FOLDER, null);
    var orgFolder = getOrCreate(orgName, root);

    var bytes = Utilities.base64Decode(b64);
    var blob  = Utilities.newBlob(bytes, mime, name);
    var file  = orgFolder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return respond({ success:true, url:file.getUrl(), id:file.getId(), name:file.getName() });
  } catch(err) {
    return respond({ success:false, error:err.toString() });
  }
}

function doGet() {
  return respond({ status:'CPE Upload API running' });
}

/* ─── Helpers ─── */
function getOrCreate(name, parent) {
  var it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
