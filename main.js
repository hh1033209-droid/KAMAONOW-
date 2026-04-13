// ========== KAMAONOW PRODUCTION VERSION - FINAL ==========
console.log("🚀 KamaoNow Production Mode Loading...");

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let selectedMethod = null;
let currentFilter = 'all';
let allWithdrawals = [];

let appData = {
    balance: 0,
    pendingTasks: [],
    pendingWithdrawals: [],
    completedTasks: [],
    referrals: 0,
    streak: 1,
    activities: []
};

// ========== COMPLETE TASK WITH VERIFICATION ==========
window.completeTask = async function(taskId, taskName, reward) {
    if (!currentUser) {
        showToast("Please login first!", "error");
        return;
    }
    
    if (appData.completedTasks.includes(taskId)) {
        showToast("Task already completed!", "error");
        return;
    }
    
    const proof = prompt(`📸 Task: ${taskName}\n\nPaste your proof (image link or description):`);
    if (!proof || proof.trim() === "") {
        showToast("Proof required to complete task!", "error");
        return;
    }
    
    showLoading("Submitting for verification...");
    
    try {
        const { collection, addDoc } = window.firestoreHelpers;
        const db = window.db;
        
        await addDoc(collection(db, 'task_requests'), {
            userId: currentUser.userId,
            userName: currentUser.name,
            taskId: taskId,
            taskName: taskName,
            reward: reward,
            proof: proof,
            status: 'pending',
            submittedAt: new Date().toISOString()
        });
        
        showToast("✅ Task submitted! Admin will verify within 24 hours.", "success");
        addActivity(`📝 Submitted "${taskName}" for verification`);
        
    } catch (error) {
        console.error(error);
        showToast("Failed to submit task!", "error");
    }
    hideLoading();
};

// ========== WITHDRAWAL REQUEST ==========
window.requestWithdrawal = async function() {
    console.log("💰 Withdrawal button clicked");
    
    if (!currentUser) {
        showToast("Please login first!", "error");
        return;
    }
    
    const amount = parseInt(document.getElementById('withdrawAmount')?.value);
    const account = document.getElementById('accountNumber')?.value;
    const method = selectedMethod;
    
    console.log("Method selected:", method);
    console.log("Amount:", amount);
    console.log("Account:", account);
    
    if (!method) {
        showToast("Please select a withdrawal method (JazzCash/EasyPaisa/UPaisa)!", "error");
        return;
    }
    if (!amount || amount < 200) {
        showToast("Minimum withdrawal amount is ₨200!", "error");
        return;
    }
    if (!account || account.trim() === "") {
        showToast("Please enter account number!", "error");
        return;
    }
    if (amount > appData.balance) {
        showToast(`Insufficient balance! Your balance: ₨${appData.balance}`, "error");
        return;
    }
    
    showLoading("Submitting withdrawal request...");
    
    try {
        const { collection, addDoc } = window.firestoreHelpers;
        const db = window.db;
        
        let methodDisplay = "";
        if (method === 'jazzcash') methodDisplay = "JazzCash";
        else if (method === 'easypaisa') methodDisplay = "EasyPaisa";
        else if (method === 'upaisa') methodDisplay = "UPaisa";
        
        await addDoc(collection(db, 'withdrawal_requests'), {
            userId: currentUser.userId,
            userName: currentUser.name,
            amount: amount,
            method: method,
            methodDisplay: methodDisplay,
            accountNumber: account,
            status: 'pending',
            requestedAt: new Date().toISOString()
        });
        
        showToast(`✅ Withdrawal request of ₨${amount} submitted via ${methodDisplay}!`, "success");
        addActivity(`💰 Requested withdrawal of ₨${amount} via ${methodDisplay}`);
        
        if (document.getElementById('withdrawHistoryScreen').classList.contains('active')) {
            loadWithdrawalHistory();
        }
        
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('accountNumber').value = '';
        document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'));
        selectedMethod = null;
        
    } catch (error) {
        console.error(error);
        showToast("Failed to submit request: " + error.message, "error");
    }
    hideLoading();
};

// ========== SELECT WITHDRAWAL METHOD ==========
window.selectWithdrawalMethod = function(method) {
    selectedMethod = method;
    console.log("Method selected:", method);
    
    document.querySelectorAll('.method-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }
    
    let methodName = "";
    if (method === 'jazzcash') methodName = "JazzCash";
    else if (method === 'easypaisa') methodName = "EasyPaisa";
    else if (method === 'upaisa') methodName = "UPaisa";
    
    showToast(`Selected: ${methodName}`, "success");
};

// ========== WITHDRAWAL HISTORY FUNCTIONS ==========

async function loadWithdrawalHistory() {
    if (!currentUser) return;
    
    try {
        const { collection, query, where, getDocs } = window.firestoreHelpers;
        const db = window.db;
        
        const withdrawalsRef = collection(db, 'withdrawal_requests');
        const q = query(withdrawalsRef, where('userId', '==', currentUser.userId));
        const snapshot = await getDocs(q);
        
        allWithdrawals = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            let status = data.status || 'pending';
            if (status === 'successful') {
                status = 'approved';
            }
            allWithdrawals.push({
                id: doc.id,
                amount: data.amount,
                method: data.method,
                methodDisplay: data.methodDisplay || data.method,
                accountNumber: data.accountNumber,
                status: status,
                requestedAt: data.requestedAt,
                date: data.requestedAt ? new Date(data.requestedAt).toLocaleDateString() : new Date().toLocaleDateString(),
                time: data.requestedAt ? new Date(data.requestedAt).toLocaleTimeString() : new Date().toLocaleTimeString()
            });
        });
        
        allWithdrawals.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        renderWithdrawals();
        
    } catch (error) {
        console.error("Failed to load withdrawals:", error);
    }
}

window.filterWithdrawals = function(status) {
    currentFilter = status;
    
    document.querySelectorAll('.history-tab').forEach(tab => {
        tab.classList.remove('active');
        const tabText = tab.textContent.toLowerCase().trim();
        if (status === 'all' && tabText === 'all') {
            tab.classList.add('active');
        } else if (tabText === status) {
            tab.classList.add('active');
        }
    });
    
    renderWithdrawals();
};

function renderWithdrawals() {
    const container = document.getElementById('withdrawalsList');
    if (!container) return;
    
    let filtered = allWithdrawals;
    if (currentFilter !== 'all') {
        filtered = allWithdrawals.filter(w => w.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>No ${currentFilter !== 'all' ? currentFilter : ''} withdrawal requests found</p>
                <small>Your withdrawal history will appear here</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    filtered.forEach(withdrawal => {
        let methodIcon = "fa-mobile-alt";
        if (withdrawal.method === 'jazzcash') methodIcon = "fa-mobile-alt";
        else if (withdrawal.method === 'easypaisa') methodIcon = "fa-mobile-alt";
        else if (withdrawal.method === 'upaisa') methodIcon = "fa-university";
        
        let statusText = "";
        let statusIcon = "";
        let statusClass = "";
        
        if (withdrawal.status === 'approved') {
            statusText = "Approved";
            statusIcon = "fa-check-circle";
            statusClass = "approved";
        } else if (withdrawal.status === 'pending') {
            statusText = "Pending";
            statusIcon = "fa-clock";
            statusClass = "pending";
        } else if (withdrawal.status === 'rejected') {
            statusText = "Rejected";
            statusIcon = "fa-times-circle";
            statusClass = "rejected";
        } else {
            statusText = withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1);
            statusIcon = "fa-question-circle";
            statusClass = "pending";
        }
        
        const card = document.createElement('div');
        card.className = `withdrawal-card ${statusClass}`;
        card.innerHTML = `
            <div class="withdrawal-header">
                <div class="withdrawal-amount">
                    <i class="fas fa-rupee-sign"></i> ${withdrawal.amount}
                </div>
                <div class="withdrawal-status status-${statusClass}">
                    <i class="fas ${statusIcon}"></i> ${statusText}
                </div>
            </div>
            <div class="withdrawal-details">
                <p><i class="fas ${methodIcon}"></i> ${withdrawal.methodDisplay || withdrawal.method}</p>
                <p><i class="fas fa-user"></i> Account: ${withdrawal.accountNumber || 'N/A'}</p>
                <p><i class="fas fa-calendar"></i> Date: ${withdrawal.date}</p>
                <p><i class="fas fa-clock"></i> Time: ${withdrawal.time}</p>
        `;
        
        if (withdrawal.status === 'approved') {
            card.innerHTML += '<p class="approved-text"><i class="fas fa-check-circle"></i> ✅ Amount sent to your account</p>';
        } else if (withdrawal.status === 'rejected') {
            card.innerHTML += '<p class="rejected-text"><i class="fas fa-exclamation-circle"></i> ❌ Request rejected. Contact support.</p>';
        } else if (withdrawal.status === 'pending') {
            card.innerHTML += '<p class="pending-text"><i class="fas fa-hourglass-half"></i> ⏳ Admin will process within 48 hours</p>';
        }
        
        card.innerHTML += `</div>`;
        container.appendChild(card);
    });
}

function listenForWithdrawalUpdates() {
    if (!currentUser) return;
    
    const { collection, query, where, onSnapshot } = window.firestoreHelpers;
    const db = window.db;
    
    const withdrawalsRef = collection(db, 'withdrawal_requests');
    const q = query(withdrawalsRef, where('userId', '==', currentUser.userId));
    
    onSnapshot(q, (snapshot) => {
        allWithdrawals = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            let status = data.status || 'pending';
            if (status === 'successful') {
                status = 'approved';
            }
            allWithdrawals.push({
                id: doc.id,
                amount: data.amount,
                method: data.method,
                methodDisplay: data.methodDisplay || data.method,
                accountNumber: data.accountNumber,
                status: status,
                requestedAt: data.requestedAt,
                date: data.requestedAt ? new Date(data.requestedAt).toLocaleDateString() : new Date().toLocaleDateString(),
                time: data.requestedAt ? new Date(data.requestedAt).toLocaleTimeString() : new Date().toLocaleTimeString()
            });
        });
        allWithdrawals.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        
        if (document.getElementById('withdrawHistoryScreen').classList.contains('active')) {
            renderWithdrawals();
        }
    });
}

// ========== DAILY BONUS ==========
window.claimDailyBonus = async function() {
    if (!currentUser) return;
    
    const lastBonus = localStorage.getItem('lastBonus_' + currentUser.userId);
    const today = new Date().toDateString();
    
    if (lastBonus === today) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const hoursLeft = Math.ceil((tomorrow - new Date()) / (1000 * 60 * 60));
        showToast(`Already claimed! Next bonus in ${hoursLeft} hours`, "error");
        return;
    }
    
    const bonus = 20 + (appData.streak * 2);
    
    showLoading("Claiming bonus...");
    await new Promise(r => setTimeout(r, 1500));
    
    try {
        const { doc, updateDoc, increment } = window.firestoreHelpers;
        const db = window.db;
        
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, {
            balance: increment(bonus),
            streak: increment(1)
        });
        
        appData.balance += bonus;
        appData.streak++;
        localStorage.setItem('lastBonus_' + currentUser.userId, today);
        
        updateUI();
        addActivity(`🎁 Claimed daily bonus of ₨${bonus} (${appData.streak} day streak!)`);
        showToast(`🎁 +₨${bonus} bonus claimed!`, "success");
        
    } catch (error) {
        console.error(error);
        showToast("Failed to claim bonus!", "error");
    }
    hideLoading();
};

// ========== WATCH AD WITH REAL TIMER ==========
window.watchAd = async function(type) {
    if (!currentUser) {
        showToast("Please login first!", "error");
        return;
    }
    
    const lastAd = localStorage.getItem('lastAd_' + currentUser.userId);
    const now = Date.now();
    
    if (lastAd && (now - parseInt(lastAd)) < 30000) {
        const waitTime = Math.ceil((30000 - (now - parseInt(lastAd))) / 1000);
        showToast(`Wait ${waitTime} seconds before next ad!`, "error");
        return;
    }
    
    let duration = 10;
    let reward = 5;
    let message = "Watch this ad for ₨5";
    
    if (type === 'rewarded') {
        duration = 30;
        reward = 15;
        message = "Watch rewarded ad for ₨15";
    } else if (type === 'special') {
        duration = 60;
        reward = 50;
        message = "Special offer! Watch for ₨50";
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'ad-overlay';
    overlay.innerHTML = `
        <div style="background: #1e293b; padding: 30px; border-radius: 20px; text-align: center;">
            <i class="fas fa-play-circle" style="font-size: 60px; color: #667eea; margin-bottom: 20px;"></i>
            <h3 style="color: white;">${message}</h3>
            <div style="font-size: 48px; font-weight: bold; color: white; margin: 20px;" id="adTimer">${duration}</div>
            <div style="width: 200px; height: 8px; background: #334155; border-radius: 10px; margin: 0 auto;">
                <div id="adProgress" style="width: 0%; height: 100%; background: #10b981; border-radius: 10px;"></div>
            </div>
            <p style="color: #94a3b8; margin-top: 20px;">Don't close this window</p>
        </div>
    `;
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.9); z-index: 20000;
        display: flex; justify-content: center; align-items: center;
    `;
    document.body.appendChild(overlay);
    
    let timeLeft = duration;
    const timerDisplay = overlay.querySelector('#adTimer');
    const progressFill = overlay.querySelector('#adProgress');
    
    const interval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.innerText = timeLeft;
        if (progressFill) progressFill.style.width = `${((duration - timeLeft) / duration) * 100}%`;
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            overlay.remove();
            giveAdReward(reward);
        }
    }, 1000);
};

async function giveAdReward(reward) {
    try {
        const { doc, updateDoc, increment } = window.firestoreHelpers;
        const db = window.db;
        
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, {
            balance: increment(reward),
            tasksCompletedToday: increment(1)
        });
        
        appData.balance += reward;
        localStorage.setItem('lastAd_' + currentUser.userId, Date.now().toString());
        
        updateUI();
        addActivity(`🎬 Watched ad and earned ₨${reward}`);
        showToast(`🎬 +₨${reward} earned!`, "success");
        
    } catch (error) {
        console.error(error);
        showToast("Failed to add reward!", "error");
    }
}

// ========== CHECK PENDING TASKS ==========
async function checkPendingItems() {
    if (!currentUser) return;
    
    try {
        const { collection, query, where, getDocs, doc, updateDoc, arrayUnion, increment } = window.firestoreHelpers;
        const db = window.db;
        
        const tasksRef = collection(db, 'task_requests');
        const qTasks = query(tasksRef, where('userId', '==', currentUser.userId), where('status', '==', 'approved'));
        const tasksSnapshot = await getDocs(qTasks);
        
        for (const docSnap of tasksSnapshot.docs) {
            const data = docSnap.data();
            if (!appData.completedTasks.includes(data.taskId)) {
                const userRef = doc(db, 'users', currentUser.userId);
                await updateDoc(userRef, {
                    balance: increment(data.reward),
                    completedTasks: arrayUnion(data.taskId)
                });
                
                appData.balance += data.reward;
                appData.completedTasks.push(data.taskId);
                addActivity(`✅ Task "${data.taskName}" approved! +₨${data.reward}`);
                updateUI();
            }
        }
        
    } catch (error) {
        console.error("Check pending error:", error);
    }
}

// ========== UI UPDATE FUNCTIONS ==========
function updateUI() {
    document.getElementById('mainBalance').innerText = appData.balance;
    document.getElementById('withdrawBalance').innerText = appData.balance;
    document.getElementById('streakDays').innerText = appData.streak;
    document.getElementById('referralsCount').innerText = appData.referrals;
    document.getElementById('todayTasks').innerText = appData.completedTasks.length;
    document.getElementById('referTotal').innerText = appData.referrals;
    document.getElementById('referEarned').innerText = `₨ ${appData.referrals * 25}`;
}

function addActivity(message) {
    const activity = { id: Date.now(), message: message, time: new Date().toLocaleTimeString() };
    appData.activities.unshift(activity);
    if (appData.activities.length > 20) appData.activities.pop();
    updateActivities();
}

function updateActivities() {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    container.innerHTML = '';
    if (appData.activities.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No activities yet</div>';
        return;
    }
    
    appData.activities.forEach(activity => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `<i class="fas fa-history"></i><div><div>${activity.message}</div><small>${activity.time}</small></div>`;
        container.appendChild(div);
    });
}

// ========== LOAD TASKS ==========
async function loadTasks() {
    const tasks = [
        { id: 1, name: "Complete Profile", description: "Fill all profile details", reward: 50, icon: "fa-user" },
        { id: 2, name: "Follow Instagram", description: "Follow @kamaonow", reward: 30, icon: "fa-instagram" },
        { id: 3, name: "Join Telegram", description: "Join our Telegram channel", reward: 40, icon: "fa-telegram" },
        { id: 4, name: "Share on WhatsApp", description: "Share with 5 friends", reward: 60, icon: "fa-whatsapp" },
        { id: 5, name: "Watch 10 Ads", description: "Watch 10 video ads", reward: 100, icon: "fa-play-circle" }
    ];
    
    const container = document.getElementById('tasksList');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let task of tasks) {
        const isCompleted = appData.completedTasks?.includes(task.id);
        const div = document.createElement('div');
        div.className = `task-item ${isCompleted ? 'completed' : ''}`;
        div.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center;">
                <i class="fas ${task.icon}" style="font-size: 24px; color: #667eea;"></i>
                <div>
                    <strong>${task.name}</strong>
                    <div>+₨ ${task.reward}</div>
                    <small style="color: #666;">${task.description}</small>
                </div>
            </div>
            ${!isCompleted ? `<button class="task-btn" onclick="window.completeTask(${task.id}, '${task.name}', ${task.reward})">Complete</button>` : '<span style="color: #10b981;">✅ Verified</span>'}
        `;
        container.appendChild(div);
    }
}

// ========== LOAD USER DATA FROM FIREBASE ==========
async function loadUserData(userId) {
    try {
        const { doc, getDoc } = window.firestoreHelpers;
        const db = window.db;
        
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            appData.balance = data.balance || 0;
            appData.completedTasks = data.completedTasks || [];
            appData.referrals = data.referrals || 0;
            appData.streak = data.streak || 1;
        }
        
        updateUI();
        loadTasks();
        checkPendingItems();
        listenForWithdrawalUpdates();
        
    } catch (error) {
        console.error(error);
    }
}

// ========== LOGIN FUNCTION ==========
window.loginUser = async function() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showToast("Please enter email and password!", "error");
        return;
    }
    
    showLoading("Logging in...");
    
    try {
        const { collection, query, where, getDocs } = window.firestoreHelpers;
        const db = window.db;
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            showToast("User not found! Please register.", "error");
            hideLoading();
            return;
        }
        
        let userData = null;
        snapshot.forEach(doc => { userData = doc.data(); });
        
        if (btoa(password) !== userData.password) {
            showToast("Wrong password!", "error");
            hideLoading();
            return;
        }
        
        currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        await loadUserData(currentUser.userId);
        
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userName').innerText = currentUser.name;
        
        const linkEl = document.getElementById('referralLink');
        if (linkEl) {
            linkEl.innerText = `https://kamaonow.com/ref/${currentUser.userId}`;
        }
        
        showToast(`✅ Welcome back, ${currentUser.name}!`, "success");
        
    } catch (error) {
        console.error(error);
        showToast("Login failed!", "error");
    }
    hideLoading();
};

// ========== REGISTER FUNCTION ==========
window.registerUser = async function() {
    const name = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirm = document.getElementById('regConfirmPassword')?.value;
    
    if (!name || !email || !password) {
        showToast("Please fill all fields!", "error");
        return;
    }
    if (password !== confirm) {
        showToast("Passwords do not match!", "error");
        return;
    }
    if (password.length < 6) {
        showToast("Password must be at least 6 characters!", "error");
        return;
    }
    
    showLoading("Creating account...");
    
    try {
        const { collection, query, where, getDocs, doc, setDoc } = window.firestoreHelpers;
        const db = window.db;
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            showToast("Email already registered!", "error");
            hideLoading();
            return;
        }
        
        const userId = 'user_' + Date.now();
        await setDoc(doc(db, 'users', userId), {
            userId: userId,
            name: name,
            email: email,
            password: btoa(password),
            balance: 0,
            completedTasks: [],
            referrals: 0,
            streak: 1,
            createdAt: new Date().toISOString(),
            status: 'active'
        });
        
        showToast("✅ Registration successful! Please login.", "success");
        window.switchAuthTab('login');
        
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirmPassword').value = '';
        
    } catch (error) {
        console.error(error);
        showToast("Registration failed!", "error");
    }
    hideLoading();
};

// ========== HELPER FUNCTIONS ==========
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(msg) {
    const loader = document.createElement('div');
    loader.id = 'loadingOverlay';
    loader.className = 'loading';
    loader.innerHTML = `<div class="loader"></div><div>${msg}</div>`;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.remove();
}

window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    showToast("Logged out successfully!", "success");
};

window.navigateTo = function(screen) {
    const screens = ['home', 'tasks', 'earn', 'withdraw', 'refer', 'withdrawHistory'];
    screens.forEach(s => {
        const el = document.getElementById(`${s}Screen`);
        if (el) el.classList.remove('active');
    });
    document.getElementById(`${screen}Screen`).classList.add('active');
    
    if (screen === 'withdrawHistory') {
        loadWithdrawalHistory();
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    const screenMap = { home: 0, tasks: 1, earn: 2, withdraw: 3, withdrawHistory: 4, refer: 5 };
    navItems.forEach((item, index) => {
        if (index === screenMap[screen]) item.classList.add('active');
        else item.classList.remove('active');
    });
};

window.switchAuthTab = function(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
};

window.copyReferralLink = function() {
    const link = `https://kamaonow.com/ref/${currentUser?.userId || 'guest'}`;
    navigator.clipboard.writeText(link);
    showToast("Referral link copied!", "success");
};

// ========== CHECK SAVED USER ==========
const savedUser = localStorage.getItem('currentUser');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userName').innerText = currentUser.name;
    loadUserData(currentUser.userId);
}

setInterval(() => {
    if (currentUser) checkPendingItems();
}, 30000);

console.log("✅ KamaoNow Production Mode Ready - Withdrawal History Working!");