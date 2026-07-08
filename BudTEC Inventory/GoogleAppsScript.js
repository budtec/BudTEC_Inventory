/**
 * BudTEC Inventory - Google Apps Script Backend (FIXED)
 * 
 * Paste this script into Extensions > Apps Script inside your Google Sheet.
 * Then click "Run" on setupDatabase to initialize all sheets and seed demo data.
 * Finally, Deploy as Web App (Web App, Execute as me, Who has access: Anyone).
 */

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const tables = {
    fundingSources: ['id', 'name'],
    categories: ['id', 'name'],
    locations: ['id', 'name'],
    vendors: ['id', 'companyName', 'repName', 'repNickname', 'phone', 'remarks'],
    users: ['id', 'name', 'username', 'password', 'email', 'phone', 'role', 'department', 'avatarUrl', 'approved'],
    equipment: ['id', 'assetNumber', 'name', 'price', 'vendorId', 'fiscalYear', 'fundingSourceId', 'categoryId', 'locationId', 'manualUrl', 'status', 'imageUrl'],
    transactions: ['id', 'equipmentId', 'userId', 'borrowDate', 'expectedReturnDate', 'actualReturnDate', 'purpose', 'notes', 'status'],
    maintenanceLogs: ['id', 'equipmentId', 'type', 'symptom', 'repairCompany', 'cost', 'entryDate', 'nextDueDate']
  };

  const defaultData = {
    fundingSources: [
      { id: 1, name: 'หมวดเงินอุดหนุนทั่วไป' },
      { id: 2, name: 'หมวดเงินงบ สบพช.' }
    ],
    categories: [
      { id: 1, name: 'อายุรกรรม' },
      { id: 2, name: 'กุมารเวชกรรม' },
      { id: 3, name: 'ศัลยกรรม' },
      { id: 4, name: 'สูติ-นรีเวชกรรม' },
      { id: 5, name: 'เวชศาสตร์ฉุกเฉิน/การช่วยชีวิตขั้นพื้นฐาน' },
      { id: 6, name: 'ออร์โธปิดิกส์' },
      { id: 7, name: 'จักษุวิทยา' },
      { id: 8, name: 'โสต ศอ นาสิก' },
      { id: 9, name: 'เวชศาสตร์ฟื้นฟู' },
      { id: 10, name: 'เซ็ตอุปกรณ์' },
      { id: 11, name: 'ศูนย์ BudTEC' }
    ],
    locations: [
      { id: 1, name: 'ศูนย์ BudTEC' },
      { id: 2, name: 'กลุ่มงานสูติ-นรีเวชกรรม' },
      { id: 3, name: 'กลุ่มงานเวชศาสตร์ฉุกเฉิน' },
      { id: 4, name: 'กลุ่มงานศัลยกรรม' }
    ],
    vendors: [
      { id: 1, companyName: 'บริษัท เมดิคอล ซัพพลาย จำกัด', repName: 'สมชาย รักดี', repNickname: 'ชาย', phone: '081-234-5678', remarks: 'จัดส่งสินค้ารวดเร็ว มีบริการหลังการขายดีเยี่ยม' },
      { id: 2, companyName: 'บริษัท สยามเฮลท์แคร์ กรุ๊ป', repName: 'วิภาดา รักดี', repNickname: 'ปลา', phone: '082-987-6543', remarks: 'ตัวแทนจำหน่ายอุปกรณ์ช่วยชีวิตขั้นพื้นฐาน' },
      { id: 3, companyName: 'บริษัท ไทย ไบโอเมดิคอล จำกัด', repName: 'กิตติศักดิ์ เจริญพร', repNickname: 'กิต', phone: '089-555-4433', remarks: 'ประกันอุปกรณ์ 2 ปีเต็ม' },
      { id: 4, companyName: 'บริษัท เมดเทค ดีไซน์ จำกัด', repName: 'นารี มีสุข', repNickname: 'แอน', phone: '086-111-2233', remarks: 'จำหน่ายหุ่นฝึกปฏิบัติการพยาบาล' }
    ],
    users: [
      { id: 1, name: 'ผู้จัดการระบบ บัดเทค (Admin)', username: 'admin', password: 'admin', email: 'admin@budtec.com', phone: '080-000-0001', role: 'admin', department: 'ศูนย์ BudTEC', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop', approved: true },
      { id: 2, name: 'นพ.ปรีชา เลิศวิไล', username: 'user', password: 'user', email: 'preecha@budtec.com', phone: '080-000-0002', role: 'user', department: 'กลุ่มงานเวชศาสตร์ฉุกเฉิน', avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop', approved: true },
      { id: 3, name: 'พญ.นลินี ศรีสุข', username: 'nalinee', password: 'user', email: 'nalinee@budtec.com', phone: '080-000-0003', role: 'user', department: 'กลุ่มงานสูติ-นรีเวชกรรม', avatarUrl: 'https://images.unsplash.com/photo-1594824813573-246434e33963?q=80&w=150&auto=format&fit=crop', approved: true },
      { id: 4, name: 'นพ.สมศักดิ์ รักชาติ', username: 'somsak', password: 'user', email: 'somsak@budtec.com', phone: '080-000-0004', role: 'user', department: 'กลุ่มงานศัลยกรรม', avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=150&auto=format&fit=crop', approved: true }
    ],
    equipment: [
      { id: 'BudTEC_0001', assetNumber: 'พศ.68-ออ-0001/4', name: 'หุ่นฝึกจำลองการคลอดบุตรขั้นสูง (Advanced Childbirth Simulator)', price: 250000, vendorId: 4, fiscalYear: 2568, fundingSourceId: 2, categoryId: 4, locationId: 2, manualUrl: '', status: 'พร้อมใช้งาน', imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=300&auto=format&fit=crop' },
      { id: 'BudTEC_0002', assetNumber: 'พศ.67-ฉฉ-0021/3', name: 'เครื่องจำลองการกระตุกหัวใจด้วยไฟฟ้าแบบอัตโนมัติ (AED Trainer v3)', price: 45000, vendorId: 2, fiscalYear: 2567, fundingSourceId: 1, categoryId: 5, locationId: 3, manualUrl: '', status: 'ถูกยืม', imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?q=80&w=300&auto=format&fit=crop' },
      { id: 'BudTEC_0003', assetNumber: 'พศ.68-ศพ-0012/1', name: 'หุ่นฝึกจำลองผู้ป่วยภาวะวิกฤตพร้อมโปรแกรมคอมพิวเตอร์ (Full Body Patient Simulator)', price: 1850000, vendorId: 1, fiscalYear: 2568, fundingSourceId: 2, categoryId: 11, locationId: 1, manualUrl: '', status: 'พร้อมใช้งาน', imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=300&auto=format&fit=crop' },
      { id: 'BudTEC_0004', assetNumber: 'พศ.66-ศป-0044/1', name: 'เครื่องตรวจตาด้วยกล้องขยายกำลังสูง (Slit Lamp Simulator)', price: 480000, vendorId: 3, fiscalYear: 2566, fundingSourceId: 1, categoryId: 7, locationId: 1, manualUrl: '', status: 'ชำรุด', imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=300&auto=format&fit=crop' },
      { id: 'BudTEC_0005', assetNumber: 'พศ.67-ศล-0005/2', name: 'ชุดจำลองทักษะการเย็บแผลและผ่าตัดเล็ก (Surgical Knot Tying & Suturing Kit)', price: 8500, vendorId: 1, fiscalYear: 2567, fundingSourceId: 1, categoryId: 3, locationId: 4, manualUrl: '', status: 'พร้อมใช้งาน', imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=300&auto=format&fit=crop' },
      { id: 'BudTEC_0006', assetNumber: 'พศ.68-ชช-0008/1', name: 'หุ่นฝึกปฏิบัติการกู้ชีพขั้นสูงในเด็กแรกเกิด (Neonatal Resuscitation Simulator)', price: 180000, vendorId: 2, fiscalYear: 2568, fundingSourceId: 2, categoryId: 2, locationId: 1, manualUrl: '', status: 'พร้อมใช้งาน', imageUrl: 'https://images.unsplash.com/photo-1502740479091-6398b19d99f6?q=80&w=300&auto=format&fit=crop' }
    ],
    transactions: [
      { id: 1, equipmentId: 'BudTEC_0002', userId: 2, borrowDate: '2026-06-01', expectedReturnDate: '2026-06-08', actualReturnDate: '', purpose: 'ใช้ฝึกอบรมการกู้ชีพขั้นพื้นฐาน (Basic CPR Course) รุ่นที่ 2', notes: 'ต้องการสายต่อและอุปกรณ์ครบชุด', status: 'ถูกยืม' },
      { id: 2, equipmentId: 'BudTEC_0005', userId: 4, borrowDate: '2026-05-25', expectedReturnDate: '2026-05-28', actualReturnDate: '2026-05-28', purpose: 'นำไปสาธิตการเย็บแผลในชั่วโมงสอนนักศึกษาแพทย์ชั้นปีที่ 4', notes: 'คืนอุปกรณ์ครบถ้วน สภาพสมบูรณ์', status: 'คืนแล้ว' },
      { id: 3, equipmentId: 'BudTEC_0001', userId: 3, borrowDate: '2026-05-10', expectedReturnDate: '2026-05-15', actualReturnDate: '2026-05-15', purpose: 'ฝึกซ้อมการทำคลอดไหล่ติดยาก (Shoulder Dystocia) สำหรับพยาบาลห้องคลอด', notes: 'ล้างทำความสะอาดหุ่นเรียบร้อยหลังใช้งาน', status: 'คืนแล้ว' },
      { id: 4, equipmentId: 'BudTEC_0002', userId: 3, borrowDate: '2026-05-01', expectedReturnDate: '2026-05-03', actualReturnDate: '2026-05-03', purpose: 'ใช้ซ้อมแผนเผชิญเหตุในกลุ่มงานสูติ-นรีเวชกรรม', notes: 'สภาพพร้อมใช้งานปกติ', status: 'คืนแล้ว' }
    ],
    maintenanceLogs: [
      { id: 1, equipmentId: 'BudTEC_0004', type: 'ส่งซ่อม', symptom: 'หลอดไฟของกล้องสแกนไม่ติด และหน้าจอแสดงผลติดๆ ดับๆ', repairCompany: 'บริษัท เมดิคอล ซัพพลาย จำกัด', cost: 4800, entryDate: '2026-05-20', nextDueDate: '2026-11-20' },
      { id: 2, equipmentId: 'BudTEC_0003', type: 'บำรุงรักษา', symptom: 'ตรวจเช็คตามระยะเวลาประจำปี สอบเทียบเซนเซอร์การกดหน้าอกช่วยฟื้นคืนชีพ', repairCompany: 'บริษัท เมดิคอล ซัพพลาย จำกัด', cost: 1500, entryDate: '2026-03-15', nextDueDate: '2027-03-15' }
    ]
  };

  for (const tableName in tables) {
    let sheet = ss.getSheetByName(tableName);
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
    }
    sheet.clear();
    
    // Write headers
    sheet.appendRow(tables[tableName]);
    
    // Seed default data
    if (defaultData[tableName]) {
      defaultData[tableName].forEach(item => {
        const row = tables[tableName].map(col => {
          let val = item[col];
          return val === undefined ? "" : val;
        });
        sheet.appendRow(row);
      });
    }
  }

  // Delete default "Sheet1" if exists
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1) {
    try {
      ss.deleteSheet(sheet1);
    } catch (e) {
      // Ignore
    }
  }
  
  console.log("Database Setup Completed Successfully!");
}

// Read all rows from a sheet as an array of objects
function readSheet(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or only headers
  const headers = data[0];
  const rows = [];
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((header, index) => {
      let val = data[i][index];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
      } else if (val === "true" || val === true) val = true;
      else if (val === "false" || val === false) val = false;
      row[header] = val;
    });
    rows.push(row);
  }
  return rows;
}

// Write or update a row in a sheet
function writeRow(sheetName, item, idKey) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idValue = item[idKey];
  
  const idColIndex = headers.indexOf(idKey);
  
  let rowIndex = -1;
  let existingRow = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(idValue)) {
      rowIndex = i + 1;
      existingRow = data[i];
      break;
    }
  }
  
  const rowValues = headers.map((header, index) => {
    let val = item[header];
    if (val === undefined) {
      if (rowIndex !== -1 && existingRow[index] !== undefined) {
        return existingRow[index];
      }
      return "";
    }
    return val;
  });
  
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// Delete a row by ID
function deleteRow(sheetName, idValue, idKey) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf(idKey);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(idValue)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// Get Parent Google Drive Folder of current Sheet
function getParentFolder() {
  const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const file = DriveApp.getFileById(sheetId);
  const parents = file.getParents();
  if (parents.hasNext()) {
    return parents.next();
  }
  return null;
}

// Get or Create subfolder for file storage
function getOrCreateSubfolder(parentFolder, folderName) {
  if (!parentFolder) return DriveApp.getRootFolder();
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  const newFolder = parentFolder.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

// GET Endpoint for Web App
function doGet(e) {
  try {
    const dbData = {
      fundingSources: readSheet('fundingSources'),
      categories: readSheet('categories'),
      locations: readSheet('locations'),
      vendors: readSheet('vendors'),
      users: readSheet('users'),
      equipment: readSheet('equipment'),
      transactions: readSheet('transactions'),
      maintenanceLogs: readSheet('maintenanceLogs')
    };

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: dbData }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// POST Endpoint for Web App
function doPost(e) {
  if (!e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No post data received." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const item = payload.data;
    
    // File Upload handling
    if (action === "uploadFile") {
      const fileData = item.base64;
      const fileName = item.fileName;
      const folderName = item.folderName; // 'avatars', 'equipment', 'manuals'
      
      const parentFolder = getParentFolder();
      const subfolder = getOrCreateSubfolder(parentFolder, folderName);
      
      // Extract base64 encoded bytes
      const base64Data = fileData.split(',')[1];
      const decodedBytes = Utilities.base64Decode(base64Data);
      
      let contentType = "application/octet-stream";
      const match = fileData.match(/^data:(.*?);base64,/);
      if (match) contentType = match[1];
      
      const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
      const file = subfolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      let webUrl = "";
      if (folderName === "manuals") {
        webUrl = file.getUrl();
      } else {
        webUrl = `https://lh3.googleusercontent.com/d/${file.getId()}`;
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, url: webUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Mapping actions to tables
    const actionMap = {
      "addFundingSource": { sheet: "fundingSources", key: "id" },
      "updateFundingSource": { sheet: "fundingSources", key: "id" },
      "deleteFundingSource": { sheet: "fundingSources", key: "id", delete: true },
      
      "addCategory": { sheet: "categories", key: "id" },
      "updateCategory": { sheet: "categories", key: "id" },
      "deleteCategory": { sheet: "categories", key: "id", delete: true },
      
      "addLocation": { sheet: "locations", key: "id" },
      "updateLocation": { sheet: "locations", key: "id" },
      "deleteLocation": { sheet: "locations", key: "id", delete: true },
      
      "addVendor": { sheet: "vendors", key: "id" },
      "updateVendor": { sheet: "vendors", key: "id" },
      "deleteVendor": { sheet: "vendors", key: "id", delete: true },
      
      "addUser": { sheet: "users", key: "id" },
      "registerUser": { sheet: "users", key: "id" },
      "updateUser": { sheet: "users", key: "id" },
      "deleteUser": { sheet: "users", key: "id", delete: true },
      "approveUser": { sheet: "users", key: "id" },
      
      "addEquipment": { sheet: "equipment", key: "id" },
      "updateEquipment": { sheet: "equipment", key: "id" },
      "deleteEquipment": { sheet: "equipment", key: "id", delete: true },
      
      "borrowEquipment": { sheet: "transactions", key: "id" },
      "returnEquipment": { sheet: "transactions", key: "id" },
      "approveBorrow": { sheet: "transactions", key: "id" },
      "rejectBorrow": { sheet: "transactions", key: "id" },
      "approveReturn": { sheet: "transactions", key: "id" },
      "rejectReturn": { sheet: "transactions", key: "id" },
      
      "addMaintenanceLog": { sheet: "maintenanceLogs", key: "id" },
      "deleteMaintenanceLog": { sheet: "maintenanceLogs", key: "id", delete: true }
    };
    
    const config = actionMap[action];
    if (!config) {
      throw new Error(`Unsupported action: ${action}`);
    }
    
    if (config.delete) {
      const success = deleteRow(config.sheet, item.id, config.key);
      return ContentService.createTextOutput(JSON.stringify({ success }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      writeRow(config.sheet, item, config.key);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
