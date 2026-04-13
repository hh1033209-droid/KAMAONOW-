// ========== FIREBASE IMPORT ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where,
    updateDoc,
    increment,
    arrayUnion,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// ========== YOUR FIREBASE CONFIG ==========
const firebaseConfig = {
    apiKey: "AIzaSyBxNjS-VXmSvW5I_qzO7b5uqtdePVblg7w",
    authDomain: "kamaonow-1b9de.firebaseapp.com",
    databaseURL: "https://kamaonow-1b9de-default-rtdb.firebaseio.com",
    projectId: "kamaonow-1b9de",
    storageBucket: "kamaonow-1b9de.firebasestorage.app",
    messagingSenderId: "575126602800",
    appId: "1:575126602800:web:652669db780878eff999f5",
    measurementId: "G-YWW0C89LKE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 KamaoNow Connected to Firebase!");

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let appData = {
    balance: 0,
    tasksCompletedToday: 0,
    referrals: 0,
    streak: 1,
    tasks: [],
    activities: [],
    lastAdTime: 0
};

let selectedWithdrawalMethod = null;

// ========== DEFAULT TASKS ==========
const defaultTasks = [
    { id: 1, name: "Complete Profile", description: "Fill your profile details", reward: 50, category: "easy", active: true, icon: "fa-user-edit" },
    { id: 2, name: "Follow on Instagram", description: "Follow @kamaonow", reward: 30, category: "social", active: true, icon: "fa-instagram" },
    { id: 3, name: "Join Telegram Channel", description: "Join our Telegram group", reward: 40, category: "social", active: true, icon: "fa-telegram" },
    { id: 4, name: "Like Facebook Page", description: "Like KamaoNow on FB", reward: 25, category: "social", active: true, icon: "fa-facebook" },
    { id: 5, name: "Rate 5 Stars", description: "Rate us on Play Store", reward: 45, category: "easy", active: true, icon: "fa-star" },
    { id: 6, name: "Share on WhatsApp", description: "Share with 5 friends", reward: 60, category: "social", active: true, icon: "fa-whatsapp" },
    { id: 7, name: "Daily Check-in", description: "Claim your daily reward", reward: 20, category: "daily", active: true, icon: "fa-gift" }
];

// ========== AUTH FUNCTIONS ==========
async function checkAuth() {
    const savedUser = localStorage.getItem('kamaoNow_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        await loadUserData(currentUser.userId);
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        startRealtimeListeners();
        return true;
    } else {
        document.getElementById('authModal').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        return false;
    }
}

async function registerUser() {
    const name = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    
    if (!name || !email || !password) {
        showToast('Please fill all fields!', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters!', 'error');
        return;
    }
    
    showLoading('Creating account...');
    
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            showToast('Email already registered!', 'error');
            hideLoading();
            return;
        }
        
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const userData = {
            userId: userId,
            name: name,
            email: email,
            password: btoa(password),
            balance: 100,
            tasksCompletedToday: 0,
            totalTasksCompleted: 0,
            referrals: 0,
            referralEarnings: 0,
            streak: 1,
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'active',
            completedTasks: []
        };
        
        await setDoc(doc(db, 'users', userId), userData);
        
        currentUser = { userId: userId, name: name, email: email };
        localStorage.setItem('kamaoNow_user', JSON.stringify(currentUser));
        
        await loadUserData(userId);
        
        showToast('✅ Account created successfully!', 'success');
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        
        startRealtimeListeners();
        
    } catch (error) {
        console.error('Register error:', error);
        showToast('Registration failed!', 'error');
    }
    hideLoading();
}

async function loginUser() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showToast('Please enter email and password!', 'error');
        return;
    }
    
    showLoading('Logging in...');
    
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showToast('User not found! Please register.', 'error');
            hideLoading();
            return;
        }
        
        let userData = null;
        querySnapshot.forEach((doc) => { userData = doc.data(); });
        
        if (btoa(password) !== userData.password) {
            showToast('Wrong password!', 'error');
            hideLoading();
            return;
        }
        
        if (userData.status === 'banned') {
            showToast('Your account has been banned!', 'error');
            hideLoading();
            return;
        }
        
        currentUser = { userId: userData.userId, name: userData.name, email: userData.email };
        localStorage.setItem('kamaoNow_user', JSON.stringify(currentUser));
        
        await loadUserData(userData.userId);
        
        await updateDoc(doc(db, 'users', userData.userId), {
            lastLogin: new Date().toISOString()
        });
        
        showToast(`Welcome back, ${userData.name}!`, 'success');
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        
        startRealtimeListeners();
        
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed!', 'error');
    }
    hideLoading();
}

function logoutUser() {
    localStorage.removeItem('kamaoNow_user');
    currentUser = null;
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    showToast('Logged out successfully!', 'success');
}

// ========== LOAD USER DATA ==========
async function loadUserData(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            appData.balance = data.balance || 0;
            appData.tasksCompletedToday = data.tasksCompletedToday || 0;
            appData.referrals = data.referrals || 0;
            appData.referralEarnings = data.referralEarnings || 0;
            appData.streak = data.streak || 1;
            appData.completedTasks = data.completedTasks || [];
        }
        
        document.getElementById('userName').innerText = currentUser?.name || 'User';
        
        const tasksRef = collection(db, 'tasks');
        const tasksSnapshot = await getDocs(tasksRef);
        
        if (!tasksSnapshot.empty) {
            appData.tasks = [];
            tasksSnapshot.forEach((doc) => {
                const task = doc.data();
                task.id = parseInt(doc.id);
                task.completed = appData.completedTasks?.includes(task.id) || false;
                appData.tasks.push(task);
            });
        } else {
            for (const task of defaultTasks) {
                await setDoc(doc(db, 'tasks', task.id.toString()), task);
                task.completed = appData.completedTasks?.includes(task.id) || false;
                appData.tasks.push(task);
            }
        }
        
        updateAllUI();
        
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

// ========== REAL-TIME LISTENERS ==========
function startRealtimeListeners() {
    if (!currentUser) return;
    
    const userRef = doc(db, 'users', currentUser.userId);
    onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            appData.balance = data.balance;
            appData.tasksCompletedToday = data.tasksCompletedToday;
            updateBalanceUI();
        }
    });
    
    const tasksRef = collection(db, 'tasks');
    onSnapshot(tasksRef, (snapshot) => {
        const updatedTasks = [];
        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = parseInt(doc.id);
            task.completed = appData.completedTasks?.includes(task.id) || false;
            updatedTasks.push(task);
        });
        appData.tasks = updatedTasks;
        updateTasksUI();
    });
}

// ========== TASK FUNCTIONS ==========
async function completeTask(taskId) {
    const task = appData.tasks.find(t => t.id === taskId);
    
    if (!task) { showToast('Task not found!', 'error'); return; }
    if (task.completed) { showToast('Task already completed!', 'error'); return; }
    if (appData.tasksCompletedToday >= 20) { showToast('Daily task limit reached!', 'error'); return; }
    
    showLoading('Verifying task...');
    await new Promise(r => setTimeout(r, 1500));
    
    try {
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, {
            balance: increment(task.reward),
            tasksCompletedToday: increment(1),
            totalTasksCompleted: increment(1),
            completedTasks: arrayUnion(task.id)
        });
        
        addActivity(`✅ Completed "${task.name}" and earned ₨${task.reward}`);
        task.completed = true;
        appData.balance += task.reward;
        appData.tasksCompletedToday++;
        
        updateAllUI();
        showToast(`🎉 +₨${task.reward} earned!`, 'success');
        
    } catch (error) {
        console.error('Complete task error:', error);
        showToast('Failed to complete task!', 'error');
    }
    hideLoading();
}

// ========== AD FUNCTIONS ==========
function watchAd(adType) {
    const now = Date.now();
    if (now - appData.lastAdTime < 30000 && appData.lastAdTime !== 0) {
        showToast(`Wait ${Math.ceil(30 - (now - appData.lastAdTime)/1000)} seconds`, 'error');
        return;
    }
    
    let duration = 10, reward = 5, message = 'Watch ad to earn ₨5';
    if (adType === 'rewarded') { duration = 30; reward = 15; message = 'Watch rewarded ad - Earn ₨15!'; }
    if (adType === 'special') { duration = 60; reward = 50; message = 'Special offer - Earn ₨50!'; }
    
    showAdTimer(duration, reward, message);
}

function showAdTimer(duration, reward, message) {
    let timeLeft = duration;
    const overlay = document.createElement('div');
    overlay.className = 'ad-overlay';
    overlay.innerHTML = `
        <i class="fas fa-play-circle" style="font-size: 80px; margin-bottom: 20px; color: #667eea;"></i>
        <h2>${message}</h2>
        <div style="font-size: 48px; font-weight: bold; margin: 20px;" id="adTimer">${timeLeft}</div>
        <div style="width: 80%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 10px;">
            <div id="adProgress" style="width: 0%; height: 100%; background: #10b981;"></div>
        </div>
        <p style="margin-top: 20px;">Don't close this window</p>
    `;
    document.body.appendChild(overlay);
    
    const interval = setInterval(async () => {
        timeLeft--;
        const timerEl = document.getElementById('adTimer');
        const progressEl = document.getElementById('adProgress');
        if (timerEl) timerEl.innerText = timeLeft;
        if (progressEl) progressEl.style.width = `${((duration - timeLeft) / duration) * 100}%`;
        
        if (timeLeft < 0) {
            clearInterval(interval);
            overlay.remove();
            await completeAdWatch(reward);
        }
    }, 1000);
}

async function completeAdWatch(reward) {
    appData.lastAdTime = Date.now();
    try {
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, {
            balance: increment(reward),
            tasksCompletedToday: increment(1)
        });
        
        appData.balance += reward;
        appData.tasksCompletedToday++;
        addActivity(`🎬 Watched ad and earned ₨${reward}`);
        updateAllUI();
        showToast(`🎬 +₨${reward} earned!`, 'success');
    } catch (error) {
        console.error('Ad reward error:', error);
    }
}

// ========== DAILY BONUS ==========
async function claimDailyBonus() {
    const lastBonus = localStorage.getItem('lastBonusDate');
    const today = new Date().toDateString();
    
    if (lastBonus === today) {
        showToast('Already claimed today!', 'error');
        return;
    }
    
    showLoading('Claiming bonus...');
    await new Promise(r => setTimeout(r, 1000));
    
    const bonus = 50 + (appData.streak * 5);
    
    try {
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, {
            balance: increment(bonus),
            streak: increment(1)
        });
        
        appData.balance += bonus;
        appData.streak++;
        localStorage.setItem('lastBonusDate', today);
        
        addActivity(`🎁 Claimed daily bonus of ₨${bonus} (${appData.streak} day streak!)`);
        updateAllUI();
        showToast(`🎯 +₨${bonus} bonus claimed!`, 'success');
    } catch (error) {
        console.error('Bonus error:', error);
    }
    hideLoading();
}

// ========== WITHDRAWAL FUNCTIONS ==========
function selectWithdrawalMethod(method) {
    selectedWithdrawalMethod = method;
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

async function requestWithdrawal() {
    const amount = parseInt(document.getElementById('withdrawAmount')?.value);
    const account = document.getElementById('accountNumber')?.value;
    
    if (!selectedWithdrawalMethod) { showToast('Select a method!', 'error'); return; }
    if (!amount || amount < 200) { showToast('Minimum ₨200!', 'error'); return; }
    if (!account) { showToast('Enter account number!', 'error'); return; }
    if (amount > appData.balance) { showToast('Insufficient balance!', 'error'); return; }
    
    showLoading('Submitting request...');
    await new Promise(r => setTimeout(r, 1500));
    
    try {
        const withdrawalData = {
            userId: currentUser.userId,
            userName: currentUser.name,
            amount: amount,
            method: selectedWithdrawalMethod,
            account: account,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(collection(db, 'withdrawals')), withdrawalData);
        
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, { balance: increment(-amount) });
        
        appData.balance -= amount;
        addActivity(`💰 Withdrawal request of ₨${amount} submitted`);
        updateAllUI();
        showToast(`✅ Withdrawal request submitted!`, 'success');
        
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('accountNumber').value = '';
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToast('Failed to submit!', 'error');
    }
    hideLoading();
}

// ========== REFERRAL FUNCTIONS ==========
function getReferralLink() {
    return `https://kamaonow.com/ref/${currentUser?.userId}`;
}

async function copyReferralLink() {
    await navigator.clipboard.writeText(getReferralLink());
    showToast('Referral link copied!', 'success');
}

// ========== ACTIVITY FUNCTIONS ==========
function addActivity(message) {
    const activity = { id: Date.now(), message: message, time: new Date().toLocaleTimeString() };
    appData.activities.unshift(activity);
    if (appData.activities.length > 20) appData.activities.pop();
    updateActivitiesUI();
}

// ========== UI UPDATE FUNCTIONS ==========
function updateAllUI() {
    updateBalanceUI();
    updateTasksUI();
    updateActivitiesUI();
    updateReferralUI();
}

function updateBalanceUI() {
    document.getElementById('mainBalance').innerText = appData.balance;
    document.getElementById('withdrawBalance').innerText = appData.balance;
    document.getElementById('todayTasks').innerText = appData.tasksCompletedToday;
    document.getElementById('streakDays').innerText = appData.streak;
    document.getElementById('referralsCount').innerText = appData.referrals;
}

function updateTasksUI() {
    const container = document.getElementById('tasksList');
    if (!container) return;
    
    container.innerHTML = '';
    const remainingTasks = 20 - appData.tasksCompletedToday;
    if (remainingTasks < 5) {
        const warning = document.createElement('div');
        warning.className = 'task-limit-warning';
        warning.innerHTML = `⚠️ Only ${remainingTasks} tasks left today!`;
        container.appendChild(warning);
    }
    
    appData.tasks.forEach(task => {
        if (!task.active) return;
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskCard.innerHTML = `
            <div class="task-info">
                <i class="fas ${task.icon || 'fa-tasks'}"></i>
                <div>
                    <h4>${task.name}</h4>
                    <p>${task.description}</p>
                    <div class="task-reward">+₨ ${task.reward}</div>
                </div>
            </div>
            <button class="task-btn" onclick="completeTask(${task.id})" ${task.completed ? 'disabled' : ''}>
                ${task.completed ? 'Completed' : 'Complete'}
            </button>
        `;
        container.appendChild(taskCard);
    });
}

function updateActivitiesUI() {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    if (appData.activities.length === 0) {
        container.innerHTML = '<div class="empty-state">No activities yet. Start earning!</div>';
        return;
    }
    
    container.innerHTML = '';
    appData.activities.slice(0, 10).forEach(activity => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `<i class="fas fa-history"></i><div><div>${activity.message}</div><small>${activity.time}</small></div>`;
        container.appendChild(div);
    });
}

function updateReferralUI() {
    const linkEl = document.getElementById('referralLink');
    if (linkEl) linkEl.innerText = getReferralLink();
    document.getElementById('referTotal').innerText = appData.referrals;
    document.getElementById('referEarned').innerText = `₨ ${appData.referralEarnings}`;
}

// ========== NAVIGATION ==========
function navigateTo(screen) {
    const screens = ['home', 'tasks', 'earn', 'withdraw', 'refer'];
    screens.forEach(s => {
        const el = document.getElementById(`${s}Screen`);
        if (el) el.classList.remove('active');
    });
    document.getElementById(`${screen}Screen`).classList.add('active');
    
    const navItems = document.querySelectorAll('.nav-item');
    const screenMap = { home: 0, tasks: 1, earn: 2, withdraw: 3, refer: 4 };
    navItems.forEach((item, index) => {
        if (index === screenMap[screen]) item.classList.add('active');
        else item.classList.remove('active');
    });
    updateAllUI();
}

// ========== UI HELPER FUNCTIONS ==========
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
    toast.style.color = 'white';
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showLoading(message) {
    const loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `<div class="loader"></div><p style="margin-top: 15px;">${message}</p>`;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.remove();
}

function switchAuthTab(tab) {
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
}

// ========== EXPOSE GLOBAL FUNCTIONS ==========
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.completeTask = completeTask;
window.watchAd = watchAd;
window.claimDailyBonus = claimDailyBonus;
window.selectWithdrawalMethod = selectWithdrawalMethod;
window.requestWithdrawal = requestWithdrawal;
window.copyReferralLink = copyReferralLink;
window.navigateTo = navigateTo;
window.switchAuthTab = switchAuthTab;

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

console.log("🚀 KamaoNow Fully Functional!");