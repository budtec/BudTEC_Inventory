/**
 * BudTEC Inventory System - Application Controller Layer
 */

(function () {
  // Global reference to the DB
  const db = window.BudTECDB;
  if (!db) {
    console.error('Database layer not loaded!');
    return;
  }

  // Application State
  let currentUser = null;
  let activeSection = 'dashboard';
  let charts = {}; // references to Chart.js instances

  // DOM Elements cache helper
  const $ = id => document.getElementById(id);
  const q = selector => document.querySelector(selector);
  const qAll = selector => document.querySelectorAll(selector);

  // Helper to parse IDs cleanly (numeric or alphanumeric)
  const parseId = val => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? val : num;
  };

  // Initialize App
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize Theme (Default to Dark Mode)
    const savedTheme = localStorage.getItem('BudTEC_Theme');
    if (savedTheme === 'light') {
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
    }

    // Listen to database update events (Firestore pushes)
    document.addEventListener('budtec-db-updated', () => {
      refreshActiveSection();
    });

    initAuth();
    setupEventListeners();

    // Listen to hashchange events (for scanned QR Codes while already logged in)
    window.addEventListener('hashchange', () => {
      const hashMatch = window.location.hash.match(/#eq=([A-Za-z0-9_]+)/);
      if (hashMatch && currentUser) {
        const eqId = hashMatch[1];
        window.location.hash = ''; // Clear hash
        navigateTo('inventory');
        showEquipmentDetails(eqId);
      }
    });
  });

  // ==========================================
  // 1. AUTHENTICATION & LOGIN MANAGEMENT
  // ==========================================
  function initAuth() {
    // Parse URL hash for specific equipment routing (QR Code scanning)
    const hashMatch = window.location.hash.match(/#eq=([A-Za-z0-9_]+)/);
    if (hashMatch) {
      window.pendingEqDetailId = hashMatch[1];
    }

    const savedUser = sessionStorage.getItem('BudTEC_Current_User') || localStorage.getItem('BudTEC_Current_User');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        onLoginSuccess();
        if (window.pendingEqDetailId) {
          const eqId = window.pendingEqDetailId;
          delete window.pendingEqDetailId;
          window.location.hash = '';
          navigateTo('inventory');
          showEquipmentDetails(eqId);
        }
      } catch (e) {
        logout();
      }
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    $('loginOverlay').classList.remove('hidden');
    $('loginError').style.display = 'none';
    $('loginPassword').value = '';
    $('loginUsername').value = '';
  }

  function handleLogin(e) {
    if (e) e.preventDefault();
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value.trim();
    const rememberMe = $('loginRemember').checked;

    if (!username || !password) {
      showLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    const user = db.getUserByUsername(username);
    if (user && user.password === password) {
      if (user.approved === false) {
        showLoginError('บัญชีของคุณอยู่ระหว่างการรออนุมัติจากผู้ดูแลระบบ');
        return;
      }
      currentUser = user;
      const userStr = JSON.stringify(currentUser);
      if (rememberMe) {
        localStorage.setItem('BudTEC_Current_User', userStr);
      } else {
        sessionStorage.setItem('BudTEC_Current_User', userStr);
      }
      onLoginSuccess();
    } else {
      showLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    const details = {
      name: $('registerName').value.trim(),
      username: $('registerUsername').value.trim(),
      password: $('registerPassword').value.trim(),
      email: $('registerEmail').value.trim(),
      phone: $('registerPhone').value.trim(),
      department: $('registerDepartment').value.trim(),
      avatarUrl: $('registerAvatarUrl').value
    };

    if (!details.name || !details.username || !details.password || !details.email) {
      alert('กรุณากรอกข้อมูลที่จำเป็นทั้งหมด (ชื่อ-สกุล, ชื่อผู้ใช้, อีเมล และรหัสผ่าน)');
      return;
    }

    const res = db.registerUser(details);
    if (res.success) {
      alert('สมัครสมาชิกเรียบร้อยแล้ว! กรุณารอผู้ดูแลระบบทำการตรวจสอบและอนุมัติการเข้าใช้งาน');
      
      $('registerForm').reset();
      $('registerAvatarPreview').src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';
      $('registerAvatarUrl').value = '';
      
      $('registerForm').style.display = 'none';
      $('loginForm').style.display = 'block';
    } else {
      alert(res.message);
    }
  }

  function showLoginError(msg) {
    const errorEl = $('loginError');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  function logout() {
    currentUser = null;
    sessionStorage.removeItem('BudTEC_Current_User');
    localStorage.removeItem('BudTEC_Current_User');
    
    $('loginOverlay').classList.remove('hidden');
    q('.app-container').style.display = 'none';
    showLoginScreen();
  }

  function onLoginSuccess() {
    $('loginOverlay').classList.add('hidden');
    q('.app-container').style.display = 'flex';
    
    // Update Profile status
    $('sidebarUserName').textContent = currentUser.name;
    $('sidebarUserRole').textContent = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้ทั่วไป (User)';
    $('sidebarAvatarInitials').textContent = currentUser.name ? currentUser.name.charAt(0) : 'U';

    // Show photo avatar if exists
    if (currentUser.avatarUrl) {
      $('sidebarUserAvatar').src = currentUser.avatarUrl;
      $('sidebarUserAvatar').style.display = 'block';
      $('sidebarAvatarInitials').style.display = 'none';
    } else {
      $('sidebarUserAvatar').style.display = 'none';
      $('sidebarAvatarInitials').style.display = 'flex';
    }

    // Show/Hide navigation items depending on role
    if (currentUser.role === 'admin') {
      qAll('.admin-only-nav').forEach(el => el.style.display = 'flex');
      qAll('.admin-only-btn').forEach(el => el.style.display = 'inline-flex');
    } else {
      qAll('.admin-only-nav').forEach(el => el.style.display = 'none');
      qAll('.admin-only-btn').forEach(el => el.style.display = 'none');
    }

    // Check if there is a pending QR scan
    if (window.pendingEqDetailId) {
      const eqId = window.pendingEqDetailId;
      window.pendingEqDetailId = null;
      window.location.hash = ''; // Clear hash
      navigateTo('inventory');
      showEquipmentDetails(eqId);
    } else {
      // Default to Dashboard
      navigateTo('dashboard');
    }
  }

  // ==========================================
  // 2. SPA ROUTER & SIDEBAR
  // ==========================================
  function navigateTo(sectionId) {
    activeSection = sectionId;

    // Update active nav link
    qAll('.nav-item').forEach(link => {
      if (link.dataset.section === sectionId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Hide all sections, show active
    qAll('.content-section').forEach(sec => {
      if (sec.id === `${sectionId}Section`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Load section specific details
    switch (sectionId) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'inventory':
        renderEquipment();
        break;
      case 'borrow':
        renderBorrowReturn();
        break;
      case 'vendors':
        renderVendors();
        break;
      case 'users':
        renderUsers();
        break;
      case 'settings':
        if (currentUser.role === 'admin') {
          renderCustomSettings();
        } else {
          navigateTo('dashboard');
        }
        break;
    }

    // Scroll to top
    q('.content-body').scrollTop = 0;
  }

  function refreshActiveSection() {
    if (!currentUser) return;
    switch (activeSection) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'inventory':
        renderEquipment();
        break;
      case 'borrow':
        renderBorrowReturn();
        break;
      case 'vendors':
        renderVendors();
        break;
      case 'users':
        renderUsers();
        break;
      case 'settings':
        if (currentUser.role === 'admin') {
          renderCustomSettings();
        } else {
          navigateTo('dashboard');
        }
        break;
    }
  }

  // ==========================================
  // 3. DASHBOARD VIEW
  // ==========================================
  function renderDashboard() {
    const eqList = db.getEquipment();
    const txList = db.getTransactions();

    // Stats
    const totalCount = eqList.length;
    const readyCount = eqList.filter(x => x.status === 'พร้อมใช้งาน').length;
    const borrowedCount = eqList.filter(x => x.status === 'ถูกยืม').length;
    const damagedCount = eqList.filter(x => x.status === 'ชำรุด').length;

    $('dashStatTotal').textContent = totalCount;
    $('dashStatReady').textContent = readyCount;
    $('dashStatBorrowed').textContent = borrowedCount;
    $('dashStatDamaged').textContent = damagedCount;

    // Overdue items calculation
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueList = txList.filter(tx => tx.status === 'ถูกยืม' && tx.expectedReturnDate && tx.expectedReturnDate < todayStr);
    const overdueContainer = $('overdueWarningContainer');
    const overdueListEl = $('overdueItemsList');
    
    if (overdueList.length > 0) {
      overdueContainer.style.display = 'block';
      overdueListEl.innerHTML = '';
      overdueList.forEach(tx => {
        const eq = db.getEquipmentById(tx.equipmentId);
        const borrower = db.getUsers().find(u => u.id === tx.userId);
        const row = document.createElement('div');
        row.className = 'overdue-item-row';
        row.innerHTML = `
          <div>
            <strong>[${tx.equipmentId}] ${eq ? eq.name : 'ไม่พบข้อมูลครุภัณฑ์'}</strong> - ยืมโดย ${borrower ? borrower.name : 'ผู้ใช้'}
          </div>
          <div style="color: var(--danger); font-weight: 700;">
            กำหนดคืนเมื่อ: ${formatThaiDate(tx.expectedReturnDate)} (เลยกำหนด)
          </div>
        `;
        overdueListEl.appendChild(row);
      });
    } else {
      overdueContainer.style.display = 'none';
    }

    // Calculate Top 5 Borrowed Items
    const borrowCounts = {};
    txList.forEach(tx => {
      borrowCounts[tx.equipmentId] = (borrowCounts[tx.equipmentId] || 0) + 1;
    });

    const sortedCounts = Object.entries(borrowCounts)
      .map(([id, count]) => {
        const item = db.getEquipmentById(id);
        return {
          id,
          name: item ? item.name : 'ไม่ระบุชื่อ',
          count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Populate Top 5 Borrowed list
    const container = $('topBorrowedList');
    container.innerHTML = '';
    if (sortedCounts.length === 0) {
      container.innerHTML = `<div class="text-center py-4" style="color: var(--text-light)">ยังไม่มีข้อมูลการยืมครุภัณฑ์</div>`;
    } else {
      sortedCounts.forEach((item, index) => {
        const rank = index + 1;
        const div = document.createElement('div');
        div.className = 'top-borrowed-item';
        div.innerHTML = `
          <div class="top-borrowed-rank rank-${rank}">${rank}</div>
          <div class="top-borrowed-name" title="${item.name}">${item.name}</div>
          <div class="top-borrowed-count">${item.count} ครั้ง</div>
        `;
        container.appendChild(div);
      });
    }

    // Render Recent Activities list
    const recentContainer = $('recentActivityList');
    recentContainer.innerHTML = '';
    
    // Extract borrow and return activities
    const activities = [];
    txList.forEach(tx => {
      activities.push({
        type: 'borrow',
        date: tx.borrowDate,
        txId: tx.id,
        userId: tx.userId,
        equipmentId: tx.equipmentId
      });
      if (tx.actualReturnDate) {
        activities.push({
          type: 'return',
          date: tx.actualReturnDate,
          txId: tx.id,
          userId: tx.userId,
          equipmentId: tx.equipmentId
        });
      }
    });

    // Sort by date desc, then txId desc
    activities.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.txId - a.txId;
    });

    const topActivities = activities.slice(0, 5);

    if (topActivities.length === 0) {
      recentContainer.innerHTML = `<div class="text-center py-4" style="color: var(--text-light)">ยังไม่มีความเคลื่อนไหวในระบบ</div>`;
    } else {
      topActivities.forEach(act => {
        const eq = db.getEquipmentById(act.equipmentId);
        const user = db.getUserById(act.userId);
        
        const isReturn = act.type === 'return';
        const iconClass = isReturn ? 'icon-arrow-down-left' : 'icon-arrow-up-right';
        const wrapperClass = isReturn ? 'return' : 'borrow';
        const actionText = isReturn ? 'ส่งคืนครุภัณฑ์' : 'ยืมครุภัณฑ์';
        
        const div = document.createElement('div');
        div.className = 'recent-activity-item';
        div.style.cursor = 'pointer';
        div.title = 'คลิกเพื่อดูรายละเอียดรายการนี้';
        div.innerHTML = `
          <div class="activity-icon-wrapper ${wrapperClass}">
            <i class="${iconClass}"></i>
          </div>
          <div class="activity-details">
            <strong>${user ? user.name : 'ไม่ระบุผู้ยืม'}</strong> ${actionText} <strong>${eq ? eq.name : 'อุปกรณ์'}</strong>
          </div>
          <div class="activity-time">
            ${formatThaiDate(act.date)}
          </div>
        `;
        
        div.addEventListener('click', () => {
          showBorrowDetail(act.txId);
        });
        
        recentContainer.appendChild(div);
      });
    }

    // Render Chart.js graphs
    renderDashboardCharts(eqList, sortedCounts);
  }

  function renderDashboardCharts(eqList, topBorrowed) {
    if (charts.categoryChart) charts.categoryChart.destroy();
    if (charts.borrowedChart) charts.borrowedChart.destroy();

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded yet');
      return;
    }

    const categories = db.getCategories();
    const catData = {};
    categories.forEach(c => {
      catData[c.name] = 0;
    });
    eqList.forEach(e => {
      const cat = categories.find(c => c.id === e.categoryId);
      if (cat) {
        catData[cat.name] = (catData[cat.name] || 0) + 1;
      } else {
        catData['อื่นๆ'] = (catData['อื่นๆ'] || 0) + 1;
      }
    });

    const filteredCatData = Object.entries(catData).filter(([_, val]) => val > 0);
    const catLabels = filteredCatData.map(([name, _]) => name);
    const catCounts = filteredCatData.map(([_, val]) => val);

    // Render Category Distribution (Doughnut Chart - Blue & Yellow scheme)
    const isDark = document.body.classList.contains('dark-mode');
    const textCol = isDark ? '#94a3b8' : '#475569';
    const borderCol = isDark ? '#1e293b' : '#ffffff';

    const ctxCat = $('categoryChartCanvas').getContext('2d');
    charts.categoryChart = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels.length > 0 ? catLabels : ['ไม่มีข้อมูล'],
        datasets: [{
          data: catCounts.length > 0 ? catCounts : [0],
          backgroundColor: [
            '#1e3a8a', '#eab308', '#2563eb', '#facc15', '#10b981', 
            '#3b82f6', '#f59e0b', '#34d399', '#64748b', '#cbd5e1'
          ],
          borderColor: borderCol,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textCol,
              font: { family: 'Noto Sans Thai', size: 11 }
            }
          }
        }
      }
    });

    // Render Top Borrowed Chart (Bar Chart - Blue & Yellow scheme)
    const barLabels = topBorrowed.map(x => x.name.length > 20 ? x.name.substring(0, 20) + '...' : x.name);
    const barCounts = topBorrowed.map(x => x.count);

    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#eab308';

    const ctxBar = $('borrowedChartCanvas').getContext('2d');
    charts.borrowedChart = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: barLabels.length > 0 ? barLabels : ['ไม่มีข้อมูล'],
        datasets: [{
          label: 'จำนวนครั้งที่ถูกยืม',
          data: barCounts.length > 0 ? barCounts : [0],
          backgroundColor: accentColor + 'bf', // 75% opacity
          hoverBackgroundColor: accentColor,
          borderColor: accentColor,
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: textCol, font: { family: 'Noto Sans Thai', size: 10 } },
            grid: { display: false }
          },
          y: {
            ticks: { 
              color: textCol, 
              font: { family: 'Inter', size: 10 },
              stepSize: 1,
              precision: 0 
            },
            grid: { color: isDark ? '#1e293b' : '#f1f5f9' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // ==========================================
  // 4. EQUIPMENT INVENTORY VIEW
  // ==========================================
  let eqSearchQuery = '';
  let eqCategoryFilter = 'all';
  let eqLocationFilter = 'all';
  let eqStatusFilter = 'all';

  function renderEquipment() {
    const container = $('equipmentGrid');
    const eqList = db.getEquipment();
    const categories = db.getCategories();
    const locations = db.getLocations();

    populateFilterOptions(categories, locations);

    const filtered = eqList.filter(eq => {
      const matchSearch = eq.name.toLowerCase().includes(eqSearchQuery.toLowerCase()) || 
                          eq.id.toLowerCase().includes(eqSearchQuery.toLowerCase()) ||
                          eq.assetNumber.toLowerCase().includes(eqSearchQuery.toLowerCase());
      
      const matchCategory = eqCategoryFilter === 'all' || String(eq.categoryId) === String(eqCategoryFilter);
      const matchLocation = eqLocationFilter === 'all' || String(eq.locationId) === String(eqLocationFilter);
      const matchStatus = eqStatusFilter === 'all' || eq.status === eqStatusFilter;

      return matchSearch && matchCategory && matchLocation && matchStatus;
    });

    container.innerHTML = '';
    
    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-light)">
          <i class="icon-package-open" style="font-size: 3rem; margin-bottom: 16px; display: block"></i>
          ไม่พบข้อมูลครุภัณฑ์/อุปกรณ์ที่ตรงกับเงื่อนไข
        </div>
      `;
      return;
    }

    filtered.forEach(eq => {
      const cat = categories.find(c => String(c.id) === String(eq.categoryId));
      const loc = locations.find(l => String(l.id) === String(eq.locationId));
      
      let statusClass = 'status-ready';
      if (eq.status === 'ถูกยืม') statusClass = 'status-borrowed';
      else if (eq.status === 'ชำรุด') statusClass = 'status-damaged';
      else if (eq.status === 'รออนุมัติยืม') statusClass = 'status-pending-borrow';
      else if (eq.status === 'รออนุมัติคืน') statusClass = 'status-pending-return';
      else if (eq.status === 'ปฏิเสธการยืม') statusClass = 'status-rejected';

      const card = document.createElement('div');
      card.className = 'equipment-card';
      card.innerHTML = `
        <div class="equipment-image-container" style="cursor: pointer;">
          <img class="equipment-image" src="${eq.imageUrl}" alt="${eq.name}" onerror="this.src='Logo/budtec_logo_notext.png'">
          <span class="equipment-status-badge ${statusClass}">${eq.status}</span>
          <span class="equipment-id-tag">${eq.id}</span>
        </div>
        <div class="equipment-info">
          <div class="equipment-category" style="cursor: pointer;">${cat ? cat.name : 'ไม่ระบุหมวดหมู่'}</div>
          <h3 class="equipment-name" style="cursor: pointer;" title="${eq.name}">${eq.name}</h3>
          
          <div class="equipment-meta-row" style="cursor: pointer;">
            <span>เลขครุภัณฑ์:</span>
            <span style="font-weight: 500">${eq.assetNumber || '-'}</span>
          </div>
          <div class="equipment-meta-row" style="cursor: pointer;">
            <span>สถานที่เก็บ:</span>
            <span>${loc ? loc.name : 'ไม่ระบุสถานที่'}</span>
          </div>
          <div class="equipment-meta-row" style="cursor: pointer;">
            <span>ราคาจัดซื้อ:</span>
            <span class="equipment-price">฿${eq.price.toLocaleString()}</span>
          </div>
          
          <div class="equipment-actions">
            ${eq.manualUrl ? `<button class="btn btn-secondary btn-sm btn-manual" data-id="${eq.id}"><i class="icon-file-text"></i> คู่มือ</button>` : ''}
            ${currentUser.role === 'admin' 
              ? `<button class="btn btn-sm btn-edit-eq" data-id="${eq.id}"><i class="icon-edit-3"></i> แก้ไข</button>
                 <button class="btn btn-sm btn-delete-eq" data-id="${eq.id}"><i class="icon-trash-2"></i> ลบ</button>`
              : ''
            }
            ${eq.status === 'พร้อมใช้งาน' 
              ? `<button class="btn btn-primary btn-sm btn-borrow-eq" data-id="${eq.id}"><i class="icon-arrow-up-right"></i> ยืม</button>` 
              : ''
            }
            ${eq.status === 'ถูกยืม' && (currentUser.role === 'admin' || isBorrowedByMe(eq.id))
              ? `<button class="btn btn-warning btn-sm btn-return-eq" data-id="${eq.id}"><i class="icon-arrow-down-left"></i> คืน</button>`
              : ''
            }
          </div>
        </div>
      `;
      
      // Click details modal
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.btn') || e.target.closest('.btn-icon')) {
          return;
        }
        showEquipmentDetails(eq.id);
      });

      container.appendChild(card);
    });

    // Attach listeners
    qAll('.btn-manual').forEach(btn => btn.addEventListener('click', () => showManualModal(btn.dataset.id)));
    qAll('.btn-edit-eq').forEach(btn => btn.addEventListener('click', () => showEquipmentForm(btn.dataset.id)));
    qAll('.btn-delete-eq').forEach(btn => btn.addEventListener('click', () => deleteEquipment(btn.dataset.id)));
    qAll('.btn-borrow-eq').forEach(btn => btn.addEventListener('click', () => showBorrowModal(btn.dataset.id)));
    qAll('.btn-return-eq').forEach(btn => btn.addEventListener('click', () => showReturnModal(btn.dataset.id)));
  }

  function downloadEquipmentCSV() {
    const eqList = db.getEquipment();
    const categories = db.getCategories();
    const locations = db.getLocations();
    const fundingSources = db.getFundingSources();
    const vendors = db.getVendors();

    // CSV Headers
    const headers = [
      'รหัสครุภัณฑ์ (BudTEC)',
      'เลขครุภัณฑ์ (พัสดุ)',
      'ชื่อครุภัณฑ์ / อุปกรณ์',
      'ราคาจัดซื้อ (บาท)',
      'ปีงบประมาณ',
      'หมวดหมู่',
      'สถานที่จัดเก็บหลัก',
      'หมวดเงินงบประมาณ',
      'บริษัทผู้ขาย',
      'สถานะปัจจุบัน',
      'ลิงก์รูปภาพครุภัณฑ์'
    ];

    // CSV Rows
    const rows = [headers];

    eqList.forEach(eq => {
      const cat = categories.find(c => String(c.id) === String(eq.categoryId));
      const loc = locations.find(l => String(l.id) === String(eq.locationId));
      const fund = fundingSources.find(f => String(f.id) === String(eq.fundingSourceId));
      const vendor = vendors.find(v => String(v.id) === String(eq.vendorId));

      const row = [
        eq.id,
        eq.assetNumber || '',
        eq.name,
        eq.price,
        eq.fiscalYear || '',
        cat ? cat.name : '',
        loc ? loc.name : '',
        fund ? fund.name : '',
        vendor ? vendor.companyName : '',
        eq.status,
        eq.imageUrl || ''
      ];
      
      // Escape CSV values (replace quotes with double quotes, wrap in quotes if contains special characters)
      const escapedRow = row.map(val => {
        let str = String(val === null || val === undefined ? '' : val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });

      rows.push(escapedRow);
    });

    // Generate CSV String
    const csvContent = rows.map(r => r.join(',')).join('\r\n');
    
    // Create Blob with UTF-8 BOM to ensure Excel opens Thai text correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BudTEC_Equipment_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function populateFilterOptions(categories, locations) {
    const catSelect = $('filterCategory');
    const locSelect = $('filterLocation');

    if (catSelect.options.length <= 1) {
      categories.forEach(c => {
        catSelect.add(new Option(c.name, c.id));
      });
    } else {
      const val = catSelect.value;
      catSelect.innerHTML = '<option value="all">ทุกหมวดหมู่</option>';
      categories.forEach(c => {
        catSelect.add(new Option(c.name, c.id));
      });
      catSelect.value = val;
    }

    if (locSelect.options.length <= 1) {
      locations.forEach(l => {
        locSelect.add(new Option(l.name, l.id));
      });
    } else {
      const val = locSelect.value;
      locSelect.innerHTML = '<option value="all">ทุกสถานที่เก็บ</option>';
      locations.forEach(l => {
        locSelect.add(new Option(l.name, l.id));
      });
      locSelect.value = val;
    }
  }

  function isBorrowedByMe(equipmentId) {
    const txs = db.getTransactions();
    const activeTx = txs.find(x => x.equipmentId === equipmentId && x.status === 'ถูกยืม');
    return activeTx && activeTx.userId === currentUser.id;
  }

  // ==========================================
  // 5. EQUIPMENT FORM (ADD & EDIT)
  // ==========================================
  let selectedImageUrl = '';

  function showEquipmentForm(eqId = null) {
    const modal = $('equipmentModal');
    const form = $('equipmentForm');
    form.reset();

    populateFormDropdowns();

    selectedImageUrl = 'Logo/budtec_logo_notext.png';
    qAll('.preset-img-option').forEach(el => el.classList.remove('selected'));
    q('.preset-img-option').classList.add('selected'); // default

    if (eqId) {
      const eq = db.getEquipmentById(eqId);
      if (!eq) return;

      $('eqFormId').value = eq.id;
      $('eqFormTitle').textContent = `แก้ไขข้อมูลครุภัณฑ์: ${eq.id}`;
      $('eqFormAssetNumber').value = eq.assetNumber;
      $('eqFormName').value = eq.name;
      $('eqFormPrice').value = eq.price;
      $('eqFormFiscalYear').value = eq.fiscalYear;
      $('eqFormCategory').value = eq.categoryId;
      $('eqFormLocation').value = eq.locationId;
      $('eqFormFundingSource').value = eq.fundingSourceId;
      $('eqFormVendor').value = eq.vendorId;
      $('eqFormStatus').value = eq.status;
      $('eqFormManualUrl').value = eq.manualUrl;
      
      selectedImageUrl = eq.imageUrl;
      qAll('.preset-img-option').forEach(el => {
        if (el.dataset.url === eq.imageUrl) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
    } else {
      $('eqFormId').value = '';
      $('eqFormTitle').textContent = 'เพิ่มข้อมูลครุภัณฑ์ / อุปกรณ์';
      $('eqFormStatus').value = 'พร้อมใช้งาน';
      $('eqFormFiscalYear').value = new Date().getFullYear() + 543;
    }

    openModal(modal);
  }

  function populateFormDropdowns() {
    const categories = db.getCategories();
    const locations = db.getLocations();
    const fundingSources = db.getFundingSources();
    const vendors = db.getVendors();

    const catEl = $('eqFormCategory');
    const locEl = $('eqFormLocation');
    const fundEl = $('eqFormFundingSource');
    const vendEl = $('eqFormVendor');

    catEl.innerHTML = '<option value="">-- เลือกหมวดหมู่ --</option>';
    categories.forEach(c => catEl.add(new Option(c.name, c.id)));

    locEl.innerHTML = '<option value="">-- เลือกสถานที่เก็บ --</option>';
    locations.forEach(l => locEl.add(new Option(l.name, l.id)));

    fundEl.innerHTML = '<option value="">-- เลือกหมวดเงิน --</option>';
    fundingSources.forEach(f => fundEl.add(new Option(f.name, f.id)));

    vendEl.innerHTML = '<option value="">-- เลือกบริษัทผู้ขาย --</option>';
    vendors.forEach(v => vendEl.add(new Option(v.companyName, v.id)));
  }

  function handleEquipmentSubmit(e) {
    e.preventDefault();
    const eqId = $('eqFormId').value;
    
    const eqData = {
      assetNumber: $('eqFormAssetNumber').value.trim(),
      name: $('eqFormName').value.trim(),
      price: Number($('eqFormPrice').value),
      fiscalYear: Number($('eqFormFiscalYear').value),
      categoryId: parseId($('eqFormCategory').value),
      locationId: parseId($('eqFormLocation').value),
      fundingSourceId: parseId($('eqFormFundingSource').value),
      vendorId: parseId($('eqFormVendor').value),
      status: $('eqFormStatus').value,
      manualUrl: $('eqFormManualUrl').value.trim(),
      imageUrl: selectedImageUrl
    };

    if (!eqData.name || !eqData.categoryId || !eqData.locationId || !eqData.fundingSourceId) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อครุภัณฑ์, หมวดหมู่, สถานที่เก็บ, และหมวดเงิน)');
      return;
    }

    if (eqId) {
      db.updateEquipment(eqId, eqData);
    } else {
      db.addEquipment(eqData);
    }

    closeModal($('equipmentModal'));
    renderEquipment();
    renderDashboard();
  }

  function deleteEquipment(id) {
    const eq = db.getEquipmentById(id);
    if (!eq) return;

    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบครุภัณฑ์รหัส ${id} (${eq.name})?`)) {
      const res = db.deleteEquipment(id);
      if (res.success) {
        renderEquipment();
        renderDashboard();
        const detailModal = $('equipmentDetailModal');
        if (detailModal && detailModal.classList.contains('active')) {
          closeModal(detailModal);
        }
      } else {
        alert(res.message);
      }
    }
  }

  qAll('.preset-img-option').forEach(el => {
    el.addEventListener('click', () => {
      qAll('.preset-img-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      selectedImageUrl = el.dataset.url;
    });
  });

  $('eqFormImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (window.BudTEC_UseGoogleSheets) {
        const saveBtn = q('#equipmentModal button[type="submit"]');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="icon-loader animate-spin"></i> กำลังอัปโหลดรูปภาพ...';
        }
        try {
          selectedImageUrl = await window.uploadFileToGoogleDrive(file, 'equipment');
          qAll('.preset-img-option').forEach(o => o.classList.remove('selected'));
        } catch (err) {
          alert('อัปโหลดรูปภาพล้มเหลว: ' + err.message);
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="icon-save"></i> บันทึกรายการ';
          }
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          selectedImageUrl = event.target.result;
          qAll('.preset-img-option').forEach(o => o.classList.remove('selected'));
        };
        reader.readAsDataURL(file);
      }
    }
  });

  $('eqFormManualFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (window.BudTEC_UseGoogleSheets) {
        const saveBtn = q('#equipmentModal button[type="submit"]');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="icon-loader animate-spin"></i> กำลังอัปโหลดคู่มือ...';
        }
        try {
          const manualUrl = await window.uploadFileToGoogleDrive(file, 'manuals');
          $('eqFormManualUrl').value = manualUrl;
        } catch (err) {
          alert('อัปโหลดคู่มือล้มเหลว: ' + err.message);
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="icon-save"></i> บันทึกรายการ';
          }
        }
      } else {
        $('eqFormManualUrl').value = `Manuals/${file.name}`;
      }
    }
  });

  function showManualModal(eqId) {
    const eq = db.getEquipmentById(eqId);
    if (!eq || !eq.manualUrl) return;

    $('manualTitle').textContent = `คู่มือการใช้งาน: ${eq.name}`;
    $('manualFileName').textContent = eq.manualUrl.replace('Manuals/', '');
    openModal($('manualModal'));
  }

  // ==========================================
  // 6. BORROW-RETURN SYSTEM
  // ==========================================
  function showBorrowModal(eqId) {
    const eq = db.getEquipmentById(eqId);
    if (!eq) return;

    $('borrowEqId').value = eq.id;
    $('borrowTitle').textContent = `ยืนยันการยืม: [${eq.id}] ${eq.name}`;
    $('borrowDate').value = new Date().toISOString().split('T')[0];
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    $('expectedReturnDate').value = nextWeek.toISOString().split('T')[0];
    
    $('borrowPurpose').value = '';
    $('borrowNotes').value = '';

    openModal($('borrowModal'));
  }

  function handleBorrowSubmit(e) {
    e.preventDefault();
    const eqId = $('borrowEqId').value;
    const details = {
      borrowDate: $('borrowDate').value,
      expectedReturnDate: $('expectedReturnDate').value,
      purpose: $('borrowPurpose').value.trim(),
      notes: $('borrowNotes').value.trim()
    };

    if (!details.expectedReturnDate || !details.purpose) {
      alert('กรุณากรอกกำหนดวันส่งคืนและวัตถุประสงค์การยืม');
      return;
    }

    const res = db.borrowEquipment(eqId, currentUser.id, details);
    if (res.success) {
      // Send Telegram Notify
      const eq = db.getEquipmentById(eqId);
      const itemUrl = `${window.location.origin}${window.location.pathname}#/equipment/${eqId}`;
      let msg = `<b><a href="${itemUrl}">🔔 [คำขอยืมครุภัณฑ์ใหม่]</a></b>\n<b>รหัสครุภัณฑ์:</b> ${eqId}\n<b>ครุภัณฑ์:</b> ${eq ? eq.name : ''}\n<b>ผู้ขอยืม:</b> ${currentUser.name} (${currentUser.department || '-'})\n<b>กำหนดส่งคืน:</b> ${formatThaiDate(details.expectedReturnDate)}\n<b>วัตถุประสงค์:</b> ${details.purpose}`;
      if (details.notes) {
        msg += `\n<b>หมายเหตุการยืม:</b> ${details.notes}`;
      }
      sendTelegramNotification(msg, eq ? eq.imageUrl : null);

      closeModal($('borrowModal'));
      renderEquipment();
      renderDashboard();
      
      if (confirm('ส่งคำขออนุมัติยืมครุภัณฑ์สำเร็จ! ต้องการไปที่หน้ารายการยืม-คืนของคุณเพื่อดูสถานะการอนุมัติหรือไม่?')) {
        navigateTo('borrow');
      }
    } else {
      alert(res.message);
    }
  }

  function showReturnModal(eqId) {
    const eq = db.getEquipmentById(eqId);
    if (!eq) return;

    const txList = db.getTransactions();
    const tx = txList.find(x => x.equipmentId === eq.id && x.status === 'ถูกยืม');
    if (!tx) return;

    $('returnEqId').value = eq.id;
    $('returnTxId').value = tx.id;
    $('returnTitle').textContent = `ยืนยันการคืน: [${eq.id}] ${eq.name}`;
    $('returnDate').value = new Date().toISOString().split('T')[0];
    $('returnIsDamaged').checked = false;
    $('returnNotes').value = '';

    openModal($('returnModal'));
  }

  function handleReturnSubmit(e) {
    e.preventDefault();
    const eqId = $('returnEqId').value;
    const txId = $('returnTxId').value;
    const details = {
      returnDate: $('returnDate').value,
      isDamaged: $('returnIsDamaged').checked,
      notes: $('returnNotes').value.trim()
    };

    const res = db.returnEquipment(eqId, txId, details);
    if (res.success) {
      // Send Telegram Notify
      const eq = db.getEquipmentById(eqId);
      const itemUrl = `${window.location.origin}${window.location.pathname}#/equipment/${eqId}`;
      let msg = `<b><a href="${itemUrl}">🔔 [คำขอคืนครุภัณฑ์]</a></b>\n<b>รหัสครุภัณฑ์:</b> ${eqId}\n<b>ครุภัณฑ์:</b> ${eq ? eq.name : ''}\n<b>ผู้ส่งคืน:</b> ${currentUser.name} (${currentUser.department || '-'})\n<b>วันที่คืนจริง:</b> ${formatThaiDate(details.returnDate)}\n<b>สภาพเครื่องหลังใช้:</b> ${details.isDamaged ? 'ชำรุดเสียหาย (ส่งซ่อม)' : 'ปกติ'}`;
      if (details.notes) {
        msg += `\n<b>หมายเหตุการคืน:</b> ${details.notes}`;
      }
      sendTelegramNotification(msg, eq ? eq.imageUrl : null);

      closeModal($('returnModal'));
      renderEquipment();
      renderDashboard();
      
      if (activeSection === 'borrow') {
        renderBorrowReturn();
      }
      alert('ส่งคำขอคืนครุภัณฑ์สำเร็จแล้ว กรุณารอผู้ดูแลระบบอนุมัติการส่งคืน');
    } else {
      alert(res.message);
    }
  }

  function renderBorrowReturn() {
    const txList = db.getTransactions();
    const eqList = db.getEquipment();
    const users = db.getUsers();

    const tbody = $('borrowLogsTableBody');
    tbody.innerHTML = '';

    const visibleTxs = txList.filter(tx => {
      return currentUser.role === 'admin' || tx.userId === currentUser.id;
    }).reverse();

    if (visibleTxs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color: var(--text-light)">ไม่พบประวัติการยืม-คืนครุภัณฑ์</td></tr>`;
      return;
    }

    visibleTxs.forEach(tx => {
      const eq = eqList.find(e => e.id === tx.equipmentId);
      const user = users.find(u => u.id === tx.userId);

      let statusBadge = '';
      if (tx.status === 'ถูกยืม') {
        statusBadge = `<span class="badge badge-warning">กำลังยืม</span>`;
      } else if (tx.status === 'คืนแล้ว') {
        statusBadge = `<span class="badge badge-success">คืนเรียบร้อย</span>`;
      } else if (tx.status === 'รออนุมัติยืม') {
        statusBadge = `<span class="badge badge-pending-borrow">รออนุมัติยืม</span>`;
      } else if (tx.status === 'รออนุมัติคืน') {
        statusBadge = `<span class="badge badge-pending-return">รออนุมัติคืน</span>`;
      } else if (tx.status === 'ปฏิเสธการยืม') {
        statusBadge = `<span class="badge badge-rejected">ปฏิเสธการยืม</span>`;
      } else {
        statusBadge = `<span class="badge badge-info">${tx.status}</span>`;
      }

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'คลิกเพื่อดูรายละเอียดรายการยืม-คืน';
      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 600">${tx.equipmentId}</td>
        <td><div style="font-weight: 500">${eq ? eq.name : 'ไม่พบข้อมูลครุภัณฑ์'}</div></td>
        <td>${user ? user.name : 'ไม่ทราบผู้ใช้งาน'}</td>
        <td style="font-size: 0.85rem">${formatThaiDate(tx.borrowDate)}</td>
        <td style="font-size: 0.85rem">${formatThaiDate(tx.expectedReturnDate)}</td>
        <td style="font-size: 0.85rem">${tx.actualReturnDate ? formatThaiDate(tx.actualReturnDate) : '-'}</td>
        <td>${statusBadge}</td>
      `;

      tr.addEventListener('click', () => {
        showBorrowDetail(tx.id);
      });

      tbody.appendChild(tr);
    });
  }

  function showBorrowDetail(txId) {
    const tx = db.getTransactionById(txId);
    if (!tx) return;

    const eq = db.getEquipmentById(tx.equipmentId);
    const user = db.getUserById(tx.userId);

    // Populate Equipment details
    $('borrowDetailEqName').textContent = eq ? eq.name : 'ไม่พบข้อมูลครุภัณฑ์';
    $('borrowDetailEqId').textContent = `รหัสครุภัณฑ์: ${tx.equipmentId}`;
    $('borrowDetailEqImage').src = eq && eq.imageUrl ? eq.imageUrl : 'Logo/budtec_logo_notext.png';

    // Populate User details
    $('borrowDetailUserName').textContent = user ? user.name : 'ไม่ทราบชื่อผู้ยืม';
    $('borrowDetailUserDept').textContent = user ? `กลุ่มงาน/สังกัด: ${user.department || '-'}` : '-';
    $('borrowDetailUserContact').textContent = user ? `อีเมล: ${user.email || '-'} | โทร: ${user.phone || '-'}` : '-';
    $('borrowDetailUserAvatar').src = user && user.avatarUrl ? user.avatarUrl : 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';

    // Dates
    $('borrowDetailDate').textContent = formatThaiDate(tx.borrowDate);
    $('borrowDetailExpectedReturnDate').textContent = formatThaiDate(tx.expectedReturnDate);
    
    if (tx.status === 'รออนุมัติคืน') {
      $('borrowDetailActualReturnDate').textContent = `รออนุมัติ (${formatThaiDate(tx.pendingReturnDate)})`;
      $('borrowDetailActualReturnDate').style.color = 'var(--text-secondary)';
    } else if (tx.actualReturnDate) {
      $('borrowDetailActualReturnDate').textContent = formatThaiDate(tx.actualReturnDate);
      $('borrowDetailActualReturnDate').style.color = 'var(--success)';
    } else {
      $('borrowDetailActualReturnDate').textContent = 'ยังไม่ส่งคืน';
      $('borrowDetailActualReturnDate').style.color = 'var(--text-light)';
    }

    // Status Badge
    const badge = $('borrowDetailStatusBadge');
    badge.className = 'badge';
    if (tx.status === 'ถูกยืม') {
      badge.classList.add('badge-warning');
      badge.textContent = 'กำลังยืม';
    } else if (tx.status === 'คืนแล้ว') {
      badge.classList.add('badge-success');
      badge.textContent = 'คืนเรียบร้อย';
    } else if (tx.status === 'รออนุมัติยืม') {
      badge.classList.add('badge-pending-borrow');
      badge.textContent = 'รออนุมัติยืม';
    } else if (tx.status === 'รออนุมัติคืน') {
      badge.classList.add('badge-pending-return');
      badge.textContent = 'รออนุมัติคืน';
    } else if (tx.status === 'ปฏิเสธการยืม') {
      badge.classList.add('badge-rejected');
      badge.textContent = 'ปฏิเสธการยืม';
    } else {
      badge.classList.add('badge-info');
      badge.textContent = tx.status;
    }

    // Purpose & Notes
    $('borrowDetailPurpose').textContent = tx.purpose || '-';
    
    let notesText = tx.notes || '-';
    if (tx.status === 'รออนุมัติคืน') {
      const pendingNotes = tx.pendingNotes ? ` (หมายเหตุส่งคืน: ${tx.pendingNotes})` : '';
      const pendingDamaged = tx.pendingIsDamaged ? ' [แจ้งชำรุด]' : '';
      notesText = `รออนุมัติคืน - วันส่งคืนจริง: ${formatThaiDate(tx.pendingReturnDate)}${pendingDamaged}${pendingNotes}`;
    }
    $('borrowDetailNotes').textContent = notesText;

    // Admin Return Action Button
    const returnActionArea = $('adminReturnActionArea');
    if (tx.status === 'ถูกยืม' && currentUser.role === 'admin') {
      returnActionArea.style.display = 'block';
      const btn = $('btnAdminReturnEquipment');
      
      // Clone button to clear listeners
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', () => {
        closeModal($('borrowDetailModal'));
        showReturnModal(tx.equipmentId);
      });
    } else {
      returnActionArea.style.display = 'none';
    }

    // Admin Approval Action Buttons
    const approvalArea = $('adminApprovalActionArea');
    if (currentUser.role === 'admin' && (tx.status === 'รออนุมัติยืม' || tx.status === 'รออนุมัติคืน')) {
      approvalArea.style.display = 'flex';
      
      const btnApprove = $('btnAdminApprove');
      const btnReject = $('btnAdminReject');
      
      const newApprove = btnApprove.cloneNode(true);
      btnApprove.parentNode.replaceChild(newApprove, btnApprove);
      
      const newReject = btnReject.cloneNode(true);
      btnReject.parentNode.replaceChild(newReject, btnReject);
      
      newApprove.addEventListener('click', () => {
        let res;
        const txStatusBefore = tx.status;
        const borrowNotesBefore = tx.notes;
        const returnNotesBefore = tx.pendingNotes;
        if (tx.status === 'รออนุมัติยืม') {
          res = db.approveBorrow(tx.id);
        } else {
          res = db.approveReturn(tx.id);
        }
        
        if (res.success) {
          alert('อนุมัติรายการเรียบร้อยแล้ว');

          // Send Telegram Notify
          const latestEq = db.getEquipmentById(tx.equipmentId);
          const borrower = db.getUserById(tx.userId);
          const itemUrl = `${window.location.origin}${window.location.pathname}#/equipment/${tx.equipmentId}`;
          let msg = '';
          if (txStatusBefore === 'รออนุมัติยืม') {
            msg = `<b><a href="${itemUrl}">🟢 [เริ่มการยืม (อนุมัติแล้ว)]</a></b>\n<b>รหัสครุภัณฑ์:</b> ${tx.equipmentId}\n<b>ครุภัณฑ์:</b> ${latestEq ? latestEq.name : ''}\n<b>ผู้ยืม:</b> ${borrower ? borrower.name : ''}\n<b>กำหนดส่งคืน:</b> ${formatThaiDate(tx.expectedReturnDate)}\n<b>อนุมัติโดย:</b> ${currentUser.name}`;
            if (borrowNotesBefore) {
              msg += `\n<b>หมายเหตุการยืม:</b> ${borrowNotesBefore}`;
            }
          } else {
            msg = `<b><a href="${itemUrl}">🔵 [คืนครุภัณฑ์สำเร็จ (อนุมัติแล้ว)]</a></b>\n<b>รหัสครุภัณฑ์:</b> ${tx.equipmentId}\n<b>ครุภัณฑ์:</b> ${latestEq ? latestEq.name : ''}\n<b>ผู้ส่งคืน:</b> ${borrower ? borrower.name : ''}\n<b>สภาพอุปกรณ์หลังคืน:</b> ${latestEq && latestEq.status === 'ชำรุด' ? 'ชำรุด (ส่งซ่อม)' : 'พร้อมใช้งาน (ปกติ)'}\n<b>อนุมัติโดย:</b> ${currentUser.name}`;
            if (returnNotesBefore) {
              msg += `\n<b>หมายเหตุการคืน:</b> ${returnNotesBefore}`;
            }
          }
          sendTelegramNotification(msg, latestEq ? latestEq.imageUrl : null);

          closeModal($('borrowDetailModal'));
          renderBorrowReturn();
          renderEquipment();
          renderDashboard();
        } else {
          alert(res.message);
        }
      });
      
      newReject.addEventListener('click', () => {
        let res;
        const txStatusBefore = tx.status;
        const borrowNotesBefore = tx.notes;
        const returnNotesBefore = tx.pendingNotes;
        if (tx.status === 'รออนุมัติยืม') {
          res = db.rejectBorrow(tx.id);
        } else {
          res = db.rejectReturn(tx.id);
        }
        
        if (res.success) {
          alert('ปฏิเสธรายการเรียบร้อยแล้ว');

          // Send Telegram Notify
          const latestEq = db.getEquipmentById(tx.equipmentId);
          const borrower = db.getUserById(tx.userId);
          const itemUrl = `${window.location.origin}${window.location.pathname}#/equipment/${tx.equipmentId}`;
          let msg = '';
          if (txStatusBefore === 'รออนุมัติยืม') {
            msg = `<b><a href="${itemUrl}">❌ [ปฏิเสธการยืม]</a></b>\n<b>รหัสครุภัณฑ์:</b> ${tx.equipmentId}\n<b>ครุภัณฑ์:</b> ${latestEq ? latestEq.name : ''}\n<b>ผู้ขอพิมพ์:</b> ${borrower ? borrower.name : ''}\n<b>ปฏิเสธโดย:</b> ${currentUser.name}`;
            if (borrowNotesBefore) {
              msg += `\n<b>หมายเหตุการยืม:</b> ${borrowNotesBefore}`;
            }
          } else {
            msg = `<b><a href="${itemUrl}">❌ [ปฏิเสธการคืน]</a></b>\n<b>รหัสครุภัณฑ์:</b> ${tx.equipmentId}\n<b>ครุภัณฑ์:</b> ${latestEq ? latestEq.name : ''}\n<b>ผู้คืน:</b> ${borrower ? borrower.name : ''}\n<b>ปฏิเสธโดย:</b> ${currentUser.name}`;
            if (returnNotesBefore) {
              msg += `\n<b>หมายเหตุการคืน:</b> ${returnNotesBefore}`;
            }
          }
          sendTelegramNotification(msg, latestEq ? latestEq.imageUrl : null);

          closeModal($('borrowDetailModal'));
          renderBorrowReturn();
          renderEquipment();
          renderDashboard();
        } else {
          alert(res.message);
        }
      });
    } else {
      approvalArea.style.display = 'none';
    }

    // User Return Action Button
    const userReturnArea = $('userReturnActionArea');
    if (tx.status === 'ถูกยืม' && currentUser.role !== 'admin' && tx.userId === currentUser.id) {
      userReturnArea.style.display = 'block';
      const btnUserReturn = $('btnUserReturnEquipment');
      
      const newBtnUserReturn = btnUserReturn.cloneNode(true);
      btnUserReturn.parentNode.replaceChild(newBtnUserReturn, btnUserReturn);
      
      newBtnUserReturn.addEventListener('click', () => {
        closeModal($('borrowDetailModal'));
        showReturnModal(tx.equipmentId);
      });
    } else {
      userReturnArea.style.display = 'none';
    }

    openModal($('borrowDetailModal'));
  }

  function formatThaiDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[0], 10) + 543;
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        return `${d} ${months[m - 1]} ${y}`;
      }
      return dateStr;
    } catch(e) {
      return dateStr;
    }
  }

  // ==========================================
  // 7. VENDORS MANAGEMENT
  // ==========================================
  function renderVendors() {
    const list = db.getVendors();
    const tbody = $('vendorsTableBody');
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color: var(--text-light)">ไม่พบข้อมูลบริษัทผู้ขาย</td></tr>`;
      return;
    }

    list.forEach(v => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--primary)">${v.companyName}</td>
        <td>${v.repName || '-'}</td>
        <td>${v.repNickname || '-'}</td>
        <td>${v.phone || '-'}</td>
        <td style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap" title="${v.remarks}">${v.remarks || '-'}</td>
        ${currentUser.role === 'admin' 
          ? `<td>
              <div class="row-actions">
                <button class="btn btn-secondary btn-sm btn-edit-vendor" data-id="${v.id}"><i class="icon-edit-3"></i> แก้ไข</button>
                <button class="btn btn-danger btn-sm btn-delete-vendor" data-id="${v.id}"><i class="icon-trash-2"></i> ลบ</button>
              </div>
            </td>`
          : ''
        }
      `;
      
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.row-actions')) {
          return;
        }
        showVendorDetails(v.id);
      });
      tbody.appendChild(tr);
    });

    if (currentUser.role === 'admin') {
      qAll('.btn-edit-vendor').forEach(btn => btn.addEventListener('click', () => showVendorForm(btn.dataset.id)));
      qAll('.btn-delete-vendor').forEach(btn => btn.addEventListener('click', () => deleteVendor(btn.dataset.id)));
    }
  }

  function showVendorDetails(vId) {
    const v = db.getVendorById(vId);
    if (!v) return;

    $('vDetailCompanyName').textContent = v.companyName;
    $('vDetailRepName').textContent = v.repName || '-';
    $('vDetailRepNickname').textContent = v.repNickname || '-';
    $('vDetailPhone').textContent = v.phone || '-';
    $('vDetailRemarks').textContent = v.remarks || '-';

    const adminActions = $('vDetailAdminActions');
    if (adminActions) {
      if (currentUser.role === 'admin') {
        adminActions.innerHTML = `
          <button class="btn btn-edit-vendor" id="btnDetailEditVendor" data-id="${v.id}"><i class="icon-edit-3"></i> แก้ไข</button>
          <button class="btn btn-delete-vendor" id="btnDetailDeleteVendor" data-id="${v.id}"><i class="icon-trash-2"></i> ลบ</button>
        `;
        $('btnDetailEditVendor').addEventListener('click', () => {
          closeModal($('vendorDetailModal'));
          showVendorForm(v.id);
        });
        $('btnDetailDeleteVendor').addEventListener('click', () => {
          deleteVendor(v.id);
        });
      } else {
        adminActions.innerHTML = '';
      }
    }

    openModal($('vendorDetailModal'));
  }

  function showVendorForm(vId = null) {
    const modal = $('vendorModal');
    const form = $('vendorForm');
    form.reset();

    if (vId) {
      const v = db.getVendorById(vId);
      if (!v) return;

      $('vendorFormId').value = v.id;
      $('vendorFormTitle').textContent = `แก้ไขผู้แทนขาย: ${v.companyName}`;
      $('vendorCompanyName').value = v.companyName;
      $('vendorRepName').value = v.repName;
      $('vendorRepNickname').value = v.repNickname;
      $('vendorPhone').value = v.phone;
      $('vendorRemarks').value = v.remarks;
    } else {
      $('vendorFormId').value = '';
      $('vendorFormTitle').textContent = 'เพิ่มบริษัทผู้ขาย / ตัวแทนจำหน่าย';
    }

    openModal(modal);
  }

  function handleVendorSubmit(e) {
    e.preventDefault();
    const vId = $('vendorFormId').value;
    const details = {
      companyName: $('vendorCompanyName').value.trim(),
      repName: $('vendorRepName').value.trim(),
      repNickname: $('vendorRepNickname').value.trim(),
      phone: $('vendorPhone').value.trim(),
      remarks: $('vendorRemarks').value.trim()
    };

    if (!details.companyName || !details.phone) {
      alert('กรุณากรอกชื่อบริษัทและเบอร์โทรศัพท์ติดต่อ');
      return;
    }

    if (vId) {
      db.updateVendor(vId, details);
    } else {
      db.addVendor(details);
    }

    closeModal($('vendorModal'));
    renderVendors();
  }

  function deleteVendor(id) {
    const v = db.getVendorById(id);
    if (!v) return;

    if (confirm(`ยืนยันการลบข้อมูลบริษัทผู้ขาย ${v.companyName}?`)) {
      const res = db.deleteVendor(id);
      if (res.success) {
        renderVendors();
        const detailModal = $('vendorDetailModal');
        if (detailModal && detailModal.classList.contains('active')) {
          closeModal(detailModal);
        }
      } else {
        alert(res.message);
      }
    }
  }

  // ==========================================
  // 8. USERS MANAGEMENT (AND PROFILE PAGE)
  // ==========================================
  function renderUsers() {
    if (currentUser.role === 'admin') {
      $('usersAdminContainer').style.display = 'block';
      $('usersProfileContainer').style.display = 'none';

      const list = db.getUsers();
      
      // Sort pending (approved === false) first
      list.sort((a, b) => {
        const aApp = a.approved !== false ? 1 : 0;
        const bApp = b.approved !== false ? 1 : 0;
        return aApp - bApp;
      });

      const tbody = $('usersTableBody');
      tbody.innerHTML = '';

      list.forEach(u => {
        let roleLabel = '';
        if (u.approved === false) {
          roleLabel = `<span class="badge badge-warning">รออนุมัติ</span>`;
        } else {
          roleLabel = u.role === 'admin' 
            ? `<span class="badge badge-danger">ผู้ดูแลระบบ</span>` 
            : `<span class="badge badge-info">ผู้ใช้งานทั่วไป</span>`;
        }

        const userAvatarHtml = u.avatarUrl 
          ? `<img class="user-avatar-img" src="${u.avatarUrl}" alt="Avatar" style="width:34px; height:34px; margin-right:10px; vertical-align:middle; border-radius:50%; object-fit:cover; border: 1.5px solid var(--accent);">`
          : `<div class="user-avatar" style="width:34px; height:34px; font-size:0.8rem; margin-right:10px; display:inline-flex; vertical-align:middle; background-color: var(--primary); color:#fff; border-radius:50%; align-items:center; justify-content:center; font-weight:700;">${u.name.charAt(0)}</div>`;

        let actionsHtml = '';
        if (u.approved === false) {
          actionsHtml = `
            <div class="row-actions">
              <button class="btn btn-primary btn-sm btn-approve-user" data-id="${u.id}"><i class="icon-check"></i> อนุมัติ</button>
              <button class="btn btn-danger btn-sm btn-reject-user" data-id="${u.id}"><i class="icon-x"></i> ปฏิเสธ</button>
            </div>
          `;
        } else {
          actionsHtml = `
            <div class="row-actions">
              <button class="btn btn-secondary btn-sm btn-edit-user" data-id="${u.id}"><i class="icon-edit-3"></i> แก้ไข</button>
              <button class="btn btn-danger btn-sm btn-delete-user" data-id="${u.id}"><i class="icon-trash-2"></i> ลบ</button>
            </div>
          `;
        }

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
          <td><div style="display:flex; align-items:center;">${userAvatarHtml} <span style="font-weight: 500">${u.name}</span></div></td>
          <td style="font-family: monospace">${u.username}</td>
          <td>${u.department || '-'}</td>
          <td>${u.email || '-'}</td>
          <td>${u.phone || '-'}</td>
          <td>${roleLabel}</td>
          <td>${actionsHtml}</td>
        `;
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('.row-actions') || e.target.closest('.btn')) {
            return;
          }
          showUserDetails(u.id);
        });
        tbody.appendChild(tr);
      });

      qAll('.btn-edit-user').forEach(btn => btn.addEventListener('click', () => showUserForm(btn.dataset.id)));
      qAll('.btn-delete-user').forEach(btn => btn.addEventListener('click', () => deleteUser(btn.dataset.id)));
      
      qAll('.btn-approve-user').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const u = db.getUserById(id);
        if (u && confirm(`คุณแน่ใจหรือไม่ที่จะอนุมัติการใช้งานของ ${u.name} (${u.username})?`)) {
          const res = db.approveUser(id);
          if (res.success) {
            alert('อนุมัติการสมัครสมาชิกสำเร็จ!');
            renderUsers();
          } else {
            alert(res.message);
          }
        }
      }));
      
      qAll('.btn-reject-user').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const u = db.getUserById(id);
        if (u && confirm(`คุณแน่ใจหรือไม่ที่จะปฏิเสธ/ลบคำขอสมัครใช้งานของ ${u.name} (${u.username})?`)) {
          const res = db.rejectUser(id);
          if (res.success) {
            alert('ปฏิเสธ/ลบรายการสมัครใช้งานเรียบร้อย');
            renderUsers();
          } else {
            alert(res.message);
          }
        }
      }));

    } else {
      $('usersAdminContainer').style.display = 'none';
      $('usersProfileContainer').style.display = 'block';

      $('profileFormId').value = currentUser.id;
      $('profileName').value = currentUser.name;
      $('profileUsername').value = currentUser.username;
      $('profileUsername').disabled = true;
      $('profilePassword').value = currentUser.password;
      $('profileEmail').value = currentUser.email;
      $('profilePhone').value = currentUser.phone;
      $('profileDepartment').value = currentUser.department;

      const profileAvatarPreview = $('profileAvatarPreview');
      const btnDeleteProfileAvatar = $('btnDeleteProfileAvatar');
      if (currentUser.avatarUrl) {
        profileAvatarPreview.src = currentUser.avatarUrl;
        btnDeleteProfileAvatar.style.display = 'block';
      } else {
        profileAvatarPreview.src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';
        btnDeleteProfileAvatar.style.display = 'none';
      }
    }
  }

  function showUserDetails(uId) {
    const u = db.getUserById(uId);
    if (!u) return;

    $('uDetailName').textContent = u.name;
    $('uDetailUsername').textContent = `@${u.username}`;
    $('uDetailDepartment').textContent = u.department || '-';
    $('uDetailPhone').textContent = u.phone || '-';
    $('uDetailEmail').textContent = u.email || '-';

    let roleText = '';
    if (u.approved === false) {
      roleText = 'รออนุมัติ';
    } else {
      roleText = u.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)';
    }
    $('uDetailRole').textContent = roleText;

    const uDetailAvatar = $('uDetailAvatar');
    const uDetailAvatarInitials = $('uDetailAvatarInitials');
    if (u.avatarUrl) {
      uDetailAvatar.src = u.avatarUrl;
      uDetailAvatar.style.display = 'block';
      uDetailAvatarInitials.style.display = 'none';
    } else {
      uDetailAvatar.style.display = 'none';
      uDetailAvatarInitials.textContent = u.name.charAt(0);
      uDetailAvatarInitials.style.display = 'flex';
    }

    const adminActions = $('uDetailAdminActions');
    if (adminActions) {
      if (currentUser.role === 'admin') {
        adminActions.innerHTML = `
          <button class="btn btn-edit-user" id="btnDetailEditUser" data-id="${u.id}"><i class="icon-edit-3"></i> แก้ไข</button>
          <button class="btn btn-danger btn-delete-user" id="btnDetailDeleteUser" data-id="${u.id}"><i class="icon-trash-2"></i> ลบ</button>
        `;
        $('btnDetailEditUser').addEventListener('click', () => {
          closeModal($('userDetailModal'));
          showUserForm(u.id);
        });
        $('btnDetailDeleteUser').addEventListener('click', () => {
          deleteUser(u.id);
        });
      } else {
        adminActions.innerHTML = '';
      }
    }

    openModal($('userDetailModal'));
  }

  function showUserForm(uId = null) {
    const modal = $('userModal');
    const form = $('userForm');
    form.reset();

    const uFormAvatarPreview = $('userFormAvatarPreview');
    const btnDeleteUserFormAvatar = $('btnDeleteUserFormAvatar');

    if (uId) {
      const u = db.getUserById(uId);
      if (!u) return;

      $('userFormId').value = u.id;
      $('userFormTitle').textContent = `แก้ไขผู้ใช้: ${u.username}`;
      $('userFormName').value = u.name;
      $('userFormUsername').value = u.username;
      $('userFormUsername').disabled = true;
      $('userFormPassword').value = u.password;
      $('userFormEmail').value = u.email;
      $('userFormPhone').value = u.phone;
      $('userFormRole').value = u.role;
      $('userFormDepartment').value = u.department;

      if (u.avatarUrl) {
        uFormAvatarPreview.src = u.avatarUrl;
        $('userFormAvatarUrl').value = u.avatarUrl;
        btnDeleteUserFormAvatar.style.display = 'block';
      } else {
        uFormAvatarPreview.src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';
        $('userFormAvatarUrl').value = '';
        btnDeleteUserFormAvatar.style.display = 'none';
      }
    } else {
      $('userFormId').value = '';
      $('userFormTitle').textContent = 'เพิ่มผู้ใช้งานระบบ';
      $('userFormUsername').disabled = false;
      $('userFormRole').value = 'user';

      uFormAvatarPreview.src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';
      $('userFormAvatarUrl').value = '';
      btnDeleteUserFormAvatar.style.display = 'none';
    }

    openModal(modal);
  }

  function handleUserSubmit(e) {
    e.preventDefault();
    const uId = $('userFormId').value;
    const avatarUrl = $('userFormAvatarUrl').value;
    
    const details = {
      name: $('userFormName').value.trim(),
      username: $('userFormUsername').value.trim(),
      password: $('userFormPassword').value.trim(),
      email: $('userFormEmail').value.trim(),
      phone: $('userFormPhone').value.trim(),
      role: $('userFormRole').value,
      department: $('userFormDepartment').value.trim(),
      avatarUrl: avatarUrl
    };

    if (!details.name || !details.password || (!uId && !details.username)) {
      alert('กรุณากรอกชื่อ-สกุล, ชื่อผู้ใช้ และรหัสผ่าน');
      return;
    }

    let res;
    if (uId) {
      res = db.updateUser(uId, details);
    } else {
      res = db.addUser(details);
    }

    if (res.success) {
      closeModal($('userModal'));
      
      // Update currentUser session details immediately if admin edited themselves
      if (uId && Number(uId) === currentUser.id) {
        currentUser = res.user;
        const userStr = JSON.stringify(currentUser);
        if (localStorage.getItem('BudTEC_Current_User')) {
          localStorage.setItem('BudTEC_Current_User', userStr);
        } else {
          sessionStorage.setItem('BudTEC_Current_User', userStr);
        }
        
        // Update sidebar brand/avatar UI
        $('sidebarUserName').textContent = currentUser.name;
        if (currentUser.avatarUrl) {
          $('sidebarUserAvatar').src = currentUser.avatarUrl;
          $('sidebarUserAvatar').style.display = 'block';
          $('sidebarAvatarInitials').style.display = 'none';
        } else {
          $('sidebarUserAvatar').style.display = 'none';
          $('sidebarAvatarInitials').style.display = 'flex';
        }
      }
      
      renderUsers();
    } else {
      alert(res.message);
    }
  }

  function deleteUser(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งานรายนี้ออกจากระบบ?')) {
      const res = db.deleteUser(id);
      if (res.success) {
        renderUsers();
        const detailModal = $('userDetailModal');
        if (detailModal && detailModal.classList.contains('active')) {
          closeModal(detailModal);
        }
      } else {
        alert(res.message);
      }
    }
  }

  function handleProfileSubmit(e) {
    e.preventDefault();
    const previewSrc = $('profileAvatarPreview').src;
    const isDefault = previewSrc.includes('unsplash.com/photo-1622253692010');
    const avatarUrl = isDefault ? '' : previewSrc;

    const details = {
      name: $('profileName').value.trim(),
      password: $('profilePassword').value.trim(),
      email: $('profileEmail').value.trim(),
      phone: $('profilePhone').value.trim(),
      department: $('profileDepartment').value.trim(),
      avatarUrl: avatarUrl
    };

    if (!details.name || !details.password) {
      alert('ชื่อ-สกุล และ รหัสผ่านห้ามเป็นค่าว่าง');
      return;
    }

    const res = db.updateUser(currentUser.id, details);
    if (res.success) {
      currentUser = res.user;
      const userStr = JSON.stringify(currentUser);
      if (localStorage.getItem('BudTEC_Current_User')) {
        localStorage.setItem('BudTEC_Current_User', userStr);
      } else {
        sessionStorage.setItem('BudTEC_Current_User', userStr);
      }

      $('sidebarUserName').textContent = currentUser.name;
      if (currentUser.avatarUrl) {
        $('sidebarUserAvatar').src = currentUser.avatarUrl;
        $('sidebarUserAvatar').style.display = 'block';
        $('sidebarAvatarInitials').style.display = 'none';
      } else {
        $('sidebarUserAvatar').style.display = 'none';
        $('sidebarAvatarInitials').style.display = 'flex';
      }
      
      alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
      renderUsers();
    } else {
      alert(res.message);
    }
  }

  function showEquipmentDetails(eqId) {
    const eq = db.getEquipmentById(eqId);
    if (!eq) return;

    const categories = db.getCategories();
    const locations = db.getLocations();
    const fundingSources = db.getFundingSources();
    const vendors = db.getVendors();

    const cat = categories.find(c => String(c.id) === String(eq.categoryId));
    const loc = locations.find(l => String(l.id) === String(eq.locationId));
    const fund = fundingSources.find(f => String(f.id) === String(eq.fundingSourceId));
    const vendor = vendors.find(v => String(v.id) === String(eq.vendorId));

    $('eqDetailTitle').textContent = `รายละเอียดครุภัณฑ์: ${eq.id}`;
    $('eqDetailImage').src = eq.imageUrl;

    // Generate QR Code URL
    const appUrl = window.location.origin + window.location.pathname + '#eq=' + eq.id;
    $('eqDetailQRCode').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(appUrl)}`;

    $('eqDetailId').textContent = eq.id;
    $('eqDetailAssetNumber').textContent = eq.assetNumber || '-';
    $('eqDetailName').textContent = eq.name;
    $('eqDetailPrice').textContent = `฿${eq.price.toLocaleString()}`;
    $('eqDetailFiscalYear').textContent = eq.fiscalYear || '-';
    $('eqDetailFundingSource').textContent = fund ? fund.name : '-';
    $('eqDetailCategory').textContent = cat ? cat.name : '-';
    $('eqDetailLocation').textContent = loc ? loc.name : '-';
    $('eqDetailVendor').textContent = vendor ? vendor.companyName : '-';
    $('eqDetailVendorRep').textContent = vendor ? `${vendor.repName} (โทร: ${vendor.phone})` : '-';

    const badge = $('eqDetailStatusBadge');
    badge.textContent = eq.status;
    badge.className = 'badge';
    if (eq.status === 'พร้อมใช้งาน') badge.classList.add('badge-success');
    else if (eq.status === 'ถูกยืม') badge.classList.add('badge-warning');
    else if (eq.status === 'ชำรุด') badge.classList.add('badge-danger');
    else if (eq.status === 'รออนุมัติยืม') badge.classList.add('badge-pending-borrow');
    else if (eq.status === 'รออนุมัติคืน') badge.classList.add('badge-pending-return');
    else if (eq.status === 'ปฏิเสธการยืม') badge.classList.add('badge-rejected');

    const historyList = $('eqDetailHistoryList');
    historyList.innerHTML = '';
    const eqTxs = db.getTransactions().filter(tx => tx.equipmentId === eqId).reverse();

    if (eqTxs.length === 0) {
      historyList.innerHTML = `<div style="font-size:0.8rem; color:var(--text-light)">ไม่มีประวัติการยืมใช้งาน</div>`;
    } else {
      eqTxs.forEach(tx => {
        const borrower = db.getUsers().find(u => u.id === tx.userId);
        let statusText = 'คืนแล้ว';
        let statusStyle = 'color: var(--success)';
        if (tx.status === 'ถูกยืม') {
          statusText = 'กำลังยืม';
          statusStyle = 'color: var(--warning)';
        } else if (tx.status === 'รออนุมัติยืม') {
          statusText = 'รออนุมัติยืม';
          statusStyle = 'color: var(--primary)';
        } else if (tx.status === 'รออนุมัติคืน') {
          statusText = 'รออนุมัติคืน';
          statusStyle = 'color: #475569';
        } else if (tx.status === 'ปฏิเสธการยืม') {
          statusText = 'ปฏิเสธการยืม';
          statusStyle = 'color: #b91c1c';
        }
        const div = document.createElement('div');
        div.className = 'eq-detail-history-item';
        div.innerHTML = `
          <span><strong>${borrower ? borrower.name : 'ผู้ใช้'}</strong> (${formatThaiDate(tx.borrowDate)})</span>
          <span style="${statusStyle}; font-weight: 600;">${statusText}</span>
        `;
        historyList.appendChild(div);
      });
    }

    // Render Maintenance / PM history
    const maintenanceList = $('eqDetailMaintenanceList');
    if (maintenanceList) {
      maintenanceList.innerHTML = '';
      const eqLogs = db.getMaintenanceLogs().filter(log => log.equipmentId === eqId).reverse();

      if (eqLogs.length === 0) {
        maintenanceList.innerHTML = `<div style="font-size:0.8rem; color:var(--text-light)">ไม่มีประวัติการซ่อมบำรุง / PM</div>`;
      } else {
        eqLogs.forEach(log => {
          const div = document.createElement('div');
          div.className = 'eq-detail-history-item';
          div.style.padding = '8px 12px';
          div.style.borderBottom = '1px solid var(--border-color)';
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'flex-start';
          
          let typeBadge = log.type === 'ส่งซ่อม' 
            ? `<span class="badge badge-danger" style="font-size:0.7rem; padding: 2px 6px;">ส่งซ่อม</span>`
            : `<span class="badge badge-info" style="font-size:0.7rem; padding: 2px 6px;">PM</span>`;

          let deleteBtnHtml = currentUser.role === 'admin'
            ? `<button class="btn-icon btn-delete-maintenance" data-id="${log.id}" style="color: var(--danger); background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 0.85rem;" title="ลบรายการ"><i class="icon-trash-2"></i></button>`
            : '';

          div.innerHTML = `
            <div style="flex: 1; min-width: 0; text-align: left;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                ${typeBadge}
                <strong style="font-size: 0.8rem; color: var(--text-primary);">${log.repairCompany}</strong>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px; word-break: break-word;">
                <strong>อาการ/งาน:</strong> ${log.symptom}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-light);">
                วันที่: ${formatThaiDate(log.entryDate)} | ค่าใช้จ่าย: ฿${(log.cost || 0).toLocaleString()}
                ${log.nextDueDate ? ` | PM ครั้งถัดไป: ${formatThaiDate(log.nextDueDate)}` : ''}
              </div>
            </div>
            ${deleteBtnHtml}
          `;
          
          if (currentUser.role === 'admin') {
            div.querySelector('.btn-delete-maintenance').addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm('ยืนยันที่จะลบประวัติการซ่อมบำรุงนี้?')) {
                db.deleteMaintenanceLog(log.id);
                showEquipmentDetails(eqId);
              }
            });
          }
          
          maintenanceList.appendChild(div);
        });
      }
    }

    const adminActions = $('eqDetailAdminActions');
    if (adminActions) {
      if (currentUser.role === 'admin') {
        adminActions.innerHTML = `
          <button class="btn btn-edit-eq" id="btnDetailEditEq" data-id="${eq.id}"><i class="icon-edit-3"></i> แก้ไข</button>
          <button class="btn btn-delete-eq" id="btnDetailDeleteEq" data-id="${eq.id}"><i class="icon-trash-2"></i> ลบ</button>
        `;
        $('btnDetailEditEq').addEventListener('click', () => {
          closeModal($('equipmentDetailModal'));
          showEquipmentForm(eq.id);
        });
        $('btnDetailDeleteEq').addEventListener('click', () => {
          deleteEquipment(eq.id);
        });
      } else {
        adminActions.innerHTML = '';
      }
    }

    openModal($('equipmentDetailModal'));
  }

  // ==========================================
  // 9. SETTINGS & METADATA VIEWS (ADMIN ONLY)
  // ==========================================
  let activeSettingsTab = 'categories';

  function getTelegramConfig() {
    const raw = localStorage.getItem('BudTEC_Telegram_Config');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    const defaults = {
      enabled: true,
      token: '7802620597:AAFQ1PAvQ_awqIP3PKCui9jl_c46hetxLCU',
      chatId: '-1002262714322',
      topicId: ''
    };
    localStorage.setItem('BudTEC_Telegram_Config', JSON.stringify(defaults));
    return defaults;
  }

  function saveTelegramConfig(config) {
    localStorage.setItem('BudTEC_Telegram_Config', JSON.stringify(config));
  }

  function showTelegramToast(message) {
    let container = q('.telegram-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'telegram-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'telegram-toast';

    toast.innerHTML = `
      <div class="telegram-toast-header">
        <svg class="telegram-toast-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; fill: #FFFFFF;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.62.15-.15 2.7-2.46 2.75-2.68.01-.03.01-.14-.06-.2-.07-.06-.17-.04-.25-.02-.11.02-1.78 1.13-5.03 3.33-.48.33-.91.49-1.3.48-.43-.01-1.26-.24-1.88-.45-.75-.25-1.35-.39-1.3-.83.03-.23.35-.46.96-.71 3.76-1.64 6.27-2.72 7.54-3.25 3.58-1.48 4.32-1.74 4.81-1.75.11 0 .35.03.5.16.13.12.17.28.19.4z"/>
        </svg>
        <span>TELEGRAM BOT</span>
        <span class="telegram-toast-time">เมื่อสักครู่</span>
      </div>
      <div class="telegram-toast-body">${message}</div>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 50);

    // Auto remove after 6 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, 6000);
  }

  function base64ToBlob(base64Data) {
    try {
      const parts = base64Data.split(';base64,');
      if (parts.length < 2) return null;
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
      console.error('Error converting base64 to blob:', e);
      return null;
    }
  }

  function sendTelegramNotification(message, imageUrl = null) {
    const config = getTelegramConfig();
    if (!config.enabled) return;

    // Show simulated notification toast on screen
    showTelegramToast(message);

    // If token and chatId are configured, send real message
    if (config.token && config.chatId) {
      let url;
      let body;
      let headers = {};

      if (imageUrl) {
        url = `https://api.telegram.org/bot${config.token}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', config.chatId);
        formData.append('caption', message);
        formData.append('parse_mode', 'HTML');
        if (config.topicId) {
          formData.append('message_thread_id', config.topicId);
        }

        if (imageUrl.startsWith('data:')) {
          const blob = base64ToBlob(imageUrl);
          if (blob) {
            formData.append('photo', blob, 'equipment.jpg');
          } else {
            formData.append('photo', imageUrl);
          }
        } else {
          formData.append('photo', imageUrl);
        }
        body = formData;
      } else {
        url = `https://api.telegram.org/bot${config.token}/sendMessage`;
        headers['Content-Type'] = 'application/json';
        const payload = {
          chat_id: config.chatId,
          text: message,
          parse_mode: 'HTML'
        };
        if (config.topicId) {
          payload.message_thread_id = config.topicId;
        }
        body = JSON.stringify(payload);
      }

      fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
      })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Telegram Bot API Response:', data);
      })
      .catch(err => {
        console.error('Telegram Bot HTTP request failed:', err);
      });
    }
  }

  function renderSettingsTelegram() {
    const config = getTelegramConfig();
    $('telegramEnabled').checked = config.enabled;
    $('telegramBotToken').value = config.token;
    $('telegramChatId').value = config.chatId;
    $('telegramTopicId').value = config.topicId || '';
  }

  function renderCustomSettings() {
    qAll('.settings-content-panel').forEach(panel => {
      if (panel.id === `settings-${activeSettingsTab}-panel`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    qAll('.settings-nav-item').forEach(item => {
      if (item.dataset.tab === activeSettingsTab) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (activeSettingsTab === 'telegram') {
      $('btnAddMeta').style.display = 'none';
      renderSettingsTelegram();
    } else {
      $('btnAddMeta').style.display = 'inline-flex';
      if (activeSettingsTab === 'categories') {
        renderSettingsCategories();
      } else if (activeSettingsTab === 'locations') {
        renderSettingsLocations();
      } else if (activeSettingsTab === 'funding') {
        renderSettingsFunding();
      }
    }
  }

  function renderSettingsCategories() {
    const list = db.getCategories();
    const tbody = $('settingsCategoriesTableBody');
    tbody.innerHTML = '';
    
    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width: 80px">${c.id}</td>
        <td><strong>${c.name}</strong></td>
        <td style="width: 220px">
          <div class="row-actions">
            <button class="btn btn-secondary btn-sm btn-edit-meta" data-type="category" data-id="${c.id}" data-name="${c.name}"><i class="icon-edit-3"></i> แก้ไข</button>
            <button class="btn btn-danger btn-sm btn-delete-meta" data-type="category" data-id="${c.id}"><i class="icon-trash-2"></i> ลบ</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    attachMetaActionListeners();
  }

  function renderSettingsLocations() {
    const list = db.getLocations();
    const tbody = $('settingsLocationsTableBody');
    tbody.innerHTML = '';

    list.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width: 80px">${l.id}</td>
        <td><strong>${l.name}</strong></td>
        <td style="width: 220px">
          <div class="row-actions">
            <button class="btn btn-secondary btn-sm btn-edit-meta" data-type="location" data-id="${l.id}" data-name="${l.name}"><i class="icon-edit-3"></i> แก้ไข</button>
            <button class="btn btn-danger btn-sm btn-delete-meta" data-type="location" data-id="${l.id}"><i class="icon-trash-2"></i> ลบ</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    attachMetaActionListeners();
  }

  function renderSettingsFunding() {
    const list = db.getFundingSources();
    const tbody = $('settingsFundingTableBody');
    tbody.innerHTML = '';

    list.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width: 80px">${f.id}</td>
        <td><strong>${f.name}</strong></td>
        <td style="width: 220px">
          <div class="row-actions">
            <button class="btn btn-secondary btn-sm btn-edit-meta" data-type="funding" data-id="${f.id}" data-name="${f.name}"><i class="icon-edit-3"></i> แก้ไข</button>
            <button class="btn btn-danger btn-sm btn-delete-meta" data-type="funding" data-id="${f.id}"><i class="icon-trash-2"></i> ลบ</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    attachMetaActionListeners();
  }

  function attachMetaActionListeners() {
    qAll('.btn-edit-meta').forEach(btn => {
      btn.addEventListener('click', () => {
        showMetaForm(btn.dataset.type, btn.dataset.id, btn.dataset.name);
      });
    });

    qAll('.btn-delete-meta').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteMeta(btn.dataset.type, btn.dataset.id);
      });
    });
  }

  function showMetaForm(type, id = '', name = '') {
    $('metaFormType').value = type;
    $('metaFormId').value = id;
    $('metaValueInput').value = name;

    let typeText = 'หมวดหมู่';
    if (type === 'location') typeText = 'สถานที่เก็บ';
    if (type === 'funding') typeText = 'หมวดเงินจัดซื้อ';

    $('metaModalTitle').textContent = id ? `แก้ไขชื่อ${typeText}` : `เพิ่ม${typeText}`;
    openModal($('metaModal'));
  }

  function handleMetaSubmit(e) {
    e.preventDefault();
    const type = $('metaFormType').value;
    const id = $('metaFormId').value;
    const name = $('metaValueInput').value.trim();

    if (!name) {
      alert('กรุณากรอกชื่อข้อมูล');
      return;
    }

    if (type === 'category') {
      if (id) db.updateCategory(id, name);
      else db.addCategory(name);
    } else if (type === 'location') {
      if (id) db.updateLocation(id, name);
      else db.addLocation(name);
    } else if (type === 'funding') {
      if (id) db.updateFundingSource(id, name);
      else db.addFundingSource(name);
    }

    closeModal($('metaModal'));
    renderCustomSettings();
  }

  function deleteMeta(type, id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลรายการนี้?')) {
      let res;
      if (type === 'category') res = db.deleteCategory(id);
      else if (type === 'location') res = db.deleteLocation(id);
      else if (type === 'funding') res = db.deleteFundingSource(id);

      if (res && res.success) {
        renderCustomSettings();
      } else {
        alert(res ? res.message : 'เกิดข้อผิดพลาด');
      }
    }
  }

  // ==========================================
  // 10. MODALS & GENERAL EVENT LISTENERS
  // ==========================================
  function openModal(modalEl) {
    modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    if (modalEl.id === 'qrScannerModal') {
      stopQRScanner();
    }
  }

  function setupEventListeners() {
    // Sidebar Hamburger Toggle for Mobile
    const btnToggleSidebar = $('btnToggleSidebar');
    const sidebar = q('.sidebar');
    const sidebarOverlay = $('sidebarOverlay');
    
    if (btnToggleSidebar && sidebar && sidebarOverlay) {
      btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
      });
      
      sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
      });
    }

    // Nav Click Router
    qAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.section);
        
        // Auto-close sidebar on mobile after clicking navigation links
        if (sidebar && sidebarOverlay) {
          sidebar.classList.remove('active');
          sidebarOverlay.classList.remove('active');
        }
      });
    });

    // Theme Switch
    $('themeToggleBtn').addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('BudTEC_Theme', isDark ? 'dark' : 'light');
      if (activeSection === 'dashboard') {
        renderDashboard();
      }
    });

    // Sidebar Log out
    $('btnSidebarLogout').addEventListener('click', logout);

    // Dashboard stat cards navigation links
    q('.stat-card.total').addEventListener('click', () => {
      $('filterCategory').value = 'all';
      $('filterLocation').value = 'all';
      $('filterStatus').value = 'all';
      eqStatusFilter = 'all';
      eqCategoryFilter = 'all';
      eqLocationFilter = 'all';
      renderEquipment();
      navigateTo('inventory');
    });

    q('.stat-card.ready').addEventListener('click', () => {
      $('filterCategory').value = 'all';
      $('filterLocation').value = 'all';
      $('filterStatus').value = 'พร้อมใช้งาน';
      eqStatusFilter = 'พร้อมใช้งาน';
      eqCategoryFilter = 'all';
      eqLocationFilter = 'all';
      renderEquipment();
      navigateTo('inventory');
    });

    q('.stat-card.borrowed').addEventListener('click', () => {
      $('filterCategory').value = 'all';
      $('filterLocation').value = 'all';
      $('filterStatus').value = 'ถูกยืม';
      eqStatusFilter = 'ถูกยืม';
      eqCategoryFilter = 'all';
      eqLocationFilter = 'all';
      renderEquipment();
      navigateTo('inventory');
    });

    q('.stat-card.damaged').addEventListener('click', () => {
      $('filterCategory').value = 'all';
      $('filterLocation').value = 'all';
      $('filterStatus').value = 'ชำรุด';
      eqStatusFilter = 'ชำรุด';
      eqCategoryFilter = 'all';
      eqLocationFilter = 'all';
      renderEquipment();
      navigateTo('inventory');
    });

    // Login Form Submit
    $('loginForm').addEventListener('submit', handleLogin);

    // Toggle between Login and Registration forms
    $('linkGoToRegister').addEventListener('click', (e) => {
      e.preventDefault();
      $('loginForm').style.display = 'none';
      $('registerForm').style.display = 'block';
      $('loginError').style.display = 'none';
    });

    $('linkGoToLogin').addEventListener('click', (e) => {
      e.preventDefault();
      $('registerForm').style.display = 'none';
      $('loginForm').style.display = 'block';
      $('loginError').style.display = 'none';
    });

    // Registration Form Password Toggle
    setupPasswordToggle('registerPasswordToggle', 'registerPassword');

    // Registration Avatar Upload
    $('registerAvatarFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (window.BudTEC_UseGoogleSheets) {
          const regBtn = q('#registerForm button[type="submit"]');
          if (regBtn) {
            regBtn.disabled = true;
            regBtn.innerHTML = 'กำลังอัปโหลดรูปภาพ...';
          }
          try {
            const avatarUrl = await window.uploadFileToGoogleDrive(file, 'avatars');
            $('registerAvatarPreview').src = avatarUrl;
            $('registerAvatarUrl').value = avatarUrl;
          } catch (err) {
            alert('อัปโหลดรูปภาพล้มเหลว: ' + err.message);
          } finally {
            if (regBtn) {
              regBtn.disabled = false;
              regBtn.innerHTML = 'ส่งข้อมูลสมัครสมาชิก';
            }
          }
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            $('registerAvatarPreview').src = event.target.result;
            $('registerAvatarUrl').value = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      }
    });

    // Register Form Submit
    $('registerForm').addEventListener('submit', handleRegisterSubmit);

    // Dynamic Password Toggle for login and profiles
    setupPasswordToggle('loginPasswordToggle', 'loginPassword');
    setupPasswordToggle('profilePasswordToggle', 'profilePassword');
    setupPasswordToggle('userFormPasswordToggle', 'userFormPassword');

    // Equipment filters
    $('inventorySearch').addEventListener('input', (e) => {
      eqSearchQuery = e.target.value;
      renderEquipment();
    });
    $('filterCategory').addEventListener('change', (e) => {
      eqCategoryFilter = e.target.value;
      renderEquipment();
    });
    $('filterLocation').addEventListener('change', (e) => {
      eqLocationFilter = e.target.value;
      renderEquipment();
    });
    $('filterStatus').addEventListener('change', (e) => {
      eqStatusFilter = e.target.value;
      renderEquipment();
    });

    // Admin Equipment Controls
    $('btnExportEquipment').addEventListener('click', downloadEquipmentCSV);
    $('btnAddEquipment').addEventListener('click', () => showEquipmentForm(null));
    $('equipmentForm').addEventListener('submit', handleEquipmentSubmit);

    // Borrow/Return submit
    $('borrowForm').addEventListener('submit', handleBorrowSubmit);
    $('returnForm').addEventListener('submit', handleReturnSubmit);

    // Admin Vendor control
    $('btnAddVendor').addEventListener('click', () => showVendorForm(null));
    $('vendorForm').addEventListener('submit', handleVendorSubmit);

    // Users and profile controls
    $('btnAddUser').addEventListener('click', () => showUserForm(null));
    $('userForm').addEventListener('submit', handleUserSubmit);
    $('profileForm').addEventListener('submit', handleProfileSubmit);

    // User Avatar File Change (General User)
    $('profileAvatarFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (window.BudTEC_UseGoogleSheets) {
          const saveBtn = q('#profileModal button[type="submit"]');
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'กำลังอัปโหลดรูป...';
          }
          try {
            const avatarUrl = await window.uploadFileToGoogleDrive(file, 'avatars');
            $('profileAvatarPreview').src = avatarUrl;
            $('btnDeleteProfileAvatar').style.display = 'block';
          } catch (err) {
            alert('อัปโหลดรูปภาพล้มเหลว: ' + err.message);
          } finally {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.innerHTML = 'บันทึกข้อมูลส่วนตัว';
            }
          }
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            $('profileAvatarPreview').src = event.target.result;
            $('btnDeleteProfileAvatar').style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      }
    });

    // User Avatar Delete (General User)
    $('btnDeleteProfileAvatar').addEventListener('click', () => {
      $('profileAvatarPreview').src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';
      $('profileAvatarFile').value = '';
      $('btnDeleteProfileAvatar').style.display = 'none';
    });

    // User Avatar File Change (Admin panel modal)
    $('userFormAvatarFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (window.BudTEC_UseGoogleSheets) {
          const saveBtn = q('#userModal button[type="submit"]');
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'กำลังอัปโหลดรูป...';
          }
          try {
            const avatarUrl = await window.uploadFileToGoogleDrive(file, 'avatars');
            $('userFormAvatarPreview').src = avatarUrl;
            $('userFormAvatarUrl').value = avatarUrl;
            $('btnDeleteUserFormAvatar').style.display = 'block';
          } catch (err) {
            alert('อัปโหลดรูปภาพล้มเหลว: ' + err.message);
          } finally {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.innerHTML = 'บันทึกข้อมูล';
            }
          }
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            $('userFormAvatarPreview').src = event.target.result;
            $('userFormAvatarUrl').value = event.target.result;
            $('btnDeleteUserFormAvatar').style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      }
    });

    // User Avatar Delete (Admin panel modal)
    $('btnDeleteUserFormAvatar').addEventListener('click', () => {
      $('userFormAvatarPreview').src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=150&auto=format&fit=crop';
      $('userFormAvatarUrl').value = '';
      $('userFormAvatarFile').value = '';
      $('btnDeleteUserFormAvatar').style.display = 'none';
    });

    // Settings Navigation Tabs
    qAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        activeSettingsTab = item.dataset.tab;
        renderCustomSettings();
      });
    });
    $('metaForm').addEventListener('submit', handleMetaSubmit);
    $('btnAddMeta').addEventListener('click', () => showMetaForm(activeSettingsTab));

    // Telegram Bot Config Form Submission
    $('telegramConfigForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const config = {
        enabled: $('telegramEnabled').checked,
        token: $('telegramBotToken').value.trim(),
        chatId: $('telegramChatId').value.trim(),
        topicId: $('telegramTopicId').value.trim()
      };
      saveTelegramConfig(config);
      alert('บันทึกการตั้งค่า Telegram Bot สำเร็จ!');
    });

    $('btnTestTelegram').addEventListener('click', () => {
      const config = {
        enabled: $('telegramEnabled').checked,
        token: $('telegramBotToken').value.trim(),
        chatId: $('telegramChatId').value.trim(),
        topicId: $('telegramTopicId').value.trim()
      };
      saveTelegramConfig(config);

      if (!config.enabled) {
        alert('กรุณาเปิดการใช้งานก่อนการทดสอบ');
        return;
      }

      const appUrl = `${window.location.origin}${window.location.pathname}`;
      const testMsg = `<b><a href="${appUrl}">🔔 [ทดสอบการเชื่อมต่อ]</a></b>\nระบบแจ้งเตือน Telegram Bot ศูนย์ BudTEC ทำงานปกติ!\n<b>ทดสอบโดย:</b> ${currentUser.name}\n<b>เวลา:</b> ${new Date().toLocaleTimeString('th-TH')}`;
      sendTelegramNotification(testMsg);
      alert('ส่งข้อความทดสอบแล้ว! กรุณาตรวจสอบการแจ้งเตือนจำลองที่มุมขวาบน หรือในกลุ่ม Telegram ของคุณ');
    });

    // Modals close button
    qAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(btn.closest('.modal-overlay'));
      });
    });

    // Close modal when clicking on overlay background
    qAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
    });

    // QR Code Scanner bindings
    if ($('btnNavScanQR')) $('btnNavScanQR').addEventListener('click', startQRScanner);
    if ($('btnCloseQRScannerModal')) $('btnCloseQRScannerModal').addEventListener('click', () => closeModal($('qrScannerModal')));
    if ($('btnCancelQRScanner')) $('btnCancelQRScanner').addEventListener('click', () => closeModal($('qrScannerModal')));

    // Analytics bindings
    if ($('btnShowAnalytics')) $('btnShowAnalytics').addEventListener('click', showAnalyticsModal);
    if ($('btnExportAnalyticsCSV')) $('btnExportAnalyticsCSV').addEventListener('click', exportAnalyticsCSV);

    // Maintenance bindings
    if ($('btnDetailAddMaintenance')) {
      $('btnDetailAddMaintenance').addEventListener('click', () => {
        const eqId = $('eqDetailId').textContent;
        if (!eqId) return;
        
        $('maintenanceFormEqId').value = eqId;
        $('maintenanceForm').reset();
        $('maintenanceFormDate').value = new Date().toISOString().split('T')[0];
        
        closeModal($('equipmentDetailModal'));
        openModal($('maintenanceModal'));
      });
    }
    if ($('maintenanceForm')) {
      $('maintenanceForm').addEventListener('submit', handleMaintenanceSubmit);
    }
  }

  function setupPasswordToggle(toggleId, inputId) {
    const toggle = $(toggleId);
    const input = $(inputId);
    if (!toggle || !input) return;

    toggle.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      const icon = toggle.querySelector('i');
      if (icon) {
        if (isPassword) {
          icon.className = 'icon-eye-off';
        } else {
          icon.className = 'icon-eye';
        }
      }
    });
  }

  // ==========================================
  // 11. QR CODE SCANNER (html5-qrcode)
  // ==========================================
  let html5QrCode = null;

  function startQRScanner() {
    const scannerModal = $('qrScannerModal');
    if (!scannerModal) return;
    
    openModal(scannerModal);
    
    // Clear any previous state
    $('qrReader').innerHTML = '';
    
    // Initialize html5-qrcode
    html5QrCode = new Html5Qrcode("qrReader");
    
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      let eqId = null;
      // Extract from URL hash (e.g. #eq=BudTEC_0004) or direct text
      const hashMatch = decodedText.match(/#eq=([A-Za-z0-9_]+)/);
      if (hashMatch) {
        eqId = hashMatch[1];
      } else {
        const match = decodedText.match(/(BudTEC_\d{4})/);
        if (match) {
          eqId = match[1];
        }
      }

      if (eqId) {
        const eq = db.getEquipmentById(eqId);
        if (eq) {
          closeModal(scannerModal); // automatically stops the scanner via closeModal hook
          navigateTo('inventory');
          showEquipmentDetails(eqId);
        } else {
          alert(`พบรหัสครุภัณฑ์ ${eqId} แต่ไม่มีข้อมูลในระบบ`);
        }
      } else {
        alert(`รูปแบบ QR Code ไม่ถูกต้อง: ${decodedText}`);
      }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      qrCodeSuccessCallback
    ).catch(err => {
      console.error("Error starting QR scanner:", err);
      $('qrReader').innerHTML = `
        <div style="padding: 24px; color: var(--danger); font-size: 0.85rem; font-weight: 500; text-align: center;">
          <i class="icon-alert-triangle" style="font-size: 1.5rem; margin-bottom: 8px; display: block; color: var(--danger);"></i>
          ไม่สามารถเปิดกล้องได้: ${err.message || err}<br>
          <span style="font-size: 0.75rem; color: var(--text-light); display: block; margin-top: 4px;">กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องถ่ายภาพบนเบราว์เซอร์</span>
        </div>
      `;
    });
  }

  function stopQRScanner() {
    if (html5QrCode) {
      html5QrCode.stop().then(() => {
        html5QrCode.clear();
        html5QrCode = null;
      }).catch(err => {
        console.error("Error stopping QR scanner:", err);
        html5QrCode = null;
      });
    }
  }

  // ==========================================
  // 12. MAINTENANCE & REPAIR LOG HANDLER
  // ==========================================
  function handleMaintenanceSubmit(e) {
    e.preventDefault();
    const eqId = $('maintenanceFormEqId').value;
    const type = $('maintenanceFormType').value;
    const symptom = $('maintenanceFormSymptom').value.trim();
    const company = $('maintenanceFormCompany').value.trim();
    const cost = Number($('maintenanceFormCost').value) || 0;
    const date = $('maintenanceFormDate').value;
    const nextDueDate = $('maintenanceFormNextDueDate').value;

    if (!eqId || !symptom || !company || !date) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    const log = {
      equipmentId: eqId,
      type,
      symptom,
      repairCompany: company,
      cost,
      entryDate: date,
      nextDueDate: nextDueDate || ''
    };

    db.addMaintenanceLog(log);

    // Update equipment status based on type of maintenance
    const eq = db.getEquipmentById(eqId);
    if (eq) {
      if (type === 'ส่งซ่อม') {
        eq.status = 'ชำรุด';
        db.updateEquipment(eqId, eq);
      } else if (type === 'บำรุงรักษา' && eq.status === 'ชำรุด') {
        eq.status = 'พร้อมใช้งาน';
        db.updateEquipment(eqId, eq);
      }
    }

    closeModal($('maintenanceModal'));
    renderEquipment();
    renderDashboard();
    
    // Re-open details modal
    showEquipmentDetails(eqId);
  }

  // ==========================================
  // 13. ADVANCED ANALYTICS REPORTS
  // ==========================================
  function calculateUtilizationData() {
    const txList = db.getTransactions();
    const eqList = db.getEquipment();
    const today = new Date();
    const currentThaiYear = new Date().getFullYear() + 543;

    const stats = {};
    eqList.forEach(eq => {
      const fiscalYear = eq.fiscalYear || currentThaiYear;
      let yearsElapsed = currentThaiYear - fiscalYear;
      if (yearsElapsed < 0) yearsElapsed = 0;
      if (yearsElapsed > 5) yearsElapsed = 5;

      const accumDepreciation = eq.price * (yearsElapsed * 0.2);
      const netValue = eq.price - accumDepreciation;

      stats[eq.id] = {
        id: eq.id,
        name: eq.name,
        price: eq.price,
        accumDepreciation: accumDepreciation,
        netValue: netValue,
        count: 0,
        totalDays: 0,
        status: eq.status
      };
    });

    txList.forEach(tx => {
      if (['ถูกยืม', 'คืนแล้ว', 'รออนุมัติคืน'].includes(tx.status)) {
        const stat = stats[tx.equipmentId];
        if (stat) {
          stat.count++;
          
          const start = new Date(tx.borrowDate);
          const end = tx.actualReturnDate 
            ? new Date(tx.actualReturnDate) 
            : (tx.pendingReturnDate ? new Date(tx.pendingReturnDate) : today);
            
          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
          stat.totalDays += diffDays;
        }
      }
    });

    return Object.values(stats).map(s => {
      const avg = s.count > 0 ? (s.totalDays / s.count).toFixed(1) : '0.0';
      return {
        id: s.id,
        name: s.name,
        price: s.price,
        accumDepreciation: s.accumDepreciation,
        netValue: s.netValue,
        count: s.count,
        avgDays: avg,
        status: s.status
      };
    }).sort((a, b) => b.count - a.count);
  }

  function calculateDepreciationData() {
    const eqList = db.getEquipment();
    const fundingSources = db.getFundingSources();
    const currentThaiYear = new Date().getFullYear() + 543;

    const stats = {};
    fundingSources.forEach(fs => {
      stats[fs.id] = {
        sourceName: fs.name,
        itemCount: 0,
        totalOriginalCost: 0,
        totalAccumDepreciation: 0,
        totalNetValue: 0
      };
    });

    stats['other'] = {
      sourceName: 'อื่นๆ / ไม่ได้ระบุแหล่งทุน',
      itemCount: 0,
      totalOriginalCost: 0,
      totalAccumDepreciation: 0,
      totalNetValue: 0
    };

    eqList.forEach(eq => {
      const fsId = eq.fundingSourceId || 'other';
      const stat = stats[fsId] || stats['other'];
      
      stat.itemCount++;
      stat.totalOriginalCost += eq.price;

      const fiscalYear = eq.fiscalYear || currentThaiYear;
      let yearsElapsed = currentThaiYear - fiscalYear;
      if (yearsElapsed < 0) yearsElapsed = 0;
      if (yearsElapsed > 5) yearsElapsed = 5;

      const accumDepreciation = eq.price * (yearsElapsed * 0.2);
      const netValue = eq.price - accumDepreciation;

      stat.totalAccumDepreciation += accumDepreciation;
      stat.totalNetValue += netValue;
    });

    return Object.entries(stats)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => s.itemCount > 0 || s.id !== 'other');
  }

  function showAnalyticsModal() {
    const utilizationData = calculateUtilizationData();
    const depreciationData = calculateDepreciationData();

    // Render Utilization & Depreciation Table
    const utilTbody = $('analyticsUtilizationTableBody');
    if (utilTbody) {
      utilTbody.innerHTML = '';
      utilizationData.forEach(item => {
        let badgeClass = 'badge-success';
        if (item.status === 'ถูกยืม') badgeClass = 'badge-warning';
        else if (item.status === 'ชำรุด') badgeClass = 'badge-danger';
        else if (item.status === 'รออนุมัติยืม') badgeClass = 'badge-pending-borrow';
        else if (item.status === 'รออนุมัติคืน') badgeClass = 'badge-pending-return';
        else if (item.status === 'ปฏิเสธการยืม') badgeClass = 'badge-rejected';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: monospace; font-weight: 600">${item.id}</td>
          <td><strong>${item.name}</strong></td>
          <td>${item.count} ครั้ง</td>
          <td>${item.avgDays} วัน</td>
          <td>฿${item.price.toLocaleString()}</td>
          <td style="color: var(--danger)">฿${item.accumDepreciation.toLocaleString()}</td>
          <td style="color: var(--success); font-weight: 700;">฿${item.netValue.toLocaleString()}</td>
          <td><span class="badge ${badgeClass}">${item.status}</span></td>
        `;
        utilTbody.appendChild(tr);
      });
    }

    // Render Depreciation Table
    const depTbody = $('analyticsDepreciationTableBody');
    if (depTbody) {
      depTbody.innerHTML = '';
      depreciationData.forEach(source => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 600; color: var(--primary)">${source.sourceName}</td>
          <td>${source.itemCount} ชิ้น</td>
          <td>฿${source.totalOriginalCost.toLocaleString()}</td>
          <td style="color: var(--danger)">฿${source.totalAccumDepreciation.toLocaleString()}</td>
          <td style="color: var(--success); font-weight: 700;">฿${source.totalNetValue.toLocaleString()}</td>
        `;
        depTbody.appendChild(tr);
      });
    }

    openModal($('analyticsModal'));
  }

  function exportAnalyticsCSV() {
    const utilizationData = calculateUtilizationData();
    const depreciationData = calculateDepreciationData();

    const csvRows = [];

    // Title
    csvRows.push(['รายงานสถิติและวิเคราะห์ข้อมูลเชิงลึกสำหรับผู้บริหาร']);
    csvRows.push([]); // blank line

    // Section 1
    csvRows.push(['1. อัตราการยืมใช้งานและค่าเสื่อมราคาครุภัณฑ์ (Utilization, Frequency & Depreciation)']);
    csvRows.push(['รหัสครุภัณฑ์', 'ชื่อครุภัณฑ์', 'จำนวนครั้งที่ถูกยืม', 'ระยะเวลาเฉลี่ย (วัน)', 'ราคาจัดซื้อ (บาท)', 'ค่าเสื่อมสะสม (บาท)', 'มูลค่าคงเหลือ (บาท)', 'สถานะปัจจุบัน']);
    
    utilizationData.forEach(item => {
      csvRows.push([
        item.id,
        item.name,
        item.count,
        item.avgDays,
        item.price,
        item.accumDepreciation,
        item.netValue,
        item.status
      ]);
    });

    csvRows.push([]); // blank line
    csvRows.push([]); // blank line

    // Section 2
    csvRows.push(['2. สรุปมูลค่าพัสดุและค่าเสื่อมราคาแยกตามแหล่งทุน (Depreciation by Funding Source)']);
    csvRows.push(['แหล่งเงินงบประมาณ', 'จำนวนชิ้น', 'มูลค่าจัดซื้อรวม', 'ค่าเสื่อมสะสม (20% ต่อปี)', 'มูลค่าสุทธิคงเหลือ']);

    depreciationData.forEach(source => {
      csvRows.push([
        source.sourceName,
        source.itemCount,
        source.totalOriginalCost,
        source.totalAccumDepreciation,
        source.totalNetValue
      ]);
    });

    // Format
    const csvContent = csvRows.map(row => {
      return row.map(val => {
        let str = String(val === null || val === undefined ? '' : val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',');
    }).join('\r\n');

    // UTF-8 BOM
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BudTEC_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();
