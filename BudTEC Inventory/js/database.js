/**
 * BudTEC Inventory System - Database Layer (Google Sheets & Google Drive Integration)
 */

(function (global) {
  const DB_KEY = 'BudTEC_Inventory_DB';

  // Google Apps Script Web App Deployment URL
  // Paste your published GAS Web App URL here after deploying the script.
  const gasWebAppUrl = "https://script.google.com/macros/s/AKfycbwxIcB4nL82cfNm3EcTrSe6MtDOhje4p5Lqo1w6lFpOH0Fm25ZDkOLOQQIRUebB5LKB6A/exec";

  let useGoogleSheets = false;

  if (gasWebAppUrl && gasWebAppUrl !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
    useGoogleSheets = true;
    console.log("BudTEC Inventory: Google Sheets Backend enabled.");
  } else {
    console.log("BudTEC Inventory: Google Sheets URL is default/not set. Running in Local Demo Mode.");
  }
  global.BudTEC_UseGoogleSheets = useGoogleSheets;
  global.BudTEC_GasUrl = gasWebAppUrl;

  // Seed Data Definition
  const defaultFundingSources = [
    { id: 1, name: 'หมวดเงินอุดหนุนทั่วไป' },
    { id: 2, name: 'หมวดเงินงบ สบพช.' }
  ];

  const defaultCategories = [
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
  ];

  const defaultLocations = [
    { id: 1, name: 'ศูนย์ BudTEC' },
    { id: 2, name: 'กลุ่มงานสูติ-นรีเวชกรรม' },
    { id: 3, name: 'กลุ่มงานเวชศาสตร์ฉุกเฉิน' },
    { id: 4, name: 'กลุ่มงานศัลยกรรม' }
  ];

  const defaultVendors = [
    { id: 1, companyName: 'บริษัท เมดิคอล ซัพพลาย จำกัด', repName: 'สมชาย รักดี', repNickname: 'ชาย', phone: '081-234-5678', remarks: 'จัดส่งสินค้ารวดเร็ว มีบริการหลังการขายดีเยี่ยม' },
    { id: 2, companyName: 'บริษัท สยามเฮลท์แคร์ กรุ๊ป', repName: 'วิภาดา รักดี', repNickname: 'ปลา', phone: '082-987-6543', remarks: 'ตัวแทนจำหน่ายอุปกรณ์ช่วยชีวิตขั้นพื้นฐาน' },
    { id: 3, companyName: 'บริษัท ไทย ไบโอเมดิคอล จำกัด', repName: 'กิตติศักดิ์ เจริญพร', repNickname: 'กิต', phone: '089-555-4433', remarks: 'ประกันอุปกรณ์ 2 ปีเต็ม' },
    { id: 4, companyName: 'บริษัท เมดเทค ดีไซน์ จำกัด', repName: 'นารี มีสุข', repNickname: 'แอน', phone: '086-111-2233', remarks: 'จำหน่ายหุ่นฝึกปฏิบัติการพยาบาล' }
  ];

  const defaultUsers = [
    { id: 1, name: 'ผู้จัดการระบบ บัดเทค (Admin)', username: 'admin', password: 'admin', email: 'admin@budtec.com', phone: '080-000-0001', role: 'admin', department: 'ศูนย์ BudTEC', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop', approved: true },
    { id: 2, name: 'นพ.ปรีชา เลิศวิไล', username: 'user', password: 'user', email: 'preecha@budtec.com', phone: '080-000-0002', role: 'user', department: 'กลุ่มงานเวชศาสตร์ฉุกเฉิน', avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop', approved: true },
    { id: 3, name: 'พญ.นลินี ศรีสุข', username: 'nalinee', password: 'user', email: 'nalinee@budtec.com', phone: '080-000-0003', role: 'user', department: 'กลุ่มงานสูติ-นรีเวชกรรม', avatarUrl: 'https://images.unsplash.com/photo-1594824813573-246434e33963?q=80&w=150&auto=format&fit=crop', approved: true },
    { id: 4, name: 'นพ.สมศักดิ์ รักชาติ', username: 'somsak', password: 'user', email: 'somsak@budtec.com', phone: '080-000-0004', role: 'user', department: 'กลุ่มงานศัลยกรรม', avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=150&auto=format&fit=crop', approved: true }
  ];

  const defaultMaintenanceLogs = [
    {
      id: 1,
      equipmentId: 'BudTEC_0004',
      type: 'ส่งซ่อม',
      symptom: 'หลอดไฟของกล้องสแกนไม่ติด และหน้าจอแสดงผลติดๆ ดับๆ',
      repairCompany: 'บริษัท เมดิคอล ซัพพลาย จำกัด',
      cost: 4800,
      entryDate: '2026-05-20',
      nextDueDate: '2026-11-20'
    },
    {
      id: 2,
      equipmentId: 'BudTEC_0003',
      type: 'บำรุงรักษา',
      symptom: 'ตรวจเช็คตามระยะเวลาประจำปี สอบเทียบเซนเซอร์การกดหน้าอกช่วยฟื้นคืนชีพ',
      repairCompany: 'บริษัท เมดิคอล ซัพพลาย จำกัด',
      cost: 1500,
      entryDate: '2026-03-15',
      nextDueDate: '2027-03-15'
    }
  ];

  const defaultEquipment = [
    {
      id: 'BudTEC_0001',
      assetNumber: 'พศ.68-ออ-0001/4',
      name: 'หุ่นฝึกจำลองการคลอดบุตรขั้นสูง (Advanced Childbirth Simulator)',
      price: 250000,
      vendorId: 4,
      fiscalYear: 2568,
      fundingSourceId: 2,
      categoryId: 4,
      locationId: 2,
      manualUrl: '',
      status: 'พร้อมใช้งาน',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=300&auto=format&fit=crop'
    },
    {
      id: 'BudTEC_0002',
      assetNumber: 'พศ.67-ฉฉ-0021/3',
      name: 'เครื่องจำลองการกระตุกหัวใจด้วยไฟฟ้าแบบอัตโนมัติ (AED Trainer v3)',
      price: 45000,
      vendorId: 2,
      fiscalYear: 2567,
      fundingSourceId: 1,
      categoryId: 5,
      locationId: 3,
      manualUrl: '',
      status: 'ถูกยืม',
      imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?q=80&w=300&auto=format&fit=crop'
    },
    {
      id: 'BudTEC_0003',
      assetNumber: 'พศ.68-ศพ-0012/1',
      name: 'หุ่นฝึกจำลองผู้ป่วยภาวะวิกฤตพร้อมโปรแกรมคอมพิวเตอร์ (Full Body Patient Simulator)',
      price: 1850000,
      vendorId: 1,
      fiscalYear: 2568,
      fundingSourceId: 2,
      categoryId: 11,
      locationId: 1,
      manualUrl: '',
      status: 'พร้อมใช้งาน',
      imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=300&auto=format&fit=crop'
    },
    {
      id: 'BudTEC_0004',
      assetNumber: 'พศ.66-ศป-0044/1',
      name: 'เครื่องตรวจตาด้วยกล้องขยายกำลังสูง (Slit Lamp Simulator)',
      price: 480000,
      vendorId: 3,
      fiscalYear: 2566,
      fundingSourceId: 1,
      categoryId: 7,
      locationId: 1,
      manualUrl: '',
      status: 'ชำรุด',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=300&auto=format&fit=crop'
    },
    {
      id: 'BudTEC_0005',
      assetNumber: 'พศ.67-ศล-0005/2',
      name: 'ชุดจำลองทักษะการเย็บแผลและผ่าตัดเล็ก (Surgical Knot Tying & Suturing Kit)',
      price: 8500,
      vendorId: 1,
      fiscalYear: 2567,
      fundingSourceId: 1,
      categoryId: 3,
      locationId: 4,
      manualUrl: '',
      status: 'พร้อมใช้งาน',
      imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=300&auto=format&fit=crop'
    },
    {
      id: 'BudTEC_0006',
      assetNumber: 'พศ.68-ชช-0008/1',
      name: 'หุ่นฝึกปฏิบัติการกู้ชีพขั้นสูงในเด็กแรกเกิด (Neonatal Resuscitation Simulator)',
      price: 180000,
      vendorId: 2,
      fiscalYear: 2568,
      fundingSourceId: 2,
      categoryId: 2,
      locationId: 1,
      manualUrl: '',
      status: 'พร้อมใช้งาน',
      imageUrl: 'https://images.unsplash.com/photo-1502740479091-6398b19d99f6?q=80&w=300&auto=format&fit=crop'
    }
  ];

  const defaultTransactions = [
    {
      id: 1,
      equipmentId: 'BudTEC_0002',
      userId: 2,
      borrowDate: '2026-06-01',
      expectedReturnDate: '2026-06-08',
      actualReturnDate: '',
      purpose: 'ใช้ฝึกอบรมการกู้ชีพขั้นพื้นฐาน (Basic CPR Course) รุ่นที่ 2',
      notes: 'ต้องการสายต่อและอุปกรณ์ครบชุด',
      status: 'ถูกยืม'
    },
    {
      id: 2,
      equipmentId: 'BudTEC_0005',
      userId: 4,
      borrowDate: '2026-05-25',
      expectedReturnDate: '2026-05-28',
      actualReturnDate: '2026-05-28',
      purpose: 'นำไปสาธิตการเย็บแผลในชั่วโมงสอนนักศึกษาแพทย์ชั้นปีที่ 4',
      notes: 'คืนอุปกรณ์ครบถ้วน สภาพสมบูรณ์',
      status: 'คืนแล้ว'
    },
    {
      id: 3,
      equipmentId: 'BudTEC_0001',
      userId: 3,
      borrowDate: '2026-05-10',
      expectedReturnDate: '2026-05-15',
      actualReturnDate: '2026-05-15',
      purpose: 'ฝึกซ้อมการทำคลอดไหล่ติดยาก (Shoulder Dystocia) สำหรับพยาบาลห้องคลอด',
      notes: 'ล้างทำความสะอาดหุ่นเรียบร้อยหลังใช้งาน',
      status: 'คืนแล้ว'
    },
    {
      id: 4,
      equipmentId: 'BudTEC_0002',
      userId: 3,
      borrowDate: '2026-05-01',
      expectedReturnDate: '2026-05-03',
      actualReturnDate: '2026-05-03',
      purpose: 'ใช้ซ้อมแผนเผชิญเหตุในกลุ่มงานสูติ-นรีเวชกรรม',
      notes: 'สภาพพร้อมใช้งานปกติ',
      status: 'คืนแล้ว'
    }
  ];

  // Database Local Memory State
  let data = {
    fundingSources: [],
    categories: [],
    locations: [],
    vendors: [],
    users: [],
    equipment: [],
    transactions: [],
    maintenanceLogs: []
  };

  const parseId = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? val : num;
  };

  let updateTimeout = null;
  function triggerDBUpdateEvent() {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('budtec-db-updated'));
    }, 100);
  }

  function saveLocalBackup() {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  }

  function fixGoogleDriveImageUrl(url) {
    if (!url) return url;
    // Match drive.google.com/uc?export=view&id=FILE_ID or drive.google.com/open?id=FILE_ID or drive.google.com/uc?id=FILE_ID
    const driveMatch = url.match(/drive\.google\.com\/.*[?&]id=([^&]+)/);
    if (driveMatch) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    // Also match drive.google.com/file/d/FILE_ID/view
    const pathMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (pathMatch) {
      return `https://lh3.googleusercontent.com/d/${pathMatch[1]}`;
    }
    return url;
  }

  function sanitizeDatabaseImageUrls() {
    if (data.users) {
      data.users.forEach(u => {
        if (u.avatarUrl) u.avatarUrl = fixGoogleDriveImageUrl(u.avatarUrl);
      });
    }
    if (data.equipment) {
      data.equipment.forEach(eq => {
        if (eq.imageUrl) eq.imageUrl = fixGoogleDriveImageUrl(eq.imageUrl);
      });
    }
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function generateNextId(array, defaultPrefix, padLength = 3) {
    if (!array || array.length === 0) {
      return `${defaultPrefix}${String(1).padStart(padLength, '0')}`;
    }
    
    const lastItem = array[array.length - 1];
    const lastId = String(lastItem.id);
    
    if (/^\d+$/.test(lastId)) {
      const nums = array.map(x => Number(x.id)).filter(n => !isNaN(n));
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
      return maxNum + 1;
    }
    
    const match = lastId.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const suffixStr = match[2];
      const currentPadLength = suffixStr.length;
      
      const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
      const nums = array
        .map(x => {
          const m = String(x.id).match(regex);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter(n => n > 0);
        
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
      const nextNum = maxNum + 1;
      return `${prefix}${String(nextNum).padStart(currentPadLength, '0')}`;
    }
    
    return `${lastId}_${array.length + 1}`;
  }

  // Load from local storage cache initially
  function initDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        data = JSON.parse(raw);
        // Ensure collections exist
        if (!data.fundingSources) data.fundingSources = defaultFundingSources;
        if (!data.categories) data.categories = defaultCategories;
        if (!data.locations) data.locations = defaultLocations;
        if (!data.vendors) data.vendors = defaultVendors;
        if (!data.users || data.users.length === 0) data.users = defaultUsers;
        if (!data.equipment) data.equipment = defaultEquipment;
        if (!data.transactions) data.transactions = defaultTransactions;
        if (!data.maintenanceLogs) data.maintenanceLogs = defaultMaintenanceLogs;
        
        sanitizeDatabaseImageUrls();
      } catch (e) {
        seed();
      }
    } else {
      seed();
    }

    if (useGoogleSheets) {
      // Async fetch to sync with Google Sheet
      syncWithGoogleSheets();
    }
  }

  function seed() {
    data = {
      fundingSources: [...defaultFundingSources],
      categories: [...defaultCategories],
      locations: [...defaultLocations],
      vendors: [...defaultVendors],
      users: [...defaultUsers],
      equipment: [...defaultEquipment],
      transactions: [...defaultTransactions],
      maintenanceLogs: [...defaultMaintenanceLogs]
    };
    saveLocalBackup();
  }

  // Fetch all collections from Google Sheets
  function syncWithGoogleSheets() {
    console.log("BudTEC Inventory: Syncing with Google Sheets...");
    fetch(gasWebAppUrl)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          // Validate that the synced data contains users. If not, do not overwrite or keep default users.
          if (json.data.users && json.data.users.length > 0) {
            data = json.data;
          } else {
            console.warn("Synced user list is empty, keeping local users list.");
            const usersBackup = data.users && data.users.length > 0 ? data.users : defaultUsers;
            data = json.data;
            data.users = usersBackup;
          }
          sanitizeDatabaseImageUrls();
          saveLocalBackup();
          console.log("BudTEC Inventory: Google Sheets sync complete.");
          triggerDBUpdateEvent();
        } else {
          console.error("Google Sheets sync failed:", json.error);
        }
      })
      .catch(err => {
        console.error("Error connecting to Google Sheets Web App:", err);
      });
  }

  // Async Background POST call helper to Google Apps Script
  function postToGAS(action, payload) {
    if (!useGoogleSheets) return;
    
    fetch(gasWebAppUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: action,
        data: payload
      })
    })
    .then(res => res.json())
    .then(json => {
      if (!json.success) {
        console.error(`GAS POST failed for ${action}:`, json.error);
      } else {
        console.log(`GAS POST succeeded for ${action}.`);
      }
    })
    .catch(err => {
      console.error(`Error executing GAS POST for ${action}:`, err);
    });
  }

  // File Upload to Google Drive via GAS helper
  global.uploadFileToGoogleDrive = function(file, folderName) {
    return new Promise((resolve, reject) => {
      if (!useGoogleSheets) {
        // Fallback to base64 encoding (demo mode)
        const reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const base64Data = e.target.result;
        
        fetch(gasWebAppUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: "uploadFile",
            data: {
              base64: base64Data,
              fileName: file.name,
              folderName: folderName // 'avatars', 'equipment', 'manuals'
            }
          })
        })
        .then(res => res.json())
        .then(json => {
          if (json.success && json.url) {
            resolve(json.url);
          } else {
            reject(new Error(json.error || "อัปโหลดไฟล์ล้มเหลว"));
          }
        })
        .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Database Interface API (Optimistic Updates)
  const db = {
    reset() {
      if (useGoogleSheets) {
        postToGAS("reset", {});
      }
      seed();
      triggerDBUpdateEvent();
      return true;
    },

    // --- FUNDING SOURCES ---
    getFundingSources() {
      return data.fundingSources;
    },
    addFundingSource(name) {
      const id = generateNextId(data.fundingSources, 'FUND_', 3);
      const newSource = { id, name };
      data.fundingSources.push(newSource);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addFundingSource", newSource);
      return newSource;
    },
    updateFundingSource(id, name) {
      const idVal = parseId(id);
      const idx = data.fundingSources.findIndex(x => x.id === idVal);
      if (idx !== -1) {
        data.fundingSources[idx].name = name;
        saveLocalBackup();
        triggerDBUpdateEvent();
        postToGAS("updateFundingSource", data.fundingSources[idx]);
        return data.fundingSources[idx];
      }
      return null;
    },
    deleteFundingSource(id) {
      const idVal = parseId(id);
      const isUsed = data.equipment.some(x => x.fundingSourceId === idVal);
      if (isUsed) return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากหมวดเงินนี้ถูกใช้งานโดยครุภัณฑ์ในคลังอยู่' };
      
      data.fundingSources = data.fundingSources.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteFundingSource", { id: idVal });
      return { success: true };
    },

    // --- CATEGORIES ---
    getCategories() {
      return data.categories;
    },
    addCategory(name) {
      const id = generateNextId(data.categories, 'CAT_', 3);
      const newCat = { id, name };
      data.categories.push(newCat);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addCategory", newCat);
      return newCat;
    },
    updateCategory(id, name) {
      const idVal = parseId(id);
      const idx = data.categories.findIndex(x => x.id === idVal);
      if (idx !== -1) {
        data.categories[idx].name = name;
        saveLocalBackup();
        triggerDBUpdateEvent();
        postToGAS("updateCategory", data.categories[idx]);
        return data.categories[idx];
      }
      return null;
    },
    deleteCategory(id) {
      const idVal = parseId(id);
      const isUsed = data.equipment.some(x => x.categoryId === idVal);
      if (isUsed) return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากหมวดหมู่นี้ถูกใช้งานโดยครุภัณฑ์ในคลังอยู่' };

      data.categories = data.categories.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteCategory", { id: idVal });
      return { success: true };
    },

    // --- LOCATIONS ---
    getLocations() {
      return data.locations;
    },
    addLocation(name) {
      const id = generateNextId(data.locations, 'LOC_', 3);
      const newLoc = { id, name };
      data.locations.push(newLoc);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addLocation", newLoc);
      return newLoc;
    },
    updateLocation(id, name) {
      const idVal = parseId(id);
      const idx = data.locations.findIndex(x => x.id === idVal);
      if (idx !== -1) {
        data.locations[idx].name = name;
        saveLocalBackup();
        triggerDBUpdateEvent();
        postToGAS("updateLocation", data.locations[idx]);
        return data.locations[idx];
      }
      return null;
    },
    deleteLocation(id) {
      const idVal = parseId(id);
      const isUsed = data.equipment.some(x => x.locationId === idVal);
      if (isUsed) return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากสถานที่เก็บนี้ถูกใช้งานโดยครุภัณฑ์ในคลังอยู่' };

      data.locations = data.locations.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteLocation", { id: idVal });
      return { success: true };
    },

    // --- VENDORS ---
    getVendors() {
      return data.vendors;
    },
    getVendorById(id) {
      const idVal = parseId(id);
      return data.vendors.find(x => x.id === idVal) || null;
    },
    addVendor(vendorData) {
      const id = generateNextId(data.vendors, 'VEND_', 3);
      const newVendor = {
        id,
        companyName: vendorData.companyName || '',
        repName: vendorData.repName || '',
        repNickname: vendorData.repNickname || '',
        phone: vendorData.phone || '',
        remarks: vendorData.remarks || ''
      };
      data.vendors.push(newVendor);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addVendor", newVendor);
      return newVendor;
    },
    updateVendor(id, vendorData) {
      const idVal = parseId(id);
      const idx = data.vendors.findIndex(x => x.id === idVal);
      if (idx !== -1) {
        data.vendors[idx] = {
          ...data.vendors[idx],
          companyName: vendorData.companyName || '',
          repName: vendorData.repName || '',
          repNickname: vendorData.repNickname || '',
          phone: vendorData.phone || '',
          remarks: vendorData.remarks || ''
        };
        saveLocalBackup();
        triggerDBUpdateEvent();
        postToGAS("updateVendor", data.vendors[idx]);
        return data.vendors[idx];
      }
      return null;
    },
    deleteVendor(id) {
      const idVal = parseId(id);
      const isUsed = data.equipment.some(x => x.vendorId === idVal);
      if (isUsed) return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากมีครุภัณฑ์ที่เชื่อมโยงกับบริษัทผู้ขายนี้' };

      data.vendors = data.vendors.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteVendor", { id: idVal });
      return { success: true };
    },

    // --- USERS ---
    getUsers() {
      return data.users;
    },
    getUserById(id) {
      const idVal = parseId(id);
      return data.users.find(x => x.id === idVal) || null;
    },
    getUserByUsername(username) {
      return data.users.find(x => x.username.toLowerCase() === username.toLowerCase()) || null;
    },
    addUser(userData) {
      if (this.getUserByUsername(userData.username)) {
        return { success: false, message: 'มีชื่อผู้ใช้นี้ (username) ในระบบแล้ว' };
      }
      const id = generateNextId(data.users, 'USR_', 3);
      const newUser = {
        id,
        name: userData.name || '',
        username: userData.username || '',
        password: userData.password || 'user',
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || 'user',
        department: userData.department || '',
        avatarUrl: userData.avatarUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop',
        approved: true
      };
      data.users.push(newUser);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addUser", newUser);
      return { success: true, user: newUser };
    },
    registerUser(userData) {
      if (this.getUserByUsername(userData.username)) {
        return { success: false, message: 'มีชื่อผู้ใช้นี้ (username) ในระบบแล้ว' };
      }
      const id = generateNextId(data.users, 'USR_', 3);
      const newUser = {
        id,
        name: userData.name || '',
        username: userData.username || '',
        password: userData.password || 'user',
        email: userData.email || '',
        phone: userData.phone || '',
        role: 'user',
        department: userData.department || '',
        avatarUrl: userData.avatarUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop',
        approved: false
      };
      data.users.push(newUser);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("registerUser", newUser);
      return { success: true, user: newUser };
    },
    approveUser(id) {
      const idVal = parseId(id);
      const u = this.getUserById(idVal);
      if (!u) return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
      u.approved = true;
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("approveUser", { id: idVal, approved: true });
      return { success: true, user: u };
    },
    rejectUser(id) {
      const idVal = parseId(id);
      const u = this.getUserById(idVal);
      if (!u) return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
      data.users = data.users.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteUser", { id: idVal });
      return { success: true };
    },
    updateUser(id, userData) {
      const idVal = parseId(id);
      const idx = data.users.findIndex(x => x.id === idVal);
      if (idx !== -1) {
        const existing = this.getUserByUsername(userData.username);
        if (existing && existing.id !== idVal) {
          return { success: false, message: 'มีชื่อผู้ใช้นี้ (username) ในระบบแล้ว' };
        }
        data.users[idx] = {
          ...data.users[idx],
          name: userData.name || '',
          username: userData.username || data.users[idx].username,
          password: userData.password || data.users[idx].password,
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || data.users[idx].role,
          department: userData.department || '',
          avatarUrl: userData.avatarUrl !== undefined ? userData.avatarUrl : data.users[idx].avatarUrl
        };
        saveLocalBackup();
        triggerDBUpdateEvent();
        postToGAS("updateUser", data.users[idx]);
        return { success: true, user: data.users[idx] };
      }
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
    },
    deleteUser(id) {
      const idVal = parseId(id);
      const targetUser = this.getUserById(idVal);
      if (targetUser && targetUser.role === 'admin') {
        const adminCount = data.users.filter(x => x.role === 'admin').length;
        if (adminCount <= 1) {
          return { success: false, message: 'ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้' };
        }
      }

      const hasTransactions = data.transactions.some(x => x.userId === idVal);
      if (hasTransactions) {
        return { success: false, message: 'ไม่สามารถลบผู้ใช้ได้ เนื่องจากมีประวัติการยืม-คืนผูกอยู่' };
      }

      data.users = data.users.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteUser", { id: idVal });
      return { success: true };
    },

    // --- EQUIPMENT ---
    getEquipment() {
      return data.equipment;
    },
    getEquipmentById(id) {
      return data.equipment.find(x => x.id === id) || null;
    },
    generateNextEquipmentId() {
      const ids = data.equipment
        .map(x => {
          const match = x.id.match(/^BudTEC_?(\d{4})$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);
      const maxNum = ids.length > 0 ? Math.max(...ids) : 0;
      const nextNum = maxNum + 1;
      return `BudTEC_${String(nextNum).padStart(4, '0')}`;
    },
    addEquipment(eqData) {
      const nextId = this.generateNextEquipmentId();
      const newEq = {
        id: nextId,
        assetNumber: eqData.assetNumber || '',
        name: eqData.name || '',
        price: Number(eqData.price) || 0,
        vendorId: parseId(eqData.vendorId),
        fiscalYear: Number(eqData.fiscalYear) || new Date().getFullYear() + 543,
        fundingSourceId: parseId(eqData.fundingSourceId),
        categoryId: parseId(eqData.categoryId),
        locationId: parseId(eqData.locationId),
        manualUrl: eqData.manualUrl || '',
        status: eqData.status || 'พร้อมใช้งาน',
        imageUrl: eqData.imageUrl || 'Logo/budtec_logo_notext.png'
      };
      data.equipment.push(newEq);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addEquipment", newEq);
      return newEq;
    },
    updateEquipment(id, eqData) {
      const idx = data.equipment.findIndex(x => x.id === id);
      if (idx !== -1) {
        data.equipment[idx] = {
          ...data.equipment[idx],
          assetNumber: eqData.assetNumber || '',
          name: eqData.name || '',
          price: Number(eqData.price) || 0,
          vendorId: parseId(eqData.vendorId),
          fiscalYear: Number(eqData.fiscalYear) || data.equipment[idx].fiscalYear,
          fundingSourceId: parseId(eqData.fundingSourceId),
          categoryId: parseId(eqData.categoryId),
          locationId: parseId(eqData.locationId),
          manualUrl: eqData.manualUrl !== undefined ? eqData.manualUrl : data.equipment[idx].manualUrl,
          status: eqData.status || data.equipment[idx].status,
          imageUrl: eqData.imageUrl || data.equipment[idx].imageUrl
        };
        saveLocalBackup();
        triggerDBUpdateEvent();
        postToGAS("updateEquipment", data.equipment[idx]);
        return data.equipment[idx];
      }
      return null;
    },
    deleteEquipment(id) {
      const eq = this.getEquipmentById(id);
      if (eq && eq.status === 'ถูกยืม') {
        return { success: false, message: 'ไม่สามารถลบครุภัณฑ์ได้ เนื่องจากอยู่ในสถานะถูกยืม' };
      }

      const hasLogs = data.transactions.some(x => x.equipmentId === id);
      if (hasLogs) {
        data.transactions = data.transactions.filter(x => x.equipmentId !== id);
      }

      data.equipment = data.equipment.filter(x => x.id !== id);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteEquipment", { id: id });
      return { success: true };
    },

    // --- TRANSACTIONS (BORROW / RETURN) ---
    getTransactions() {
      return data.transactions;
    },
    getTransactionById(id) {
      const idVal = parseId(id);
      return data.transactions.find(x => x.id === idVal) || null;
    },
    borrowEquipment(equipmentId, userId, borrowDetails) {
      const eq = this.getEquipmentById(equipmentId);
      if (!eq) return { success: false, message: 'ไม่พบครุภัณฑ์ที่ต้องการยืม' };
      if (eq.status !== 'พร้อมใช้งาน') return { success: false, message: `ครุภัณฑ์นี้ไม่พร้อมใช้งาน (สถานะปัจจุบัน: ${eq.status})` };

      eq.status = 'รออนุมัติยืม';
      this.updateEquipment(equipmentId, eq);

      const id = data.transactions.length > 0 ? Math.max(...data.transactions.map(x => (typeof x.id === 'number' ? x.id : 0))) + 1 : 1;
      const parsedUserId = parseId(userId);
      const newTx = {
        id,
        equipmentId,
        userId: parsedUserId,
        borrowDate: borrowDetails.borrowDate || new Date().toISOString().split('T')[0],
        expectedReturnDate: borrowDetails.expectedReturnDate || '',
        actualReturnDate: '',
        purpose: borrowDetails.purpose || '',
        notes: borrowDetails.notes || '',
        status: 'รออนุมัติยืม'
      };

      data.transactions.push(newTx);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("borrowEquipment", newTx);
      return { success: true, transaction: newTx };
    },
    returnEquipment(equipmentId, transactionId, returnDetails) {
      const eq = this.getEquipmentById(equipmentId);
      const tx = this.getTransactionById(transactionId);

      if (!tx) return { success: false, message: 'ไม่พบรายการยืม' };

      if (eq) {
        eq.status = 'รออนุมัติคืน';
        this.updateEquipment(equipmentId, eq);
      }

      tx.status = 'รออนุมัติคืน';
      tx.pendingReturnDate = returnDetails.returnDate || new Date().toISOString().split('T')[0];
      tx.pendingIsDamaged = !!returnDetails.isDamaged;
      tx.pendingNotes = returnDetails.notes || '';

      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("returnEquipment", tx);
      return { success: true, transaction: tx };
    },
    approveBorrow(transactionId) {
      const tx = this.getTransactionById(transactionId);
      if (!tx) return { success: false, message: 'ไม่พบรายการยืม' };
      const eq = this.getEquipmentById(tx.equipmentId);
      if (!eq) return { success: false, message: 'ไม่พบครุภัณฑ์' };

      tx.status = 'ถูกยืม';
      eq.status = 'ถูกยืม';

      this.updateEquipment(tx.equipmentId, eq);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("approveBorrow", tx);
      return { success: true, transaction: tx };
    },
    rejectBorrow(transactionId) {
      const tx = this.getTransactionById(transactionId);
      if (!tx) return { success: false, message: 'ไม่พบรายการยืม' };
      const eq = this.getEquipmentById(tx.equipmentId);
      if (!eq) return { success: false, message: 'ไม่พบครุภัณฑ์' };

      tx.status = 'ปฏิเสธการยืม';
      eq.status = 'พร้อมใช้งาน';

      this.updateEquipment(tx.equipmentId, eq);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("rejectBorrow", tx);
      return { success: true, transaction: tx };
    },
    approveReturn(transactionId) {
      const tx = this.getTransactionById(transactionId);
      if (!tx) return { success: false, message: 'ไม่พบรายการยืม' };
      const eq = this.getEquipmentById(tx.equipmentId);
      if (!eq) return { success: false, message: 'ไม่พบครุภัณฑ์' };

      tx.status = 'คืนแล้ว';
      tx.actualReturnDate = tx.pendingReturnDate || new Date().toISOString().split('T')[0];
      if (tx.pendingNotes) {
        tx.notes = tx.notes ? `${tx.notes} | คืน: ${tx.pendingNotes}` : `คืน: ${tx.pendingNotes}`;
      }
      
      eq.status = tx.pendingIsDamaged ? 'ชำรุด' : 'พร้อมใช้งาน';

      // Clear pending fields
      delete tx.pendingReturnDate;
      delete tx.pendingIsDamaged;
      delete tx.pendingNotes;

      this.updateEquipment(tx.equipmentId, eq);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("approveReturn", tx);
      return { success: true, transaction: tx };
    },
    rejectReturn(transactionId) {
      const tx = this.getTransactionById(transactionId);
      if (!tx) return { success: false, message: 'ไม่พบรายการยืม' };
      const eq = this.getEquipmentById(tx.equipmentId);
      if (!eq) return { success: false, message: 'ไม่พบครุภัณฑ์' };

      tx.status = 'ถูกยืม';
      eq.status = 'ถูกยืม';

      // Clear pending fields
      delete tx.pendingReturnDate;
      delete tx.pendingIsDamaged;
      delete tx.pendingNotes;

      this.updateEquipment(tx.equipmentId, eq);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("rejectReturn", tx);
      return { success: true, transaction: tx };
    },

    // --- MAINTENANCE LOGS ---
    getMaintenanceLogs() {
      return data.maintenanceLogs || [];
    },
    addMaintenanceLog(log) {
      if (!data.maintenanceLogs) data.maintenanceLogs = [];
      const id = data.maintenanceLogs.length > 0 ? Math.max(...data.maintenanceLogs.map(x => x.id)) + 1 : 1;
      const newLog = { id, ...log };
      data.maintenanceLogs.push(newLog);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("addMaintenanceLog", newLog);
      return newLog;
    },
    deleteMaintenanceLog(id) {
      const idVal = parseId(id);
      if (!data.maintenanceLogs) data.maintenanceLogs = [];
      data.maintenanceLogs = data.maintenanceLogs.filter(x => x.id !== idVal);
      saveLocalBackup();
      triggerDBUpdateEvent();
      postToGAS("deleteMaintenanceLog", { id: idVal });
      return { success: true };
    }
  };

  // Initialize DB instance
  initDB();

  // Expose to window/global
  global.BudTECDB = db;

})(window);
