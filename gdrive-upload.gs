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

var ROOT_FOLDER  = 'CPE เอกสารต่ออายุ';
var SHEET_NAME   = 'ข้อมูลโครงการบริการวิชาการและ CPE';   // ชื่อ Google Sheet

/* ─── Main POST handler ─── */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // action: 'log' → บันทึกข้อมูลลง Sheet (ไม่อัปโหลดไฟล์)
    if (data.action === 'log') {
      return logToSheet(data);
    }

    // action: 'send_expert_email' → ส่งอีเมลให้ผู้ทรงคุณวุฒิ (ประชุมวิชาการ)
    if (data.action === 'send_expert_email') {
      return sendExpertEmail(data);
    }

    // action: 'send_article_expert_email' → ส่งอีเมลให้ผู้ทรงคุณวุฒิ (บทความวิชาการ)
    if (data.action === 'send_article_expert_email') {
      return sendArticleExpertEmail(data);
    }

    // action: 'update_conference_row' → admin อัพเดต row ใน Sheet ด้วย confId
    if (data.action === 'update_conference_row') {
      return updateConferenceRow(data);
    }

    // action: 'notify_cpe_result' → admin ยืนยันผลการพิจารณา → ส่งอีเมลแจ้ง user + อัพเดต Sheet
    if (data.action === 'notify_cpe_result') {
      return notifyCpeResult(data);
    }

    // action: 'log_appt' → บันทึกข้อมูลคำสั่งแต่งตั้งลง Sheet tab "คำสั่งแต่งตั้ง"
    if (data.action === 'log_appt') {
      return logApptToSheet(data);
    }

    // action: 'log_payment' → อัพโหลดหลักฐานชำระเงิน + บันทึกลง Sheet tab "ค่าธรรมเนียม"
    if (data.action === 'log_payment') {
      return logPaymentToSheet(data);
    }

    // action: 'confirm_payment' → admin ยืนยัน + อัพโหลดบิลใบเสร็จ + แจ้ง user ทางอีเมล
    if (data.action === 'confirm_payment') {
      return confirmPaymentAction(data);
    }

    // action: 'uploadFile' → อัปโหลดไฟล์เข้า folder ที่ระบุ (ใช้กับ approved-docs)
    if (data.action === 'uploadFile') {
      var folderId  = data.folderId  || '';
      var filename  = data.filename  || 'file.pdf';
      var mimeType  = data.mimeType  || 'application/pdf';
      var b64raw    = data.base64    || '';
      // strip data-URL prefix ถ้ามี (e.g. "data:application/pdf;base64,...")
      var b64clean  = b64raw.indexOf(',') >= 0 ? b64raw.split(',')[1] : b64raw;
      var folder    = DriveApp.getFolderById(folderId);
      var bytes     = Utilities.base64Decode(b64clean);
      var blob      = Utilities.newBlob(bytes, mimeType, filename);
      var file      = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return respond({ success:true, fileId:file.getId(), fileUrl:file.getUrl(), filename:file.getName() });
    }

    // action: 'upload' (legacy) → อัปโหลดไฟล์ไปยัง Drive (CPE renewal)
    var b64     = data.fileBase64;
    var name    = data.fileName  || 'file';
    var mime    = data.mimeType  || 'application/octet-stream';
    var orgName = data.orgName   || 'ไม่ระบุหน่วยงาน';
    var docType = data.docType   || 'document';

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

function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var action = p.action || '';

    // action: 'createProjectFolder' → สร้างโฟลเดอร์ Drive สำหรับโครงการใหม่
    if (action === 'createProjectFolder') {
      var pid         = p.pid         || '';
      var projectName = p.projectName || 'โครงการใหม่';
      var rootAcad    = getOrCreate('โครงการบริการวิชาการ BUU', null);
      var projFolder  = getOrCreate(projectName + (pid ? ' [' + pid + ']' : ''), rootAcad);
      projFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var approvedFolder = getOrCreate('เอกสารอนุมัติ', projFolder);
      approvedFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return respond({
        success:           true,
        projectFolderId:   projFolder.getId(),
        projectFolderUrl:  projFolder.getUrl(),
        approvedFolderId:  approvedFolder.getId(),
        approvedFolderUrl: approvedFolder.getUrl()
      });
    }

    // action: 'renameFolder' → เปลี่ยนชื่อโฟลเดอร์
    if (action === 'renameFolder') {
      var folderId = p.folderId || '';
      var newName  = p.newName  || '';
      if (!folderId) return respond({ success:false, error:'ไม่มี folderId' });
      DriveApp.getFolderById(folderId).setName(newName);
      return respond({ success:true });
    }

    // action: 'deleteFile' → ย้ายไฟล์ไปถังขยะ
    if (action === 'deleteFile') {
      var fileId = p.fileId || '';
      if (!fileId) return respond({ success:false, error:'ไม่มี fileId' });
      DriveApp.getFileById(fileId).setTrashed(true);
      return respond({ success:true });
    }

    // action: 'getOrCreateSubfolder' → get หรือ create subfolder ภายใน parentFolderId
    if (action === 'getOrCreateSubfolder') {
      var parentId    = p.parentId    || '';
      var folderName  = p.folderName  || 'คำสั่งแต่งตั้ง';
      if (!parentId) return respond({ success:false, error:'ไม่มี parentId' });
      var parent    = DriveApp.getFolderById(parentId);
      var sub       = getOrCreate(folderName, parent);
      sub.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return respond({ success:true, folderId: sub.getId(), folderUrl: sub.getUrl() });
    }

    return respond({ status:'CPE Upload API running' });
  } catch(err) {
    return respond({ success:false, error:err.toString() });
  }
}

/* ─── Log submission to Google Sheet ─── */
function logToSheet(data) {
  try {
    var ss = getOrCreateSheet();
    var sheet;

    if (data.type === 'renewal') {
      sheet = getOrCreateTab(ss, 'ต่ออายุ CPE',
        ['วันที่-เวลา','หน่วยงาน','หนังสือขอต่ออายุ (URL)','แบบ สภ.59 (URL)','หลักฐานชำระ (URL)','สถานะ']);
      sheet.appendRow([
        formatDate(data.submittedAt),
        data.orgName   || '',
        data.letterUrl || '',
        data.form59Url || '',
        data.paymentUrl|| '',
        data.status    || 'รอตรวจสอบ'
      ]);
    } else if (data.type === 'conference') {
      var confHdrs = [
        'วันที่-เวลาที่ส่ง','ผู้ส่ง','หน่วยงาน','ชื่อประชุม',
        'วันที่เริ่มงาน','วันที่สิ้นสุดงาน','สถานที่','หมายเหตุ',
        'รายละเอียดโครงการ','CV วิทยากร','กำหนดการ',
        'มติ CPE (PDF)','มติ CPE (Word)',
        'จำนวนผู้ทรงคุณวุฒิ','อีเมลผู้ทรงคุณวุฒิ','วันที่ส่งผู้ทรง',
        'สถานะ','รหัสประชุม','ผลการพิจารณา (PDF)','วันที่ยืนยันผล'
      ];
      sheet = getOrCreateTab(ss, 'ประชุมวิชาการ', confHdrs);
      // อัพเดต header ทุกครั้ง
      for (var ch = 0; ch < confHdrs.length; ch++) {
        sheet.getRange(1, ch + 1).setValue(confHdrs[ch]).setFontWeight('bold').setBackground('#d0e4f7');
      }
      // ลบ column ที่เกิน (ถ้ามี)
      if (sheet.getLastColumn() > confHdrs.length) {
        sheet.deleteColumns(confHdrs.length + 1, sheet.getLastColumn() - confHdrs.length);
      }
      sheet.appendRow([
        formatDate(data.submittedAt),   // 1 วันที่-เวลา
        data.submittedBy  || '',        // 2 ผู้ส่ง
        data.orgName      || '',        // 3 หน่วยงาน
        data.confName     || '',        // 4 ชื่อประชุม
        data.dateStart    || '',        // 5 วันที่เริ่มงาน
        data.dateEnd      || '',        // 6 วันที่สิ้นสุดงาน
        data.location     || '',        // 7 สถานที่
        data.note         || '',        // 8 หมายเหตุ
        data.projectUrl   || '',        // 9 รายละเอียดโครงการ
        data.cvfileUrl    || '',        // 10 CV วิทยากร
        data.scheduleUrl  || '',        // 11 กำหนดการ
        '',                             // 12 มติ CPE PDF
        '',                             // 13 มติ CPE Word
        '',                             // 14 จำนวนผู้ทรงคุณวุฒิ
        '',                             // 15 อีเมลผู้ทรงคุณวุฒิ
        '',                             // 16 วันที่ส่งผู้ทรง
        'รอพิจารณา',                   // 17 สถานะ
        data.confId       || '',        // 18 รหัสประชุม
        '',                             // 19 ผลการพิจารณา (Word)
        ''                              // 20 วันที่ยืนยันผล
      ]);
    } else if (data.type === 'org_register') {
      sheet = getOrCreateTab(ss, 'ลงทะเบียนหน่วยงาน',
        ['วันที่ยื่น','ผู้ยื่น','ชื่อหน่วยงาน','ที่อยู่','โทรศัพท์','โทรสาร','อีเมล','เว็บไซต์',
         'หัวหน้าหน่วยกิต','ตำแหน่ง','สถานะ','รหัสหน่วยงาน','วันที่ผ่านการรับรอง','วันหมดอายุ','วันที่อนุมัติ','ผู้อนุมัติ']);
      sheet.appendRow([
        formatDate(data.submittedAt),
        data.submittedBy  || '',
        data.orgName      || '',
        data.address      || '',
        data.phone        || '',
        data.fax          || '',
        data.email        || '',
        data.website      || '',
        data.headName     || '',
        data.headPosition || '',
        data.status       || 'รอตรวจสอบ',
        '', '', '', '', ''
      ]);

    } else if (data.type === 'org_register_approved') {
      // ค้นหาแถวของหน่วยงานใน Sheet แล้วอัพเดตข้อมูลการอนุมัติ
      sheet = getOrCreateTab(ss, 'ลงทะเบียนหน่วยงาน',
        ['วันที่ยื่น','ผู้ยื่น','ชื่อหน่วยงาน','ที่อยู่','โทรศัพท์','โทรสาร','อีเมล','เว็บไซต์',
         'หัวหน้าหน่วยกิต','ตำแหน่ง','สถานะ','รหัสหน่วยงาน','วันที่ผ่านการรับรอง','วันหมดอายุ','วันที่อนุมัติ','ผู้อนุมัติ']);
      // เติม header คอลัมน์ที่อาจยังไม่มี (กรณี Sheet เก่า)
      var hdrRange = sheet.getRange(1, 1, 1, 16).getValues()[0];
      var extraHdrs = ['รหัสหน่วยงาน','วันที่ผ่านการรับรอง','วันหมดอายุ','วันที่อนุมัติ','ผู้อนุมัติ'];
      for (var h = 0; h < extraHdrs.length; h++) {
        if (!hdrRange[11 + h]) {
          sheet.getRange(1, 12 + h).setValue(extraHdrs[h]).setFontWeight('bold').setBackground('#d0e4f7');
        }
      }
      // ค้นหาแถวที่ตรงกับชื่อหน่วยงาน แล้วอัพเดต
      var lastRow = sheet.getLastRow();
      var found   = false;
      for (var i = 2; i <= lastRow; i++) {
        if (sheet.getRange(i, 3).getValue() === (data.orgName || '')) {
          sheet.getRange(i, 11).setValue('อนุมัติแล้ว');
          sheet.getRange(i, 12).setValue(data.orgCode        || '');
          sheet.getRange(i, 13).setValue(data.registrationDate|| '');
          sheet.getRange(i, 14).setValue(data.expiryDate     || '');
          sheet.getRange(i, 15).setValue(formatDate(data.approvedAt));
          sheet.getRange(i, 16).setValue(data.approvedBy     || '');
          found = true;
          break;
        }
      }
      if (!found) {
        // ถ้าหาไม่เจอ (เช่น submit ก่อน deploy ใหม่) ให้ append แถวใหม่แทน
        sheet.appendRow([
          formatDate(data.approvedAt), data.submittedBy||'', data.orgName||'',
          '','','','','','','','อนุมัติแล้ว',
          data.orgCode||'', data.registrationDate||'', data.expiryDate||'',
          formatDate(data.approvedAt), data.approvedBy||''
        ]);
      }

    } else if (data.type === 'academic') {
      sheet = getOrCreateTab(ss, 'โครงการบริการวิชาการ',
        ['วันที่บันทึก','ผู้บันทึก','ชื่อโครงการ','หน่วยงาน','ผู้รับผิดชอบ','ผู้ประสานงาน',
         'สถานที่','วันเริ่ม','วันสิ้นสุด','งบประมาณรวม (บาท)','แหล่งงบ',
         'รายรับรวม (บาท)','รายรับสุทธิ',
         'SDGs','ยุทธศาสตร์ มบ.','ยุทธศาสตร์ ม.','EdPEx',
         'วัตถุประสงค์','กลุ่มเป้าหมาย',
         'ผลที่คาดว่าจะได้รับ','KPI เชิงปริมาณ','KPI เชิงคุณภาพ','ปีแผน','รหัสโครงการ']);
      var acadRowData = [
        formatDate(data.savedAt),
        data.ownerEmail   || '',
        data.projectName  || '',
        data.dept         || '',
        data.sig1Name     || '',
        data.coordinators || '',
        data.location     || '',
        data.startDate    || '',
        data.endDate      || '',
        data.budgetTotal  || '',
        data.budgetSource || '',
        data.incomeTotal  || '',
        data.incomeNetText|| '',
        data.sdgs         || '',
        data.buuStrategies|| '',
        data.mStrategies  || '',
        data.edpex        || '',
        data.objectives   || '',
        data.targets      || '',
        data.results      || '',
        data.kpiQty       || '',
        data.kpiQual      || '',
        data.planYear     || '',
        data.projectId    || ''
      ];
      var acadProjectId = data.projectId || '';
      var acadEmail     = data.ownerEmail || '';
      var acadName      = data.projectName || '';
      var acadFound     = -1;

      var acadLastRow = sheet.getLastRow();
      if (acadLastRow >= 2) {
        // อ่านทั้ง sheet ครั้งเดียว (เร็วกว่า cell-by-cell)
        var acadAllVals = sheet.getRange(2, 1, acadLastRow - 1, 24).getValues();
        for (var ai = 0; ai < acadAllVals.length; ai++) {
          var rowId    = String(acadAllVals[ai][23] || ''); // col 24 = รหัสโครงการ
          var rowEmail = String(acadAllVals[ai][1]  || ''); // col 2  = ownerEmail
          var rowName  = String(acadAllVals[ai][2]  || ''); // col 3  = projectName
          // 1) ค้นหาด้วย projectId ก่อน (แม่นยำที่สุด)
          if (acadProjectId && rowId === acadProjectId) {
            acadFound = ai + 2; break;
          }
          // 2) fallback: email + ชื่อโครงการ (ใช้กับ row เก่าที่ยังไม่มี projectId)
          if (!acadProjectId && acadEmail && acadName &&
              rowEmail === acadEmail && rowName === acadName) {
            acadFound = ai + 2; break;
          }
        }
        // 3) fallback เสมอ: ถ้าไม่เจอด้วย projectId ให้ลองค้นด้วย email+name อีกรอบ
        if (acadFound < 0 && acadEmail && acadName) {
          for (var ai2 = 0; ai2 < acadAllVals.length; ai2++) {
            var r2Email = String(acadAllVals[ai2][1] || '');
            var r2Name  = String(acadAllVals[ai2][2] || '');
            if (r2Email === acadEmail && r2Name === acadName) {
              acadFound = ai2 + 2; break;
            }
          }
        }
      }

      if (acadFound > 0) {
        // อัปเดตแถวเดิม
        sheet.getRange(acadFound, 1, 1, acadRowData.length).setValues([acadRowData]);
      } else {
        // เพิ่มแถวใหม่
        sheet.appendRow(acadRowData);
      }
    }

    // ── แจ้งเตือน admin ทางอีเมล ──
    sendAdminEmail(data);

    return respond({ success:true });
  } catch(err) {
    return respond({ success:false, error:err.toString() });
  }
}

/* ─── Email notification ─── */
var ADMIN_EMAIL = 'thiraphong.ge@go.buu.ac.th';

function sendAdminEmail(data) {
  try {
    var formType, subject, body;
    var now = formatDate(data.submittedAt || data.savedAt);

    if (data.type === 'renewal') {
      formType = 'ต่ออายุ CPE';
      subject  = '[แจ้งเตือน] มีการส่งเอกสารต่ออายุ CPE — ' + (data.orgName || '');
      body     = 'มีการส่งเอกสารใหม่เข้ามาในระบบ\n\n'
               + 'ประเภทฟอร์ม : ' + formType + '\n'
               + 'หน่วยงาน   : ' + (data.orgName || '-') + '\n'
               + 'วันที่-เวลา : ' + now + '\n'
               + 'สถานะ      : ' + (data.status || 'รอตรวจสอบ') + '\n\n'
               + 'กรุณาตรวจสอบในระบบหรือ Google Sheet: "ข้อมูลโครงการบริการวิชาการและ CPE" → tab ต่ออายุ CPE';

    } else if (data.type === 'conference') {
      formType = 'ประชุมวิชาการ';
      subject  = '[แจ้งเตือน] มีการส่งข้อมูลประชุมวิชาการ — ' + (data.confName || '');
      body     = 'มีการส่งข้อมูลประชุมวิชาการใหม่เข้ามาในระบบ\n\n'
               + 'ประเภทฟอร์ม : ' + formType + '\n'
               + 'หน่วยงาน   : ' + (data.orgName || '-') + '\n'
               + 'ชื่อประชุม  : ' + (data.confName || '-') + '\n'
               + 'วันที่-เวลา : ' + now + '\n\n'
               + 'กรุณาตรวจสอบในระบบหรือ Google Sheet: "ข้อมูลโครงการบริการวิชาการและ CPE" → tab ประชุมวิชาการ';

    } else if (data.type === 'academic') {
      formType = 'แบบฟอร์มโครงการบริการวิชาการ';
      subject  = '[แจ้งเตือน] มีการบันทึกโครงการบริการวิชาการ — ' + (data.projectName || '');
      body     = 'มีการบันทึกโครงการบริการวิชาการใหม่เข้ามาในระบบ\n\n'
               + 'ประเภทฟอร์ม   : ' + formType + '\n'
               + 'ชื่อโครงการ   : ' + (data.projectName || '-') + '\n'
               + 'หน่วยงาน     : ' + (data.dept || '-') + '\n'
               + 'ผู้รับผิดชอบ  : ' + (data.sig1Name || '-') + '\n'
               + 'ผู้บันทึก     : ' + (data.ownerEmail || '-') + '\n'
               + 'วันที่-เวลา   : ' + now + '\n\n'
               + 'กรุณาตรวจสอบในระบบหรือ Google Sheet: "ข้อมูลโครงการบริการวิชาการและ CPE" → tab โครงการบริการวิชาการ';
    } else if (data.type === 'org_register') {
      formType = 'ลงทะเบียนหน่วยงาน CPE';
      subject  = '[แจ้งเตือน] มีคำขอลงทะเบียนหน่วยงานใหม่ — ' + (data.orgName || '');
      body     = 'มีคำขอลงทะเบียนหน่วยงานใหม่เข้ามาในระบบ\n\n'
               + 'ประเภท         : ' + formType + '\n'
               + 'ชื่อหน่วยงาน   : ' + (data.orgName || '-') + '\n'
               + 'ที่อยู่         : ' + (data.address || '-') + '\n'
               + 'โทรศัพท์       : ' + (data.phone || '-') + '\n'
               + 'อีเมล          : ' + (data.email || '-') + '\n'
               + 'เว็บไซต์       : ' + (data.website || '-') + '\n'
               + 'ผู้ยื่นคำขอ    : ' + (data.submittedBy || '-') + '\n'
               + 'วันที่-เวลา    : ' + now + '\n'
               + 'สถานะ          : ' + (data.status || 'รอตรวจสอบ') + '\n\n'
               + 'กรุณาเข้าระบบ CPE เพื่ออนุมัติหรือปฏิเสธคำขอในส่วน "เพิ่ม/จัดการหน่วยงาน (Admin)"';
    } else if (data.type === 'appt_order') {
      formType = 'คำสั่งแต่งตั้ง';
      subject  = '[แจ้งเตือน] มีการบันทึกคำสั่งแต่งตั้ง — ' + (data.projectName || data.pid || '');
      body     = 'มีการบันทึกคำสั่งแต่งตั้งใหม่เข้ามาในระบบ\n\n'
               + 'ประเภทฟอร์ม   : ' + formType + '\n'
               + 'ชื่อโครงการ   : ' + (data.projectName || '-') + '\n'
               + 'รหัสโครงการ   : ' + (data.pid || '-') + '\n'
               + 'คำสั่งที่      : ' + (data.orderNumber || '-') + '\n'
               + 'ปีการศึกษา    : ' + (data.academicYear || '-') + '\n'
               + 'ชื่อคณะกรรมการ: ' + (data.committeeTitle || '-') + '\n'
               + 'ผู้ลงนาม      : ' + (data.signerName || '-') + '\n'
               + 'ผู้บันทึก     : ' + (data.email || '-') + '\n'
               + 'URL PDF       : ' + (data.pdfUrl || '-') + '\n\n'
               + 'กรุณาตรวจสอบในระบบหรือ Google Sheet: "ข้อมูลโครงการบริการวิชาการและ CPE" → tab คำสั่งแต่งตั้ง';

    } else if (data.type === 'payment') {
      formType = 'ค่าธรรมเนียมการจัดประชุมวิชาการ';
      subject  = '[แจ้งเตือน] มีการชำระค่าธรรมเนียมประชุมวิชาการ — ' + (data.confName || '');
      body     = 'มีการส่งหลักฐานการชำระค่าธรรมเนียมใหม่เข้ามาในระบบ\n\n'
               + 'ประชุมวิชาการ       : ' + (data.confName || '-') + '\n'
               + 'ผู้ชำระ            : ' + (data.payerName || '-') + '\n'
               + 'เลขผู้เสียภาษี     : ' + (data.taxId || '-') + '\n'
               + 'จำนวนเงิน          : ' + (data.amount || '-') + ' บาท\n'
               + 'อีเมลผู้ชำระ       : ' + (data.email || '-') + '\n'
               + 'URL หลักฐาน        : ' + (data.receiptUrl || '-') + '\n\n'
               + 'กรุณาตรวจสอบในระบบหรือ Google Sheet: "ข้อมูลโครงการบริการวิชาการและ CPE" → tab ค่าธรรมเนียม';
    } else if (data.type === 'org_register_approved') {
      return; // admin เป็นคนทำเอง ไม่ต้องส่งอีเมลซ้ำ
    } else {
      return; // ไม่ส่งถ้าประเภทไม่รู้จัก
    }

    MailApp.sendEmail(ADMIN_EMAIL, subject, body);
  } catch(e) {
    Logger.log('[sendAdminEmail] error: ' + e.toString());
  }
}

/* ─── Test email (รันด้วยมือใน Apps Script editor เพื่อ authorize MailApp) ─── */
function testSendAdminEmail() {
  MailApp.sendEmail(
    ADMIN_EMAIL,
    '[CPE] ทดสอบการแจ้งเตือน',
    'ถ้าเห็นอีเมลนี้แสดงว่า MailApp ทำงานได้ปกติ'
  );
  Logger.log('Test email sent to ' + ADMIN_EMAIL);
}

/* ─── Update conference row by confId ─── */
// คอลัมน์ใน tab ประชุมวิชาการ (18 คอลัมน์):
//  1 วันที่-เวลาที่ส่ง  2 ผู้ส่ง  3 หน่วยงาน  4 ชื่อประชุม
//  5 วันที่เริ่มงาน  6 วันที่สิ้นสุดงาน  7 สถานที่  8 หมายเหตุ
//  9 รายละเอียดโครงการ  10 CV วิทยากร  11 กำหนดการ
//  12 มติ CPE (PDF)  13 มติ CPE (Word)
//  14 จำนวนผู้ทรงคุณวุฒิ  15 อีเมลผู้ทรงคุณวุฒิ  16 วันที่ส่งผู้ทรง
//  17 สถานะ  18 รหัสประชุม
function updateConferenceRow(data) {
  var ss    = getOrCreateSheet();
  var sheet = ss.getSheetByName('ประชุมวิชาการ');
  if (!sheet) return respond({ success: false, error: 'ไม่พบ tab ประชุมวิชาการ' });

  var confId = data.confId || '';
  if (!confId) return respond({ success: false, error: 'ไม่มี confId' });

  // ค้นหา row ที่มี confId ใน column 18
  var lastRow = sheet.getLastRow();
  var found   = -1;
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r, 18).getValue() === confId) { found = r; break; }
  }
  if (found < 0) return respond({ success: false, error: 'ไม่พบ row confId: ' + confId });

  // อัพเดตเฉพาะ field ที่ส่งมา
  if (data.matiPdfUrl    !== undefined) sheet.getRange(found, 12).setValue(data.matiPdfUrl    || '');
  if (data.matiWordUrl   !== undefined) sheet.getRange(found, 13).setValue(data.matiWordUrl   || '');
  if (data.expertEmails  !== undefined) {
    var emails = data.expertEmails || [];
    sheet.getRange(found, 14).setValue(emails.length);
    sheet.getRange(found, 15).setValue(emails.join(', '));
  }
  if (data.sentAt        !== undefined) sheet.getRange(found, 16).setValue(data.sentAt        ? formatDate(data.sentAt) : '');
  if (data.status        !== undefined) sheet.getRange(found, 17).setValue(data.status        || '');
  if (data.resultPdfUrl  !== undefined) sheet.getRange(found, 19).setValue(data.resultPdfUrl  || '');
  if (data.confirmedAt   !== undefined) sheet.getRange(found, 20).setValue(data.confirmedAt   ? formatDate(data.confirmedAt) : '');

  return respond({ success: true });
}

/* ─── Notify user: CPE result confirmed ─── */
function notifyCpeResult(data) {
  var userEmail = data.userEmail || '';
  if (!userEmail || userEmail.indexOf('@') < 0) {
    return respond({ success: false, error: 'ไม่มีอีเมล user' });
  }

  var confName  = data.confName  || 'ประชุมวิชาการ';
  var orgName   = data.orgName   || '';
  var dateRange = data.dateStart || '-';
  if (data.dateEnd && data.dateEnd !== data.dateStart) dateRange += ' – ' + data.dateEnd;

  var subject = '[CPE] ผลการพิจารณารับรองหน่วยกิต CPE: ' + confName;

  var html = '<div style="font-family:\'Sarabun\',sans-serif;max-width:600px;margin:0 auto;color:#1a202c">';
  html += '<div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 28px;border-radius:12px 12px 0 0">';
  html += '<div style="color:#fff;font-size:1.2rem;font-weight:700">✅ ผลการพิจารณารับรองหน่วยกิต CPE</div>';
  html += '<div style="color:rgba(255,255,255,.8);font-size:.85rem;margin-top:4px">คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา</div>';
  html += '</div>';
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px">';
  html += '<p>เรียน ผู้ส่งคำขอพิจารณาหน่วยกิต CPE</p>';
  html += '<p>คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา ได้พิจารณาผลการรับรองหน่วยกิต CPE สำหรับงานประชุมวิชาการดังต่อไปนี้เรียบร้อยแล้ว</p>';
  html += '<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f0fdf4;border-radius:8px;overflow:hidden">';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;width:160px;border-bottom:1px solid #d1fae5">ชื่องานประชุม</td><td style="padding:9px 14px;font-size:.88rem;font-weight:700;border-bottom:1px solid #d1fae5">' + confName + '</td></tr>';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;border-bottom:1px solid #d1fae5">หน่วยงาน</td><td style="padding:9px 14px;font-size:.88rem;border-bottom:1px solid #d1fae5">' + orgName + '</td></tr>';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280">วันที่จัด</td><td style="padding:9px 14px;font-size:.88rem">' + dateRange + '</td></tr>';
  html += '</table>';

  if (data.resultPdfUrl) {
    html += '<table style="width:100%;border-collapse:collapse;margin:20px 0">';
    html += '<tr><td colspan="2" style="padding:10px 0 8px;font-size:.88rem;font-weight:700;color:#1a202c;border-bottom:2px solid #059669">ผลการพิจารณา</td></tr>';
    html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;width:290px;border-bottom:1px solid #e5e7eb">เอกสารผลการพิจารณารับรองหน่วยกิต CPE</td>';
    html += '<td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.resultPdfUrl + '" style="color:#4f46e5;font-weight:700">ดาวน์โหลดเอกสาร</a></td></tr>';
    html += '</table>';
  }

  html += '<p style="font-size:.85rem;color:#6b7280;margin-top:20px">หากมีข้อสงสัยกรุณาติดต่อ คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา</p>';
  html += '</div></div>';

  try {
    MailApp.sendEmail({ to: userEmail, subject: subject, htmlBody: html });
  } catch(e) { /* ไม่ให้ email error กระทบ main flow */ }

  // อัพเดต Sheet
  updateConferenceRow({
    confId:        data.confId        || '',
    resultPdfUrl: data.resultPdfUrl || '',
    confirmedAt:   data.confirmedAt,
    status:        'ยืนยันผลแล้ว'
  });

  return respond({ success: true });
}

/* ─── Send expert email ─── */
function sendExpertEmail(data) {
  var expertEmails = data.expertEmails || [];
  if (expertEmails.length === 0) {
    return respond({ success: false, error: 'ไม่มีอีเมลผู้ทรงคุณวุฒิ' });
  }

  var dateRange = data.dateStart || '-';
  if (data.dateEnd && data.dateEnd !== data.dateStart) dateRange += ' – ' + data.dateEnd;

  var sendTimeStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
  var subject = '[CPE] ขอเรียนเชิญพิจารณาหน่วยกิต CPE: ' + (data.confName || 'ประชุมวิชาการ') + ' (' + sendTimeStr + ')';

  var html = '<div style="font-family:\'Sarabun\',sans-serif;max-width:600px;margin:0 auto;color:#1a202c">';
  html += '<div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 28px;border-radius:12px 12px 0 0">';
  html += '<div style="color:#fff;font-size:1.2rem;font-weight:700">🎓 คำขอพิจารณาหน่วยกิต CPE</div>';
  html += '<div style="color:rgba(255,255,255,.8);font-size:.85rem;margin-top:4px">คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา</div>';
  html += '</div>';
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px">';
  html += '<p>เรียน ผู้ทรงคุณวุฒิ</p>';
  html += '<p>ขอความอนุเคราะห์ผู้ทรงคุณวุฒิพิจารณาหน่วยกิต CPE สำหรับงานประชุมวิชาการดังต่อไปนี้</p>';

  html += '<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden">';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;width:130px;border-bottom:1px solid #e5e7eb">ชื่องานประชุม</td><td style="padding:9px 14px;font-size:.88rem;font-weight:700;border-bottom:1px solid #e5e7eb">' + (data.confName || '-') + '</td></tr>';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;border-bottom:1px solid #e5e7eb">หน่วยงาน</td><td style="padding:9px 14px;font-size:.88rem;border-bottom:1px solid #e5e7eb">' + (data.orgName || '-') + '</td></tr>';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;border-bottom:1px solid #e5e7eb">วันที่จัด</td><td style="padding:9px 14px;font-size:.88rem;border-bottom:1px solid #e5e7eb">' + dateRange + '</td></tr>';
  if (data.location) html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;border-bottom:1px solid #e5e7eb">สถานที่</td><td style="padding:9px 14px;font-size:.88rem;border-bottom:1px solid #e5e7eb">' + data.location + '</td></tr>';
  html += '</table>';

  // ─── กลุ่ม 1: เอกสารแนบ ───
  html += '<table style="width:100%;border-collapse:collapse;margin:20px 0 0">';
  html += '<tr><td colspan="2" style="padding:10px 0 8px;font-size:.88rem;font-weight:700;color:#1a202c;border-bottom:2px solid #4f46e5">เอกสารแนบ</td></tr>';
  if (data.projectUrl)  html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;width:290px;border-bottom:1px solid #e5e7eb">รายละเอียดโครงการ</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.projectUrl  + '" style="color:#4f46e5;font-weight:700">เปิดเอกสาร</a></td></tr>';
  if (data.cvfileUrl)   html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;border-bottom:1px solid #e5e7eb">CV วิทยากร</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.cvfileUrl   + '" style="color:#4f46e5;font-weight:700">เปิดเอกสาร</a></td></tr>';
  if (data.scheduleUrl) html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;border-bottom:1px solid #e5e7eb">กำหนดการ</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.scheduleUrl + '" style="color:#4f46e5;font-weight:700">เปิดเอกสาร</a></td></tr>';
  html += '</table>';
  // ─── กลุ่ม 2: มติ CPE (แยกออกมา) ───
  if (data.matiPdfUrl || data.matiWordUrl) {
    html += '<table style="width:100%;border-collapse:collapse;margin:0 0 20px">';
    html += '<tr><td colspan="2" style="padding:16px 0 8px;font-size:.88rem;font-weight:700;color:#1a202c;border-bottom:2px solid #0891b2">มติผลการพิจารณารับรอง CPE</td></tr>';
    if (data.matiPdfUrl)  html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;width:290px;border-bottom:1px solid #e5e7eb">มติผลการพิจารณารับรอง CPE (PDF)</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.matiPdfUrl  + '" style="color:#4f46e5;font-weight:700">เปิดเอกสาร</a></td></tr>';
    if (data.matiWordUrl) html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;width:290px;border-bottom:1px solid #e5e7eb">มติผลการพิจารณารับรอง CPE (Word)</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.matiWordUrl + '" style="color:#4f46e5;font-weight:700">เปิดเอกสาร</a></td></tr>';
    html += '</table>';
  }
  html += '</div></div>';

  var sent = 0;
  var errors = [];
  expertEmails.forEach(function(email) {
    email = (email || '').trim();
    if (email && email.indexOf('@') > 0) {
      try {
        MailApp.sendEmail({
          to: email,
          subject: subject,
          htmlBody: html,
          name: 'ระบบ CPE คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา'
        });
        sent++;
      } catch(mailErr) {
        errors.push(email + ': ' + mailErr.message);
      }
    }
  });

  if (errors.length > 0) {
    return respond({ success: false, sent: sent, error: errors.join('; ') });
  }
  return respond({ success: true, sent: sent });
}

/* ─── Send expert email: บทความวิชาการ ─── */
function sendArticleExpertEmail(data) {
  var expertEmails = data.expertEmails || [];
  if (expertEmails.length === 0) {
    return respond({ success: false, error: 'ไม่มีอีเมลผู้ทรงคุณวุฒิ' });
  }

  var sendTimeStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
  var subject = '[CPE] ขอเรียนเชิญพิจารณาบทความวิชาการ: ' + (data.userName || 'ผู้ส่งบทความ') + ' (' + sendTimeStr + ')';

  var html = '<div style="font-family:\'Sarabun\',sans-serif;max-width:600px;margin:0 auto;color:#1a202c">';
  html += '<div style="background:linear-gradient(135deg,#6d28d9,#7c3aed);padding:24px 28px;border-radius:12px 12px 0 0">';
  html += '<div style="color:#fff;font-size:1.2rem;font-weight:700">📝 ขอเรียนเชิญพิจารณาบทความวิชาการ</div>';
  html += '<div style="color:rgba(255,255,255,.8);font-size:.85rem;margin-top:4px">คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา</div>';
  html += '</div>';
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px">';
  html += '<p>เรียน ผู้ทรงคุณวุฒิ</p>';
  html += '<p>ขอความอนุเคราะห์ผู้ทรงคุณวุฒิพิจารณาบทความวิชาการที่ส่งเข้ามาในระบบ CPE ดังนี้</p>';

  html += '<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden">';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;width:130px;border-bottom:1px solid #e5e7eb">ผู้เขียนบทความ</td><td style="padding:9px 14px;font-size:.88rem;font-weight:700;border-bottom:1px solid #e5e7eb">' + (data.userName || '-') + '</td></tr>';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280;border-bottom:1px solid #e5e7eb">อีเมลผู้เขียน</td><td style="padding:9px 14px;font-size:.88rem;border-bottom:1px solid #e5e7eb">' + (data.userEmail || '-') + '</td></tr>';
  html += '<tr><td style="padding:9px 14px;font-size:.82rem;color:#6b7280">วันที่ส่ง</td><td style="padding:9px 14px;font-size:.88rem">' + sendTimeStr + '</td></tr>';
  html += '</table>';

  html += '<table style="width:100%;border-collapse:collapse;margin:20px 0">';
  html += '<tr><td colspan="2" style="padding:10px 0 8px;font-size:.88rem;font-weight:700;color:#1a202c;border-bottom:2px solid #6d28d9">เอกสารแนบ</td></tr>';
  if (data.formattedDocUrl) {
    html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;width:250px;border-bottom:1px solid #e5e7eb">บทความที่จัดรูปแบบแล้ว</td>';
    html += '<td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.formattedDocUrl + '" style="color:#6d28d9;font-weight:700">เปิดเอกสาร</a></td></tr>';
  }
  if (data.adminDocPdfUrl) {
    html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;border-bottom:1px solid #e5e7eb">เอกสาร Admin (PDF)</td>';
    html += '<td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.adminDocPdfUrl + '" style="color:#6d28d9;font-weight:700">เปิดเอกสาร</a></td></tr>';
  }
  if (data.adminDocWordUrl) {
    html += '<tr><td style="padding:10px 14px 10px 0;font-size:.85rem;color:#374151;border-bottom:1px solid #e5e7eb">เอกสาร Admin (Word)</td>';
    html += '<td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a href="' + data.adminDocWordUrl + '" style="color:#6d28d9;font-weight:700">เปิดเอกสาร</a></td></tr>';
  }
  html += '</table>';

  html += '<p style="font-size:.85rem;color:#6b7280;margin-top:20px">หากมีข้อสงสัยกรุณาติดต่อ คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา</p>';
  html += '</div></div>';

  var sent = 0;
  var errors = [];
  expertEmails.forEach(function(email) {
    email = (email || '').trim();
    if (email && email.indexOf('@') > 0) {
      try {
        MailApp.sendEmail({
          to: email,
          subject: subject,
          htmlBody: html,
          name: 'ระบบ CPE คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา'
        });
        sent++;
      } catch(mailErr) {
        errors.push(email + ': ' + mailErr.message);
      }
    }
  });

  if (errors.length > 0) {
    return respond({ success: false, sent: sent, error: errors.join('; ') });
  }
  return respond({ success: true, sent: sent });
}

/* ─── Log appointment order to Sheet ─── */
function logApptToSheet(data) {
  try {
    var ss = getOrCreateSheet();
    var headers = [
      'timestamp','รหัสโครงการ','ชื่อโครงการ','อีเมลผู้บันทึก',
      'คำสั่งที่','ปีการศึกษา','ชื่อคณะกรรมการ','คำปรารภ',
      'วันที่ออกคำสั่ง','ผู้ลงนาม','ตำแหน่งผู้ลงนาม',
      'ตำแหน่งบรรจัดที่1','ตำแหน่งบรรจัดที่2','ตำแหน่งบรรจัดที่3',
      'ชื่อผู้รับสำเนา','ตำแหน่งผู้รับสำเนา',
      'จำนวนที่ปรึกษา','รายชื่อที่ปรึกษา',
      'จำนวนหมวดคณะกรรมการ','จำนวนกรรมการรวม','รายชื่อกรรมการ',
      'URL PDF Drive','ID โฟลเดอร์โครงการ'
    ];
    var sheet = getOrCreateTab(ss, 'คำสั่งแต่งตั้ง', headers);

    // อัพเดต header แถวแรกเสมอ (กรณี tab มีอยู่แล้วแต่ยังขาด column)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
         .setFontWeight('bold').setBackground('#d0e4f7');

    // parse advisors / committees (ส่งมาเป็น JSON string)
    var advisors = [];
    var committees = [];
    try { advisors = JSON.parse(data.advisors || '[]'); } catch(e) { advisors = []; }
    try { committees = JSON.parse(data.committees || '[]'); } catch(e) { committees = []; }

    var advisorNames = advisors.map(function(a){ return a.name || ''; }).filter(Boolean).join(', ');

    var totalMembers = 0;
    var memberNames  = [];
    committees.forEach(function(c) {
      (c.members || []).forEach(function(m) {
        totalMembers++;
        if (m.name) memberNames.push(m.name + (m.role ? ' (' + m.role + ')' : ''));
      });
    });

    var pid = data.pid || '';
    var rowData = [
      formatDate(new Date().toISOString()),   // 1  timestamp
      pid,                                     // 2  รหัสโครงการ
      data.projectName   || '',                // 3  ชื่อโครงการ
      data.email         || '',                // 4  อีเมลผู้บันทึก
      data.orderNumber   || '',                // 5  คำสั่งที่
      data.academicYear  || '',                // 6  ปีการศึกษา
      data.committeeTitle|| '',                // 7  ชื่อคณะกรรมการ
      data.preamble      || '',                // 8  คำปรารภ
      data.orderDate     || '',                // 9  วันที่ออกคำสั่ง
      data.signerName    || '',                // 10 ผู้ลงนาม
      data.signerTitle   || '',                // 11 ตำแหน่งผู้ลงนาม
      data.signerPos1    || '',                // 12 ตำแหน่งบรรจัดที่1
      data.signerPos2    || '',                // 13 ตำแหน่งบรรจัดที่2
      data.signerPos3    || '',                // 14 ตำแหน่งบรรจัดที่3
      data.copyName      || '',                // 15 ชื่อผู้รับสำเนา
      data.copyPos       || '',                // 16 ตำแหน่งผู้รับสำเนา
      advisors.length,                         // 17 จำนวนที่ปรึกษา
      advisorNames,                            // 18 รายชื่อที่ปรึกษา
      committees.length,                       // 19 จำนวนหมวดคณะกรรมการ
      totalMembers,                            // 20 จำนวนกรรมการรวม
      memberNames.join(', '),                  // 21 รายชื่อกรรมการ
      data.pdfUrl        || '',                // 22 URL PDF Drive
      data.folderId      || ''                 // 23 ID โฟลเดอร์โครงการ
    ];

    // upsert ตาม pid (col 2)
    var existingRow = -1;
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2 && pid) {
      var pidVals = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (var i = 0; i < pidVals.length; i++) {
        if (String(pidVals[i][0] || '') === pid) { existingRow = i + 2; break; }
      }
    }

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    // แจ้งเตือน admin ทางอีเมล — เฉพาะเมื่อมี pdfUrl (Drive upload สำเร็จ)
    if (data.pdfUrl) {
      sendAdminEmail({ type:'appt_order', pid:pid,
        projectName:    data.projectName,
        orderNumber:    data.orderNumber,
        academicYear:   data.academicYear,
        committeeTitle: data.committeeTitle,
        signerName:     data.signerName,
        email:          data.email,
        pdfUrl:         data.pdfUrl });
    }

    return respond({ success: true });
  } catch(err) {
    return respond({ success: false, error: err.toString() });
  }
}

/* ─── Log payment to Sheet + upload receipt to Drive ─── */
function logPaymentToSheet(data) {
  try {
    // 1. อัพโหลดไฟล์หลักฐานเข้า Drive (ถ้ามี)
    var receiptUrl = data.receiptUrl || '';
    if (data.base64 && data.base64.length > 0) {
      var rootPay  = getOrCreate('ค่าธรรมเนียม CPE', null);
      var confName = (data.confName || 'ทั่วไป').replace(/[\/\\]/g, '-').substring(0, 60);
      var subFolder = getOrCreate(confName, rootPay);
      subFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var b64clean = data.base64.indexOf(',') >= 0 ? data.base64.split(',')[1] : data.base64;
      var bytes    = Utilities.base64Decode(b64clean);
      var filename = data.filename || ('หลักฐานชำระเงิน_' + new Date().getTime() + '.pdf');
      var blob     = Utilities.newBlob(bytes, 'application/pdf', filename);
      var file     = subFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      receiptUrl = file.getUrl();
    }

    // 2. บันทึกลง Sheet tab "ค่าธรรมเนียม"
    var ss = getOrCreateSheet();
    var headers = [
      'timestamp', 'อีเมลผู้ชำระ', 'confId', 'ชื่อประชุมวิชาการ',
      'เลขประจำตัวผู้เสียภาษี', 'ชื่อผู้ชำระ (พร้อมคำนำหน้า)', 'ที่อยู่',
      'จำนวนเงิน (บาท)', 'URL หลักฐานการชำระ Drive', 'สถานะ'
    ];
    var sheet = getOrCreateTab(ss, 'ค่าธรรมเนียม', headers);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    var now = new Date().toISOString();
    var rowData = [
      now,
      data.email       || '',
      data.confId      || '',
      data.confName    || '',
      data.taxId       || '',
      data.payerName   || '',
      data.address     || '',
      data.amount      || 0,
      receiptUrl,
      'รอตรวจสอบ'
    ];

    // upsert ตาม email + confId (col 2+3)
    var lastRow = sheet.getLastRow();
    var updated = false;
    if (lastRow > 1) {
      var vals = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (var i = 0; i < vals.length; i++) {
        if (vals[i][1] === (data.email || '') && vals[i][2] === (data.confId || '')) {
          sheet.getRange(i + 2, 1, 1, headers.length).setValues([rowData]);
          updated = true;
          break;
        }
      }
    }
    if (!updated) { sheet.appendRow(rowData); }

    // 3. แจ้ง admin
    sendAdminEmail({
      type: 'payment',
      confName:   data.confName,
      payerName:  data.payerName,
      taxId:      data.taxId,
      amount:     data.amount,
      email:      data.email,
      receiptUrl: receiptUrl
    });

    return respond({ success: true, receiptUrl: receiptUrl });
  } catch(err) {
    return respond({ success: false, error: err.toString() });
  }
}

/* ─── Admin confirm payment + upload receipt + notify user ─── */
function confirmPaymentAction(data) {
  try {
    // 1. อัพโหลด PDF บิลใบเสร็จไป Drive
    var adminReceiptUrl = '';
    if (data.base64 && data.base64.length > 0) {
      var rootPay   = getOrCreate('ค่าธรรมเนียม CPE', null);
      var confName  = (data.confName || 'ทั่วไป').replace(/[\/\\]/g, '-').substring(0, 60);
      var subFolder = getOrCreate(confName, rootPay);
      subFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var b64clean = data.base64.indexOf(',') >= 0 ? data.base64.split(',')[1] : data.base64;
      var bytes    = Utilities.base64Decode(b64clean);
      var filename = data.filename || ('ใบเสร็จ_' + new Date().getTime() + '.pdf');
      var blob     = Utilities.newBlob(bytes, 'application/pdf', filename);
      var file     = subFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      adminReceiptUrl = file.getUrl();
    }

    // 2. อัพเดต Sheet tab "ค่าธรรมเนียม" — เปลี่ยนสถานะ + เพิ่ม URL บิลใบเสร็จ
    var ss      = getOrCreateSheet();
    var sheet   = ss.getSheetByName('ค่าธรรมเนียม');
    if (sheet) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var vals = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
        for (var i = 0; i < vals.length; i++) {
          if (vals[i][2] === (data.cid || '')) {
            sheet.getRange(i + 2, 9).setValue(adminReceiptUrl); // col I = URL บิลใบเสร็จ admin
            sheet.getRange(i + 2, 10).setValue('ยืนยันแล้ว');  // col J = สถานะ
            break;
          }
        }
      }
    }

    // 3. ส่งอีเมลแจ้ง user
    var userEmail = data.userEmail || '';
    if (userEmail) {
      var subject = '[CPE] ชำระค่าธรรมเนียมการจัดประชุมวิชาการเรียบร้อยแล้ว — ' + (data.confName || '');
      var html = '<div style="font-family:sans-serif;max-width:520px">' +
        '<h2 style="color:#059669;margin-bottom:8px">✅ ชำระค่าธรรมเนียมการจัดประชุมเรียบร้อยแล้ว</h2>' +
        '<p style="color:#374151">เรียน คุณ' + (data.payerName || '') + '</p>' +
        '<p style="color:#374151">ระบบได้รับการชำระค่าธรรมเนียมการจัดประชุมวิชาการ <strong>' + (data.confName || '') + '</strong> เรียบร้อยแล้ว</p>' +
        '<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">' +
          '<tr><td style="padding:6px 12px;background:#f0fdf4;font-weight:700;width:140px">ชื่อประชุม</td>' +
              '<td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">' + (data.confName || '-') + '</td></tr>' +
          '<tr><td style="padding:6px 12px;background:#f0fdf4;font-weight:700">จำนวนเงิน</td>' +
              '<td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">' + (data.amount ? Number(data.amount).toLocaleString() : '-') + ' บาท</td></tr>' +
        '</table>' +
        (adminReceiptUrl
          ? '<p><a href="' + adminReceiptUrl + '" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700">📥 ดาวน์โหลดบิลใบเสร็จการชำระค่าธรรมเนียมการจัดประชุม</a></p>'
          : '') +
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">' +
        '<p style="font-size:12px;color:#9ca3af">ระบบ CPE คณะเภสัชศาสตร์ มหาวิทยาลัยบูรพา</p>' +
      '</div>';
      MailApp.sendEmail({ to: userEmail, subject: subject, htmlBody: html });
    }

    return respond({ success: true, adminReceiptUrl: adminReceiptUrl });
  } catch(err) {
    return respond({ success: false, error: err.toString() });
  }
}

/* ─── Sheet helpers ─── */
function getOrCreateSheet() {
  var files = DriveApp.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  var ss = SpreadsheetApp.create(SHEET_NAME);
  return ss;
}

function getOrCreateTab(ss, tabName, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#d0e4f7');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formatDate(iso) {
  if (!iso) return new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
  return new Date(iso).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
}

/* ─── Drive helpers ─── */
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
