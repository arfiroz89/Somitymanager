// ✅ ES Module নিয়ম: import সবসময় ফাইলের একেবারে শুরুতে থাকতে হয়
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, sendPasswordResetEmail, deleteUser, signInAnonymously, setPersistence, browserLocalPersistence }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, getDocFromCache, onSnapshot, collection, addDoc, deleteDoc, updateDoc, serverTimestamp, getDocs, query, where, writeBatch, increment, orderBy, limit, startAfter, deleteField }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚡ PERFORMANCE: Production-এ verbose console.log বন্ধ করো (import-এর পরে রাখতে হয়)
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    const _noop = () => {};
    console.log = _noop;
    // console.warn ও console.error চালু থাকবে debugging-এর জন্য
}

// ===== PWA Service Worker রেজিস্ট্রেশন =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] রেজিস্টার সফল। Scope:', reg.scope))
      .catch(err => console.warn('[SW] রেজিস্ট্রেশন ব্যর্থ:', err));
  });
}
// ===== PWA Service Worker শেষ =====

// ===== ✅ কাস্টম Alert/Confirm মডাল — ব্রাউজারের ডিফল্ট alert()/confirm()-এর
// বদলে অ্যাপের নিজস্ব ডিজাইনের পপআপ (যাতে "The page at ... says" এর মতো
// ব্রাউজার-জেনারেটেড টেক্সট আর না দেখায়) =====
function _cmEscape(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}
function _cmBuild({ icon, title, message, buttons }) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay show';
    const titleHtml = title ? `<div style="font-size:17px;font-weight:800;color:#1e293b;margin-bottom:8px;">${_cmEscape(title)}</div>` : '';
    const msgHtml = _cmEscape(message).replace(/\n/g, '<br>');
    const btnsHtml = buttons.map((b, i) =>
        `<button data-i="${i}" class="modal-btn ${b.kind === 'cancel' ? 'modal-btn-cancel' : 'modal-btn-ok'}"${b.danger ? ' style="background:linear-gradient(135deg,#dc2626,#ef4444);"' : ''}>${_cmEscape(b.label)}</button>`
    ).join('');
    overlay.innerHTML = `
        <div class="custom-modal">
            <div class="custom-modal-icon">${icon || 'ℹ️'}</div>
            ${titleHtml}
            <div style="font-size:14.5px;color:#475569;line-height:1.65;text-align:left;">${msgHtml}</div>
            <div class="custom-modal-actions">${btnsHtml}</div>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}
// window.showAlert(message, {icon, title}) — OK চাপলে resolve হয়, await করা ঐচ্ছিক
window.showAlert = function(message, opts = {}) {
    return new Promise(resolve => {
        const overlay = _cmBuild({
            icon: opts.icon || '✅',
            title: opts.title || '',
            message,
            buttons: [{ label: opts.okText || 'ঠিক আছে', kind: 'ok' }]
        });
        const cleanup = () => { overlay.remove(); resolve(); };
        overlay.querySelector('[data-i="0"]').onclick = cleanup;
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(); });
    });
};
// window.showConfirm(message, {icon, title, okText, cancelText, danger}) — true/false রিটার্ন করে
window.showConfirm = function(message, opts = {}) {
    return new Promise(resolve => {
        const overlay = _cmBuild({
            icon: opts.icon || '⚠️',
            title: opts.title || '',
            message,
            buttons: [
                { label: opts.cancelText || 'বাতিল', kind: 'cancel' },
                { label: opts.okText || 'হ্যাঁ', kind: 'ok', danger: opts.danger !== false }
            ]
        });
        const cleanup = (result) => { overlay.remove(); resolve(result); };
        overlay.querySelector('[data-i="0"]').onclick = () => cleanup(false);
        overlay.querySelector('[data-i="1"]').onclick = () => cleanup(true);
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    });
};
// window.showPrompt(message, defaultValue, opts) — টেক্সট ইনপুটসহ মডাল, মান বা null রিটার্ন করে
window.showPrompt = function(message, defaultValue = '', opts = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay show';
        const titleHtml = opts.title ? `<div style="font-size:17px;font-weight:800;color:#1e293b;margin-bottom:8px;">${_cmEscape(opts.title)}</div>` : '';
        const msgHtml = _cmEscape(message).replace(/\n/g, '<br>');
        const inputType = opts.type || 'text';
        overlay.innerHTML = `
            <div class="custom-modal">
                <div class="custom-modal-icon">${opts.icon || '✏️'}</div>
                ${titleHtml}
                <div style="font-size:14.5px;color:#475569;line-height:1.65;text-align:left;margin-bottom:12px;">${msgHtml}</div>
                <input type="${inputType}" class="cm-prompt-input"
                    style="width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:12px;padding:11px 14px;font-size:14.5px;outline:none;">
                <div class="custom-modal-actions">
                    <button data-i="0" class="modal-btn modal-btn-cancel">${opts.cancelText || 'বাতিল'}</button>
                    <button data-i="1" class="modal-btn modal-btn-ok">${opts.okText || 'ঠিক আছে'}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('.cm-prompt-input');
        input.value = defaultValue ?? ''; // attribute escaping এড়াতে JS property দিয়ে সেট করা হলো
        setTimeout(() => input.focus(), 50);
        const cleanup = (result) => { overlay.remove(); resolve(result); };
        overlay.querySelector('[data-i="0"]').onclick = () => cleanup(null);
        overlay.querySelector('[data-i="1"]').onclick = () => cleanup(input.value);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(input.value); });
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });
    });
};
// ===== কাস্টম Alert/Confirm মডাল শেষ =====
        // ✅ FIX #6: ImgBB API Key এখন আর এখানে নেই — uploadToImgBB() এখন নিজে ImgBB-কে কল করে না,
        // বরং নিজের Netlify Function (/.netlify/functions/upload-image) কল করে, যেটা key
        // সার্ভার-সাইডে (Environment Variable) রেখে ImgBB-কে কল করে। key কখনো browser-এ আসে না।

        // ===== আপনার Firebase Config এখানে দিন =====
  const firebaseConfig = {
    apiKey: "AIzaSyAnCBRshhhtrsV8EWlVgxA7zvRIE6J0u4o",
    authDomain: "somity-manager.firebaseapp.com",
    projectId: "somity-manager",
    storageBucket: "somity-manager.firebasestorage.app",
    messagingSenderId: "295696656826",
    appId: "1:295696656826:web:90f98dd3c9715973985583"
  };

        // ✅ FIX #7: SMS গেটওয়ে ফিচার বাদ দেওয়া হয়েছে (ব্যবহার হচ্ছিল না, প্রয়োজন নেই)

        const app = initializeApp(firebaseConfig);
        window._firebaseApp = app; // 🔔 FCM-এর জন্য সেভ রাখো

        const auth    = getAuth(app);

        // ✅ রিফ্রেশে লগইন পেজ না দেখানোর জন্য Local Persistence নিশ্চিত করা
        // fire-and-forget — onAuthStateChanged কে block করে না, তাই loading দ্রুত হয়
        setPersistence(auth, browserLocalPersistence).catch(e =>
            console.warn('[Auth] setPersistence ব্যর্থ:', e.message)
        );

        // ✅ FIX ২: ব্যাক বাটনে অ্যাপ থেকে বের না হওয়ার জন্য History API ব্যবস্থাপনা
        // প্রতিটি modal/panel খোলার সময় history-তে একটা entry যোগ হবে,
        // ব্যাক বাটন চাপলে সেটা বন্ধ হবে — অ্যাপ থেকে বের হবে না।
        const _modalStack = []; // কোন modal এখন খোলা আছে তার stack

        // অ্যাপ লোডের সময় base history entry সেট করো
        // যাতে প্রথম ব্যাক চাপে অ্যাপ বন্ধ না হয়
        history.replaceState({ modalDepth: 0 }, '');

        window._pushModalHistory = function(closeFn) {
            _modalStack.push(closeFn);
            history.pushState({ modalDepth: _modalStack.length }, '');
        };
        window._popModalHistory = function() {
            if (_modalStack.length > 0) {
                _modalStack.pop();
            }
        };

        window.addEventListener('popstate', function(e) {
            const depth = e.state?.modalDepth ?? 0;
            if (_modalStack.length > 0) {
                // সর্বশেষ খোলা modal বন্ধ করো
                const closeFn = _modalStack.pop();
                if (typeof closeFn === 'function') closeFn();
            } else {
                // কোনো modal খোলা নেই — অ্যাপ বন্ধ না করে আবার base state-এ ফিরে যাও
                history.pushState({ modalDepth: 0 }, '');
            }
        });

        // ===== Firestore — অফলাইন Persistent Cache চালু =====
        // IndexedDB-তে সব ডেটা ক্যাশ হবে; নেটওয়ার্ক না থাকলেও পড়া যাবে।
        // একাধিক ট্যাব সাপোর্টের জন্য persistentMultipleTabManager ব্যবহার।
        const db = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });

        // ===== Global এ expose করা =====
        window._firebaseAuth    = auth;
        window._firebaseDb      = db;
        window._firebaseFns = {
            signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
            sendPasswordResetEmail, deleteUser, signInAnonymously,
            doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc, serverTimestamp,
            getDocs, query, where, writeBatch, increment, orderBy, limit, startAfter, deleteField
        };

        // =====================================================================
        // 🌐 নেটওয়ার্ক-নিরাপদ Firestore Helper
        // ── কেন এটা লাগবে? ──
        // অফলাইনে (বা নেটওয়ার্ক স্লো/আনরিচেবল হলে) Firestore-এর getDoc()/addDoc()/
        // updateDoc()/deleteDoc() ইত্যাদি Promise রিজেক্ট না করে অনির্দিষ্টকালের জন্য
        // পেন্ডিং থেকে যেতে পারে (এটাই Firestore SDK-এর ডকুমেন্টেড আচরণ — অফলাইনে
        // write/​read Promise ব্যাকগ্রাউন্ডে অনলাইন হওয়া পর্যন্ত resolve হয় না)।
        // এই কারণেই "লোড হচ্ছে..." স্ক্রিনে অ্যাপ চিরকাল আটকে থাকত।
        // সমাধান: প্রতিটি call একটি টাইমআউটের সাথে race করানো হচ্ছে — টাইমআউট হলেও
        // UI এগিয়ে যাবে (read → local cache থেকে, write → ব্যাকগ্রাউন্ডে চলতে থাকবে
        // এবং অনলাইনে ফিরলে নিজে থেকেই sync হবে)।
        // =====================================================================

        // ── promise টিকে টাইমআউটের সাথে race করায়; টাইমআউট হলে {timedOut:true} ──
        function _raceTimeout(promise, ms) {
            return new Promise((resolve, reject) => {
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) { settled = true; resolve({ timedOut: true }); }
                }, ms);
                promise.then(
                    (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ timedOut: false, value }); } },
                    (err)   => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } }
                );
            });
        }

        // ── getDoc, কিন্তু সময়মতো উত্তর না পেলে সরাসরি লোকাল ক্যাশ (IndexedDB) থেকে পড়ো ──
        // ✅ FIX #1: timeout 4500→3000ms — অফলাইনে startup দ্রুত হবে (দুটো sequential call = আগে 9s, এখন 6s)
        async function _smartGetDoc(ref, timeoutMs = 3000) {
            try {
                const r = await _raceTimeout(getDoc(ref), timeoutMs);
                if (!r.timedOut) return r.value; // সার্ভার সময়মতো উত্তর দিয়েছে
            } catch (e) {
                // getDoc রিজেক্ট হয়েছে (যেমন: offline/unavailable) — নিচে ক্যাশ থেকে চেষ্টা করব
            }
            try {
                return await getDocFromCache(ref);
            } catch (e2) {
                return null; // নেটওয়ার্কও নেই, ক্যাশও নেই (নতুন ডিভাইসে প্রথমবার অফলাইনে চালানো হলে এমন হতে পারে)
            }
        }

        // ── write call (add/update/delete): টাইমআউট হলে UI এগিয়ে যাক, write ব্যাকগ্রাউন্ডে চলুক ──
        async function _writeNoBlock(promise, timeoutMs = 2500) {
            try {
                const r = await _raceTimeout(promise, timeoutMs);
                if (r.timedOut) {
                    // অফলাইন বলে ধরে নিচ্ছি — Firestore নিজেই local cache এ লিখে রেখেছে,
                    // অনলাইনে এলে নিজে থেকেই backend-এ sync হবে। শুধু unhandled rejection আটকাও।
                    promise.catch(() => {});
                    return null;
                }
                return r.value;
            } catch (err) {
                // টাইমআউটের আগেই reject হয়েছে
                if (!navigator.onLine || err.code === 'unavailable' || err.code === 'deadline-exceeded') {
                    return null; // নেটওয়ার্ক সমস্যা — অফলাইন queue হিসেবে গণ্য করো
                }
                throw err; // আসল এরর (যেমন permission-denied) — caller কে জানানো জরুরি
            }
        }

        // =====================================================================
        // 📦 অফলাইন Queue সিস্টেম — IndexedDB ভিত্তিক
        // অফলাইনে যেকোনো write → IndexedDB queue তে জমা
        // অনলাইনে ফিরলে → স্বয়ংক্রিয়ভাবে Firestore এ sync
        // =====================================================================
        const OFFLINE_DB_NAME    = 'somity_offline_queue';
        const OFFLINE_STORE_NAME = 'pending_writes';
        const OFFLINE_DB_VERSION = 1;

        // ── IndexedDB খোলো ──
        function _openOfflineDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db2 = e.target.result;
                    if (!db2.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
                        db2.createObjectStore(OFFLINE_STORE_NAME, { autoIncrement: true });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror   = (e) => reject(e.target.error);
            });
        }

        // ── Queue তে একটি write অপারেশন যোগ করো ──
        async function _enqueueOfflineWrite(op) {
            try {
                const idb   = await _openOfflineDB();
                const tx    = idb.transaction(OFFLINE_STORE_NAME, 'readwrite');
                const store = tx.objectStore(OFFLINE_STORE_NAME);
                store.add({ ...op, queuedAt: Date.now() });
                idb.close();
            } catch(e) {
                console.warn('[OfflineQueue] enqueue ব্যর্থ:', e);
            }
        }

        // ── সব pending write পড়ো ──
        async function _getAllOfflineWrites() {
            return new Promise(async (resolve) => {
                try {
                    const idb   = await _openOfflineDB();
                    const tx    = idb.transaction(OFFLINE_STORE_NAME, 'readonly');
                    const store = tx.objectStore(OFFLINE_STORE_NAME);
                    const req   = store.getAll();
                    const keys  = store.getAllKeys();
                    let all = [], allKeys = [];
                    req.onsuccess  = () => { all     = req.result;  tryResolve(); };
                    keys.onsuccess = () => { allKeys = keys.result; tryResolve(); };
                    req.onerror    = () => resolve([]);
                    let done = 0;
                    function tryResolve() {
                        done++;
                        if (done === 2) {
                            idb.close();
                            resolve(all.map((op, i) => ({ key: allKeys[i], op })));
                        }
                    }
                } catch(e) { resolve([]); }
            });
        }

        // ── একটি key মুছো (sync সফল হলে) ──
        async function _deleteOfflineWrite(key) {
            try {
                const idb   = await _openOfflineDB();
                const tx    = idb.transaction(OFFLINE_STORE_NAME, 'readwrite');
                tx.objectStore(OFFLINE_STORE_NAME).delete(key);
                idb.close();
            } catch(e) {}
        }

        // ── Offline Queue থেকে Firestore এ sync করো ──
        async function _syncOfflineQueue() {
            if (!navigator.onLine) return;
            const items = await _getAllOfflineWrites();
            if (!items.length) return;
            console.log(`[OfflineSync] ${items.length} টি pending write sync করা হচ্ছে...`);
            for (const { key, op } of items) {
                try {
                    const fns = window._firebaseFns;
                    const dbRef = window._firebaseDb;
                    if (op.type === 'addDoc') {
                        const ref = fns.collection(dbRef, ...op.path);
                        await fns.addDoc(ref, op.data);
                    } else if (op.type === 'updateDoc') {
                        const ref = fns.doc(dbRef, ...op.path);
                        // 🔧 FIX: queue-তে রাখা { __somityDelta } মার্কারগুলো replay করার
                        // সময়ও আসল atomic increment()-এ রূপান্তর করা হয়, যাতে পুরনো
                        // absolute snapshot বর্তমান ব্যালেন্স মুছে না দেয়
                        await fns.updateDoc(ref, _resolveSomityDeltas(op.data));
                    } else if (op.type === 'setDoc') {
                        const ref = fns.doc(dbRef, ...op.path);
                        await fns.setDoc(ref, op.data, { merge: true });
                    } else if (op.type === 'deleteDoc') {
                        const ref = fns.doc(dbRef, ...op.path);
                        await fns.deleteDoc(ref);
                    }
                    await _deleteOfflineWrite(key);
                    console.log(`[OfflineSync] ✅ sync সফল:`, op.type, op.path);
                } catch(e) {
                    console.warn(`[OfflineSync] ❌ sync ব্যর্থ (পরে retry হবে):`, e.message);
                }
            }
            // sync শেষে UI রিফ্রেশ
            if (typeof renderUI === 'function') renderUI();
        }

        // ── অনলাইনে ফিরলে স্বয়ংক্রিয় sync ──
        window.addEventListener('online', () => {
            console.log('[Network] অনলাইন হয়েছে — offline queue sync শুরু...');
            _showOfflineBanner(false);
            setTimeout(_syncOfflineQueue, 1500); // Firebase init এর জন্য ছোট্ট delay
        });
        window.addEventListener('offline', () => {
            console.warn('[Network] অফলাইন হয়েছে — লেখা queue তে জমা হবে।');
            _showOfflineBanner(true);
        });

        // ── অফলাইন/অনলাইন স্ট্যাটাস ব্যানার ──
        function _showOfflineBanner(isOffline) {
            let banner = document.getElementById('_offline_banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = '_offline_banner';
                banner.style.cssText = `
                    position:fixed;bottom:calc(60px + env(safe-area-inset-bottom, 0px) + 14px);left:50%;transform:translateX(-50%);
                    z-index:999999;padding:10px 22px;border-radius:24px;
                    font-size:13px;font-weight:700;letter-spacing:.3px;
                    box-shadow:0 4px 20px rgba(0,0,0,.25);
                    transition:opacity .4s;pointer-events:none;white-space:nowrap;
                    max-width:92vw;overflow:hidden;text-overflow:ellipsis;
                `;
                document.body.appendChild(banner);
            }
            if (isOffline) {
                banner.textContent = '📴 অফলাইন — ডেটা সেভ হচ্ছে, অনলাইনে sync হবে';
                banner.style.cssText += 'background:#ef4444;color:#fff;opacity:1;';
            } else {
                banner.textContent = '✅ অনলাইন — সব ডেটা sync হয়েছে';
                banner.style.cssText += 'background:#16a34a;color:#fff;opacity:1;';
                setTimeout(() => { if (banner) banner.style.opacity = '0'; }, 3000);
            }
        }

        // ── পেজ লোডেই যদি offline queue থাকে, sync করো ──
        window.addEventListener('load', () => {
            if (navigator.onLine) {
                setTimeout(_syncOfflineQueue, 3000);
            } else {
                _showOfflineBanner(true);
            }
        });

        // ── offline-safe wrapper — অফলাইনে আটকে না থেকে ব্যাকগ্রাউন্ডে sync হতে দেয় ──
        // ✅ FIX #5 (cashInHand ভুল হিসাব — ডাবল-কাউন্ট বাগ): আগে timeout হলে এই write
        // _enqueueOfflineWrite() দিয়ে কাস্টম IndexedDB queue-তেও জমা হতো (FIX #2)।
        // কিন্তু আসল সমস্যা হলো: এই লাইনের ঠিক উপরের addDoc/updateDoc/deleteDoc কলটা
        // ইতিমধ্যেই Firestore SDK-কে দেওয়া হয়ে গেছে — persistentLocalCache চালু থাকায়
        // Firestore নিজেই এটা নিজের IndexedDB mutation queue-তে রেখে দেয় এবং নেটওয়ার্ক
        // ফিরলে (পেজ রিলোড হলেও) স্বয়ংক্রিয়ভাবে ব্যাকএন্ডে sync করে — এটা Firestore
        // অফলাইন পার্সিস্টেন্সের ডিফল্ট, নিশ্চিত আচরণ। তাই timeout হওয়া মানে শুধু এটাই
        // বোঝায় যে সার্ভার সময়মতো উত্তর দেয়নি — এটা মানে এই না যে write হারিয়ে গেছে।
        // আগের কোডে timeout হলে এই একই write কাস্টম queue থেকে আবার replay হতো
        // (অনলাইনে ফেরার সময় বা পেজ লোডে), ফলে cashInHand/bankBalance/totalExpenses-এর
        // মতো increment() ফিল্ডগুলোতে একই ডেল্টা দুইবার যোগ হয়ে যেত — এটাই ছিল
        // রিপোর্ট করা ভুল হিসাবের (৳21,010 বনাম সঠিক ৳15,010) প্রকৃত কারণ, বিশেষ করে
        // ধীরগতির মোবাইল নেটওয়ার্কে যেখানে 2.5s টাইমআউট ঘনঘন লাগত।
        // সমাধান: timeout হলে আর কাস্টম queue-তে নতুন কিছু জমা করা হবে না — Firestore-কে
        // তার নিজের কাজ (একবারই sync) করতে দেওয়া হচ্ছে। নিচের _syncOfflineQueue()/
        // _enqueueOfflineWrite() ফাংশনগুলো রাখা হলো — যদি কোনো ইউজারের ডিভাইসে এই ফিক্সের
        // আগে থেকে কোনো পুরনো entry কাস্টম queue-তে আটকে থাকে, সেটা একবার sync হয়ে
        // স্বয়ংক্রিয়ভাবে খালি হয়ে যাবে, তারপর থেকে queue-তে নতুন কিছু আর যোগ হবে না।
        async function _offlineSafeAddDoc(pathArr, data) {
            const ref = window._firebaseFns.collection(window._firebaseDb, ...pathArr);
            const result = await _writeNoBlock(window._firebaseFns.addDoc(ref, data));
            if (result) return result; // সার্ভার সময়মতো উত্তর দিয়েছে
            // ✅ FIX #5: কাস্টম queue-তে আর জমা করা হবে না — Firestore নিজেই sync করবে
            console.log('[OfflineQueue] addDoc-এর উত্তর দেরি হচ্ছে — Firestore নিজেই ব্যাকগ্রাউন্ডে sync করবে:', pathArr);
            return { id: 'offline_' + Date.now() };
        }
        // =====================================================================
        // 🔧 FIX: শেয়ারড কাউন্টার ফিল্ড (cashInHand/bankBalance/totalExpenses) এর
        // জন্য atomic increment() সাপোর্ট।
        // ── কেন লাগলো? ──
        // আগে এই ফিল্ডগুলো local appState-এর মান পড়ে নতুন absolute সংখ্যা হিসাব
        // করে লেখা হতো (যেমন: cashInHand: (appState.cashInHand||0)+amount)।
        // নেটওয়ার্ক ধীর হলে (বিশেষত Chrome-এ persistentLocalCache/multi-tab
        // ক্যাশের কারণে) _writeNoBlock()-এর টাইমআউট হয়ে একই লেখা আবার
        // অফলাইন IndexedDB queue-তে জমা হতো — আর পরে (যেমন পরের বার পেজ লোড
        // হওয়ার সময়) queue থেকে এই পুরনো absolute snapshot আবার লেখা হলে তা
        // মাঝখানে হওয়া অন্য সব লেনদেনের প্রভাব মুছে দিত। এখন থেকে এই তিনটি
        // ফিল্ড Firestore-এর atomic increment() দিয়ে আপডেট হবে যাতে local
        // ক্যাশ যত পুরনোই হোক বা একই লেখা দুইবার গেলেও, পুরো ব্যালেন্স কখনো
        // মুছে/ওভাররাইট হবে না — শুধু সঠিক পরিমাণ যোগ/বিয়োগ হবে।
        // ── Marker ব্যবহারের কারণ ──
        // Firestore-এর increment() একটি বিশেষ ক্লাস ইনস্ট্যান্স, যা IndexedDB
        // (structured clone)-এ সরাসরি রাখলে ভেঙে যায়। তাই queue-তে শুধু plain
        // ডেল্টা সংখ্যা { __somityDelta: n } আকারে রাখা হয়, এবং প্রতিটি আসল
        // updateDoc() কলের ঠিক আগে এটিকে আসল increment()-এ রূপান্তর করা হয়
        // (live attempt ও পরে queue থেকে replay — দুই জায়গাতেই)।
        // =====================================================================
        function _somityDelta(n) { return { __somityDelta: Number(n) || 0 }; }
        window.somityDelta = _somityDelta;

        function _resolveSomityDeltas(data) {
            const fns = window._firebaseFns;
            const out = {};
            for (const k in data) {
                const v = data[k];
                if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '__somityDelta')) {
                    out[k] = fns.increment(v.__somityDelta);
                } else {
                    out[k] = v;
                }
            }
            return out;
        }

        async function _offlineSafeUpdateDoc(pathArr, data) {
            const ref = window._firebaseFns.doc(window._firebaseDb, ...pathArr);
            // 🔧 FIX: { __somityDelta } মার্কার থাকলে আসল লেখার আগে atomic increment()-এ বদলানো হয়
            const liveData = _resolveSomityDeltas(data);
            const result = await _writeNoBlock(window._firebaseFns.updateDoc(ref, liveData));
            // ✅ FIX #5: timeout হলেও কাস্টম queue-তে আর জমা করা হবে না (নিচের বড় কমেন্ট দেখুন) —
            // Firestore নিজেই persistentLocalCache-এর মাধ্যমে এই write রিট্রাই করবে।
            // আগে এখানে _enqueueOfflineWrite() কল হতো, যা একই increment() ডেল্টা দুইবার
            // প্রয়োগ করে cashInHand/bankBalance/totalExpenses ভুল (বেশি) দেখাত।
            if (!result) {
                console.log('[OfflineQueue] updateDoc-এর উত্তর দেরি হচ্ছে — Firestore নিজেই ব্যাকগ্রাউন্ডে sync করবে:', pathArr);
            }
        }
        async function _offlineSafeDeleteDoc(pathArr) {
            const ref = window._firebaseFns.doc(window._firebaseDb, ...pathArr);
            const result = await _writeNoBlock(window._firebaseFns.deleteDoc(ref));
            // ✅ FIX #5: কাস্টম queue-তে আর জমা করা হবে না — Firestore নিজেই sync করবে
            if (!result) {
                console.log('[OfflineQueue] deleteDoc-এর উত্তর দেরি হচ্ছে — Firestore নিজেই ব্যাকগ্রাউন্ডে sync করবে:', pathArr);
            }
        }
        // global expose করো যাতে Firestore functions ব্যবহার করতে পারে
        window._offlineSafe = { addDoc: _offlineSafeAddDoc, updateDoc: _offlineSafeUpdateDoc, deleteDoc: _offlineSafeDeleteDoc };
        // =====================================================================
        // 📦 অফলাইন Queue সিস্টেম শেষ
        // =====================================================================

        // =====================================================================
        // 📤 ImgBB তে ছবি আপলোড করার ফাংশন
        // base64 data-URL নিয়ে নিজের Netlify Function-কে কল করে — সেই function
        // ImgBB API key (server-side env var) ব্যবহার করে ImgBB-তে আপলোড করে
        // image_url রিটার্ন করে। ✅ FIX #6: key এখন client-এ কখনো আসে না।
        // =====================================================================
        async function uploadToImgBB(base64DataUrl) {
            // data:image/jpeg;base64,XXXXX থেকে শুধু base64 অংশটা বের করো
            const base64String = base64DataUrl.split(',')[1];

            const response = await fetch('/.netlify/functions/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64String })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(`ImgBB আপলোড ব্যর্থ: ${result.error || response.statusText}`);
            }

            // image_url (direct link) রিটার্ন করো
            return result.url;
        }

        // window তে expose করো যাতে অন্য স্থান থেকেও ব্যবহার করা যায়
        window.uploadToImgBB = uploadToImgBB;

        // =====================================================================
        // 🔐 SECURE ROLE SYSTEM
        // window.currentUserRole সরাসরি সেট/পড়া যাবে না।
        // রোল শুধুমাত্র Firestore থেকে ফেচ করে সেট হয় (module scope closure)।
        // বাইরে থেকে শুধু window.getRole() দিয়ে পড়া যাবে — কনসোল থেকে পরিবর্তন অসম্ভব।
        // =====================================================================
        let _secureRole = null;   // module-scoped — কনসোল থেকে অ্যাক্সেস নেই
        let _roleVerified = false; // Firestore থেকে verified কিনা

        // বাইরের স্ক্রিপ্টের জন্য read-only getter
        Object.defineProperty(window, 'currentUserRole', {
            get() { return _secureRole; },
            set(v) {
                // কনসোল থেকে সেট করার চেষ্টা করলে সাইলেন্টলি ইগনোর হবে
                console.warn('🔒 Security: currentUserRole is read-only and managed by Firebase Auth.');
            },
            configurable: false
        });

        // Internal setter — শুধু এই module-এর ভেতরে ব্যবহারযোগ্য
        function _setSecureRole(role) {
            _secureRole = (role === 'admin' || role === 'member' || role === 'super_admin') ? role : null;
            _roleVerified = true;
        }

        // ── Super Admin চেক ──
        window.isSuperAdmin = function() {
            return _roleVerified && _secureRole === 'super_admin';
        };

        // Role clear (logout এ)
        function _clearSecureRole() {
            _secureRole = null;
            _roleVerified = false;
        }

        // isAdmin চেক — সব সেনসিটিভ অপারেশনের আগে এটি ব্যবহার করতে হবে
        window.isAdminVerified = function() {
            return _roleVerified && _secureRole === 'admin';
        };

        // নিবন্ধন চলছে কিনা তা ট্র্যাক করার জন্য flag
        let isRegistering = false;

        // ===== Auth State পরিবর্তন হলে =====
        const hideLoading = () => {
            const ls = document.getElementById('loading-screen');
            if (ls) ls.style.display = 'none';
        };
        async function _handleAuthUser(user) {
            if (isRegistering) { hideLoading(); return; } // নিবন্ধন চলাকালীন এই ব্লক ignore করো
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await _smartGetDoc(userDocRef);

                // ── নেটওয়ার্কে ও লোকাল ক্যাশে — কোনোটাতেই ডেটা পাওয়া যায়নি ──
                // (সচরাচর ঘটবে না, কারণ প্রথমবার লগইনের সময় অনলাইন থাকতেই হয় এবং
                //  তখনই এই ডেটা ক্যাশে সেভ হয়ে যায়।) এই অবস্থায় কখনোই লগআউট করা
                // হবে না বা লগইন-স্ক্রিনে পাঠানো হবে না — বরং নেটওয়ার্ক ফিরলে
                // নিরাপদে নিজে থেকেই রিট্রাই হবে, সেশন অক্ষুণ্ণ থাকবে।
                if (!userSnap) {
                    console.warn('[Auth] ইউজার ডেটা এখনো পাওয়া যায়নি (অফলাইন/ক্যাশ খালি) — কিছুক্ষণ পর আবার চেষ্টা হবে।');
                    const statusEl = document.getElementById('loading-status-text');
                    if (statusEl) statusEl.textContent = 'ইন্টারনেট সংযোগ যাচাই করা হচ্ছে...';
                    const retryTimer = setTimeout(() => _handleAuthUser(user), 6000);
                    window.addEventListener('online', function _retryNow() {
                        window.removeEventListener('online', _retryNow);
                        clearTimeout(retryTimer);
                        _handleAuthUser(user);
                    }, { once: true });
                    return;
                }

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const status = userData.status || "approved";

                    // ── হেল্পার: সব স্ক্রিন লুকাও ──
                    const hideAllScreens = () => {
                        document.getElementById('login-screen').style.display        = 'none';
                        document.getElementById('pending-screen').style.display      = 'none';
                        document.getElementById('paywall-screen').style.display      = 'none';
                        document.getElementById('main-app').style.display            = 'none';
                        document.getElementById('super-admin-screen').style.display  = 'none';
                        const rulesScreenEl = document.getElementById('rules-acceptance-screen');
                        if (rulesScreenEl) rulesScreenEl.style.display = 'none';
                    };

                    // ── অনুমোদন পেন্ডিং ──
                    if (status === "pending") {
                        window.currentUser = user;
                        _clearSecureRole(); // 🔐 role null করো — pending ইউজারের কোনো role নেই
                        hideLoading();
                        hideAllScreens();
                        document.getElementById('pending-screen').style.display = 'flex';
                        return;
                    }

                    // ── প্রত্যাখ্যাত ──
                    if (status === "rejected") {
                        _clearSecureRole(); // 🔐
                        await signOut(auth);
                        hideLoading();
                        hideAllScreens();
                        document.getElementById('login-screen').style.display = 'flex';
                        showLoginTab();
                        document.getElementById('login-error').textContent = 'আপনার নিবন্ধন প্রত্যাখ্যান করা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।';
                        return;
                    }

                    // ── somityId সংগ্রহ করো (সব স্ট্যাটাসের জন্য প্রযোজ্য) ──
                    const currentSomityId = userData.somityId || user.uid;
                    window.currentSomityId   = currentSomityId;
                    window.currentSomityName = userData.somityName || '';
                    window.currentSomityCode = userData.somityCode || '';
                    window.currentUserName   = userData.name || '';

                    // ── 🔐 SECURITY PATCH: সমিতি-স্তরের সাবস্ক্রিপশন চেক ──
                    // ✅ FIX #5: আগে sequential দুটো await ছিল (userSnap + somitySnap = 9s অফলাইনে)
                    // এখন somityId জানার সাথে সাথেই somitySnap fetch শুরু হয় (3s timeout)
                    const somitySnap = await _smartGetDoc(doc(db, "somities", currentSomityId));

                    if (somitySnap && somitySnap.exists()) {
                        const somityData   = somitySnap.data();
                        const somityStatus = somityData.status || "active";
                        const somityTrialEnd = somityData.trialEndDate || 0;
                        const now = Date.now();

                        const isExpiredTrial = somityStatus === "trial" && now > somityTrialEnd;
                        const isLockedOut    = somityStatus === "expired" || somityStatus === "locked";

                        if (isExpiredTrial || isLockedOut) {
                            // সমিতির মেয়াদ শেষ বা লক — সব ইউজারকে Paywall-এ পাঠাও
                            window.currentUser = user;
                            _setSecureRole(userData.role || "member");
                            hideLoading();
                            hideAllScreens();
                            document.getElementById('paywall-screen').style.display = 'flex';
                            return;
                        }

                        // ট্রায়াল সক্রিয় হলে trialEndDate গ্লোবালে রাখো
                        if (somityStatus === "trial") {
                            window.currentTrialEndDate = somityTrialEnd;
                        }
                    } else {
                        // somities-এ ডকুমেন্ট নেই — user-এর নিজস্ব status দিয়ে পুরনো লজিক চালাও (legacy fallback)
                        if (status === "trial") {
                            const now      = Date.now();
                            const trialEnd = userData.trialEndDate || 0;
                            if (now > trialEnd) {
                                window.currentUser = user;
                                _setSecureRole(userData.role || "admin");
                                hideLoading();
                                hideAllScreens();
                                document.getElementById('paywall-screen').style.display = 'flex';
                                return;
                            }
                            window.currentTrialEndDate = trialEnd;
                        }
                    }

                    // ── fallback: উপরের কোনো ব্লকে somityId সেট না হলে uid দিয়ে সেট করো ──
                    if (!window.currentSomityId) {
                        window.currentSomityId   = user.uid;
                        window.currentSomityName = userData.somityName || '';
                        window.currentSomityCode = userData.somityCode || '';
                        window.currentUserName   = userData.name || '';
                    }

                    // 🔐 SECURE: role শুধুমাত্র Firestore ডেটা থেকে সেট হয়।
                    // কনসোলে window.currentUserRole = 'admin' টাইপ করলে কোনো প্রভাব নেই।
                    _setSecureRole(userData.role || "member");

                    // ══════════════════════════════════════════════
                    // 📜 নিয়মাবলী ও শর্তাবলী সম্মতি গেট (শুধু member রোলের জন্য — এডমিন নিজের
                    // লেখা নিয়মে নিজে আটকাবেন না)। সমিতিতে নিয়মাবলী চালু থাকলে এবং সদস্য
                    // বর্তমান ভার্সনে সম্মতি না দিয়ে থাকলে ড্যাশবোর্ডে যেতে দেওয়া হবে না।
                    // ══════════════════════════════════════════════
                    const somityDataForRules = (somitySnap && somitySnap.exists()) ? somitySnap.data() : {};
                    const isMemberRole = (userData.role || 'member') === 'member';
                    if (isMemberRole && somityDataForRules.hasCustomRules) {
                        const requiredVersion = somityDataForRules.rulesVersion || '1.0';
                        const acceptedVersion = userData.acceptedRulesVersion || null;
                        if (acceptedVersion !== requiredVersion) {
                            window.currentUser = user;
                            window._pendingRulesText    = somityDataForRules.rulesText || '';
                            window._pendingRulesVersion = requiredVersion;
                            hideLoading();
                            hideAllScreens();
                            showRulesAcceptanceScreen();
                            return;
                        }
                    }

                    // 🐛 ফিক্স: currentSomityId এখন চূড়ান্তভাবে জানা গেছে — তাই নোটিফিকেশন হিস্ট্রি
                    // এই নির্দিষ্ট সমিতির জন্য স্কোপ করা sessionStorage কী থেকে পুনরায় লোড করো,
                    // যাতে আগের কোনো সমিতির (একই ব্রাউজার সেশনে) নোটিফিকেশন এখানে দেখা না যায়।
                    if (typeof _notifKey === 'function') {
                        try {
                            _notifHistory = JSON.parse(sessionStorage.getItem(_notifKey()) || '[]');
                            if (typeof renderNotifHistory === 'function') renderNotifHistory();
                        } catch(_e) { _notifHistory = []; }
                    }

                    // ── 👑 SUPER ADMIN রাউটিং — মাস্টার প্যানেলে পাঠাও ──
                    if (userData.role === 'super_admin') {
                        window.currentUser = user;
                        hideLoading();
                        hideAllScreens();
                        document.getElementById('super-admin-screen').style.display = 'block';
                        superAdminLoadSomities();
                        return;
                    }

                    // ── ড্যাশবোর্ড হেডারে সমিতির নাম ডাইনামিকালি সেট করো ──
                    const headerNameEl = document.getElementById('header-somity-name');
                    if (headerNameEl && window.currentSomityName) {
                        headerNameEl.textContent = window.currentSomityName;
                        headerNameEl.classList.remove('hsn-skeleton'); // ✅ ডেটা এসে গেছে — লোডিং পালস বন্ধ করো
                    }

                } else {
                    // Firestore-এ ডকুমেন্ট নেই — নিবন্ধন অসম্পূর্ণ
                    _clearSecureRole(); // 🔐
                    await signOut(auth);
                    hideLoading();
                    document.getElementById('login-screen').style.display   = 'flex';
                    document.getElementById('pending-screen').style.display = 'none';
                    document.getElementById('paywall-screen').style.display = 'none';
                    document.getElementById('main-app').style.display       = 'none';
                    document.getElementById('login-error').textContent = 'আপনার অ্যাকাউন্ট সম্পূর্ণ হয়নি। অনুগ্রহ করে পুনরায় নিবন্ধন করুন।';
                    return;
                }

                window.currentUser = user;
                hideLoading();
                document.getElementById('login-screen').style.display   = 'none';
                document.getElementById('pending-screen').style.display = 'none';
                document.getElementById('paywall-screen').style.display = 'none';
                document.getElementById('main-app').style.display       = 'block';
                applyRoleUI();
                // ── রিফ্রেশে loading screen না দেখানোর জন্য session cache সেভ করো ──
                try { localStorage.setItem('_sdm_session', '1'); } catch(_) {}
                // ── লগইনের সময় পুরনো localStorage ক্যাশ রিসেট করো (ভুল সমিতির ডামি ডেটা ঠেকাতে) ──
                localStorage.removeItem('somiti_premium_data');
                appState = { members: [], extraMembers: [], bankBalance: 0, totalExpenses: 0, cashInHand: 0, totalInvestment: 0, bankLedger: [], extraTxns: [], expenseLedger: [], otherFundsLedger: [], investments: [], notices: [], opinions: [] };
                window.appState = appState; // ✅ পুনরায় link করা হলো — না হলে window.appState পুরনো (stale) অবজেক্টে আটকে থাকতো
                _firestoreDataReceived = false; // নতুন সেশনে রিসেট
                // ── পেজিনেশন স্ট্যাটাস রিসেট করো (নতুন সমিতির জন্য নতুন করে শুরু) ──
                _lastMemberDoc = null; _hasMoreMembers = true;
                _lastTxnDoc    = null; _hasMoreTxns    = true;
                renderUI();
                // ── _isFirstSnapshot রিসেট করো যাতে নতুন সমিতির পুরনো snapshot notification না দেয় ──
                _isFirstSnapshot = true;
                window._lastTxnIdRef.value = null;
                // ── currentSomityId নিশ্চিত হওয়ার পরেই লিসেনার চালু ──
                startFirestoreListener();

                // ✅ FIX: লগইনের পরে ইউজারের photo লোড করো এবং topbar avatar আপডেট করো
                (async function() {
                    try {
                        const _uid = user.uid;
                        const _db2 = window._firebaseDb;
                        const _fns = window._firebaseFns;
                        if (!_uid || !_db2 || !_fns) return;
                        const _snap = await _fns.getDoc(_fns.doc(_db2, "users", _uid));
                        if (_snap.exists()) {
                            const _pUrl = _snap.data().photoUrl;
                            if (_pUrl) {
                                window._currentUserPhotoUrl = _pUrl;
                                if (typeof window._updateTopbarAvatar === 'function') {
                                    window._updateTopbarAvatar(_pUrl);
                                }
                            }
                        }
                    } catch(_e) {
                        console.warn('[Topbar] photo load ব্যর্থ:', _e.message);
                    }
                })();

                // 🔔 FCM Push Notification setup — token নেওয়া ও Firestore-এ সেভ
                (async function() {
                    try {
                        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
                        const { getMessaging, getToken } = await import(
                            'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js'
                        );
                        const _app2 = window._firebaseApp;
                        if (!_app2) return;
                        const messaging = getMessaging(_app2);
                        window._fcmMessaging = messaging;
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            console.log('[FCM] Notification permission denied');
                            return;
                        }
                        const swReg = await navigator.serviceWorker.ready;
                        const token = await getToken(messaging, {
                            vapidKey: 'BPuDwzyziAMAY0QiX-8E9sAk5I5BZe70jO-60ccgj4-audoa9Quvy0RJvf4SclaCkX6Kfg_cnmtq1vknzbgiFEU',
                            serviceWorkerRegistration: swReg
                        });
                        if (token) {
                            // Firestore-এ token সেভ করো
                            const _fns2 = window._firebaseFns;
                            const _db3  = window._firebaseDb;
                            const _uid2 = user.uid;
                            if (_fns2 && _db3 && _uid2) {
                                await _fns2.updateDoc(_fns2.doc(_db3, 'users', _uid2), {
                                    fcmToken: token,
                                    fcmUpdatedAt: Date.now()
                                });
                                console.log('[FCM] ✅ Token সেভ হয়েছে');
                            }
                        }
                    } catch(_e) {
                        console.warn('[FCM] setup ব্যর্থ:', _e.message);
                    }
                })();
            } else {
                window.currentUser = null;
                _clearSecureRole(); // 🔐 logout-এ role পুরোপুরি মুছে দাও
                try { localStorage.removeItem('_sdm_session'); } catch(_) {}
                try { localStorage.removeItem('_sdm_last_summary'); } catch(_) {} // ✅ FIX #4: পুরনো সারাংশ ক্যাশ মুছে দাও
                // ✅ FIX: পরবর্তী লগইনে নোটিশ-ম্যানেজ প্যানেলের পুরনো (খোলা) অবস্থা যেন বহন না হয়
                try { var _np = document.getElementById('notice-panel'); if (_np) _np.style.display = 'none'; } catch(_) {}
                hideLoading();
                document.getElementById('pending-screen').style.display      = 'none';
                document.getElementById('paywall-screen').style.display      = 'none';
                document.getElementById('main-app').style.display            = 'none';
                document.getElementById('super-admin-screen').style.display  = 'none';
                document.getElementById('login-screen').style.display        = 'flex';
            }
        }
        onAuthStateChanged(auth, _handleAuthUser);

        // ===== নিবন্ধন ফাংশন (SaaS — ট্রায়াল + সমিতি তৈরি / সমিতিতে জয়েন) =====
        window.doRegister = async function() {
            // নিবন্ধন টাইপ নির্ণয় (admin / member)
            const regTypeEl = document.querySelector('input[name="reg-type"]:checked');
            const regType   = regTypeEl ? regTypeEl.value : 'admin';

            const name      = document.getElementById('reg-name').value.trim();
            const phone     = document.getElementById('reg-phone').value.trim();
            const email     = document.getElementById('reg-email').value.trim();
            const pass      = document.getElementById('reg-pass').value;
            const pass2     = document.getElementById('reg-pass2').value;
            const errEl     = document.getElementById('reg-error');
            errEl.textContent = '';

            // কমন ভ্যালিডেশন
            if (!name)  { errEl.textContent = 'আপনার পূর্ণ নাম লিখুন।'; return; }
            if (!phone) { errEl.textContent = 'মোবাইল নম্বর লিখুন।'; return; }
            if (!email) { errEl.textContent = 'ইমেইল ঠিকানা লিখুন।'; return; }
            if (!pass || pass.length < 6) { errEl.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'; return; }
            if (pass !== pass2) { errEl.textContent = 'পাসওয়ার্ড দুটি মিলছে না।'; return; }

            const regBtn = document.getElementById('reg-btn');

            // ===== মেম্বার/কর্মী জয়েনিং লজিক =====
            if (regType === 'member') {
                const somityCode = document.getElementById('reg-somity-code').value.trim();
                if (!somityCode) { errEl.textContent = 'সমিতি কোড (Somity Code) লিখুন।'; return; }

                regBtn.disabled = true;
                regBtn.textContent = 'যাচাই করা হচ্ছে...';
                isRegistering = true;

                try {
                    // ── ধাপ ১: Anonymous login করো যাতে Firestore query করা যায় ──
                    regBtn.textContent = 'কোড যাচাই হচ্ছে...';
                    let anonUser = null;
                    try {
                        const anonCred = await signInAnonymously(auth);
                        anonUser = anonCred.user;
                    } catch(anonErr) {
                        console.error('[Register] Anonymous sign-in failed:', anonErr);
                        // Anonymous auth disabled থাকলে, Rules-এ allow read: if true দিতে হবে
                        // তখনো query চালানোর চেষ্টা করো
                    }

                    // ── ধাপ ২: somityCode দিয়ে সমিতি খোঁজো ──
                    let somitySnap;
                    try {
                        const somityQuery = query(
                            collection(db, "somities"),
                            where("somityCode", "==", somityCode)
                        );
                        somitySnap = await getDocs(somityQuery);
                    } catch(qErr) {
                        console.error('[Register] Firestore query error:', qErr.code, qErr.message, qErr);
                        // anon user থাকলে signOut করো
                        if (anonUser) { try { await signOut(auth); } catch(e){} }
                        isRegistering = false;
                        let qMsg = 'সমিতি কোড যাচাই করতে সমস্যা হয়েছে।';
                        if (qErr.code === 'permission-denied') qMsg = 'Firebase Rules সমস্যা! Console → Firestore → Rules চেক করুন।';
                        else if (qErr.code === 'unavailable')   qMsg = 'ইন্টারনেট সংযোগ নেই। অনলাইন হয়ে আবার চেষ্টা করুন।';
                        else if (qErr.code === 'failed-precondition') qMsg = 'Firestore Index তৈরি হয়নি। Firebase Console-এ Index যোগ করুন।';
                        errEl.textContent = qMsg;
                        regBtn.disabled = false;
                        regBtn.textContent = 'নিবন্ধন করুন';
                        return;
                    }

                    if (somitySnap.empty) {
                        if (anonUser) { try { await signOut(auth); } catch(e){} }
                        isRegistering = false;
                        errEl.textContent = 'ভুল সমিতি কোড! এডমিনের কাছ থেকে সঠিক ৬ ডিজিটের কোডটি সংগ্রহ করুন।';
                        regBtn.disabled = false;
                        regBtn.textContent = 'নিবন্ধন করুন';
                        return;
                    }

                    // ── ধাপ ৩: সমিতির তথ্য নাও ──
                    const somityDoc       = somitySnap.docs[0];
                    const somityDocId     = somityDoc.id;
                    const foundSomityName = somityDoc.data().somityName || '';

                    // ── ধাপ ৪: Anonymous user signOut করো, তারপর আসল account তৈরি করো ──
                    if (anonUser) { try { await signOut(auth); } catch(e){} }
                    anonUser = null;

                    regBtn.textContent = 'অ্যাকাউন্ট তৈরি হচ্ছে...';

                    // ── ধাপ ৫: আসল Firebase Auth account তৈরি ──
                    let memberAuthUser = null;
                    try {
                        const uc = await createUserWithEmailAndPassword(auth, email, pass);
                        memberAuthUser = uc.user;
                    } catch(authErr) {
                        isRegistering = false;
                        let aMsg = 'অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে।';
                        if (authErr.code === 'auth/email-already-in-use') aMsg = 'এই ইমেইল দিয়ে আগেই নিবন্ধন আছে।';
                        else if (authErr.code === 'auth/invalid-email')    aMsg = 'ইমেইল ঠিকানা সঠিক নয়।';
                        else if (authErr.code === 'auth/weak-password')    aMsg = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
                        console.error('[Register Member] Auth error:', authErr.code, authErr.message);
                        errEl.textContent = aMsg;
                        regBtn.disabled = false;
                        regBtn.textContent = 'নিবন্ধন করুন';
                        return;
                    }

                    // ── ধাপ ৬: Firestore-এ users ডকুমেন্ট সেভ করো ──
                    try {
                        await setDoc(doc(db, "users", memberAuthUser.uid), {
                            name,
                            phone,
                            email,
                            role:       "member",
                            status:     "pending",
                            somityId:   somityDocId,
                            somityCode: somityCode,
                            somityName: foundSomityName,
                            createdAt:  serverTimestamp()
                        });
                    } catch(fsErr) {
                        console.error('[Register Member] Firestore error:', fsErr.code, fsErr.message);
                        try { await deleteUser(memberAuthUser); } catch(e){}
                        try { await signOut(auth); } catch(e){}
                        isRegistering = false;
                        errEl.textContent = 'ডেটা সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
                        regBtn.disabled = false;
                        regBtn.textContent = 'নিবন্ধন করুন';
                        return;
                    }

                    // ── ধাপ ৭: signOut ও সাফল্য বার্তা ──
                    await signOut(auth);
                    isRegistering = false;

                    document.getElementById('reg-form-body').style.display  = 'none';
                    document.getElementById('reg-success-msg').style.display = 'block';
                    document.getElementById('reg-success-msg').innerHTML =
                        '<div style="font-size:2.5rem;margin-bottom:10px;">✅</div>' +
                        '<div style="font-weight:800;font-size:15px;color:#059669;margin-bottom:8px;">আবেদন সম্পন্ন!</div>' +
                        '<div style="font-size:12px;color:#1a237e;font-weight:700;margin-bottom:6px;">🤝 ' + foundSomityName + '</div>' +
                        '<div style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">' +
                        'আপনার জয়েন আবেদন এডমিনের কাছে পাঠানো হয়েছে।<br>' +
                        'এডমিন অনুমোদন দিলে আপনি লগইন করতে পারবেন।</div>' +
                        '<button onclick="window.showLoginTab()" style="margin-top:6px;background:#1a237e;color:#fff;border:none;border-radius:12px;padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer;">লগইন পেজে যান →</button>';

                } catch(e) {
                    isRegistering = false;
                    try { await signOut(auth); } catch(so){}
                    console.error('[Register Member] Unexpected error:', e.code, e.message, e);
                    errEl.textContent = 'নিবন্ধন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন। (' + (e.code || e.message || 'unknown') + ')';
                    regBtn.disabled = false;
                    regBtn.textContent = 'নিবন্ধন করুন';
                }
                return; // member branch শেষ
            }

            // ===== এডমিন / নতুন সমিতি তৈরির লজিক =====
            const somityName = document.getElementById('reg-somity-name').value.trim();
            if (!somityName) { errEl.textContent = 'আপনার সমিতির নাম লিখুন।'; return; }

            regBtn.disabled = true;
            regBtn.textContent = 'তৈরি হচ্ছে...';

            // ট্রায়াল শেষের তারিখ — আজ থেকে ঠিক ১৪ দিন পরে (milliseconds)
            const trialEndDate = Date.now() + (14 * 24 * 60 * 60 * 1000);

            isRegistering = true; // flag — onAuthStateChanged যেন মেইন অ্যাপ না খোলে
            try {
                // ১. Firebase Auth-এ ইউজার তৈরি
                const uc = await createUserWithEmailAndPassword(auth, email, pass);
                const uid = uc.user.uid;

                // ২. ৬ ডিজিটের সহজ সমিতি কোড তৈরি (মেম্বাররা এটি ব্যবহার করবে)
                const shortCode = Math.floor(100000 + Math.random() * 900000).toString();

                // ৩. users কালেকশনে ডকুমেন্ট সেভ (SaaS ফিল্ড সহ)
                await setDoc(doc(db, "users", uid), {
                    name,
                    phone,
                    email,
                    role:         "admin",        // সে নিজেই সমিতির মালিক
                    status:       "trial",         // শুরুতে ট্রায়াল মোড
                    somityName:   somityName,      // ইউজারের দেওয়া সমিতির নাম
                    somityId:     uid,             // uid-ই সমিতির ইউনিক ডকুমেন্ট আইডি (DB path)
                    somityCode:   shortCode,       // ৬ ডিজিটের সহজ কোড (মেম্বারদের জন্য)
                    trialEndDate: trialEndDate,    // ১৪ দিন পরের মিলি-সেকেন্ড
                    createdAt:    serverTimestamp()
                });

                // ৪. somities কালেকশনে নতুন সমিতির প্রাথমিক ডেটা স্ট্রাকচার তৈরি
                // ⚡ নতুন স্ট্রাকচার: শুধু বেসিক তথ্য মূল ডকুমেন্টে — বাকি সব সাব-কালেকশনে
                await setDoc(doc(db, "somities", uid), {
                    somityName:     somityName,
                    somityCode:     shortCode,     // ৬ ডিজিটের সহজ কোড — মেম্বার জয়েনের সময় query করা হবে
                    ownerUid:       uid,
                    ownerName:      name,
                    ownerEmail:     email,
                    bankBalance:    0,
                    cashInHand:     0,
                    totalExpenses:  0,
                    totalInvestment: 0,
                    distributableProfitPool: 0,
                    totalProfitDistributed: 0, // 🌱 এ পর্যন্ত সদস্যদের মধ্যে সর্বমোট বণ্টিত মুনাফা (recalculateCashInHand-এর জন্য দরকার)
                    hasCustomRules: false,   // 📜 নিয়মাবলী সিস্টেম চালু/বন্ধ
                    rulesText:      '',      // 📜 নিয়মাবলীর বিষয়বস্তু (এডমিন-লিখিত)
                    rulesVersion:   '1.0',   // 📜 বর্তমান ভার্সন — এডমিন এডিট করে ভার্সন বাড়ালে পুরনো সম্মতি অকার্যকর হয়ে যাবে
                    notices:        [],
                    opinions:       [],
                    status:         "trial",
                    trialEndDate:   trialEndDate,
                    createdAt:      serverTimestamp()
                    // ⚠️ members, bankLedger, expenseLedger, otherFundsLedger
                    //    এখন আর এখানে অ্যারে হিসেবে নেই।
                    //    এগুলো সাব-কালেকশনে থাকবে:
                    //    → somities/{uid}/members/{memberId}
                    //    → somities/{uid}/transactions/{txnId}
                    //    → somities/{uid}/expenses/{expenseId}
                });

                // ৫. নিবন্ধন শেষে signOut — ট্রায়াল অ্যাকাউন্ট সরাসরি অ্যাপে যাবে না এখানে
                await signOut(auth);
                isRegistering = false;
                document.getElementById('reg-success-msg').style.display = 'block';
                document.getElementById('reg-form-body').style.display = 'none';

                // সাফল্য বার্তা — সমিতি কোড দেখানো হচ্ছে
                document.getElementById('reg-success-msg').innerHTML =
                    '<div style="font-size:2.5rem;margin-bottom:10px;">🎉</div>' +
                    '<div style="font-weight:800;font-size:15px;color:#059669;margin-bottom:8px;">নিবন্ধন সম্পন্ন!</div>' +
                    '<div style="font-size:12px;color:#1a237e;font-weight:700;margin-bottom:6px;">✅ ' + somityName + '</div>' +
                    '<div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:12px;padding:12px 14px;margin-bottom:10px;">' +
                    '<div style="font-size:11px;color:#4338ca;font-weight:600;margin-bottom:4px;">🔑 আপনার সমিতি কোড (মেম্বারদের দিন):</div>' +
                    '<div style="font-size:28px;font-weight:900;color:#1a237e;letter-spacing:6px;font-family:monospace;">' + shortCode + '</div>' +
                    '<div style="font-size:10px;color:#6366f1;margin-top:4px;">এই কোডটি সংরক্ষণ করুন — লগইনের পরেও ড্যাশবোর্ড থেকে দেখা যাবে।</div>' +
                    '</div>' +
                    '<div style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">' +
                    'আপনার সমিতি তৈরি হয়েছে। আপনি <strong>১৪ দিনের বিনামূল্যে ট্রায়াল</strong> পেয়েছেন।</div>' +
                    '<button onclick="window.showLoginTab()" style="margin-top:6px;background:#1a237e;color:#fff;border:none;border-radius:12px;padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer;">লগইন করুন →</button>';

            } catch(e) {
                isRegistering = false;
                let msg = 'নিবন্ধন করতে সমস্যা হয়েছে।';
                if (e.code === 'auth/email-already-in-use') msg = 'এই ইমেইল দিয়ে আগেই নিবন্ধন আছে।';
                else if (e.code === 'auth/invalid-email')   msg = 'ইমেইল ঠিকানা সঠিক নয়।';
                else if (e.code === 'auth/weak-password')   msg = 'পাসওয়ার্ড আরো শক্তিশালী করুন।';
                errEl.textContent = msg;
                regBtn.disabled = false;
                regBtn.textContent = 'নিবন্ধন করুন';
            }
        };

        // ===== Firestore রিয়েলটাইম লিসেনার =====
        // ====================================================================
        // ⚡ নতুন SUB-COLLECTION আর্কিটেকচার
        // ====================================================================
        // DB স্ট্রাকচার:
        //   somities/{somityId}                       ← বেসিক তথ্য (balance, notices ইত্যাদি)
        //   somities/{somityId}/members/{memberId}    ← প্রতিটি সদস্যের ডকুমেন্ট
        //   somities/{somityId}/transactions/{txnId} ← সব জমা/উত্তোলন/ব্যাংক লেনদেন
        //   somities/{somityId}/expenses/{expenseId} ← খরচের এন্ট্রিগুলো
        // ====================================================================

        let unsubscribeFirestore = null;
        let unsubscribeMembers = null;
        let unsubscribeTxns = null;
        let unsubscribeExpenses = null;
        let unsubscribeActiveUsers = null; // ✅ নতুন: একটিভ সদস্য প্রেজেন্স লিসেনার
        let unsubscribeOpinions = null; // ✅ FIX: আগে এটা ট্র্যাক করা হতো না, তাই লগইন/লগআউটে পুরনো লিসেনার active থেকে যেত ও permission-denied error দিত
        let unsubscribeVotes = null;    // ✅ FIX: একই কারণে votes লিসেনারও ট্র্যাক করা হলো
        let unsubscribeInvestments = null; // 🌱 বিনিয়োগ লিসেনার — শুরু থেকেই সঠিকভাবে ট্র্যাক করা হচ্ছে
        let _lastTxnId = null;
        window._lastTxnIdRef = { value: null };
        let _isFirstSnapshot = true;

        // ====================================================================
        // ⚡ PERFORMANCE: Debounced renderUI — একসাথে একাধিক onSnapshot এলে
        //    শুধু একবার render হবে (50ms window-এ সব merge করে)
        // ====================================================================
        let _renderDebounceTimer = null;
        function scheduleRender() {
            if (_renderDebounceTimer) clearTimeout(_renderDebounceTimer);
            _renderDebounceTimer = setTimeout(() => {
                _renderDebounceTimer = null;
                if (typeof renderUI === 'function') renderUI();
            }, 50);
        }

        // ====================================================================
        // 📄 PAGINATION — limit() ও startAfter() দিয়ে ধীরে ধীরে ডেটা লোড করা
        // ====================================================================
        const PAGE_SIZE = 25;            // প্রতি পেজে কতগুলো ডকুমেন্ট লোড হবে
        let _lastMemberDoc      = null;  // members পেজিনেশন কার্সর (সর্বশেষ লোড হওয়া ডকুমেন্ট)
        let _hasMoreMembers     = true;  // আরও সদস্য আছে কিনা
        let _isLoadingMoreMembers = false;

        let _lastTxnDoc         = null;  // transactions পেজিনেশন কার্সর (সবচেয়ে পুরনো লোড হওয়া ডকুমেন্ট, desc অর্ডারে)
        let _hasMoreTxns        = true;  // আরও পুরনো লেনদেন আছে কিনা
        let _isLoadingMoreTxns  = false;
        let _recentTxns         = [];    // onSnapshot থেকে আসা সর্বশেষ PAGE_SIZE লেনদেন (asc ক্রমে)

        // ── সমিতির মূল ডকুমেন্ট আপডেট (শুধু summary ফিল্ড) ──
        window.updateSomityDoc = async function(fields, lastTxn) {
            if (!window.currentSomityId) return;
            try {
                const toUpdate = Object.assign({}, fields);
                if (lastTxn) toUpdate.lastTransaction = lastTxn;
                await _offlineSafeUpdateDoc(["somities", window.currentSomityId], toUpdate);
            } catch(e) {
                console.error("updateSomityDoc error:", e);
            }
        };

        // ✅ FIX #4: সর্বশেষ জানা cashInHand/bankBalance/totalExpenses localStorage-এ ক্যাশ করো।
        // রিফ্রেশে instant-show (_sdm_session) চালু হলে index.html-এর ইনলাইন স্ক্রিপ্ট এই ক্যাশ
        // পড়ে সাথে সাথেই দেখায় — Firebase ডেটা লোড হতে যে ১-২ সেকেন্ড লাগে, সেই সময়ে আর ৳০
        // দেখাবে না। আসল ডেটা onSnapshot থেকে এলে এমনিতেই ওভাররাইট হয়ে যাবে।
        // (পুরনো ক্যাশের সাথে merge করা হয় — totalMembers/totalSavings ক্যাশ যাতে মুছে না যায়)
        function _cacheLastSummary(cashInHand, bankBalance, totalExpenses) {
            try {
                var existing = {};
                try { existing = JSON.parse(localStorage.getItem('_sdm_last_summary') || '{}'); } catch(_e1) {}
                existing.cashInHand    = Number(cashInHand)    || 0;
                existing.bankBalance   = Number(bankBalance)   || 0;
                existing.totalExpenses = Number(totalExpenses) || 0;
                localStorage.setItem('_sdm_last_summary', JSON.stringify(existing));
            } catch(_) {}
        }

        // ── রিয়েলটাইম লিসেনার: মূল ডকুমেন্ট + সব সাব-কালেকশন একসাথে ──
        window.startFirestoreListener = function() {
            if (!window.currentSomityId) {
                console.error("startFirestoreListener: window.currentSomityId পাওয়া যায়নি।");
                return;
            }
            // পুরনো লিসেনার বন্ধ করো
            if (unsubscribeFirestore) unsubscribeFirestore();
            if (unsubscribeMembers)   unsubscribeMembers();
            if (unsubscribeTxns)      unsubscribeTxns();
            if (unsubscribeExpenses)  unsubscribeExpenses();
            if (unsubscribeActiveUsers) unsubscribeActiveUsers();
            if (unsubscribeOpinions)  unsubscribeOpinions();
            if (unsubscribeVotes)     unsubscribeVotes();
            if (unsubscribeInvestments) unsubscribeInvestments();

            const { onSnapshot, doc: docFn, collection: colFn, query: queryFn, orderBy: orderByFn, where: whereFn } = window._firebaseFns;
            const somityId = window.currentSomityId;

            // ── ১. মূল ডকুমেন্ট লিসেনার (balance, notices, opinions ইত্যাদি) ──
            const mainRef = docFn(db, "somities", somityId);
            unsubscribeFirestore = onSnapshot(mainRef, (snap) => {
                if (!snap.exists()) {
                    console.warn('[Firestore] মূল সমিতি ডকুমেন্ট পাওয়া যায়নি। somityId:', somityId);
                    return;
                }
                const data = snap.data();
                // শুধু scalar/array ফিল্ড নাও — sub-collection গুলো আলাদা লিসেনারে আসবে
                appState.bankBalance    = Number(data.bankBalance   || 0);
                appState.cashInHand     = Number(data.cashInHand    || 0);
                appState.totalExpenses  = Number(data.totalExpenses || 0);
                appState.totalInvestment = Number(data.totalInvestment || 0);
                appState.distributableProfitPool = Number(data.distributableProfitPool || 0);
                appState.totalProfitDistributed = Number(data.totalProfitDistributed || 0);
                appState.hasCustomRules = !!data.hasCustomRules;
                appState.rulesText      = data.rulesText || '';
                appState.rulesVersion   = data.rulesVersion || '1.0';
                appState.notices        = Array.isArray(data.notices)  ? data.notices  : [];
                _cacheLastSummary(appState.cashInHand, appState.bankBalance, appState.totalExpenses); // ✅ FIX #4
                // ✅ FIX: opinions এখন sub-collection থেকে আসে — মূল ডকুমেন্ট থেকে লোড করা হয় না
                // appState.opinions এখানে স্পর্শ করা হবে না; opinions listener নিজেই আপডেট করবে
                appState.somityName     = data.somityName  || '';
                appState.somityCode     = data.somityCode  || '';

                // নতুন লেনদেন নোটিফিকেশন চেক
                const lt = data.lastTransaction;
                const _effectiveLastId = (window._lastTxnIdRef && window._lastTxnIdRef.value) ? window._lastTxnIdRef.value : _lastTxnId;
                if (!_isFirstSnapshot && lt && lt.id && lt.id !== _effectiveLastId) {
                    _lastTxnId = lt.id;
                    if (window._lastTxnIdRef) window._lastTxnIdRef.value = lt.id;
                    if (lt.byUid !== window.currentUser?.uid) {
                        showTransactionToast(lt);
                        addToNotifHistory(lt);
                        shakeBell();
                    }
                }
                if (_isFirstSnapshot && lt && lt.id) {
                    _lastTxnId = lt.id;
                    if (window._lastTxnIdRef) window._lastTxnIdRef.value = lt.id;
                }
                _isFirstSnapshot = false;

                scheduleRender();
                renderNoticeCard();
                renderOpinions();
            // ✅ FIX #3: মূল onSnapshot-এ error handler যোগ করা হয়েছে (আগে ছিলই না!)
            // permission-denied বা network error হলে নীরবে ব্যর্থ না হয়ে cache থেকে পড়বে
            }, (error) => {
                console.error('[Firestore ERROR] মূল সমিতি ডকুমেন্ট লোড ব্যর্থ:', error.code, error.message);
                if (error.code === 'permission-denied') {
                    console.error('🔒 Firestore Rules সমস্যা! Firebase Console → Firestore → Rules চেক করুন।');
                }
                // অফলাইনে বা error-এ — IndexedDB cache থেকে একবার পড়ার চেষ্টা করো
                getDocFromCache(mainRef).then(cached => {
                    if (cached && cached.exists()) {
                        const data = cached.data();
                        appState.bankBalance   = Number(data.bankBalance   || 0);
                        appState.cashInHand    = Number(data.cashInHand    || 0);
                        appState.totalExpenses = Number(data.totalExpenses || 0);
                        appState.totalInvestment = Number(data.totalInvestment || 0);
                        appState.distributableProfitPool = Number(data.distributableProfitPool || 0);
                        appState.totalProfitDistributed = Number(data.totalProfitDistributed || 0);
                        appState.hasCustomRules = !!data.hasCustomRules;
                        appState.rulesText      = data.rulesText || '';
                        appState.rulesVersion   = data.rulesVersion || '1.0';
                        appState.notices       = Array.isArray(data.notices)  ? data.notices  : [];
                        _cacheLastSummary(appState.cashInHand, appState.bankBalance, appState.totalExpenses); // ✅ FIX #4
                        // ✅ FIX: opinions sub-collection থেকে আসে — cache থেকে override করো না
                        appState.somityName    = data.somityName || '';
                        appState.somityCode    = data.somityCode || '';
                        scheduleRender();
                        renderNoticeCard();
                        renderOpinions();
                        console.log('[Firestore] মূল ডকুমেন্ট cache থেকে লোড হয়েছে।');
                    }
                }).catch(() => {
                    console.warn('[Firestore] মূল ডকুমেন্ট cache-এও পাওয়া যায়নি।');
                });
            });

            // ── ২. members সাব-কালেকশন লিসেনার (পেজিনেটেড — প্রথম PAGE_SIZE সদস্য রিয়েলটাইম) ──
            const membersRef = colFn(db, "somities", somityId, "members");
            const membersQuery = queryFn(membersRef, limit(PAGE_SIZE));
            // ✅ FIX: orderBy("id") Firestore-এ compound index ছাড়া কাজ করে না।
            // JavaScript-এ sort করা হচ্ছে নিচে — তাই এখানে শুধু limit() যথেষ্ট।
            unsubscribeMembers = onSnapshot(membersQuery, (snap) => {
                appState.members = [];
                snap.forEach(d => {
                    const m = d.data();
                    m._docId = d.id;
                    if (!Array.isArray(m.ledger)) m.ledger = [];
                    appState.members.push(m);
                });
                _firestoreDataReceived = true;
                console.log('[Firestore] সদস্য লোড হয়েছে:', appState.members.length, 'জন');

                // ── "আরও দেখুন" দিয়ে আগে লোড করা অতিরিক্ত পেজগুলো যুক্ত করো ──
                if (appState.extraMembers && appState.extraMembers.length) {
                    appState.members = appState.members.concat(appState.extraMembers);
                }

                // 🐛 ফিক্স: id ফিল্ড দিয়ে সর্ট করার সময় আগে টেক্সট হিসেবে তুলনা হতো (localeCompare),
                // যেটা ১০+ সদস্য হলে ক্রম এলোমেলো করে ফেলত (১,১০,১১...২,২০,৩...)।
                // এখন আইডি সংখ্যা হলে সংখ্যা হিসেবেই তুলনা হবে (১,২,৩...১০,১১...২০)।
                appState.members.sort(_compareMemberId);

                // ── পেজিনেশন কার্সর/স্ট্যাটাস আপডেট (প্রথম পেজের শেষ ডকুমেন্ট অনুযায়ী) ──
                const docs = snap.docs;
                _lastMemberDoc  = docs.length ? docs[docs.length - 1] : null;
                _hasMoreMembers = docs.length === PAGE_SIZE;

                scheduleRender();
            }, (error) => {
                // ✅ FIX #4: Error হলেও _firestoreDataReceived = true করো
                // আগে এটা false থাকত → renderUI() চিরকাল loading spinner দেখাত!
                _firestoreDataReceived = true;
                scheduleRender();
                // ⚠️ Firebase Rules deny বা index error হলে এখানে দেখা যাবে
                console.error('[Firestore ERROR] members লোড করতে সমস্যা:', error.code, error.message);
                if (error.code === 'permission-denied') {
                    console.error('🔒 Firestore Rules সমস্যা! Firebase Console-এ Rules ঠিক করুন।');
                } else if (error.code === 'failed-precondition') {
                    console.error('📑 Firestore Index সমস্যা! Firebase Console-এ Index তৈরি করুন।');
                }
            });

            // ── ৩. transactions সাব-কালেকশন লিসেনার (পেজিনেটেড — সর্বশেষ PAGE_SIZE লেনদেন রিয়েলটাইম) ──
            const bankTxnsRef = queryFn(colFn(db, "somities", somityId, "transactions"), orderByFn("createdAt", "desc"), limit(PAGE_SIZE));
            unsubscribeTxns = onSnapshot(bankTxnsRef, (snap) => {
                let recent = [];
                snap.forEach(d => {
                    const t = d.data();
                    t._docId = d.id;
                    recent.push(t);
                });
                console.log('[Firestore] লেনদেন লোড হয়েছে:', recent.length, 'টি');
                // Firestore থেকে নতুন→পুরনো (desc) ক্রমে এসেছে; appState-এ পুরনো→নতুন (asc) ক্রম রাখার জন্য reverse করো
                recent.reverse();
                _recentTxns = recent;

                rebuildTxnLedgers();

                // ── পেজিনেশন কার্সর/স্ট্যাটাস (এই পেজের সবচেয়ে পুরনো ডকুমেন্ট, desc অর্ডারে সর্বশেষটি) ──
                const docs = snap.docs;
                _lastTxnDoc  = docs.length ? docs[docs.length - 1] : null;
                _hasMoreTxns = docs.length === PAGE_SIZE;

                scheduleRender();
            }, (error) => {
                console.error('[Firestore ERROR] transactions লোড করতে সমস্যা:', error.code, error.message);
                if (error.code === 'permission-denied') {
                    console.error('🔒 Firestore Rules সমস্যা! Firebase Console-এ Rules ঠিক করুন।');
                }
                // ✅ transactions error হলেও render করো — শুধু খালি list দেখাবে
                scheduleRender();
            });

            // ── ৪. expenses সাব-কালেকশন লিসেনার (সর্বশেষ 100টি খরচ) ──
            const expRef = queryFn(colFn(db, "somities", somityId, "expenses"), orderByFn("createdAt", "asc"), limit(100));
            unsubscribeExpenses = onSnapshot(expRef, (snap) => {
                appState.expenseLedger = [];
                snap.forEach(d => {
                    const e = d.data();
                    e._docId = d.id;
                    appState.expenseLedger.push(e);
                });
                scheduleRender();
            }, (error) => {
                console.error('[Firestore ERROR] expenses লোড করতে সমস্যা:', error.code, error.message);
                // ✅ expenses error হলেও render করো — শুধু খালি list দেখাবে
                scheduleRender();
            });

            // ── ৫. opinions সাব-কালেকশন লিসেনার (সকল সদস্যের মতামত রিয়েলটাইম) ──
            // ✅ FIX: opinions এখন মূল ডকুমেন্টে নয়, এই sub-collection এ সেভ হবে
            // Firestore rules: authenticated সদস্য মাত্রেই read/write করতে পারবে
            const opinionsRef = queryFn(colFn(db, "somities", somityId, "opinions"), orderByFn("createdAt", "asc"), limit(200));
            unsubscribeOpinions = onSnapshot(opinionsRef, (snap) => {
                appState.opinions = [];
                snap.forEach(d => {
                    const op = d.data();
                    op._docId = d.id;
                    appState.opinions.push(op);
                });
                renderOpinions();
            }, (error) => {
                console.error('[Firestore ERROR] opinions লোড করতে সমস্যা:', error.code, error.message);
                if (error.code === 'permission-denied') {
                    console.error('🔒 Firestore Rules-এ opinions sub-collection এর read অনুমতি দিন।');
                }
            });

            // ── ৬. votes সাব-কালেকশন লিসেনার (নোটিশের ভোট রিয়েলটাইম) ──
            // ✅ FIX: ভোট এখন মূল ডকুমেন্টে নয়, এই sub-collection এ সেভ হবে
            const votesRef = colFn(db, "somities", somityId, "votes");
            unsubscribeVotes = onSnapshot(votesRef, (snap) => {
                // ✅ FIX: ভোট এখন noticeId (স্থায়ী) দিয়ে গণনা করা হচ্ছে, array index দিয়ে না।
                // আগে noticeIndex (array position) দিয়ে মেলানো হতো — তাই কোনো নোটিশ
                // ডিলিট হয়ে পরের সব নোটিশের index একঘর করে শিফট হয়ে গেলে, তাদের ভোট
                // ভুল নোটিশের সাথে মিলে যেত। noticeId স্থায়ী, কখনো বদলায় না।
                const voteMap = {}; // noticeId → { yes: N, no: N, voters: {uid: type} }
                snap.forEach(d => {
                    const v = d.data();
                    const key = v.noticeId;
                    if (!key) return;
                    if (!voteMap[key]) voteMap[key] = { yes: 0, no: 0, voters: {} };
                    voteMap[key].voters[v.userId] = v.type;
                    voteMap[key][v.type] = (voteMap[key][v.type] || 0) + 1;
                });
                // appState.notices-এ votes আপডেট করো (id থাকলে id দিয়ে, না থাকলে legacy index fallback)
                if (Array.isArray(appState.notices)) {
                    appState.notices.forEach((n, i) => {
                        const key = n.id || ('notice_' + i);
                        n.votes = voteMap[key] || { yes: 0, no: 0, voters: {} };
                    });
                }
                renderNotices();
                renderNoticeCard();
            }, (error) => {
                console.error('[Firestore ERROR] votes লোড করতে সমস্যা:', error.code, error.message);
                if (error.code === 'permission-denied') {
                    console.error('🔒 Firestore Rules-এ votes sub-collection এর read অনুমতি দিন।');
                }
            });

            // ── ৭. investments সাব-কালেকশন লিসেনার (বিনিয়োগ রিয়েলটাইম) ──
            const investmentsRef = colFn(db, "somities", somityId, "investments");
            unsubscribeInvestments = onSnapshot(investmentsRef, (snap) => {
                const list = [];
                snap.forEach(d => {
                    const data = d.data();
                    list.push(Object.assign({ _id: d.id, _sortTime: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0 }, data));
                });
                appState.investments = list;
                if (typeof renderInvestmentLedger === 'function') renderInvestmentLedger();
            }, (error) => {
                console.error('[Firestore ERROR] investments লোড করতে সমস্যা:', error.code, error.message);
                if (error.code === 'permission-denied') {
                    console.error('🔒 Firestore Rules-এ investments sub-collection এর read অনুমতি দিন।');
                }
            });

            // ── ৭. একটিভ (অনলাইন) সদস্য — "একটিভ সদস্য" ফিচার ──
            // এই সমিতির অনুমোদিত সব ইউজারের lastActive ফিল্ড রিয়েলটাইমে দেখা হয়,
            // যাতে কে এখন অনলাইন আছে বোঝা যায় (ফেসবুকের "Active Now"-এর মত)
            const activeUsersRef = queryFn(
                colFn(db, "users"),
                whereFn("status", "==", "approved"),
                whereFn("somityId", "==", somityId)
            );
            unsubscribeActiveUsers = onSnapshot(activeUsersRef, (snap) => {
                appState.allApprovedUsers = [];
                snap.forEach(d => {
                    const u = d.data();
                    u._uid = d.id;
                    appState.allApprovedUsers.push(u);
                });
                if (typeof window._refreshPresenceUI === 'function') window._refreshPresenceUI();
            }, (error) => {
                console.error('[Firestore ERROR] active users লোড করতে সমস্যা:', error.code, error.message);
            });

            // নিজের প্রেজেন্স হার্টবিট চালু করো (নিয়মিত lastActive আপডেট)
            if (typeof window._startPresenceHeartbeat === 'function') window._startPresenceHeartbeat();
        };

        // ====================================================================
        // 🟢 প্রেজেন্স (অনলাইন/অফলাইন) হার্টবিট সিস্টেম — "একটিভ সদস্য" ফিচারের জন্য
        // প্রতি ৩০ সেকেন্ডে নিজের users/{uid} ডকুমেন্টে lastActive আপডেট করা হয়।
        // অন্য সদস্যরা এই lastActive টাইমস্ট্যাম্প দেখে বুঝতে পারে কে এখন অনলাইন আছে —
        // (RTDB-ভিত্তিক প্রকৃত presence না হলেও, Firestore দিয়ে এটাই সহজ ও নির্ভরযোগ্য পদ্ধতি)
        // ====================================================================
        const PRESENCE_HEARTBEAT_MS        = 30000; // ৩০ সেকেন্ড পরপর হার্টবিট পাঠানো হবে
        const PRESENCE_ONLINE_THRESHOLD_MS = 90000; // শেষ হার্টবিটের ৯০ সেকেন্ডের মধ্যে থাকলে "অনলাইন" ধরা হবে
        let _presenceHeartbeatTimer = null;

        window._startPresenceHeartbeat = function() {
            if (_presenceHeartbeatTimer) return; // আগে থেকেই চালু থাকলে আবার শুরু করো না
            const _sendHeartbeat = async () => {
                try {
                    const uid = window.currentUser?.uid;
                    const fns = window._firebaseFns;
                    const dbRef = window._firebaseDb;
                    if (!uid || !fns || !dbRef) return;
                    await fns.updateDoc(fns.doc(dbRef, "users", uid), { lastActive: fns.serverTimestamp() });
                } catch(e) {
                    console.warn('[Presence] হার্টবিট পাঠাতে সমস্যা:', e.message);
                }
            };
            _sendHeartbeat(); // লগইনের সাথে সাথেই একবার পাঠাও
            _presenceHeartbeatTimer = setInterval(_sendHeartbeat, PRESENCE_HEARTBEAT_MS);

            // ট্যাব/অ্যাপ আবার visible হলে তাৎক্ষণিক একটা হার্টবিট পাঠাও (দ্রুত online দেখানোর জন্য)
            if (!window._presenceVisibilityBound) {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') _sendHeartbeat();
                });
                window._presenceVisibilityBound = true;
            }
        };

        window._stopPresenceHeartbeat = function() {
            if (_presenceHeartbeatTimer) { clearInterval(_presenceHeartbeatTimer); _presenceHeartbeatTimer = null; }
        };

        // কোনো ইউজার এখন "অনলাইন" কিনা — শেষ lastActive অনুযায়ী হিসাব করো
        function _isUserOnline(lastActive) {
            if (!lastActive) return false;
            const ms = typeof lastActive.toMillis === 'function' ? lastActive.toMillis() : new Date(lastActive).getTime();
            return (Date.now() - ms) < PRESENCE_ONLINE_THRESHOLD_MS;
        }
        window._isUserOnline = _isUserOnline; // loadApprovedUsers()-এ ব্যবহারের জন্য

        // 👥 আইকনের উপরের সবুজ ব্যাজ আপডেট করো — কেউ অনলাইনে থাকলেই দেখাবে, না থাকলে সম্পূর্ণ হাইড
        // এবং প্যানেল খোলা থাকলে লিস্ট রিফ্রেশ করো (নতুন কেউ অনলাইনে এলে/চলে গেলে দেখানোর জন্য)
        window._refreshPresenceUI = function() {
            const list = Array.isArray(window.appState?.allApprovedUsers) ? window.appState.allApprovedUsers : [];
            const onlineCount = list.filter(u => _isUserOnline(u.lastActive)).length;

            const badge = document.getElementById('approved-online-badge');
            if (badge) {
                if (onlineCount > 0) {
                    badge.textContent = onlineCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }

            // প্যানেল খোলা থাকলে লিস্ট রিফ্রেশ করো — যাতে অনলাইন/অফলাইন ডট লাইভ আপডেট হয়
            const panel = document.getElementById('approved-users-panel');
            if (panel && panel.style.display !== 'none' && typeof window.loadApprovedUsers === 'function') {
                window.loadApprovedUsers();
            }
        };

        // প্রতি ১৫ সেকেন্ডে রি-রেন্ডার করো — নতুন Firestore ডেটা না এলেও, সময় পার হয়ে
        // গেলে কাউকে "অফলাইন" দেখানোর জন্য (lastActive আপডেট থেমে গেলে)
        setInterval(() => {
            if (typeof window._refreshPresenceUI === 'function') window._refreshPresenceUI();
        }, 15000);

        // ====================================================================
        // 📄 "আরও দেখুন" (Load More) — startAfter() দিয়ে পরের পেজ লোড করা
        // ====================================================================

        // ── আরও সদস্য লোড করো ──
        window.loadMoreMembers = async function() {
            if (!window.currentSomityId || !_hasMoreMembers || _isLoadingMoreMembers || !_lastMemberDoc) return;
            _isLoadingMoreMembers = true;
            renderUI(); // বাটনে লোডিং স্টেট দেখানোর জন্য
            try {
                const { collection: colFn, query: queryFn, orderBy: orderByFn, getDocs: getDocsFn } = window._firebaseFns;
                const membersRef = colFn(db, "somities", window.currentSomityId, "members");
                const nextQuery  = queryFn(membersRef, startAfter(_lastMemberDoc), limit(PAGE_SIZE));
                // ✅ FIX: orderBy("id") সরানো হয়েছে — index error এড়াতে
                const snap = await getDocsFn(nextQuery);

                snap.forEach(d => {
                    const m = d.data();
                    m._docId = d.id;
                    if (!Array.isArray(m.ledger)) m.ledger = [];
                    appState.extraMembers.push(m);
                    appState.members.push(m);
                });
                appState.members.sort(_compareMemberId);
                const docs = snap.docs;
                _lastMemberDoc  = docs.length ? docs[docs.length - 1] : _lastMemberDoc;
                _hasMoreMembers = docs.length === PAGE_SIZE;
            } catch (e) {
                console.error("loadMoreMembers error:", e);
            } finally {
                _isLoadingMoreMembers = false;
                renderUI();
            }
        };

        // ── extraTxns (পুরনো, লোড-মোর) + _recentTxns (রিয়েলটাইম) মিলিয়ে bankLedger/otherFundsLedger তৈরি করো ──
        function rebuildTxnLedgers() {
            appState.bankLedger = [];
            appState.otherFundsLedger = [];
            const combined = (appState.extraTxns || []).concat(_recentTxns);
            combined.forEach(t => {
                if (t.category === 'bank') {
                    appState.bankLedger.push(t);
                } else if (t.category === 'other_fund') {
                    appState.otherFundsLedger.push(t);
                }
            });
        }

        // ── আরও পুরনো লেনদেন লোড করো (ব্যাংক/তহবিল লেজার) ──
        window.loadMoreTransactions = async function() {
            if (!window.currentSomityId || !_hasMoreTxns || _isLoadingMoreTxns || !_lastTxnDoc) return;
            _isLoadingMoreTxns = true;
            try {
                const { collection: colFn, query: queryFn, orderBy: orderByFn, getDocs: getDocsFn } = window._firebaseFns;
                const txnsRef   = colFn(db, "somities", window.currentSomityId, "transactions");
                const nextQuery = queryFn(txnsRef, orderByFn("createdAt", "desc"), startAfter(_lastTxnDoc), limit(PAGE_SIZE));
                const snap = await getDocsFn(nextQuery);

                let older = [];
                snap.forEach(d => {
                    const t = d.data();
                    t._docId = d.id;
                    older.push(t);
                });
                older.reverse(); // পুরনো→নতুন (asc) ক্রমে আনো

                // পুরনো এন্ট্রিগুলো শুরুতে যুক্ত করো (asc ক্রম বজায় রাখতে)
                appState.extraTxns = older.concat(appState.extraTxns);
                rebuildTxnLedgers();

                const docs = snap.docs;
                _lastTxnDoc  = docs.length ? docs[docs.length - 1] : _lastTxnDoc;
                _hasMoreTxns = docs.length === PAGE_SIZE;
            } catch (e) {
                console.error("loadMoreTransactions error:", e);
            } finally {
                _isLoadingMoreTxns = false;
                renderUI();
                // ব্যাংক লেজার মোডাল খোলা থাকলে টেবিল রিফ্রেশ করো
                const blModal = document.getElementById('bank-ledger-modal');
                if (blModal && !blModal.classList.contains('hidden')) openBankLedgerModal();
            }
        };

        // ====================================================================
        // ⚡ saveStateToFirestore — নতুন স্ট্রাকচারে শুধু summary ফিল্ড সেভ করে
        //    (members/transactions/expenses আলাদা ফাংশনে সেভ হয়)
        // ====================================================================
        window.saveStateToFirestore = async function(lastTxn) {
            if (!window.currentSomityId) {
                console.error("saveStateToFirestore: window.currentSomityId পাওয়া যায়নি। সেভ বাতিল।");
                return;
            }
            try {
                const summaryData = {
                    bankBalance:   appState.bankBalance   || 0,
                    cashInHand:    appState.cashInHand    || 0,
                    totalExpenses: appState.totalExpenses || 0,
                    notices:       appState.notices  || [],
                    opinions:      appState.opinions || []
                };
                if (lastTxn) summaryData.lastTransaction = lastTxn;
                await _offlineSafeUpdateDoc(["somities", window.currentSomityId], summaryData);
            } catch(e) {
                console.error("Firestore save error:", e);
            }
        };

        // ====================================================================
        // ⚡ সদস্য সংক্রান্ত Firestore ফাংশন (Sub-collection: members)
        // ====================================================================

        // নতুন সদস্য যোগ করো
        window.addMemberToFirestore = async function(memberData) {
            if (!window.currentSomityId) return null;
            try {
                const { serverTimestamp: sts } = window._firebaseFns;
                const data = Object.assign({}, memberData, { createdAt: sts() });
                const docRef = await _offlineSafeAddDoc(["somities", window.currentSomityId, "members"], data);
                return docRef ? docRef.id : null;
            } catch(e) {
                console.error("addMemberToFirestore error:", e);
                return null;
            }
        };

        // সদস্য আপডেট করো (সঞ্চয়, ledger ইত্যাদি)
        // ✅ FIX: সফল হলে true, ব্যর্থ হলে false রিটার্ন করে — যাতে কলার (যেমন Shift/Merge)
        // নিশ্চিত হয়ে পরবর্তী ধাপে (যেমন delete) এগোতে পারে, ডেটা হারানো এড়াতে
        window.updateMemberInFirestore = async function(docId, fields) {
            if (!window.currentSomityId || !docId) return false;
            try {
                await _offlineSafeUpdateDoc(["somities", window.currentSomityId, "members", docId], fields);
                return true;
            } catch(e) {
                console.error("updateMemberInFirestore error:", e);
                return false;
            }
        };

        // সদস্য মুছুন
        // ✅ FIX: সফল/ব্যর্থ বোঝাতে boolean রিটার্ন করে
        window.deleteMemberFromFirestore = async function(docId) {
            if (!window.currentSomityId || !docId) return false;
            try {
                await _offlineSafeDeleteDoc(["somities", window.currentSomityId, "members", docId]);
                return true;
            } catch(e) {
                console.error("deleteMemberFromFirestore error:", e);
                return false;
            }
        };

        // ====================================================================
        // ⚡ লেনদেন সংক্রান্ত Firestore ফাংশন (Sub-collection: transactions)
        // ====================================================================

        // ব্যাংক বা অন্যান্য ফান্ড লেনদেন যোগ করো
        window.addTransactionToFirestore = async function(txnData) {
            if (!window.currentSomityId) return null;
            try {
                const { serverTimestamp: sts } = window._firebaseFns;
                const data = Object.assign({}, txnData, { createdAt: sts() });
                const docRef = await _offlineSafeAddDoc(["somities", window.currentSomityId, "transactions"], data);
                return docRef ? docRef.id : null;
            } catch(e) {
                console.error("addTransactionToFirestore error:", e);
                return null;
            }
        };

        // লেনদেন ডকুমেন্ট মুছুন
        window.deleteTransactionFromFirestore = async function(docId) {
            if (!window.currentSomityId || !docId) return;
            try {
                await _offlineSafeDeleteDoc(["somities", window.currentSomityId, "transactions", docId]);
            } catch(e) {
                console.error("deleteTransactionFromFirestore error:", e);
            }
        };

        // লেনদেন ডকুমেন্ট আপডেট করো
        window.updateTransactionInFirestore = async function(docId, fields) {
            if (!window.currentSomityId || !docId) return;
            try {
                await _offlineSafeUpdateDoc(["somities", window.currentSomityId, "transactions", docId], fields);
            } catch(e) {
                console.error("updateTransactionInFirestore error:", e);
            }
        };

        // ====================================================================
        // ⚡ খরচ সংক্রান্ত Firestore ফাংশন (Sub-collection: expenses)
        // ====================================================================

        // খরচ এন্ট্রি যোগ করো
        window.addExpenseToFirestore = async function(expenseData) {
            if (!window.currentSomityId) return null;
            try {
                const { serverTimestamp: sts } = window._firebaseFns;
                const data = Object.assign({}, expenseData, { createdAt: sts() });
                const docRef = await _offlineSafeAddDoc(["somities", window.currentSomityId, "expenses"], data);
                return docRef ? docRef.id : null;
            } catch(e) {
                console.error("addExpenseToFirestore error:", e);
                return null;
            }
        };

        // খরচ ডকুমেন্ট মুছুন
        window.deleteExpenseFromFirestore = async function(docId) {
            if (!window.currentSomityId || !docId) return;
            try {
                await _offlineSafeDeleteDoc(["somities", window.currentSomityId, "expenses", docId]);
            } catch(e) {
                console.error("deleteExpenseFromFirestore error:", e);
            }
        };

        // খরচ ডকুমেন্ট আপডেট করো
        window.updateExpenseInFirestore = async function(docId, fields) {
            if (!window.currentSomityId || !docId) return;
            try {
                await _offlineSafeUpdateDoc(["somities", window.currentSomityId, "expenses", docId], fields);
            } catch(e) {
                console.error("updateExpenseInFirestore error:", e);
            }
        };

        // ===== লগইন ফাংশন =====
        window.doLogin = async function() {
            const email = document.getElementById('login-email').value.trim();
            const pass = document.getElementById('login-pass').value;
            const errEl = document.getElementById('login-error');
            errEl.textContent = '';
            if (!email || !pass) { errEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন।'; return; }
            try {
                document.getElementById('login-btn').disabled = true;
                document.getElementById('login-btn').textContent = 'অপেক্ষা করুন...';
                await signInWithEmailAndPassword(auth, email, pass);
            } catch(e) {
                errEl.textContent = 'ভুল ইমেইল বা পাসওয়ার্ড!';
                document.getElementById('login-btn').disabled = false;
                document.getElementById('login-btn').textContent = 'লগইন করুন';
            }
        };

        // ===== পাসওয়ার্ড রিসেট ফাংশন =====
        window.doForgotPassword = async function() {
            const email  = document.getElementById('login-email').value.trim();
            const errEl  = document.getElementById('login-error');
            errEl.style.color = '#e11d48';
            errEl.textContent = '';

            if (!email) {
                errEl.textContent = 'অনুগ্রহ করে আগে আপনার ইমেইলটি লিখুন, তারপর এই লিঙ্কে ক্লিক করুন।';
                // ইমেইল ফিল্ডে ফোকাস দাও
                const emailEl = document.getElementById('login-email');
                if (emailEl) { emailEl.focus(); emailEl.style.border = '1.5px solid #e11d48'; }
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                errEl.style.color = '#059669';
                errEl.textContent = '✅ আপনার ইমেইলে পাসওয়ার্ড রিসেট করার একটি লিঙ্ক পাঠানো হয়েছে। আপনার ইনবক্স বা স্প্যাম ফোল্ডার চেক করুন।';
                // ইমেইল ফিল্ডের border সাধারণ অবস্থায় ফেরাও
                const emailEl = document.getElementById('login-email');
                if (emailEl) emailEl.style.border = '1.5px solid #e2e8f0';
            } catch(e) {
                errEl.style.color = '#e11d48';
                if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-email') {
                    errEl.textContent = 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সঠিক ইমেইলটি লিখুন।';
                } else if (e.code === 'auth/too-many-requests') {
                    errEl.textContent = '⚠️ অনেকবার চেষ্টা করা হয়েছে — কিছুক্ষণ (১৫-২০ মিনিট) অপেক্ষা করে আবার চেষ্টা করুন।';
                } else {
                    errEl.textContent = 'রিসেট লিঙ্ক পাঠাতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।';
                }
            }
        };

        // ===== লগআউট ফাংশন =====
        window.doLogout = async function() {
            if (!(await window.showConfirm('লগআউট করবেন?'))) return;
            // সব রিয়েলটাইম লিসেনার বন্ধ করো
            if (unsubscribeFirestore) unsubscribeFirestore();
            if (unsubscribeMembers)   unsubscribeMembers();
            if (unsubscribeTxns)      unsubscribeTxns();
            if (unsubscribeExpenses)  unsubscribeExpenses();
            if (unsubscribeActiveUsers) unsubscribeActiveUsers();
            if (unsubscribeOpinions)  unsubscribeOpinions();
            if (unsubscribeVotes)     unsubscribeVotes();
            if (unsubscribeInvestments) unsubscribeInvestments();
            if (window._stopPresenceHeartbeat) window._stopPresenceHeartbeat();
            await signOut(auth);
        };

        // ══════════════════════════════════════════════
        // 📜 নিয়মাবলী ও শর্তাবলী সম্মতি স্ক্রিন — ফাংশনসমূহ
        // ══════════════════════════════════════════════

        // স্ক্রিন দেখাও ও নিয়মাবলীর টেক্সট বসাও
        window.showRulesAcceptanceScreen = function() {
            const textEl = document.getElementById('rules-text-content');
            const versionEl = document.getElementById('rules-version-display');
            const checkbox = document.getElementById('rules-agree-checkbox');
            const screenEl = document.getElementById('rules-acceptance-screen');

            textEl.textContent = window._pendingRulesText || 'কোনো নিয়মাবলী পাওয়া যায়নি।';
            versionEl.textContent = window._pendingRulesVersion || '1.0';
            checkbox.checked = false;
            checkbox.disabled = true;
            updateRulesAcceptButton();

            screenEl.style.display = 'flex';
            // স্ক্রল অবস্থান শুরুতে একদম উপরে রিসেট করো (আগের কোনো session-এর স্ক্রল পজিশন যেন প্রভাব না ফেলে)
            const container = document.getElementById('rules-scroll-container');
            if (container) container.scrollTop = 0;
        };

        // স্ক্রল একদম নিচে পৌঁছালে চেকবক্স চালু করো (Force Scroll Logic)
        window.checkRulesScrollBottom = function() {
            const container = document.getElementById('rules-scroll-container');
            const checkbox = document.getElementById('rules-agree-checkbox');
            if (!container || !checkbox) return;
            const reachedBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 15;
            if (reachedBottom) checkbox.disabled = false;
        };
        function checkRulesScrollBottom() { window.checkRulesScrollBottom(); }

        // চেকবক্সের অবস্থা অনুযায়ী "সম্মতি" বাটন সক্রিয়/নিষ্ক্রিয় করো
        window.updateRulesAcceptButton = function() {
            const checkbox = document.getElementById('rules-agree-checkbox');
            const btn = document.getElementById('rules-accept-btn');
            if (checkbox.checked) {
                btn.disabled = false;
                btn.style.background = '#059669';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.background = '#94a3b8';
                btn.style.cursor = 'not-allowed';
            }
        };
        function updateRulesAcceptButton() { window.updateRulesAcceptButton(); }

        // ✅ সম্মতি — Firestore-এ সেভ করে ড্যাশবোর্ডে প্রবেশ করো
        window.acceptRulesAndProceed = async function() {
            const checkbox = document.getElementById('rules-agree-checkbox');
            if (!checkbox.checked) return;
            const btn = document.getElementById('rules-accept-btn');
            btn.disabled = true;
            btn.textContent = 'সংরক্ষণ হচ্ছে...';

            try {
                const uid = window.currentUser && window.currentUser.uid;
                const version = window._pendingRulesVersion || '1.0';
                const db2 = window._firebaseDb;
                const fns = window._firebaseFns;
                const now = fns.serverTimestamp ? fns.serverTimestamp() : new Date();

                // ইউজার ডকে সর্বশেষ সম্মতি লেখা (দ্রুত-চেকের জন্য)
                await fns.updateDoc(fns.doc(db2, 'users', uid), {
                    acceptedRulesVersion: version,
                    acceptedRulesAt: now
                });

                // 📋 আইনি/অডিট ট্রেইলের জন্য স্থায়ী লগ — কখনো মুছে যায় না, ওভাররাইট হয় না
                await fns.addDoc(fns.collection(db2, 'somities', window.currentSomityId, 'ruleAcceptances'), {
                    uid: uid,
                    memberName: window.currentUserName || '',
                    somityId: window.currentSomityId,
                    version: version,
                    acceptedAt: now
                });

                // সবচেয়ে নির্ভরযোগ্য পথ: পেজ রিলোড করো — এতে পুরো লগইন-ফ্লো নতুন করে চলবে
                // এবং এবার acceptedRulesVersion মিলে যাওয়ায় সরাসরি ড্যাশবোর্ডে যাবে।
                window.location.reload();
            } catch(e) {
                window.showAlert('❌ সম্মতি সংরক্ষণ করতে সমস্যা হয়েছে: ' + e.message);
                btn.disabled = false;
                btn.textContent = '✅ সম্মতি দিচ্ছি এবং প্রবেশ করুন';
            }
        };

        // ❌ অসম্মত — লগআউট করে দাও
        window.rejectRulesAndLogout = async function() {
            const confirmed = await window.showConfirm(
                'আপনি যদি নিয়মাবলীতে সম্মতি না দেন, তাহলে আপনি এই সমিতির অ্যাপ ব্যবহার করতে পারবেন না এবং লগআউট হয়ে যাবেন।\n\nআপনি কি নিশ্চিত?',
                { title: '❌ অসম্মতি নিশ্চিত করুন', icon: '⚠️', okText: 'হ্যাঁ, লগআউট করুন', cancelText: 'বাতিল', danger: true }
            );
            if (!confirmed) return;
            document.getElementById('rules-acceptance-screen').style.display = 'none';
            await signOut(auth);
            document.getElementById('login-screen').style.display = 'flex';
            showLoginTab();
            document.getElementById('login-error').textContent = 'সমিতির নিয়মাবলীতে সম্মতি না দেওয়ায় আপনাকে লগ-আউট করা হয়েছে। পুনরায় প্রবেশ করতে লগইন করুন ও নিয়মাবলীতে সম্মতি দিন।';
        };

        // 📜 যেকোনো সময় নিয়মাবলী দেখা (help মেনু থেকে) — শুধু পড়ার জন্য, স্ক্রল/চেকবক্স বাধ্যতামূলক না
        window.openRulesViewerModal = function() {
            document.getElementById('rules-viewer-text').textContent = appState.rulesText || 'কোনো নিয়মাবলী পাওয়া যায়নি।';
            document.getElementById('rules-viewer-version').textContent = appState.rulesVersion || '1.0';
            const modal = document.getElementById('rules-viewer-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        };
        window.closeRulesViewerModal = function() {
            const modal = document.getElementById('rules-viewer-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };

        // 📋 কে কে নিয়মাবলীতে সম্মতি দিয়েছেন — এডমিনের জন্য তালিকা
        window.openRuleAcceptanceStatusModal = async function() {
            const modal = document.getElementById('rule-acceptance-status-modal');
            const listEl = document.getElementById('ras-list');
            document.getElementById('ras-current-version').textContent = appState.rulesVersion || '1.0';
            listEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;">লোড হচ্ছে...</p>';
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            try {
                const fns = window._firebaseFns;
                const db2 = window._firebaseDb;
                const snap = await fns.getDocs(fns.query(
                    fns.collection(db2, 'users'),
                    fns.where('somityId', '==', window.currentSomityId),
                    fns.where('role', '==', 'member')
                ));

                const currentVersion = appState.rulesVersion || '1.0';
                const rows = [];
                snap.forEach(d => {
                    const u = d.data();
                    const accepted = u.acceptedRulesVersion === currentVersion;
                    let dateStr = '';
                    if (accepted && u.acceptedRulesAt && u.acceptedRulesAt.toDate) {
                        dateStr = u.acceptedRulesAt.toDate().toLocaleString('bn-BD');
                    }
                    rows.push({ name: u.name || 'নামহীন', phone: u.phone || '', accepted, dateStr, acceptedVersion: u.acceptedRulesVersion || null });
                });

                // যারা এখনো সম্মতি দেননি (বা পুরনো ভার্সনে দিয়েছেন) তাদের আগে দেখাও
                rows.sort((a, b) => (a.accepted === b.accepted) ? 0 : (a.accepted ? 1 : -1));

                if (rows.length === 0) {
                    listEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;">কোনো সদস্যের লগইন অ্যাকাউন্ট পাওয়া যায়নি।</p>';
                    return;
                }

                listEl.innerHTML = rows.map(r => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid #f1f5f9;gap:8px;">
                        <div style="min-width:0;">
                            <div style="font-size:13px;font-weight:700;color:#334155;">${r.name}</div>
                            ${r.phone ? `<div style="font-size:10.5px;color:#94a3b8;">${r.phone}</div>` : ''}
                        </div>
                        ${r.accepted
                            ? `<div style="text-align:right;flex-shrink:0;"><span style="font-size:10.5px;font-weight:800;color:#059669;background:#ecfdf5;padding:3px 8px;border-radius:999px;">✅ সম্মতি দিয়েছেন</span>${r.dateStr ? `<div style="font-size:9.5px;color:#94a3b8;margin-top:2px;">${r.dateStr}</div>` : ''}</div>`
                            : `<span style="font-size:10.5px;font-weight:800;color:#b91c1c;background:#fef2f2;padding:3px 8px;border-radius:999px;flex-shrink:0;">${r.acceptedVersion ? '⚠️ পুরনো ভার্সনে' : '❌ সম্মতি দেননি'}</span>`
                        }
                    </div>
                `).join('');
            } catch(e) {
                console.error('openRuleAcceptanceStatusModal error:', e);
                listEl.innerHTML = `<p style="text-align:center;color:#dc2626;padding:20px;font-size:12px;">লোড করতে সমস্যা হয়েছে: ${e.message}</p>`;
            }
        };

        window.closeRuleAcceptanceStatusModal = function() {
            const modal = document.getElementById('rule-acceptance-status-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };
    


        // পেওয়াল নম্বর কপি করার ফাংশন
        function copyToClipboard(elementId) {
            var el = document.getElementById(elementId);
            if (!el) return;
            var text = el.textContent.trim();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function() {
                    showCopyToast(text + ' কপি হয়েছে!');
                }).catch(function() { fallbackCopy(text); });
            } else { fallbackCopy(text); }
        }
        function fallbackCopy(text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); showCopyToast(text + ' কপি হয়েছে!'); } catch(e) {}
            document.body.removeChild(ta);
        }
        function showCopyToast(msg) {
            var t = document.createElement('div');
            t.textContent = '✅ ' + msg;
            t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 22px;border-radius:999px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.4);white-space:nowrap;';
            document.body.appendChild(t);
            setTimeout(function(){ t.remove(); }, 2200);
        }
    


// ====================================================================
// ⚡ নতুন SUB-COLLECTION আর্কিটেকচার — appState এখন in-memory cache
// Firestore onSnapshot → appState আপডেট → renderUI()
// ডেটা সরাসরি Firestore sub-collections এ সেভ হয়, localStorage নয়।
// ====================================================================
let appState = {
    members: [],          // ← somities/{id}/members সাব-কালেকশন থেকে লোড হয় (প্রথম PAGE_SIZE)
    extraMembers: [],      // ← "আরও সদস্য দেখুন" দিয়ে অতিরিক্ত লোড হওয়া সদস্য
    bankLedger: [],       // ← somities/{id}/transactions (category:'bank') থেকে
    otherFundsLedger: [], // ← somities/{id}/transactions (category:'other_fund') থেকে
    extraTxns: [],          // ← "আরও দেখুন" দিয়ে অতিরিক্ত লোড হওয়া পুরনো লেনদেন
    expenseLedger: [],    // ← somities/{id}/expenses সাব-কালেকশন থেকে
    bankBalance: 0,       // ← somities/{id} মূল ডকুমেন্ট থেকে
    cashInHand: 0,
    totalExpenses: 0,
    totalInvestment: 0,
    distributableProfitPool: 0, // 🌱 বণ্টনযোগ্য মুনাফা পুল (বিনিয়োগ থেকে)
    totalProfitDistributed: 0, // 🌱 এ পর্যন্ত সর্বমোট বণ্টিত মুনাফা
    hasCustomRules: false, // 📜 নিয়মাবলী সিস্টেম চালু/বন্ধ
    rulesText: '', // 📜 নিয়মাবলীর বিষয়বস্তু
    rulesVersion: '1.0', // 📜 বর্তমান ভার্সন
    investments: [],      // ← somities/{id}/investments সাব-কালেকশন থেকে
    notices: [],
    opinions: []
};
// ✅ গুরুত্বপূর্ণ ফিক্স: window.appState কখনো সেট করা হয়নি, তাই যেসব কোড window.appState
// দিয়ে ডেটা পড়ার চেষ্টা করতো (active-users প্রেজেন্স, opinion-এ avatar, ছবি আপলোডের পর
// instant cache আপডেট) — সব জায়গায় window.appState চিরকাল undefined থেকে গেছে, কোনো
// error ছাড়াই নিঃশব্দে কিছুই হয়নি। এই একটা রেফারেন্স-লিংক যুক্ত করায় window.appState এখন
// সবসময় ঠিক একই (লোকাল) appState অবজেক্ট নির্দেশ করবে — যেকোনো জায়গায় appState বদলালে
// window.appState-এও সাথে সাথে প্রতিফলিত হবে (যেহেতু এটা একই অবজেক্টের রেফারেন্স)।
window.appState = appState;

document.getElementById('current-date').innerText = new Date().toLocaleDateString('bn-BD');

// ===== সমিতি কোড কপি ফাংশন (এডমিন) =====
function copySomityCode() {
    // ব্যাজে যা দেখাচ্ছে সেটাই কপি করো (somityCode > displayEl.textContent > somityId)
    var code = window.currentSomityCode || '';
    if (!code) {
        // ব্যাজ থেকে সরাসরি নাও
        var displayEl = document.getElementById('somity-code-display');
        if (displayEl) code = displayEl.textContent.trim();
    }
    if (!code || code === '...') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function() {
            showCopyToast('সমিতি কোড কপি হয়েছে! ✅');
        }).catch(function() { _fallbackCopySomityCode(code); });
    } else { _fallbackCopySomityCode(code); }
}
function _fallbackCopySomityCode(code) {
    var ta = document.createElement('textarea');
    ta.value = code;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopyToast('সমিতি কোড কপি হয়েছে! ✅'); } catch(e) {}
    document.body.removeChild(ta);
}

// ===== লগইন / নিবন্ধন ট্যাব সুইচ =====
// ES Module scope — window-এ সরাসরি assign করতে হবে
window.showLoginTab = function() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-form-body').style.display = 'block';
    document.getElementById('reg-form-body').style.display = 'none';
    document.getElementById('reg-success-msg').style.display = 'none';
    document.getElementById('tab-login-btn').style.background = '#1a237e';
    document.getElementById('tab-login-btn').style.color = '#fff';
    document.getElementById('tab-reg-btn').style.background = 'transparent';
    document.getElementById('tab-reg-btn').style.color = '#64748b';
    document.getElementById('login-error').textContent = '';
};
window.showRegTab = function() {
    document.getElementById('login-form-body').style.display = 'none';
    document.getElementById('reg-form-body').style.display = 'block';
    document.getElementById('reg-success-msg').style.display = 'none';
    document.getElementById('tab-reg-btn').style.background = '#059669';
    document.getElementById('tab-reg-btn').style.color = '#fff';
    document.getElementById('tab-login-btn').style.background = 'transparent';
    document.getElementById('tab-login-btn').style.color = '#64748b';
    document.getElementById('reg-error').textContent = '';
    var adminRadio = document.getElementById('reg-type-admin');
    if (adminRadio) adminRadio.checked = true;
    window.toggleRegType();
};

// ===== নিবন্ধন টাইপ টগল (এডমিন/মেম্বার) =====
window.toggleRegType = function() {
    var regTypeEl = document.querySelector('input[name="reg-type"]:checked');
    var regType   = regTypeEl ? regTypeEl.value : 'admin';
    var somityNameWrap = document.getElementById('reg-somity-name-wrap');
    var somityCodeWrap = document.getElementById('reg-somity-code-wrap');
    var adminLabel     = document.getElementById('reg-type-admin-label');
    var memberLabel    = document.getElementById('reg-type-member-label');
    if (regType === 'member') {
        if (somityNameWrap) somityNameWrap.style.display = 'none';
        if (somityCodeWrap) somityCodeWrap.style.display = 'block';
        if (adminLabel) { adminLabel.style.border = '2px solid #e2e8f0'; adminLabel.style.background = '#f8fafc'; }
        if (memberLabel) { memberLabel.style.border = '2px solid #059669'; memberLabel.style.background = '#ecfdf5'; }
    } else {
        if (somityNameWrap) somityNameWrap.style.display = 'block';
        if (somityCodeWrap) somityCodeWrap.style.display = 'none';
        if (adminLabel) { adminLabel.style.border = '2px solid #1a237e'; adminLabel.style.background = '#eef2ff'; }
        if (memberLabel) { memberLabel.style.border = '2px solid #e2e8f0'; memberLabel.style.background = '#f8fafc'; }
    }
};

// ===== Pending অনুমোদন প্যানেল টগল =====
function togglePendingApprovalPanel() {
    const panel = document.getElementById('pending-approval-panel');
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        if (window.loadPendingUsers) window.loadPendingUsers();
    } else {
        panel.style.display = 'none';
    }
}

// ===== অনুমোদিত ইউজার প্যানেল টগল =====
function toggleApprovedUsersPanel() {
    const panel = document.getElementById('approved-users-panel');
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        loadApprovedUsers();
    } else {
        panel.style.display = 'none';
    }
}

// ===== অনুমোদিত ইউজার লিস্ট লোড =====
window.loadApprovedUsers = async function() {
    const db2 = window._firebaseDb;
    const fns = window._firebaseFns;
    if (!db2 || !fns) return;
    const container = document.getElementById('approved-users-list');
    if (!container) return;
    container.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;padding:10px;">লোড হচ্ছে...</div>';
    try {
        // শুধু এই সমিতির অনুমোদিত সদস্য — somityId ফিল্টার দিয়ে
        const currentSomityId = window.currentSomityId;
        let q;
        if (currentSomityId) {
            q = fns.query(
                fns.collection(db2, "users"),
                fns.where("status", "==", "approved"),
                fns.where("somityId", "==", currentSomityId)
            );
        } else {
            q = fns.query(fns.collection(db2, "users"), fns.where("status", "==", "approved"));
        }
        const snap = await fns.getDocs(q);
        container.innerHTML = '';
        if (snap.empty) {
            container.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;padding:10px;">কোনো অনুমোদিত ব্যবহারকারী নেই।</div>';
            return;
        }
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const roleBadge = d.role === 'admin'
                ? '<span style="background:#e3f2fd;color:#1565c0;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;">এডমিন</span>'
                : '<span style="background:#f3f4f6;color:#374151;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;">সদস্য</span>';
            // ✅ নতুন: অনলাইনে থাকলে নামের বাম পাশে ছোট্ট সবুজ ডট — অফলাইনে থাকলে কিছুই দেখাবে না
            const presenceEntry = (window.appState?.allApprovedUsers || []).find(u => u._uid === docSnap.id);
            const isOnline = !!(presenceEntry && typeof window._isUserOnline === 'function' && window._isUserOnline(presenceEntry.lastActive));
            const onlineDot = isOnline
                ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.25);flex-shrink:0;"></span>'
                : '';
            container.innerHTML += `
            <div style="background:#fff;border:1px solid #c8e6c9;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                        ${onlineDot}
                        <span style="font-weight:700;font-size:13px;color:#1e293b;">${d.name || 'নাম নেই'}</span>
                        ${roleBadge}
                    </div>
                    <div style="font-size:11px;color:#64748b;">${d.email}${d.phone ? ' | ' + d.phone : ''}</div>
                </div>
                <button onclick="deleteApprovedUser('${docSnap.id}', '${(d.name||'').replace(/'/g,"\\'")}', '${d.role||'member'}')"
                    style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;padding:5px 11px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;">
                    🗑 মুছুন
                </button>
            </div>`;
        });
    } catch(e) {
        container.innerHTML = '<div style="font-size:12px;color:#e11d48;text-align:center;padding:10px;">লোড করতে সমস্যা হয়েছে।</div>';
        console.error("Approved users load error:", e);
    }
};

// ===== অনুমোদিত ইউজার ডিলিট =====
window.deleteApprovedUser = async function(uid, name, role) {
    if (role === 'admin') {
        window.showAlert('এডমিন অ্যাকাউন্ট মুছে ফেলা যাবে না!');
        return;
    }
    if (uid === window.currentUser?.uid) {
        window.showAlert('নিজের অ্যাকাউন্ট মুছে ফেলা যাবে না!');
        return;
    }
    if (!(await window.showConfirm(`"${name}" এর অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলবেন?\n\nএই কাজটি পূর্বাবস্থায় ফেরানো যাবে না!`))) return;
    const db2 = window._firebaseDb;
    const fns = window._firebaseFns;
    try {
        await fns.deleteDoc(fns.doc(db2, "users", uid));
        window.showAlert(`"${name}" এর অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে।`);
        loadApprovedUsers();
    } catch(e) {
        window.showAlert('মুছতে সমস্যা হয়েছে: ' + e.message);
    }
};

function saveState(lastTxn){
    // নতুন স্ট্রাকচারে: শুধু summary (balance/notices) সেভ হয়
    // members/transactions/expenses আলাদা ফাংশনে সেভ হয়
    if(window.saveStateToFirestore) {
        window.saveStateToFirestore(lastTxn);
    }
}

// ===== নোটিফিকেশন হেল্পার =====
function makeTxnId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

// ══════════════════════════════════════════════════════
// ── ফোন নম্বর ফরম্যাটিং ও WhatsApp লিংক হেল্পার ──
// ══════════════════════════════════════════════════════

/**
 * যেকোনো বাংলাদেশী ফোন নম্বরকে আন্তর্জাতিক ফরম্যাটে রূপান্তর করে
 * Input:  01XXXXXXXXX  /  8801XXXXXXXXX  /  +8801XXXXXXXXX  /  ৮৮০১...
 * Output: +8801XXXXXXXXX
 */
function formatPhoneNumber(phone) {
    if (!phone) return '';
    // বাংলা সংখ্যা → ইংরেজি রূপান্তর
    const bnDigits = '০১২৩৪৫৬৭৮৯';
    let p = String(phone).trim();
    p = p.split('').map(c => {
        const idx = bnDigits.indexOf(c);
        return idx !== -1 ? String(idx) : c;
    }).join('');
    // শুধু অঙ্ক রাখো (+ বাদ দিয়ে)
    p = p.replace(/[^0-9]/g, '');
    // বিভিন্ন প্রিফিক্স হ্যান্ডেল করো
    if (p.startsWith('8801') && p.length === 13) return '+' + p;          // 8801XXXXXXXXX
    if (p.startsWith('880') && p.length === 13) return '+' + p;           // 880XXXXXXXXXX (edge case)
    if (p.startsWith('01') && p.length === 11) return '+88' + p;          // 01XXXXXXXXX
    if (p.startsWith('1') && p.length === 10) return '+880' + p;          // 1XXXXXXXXX
    if (p.length === 13 && p.startsWith('88')) return '+' + p;            // অন্যান্য 88...
    return '+88' + p; // fallback
}

/**
 * সদস্যের ফোন নম্বর ও বার্তা দিয়ে WhatsApp লিংক তৈরি করে
 */
function getWhatsAppLink(phone, message) {
    const formatted = formatPhoneNumber(phone);
    // + বাদ দিয়ে শুধু সংখ্যা (wa.me প্রোটোকলে + ছাড়া)
    const waNumber = formatted.replace('+', '');
    const encodedMsg = encodeURIComponent(message || '');
    return `https://wa.me/${waNumber}?text=${encodedMsg}`;
}

/**
 * লেনদেনের WhatsApp বার্তা তৈরি করে
 */
function buildWhatsAppMessage(memberName, txnType, amount, somityName, date) {
    const typeLabel = { deposit:'সঞ্চয় জমা', withdraw:'সঞ্চয় উত্তোলন', admission:'ভর্তি ফি', fine:'জরিমানা' }[txnType] || txnType;
    const dateStr = date || new Date().toLocaleDateString('bn-BD');
    return `আসসালামু আলাইকুম,\n${memberName},\n${somityName || 'সমিতি'}-তে আপনার ${typeLabel} বাবদ ৳${Number(amount).toLocaleString()} টাকা সফলভাবে গৃহীত হয়েছে।\nতারিখ: ${dateStr}\nধন্যবাদ।`;
}

// 🐛 ফিক্স: সদস্য আইডি দিয়ে সর্ট করার জন্য numeric-aware comparator।
// আইডি সংখ্যা (বা সংখ্যাসূচক টেক্সট) হলে সংখ্যা হিসেবে তুলনা হবে (১,২,৩...১০,১১...২০),
// অন্যথায় (আইডি টেক্সট/বর্ণানুক্রমিক হলে) আগের মতো টেক্সট তুলনায় ফিরে যাবে।
function _compareMemberId(a, b) {
    const aId = a.id, bId = b.id;
    const aNum = Number(aId), bNum = Number(bId);
    const aIsNum = aId !== '' && aId !== null && aId !== undefined && !isNaN(aNum);
    const bIsNum = bId !== '' && bId !== null && bId !== undefined && !isNaN(bNum);
    if (aIsNum && bIsNum) return aNum - bNum;
    return String(aId).localeCompare(String(bId), 'bn');
}

function buildLastTxn(type, memberName, amount, detail, memberPhone) {
    const icons = { deposit:'💰', withdraw:'💸', expense:'🧾', bank_in:'🏦', bank_out:'🏧', admission:'📋', fine:'⚠️', other:'📝', investment:'🌱', investment_return:'📈', profit_distribution:'📊' };
    const labels = { deposit:'সঞ্চয় জমা', withdraw:'সঞ্চয় উত্তোলন', expense:'খরচ', bank_in:'ব্যাংকে জমা', bank_out:'ব্যাংক উত্তোলন', admission:'ভর্তি ফি', fine:'জরিমানা', other:'অন্যান্য', investment:'বিনিয়োগ', investment_return:'বিনিয়োগ রিটার্ন', profit_distribution:'মুনাফা বণ্টন' };
    return {
        id: makeTxnId(),
        type,
        icon: icons[type] || '📝',
        label: labels[type] || detail || type,
        memberName: memberName || '',
        memberPhone: memberPhone || '',
        amount,
        detail: detail || '',
        byUid: window.currentUser?.uid || '',
        byName: window.currentUser?.displayName || window.currentUser?.email?.split('@')[0] || 'এডমিন',
        time: new Date().toLocaleString('bn-BD', {hour12:true})
    };
}

// ইন-অ্যাপ নোটিফিকেশন হিস্ট্রি (sessionStorage — রিলোড হলে রিসেট)
// 🐛 ফিক্স: আগে একটাই ফিক্সড কী ব্যবহার হতো (সব সমিতির জন্য একই), ফলে একই ব্রাউজারে
// এক সমিতি থেকে আরেক সমিতিতে গেলে আগের সমিতির নোটিফিকেশন নতুন সমিতিতেও দেখা যেত।
// এখন প্রতিটি সমিতির জন্য আলাদা কী ব্যবহার হয় (currentSomityId অনুযায়ী)।
function _notifKey() { return 'somiti_notif_history_' + (window.currentSomityId || 'default'); }
let _notifHistory = JSON.parse(sessionStorage.getItem(_notifKey()) || '[]');

function addToNotifHistory(lt) {
    _notifHistory.unshift(lt);
    if (_notifHistory.length > 50) _notifHistory = _notifHistory.slice(0, 50);
    sessionStorage.setItem(_notifKey(), JSON.stringify(_notifHistory));
    // unread badge
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'block';
    renderNotifHistory();
}

function clearNotifHistory() {
    _notifHistory = [];
    sessionStorage.removeItem(_notifKey());
    stopBellShake();
    renderNotifHistory();
}

function renderNotifHistory() {
    const list = document.getElementById('notif-history-list');
    if (!list) return;
    if (_notifHistory.length === 0) {
        list.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px 0;">কোনো বিজ্ঞপ্তি নেই।</div>';
        return;
    }
    list.innerHTML = _notifHistory.map((lt, i) => {
        const colorMap = { deposit:'#dcfce7', withdraw:'#fef9c3', expense:'#fee2e2', bank_in:'#ede9fe', bank_out:'#e0e7ff', admission:'#ecfdf5', fine:'#fff7ed', other:'#f1f5f9' };
        const textMap  = { deposit:'#15803d', withdraw:'#b45309', expense:'#b91c1c', bank_in:'#6d28d9', bank_out:'#4338ca', admission:'#0f766e', fine:'#c2410c', other:'#475569' };
        const bg   = colorMap[lt.type] || '#f1f5f9';
        const col  = textMap[lt.type]  || '#475569';
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <div style="width:36px;height:36px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">${lt.icon}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:700;color:${col};">${lt.label}${lt.memberName ? ' — ' + lt.memberName : ''}</div>
                <div style="font-size:13px;font-weight:800;color:#1e293b;">৳ ${Number(lt.amount).toLocaleString()}</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:1px;">${lt.time}</div>
            </div>
        </div>`;
    }).join('');
}

function toggleNotifHistoryPanel() {
    const panel = document.getElementById('notif-history-panel');
    const noticePanel = document.getElementById('notice-panel');
    if (noticePanel) noticePanel.style.display = 'none';
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        stopBellShake();
        // ইউজার নোটিফিকেশন দেখলে তখনই badge সরাও
        const badge = document.getElementById('notif-badge');
        if (badge) badge.style.display = 'none';
        renderNotifHistory();
    } else {
        panel.style.display = 'none';
    }
}

// Toast notification দেখাও
let _toastQueue = [];
let _toastShowing = false;

function showTransactionToast(lt) {
    _toastQueue.push(lt);
    if (!_toastShowing) processToastQueue();
}

function processToastQueue() {
    if (_toastQueue.length === 0) { _toastShowing = false; return; }
    _toastShowing = true;
    const lt = _toastQueue.shift();

    const typeClass = {deposit:'',withdraw:'withdraw',expense:'expense',bank_in:'bank',bank_out:'bank',admission:'',fine:'withdraw',other:'other'}[lt.type] || '';
    const toast = document.createElement('div');
    toast.className = `toast-notif ${typeClass}`;

    // WhatsApp বাটন (শুধু সদস্যের ফোন নম্বর থাকলে)
    let waBtn = '';
    if (lt.memberPhone && ['deposit','withdraw','admission','fine'].includes(lt.type)) {
        const waMsg = buildWhatsAppMessage(lt.memberName, lt.type, lt.amount, appState.somityName, lt.time);
        const waLink = getWhatsAppLink(lt.memberPhone, waMsg);
        waBtn = `<a href="${waLink}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="WhatsApp-এ মেসেজ পাঠান" style="display:inline-flex;align-items:center;gap:4px;background:#25D366;color:#fff;border:none;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;text-decoration:none;margin-top:5px;flex-shrink:0;"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' width='13' height='13'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>মেসেজ পাঠান</a>`;
    }

    toast.innerHTML = `
        <div style="font-size:1.5rem;flex-shrink:0;line-height:1;">${lt.icon}</div>
        <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:2px;">নতুন লেনদেন</div>
            <div style="font-size:13px;font-weight:700;color:#fff;line-height:1.3;">${lt.label}${lt.memberName ? '<br><span style="font-size:11px;color:#cbd5e1;">👤 ' + lt.memberName + '</span>' : ''}</div>
            <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px;">৳ ${Number(lt.amount).toLocaleString()}</div>
            ${waBtn}
        </div>
        <button onclick="this.parentElement.remove(); _toastShowing=false; processToastQueue();" style="background:none;border:none;color:#64748b;font-size:1rem;cursor:pointer;flex-shrink:0;padding:0;">✕</button>`;
    document.body.appendChild(toast);

    // ৫ সেকেন্ড পরে সরিয়ে দাও
    setTimeout(() => {
        toast.classList.add('sliding-out');
        setTimeout(() => {
            toast.remove();
            _toastShowing = false;
            setTimeout(processToastQueue, 200);
        }, 300);
    }, 5000);
}

// ══════════════════════════════════════════════════════
// ── লেনদেন সফলের পরে WhatsApp মেসেজ ডায়ালগ ──
// ══════════════════════════════════════════════════════
function showWhatsAppSuccessDialog(memberName, memberPhone, txnType, amount, date) {
    // পুরনো ডায়ালগ থাকলে সরাও
    const existing = document.getElementById('wa-success-dialog');
    if (existing) existing.remove();

    const waMsg = buildWhatsAppMessage(memberName, txnType, amount, appState.somityName, date);
    const waLink = getWhatsAppLink(memberPhone, waMsg);
    const formattedPhone = formatPhoneNumber(memberPhone);
    const typeLabel = { deposit:'সঞ্চয় জমা', withdraw:'সঞ্চয় উত্তোলন', admission:'ভর্তি ফি', fine:'জরিমানা' }[txnType] || txnType;

    const dialog = document.createElement('div');
    dialog.id = 'wa-success-dialog';
    dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    dialog.innerHTML = `
        <div style="background:#fff;border-radius:20px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:8px;">✅</div>
            <div style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:4px;">লেনদেন সফল হয়েছে!</div>
            <div style="font-size:13px;color:#64748b;margin-bottom:16px;">${memberName} — ${typeLabel} — ৳${Number(amount).toLocaleString()}</div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px;margin-bottom:16px;text-align:left;">
                <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px;">📱 WhatsApp পাঠাবেন?</div>
                <div style="font-size:12px;color:#1e293b;font-weight:700;">${formattedPhone}</div>
            </div>
            <a href="${waLink}" target="_blank" rel="noopener noreferrer"
               onclick="document.getElementById('wa-success-dialog').remove();"
               style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:#fff;font-weight:800;font-size:14px;padding:13px 20px;border-radius:12px;text-decoration:none;margin-bottom:10px;box-shadow:0 4px 12px rgba(37,211,102,.35);">
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' width='18' height='18'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
                মেসেজ পাঠান (WhatsApp)
            </a>
            <button onclick="document.getElementById('wa-success-dialog').remove();"
                    style="width:100%;background:#f1f5f9;color:#475569;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:none;cursor:pointer;">
                এখন নয়
            </button>
        </div>`;
    document.body.appendChild(dialog);
    // backdrop ক্লিকে বন্ধ হবে
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
}

// বেল ইন্টারভাল ট্র্যাকার
let _bellShakeInterval = null;

function shakeBell() {
    const bellIcon = document.getElementById('bell-icon');
    if (!bellIcon) return;
    if (_bellShakeInterval) return; // ইতিমধ্যে চলছে
    _doShake(bellIcon);
    _bellShakeInterval = setInterval(() => { _doShake(bellIcon); }, 3000);
}

function _doShake(bellIcon) {
    bellIcon.classList.remove('bell-shake');
    void bellIcon.offsetWidth;
    bellIcon.classList.add('bell-shake');
    setTimeout(() => bellIcon.classList.remove('bell-shake'), 700);
}

function stopBellShake() {
    if (_bellShakeInterval) { clearInterval(_bellShakeInterval); _bellShakeInterval = null; }
    const bellIcon = document.getElementById('bell-icon');
    if (bellIcon) bellIcon.classList.remove('bell-shake');
}

function formatActionDate(inputDateTime) {
    if(!inputDateTime) return new Date().toLocaleString('bn-BD', {hour12: true});
    return new Date(inputDateTime).toLocaleString('bn-BD', {hour12: true});
}

// 🎂 জন্ম তারিখ (input type="date" থেকে আসা "YYYY-MM-DD") বাংলা সংখ্যায় "DD/MM/YYYY" আকারে দেখানোর জন্য
function formatDobBn(dobStr) {
    if (!dobStr) return '';
    const parts = String(dobStr).split('-'); // [YYYY, MM, DD]
    if (parts.length !== 3) return dobStr;
    const [y, mo, d] = parts;
    const bn = (s) => String(s).replace(/[0-9]/g, ch => "০১২৩৪৫৬৭৮৯"[ch]);
    return `${bn(d)}/${bn(mo)}/${bn(y)}`;
}

function getMonthYearKey(dateStr) {
    let normalized = dateStr.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/pm|am/i, '').replace(/ ঘটিকায়/, '');
    let parts = normalized.split(', ');
    if(parts.length >= 1) {
        let dParts = parts[0].split('/');
        if(dParts.length === 3) {
            let day = parseInt(dParts[0]), month = parseInt(dParts[1]) - 1, year = parseInt(dParts[2]);
            let dObj = new Date(year, month, day);
            if(!isNaN(dObj.getTime())) return dObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        }
    }
    let dObj = new Date(normalized);
    if(!isNaN(dObj.getTime())) return dObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function toggleMemberDetails(index) {
    const detailsDiv = document.getElementById(`details-${index}`); const icon = document.getElementById(`arrow-icon-${index}`);
    if(detailsDiv.classList.contains('open')) { detailsDiv.classList.remove('open'); icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); } 
    else { detailsDiv.classList.add('open'); icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
}
function toggleActionMenu(event, index) {
    event.stopPropagation(); document.querySelectorAll('.action-menu-dropdown').forEach((menu, idx) => { if(idx !== index) menu.classList.add('hidden'); });
    document.getElementById(`action-menu-${index}`).classList.toggle('hidden');
}
document.addEventListener('click', (e) => { 
    document.querySelectorAll('.action-menu-dropdown').forEach(menu => menu.classList.add('hidden'));
    const fundMenu = document.getElementById('fund-dropdown-menu');
    if(fundMenu && !e.target.closest('#fund-dropdown-menu') && !e.target.closest('[onclick="toggleFundDropdown()"]')) {
        fundMenu.classList.add('hidden');
    }
});

function toggleFundDropdown() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন ফান্ড এন্ট্রি করতে পারবেন।'); return; }
    document.getElementById('fund-dropdown-menu').classList.toggle('hidden');
}
function closeFundDropdown() {
    document.getElementById('fund-dropdown-menu').classList.add('hidden');
}

// ===== রোল-বেসড UI কন্ট্রোল =====
function applyRoleUI() {
    // 🔐 SECURE CHECK: window.isAdminVerified() — Firestore-verified role ব্যবহার করে।
    // কনসোল থেকে window.currentUserRole পরিবর্তন করলেও এটি সত্য হবে না।
    const isAdmin = window.isAdminVerified ? window.isAdminVerified() : false;

    // হেডারে রোল ব্যাজ
    const badge = document.getElementById('user-role-badge');
    if (badge) badge.textContent = isAdmin ? 'এডমিন' : 'সদস্য';

    // এডমিন-অনলি এলিমেন্টগুলো দেখানো/লুকানো
    // ⚠️ ব্যতিক্রম: "নিবন্ধন অনুমোদন" ও "অনুমোদিত ব্যবহারকারী তালিকা" — এই দুটি প্যানেলের
    // নিজস্ব খোলা/বন্ধ (toggle) লজিক আছে, তাই এখানে জোর করে "" (visible) সেট করা যাবে না,
    // নাহলে প্রতিবার applyRoleUI() চললেই প্যানেল দুটো নিজে থেকে খুলে যায়।
    const collapsibleAdminPanels = ['pending-approval-panel', 'approved-users-panel'];
    const adminEls = document.querySelectorAll('.admin-only');
    adminEls.forEach(el => {
        if (collapsibleAdminPanels.includes(el.id)) {
            // এডমিন না হলে সম্পূর্ণ লুকিয়ে ফেলো; এডমিন হলে যে অবস্থায় ছিল (খোলা/বন্ধ) সেটাই বজায় থাকবে।
            if (!isAdmin) el.style.display = 'none';
        } else {
            el.style.display = isAdmin ? '' : 'none';
        }
    });

    // সদস্য-মাত্র উপাদান
    const memberEls = document.querySelectorAll('.member-only');
    memberEls.forEach(el => { el.style.display = isAdmin ? 'none' : ''; });

    // নোটিশ যুক্ত বাটন
    const noticeAddBtn = document.getElementById('notice-add-btn');
    if (noticeAddBtn) noticeAddBtn.style.display = isAdmin ? '' : 'none';

    // 🔔 Push Notification বাটন — শুধু এডমিন
    const pushNotifBtn = document.getElementById('push-notif-btn');
    if (pushNotifBtn) pushNotifBtn.style.display = isAdmin ? '' : 'none';

    // নীচের ইনপুট প্যানেল (ব্যাংক লেনদেন + খরচ) — শুধু এডমিন
    const bottomPanel = document.querySelector('.fixed.bottom-0');
    if (bottomPanel) bottomPanel.style.display = isAdmin ? '' : 'none';

    // ফ্লোটিং + বাটন (সম্পূর্ণ speed-dial container) — শুধু এডমিন
    const fabContainer = document.getElementById('speed-dial-container');
    if (fabContainer) fabContainer.style.display = isAdmin ? '' : 'none';
    const fabBtn = document.querySelector('button[onclick="openQuickDepositModal()"]');
    if (fabBtn) fabBtn.style.display = isAdmin ? '' : 'none';

    // 📜 "সমিতির নিয়মাবলী" (help মেনু) — শুধু নিয়মাবলী চালু থাকলেই দেখাবে
    const rulesHelpItem = document.getElementById('help-rules-item');
    if (rulesHelpItem) rulesHelpItem.style.display = appState.hasCustomRules ? 'flex' : 'none';

    // এডমিন অনুমোদন বাটন — শুধু এডমিন
    const approvalBtn = document.getElementById('admin-approval-btn');
    if (approvalBtn) {
        approvalBtn.style.display = isAdmin ? 'flex' : 'none';
        if (isAdmin && window.loadPendingUsers) {
            // Pending count badge আপডেট করো — শুধু এই সমিতির pending
            const db2 = window._firebaseDb;
            const fns = window._firebaseFns;
            if (db2 && fns && fns.collection && fns.getDocs && fns.query && fns.where) {
                let pendingQ;
                if (window.currentSomityId) {
                    pendingQ = fns.query(
                        fns.collection(db2, "users"),
                        fns.where("status", "==", "pending"),
                        fns.where("somityId", "==", window.currentSomityId)
                    );
                } else {
                    pendingQ = fns.query(fns.collection(db2, "users"), fns.where("status", "==", "pending"));
                }
                fns.getDocs(pendingQ)
                    .then(snap => {
                        const countBadge = document.getElementById('pending-count-badge');
                        if (countBadge) {
                            countBadge.textContent = snap.size > 0 ? `(${snap.size})` : '';
                        }
                    }).catch(() => {});
            }
        }
    }

    // নোটিশ ম্যানেজ বাটন — শুধু এডমিন
    const noticeMgBtn = document.getElementById('notice-manage-btn');
    if (noticeMgBtn) noticeMgBtn.style.display = isAdmin ? '' : 'none';
    const noticePanelBtn = document.getElementById('notice-panel-btn');
    if (noticePanelBtn) noticePanelBtn.style.display = isAdmin ? 'flex' : 'none';

    // অনুমোদিত ইউজার বাটন — শুধু এডমিন
    const approvedBtn = document.getElementById('approved-users-btn');
    if (approvedBtn) approvedBtn.style.display = isAdmin ? 'flex' : 'none';

    // body padding-bottom: সদস্য হলে কমাবো (নীচের প্যানেল নেই)
    document.body.style.paddingBottom = isAdmin ? '340px' : '16px';

    // এডমিনের জন্য সমিতি কোড ব্যাজ দেখানো/লুকানো
    const codeBadge = document.getElementById('somity-code-badge');
    const codeDisplay = document.getElementById('somity-code-display');
    if (codeBadge && codeDisplay) {
        if (isAdmin) {
            codeBadge.style.display = 'block';

            if (window.currentSomityCode) {
                // ৬ ডিজিট কোড সরাসরি আছে — দেখাও
                codeDisplay.textContent = window.currentSomityCode;
            } else {
                // somityCode মেমরিতে নেই — Firestore থেকে এনে সেভ করো
                const db2 = window._firebaseDb;
                const fns = window._firebaseFns;
                const somId = window.currentSomityId;
                if (db2 && fns && somId) {
                    fns.getDoc(fns.doc(db2, "somities", somId)).then(snap => {
                        if (snap.exists()) {
                            const d = snap.data();
                            if (d.somityCode) {
                                // Firestore-এ somityCode আছে — গ্লোবালে রাখো ও দেখাও
                                window.currentSomityCode = d.somityCode;
                                codeDisplay.textContent = d.somityCode;
                            } else {
                                // somityCode ফিল্ড নেই — নতুন ৬ ডিজিট কোড তৈরি করে সেভ করো
                                const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                                window.currentSomityCode = newCode;
                                codeDisplay.textContent = newCode;
                                // Firestore-এ ও users-এ একসাথে সেভ করো
                                const uid = window.currentUser ? window.currentUser.uid : somId;
                                fns.updateDoc(fns.doc(db2, "somities", somId), { somityCode: newCode }).catch(() => {});
                                fns.updateDoc(fns.doc(db2, "users", uid), { somityCode: newCode }).catch(() => {});
                            }
                        }
                    }).catch(() => {
                        // fetch ব্যর্থ হলে uid-এর প্রথম ৬ ক্যারেক্টার দেখাও
                        codeDisplay.textContent = somId.slice(0, 6).toUpperCase();
                    });
                    codeDisplay.textContent = '...';  // লোডিং অবস্থায়
                }
            }
        } else {
            codeBadge.style.display = 'none';
        }
    }

    // হেডার height অনুযায়ী sub-nav top আপডেট করো
    setTimeout(() => {
        const headerEl = document.querySelector('.sticky.top-0.z-40');
        const subNav = document.querySelector('nav[style*="position:sticky"]');
        if (headerEl && subNav) {
            subNav.style.top = headerEl.offsetHeight + 'px';
        }
    }, 50);
}

// =====================================================================
// 👤 ইউজার প্রোফাইল সিস্টেম
// =====================================================================

window.openUserProfileModal = async function() {
    // ✅ FIX: modal না থাকলে DOMContentLoaded পর্যন্ত অপেক্ষা করে আবার চেষ্টা করো
    let modal = document.getElementById('user-profile-modal');
    if (!modal) {
        // modal হয়তো এখনো inject হয়নি — injectModals() আবার চালাও
        if (typeof injectModals === 'function') injectModals();
        modal = document.getElementById('user-profile-modal');
        if (!modal) {
            console.warn('[Profile] user-profile-modal DOM-এ পাওয়া যায়নি!');
            return;
        }
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window._pushModalHistory) window._pushModalHistory(() => window.closeUserProfileModal());

    // ✅ FIX: প্রোফাইল ফটো input রিসেট করো (আগের বার বেছে নেওয়া ছবি সরিয়ে দাও)
    const photoInputEl = document.getElementById('up-photo-input');
    if (photoInputEl) photoInputEl.value = '';

    // বর্তমান ইউজারের ডেটা লোড করো
    const db2 = window._firebaseDb;
    const fns = window._firebaseFns;
    const uid = window.currentUser?.uid;
    if (!uid || !db2 || !fns) {
        console.warn('[Profile] currentUser বা Firebase এখনো রেডি নয়।');
        return;
    }

    // ✅ FIX: লোডিং অবস্থায় placeholder দেখাও
    const photoEl2      = document.getElementById('up-photo-preview');
    const placeholderEl2 = document.getElementById('up-photo-placeholder');
    if (photoEl2)      { photoEl2.style.display = 'none'; photoEl2.src = ''; }
    if (placeholderEl2) placeholderEl2.style.display = 'flex';

    try {
        const snap = await fns.getDoc(fns.doc(db2, "users", uid));
        if (snap.exists()) {
            const d = snap.data();
            const nameEl       = document.getElementById('up-name');
            const phoneEl      = document.getElementById('up-phone');
            const addressEl    = document.getElementById('up-address');
            const occupationEl = document.getElementById('up-occupation');
            const emailEl      = document.getElementById('up-email-display');
            const roleEl       = document.getElementById('up-role-display');
            const photoEl      = document.getElementById('up-photo-preview');
            const placeholder  = document.getElementById('up-photo-placeholder');

            if (nameEl)       nameEl.value       = d.name       || '';
            if (phoneEl)      phoneEl.value      = d.phone      || '';
            if (addressEl)    addressEl.value    = d.address    || '';
            if (occupationEl) occupationEl.value = d.occupation || '';
            if (emailEl)      emailEl.textContent = d.email || window.currentUser?.email || '';
            if (roleEl)       roleEl.textContent  = d.role === 'admin' ? '👑 এডমিন' : '👤 সদস্য';

            // ✅ FIX: ছবি লোড — onerror দিয়ে broken image এড়াও
            if (photoEl) {
                if (d.photoUrl) {
                    photoEl.onerror = function() {
                        // ছবি লোড না হলে placeholder দেখাও
                        this.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'flex';
                    };
                    photoEl.onload = function() {
                        this.style.display = 'block';
                        if (placeholder) placeholder.style.display = 'none';
                    };
                    photoEl.src = d.photoUrl;
                } else {
                    photoEl.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                }
            }

            // সমিতির নাম দেখাও
            const somityEl = document.getElementById('up-somity-display');
            if (somityEl) somityEl.textContent = window.currentSomityName || d.somityName || '—';

            // ✅ FIX: photoUrl cache আপডেট করো এবং topbar avatar সাথে সাথে রিফ্রেশ করো
            if (d.photoUrl) {
                window._currentUserPhotoUrl = d.photoUrl;
                if (typeof window._updateTopbarAvatar === 'function') {
                    window._updateTopbarAvatar(d.photoUrl);
                }
            }
        }
    } catch(e) {
        console.error("User profile load error:", e);
    }
};

window.closeUserProfileModal = function() {
    if (window._popModalHistory) window._popModalHistory();
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

window.saveUserProfile = async function() {
    const db2 = window._firebaseDb;
    const fns = window._firebaseFns;
    const uid = window.currentUser?.uid;
    if (!uid || !db2 || !fns) { window.showAlert('লগইন করা নেই!'); return; }

    const name       = (document.getElementById('up-name')?.value       || '').trim();
    const phone      = (document.getElementById('up-phone')?.value      || '').trim();
    const address    = (document.getElementById('up-address')?.value    || '').trim();
    const occupation = (document.getElementById('up-occupation')?.value || '').trim();

    if (!name) { window.showAlert('নাম লিখুন!'); return; }

    const saveBtn = document.getElementById('up-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'সংরক্ষণ হচ্ছে...'; }

    try {
        // ── ধাপ ১: নতুন ছবি থাকলে কম্প্রেস করে ImgBB-তে আপলোড করো ──
        // 🐛 ফিক্স: আগে কম্প্রেশন ছাড়াই বড় (আসল ক্যামেরা রেজোলিউশনের) ছবি সরাসরি পাঠানো হতো,
        // যা ImgBB/Netlify Function-এর সাইজ সীমার কারণে "Internal upload error" দিয়ে ব্যর্থ হতো।
        // সদস্য যোগ/এডিট ফর্মের মতোই এখন এখানেও 200x200-এ কম্প্রেস করা হচ্ছে।
        let photoUrl = null;
        const photoInput = document.getElementById('up-photo-input');
        if (photoInput && photoInput.files && photoInput.files[0]) {
            const base64Data = await compressMemberPhoto(photoInput.files[0], 200, 200);
            photoUrl = await window.uploadToImgBB(base64Data);
        }

        // ── ধাপ ২: users/{uid} আপডেট করো ──
        const updateData = { name, phone, address, occupation };
        if (photoUrl) updateData.photoUrl = photoUrl;
        await fns.updateDoc(fns.doc(db2, 'users', uid), updateData);

        // ── ধাপ ৩: ছবি আপডেট হলে members সাব-কালেকশনেও sync করো ──
        let _photoSyncFailed = false; // ✅ FIX: sync ব্যর্থ হলে ইউজারকে জানানোর জন্য ফ্ল্যাগ
        if (photoUrl && window.currentSomityId) {
            try {
                const somityId = window.currentSomityId;

                // ✅ FIX (রুট কজ সমাধান): আগে যেই পদ্ধতি (০-৪) প্রথমে একটা member doc
                // খুঁজে পেত, সেটাতেই লেখা হতো এবং বাকি পদ্ধতিগুলো স্কিপ হয়ে যেত।
                // কিন্তু কোনো সদস্যের জন্য একাধিক (ডুপ্লিকেট/অরফান) member doc থেকে গেলে
                // (যেমন: approveUser() অটো-তৈরি করা uid-doc + admin-এর ম্যানুয়ালি
                // যোগ করা আসল doc — যেটাই সদস্য লিস্টে দেখানো হয়) — ভুল doc-এ লেখা হলে
                // লোকাল UI সাথে সাথে ঠিক দেখাত (কারণ cache প্যাচ আলাদা শর্তে হতো), কিন্তু
                // পরের realtime onSnapshot রিফ্রেশে আসল (অ-আপডেটেড) doc থেকে ডেটা এসে
                // লোকাল প্যাচ মুছে দিত — এটাই "কিছুক্ষণ পরে ছবি চলে যাওয়া" বাগের কারণ।
                //
                // সমাধান: যত candidate doc-ই মিলুক (০-৪ পদ্ধতির প্রতিটায়), সবগুলোতেই
                // photoUrl লিখে দেওয়া হবে — কোনটা "আসল"/প্রদর্শিত doc তা অনুমান করার
                // ঝুঁকি নেওয়া হচ্ছে না। ফলে যেটাই লিস্টে দেখানো হোক, তার Firestore ডেটায়
                // সত্যিকারের photoUrl থাকবে, এবং পরের snapshot রিফ্রেশে আর মুছে যাবে না।
                const foundDocs = new Map(); // docId -> ref  (Map দিয়ে dedupe)

                // ── পদ্ধতি ০ (সবচেয়ে নির্ভরযোগ্য): users/{uid}.linkedMemberDocId ──
                // অ্যাডমিন যখন "Shift/Merge" করে কোনো নতুন অ্যাকাউন্টকে লিস্টের পুরনো
                // (আইডি-নম্বরযুক্ত) সদস্য এন্ট্রির সাথে যুক্ত করে, তখন এই ফিল্ডটি
                // users/{uid} ডকুমেন্টে সেভ হয়। এটা সরাসরি ও নিশ্চিত।
                try {
                    const userSnap = await fns.getDoc(fns.doc(db2, 'users', uid));
                    const linkedId = userSnap.exists() ? userSnap.data().linkedMemberDocId : null;
                    if (linkedId) {
                        const ref  = fns.doc(db2, 'somities', somityId, 'members', linkedId);
                        const snap = await fns.getDoc(ref);
                        if (snap.exists()) {
                            foundDocs.set(linkedId, ref);
                            console.log('[PhotoSync] পদ্ধতি ০ সফল — linkedMemberDocId ✅', linkedId);
                        } else {
                            console.warn('[PhotoSync] পদ্ধতি ০ ব্যর্থ — linkedMemberDocId আছে কিন্তু doc খুঁজে পাওয়া যায়নি:', linkedId);
                        }
                    }
                } catch(e0) {
                    console.warn('[PhotoSync] পদ্ধতি ০ ব্যর্থ:', e0.message);
                }

                // ── পদ্ধতি ১: members/{uid} — approveUser()-এ সরাসরি uid দিয়ে doc তৈরি হয় ──
                try {
                    const ref  = fns.doc(db2, 'somities', somityId, 'members', uid);
                    const snap = await fns.getDoc(ref);
                    if (snap.exists()) {
                        foundDocs.set(uid, ref);
                        console.log('[PhotoSync] পদ্ধতি ১ সফল — uid দিয়ে doc পাওয়া গেছে ✅');
                    }
                } catch(e1) {
                    console.warn('[PhotoSync] পদ্ধতি ১ ব্যর্থ:', e1.message);
                }

                // ── পদ্ধতি ২: userId field দিয়ে query ──
                try {
                    const col  = fns.collection(db2, 'somities', somityId, 'members');
                    const q    = fns.query(col, fns.where('userId', '==', uid));
                    const snap = await fns.getDocs(q);
                    snap.forEach(d => {
                        if (!foundDocs.has(d.id)) {
                            foundDocs.set(d.id, d.ref);
                            console.log('[PhotoSync] পদ্ধতি ২ সফল — userId query ✅', d.id);
                        }
                    });
                } catch(e2) {
                    console.warn('[PhotoSync] পদ্ধতি ২ ব্যর্থ:', e2.message);
                }

                // ── পদ্ধতি ৩: email দিয়ে query — admin manually যোগ করা সদস্যের জন্য ──
                try {
                    const userEmail = window.currentUser?.email || '';
                    if (userEmail) {
                        const col  = fns.collection(db2, 'somities', somityId, 'members');
                        const q    = fns.query(col, fns.where('email', '==', userEmail));
                        const snap = await fns.getDocs(q);
                        snap.forEach(d => {
                            if (!foundDocs.has(d.id)) {
                                foundDocs.set(d.id, d.ref);
                                console.log('[PhotoSync] পদ্ধতি ৩ সফল — email query ✅', d.id);
                            }
                        });
                    }
                } catch(e3) {
                    console.warn('[PhotoSync] পদ্ধতি ৩ ব্যর্থ:', e3.message);
                }

                // ── পদ্ধতি ৪: phone দিয়ে query — admin manually (addMemberToFirestore দিয়ে)
                // যোগ করা পুরনো সদস্যের জন্য fallback, যাদের member doc-এ userId/email নেই ──
                try {
                    if (phone) {
                        const col  = fns.collection(db2, 'somities', somityId, 'members');
                        const q    = fns.query(col, fns.where('phone', '==', phone));
                        const snap = await fns.getDocs(q);
                        snap.forEach(d => {
                            if (!foundDocs.has(d.id)) {
                                foundDocs.set(d.id, d.ref);
                                console.log('[PhotoSync] পদ্ধতি ৪ সফল — phone query ✅', d.id);
                            }
                        });
                    }
                } catch(e4) {
                    console.warn('[PhotoSync] পদ্ধতি ৪ ব্যর্থ:', e4.message);
                }

                // ── পাওয়া সবগুলো candidate doc-এ photoUrl লিখো (একটাই হোক বা একাধিক) ──
                if (foundDocs.size > 0) {
                    await Promise.all(
                        Array.from(foundDocs.values()).map(ref => fns.updateDoc(ref, { photoUrl }))
                    );
                    const matchedIds = Array.from(foundDocs.keys());
                    console.log('[PhotoSync] Firestore-এ', foundDocs.size, 'টি member doc আপডেট হয়েছে ✅', matchedIds);

                    // ── appState-এর members[] এবং extraMembers[] উভয়তে ছবি আপডেট করো ──
                    // (দুটোতেই খুঁজতে হবে কারণ পেজিনেশনে লোড হওয়া সদস্যরা extraMembers-এ থাকে)
                    const matchedIdSet = new Set(matchedIds);
                    const _updateInList = (list) => {
                        if (!Array.isArray(list)) return false;
                        let updated = false;
                        list.forEach(m => {
                            if (matchedIdSet.has(m._docId) || m.userId === uid || m.email === window.currentUser?.email) {
                                m.photoUrl = photoUrl;
                                updated = true;
                            }
                        });
                        return updated;
                    };

                    const inMain  = _updateInList(window.appState?.members);
                    const inExtra = _updateInList(window.appState?.extraMembers);
                    console.log('[PhotoSync] appState cache আপডেট — members:', inMain, '| extraMembers:', inExtra);

                    // ── UI রিয়েলটাইম রিফ্রেশ ──
                    if (typeof renderUI === 'function') renderUI();

                } else {
                    console.warn('[PhotoSync] কোনো পদ্ধতিতেই members doc খুঁজে পাওয়া যায়নি।');
                    _photoSyncFailed = true;
                }

            } catch(outerErr) {
                // ✅ FIX: Firestore Rules permission-denied হলেও ধরা পড়বে এখানে
                console.warn('[PhotoSync] members sync সম্পূর্ণ ব্যর্থ:', outerErr);
                _photoSyncFailed = true;
            }
        }

        // ✅ FIX: global photo cache আপডেট করো
        if (typeof photoUrl === 'string' && photoUrl) {
            window._currentUserPhotoUrl = photoUrl;
            // topbar avatar সাথে সাথে রিফ্রেশ করো
            if (typeof window._updateTopbarAvatar === 'function') {
                window._updateTopbarAvatar(photoUrl);
            }
        }

        window.showAlert(
            _photoSyncFailed
                ? '✅ প্রোফাইল সংরক্ষণ হয়েছে, কিন্তু ⚠️ সদস্য লিস্টে ছবি সিঙ্ক করা যায়নি (সম্ভবত Firestore Rules অনুমতি দিচ্ছে না)। F12 → Console চেক করুন।'
                : '✅ প্রোফাইল সফলভাবে সংরক্ষণ হয়েছে!'
        );
        window.currentUserName = name; // মতামতে সঠিক নাম দেখানোর জন্য cache আপডেট
        window.closeUserProfileModal();

    } catch(e) {
        window.showAlert('সংরক্ষণ করতে সমস্যা: ' + e.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✅ সংরক্ষণ করুন'; }
    }
};

window.previewProfilePhoto = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview     = document.getElementById('up-photo-preview');
            const placeholder = document.getElementById('up-photo-placeholder');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// =====================================================================
// ⚙️ এডমিন সেটিংস — সমিতির নাম পরিবর্তন ও পাসওয়ার্ড চেঞ্জ
// =====================================================================

window.openAdminSettingsModal = function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই সেটিংস পরিবর্তন করতে পারবেন।'); return; }
    const modal = document.getElementById('admin-settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // বর্তমান সমিতির নাম দেখাও
    const nameInput = document.getElementById('as-somity-name');
    if (nameInput) nameInput.value = window.currentSomityName || '';

    // পাসওয়ার্ড ফিল্ড পরিষ্কার করো
    ['as-current-pass', 'as-new-pass', 'as-confirm-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // error/success মেসেজ পরিষ্কার করো
    const nameMsg = document.getElementById('as-name-msg');
    const passMsg = document.getElementById('as-pass-msg');
    if (nameMsg) { nameMsg.textContent = ''; nameMsg.style.color = ''; }
    if (passMsg) { passMsg.textContent = ''; passMsg.style.color = ''; }

    // 📜 নিয়মাবলী সেকশন পপুলেট করো
    const rulesEnabled = document.getElementById('as-rules-enabled');
    const rulesText    = document.getElementById('as-rules-text');
    const rulesVersion = document.getElementById('as-rules-version');
    const rulesMsg     = document.getElementById('as-rules-msg');
    const forceReaccept = document.getElementById('as-force-reaccept');
    if (rulesEnabled) rulesEnabled.checked = !!appState.hasCustomRules;
    if (rulesText)    rulesText.value = appState.rulesText || '';
    if (rulesVersion) rulesVersion.textContent = appState.rulesVersion || '1.0';
    if (forceReaccept) forceReaccept.checked = false;
    if (rulesMsg) { rulesMsg.textContent = ''; rulesMsg.style.color = ''; }
};

window.closeAdminSettingsModal = function() {
    const modal = document.getElementById('admin-settings-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// সমিতির নাম পরিবর্তন
// 📜 নিয়মাবলী চালু/বন্ধ চেকবক্স — শুধু UI-স্টেট, প্রকৃত সংরক্ষণ "সংরক্ষণ করুন" বাটনেই হয়
window.toggleCustomRules = function() {
    // ইচ্ছাকৃতভাবে এখানে কিছু সংরক্ষণ করা হয় না — saveCustomRules() একসাথে সবকিছু সংরক্ষণ করবে,
    // যাতে "চালু" আছে কিন্তু নিয়মাবলীর লেখা সংরক্ষণ হয়নি এমন অসামঞ্জস্যপূর্ণ অবস্থা তৈরি না হয়।
};

// 🔢 ভার্সন নম্বর বাড়ানোর হেল্পার (যেমন "1.0" -> "1.1")
function _bumpRulesVersion(v) {
    const parts = String(v || '1.0').split('.');
    const major = parseInt(parts[0], 10) || 1;
    const minor = parseInt(parts[1], 10) || 0;
    return `${major}.${minor + 1}`;
}

// 📜 নিয়মাবলী সংরক্ষণ করো — চালু/বন্ধ অবস্থা, লেখা, ও (প্রয়োজনে) নতুন ভার্সন একসাথে
window.saveCustomRules = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }

    const enabledEl = document.getElementById('as-rules-enabled');
    const text = (document.getElementById('as-rules-text')?.value || '').trim();
    const forceReaccept = document.getElementById('as-force-reaccept')?.checked;
    const msgEl = document.getElementById('as-rules-msg');

    if (enabledEl.checked && !text) {
        if (msgEl) { msgEl.textContent = '⚠️ নিয়মাবলী চালু রাখতে চাইলে অন্তত কিছু লেখা থাকতে হবে!'; msgEl.style.color = '#dc2626'; }
        return;
    }

    const btn = document.getElementById('as-rules-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...'; }

    try {
        const db2 = window._firebaseDb;
        const fns = window._firebaseFns;
        const somityId = window.currentSomityId;
        if (!db2 || !fns || !somityId) throw new Error('ডেটা পাওয়া যায়নি');

        const currentVersion = appState.rulesVersion || '1.0';
        const newVersion = forceReaccept ? _bumpRulesVersion(currentVersion) : currentVersion;

        await fns.updateDoc(fns.doc(db2, "somities", somityId), {
            hasCustomRules: !!enabledEl.checked,
            rulesText: text,
            rulesVersion: newVersion
        });

        appState.hasCustomRules = !!enabledEl.checked;
        appState.rulesText = text;
        appState.rulesVersion = newVersion;
        const versionDisplay = document.getElementById('as-rules-version');
        if (versionDisplay) versionDisplay.textContent = newVersion;
        if (document.getElementById('as-force-reaccept')) document.getElementById('as-force-reaccept').checked = false;

        if (msgEl) {
            msgEl.textContent = '✅ সংরক্ষণ হয়েছে!' + (forceReaccept ? ` নতুন ভার্সন ${newVersion} — সব সদস্যকে পরবর্তী লগইনে পুনরায় সম্মতি দিতে হবে।` : '');
            msgEl.style.color = '#059669';
        }
    } catch(e) {
        if (msgEl) { msgEl.textContent = '❌ সংরক্ষণ ব্যর্থ: ' + e.message; msgEl.style.color = '#dc2626'; }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✅ নিয়মাবলী সংরক্ষণ করুন'; }
    }
};

window.changeSomityName = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const newName = (document.getElementById('as-somity-name')?.value || '').trim();
    const nameMsg = document.getElementById('as-name-msg');

    if (!newName) {
        if (nameMsg) { nameMsg.textContent = 'সমিতির নাম লিখুন!'; nameMsg.style.color = '#dc2626'; }
        return;
    }
    if (newName === window.currentSomityName) {
        if (nameMsg) { nameMsg.textContent = 'নতুন নাম আগেরটির মতোই!'; nameMsg.style.color = '#f59e0b'; }
        return;
    }

    const btn = document.getElementById('as-name-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'পরিবর্তন হচ্ছে...'; }

    try {
        const db2 = window._firebaseDb;
        const fns = window._firebaseFns;
        const uid = window.currentUser?.uid;
        const somityId = window.currentSomityId;

        if (!db2 || !fns || !uid || !somityId) throw new Error('ডেটা পাওয়া যায়নি');

        // somities ও users উভয়তে আপডেট করো
        await fns.updateDoc(fns.doc(db2, "somities", somityId), { somityName: newName });
        await fns.updateDoc(fns.doc(db2, "users", uid), { somityName: newName });

        // গ্লোবাল ভেরিয়েবল ও UI আপডেট করো
        window.currentSomityName = newName;
        const headerEl = document.getElementById('header-somity-name');
        if (headerEl) headerEl.textContent = newName;

        if (nameMsg) { nameMsg.textContent = '✅ সমিতির নাম সফলভাবে পরিবর্তন হয়েছে!'; nameMsg.style.color = '#059669'; }
        setTimeout(() => { if (nameMsg) nameMsg.textContent = ''; }, 3000);
    } catch(e) {
        if (nameMsg) { nameMsg.textContent = '❌ পরিবর্তন করতে সমস্যা: ' + e.message; nameMsg.style.color = '#dc2626'; }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✅ নাম পরিবর্তন করুন'; }
    }
};

// পাসওয়ার্ড পরিবর্তন — শেয়ার্ড কোর (এডমিন সেটিংস ও সাধারণ সদস্যের মডাল, দুটোতেই ব্যবহার হয়)
async function _changePasswordCore(prefix) {
    const currentPass = (document.getElementById(prefix + '-current-pass')?.value || '');
    const newPass = (document.getElementById(prefix + '-new-pass')?.value || '');
    const confirmPass = (document.getElementById(prefix + '-confirm-pass')?.value || '');
    const passMsg = document.getElementById(prefix + '-pass-msg');

    if (!currentPass) {
        if (passMsg) { passMsg.textContent = 'বর্তমান পাসওয়ার্ড দিন!'; passMsg.style.color = '#dc2626'; }
        return;
    }
    if (!newPass || newPass.length < 6) {
        if (passMsg) { passMsg.textContent = 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!'; passMsg.style.color = '#dc2626'; }
        return;
    }
    if (newPass !== confirmPass) {
        if (passMsg) { passMsg.textContent = 'নতুন পাসওয়ার্ড দুটি মিলছে না!'; passMsg.style.color = '#dc2626'; }
        return;
    }

    const btn = document.getElementById(prefix + '-pass-save-btn');
    const btnOrigText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'পরিবর্তন হচ্ছে...'; }

    try {
        const auth2 = window._firebaseAuth;
        const { signInWithEmailAndPassword: loginFn } = window._firebaseFns;
        const userEmail = window.currentUser?.email;

        if (!auth2 || !loginFn || !userEmail) throw new Error('অথেনটিকেশন সার্ভিস পাওয়া যায়নি');

        // প্রথমে বর্তমান পাসওয়ার্ড দিয়ে Re-authenticate করো
        await loginFn(auth2, userEmail, currentPass);

        // Firebase Auth SDK দিয়ে পাসওয়ার্ড আপডেট
        const { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        await updatePassword(auth2.currentUser, newPass);

        if (passMsg) { passMsg.textContent = '✅ পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!'; passMsg.style.color = '#059669'; }
        // ফিল্ড পরিষ্কার করো
        [prefix + '-current-pass', prefix + '-new-pass', prefix + '-confirm-pass'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        setTimeout(() => { if (passMsg) passMsg.textContent = ''; }, 4000);
    } catch(e) {
        let msg = '❌ পরিবর্তন করতে সমস্যা হয়েছে।';
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            msg = '❌ বর্তমান পাসওয়ার্ড ভুল!';
        } else if (e.code === 'auth/too-many-requests') {
            msg = '⛔ অনেকবার ভুল চেষ্টা! কিছুক্ষণ পরে আবার চেষ্টা করুন।';
        } else if (e.code === 'auth/requires-recent-login') {
            msg = '⚠️ নিরাপত্তার জন্য পুনরায় লগইন করুন, তারপর আবার চেষ্টা করুন।';
        }
        if (passMsg) { passMsg.textContent = msg; passMsg.style.color = '#dc2626'; }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btnOrigText || '🔐 পাসওয়ার্ড পরিবর্তন করুন'; }
    }
}
window.changeAdminPassword = function() { return _changePasswordCore('as'); };
window.changeMyPassword    = function() { return _changePasswordCore('mp'); };

window.openMyPasswordModal = function() {
    const modal = document.getElementById('my-password-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    ['mp-current-pass', 'mp-new-pass', 'mp-confirm-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const passMsg = document.getElementById('mp-pass-msg');
    if (passMsg) { passMsg.textContent = ''; passMsg.style.color = ''; }
    if (window._pushModalHistory) window._pushModalHistory(window.closeMyPasswordModal);
};
window.closeMyPasswordModal = function() {
    const modal = document.getElementById('my-password-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// =====================================================================
// 🧩 ইউজার প্রোফাইল মডাল HTML ইনজেক্ট করো (DOM লোডের পরে)
// =====================================================================
function injectModals() {
    // --- ইউজার প্রোফাইল মডাল ---
    if (!document.getElementById('user-profile-modal')) {
        const upModal = document.createElement('div');
        upModal.id = 'user-profile-modal';
        upModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:16px;';
        upModal.innerHTML = `
        <div style="background:#fff;border-radius:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.25);">
            <div style="background:linear-gradient(135deg,#1565c0,#0d47a1);border-radius:20px 20px 0 0;padding:20px 20px 16px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;">👤</div>
                    <div>
                        <div style="color:#fff;font-weight:800;font-size:16px;">আমার প্রোফাইল</div>
                        <div id="up-role-display" style="color:#bbdefb;font-size:12px;font-weight:600;">লোড হচ্ছে...</div>
                    </div>
                </div>
                <button onclick="window.closeUserProfileModal()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div style="padding:20px;">
                <!-- প্রোফাইল ফটো -->
                <div style="text-align:center;margin-bottom:16px;">
                    <div style="position:relative;display:inline-block;">
                        <img id="up-photo-preview" src="" alt="প্রোফাইল ফটো" style="display:none;width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #1565c0;margin-bottom:8px;">
                        <div id="up-photo-placeholder" style="width:80px;height:80px;border-radius:50%;background:#e3f2fd;border:3px solid #1565c0;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 8px;">👤</div>
                    </div>
                    <input type="file" id="up-photo-input" accept="image/*"
                        style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;z-index:-1;"
                        onchange="window.previewProfilePhoto(this)">
                    <label for="up-photo-input" style="display:inline-block;background:#e3f2fd;color:#1565c0;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid #90caf9;">
                        📷 ফটো পরিবর্তন করুন
                    </label>
                </div>
                <!-- ইমেইল ও সমিতি তথ্য (read-only) -->
                <div style="background:#f8fafc;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-size:11px;color:#64748b;font-weight:600;">📧 ইমেইল</span>
                        <span id="up-email-display" style="font-size:12px;color:#1e293b;font-weight:700;text-align:right;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">—</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:11px;color:#64748b;font-weight:600;">🏛️ সমিতি</span>
                        <span id="up-somity-display" style="font-size:12px;color:#1e293b;font-weight:700;text-align:right;">—</span>
                    </div>
                </div>
                <!-- এডিটযোগ্য ফিল্ড -->
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:12px;color:#475569;font-weight:700;margin-bottom:5px;">👤 পূর্ণ নাম *</label>
                    <input id="up-name" type="text" placeholder="আপনার পূর্ণ নাম" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:12px;color:#475569;font-weight:700;margin-bottom:5px;">📞 মোবাইল নম্বর</label>
                    <input id="up-phone" type="tel" placeholder="01XXXXXXXXX" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:12px;color:#475569;font-weight:700;margin-bottom:5px;">🏠 ঠিকানা</label>
                    <input id="up-address" type="text" placeholder="আপনার ঠিকানা" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;">
                </div>
                <div style="margin-bottom:18px;">
                    <label style="display:block;font-size:12px;color:#475569;font-weight:700;margin-bottom:5px;">💼 পেশা</label>
                    <input id="up-occupation" type="text" placeholder="আপনার পেশা" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;">
                </div>
                <button id="up-save-btn" onclick="window.saveUserProfile()" style="width:100%;background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;">✅ সংরক্ষণ করুন</button>
                <button onclick="window.closeUserProfileModal()" style="width:100%;background:#f1f5f9;color:#475569;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;">বাতিল করুন</button>
            </div>
        </div>`;
        document.body.appendChild(upModal);
    }

    // --- এডমিন সেটিংস মডাল ---
    if (!document.getElementById('admin-settings-modal')) {
        const asModal = document.createElement('div');
        asModal.id = 'admin-settings-modal';
        asModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:16px;';
        asModal.innerHTML = `
        <div style="background:#fff;border-radius:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.25);">
            <div style="background:linear-gradient(135deg,#1b5e20,#2e7d32);border-radius:20px 20px 0 0;padding:20px 20px 16px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;">⚙️</div>
                    <div>
                        <div style="color:#fff;font-weight:800;font-size:16px;">এডমিন সেটিংস</div>
                        <div style="color:#c8e6c9;font-size:12px;font-weight:600;">সমিতি ও অ্যাকাউন্ট পরিবর্তন</div>
                    </div>
                </div>
                <button onclick="window.closeAdminSettingsModal()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div style="padding:20px;">
                <!-- সমিতির নাম পরিবর্তন -->
                <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:16px;margin-bottom:18px;">
                    <div style="font-size:14px;font-weight:800;color:#15803d;margin-bottom:12px;">🏛️ সমিতির নাম পরিবর্তন</div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#166534;font-weight:700;margin-bottom:5px;">নতুন সমিতির নাম</label>
                        <input id="as-somity-name" type="text" placeholder="সমিতির নাম লিখুন" style="width:100%;padding:10px 12px;border:1.5px solid #86efac;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div id="as-name-msg" style="font-size:12px;font-weight:600;margin-bottom:8px;min-height:18px;"></div>
                    <button id="as-name-save-btn" onclick="window.changeSomityName()" style="width:100%;background:#15803d;color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;">✅ নাম পরিবর্তন করুন</button>
                </div>
                <!-- 📜 নিয়মাবলী ও শর্তাবলী সিস্টেম -->
                <div style="background:#eef2ff;border:1.5px solid #a5b4fc;border-radius:14px;padding:16px;margin-top:18px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="font-size:14px;font-weight:800;color:#3730a3;">📜 নিয়মাবলী ও শর্তাবলী</div>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                            <input type="checkbox" id="as-rules-enabled" onchange="window.toggleCustomRules()" style="width:18px;height:18px;">
                            <span style="font-size:11px;font-weight:700;color:#4338ca;">চালু</span>
                        </label>
                    </div>
                    <p style="font-size:11px;color:#4338ca;margin-bottom:10px;line-height:1.6;">চালু করলে নতুন সদস্যরা (ও ভার্সন পরিবর্তনের ক্ষেত্রে পুরনো সদস্যরাও) নিচের নিয়মাবলী সম্পূর্ণ পড়ে সম্মতি না দেওয়া পর্যন্ত ড্যাশবোর্ডে ঢুকতে পারবেন না।</p>
                    <label style="display:block;font-size:12px;color:#3730a3;font-weight:700;margin-bottom:5px;">নিয়মাবলীর বিষয়বস্তু</label>
                    <textarea id="as-rules-text" rows="6" placeholder="এখানে নিয়মাবলী লিখুন (যেমন: ১. ... ২. ... ৩. ...)" style="width:100%;padding:10px 12px;border:1.5px solid #a5b4fc;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;resize:vertical;"></textarea>
                    <div style="font-size:10.5px;color:#6366f1;margin:6px 0 10px;">বর্তমান ভার্সন: <span id="as-rules-version">১.০</span></div>
                    <label style="display:flex;align-items:flex-start;gap:8px;font-size:11.5px;color:#3730a3;font-weight:600;margin-bottom:10px;cursor:pointer;">
                        <input type="checkbox" id="as-force-reaccept" style="margin-top:2px;width:16px;height:16px;flex-shrink:0;">
                        <span>পুরাতন সকল সদস্যকে কি নতুন নিয়মে পুনরায় সম্মতি দিতে হবে? (টিক দিলে ভার্সন বাড়বে ও সবাইকে আবার সম্মতি দিতে হবে)</span>
                    </label>
                    <div id="as-rules-msg" style="font-size:12px;font-weight:600;margin-bottom:8px;min-height:18px;"></div>
                    <button id="as-rules-save-btn" onclick="window.saveCustomRules()" style="width:100%;background:#4338ca;color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;">✅ নিয়মাবলী সংরক্ষণ করুন</button>
                    <button onclick="window.openRuleAcceptanceStatusModal()" style="width:100%;background:#fff;color:#4338ca;border:1.5px solid #a5b4fc;border-radius:10px;padding:10px;font-size:12.5px;font-weight:800;cursor:pointer;margin-top:8px;">📋 কে কে সম্মতি দিয়েছেন দেখুন</button>
                </div>
                <!-- পাসওয়ার্ড পরিবর্তন -->
                <div style="background:#fef3c7;border:1.5px solid #fbbf24;border-radius:14px;padding:16px;">
                    <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:12px;">🔐 পাসওয়ার্ড পরিবর্তন</div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#78350f;font-weight:700;margin-bottom:5px;">বর্তমান পাসওয়ার্ড</label>
                        <input id="as-current-pass" type="password" placeholder="বর্তমান পাসওয়ার্ড" style="width:100%;padding:10px 12px;border:1.5px solid #fbbf24;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#78350f;font-weight:700;margin-bottom:5px;">নতুন পাসওয়ার্ড</label>
                        <input id="as-new-pass" type="password" placeholder="কমপক্ষে ৬ অক্ষর" style="width:100%;padding:10px 12px;border:1.5px solid #fbbf24;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#78350f;font-weight:700;margin-bottom:5px;">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
                        <input id="as-confirm-pass" type="password" placeholder="পাসওয়ার্ড আবার লিখুন" style="width:100%;padding:10px 12px;border:1.5px solid #fbbf24;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div id="as-pass-msg" style="font-size:12px;font-weight:600;margin-bottom:8px;min-height:18px;"></div>
                    <button id="as-pass-save-btn" onclick="window.changeAdminPassword()" style="width:100%;background:#d97706;color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;">🔐 পাসওয়ার্ড পরিবর্তন করুন</button>
                </div>
            </div>
            <div style="padding:0 20px 20px;">
                <button onclick="window.closeAdminSettingsModal()" style="width:100%;background:#f1f5f9;color:#475569;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;">বন্ধ করুন</button>
            </div>
        </div>`;
        document.body.appendChild(asModal);
    }

    // --- সবার জন্য: পাসওয়ার্ড পরিবর্তন মডাল (সদস্য + এডমিন) ---
    if (!document.getElementById('my-password-modal')) {
        const mpModal = document.createElement('div');
        mpModal.id = 'my-password-modal';
        mpModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:16px;';
        mpModal.innerHTML = `
        <div style="background:#fff;border-radius:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.25);">
            <div style="background:linear-gradient(135deg,#b45309,#d97706);border-radius:20px 20px 0 0;padding:20px 20px 16px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;">🔐</div>
                    <div>
                        <div style="color:#fff;font-weight:800;font-size:16px;">পাসওয়ার্ড পরিবর্তন</div>
                        <div style="color:#fef3c7;font-size:12px;font-weight:600;">আপনার অ্যাকাউন্টের পাসওয়ার্ড বদলান</div>
                    </div>
                </div>
                <button onclick="window.closeMyPasswordModal()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div style="padding:20px;">
                <div style="background:#fef3c7;border:1.5px solid #fbbf24;border-radius:14px;padding:16px;">
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#78350f;font-weight:700;margin-bottom:5px;">বর্তমান পাসওয়ার্ড</label>
                        <input id="mp-current-pass" type="password" placeholder="বর্তমান পাসওয়ার্ড" style="width:100%;padding:10px 12px;border:1.5px solid #fbbf24;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#78350f;font-weight:700;margin-bottom:5px;">নতুন পাসওয়ার্ড</label>
                        <input id="mp-new-pass" type="password" placeholder="কমপক্ষে ৬ অক্ষর" style="width:100%;padding:10px 12px;border:1.5px solid #fbbf24;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="display:block;font-size:12px;color:#78350f;font-weight:700;margin-bottom:5px;">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
                        <input id="mp-confirm-pass" type="password" placeholder="পাসওয়ার্ড আবার লিখুন" style="width:100%;padding:10px 12px;border:1.5px solid #fbbf24;border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;">
                    </div>
                    <div id="mp-pass-msg" style="font-size:12px;font-weight:600;margin-bottom:8px;min-height:18px;"></div>
                    <button id="mp-pass-save-btn" onclick="window.changeMyPassword()" style="width:100%;background:#d97706;color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;">🔐 পাসওয়ার্ড পরিবর্তন করুন</button>
                </div>
            </div>
            <div style="padding:0 20px 20px;">
                <button onclick="window.closeMyPasswordModal()" style="width:100%;background:#f1f5f9;color:#475569;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;">বন্ধ করুন</button>
            </div>
        </div>`;
        document.body.appendChild(mpModal);
    }
}
// injectModals call করো
injectModals();

// =====================================================================
// 🎨 হেডার বার — ডিজিটাল সমিতি ম্যানেজার (সবুজ ফুল স্ক্রিন টপ)
// =====================================================================
// CSS ইনজেক্ট করো — topbar সবসময় রেন্ডার হবে, visibility দিয়ে কন্ট্রোল করা হবে
(function injectTopbarCSS() {
    const style = document.createElement('style');
    style.id = 'dsm-topbar-style';
    style.textContent = `
        #digital-somity-topbar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 99999 !important;
            background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 55%, #388e3c 100%) !important;
            padding: 0 16px !important;
            box-shadow: 0 3px 16px rgba(27,94,32,0.55) !important;
            visibility: hidden;
            height: 0;
            overflow: hidden;
            transition: none;
        }
        #digital-somity-topbar.dsm-visible {
            visibility: visible !important;
            height: auto !important;
            overflow: visible !important;
        }
        #digital-somity-topbar .dsm-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
        }
        #digital-somity-topbar .dsm-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        #digital-somity-topbar .dsm-icon {
            width: 38px; height: 38px;
            background: rgba(255,255,255,0.18);
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
        }
        #digital-somity-topbar .dsm-title {
            color: #fff;
            font-size: 15px;
            font-weight: 900;
            line-height: 1.2;
            letter-spacing: 0.2px;
        }
        #digital-somity-topbar .dsm-date {
            color: #c8e6c9;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.3px;
        }
        #digital-somity-topbar .dsm-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #digital-somity-topbar .dsm-btn {
            background: rgba(255,255,255,0.15) !important;
            border: none !important;
            color: #fff !important;
            width: 36px; height: 36px;
            border-radius: 50%;
            font-size: 17px;
            cursor: pointer;
            display: flex !important;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        #digital-somity-topbar .dsm-btn:active {
            background: rgba(255,255,255,0.28) !important;
        }
        /* পুরনো সবুজ হেডার লুকানোর CSS */
        #dsm-old-header-hidden {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
})();

// DOM রেডি হলে topbar তৈরি করো
function _initDigitalSomityTopbar() {
    if (document.getElementById('digital-somity-topbar')) return;

    const todayBn = new Date().toLocaleDateString('bn-BD');

    const topBar = document.createElement('div');
    topBar.id = 'digital-somity-topbar';
    topBar.innerHTML = `
        <div class="dsm-inner">
            <div class="dsm-left">
                <div class="dsm-icon">🏛️</div>
                <div>
                    <div class="dsm-title">ডিজিটাল সমিতি ম্যানেজার</div>
                    <div class="dsm-date">${todayBn}</div>
                </div>
            </div>
            <div class="dsm-right">
                <button class="dsm-btn" id="dsm-profile-btn" onclick="window.openUserProfileModal()" title="আমার প্রোফাইল" style="overflow:hidden;padding:0;">
                    <img id="dsm-profile-avatar" src="" alt="" style="display:none;width:36px;height:36px;border-radius:50%;object-fit:cover;">
                    <span id="dsm-profile-icon" style="font-size:17px;">👤</span>
                </button>
                <button class="dsm-btn" id="bell-icon" onclick="toggleNotifHistoryPanel()" title="নোটিফিকেশন" style="position:relative;">
                    🔔
                    <span id="notif-badge" style="display:none;position:absolute;top:3px;right:5px;width:9px;height:9px;background:#ef4444;border-radius:50%;border:1.5px solid #fff;"></span>
                </button>
            </div>
        </div>`;

    // body-র একদম শুরুতে ঢোকাও
    document.body.insertBefore(topBar, document.body.firstChild);

    // পুরনো সবুজ হেডার খুঁজে লুকাও
    function hideOldGreenHeader() {
        const dateEl = document.getElementById('current-date');
        if (!dateEl) return;
        // current-date এর parent থেকে উপরে গিয়ে সবুজ row খুঁজো
        let el = dateEl.parentElement;
        for (let i = 0; i < 8; i++) {
            if (!el || el === document.body) break;
            // inline style এ green বা hex চেক
            const bg = el.getAttribute('style') || '';
            const cls = (el.className || '').toString();
            if (bg.includes('green') || bg.includes('#1b5e20') || bg.includes('#2e7d32') ||
                bg.includes('#388e3c') || cls.includes('green') || cls.includes('bg-green')) {
                el.style.cssText += ';display:none!important;';
                return;
            }
            // computedStyle দিয়ে চেক
            try {
                const cBg = getComputedStyle(el).background || '';
                if (cBg.includes('27, 94') || cBg.includes('46, 125') || cBg.includes('56, 142')) {
                    el.style.cssText += ';display:none!important;';
                    return;
                }
            } catch(e) {}
            el = el.parentElement;
        }
    }

    // main-app দৃশ্যমানতা অনুযায়ী topbar দেখানো/লুকানো
    const mainApp = document.getElementById('main-app');
    if (!mainApp) return;

    // ✅ FIX: টপবারের profile বাটনে ছবি দেখানো/আপডেট করার ফাংশন
    window._updateTopbarAvatar = function(photoUrl) {
        const avatarImg  = document.getElementById('dsm-profile-avatar');
        const avatarIcon = document.getElementById('dsm-profile-icon');
        // "দ্রুত কার্যক্রম" গ্রিডের "আমার আইডি" বাটনের ছবিও একইসাথে আপডেট করো
        const quickPhoto = document.getElementById('my-id-quick-photo');
        const quickFallback = document.getElementById('my-id-quick-fallback');
        if (quickPhoto && quickFallback) {
            if (photoUrl) {
                quickPhoto.onerror = function() {
                    this.style.display = 'none';
                    quickFallback.style.display = 'inline';
                };
                quickPhoto.onload = function() {
                    this.style.display = 'block';
                    quickFallback.style.display = 'none';
                };
                quickPhoto.src = photoUrl;
            } else {
                quickPhoto.style.display = 'none';
                quickFallback.style.display = 'inline';
            }
        }
        if (!avatarImg || !avatarIcon) return;
        if (photoUrl) {
            avatarImg.onerror = function() {
                this.style.display = 'none';
                if (avatarIcon) avatarIcon.style.display = 'inline';
            };
            avatarImg.onload = function() {
                this.style.display = 'block';
                if (avatarIcon) avatarIcon.style.display = 'none';
            };
            avatarImg.src = photoUrl;
        } else {
            avatarImg.style.display = 'none';
            avatarIcon.style.display = 'inline';
        }
    };

    function syncTopbar() {
        const appVisible = mainApp.style.display === 'block';
        if (appVisible) {
            topBar.classList.add('dsm-visible');
            // topbar height অনুযায়ী main-app-এ padding দাও
            requestAnimationFrame(() => {
                const h = topBar.getBoundingClientRect().height || 56;
                mainApp.style.paddingTop = h + 'px';
            });
            // পুরনো হেডার লুকাও
            hideOldGreenHeader();
            // ✅ FIX: যদি ছবি আগেই লোড হয়েছে তাহলে avatar আপডেট করো
            if (window._currentUserPhotoUrl) {
                window._updateTopbarAvatar(window._currentUserPhotoUrl);
            }
        } else {
            topBar.classList.remove('dsm-visible');
            mainApp.style.paddingTop = '';
        }
    }

    // MutationObserver দিয়ে main-app style পরিবর্তন ট্র্যাক করো
    const obs = new MutationObserver(syncTopbar);
    obs.observe(mainApp, { attributes: true, attributeFilter: ['style'] });

    // এখনই চেক করো
    syncTopbar();
}

// DOM লোড হওয়ার পরে রান করো
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initDigitalSomityTopbar);
} else {
    // DOM ইতিমধ্যে রেডি
    _initDigitalSomityTopbar();
}

// applyRoleUI override — topbar admin btn ও padding আপডেট করো
const _origApplyRoleUIFn = applyRoleUI;
applyRoleUI = function() {
    _origApplyRoleUIFn();
    // main-app padding-top — topbar height অনুযায়ী
    const topBar = document.getElementById('digital-somity-topbar');
    const mainApp = document.getElementById('main-app');
    if (topBar && mainApp && mainApp.style.display === 'block') {
        requestAnimationFrame(() => {
            const h = topBar.getBoundingClientRect().height || 56;
            mainApp.style.paddingTop = h + 'px';
        });
    }
};

// =====================================================================

// ===== নতুন ইউজার তৈরি (এডমিন প্যানেল থেকে বা console থেকে ব্যবহার করুন) =====
// browser console থেকে: createUser("email@example.com", "password123", "admin")
window.createUser = async function(email, password, role) {
    if (!window.isAdminVerified()) { window.showAlert('এডমিন ছাড়া নতুন ইউজার তৈরি করা যাবে না!'); return; }
    const auth2 = window._firebaseAuth;
    const db2 = window._firebaseDb;
    const { createUserWithEmailAndPassword: createFn, doc: docFn, setDoc: setDocFn, serverTimestamp: stFn } = window._firebaseFns;
    try {
        const uc = await createFn(auth2, email, password);
        await setDocFn(docFn(db2, "users", uc.user.uid), {
            email,
            role: role || 'member',
            status: 'approved',
            createdAt: stFn()
        });
        window.showAlert(`ইউজার তৈরি হয়েছে! Email: ${email}, Role: ${role}`);
    } catch(e) { window.showAlert('ত্রুটি: ' + e.message); }
};

// ===== Pending ইউজার লিস্ট লোড করো (এডমিন প্যানেল) =====
window.loadPendingUsers = async function() {
    const db2 = window._firebaseDb;
    const { collection: colFn, getDocs: getDocsFn, query: queryFn, where: whereFn } = window._firebaseFns;
    try {
        // শুধু এই সমিতির pending সদস্য — somityId ফিল্টার
        const currentSomityId = window.currentSomityId;
        let q;
        if (currentSomityId) {
            q = queryFn(colFn(db2, "users"),
                whereFn("status", "==", "pending"),
                whereFn("somityId", "==", currentSomityId)
            );
        } else {
            q = queryFn(colFn(db2, "users"), whereFn("status", "==", "pending"));
        }
        const snap = await getDocsFn(q);
        const container = document.getElementById('pending-users-list');
        if (!container) return;
        container.innerHTML = '';
        if (snap.empty) {
            container.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;padding:10px;">কোনো অনুমোদন পেন্ডিং নেই।</div>';
            return;
        }
        snap.forEach(docSnap => {
            const d = docSnap.data();
            container.innerHTML += `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <div>
                    <div style="font-weight:700;font-size:13px;color:#1e293b;">${d.name || 'নাম নেই'}</div>
                    <div style="font-size:11px;color:#64748b;">${d.email} | ${d.phone || ''}</div>
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="approveUser('${docSnap.id}')" style="background:#059669;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;">✓ অনুমোদন</button>
                    <button onclick="rejectUser('${docSnap.id}')" style="background:#e11d48;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;">✕ প্রত্যাখ্যান</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error("Pending users load error:", e); }
};

window.approveUser = async function(uid) {
    if (!(await window.showConfirm('এই ব্যবহারকারীকে অনুমোদন দেবেন?', {icon:'✅', danger:false}))) return;
    const db2 = window._firebaseDb;
    const { doc: docFn, updateDoc: updateFn, setDoc: setDocFn, getDoc: getDocFn, serverTimestamp: stFn } = window._firebaseFns;
    try {
        // ── ধাপ ১: users document থেকে member তথ্য পড়ো ──
        const userSnap = await getDocFn(docFn(db2, "users", uid));
        if (!userSnap.exists()) { window.showAlert('ব্যবহারকারীর তথ্য পাওয়া যায়নি।'); return; }
        const userData = userSnap.data();

        // ── ধাপ ২: users/{uid} তে status আপডেট করো ──
        await updateFn(docFn(db2, "users", uid), { status: "approved", role: "member" });

        // ── ধাপ ৩: somities/{somityId}/members/{uid} তে member যোগ করো ──
        // (এটি না করলে এডমিনের ড্যাশবোর্ডে member দেখা যায় না)
        const somityId = userData.somityId || window.currentSomityId;
        if (somityId) {
            // ✅ FIX: আগে যদি এই doc Firestore-এ থাকে, সেটার বিদ্যমান data পড়ে নাও
            // (যাতে savings, photoUrl ইত্যাদি merge-এ overwrite না হয়)
            const existingDocRef = docFn(db2, "somities", somityId, "members", uid);
            const existingSnap   = await getDocFn(existingDocRef).catch(() => null);
            const existing       = existingSnap?.exists() ? existingSnap.data() : {};

            const memberDoc = {
                name:      userData.name      || '',
                phone:     userData.phone     || '',
                email:     userData.email     || '',
                role:      "member",
                status:    "approved",
                userId:    uid,
                // ✅ savings/loan: আগে থেকে থাকলে সেটাই রাখো, না থাকলে ০
                savings:   existing.savings   ?? 0,
                loan:      existing.loan      ?? 0,
                joinedAt:  existing.joinedAt  || (stFn ? stFn() : new Date().toISOString()),
                createdAt: existing.createdAt || (stFn ? stFn() : new Date().toISOString())
            };
            // ✅ FIX: users doc-এ photoUrl থাকলে member doc-এও কপি করো
            // এটা না করলে Shift/Merge-এ currentMember.photoUrl খালি থাকে
            if (userData.photoUrl) memberDoc.photoUrl = userData.photoUrl;

            // ✅ FIX: setDoc-এ { merge: true } ব্যবহার করা হচ্ছে —
            // যদি এই member doc আগে থেকেই Firestore-এ থাকে (যেমন: member আগে
            // ছবি সেট করেছে, বা Shift/Merge হয়েছে), তাহলে শুধু নতুন field গুলো
            // যোগ/আপডেট হবে — photoUrl বা অন্য কোনো পুরনো field মুছবে না।
            // merge: false (ডিফল্ট) হলে পুরো document overwrite হয়ে যেত।
            await setDocFn(docFn(db2, "somities", somityId, "members", uid), memberDoc, { merge: true });
        }

        window.showAlert('✅ অনুমোদন সফল হয়েছে! সদস্য যোগ করা হয়েছে।');
        window.loadPendingUsers();
    } catch(e) {
        console.error('approveUser error:', e);
        window.showAlert('ত্রুটি: ' + e.message);
    }
};

window.rejectUser = async function(uid) {
    if (!(await window.showConfirm('এই আবেদন প্রত্যাখ্যান করবেন?'))) return;
    const db2 = window._firebaseDb;
    const { doc: docFn, updateDoc: updateFn } = window._firebaseFns;
    try {
        await updateFn(docFn(db2, "users", uid), { status: "rejected" });
        window.showAlert('প্রত্যাখ্যান সফল হয়েছে।');
        window.loadPendingUsers();
    } catch(e) { window.showAlert('ত্রুটি: ' + e.message); }
};

// এন্ট্রিকারী নিজেও local notification পাবেন
function notifyEntryMaker(lastTxn) {
    if (!lastTxn) return;
    showTransactionToast(lastTxn);
    addToNotifHistory(lastTxn);
    shakeBell();
    // Firestore snapshot আসার পর duplicate এড়াতে _lastTxnIdRef আপডেট করো
    if (lastTxn.id && window._lastTxnIdRef) window._lastTxnIdRef.value = lastTxn.id;
}

// Firestore ডেটা প্রথমবার এসেছে কিনা ট্র্যাক করো
let _firestoreDataReceived = false;

function renderUI(lastTxn){
    const container = document.getElementById('member-list-container');
    // ✅ FIX: DOM element না থাকলে early return (লোডিং স্ক্রিনে crash এড়াতে)
    if (!container) return;
    container.innerHTML = ""; let totalSavings = 0;
    // ডেটা লোড হয়নি এখনো — loading indicator দেখাও
    if (!_firestoreDataReceived && appState.members.length === 0) {
        container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
            <div style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#3949ab;border-radius:50%;animation:fa-spin 0.8s linear infinite;margin:0 auto 16px;"></div>
            <div style="font-size:14px;font-weight:600;">Firestore থেকে ডেটা লোড হচ্ছে...</div>
            <div style="font-size:11px;margin-top:6px;color:#cbd5e1;">যদি বেশিক্ষণ দেখায় তাহলে F12 → Console চেক করুন</div>
        </div>`;
        document.getElementById('total-members').innerText = '...';
        return; // বাকি renderUI স্কিপ করো
    }

    // ⚡ PERFORMANCE: innerHTML += লুপ এড়িয়ে একসাথে সব HTML তৈরি (array.join)
    const parts = [];
    let activeMemberCount = 0;
    appState.members.forEach((m, index) => {
        if (m.status === 'closed') return; // 🚪 ক্লোজড অ্যাকাউন্ট সক্রিয় তালিকায় দেখাবে না (ডেটা মুছে যায়নি)
        activeMemberCount++;
        totalSavings += Number(m.savings);
        parts.push(`
        <div class="bg-white rounded-2xl shadow border border-slate-100 overflow-visible">
            <div onclick="toggleMemberDetails(${index})" class="p-4 flex justify-between items-center cursor-pointer select-none">
                <div class="flex items-center gap-3"><i id="arrow-icon-${index}" class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform"></i>
                    ${m.photoUrl
                        ? `<img src="${m.photoUrl}" alt="${m.name}" onclick="event.stopPropagation();openMemberProfileByIndex(${index})" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #34d399;box-shadow:0 2px 6px rgba(0,0,0,.15);flex-shrink:0;cursor:pointer;">`
                        : `<div onclick="event.stopPropagation();openMemberProfileByIndex(${index})" style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;color:#1e3a8a;font-weight:900;font-size:15px;flex-shrink:0;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.12);">${(m.name||'?').charAt(0)}</div>`
                    }
                    <h3 onclick="event.stopPropagation();openMemberProfileByIndex(${index})" class="font-bold text-slate-800 cursor-pointer">${m.name}</h3></div>
                <div class="flex items-center gap-4">
                    <p class="text-blue-600 font-bold text-sm">৳ ${Number(m.savings).toLocaleString()}</p>
                    <div class="relative inline-block text-left admin-only">
                        <button onclick="toggleActionMenu(event, ${index})" class="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button>
                        <div id="action-menu-${index}" class="action-menu-dropdown hidden absolute right-0 mt-2 w-28 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
                            <button onclick="event.stopPropagation(); openMemberModal(${index})" class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2 cursor-pointer"><i class="fa-solid fa-pen-to-square text-slate-400"></i> এডিট</button>
                            <button onclick="event.stopPropagation(); deleteMember(${index})" class="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-bold flex items-center gap-2 cursor-pointer"><i class="fa-solid fa-trash text-red-400"></i> মুছুন</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="details-${index}" class="member-details px-4 bg-slate-50/50 rounded-b-2xl">
                <div class="grid grid-cols-2 gap-y-1 text-xs text-gray-500 pb-2 pt-2">
                    <p><span class="font-bold">আইডি:</span> <span class="font-mono bg-slate-200/60 px-1 py-0 rounded text-xs font-bold text-slate-700">${m.id}</span></p>
                    <p><span class="font-bold">মোবাইল:</span> ${m.phone ? formatPhoneNumber(m.phone) : 'নেই'}</p>
                    <p><span class="font-bold">ঠিকানা:</span> ${m.address || 'নেই'}</p>
                    <p><span class="font-bold">প্রতিষ্ঠান:</span> ${m.institution || 'নেই'}</p>
                    <p><span class="font-bold">পিতার নাম:</span> ${m.fatherName || 'নেই'}</p>
                    <p><span class="font-bold">জন্ম তারিখ:</span> ${m.dob ? formatDobBn(m.dob) : 'নেই'}</p>
                    <p><span class="font-bold">NID নম্বর:</span> ${m.nidNumber || 'নেই'}</p>
                    <p><span class="font-bold">নমিনি:</span> ${m.nomineeName ? `${m.nomineeName}${m.nomineeRelation ? ' (' + m.nomineeRelation + ')' : ''}` : 'নেই'}</p>
                </div>
                <div class="flex py-2 border-t border-dashed border-slate-200 admin-only" onclick="event.stopPropagation();">
                    <button onclick="openActionModal(${index})" class="w-full bg-slate-800 text-white font-bold px-3 py-2 rounded-xl shadow-sm hover:bg-slate-700 cursor-pointer text-sm flex justify-center items-center gap-2"><i class="fa-solid fa-layer-group"></i> লেনদেন ও অন্যান্য কার্যক্রম</button>
                </div>
                <div class="flex py-2 border-t border-dashed border-slate-200 member-only" onclick="event.stopPropagation();">
                    <button onclick="openLedgerModal(${index})" class="w-full bg-indigo-50 text-indigo-700 font-bold px-3 py-2 rounded-xl border border-indigo-100 cursor-pointer text-sm flex justify-center items-center gap-2"><i class="fa-solid fa-list"></i> লেনদেনের ইতিহাস দেখুন</button>
                </div>
            </div>
        </div>`);
    });

    // আরও সদস্য দেখুন বাটন
    if (_hasMoreMembers) {
        parts.push(`
        <button onclick="loadMoreMembers()" ${_isLoadingMoreMembers ? 'disabled' : ''} class="w-full text-center text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-2 mt-1 cursor-pointer">
            ${_isLoadingMoreMembers ? 'লোড হচ্ছে...' : 'আরও সদস্য দেখুন'}
        </button>`);
    }

    // একবারে সব HTML সেট করো (DOM re-parse মাত্র একবার)
    container.innerHTML = parts.join('');

    document.getElementById('total-members').innerText = activeMemberCount; document.getElementById('total-savings').innerText = "৳ " + totalSavings.toLocaleString();
    // ✅ FIX: মোট সদস্য ও মোট সঞ্চয়ও instant-show ক্যাশে যুক্ত করা হলো — না হলে
    // রিফ্রেশে এই দুটো কার্ড "..."/৳০ দেখাতো (members লোড হতে cashInHand-এর চেয়ে
    // একটু বেশি সময় লাগে বলে এই সমস্যা শুধু এই দুই কার্ডেই হতো)
    try {
        var _existingSummary = {};
        try { _existingSummary = JSON.parse(localStorage.getItem('_sdm_last_summary') || '{}'); } catch(_e1) {}
        _existingSummary.totalMembers = appState.members.length;
        _existingSummary.totalSavings = Number(totalSavings) || 0;
        localStorage.setItem('_sdm_last_summary', JSON.stringify(_existingSummary));
    } catch(_e2) {}
    document.getElementById('cash-in-hand').innerText = "৳ " + Number(appState.cashInHand).toLocaleString(); document.getElementById('bank-balance').innerText = "৳ " + Number(appState.bankBalance).toLocaleString(); document.getElementById('total-expenses').innerText = "৳ " + Number(appState.totalExpenses).toLocaleString();
    const tiEl = document.getElementById('total-investment'); if (tiEl) tiEl.innerText = "৳ " + Number(appState.totalInvestment || 0).toLocaleString();

    applyRoleUI();
    // ✅ নতুন আর্কিটেকচারে saveState এখানে ডাকা হয় না।
    // Firestore onSnapshot → renderUI() স্বয়ংক্রিয়ভাবে UI আপডেট রাখে।
    // ডেটা সেভ হয় সরাসরি updateSomityDoc / addMemberToFirestore ইত্যাদিতে।
}

// ⚡ SUB-COLLECTION ভিত্তিক handleMemberSubmit
// ✅ FIX: Edit mode-এ ID+Phone মিললে existing member-এ shift করার লজিক যোগ
async function handleMemberSubmit(){
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন সদস্য যোগ/পরিবর্তন করতে পারবেন।'); return; }
    const id          = document.getElementById('m-id').value.trim();
    const name        = document.getElementById('m-name').value.trim();
    const phone       = document.getElementById('m-phone').value.trim();
    const address     = document.getElementById('m-address').value.trim();
    const institution = document.getElementById('m-institution').value.trim();
    const fatherName      = document.getElementById('m-father-name').value.trim();
    const dob             = document.getElementById('m-dob').value.trim();
    const nidNumber       = document.getElementById('m-nid').value.trim();
    const nomineeName     = document.getElementById('m-nominee-name').value.trim();
    const nomineePhone    = document.getElementById('m-nominee-phone').value.trim();
    const nomineeRelation = document.getElementById('m-nominee-relation').value.trim();
    const initial     = Number(document.getElementById('m-initial').value) || 0;
    const editIndex   = document.getElementById('edit-index').value;

    if(!id || !name){ window.showAlert("আইডি এবং নাম অবশ্যই পূরণ করুন!"); return; }

    const currentFormattedDate = formatActionDate("");

    if(editIndex !== "") {
        // ══════════════════════════════════════════════════════
        // ── সদস্য এডিট মোড ──
        // ── ✅ ID + Phone মিলিয়ে দেখো existing member আছে কিনা ──
        // ══════════════════════════════════════════════════════
        const idx    = Number(editIndex);
        const currentMember = appState.members[idx]; // যে member এডিট হচ্ছে

        // ✅ FIX: ফোন নম্বর normalize করো — হাইফেন (-), স্পেস, +৮৮০/৮৮০ প্রিফিক্স
        // আলাদা থাকলেও সিস্টেম যেন বুঝতে পারে এটা একই নম্বর (শুধু তুলনার জন্য,
        // আসল সংরক্ষিত ফরম্যাট বদলানো হয় না)
        const normalizePhone = (p) => {
            let s = String(p || '').replace(/\D/g, ''); // শুধু সংখ্যা রাখো
            if (s.length === 13 && s.startsWith('880')) s = '0' + s.slice(3); // 880XXXXXXXXXX
            else if (s.length === 14 && s.startsWith('0880')) s = s.slice(3); // ভুলবশত 0+880
            return s;
        };
        const normPhone = normalizePhone(phone);

        // নিজেকে বাদ দিয়ে বাকি সব members-এর মধ্যে একই আইডি ব্যবহারকারী কেউ আছে কিনা দেখো
        const sameIdMembers = appState.members.filter((m, i) =>
            i !== idx && String(m.id).trim() === String(id).trim()
        );

        // তাদের মধ্যে ফোন নম্বরও (normalize করে) মেলে এমন কাউকে খুঁজো
        const duplicateMatch = sameIdMembers.find(m => normPhone !== '' && normalizePhone(m.phone) === normPhone);

        // ✅ FIX: একই আইডি অন্য কারো সাথে আগে থেকেই আছে, কিন্তু ফোন মিলছে না —
        // এক্ষেত্রে ডুপ্লিকেট আইডি (একই আইডি দুইজনের নামে) তৈরি হতে দেওয়া যাবে না
        if (sameIdMembers.length > 0 && !duplicateMatch) {
            const other = sameIdMembers[0];
            window.showAlert(
                `❌ সংরক্ষণ করা যায়নি!\n\n` +
                `আইডি নাম্বার "${id}" ইতিমধ্যে "${other.name}" সদস্যের জন্য ব্যবহৃত আছে, কিন্তু ফোন নম্বর মিলছে না।\n\n` +
                `▸ এই সদস্যের কাছে শিফট করতে চাইলে: একই ফোন নম্বর (${other.phone}) দিন।\n` +
                `▸ নতুন/আলাদা সদস্য হিসেবে রাখতে চাইলে: একটি ভিন্ন (এখনো ব্যবহার হয়নি এমন) আইডি নাম্বার দিন।`
            );
            return;
        }

        if (duplicateMatch) {
            // ── পপআপ: মিলে গেছে — shift করবে কিনা জিজ্ঞেস করো ──
            const confirmed = await window.showConfirm(
                `📋 বিদ্যমান সদস্য: ${duplicateMatch.name} (আইডি: ${duplicateMatch.id})\n` +
                `📱 ফোন: ${duplicateMatch.phone}\n\n` +
                `এই সদস্যের কাছে শিফট করতে চান?\n` +
                `(হ্যাঁ = শিফট করুন | বাতিল = নতুন হিসেবে রাখুন)`,
                { title: 'একই আইডি ও ফোন নম্বর পাওয়া গেছে!', icon: '⚠️', okText: 'শিফট করুন', danger: false }
            );

            if (confirmed) {
                // ── Shift / Merge: বর্তমান pending member-কে duplicate-এ merge করো ──
                // ✅ FIX: ক্রম পরিবর্তন করা হয়েছে — আগে টার্গেট ডকুমেন্ট আপডেট নিশ্চিত করে,
                // তারপর লিংক সেভ করে, সবশেষে পুরনো (pending) এন্ট্রি ডিলিট করা হয়।
                // এতে কোনো ধাপ ব্যর্থ হলেও ডেটা হারানোর ঝুঁকি থাকে না।

                // ১. বিদ্যমান (duplicate) member-এর data আপডেট করো (নাম, ঠিকানা ইত্যাদি)
                const mergedData = {
                    id:          duplicateMatch.id,
                    name:        duplicateMatch.name,     // পুরনো নামই রাখো
                    phone:       duplicateMatch.phone,
                    address:     address     || duplicateMatch.address     || '',
                    institution: institution || duplicateMatch.institution || '',
                    fatherName:      fatherName      || duplicateMatch.fatherName      || '',
                    dob:             dob             || duplicateMatch.dob             || '',
                    nidNumber:       nidNumber       || duplicateMatch.nidNumber       || '',
                    nomineeName:     nomineeName     || duplicateMatch.nomineeName     || '',
                    nomineePhone:    nomineePhone    || duplicateMatch.nomineePhone    || '',
                    nomineeRelation: nomineeRelation || duplicateMatch.nomineeRelation || '',
                    savings:     Number(duplicateMatch.savings) || 0,
                    ledger:      Array.isArray(duplicateMatch.ledger) ? duplicateMatch.ledger : [],
                    photoUrl:    duplicateMatch.photoUrl || currentMember.photoUrl || '',
                    // users auth uid লিংক করো (যদি currentMember-এ থাকে)
                    ...(currentMember.userId && { userId: currentMember.userId }),
                    ...(currentMember.email  && { email:  currentMember.email  }),
                    status: 'approved'
                };
                let mergeOk = false;
                if (duplicateMatch._docId && window.updateMemberInFirestore) {
                    mergeOk = await window.updateMemberInFirestore(duplicateMatch._docId, mergedData);
                }
                if (!mergeOk) {
                    window.showAlert('❌ শিফট ব্যর্থ হয়েছে — বিদ্যমান সদস্যের তথ্য আপডেট করা যায়নি। পুরনো এন্ট্রি অপরিবর্তিত রাখা হয়েছে, আবার চেষ্টা করুন। (F12 → Console চেক করুন)');
                    return;
                }

                // ২. users/{uid} তে linkedMemberDocId আপডেট করো (যদি userId থাকে)
                // ✅ এটাই ভবিষ্যতে ছবি/প্রোফাইল sync-এর সবচেয়ে নির্ভরযোগ্য মাধ্যম —
                // তাই এর ব্যর্থতা silently ignore না করে স্পষ্টভাবে এডমিনকে জানানো হয়
                let linkOk = true;
                if (currentMember.userId && window._firebaseDb && window._firebaseFns) {
                    try {
                        const { doc: df, updateDoc: uf } = window._firebaseFns;
                        await uf(df(window._firebaseDb, "users", currentMember.userId), {
                            linkedMemberDocId: duplicateMatch._docId,
                            status: 'approved'
                        });
                    } catch(e){
                        console.warn('[Shift] users update failed:', e);
                        linkOk = false;
                    }
                }

                // ৩. বর্তমান (pending/নতুন approve হওয়া, এখন অপ্রয়োজনীয়) এন্ট্রি ডিলিট করো
                if (currentMember._docId && window.deleteMemberFromFirestore) {
                    await window.deleteMemberFromFirestore(currentMember._docId);
                }

                closeModal();
                // Shift সম্পন্ন — profile-এ যাও
                const dupIdx = appState.members.findIndex(m => m._docId === duplicateMatch._docId);
                if (dupIdx !== -1) {
                    setTimeout(() => {
                        window.showAlert(
                            linkOk
                                ? `✅ শিফট সম্পন্ন!\n"${duplicateMatch.name}" সদস্যের কাছে সফলভাবে স্থানান্তর হয়েছে।`
                                : `✅ শিফট সম্পন্ন হয়েছে, কিন্তু ⚠️ অ্যাকাউন্ট লিংক (linkedMemberDocId) সেভ করা যায়নি — ভবিষ্যতে প্রোফাইল ছবি সিঙ্কে সমস্যা হতে পারে। Firestore Rules চেক করুন।`
                        );
                        openMemberModal(dupIdx); // duplicate member-এর profile খুলে দেখাও
                    }, 400);
                }
                return;
            }
            // বাতিল করলে — নিচে স্বাভাবিক edit হবে (নতুন হিসেবে রাখবে)
        }

        // ── স্বাভাবিক এডিট (কোনো match নেই বা user বাতিল করেছে) ──
        const docId      = currentMember._docId;
        const oldSavings = Number(currentMember.savings);
        const cashDiff   = initial - oldSavings;

        // ledger আপডেট
        const updatedLedger = Array.isArray(currentMember.ledger) ? [...currentMember.ledger] : [];
        if(oldSavings !== initial) {
            updatedLedger.push({ date: currentFormattedDate, type: "জমা", amount: initial });
        }

        // ── এডিটেও ছবি আপলোড (ImgBB API) ──
        let editPhotoUrl = currentMember.photoUrl || "";
        const editPhotoInput = document.getElementById('member-photo-input');
        if (editPhotoInput && editPhotoInput.files && editPhotoInput.files[0]) {
            try {
                const base64Data = await compressMemberPhoto(editPhotoInput.files[0], 200, 200);
                editPhotoUrl = await uploadToImgBB(base64Data);
                console.log('[Photo Edit] ImgBB আপলোড সফল:', editPhotoUrl);
            } catch (photoErr) {
                console.warn('[Photo Edit] ImgBB ছবি আপলোড ব্যর্থ:', photoErr);
            }
        }

        // Firestore member ডক আপডেট
        const editUpdateData = { id, name, phone, address, institution, fatherName, dob, nidNumber, nomineeName, nomineePhone, nomineeRelation, savings: initial, ledger: updatedLedger };
        if (editPhotoUrl) editUpdateData.photoUrl = editPhotoUrl;
        if (docId && window.updateMemberInFirestore) {
            await window.updateMemberInFirestore(docId, editUpdateData);
        }
        // ✅ FIX: onSnapshot আসার আগেই appState সরাসরি আপডেট করো
        // যাতে member list-এ তাৎক্ষণিক ছবি দেখা যায়
        const memberIdx = appState.members.findIndex(m => m._docId === docId);
        if (memberIdx !== -1) {
            appState.members[memberIdx] = Object.assign(
                {}, appState.members[memberIdx], editUpdateData
            );
            renderUI(); // সাথে সাথে list re-render করো
        }
        // summary balance আপডেট
        // 🔧 FIX: atomic increment() (delta) ব্যবহার — local appState-এর stale মান থেকে
        // absolute সংখ্যা লিখলে দ্রুত একাধিক লেনদেনে আগের কোনোটির প্রভাব হারিয়ে যেতে পারত
        if (window.updateSomityDoc) {
            await window.updateSomityDoc({ cashInHand: _somityDelta(cashDiff) });
        }

    } else {
        // ══════════════════════════════════════════════════════
        // ── নতুন সদস্য মোড ──
        // ══════════════════════════════════════════════════════
        if(appState.members.some(m => String(m.id).trim() === String(id).trim())){ window.showAlert("এই আইডি দিয়ে অলরেডি সদস্য আছে!"); return; }

        // ── ছবি কম্প্রেস ও ImgBB তে আপলোড ──
        let photoUrl = "";
        const photoInput = document.getElementById('member-photo-input');
        if (photoInput && photoInput.files && photoInput.files[0]) {
            try {
                const base64Data = await compressMemberPhoto(photoInput.files[0], 200, 200);
                photoUrl = await uploadToImgBB(base64Data);
                console.log('[Photo] ImgBB আপলোড সফল:', photoUrl);
            } catch (photoErr) {
                console.warn('[Photo] ImgBB আপলোড ব্যর্থ, ছবি ছাড়াই সংরক্ষণ:', photoErr);
            }
        }

        const memberData = {
            id, name, phone, address, institution,
            fatherName, dob, nidNumber, nomineeName, nomineePhone, nomineeRelation,
            savings: initial,
            profitLoss: 0,
            ledger: initial > 0 ? [{ date: currentFormattedDate, type: "জমা", amount: initial }] : [],
            ...(photoUrl && { photoUrl })
        };
        if (window.addMemberToFirestore) {
            const newDocId = await window.addMemberToFirestore(memberData);
            // ✅ FIX: নতুন সদস্য appState-এ সাথে সাথে যোগ করো
            // onSnapshot আসার আগেই list-এ ছবিসহ দেখা যাবে
            if (newDocId) {
                const newMember = Object.assign({}, memberData, { _docId: newDocId });
                appState.members.push(newMember);
                appState.members.sort(_compareMemberId);
                renderUI();
            }
        }
        // 🔧 FIX: atomic increment() (delta)
        if (window.updateSomityDoc) {
            await window.updateSomityDoc({ cashInHand: _somityDelta(initial) });
        }
    }
    closeModal();
    // ✅ renderUI() onSnapshot থেকেও স্বয়ংক্রিয়ভাবে হবে — উপরের instant update অতিরিক্ত সুরক্ষা
}

function openMemberModal(index = null){
    const modal = document.getElementById('member-modal'); modal.classList.remove('hidden'); modal.classList.add('flex');
    if (window._pushModalHistory) window._pushModalHistory(() => closeModal());
    if(index !== null) {
        document.getElementById('modal-title').innerText = "সদস্য তথ্য পরিবর্তন";
        document.getElementById('edit-index').value = index;
        const m = appState.members[index];
        document.getElementById('m-id').value = m.id;
        document.getElementById('m-name').value = m.name;
        document.getElementById('m-phone').value = m.phone || "";
        document.getElementById('m-address').value = m.address || "";
        document.getElementById('m-institution').value = m.institution || "";
        document.getElementById('m-father-name').value = m.fatherName || "";
        document.getElementById('m-dob').value = m.dob || "";
        document.getElementById('m-nid').value = m.nidNumber || "";
        document.getElementById('m-nominee-name').value = m.nomineeName || "";
        document.getElementById('m-nominee-phone').value = m.nomineePhone || "";
        document.getElementById('m-nominee-relation').value = m.nomineeRelation || "";
        document.getElementById('m-initial').value = m.savings;
        // ── বিদ্যমান ছবি থাকলে প্রিভিউ দেখাও ──
        const previewWrap = document.getElementById('photo-preview-wrap');
        const previewImg  = document.getElementById('photo-preview-img');
        const photoLabel  = document.getElementById('photo-change-label');
        if (m.photoUrl && previewWrap && previewImg) {
            previewImg.src = m.photoUrl;
            previewWrap.classList.remove('hidden');
        }
        const photoLabelSpan1 = document.getElementById('photo-label-text');
        if (photoLabelSpan1) photoLabelSpan1.textContent = 'নতুন ছবি বদলাতে চাইলে নির্বাচন করুন';
    } else {
        document.getElementById('modal-title').innerText = "নতুন সদস্য যোগ করুন";
        document.getElementById('edit-index').value = "";
        clearModalInputs();
        const photoLabel = document.getElementById('photo-change-label');
        const photoLabelSpan2 = document.getElementById('photo-label-text');
        if (photoLabelSpan2) photoLabelSpan2.textContent = 'প্রোফাইল ছবি বেছে নিন (ঐচ্ছিক)';
    }
}

function closeModal(){ if (window._popModalHistory) window._popModalHistory(); document.getElementById('member-modal').classList.add('hidden'); clearModalInputs(); }
function clearModalInputs() {
    document.getElementById('m-id').value = "";
    document.getElementById('m-name').value = "";
    document.getElementById('m-phone').value = "";
    document.getElementById('m-address').value = "";
    document.getElementById('m-institution').value = "";
    document.getElementById('m-father-name').value = "";
    document.getElementById('m-dob').value = "";
    document.getElementById('m-nid').value = "";
    document.getElementById('m-nominee-name').value = "";
    document.getElementById('m-nominee-phone').value = "";
    document.getElementById('m-nominee-relation').value = "";
    document.getElementById('m-initial').value = "";
    document.getElementById('edit-index').value = "";
    // ── ছবির ইনপুট ও প্রিভিউ রিসেট ──
    const photoInput = document.getElementById('member-photo-input');
    if (photoInput) photoInput.value = "";
    const previewWrap = document.getElementById('photo-preview-wrap');
    if (previewWrap) previewWrap.classList.add('hidden');
    const previewImg = document.getElementById('photo-preview-img');
    if (previewImg) previewImg.src = "";
}

function openActionModal(index) {
    const m = appState.members[index];
    document.getElementById('action-modal-title').innerText = m.name + " - কার্যক্রম";
    const btnContainer = document.getElementById('action-modal-buttons');

    // ফোন-নির্ভর বাটন (ফোন নম্বর থাকলে)
    let phoneRow = '';
    let reminderRow = '';
    if (m.phone) {
        phoneRow = `<a href="tel:${m.phone}" class="col-span-2 flex justify-center items-center gap-2 bg-slate-700 text-white font-bold px-3 py-3 rounded-xl hover:bg-slate-800 cursor-pointer text-sm" style="text-decoration:none;"><i class="fa-solid fa-phone"></i> ফোন কল</a>`;

        const reminderMsg = `আসসালামু আলাইকুম,\n${m.name},\n${appState.somityName || 'সমিতি'}-তে আপনার এই মাসের সঞ্চয় এখনো জমা হয়নি। দয়া করে যত দ্রুত সম্ভব সঞ্চয় জমা দিন।\nধন্যবাদ।`;
        const reminderLink = getWhatsAppLink(m.phone, reminderMsg);
        reminderRow = `<button onclick="window.sendPaymentReminder(${index})" class="col-span-2 flex justify-center items-center gap-2 text-white font-bold px-3 py-3 rounded-xl cursor-pointer text-sm" style="border:none;background:#25D366;"><i class="fa-solid fa-bell"></i> পেমেন্ট অনুস্মারক পাঠান</button>`;
    }

    btnContainer.innerHTML = `
        <button onclick="closeActionModal(); openTxnModal(${index})" class="bg-blue-600 text-white font-bold px-3 py-3 rounded-xl shadow-sm hover:bg-blue-700 cursor-pointer text-sm flex justify-center items-center gap-2"><i class="fa-solid fa-plus"></i> লেনদেন যোগ</button>
        <button onclick="closeActionModal(); window.openSettlementFromList(${index})" class="bg-rose-600 text-white font-bold px-3 py-3 rounded-xl shadow-sm hover:bg-rose-700 cursor-pointer text-sm flex justify-center items-center gap-2"><i class="fa-solid fa-scale-balanced"></i> হিসাব নিষ্পত্তি</button>
        ${phoneRow}
        ${reminderRow}
        <button onclick="closeActionModal(); openMemberModal(${index})" class="col-span-2 bg-indigo-50 text-indigo-700 font-bold px-3 py-3 rounded-xl hover:bg-indigo-100 flex justify-center items-center gap-2 cursor-pointer text-sm"><i class="fa-solid fa-pen"></i> অ্যাকাউন্ট সম্পাদনা করুন</button>
        <button onclick="closeActionModal(); deleteMember(${index})" class="col-span-2 bg-red-50 text-red-700 font-bold px-3 py-3 rounded-xl hover:bg-red-100 flex justify-center items-center gap-2 cursor-pointer text-sm"><i class="fa-solid fa-trash"></i> অ্যাকাউন্ট মুছে ফেলা</button>
        <button onclick="closeActionModal(); openLedgerModal(${index})" class="col-span-2 bg-emerald-100 text-emerald-700 font-bold px-3 py-3 rounded-xl hover:bg-emerald-200 flex justify-center items-center gap-2 cursor-pointer text-sm"><i class="fa-solid fa-clock-rotate-left"></i> লেজার দেখুন</button>
    `;
    document.getElementById('member-action-modal').classList.remove('hidden'); document.getElementById('member-action-modal').classList.add('flex');
}
function closeActionModal() { document.getElementById('member-action-modal').classList.add('hidden'); document.getElementById('member-action-modal').classList.remove('flex'); }

// 🔔 পেমেন্ট অনুস্মারক — একই সাথে (সম্ভব হলে) Push notification এবং WhatsApp মেসেজ পাঠাবে
window.sendPaymentReminder = async function(index) {
    const m = appState.members[index];
    if (!m) return;

    const reminderTitle = 'সঞ্চয় জমার অনুস্মারক';
    const reminderBody  = `${appState.somityName || 'সমিতি'}-তে আপনার এই মাসের সঞ্চয় এখনো জমা হয়নি। দয়া করে যত দ্রুত সম্ভব সঞ্চয় জমা দিন।`;
    const reminderMsg   = `আসসালামু আলাইকুম,\n${m.name},\n${reminderBody}\nধন্যবাদ।`;

    // ── ধাপ ১: সম্ভব হলে Push notification পাঠানোর চেষ্টা করো (সদস্যের notification চালু থাকলে) ──
    let pushResultMsg = '';
    try {
        if (m.phone && window._firebaseFns && window._firebaseDb && window.currentSomityId) {
            const fns = window._firebaseFns;
            const db2 = window._firebaseDb;
            const usersSnap = await fns.getDocs(fns.query(
                fns.collection(db2, 'users'),
                fns.where('somityId', '==', window.currentSomityId),
                fns.where('phone', '==', m.phone)
            ));
            if (!usersSnap.empty) {
                const userDoc = usersSnap.docs[0];
                const token = userDoc.data().fcmToken;
                if (token) {
                    const resp = await fetch('/.netlify/functions/send-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: reminderTitle, body: reminderBody, tokens: [{ uid: userDoc.id, name: m.name, token }] })
                    });
                    const result = await resp.json();
                    pushResultMsg = (resp.ok && result.success && result.sent > 0)
                        ? '✅ Push notification পাঠানো হয়েছে।'
                        : '⚠️ Push notification পাঠানো যায়নি (টোকেন পুরনো হতে পারে)।';
                } else {
                    pushResultMsg = 'ℹ️ এই সদস্য notification চালু করেননি, তাই শুধু WhatsApp পাঠানো হচ্ছে।';
                }
            } else {
                pushResultMsg = 'ℹ️ এই সদস্যের লগইন অ্যাকাউন্ট পাওয়া যায়নি, তাই শুধু WhatsApp পাঠানো হচ্ছে।';
            }
        }
    } catch(e) {
        console.warn('[PaymentReminder] Push পাঠাতে সমস্যা:', e.message);
        pushResultMsg = 'ℹ️ Push notification পাঠাতে সমস্যা হয়েছে, শুধু WhatsApp পাঠানো হচ্ছে।';
    }

    // ── ধাপ ২: WhatsApp মেসেজ খুলে দাও (Push হোক বা না হোক, এটা সবসময় হবে) ──
    if (m.phone) {
        const reminderLink = getWhatsAppLink(m.phone, reminderMsg);
        window.open(reminderLink, '_blank', 'noopener,noreferrer');
    }

    if (pushResultMsg) window.showAlert(pushResultMsg);
};

// 🚀 "লেনদেন যোগ" — সদস্য তালিকা থেকে সরাসরি "দ্রুত সঞ্চয় জমা" মডাল খুলে এই সদস্যকে অটো-সিলেক্ট করা
window.openQuickDepositForMember = function(index) {
    const m = appState.members[index];
    if (!m) return;
    openQuickDepositModal();
    document.getElementById('qd-member-id').value = m.id;
    document.getElementById('qd-member-name').value = m.name;
    const balWrap = document.getElementById('qd-balance-display');
    if (balWrap) {
        document.getElementById('qd-balance-amount').textContent = _toBanglaNumber(Number(m.savings || 0).toLocaleString());
        balWrap.classList.remove('hidden');
    }
};

// 🚪 "হিসাব নিষ্পত্তি" — সদস্য তালিকা থেকে সরাসরি সেটেলমেন্ট মডাল খোলা (প্রোফাইল পেজ ছাড়াই)
window.openSettlementFromList = function(index) {
    const m = appState.members[index];
    if (!m) return;
    window._currentProfileMemberDocId = m._docId;
    window._currentProfileMemberName = m.name || '';
    window._currentProfileMemberSavings = Number(m.savings) || 0;
    window._currentProfileMemberProfitLoss = Number(m.profitLoss) || 0;
    window._currentProfileMemberId = m.id || '';
    window._currentProfileMemberPhone = m.phone || '';
    window._currentProfileMemberAddress = m.address || '';
    window._currentProfileMemberFatherName = m.fatherName || '';
    window._currentProfileMemberDob = m.dob || '';
    window._currentProfileMemberNidNumber = m.nidNumber || '';
    window._currentProfileMemberNomineeName = m.nomineeName || '';
    window._currentProfileMemberNomineePhone = m.nomineePhone || '';
    window._currentProfileMemberNomineeRelation = m.nomineeRelation || '';
    window._currentProfileMemberPhotoUrl = m.photoUrl || '';
    window.closeMemberAccountPrompt();
};

function openQuickDepositModal() { document.getElementById('qd-member-id').value = ""; document.getElementById('qd-member-name').value = ""; document.getElementById('qd-date').value = ""; document.getElementById('qd-amount').value = ""; const txnTypeEl = document.getElementById('qd-txn-type'); if (txnTypeEl) txnTypeEl.value = 'deposit'; const balWrap = document.getElementById('qd-balance-display'); if (balWrap) balWrap.classList.add('hidden'); document.getElementById('quick-deposit-modal').classList.remove('hidden'); document.getElementById('quick-deposit-modal').classList.add('flex'); }
function closeQuickDepositModal() { document.getElementById('quick-deposit-modal').classList.add('hidden'); }
function autoFillMemberName() {
    const idInput = document.getElementById('qd-member-id').value.trim(); const nameInput = document.getElementById('qd-member-name');
    const balWrap = document.getElementById('qd-balance-display');
    if(!idInput) { nameInput.value = ""; if (balWrap) balWrap.classList.add('hidden'); return; }
    const member = appState.members.find(m => m.id === idInput);
    if (member && member.status === 'closed') {
        nameInput.value = "⚠️ " + member.name + " — অ্যাকাউন্ট ক্লোজ করা হয়েছে, লেনদেন করা যাবে না!";
        if (balWrap) balWrap.classList.add('hidden');
        return;
    }
    nameInput.value = member ? member.name : "সদস্য পাওয়া যায়নি!";
    if (balWrap) {
        if (member) {
            document.getElementById('qd-balance-amount').textContent = _toBanglaNumber(Number(member.savings || 0).toLocaleString());
            balWrap.classList.remove('hidden');
        } else {
            balWrap.classList.add('hidden');
        }
    }
}
// ⚡ নতুন SUB-COLLECTION ভিত্তিক submitQuickDeposit
async function submitQuickDeposit() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন সঞ্চয় জমা দিতে পারবেন।'); return; }
    const idInput   = document.getElementById('qd-member-id').value.trim();
    const amount    = Number(document.getElementById('qd-amount').value);
    const customDate = document.getElementById('qd-date').value;
    const txnType   = document.getElementById('qd-txn-type')?.value || 'deposit'; // deposit | admission | fine
    if(!idInput) { window.showAlert("সদস্য আইডি লিখুন!"); return; }
    const memberIndex = appState.members.findIndex(m => m.id === idInput);
    if(memberIndex === -1) { window.showAlert("সদস্য পাওয়া যায়নি!"); return; }
    if(appState.members[memberIndex].status === 'closed') { window.showAlert("⚠️ এই সদস্যের অ্যাকাউন্ট ক্লোজ করা হয়েছে — নতুন লেনদেন করা যাবে না।"); return; }
    if(!amount || amount <= 0) { window.showAlert("সঠিক পরিমাণ লিখুন!"); return; }

    const formattedDate = formatActionDate(customDate);
    const member = appState.members[memberIndex];
    const docId  = member._docId;

    // 🏷️ লেনদেনের ধরন অনুযায়ী লেজার-লেবেল ও লেনদেন-টাইপ ঠিক করা
    const typeInfo = {
        deposit:   { ledgerLabel: 'জমা',        txnKind: 'deposit',   affectsSavings: true  },
        withdraw:  { ledgerLabel: 'উত্তোলন',     txnKind: 'withdraw',  affectsSavings: true  },
        admission: { ledgerLabel: 'ভর্তি ফি',   txnKind: 'admission', affectsSavings: false },
        fine:      { ledgerLabel: 'জরিমানা',    txnKind: 'fine',      affectsSavings: false }
    }[txnType] || { ledgerLabel: 'জমা', txnKind: 'deposit', affectsSavings: true };

    // 💸 উত্তোলনের ক্ষেত্রে বাড়তি যাচাই — পর্যাপ্ত সঞ্চয় ও ক্যাশ আছে কিনা
    if (txnType === 'withdraw') {
        if (amount > Number(member.savings)) { window.showAlert("পর্যাপ্ত সঞ্চয় নেই!"); return; }
        if (amount > (appState.cashInHand || 0)) { window.showAlert("হাতে পর্যাপ্ত ক্যাশ টাকা নেই!"); return; }
    }

    // 🐛 ফিক্স: শুধু "জমা" (সঞ্চয়) টাইপই সদস্যের savings ব্যালেন্স বাড়াবে —
    // "ভর্তি ফি" ও "জরিমানা" শুধু সমিতির ক্যাশে যোগ হবে, সদস্যের ব্যক্তিগত সঞ্চয়ে যোগ হবে না।
    // "উত্তোলন" সঞ্চয় থেকে বিয়োগ হবে এবং ক্যাশ থেকেও বিয়োগ হবে।
    // তবে ইতিহাসের জন্য ledger-এ এন্ট্রি থাকবে (affectsSavings: false ফ্ল্যাগসহ), যাতে প্রোফাইলের
    // লেনদেন-ইতিহাসের রানিং ব্যালেন্স হিসাব থেকে এগুলো বাদ দেওয়া যায়।
    const savingsDelta = txnType === 'withdraw' ? -amount : amount;
    const newSavings = typeInfo.affectsSavings ? (Number(member.savings) + savingsDelta) : Number(member.savings);
    const updatedLedger = Array.isArray(member.ledger) ? [...member.ledger] : [];
    updatedLedger.push({ date: formattedDate, type: typeInfo.ledgerLabel, amount, affectsSavings: typeInfo.affectsSavings });

    if (docId && window.updateMemberInFirestore) {
        await window.updateMemberInFirestore(docId, { savings: newSavings, ledger: updatedLedger });
    }
    // summary ক্যাশ আপডেট
    // 🔧 FIX: atomic increment() (delta) — উত্তোলনে ক্যাশ থেকে বিয়োগ, বাকিগুলোতে যোগ
    const cashDelta = txnType === 'withdraw' ? -amount : amount;
    const lastTxn = buildLastTxn(typeInfo.txnKind, member.name, amount, '', member.phone);
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ cashInHand: _somityDelta(cashDelta) }, lastTxn);
    }
    notifyEntryMaker(lastTxn);
    closeQuickDepositModal();
    // WhatsApp মেসেজ পাঠানোর অপশন
    if (member.phone) {
        showWhatsAppSuccessDialog(member.name, member.phone, txnType === 'deposit' ? 'deposit' : txnType, amount, formattedDate);
    }
}

function openTxnModal(idx, type) {
    document.getElementById('txn-member-index').value = idx;
    document.getElementById('txn-amount').value = "";
    document.getElementById('txn-date').value = "";
    document.getElementById('txn-type').value = type || 'deposit';
    const m = appState.members[idx];
    document.getElementById('txn-modal-title').innerText = (m ? m.name + " - " : "") + "লেনদেন যোগ করুন";
    document.getElementById('txn-modal').classList.remove('hidden'); document.getElementById('txn-modal').classList.add('flex');
}
function closeTxnModal() { document.getElementById('txn-modal').classList.add('hidden'); }
// ⚡ নতুন SUB-COLLECTION ভিত্তিক submitSavingsTransaction
async function submitSavingsTransaction() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন লেনদেন করতে পারবেন।'); return; }
    const idx        = Number(document.getElementById('txn-member-index').value);
    const type       = document.getElementById('txn-type').value;
    const amount     = Number(document.getElementById('txn-amount').value);
    const customDate = document.getElementById('txn-date').value;

    if(!amount || amount <= 0) { window.showAlert("সঠিক টাকার পরিমাণ লিখুন!"); return; }
    const member = appState.members[idx];
    if (member && member.status === 'closed') { window.showAlert("⚠️ এই সদস্যের অ্যাকাউন্ট ক্লোজ করা হয়েছে — নতুন লেনদেন করা যাবে না।"); return; }
    const formattedDate = formatActionDate(customDate);
    const docId  = member._docId;
    if(!Array.isArray(member.ledger)) member.ledger = [];

    let newSavings  = Number(member.savings);
    let cashChange  = 0;
    let ledgerType  = "";
    let txnNotifType = type;

    if(type === 'deposit') {
        newSavings += amount; cashChange = amount; ledgerType = "জমা";
    } else if(type === 'withdraw') {
        if(amount > Number(member.savings)) { window.showAlert("পর্যাপ্ত সঞ্চয় নেই!"); return; }
        if(amount > (appState.cashInHand || 0)) { window.showAlert("হাতে পর্যাপ্ত ক্যাশ টাকা নেই!"); return; }
        newSavings -= amount; cashChange = -amount; ledgerType = "উত্তোলন";
    } else if(type === 'admission') {
        cashChange = amount; ledgerType = "ভর্তি ফি";
    } else if(type === 'fine') {
        cashChange = amount; ledgerType = "জরিমানা";
    }

    const affectsSavings = (type === 'deposit' || type === 'withdraw');
    const updatedLedger = [...member.ledger, { date: formattedDate, type: ledgerType, amount, affectsSavings }];

    // সদস্যের ডকুমেন্ট আপডেট
    if (docId && window.updateMemberInFirestore) {
        const memberUpdate = { ledger: updatedLedger };
        if(type === 'deposit' || type === 'withdraw') memberUpdate.savings = newSavings;
        await window.updateMemberInFirestore(docId, memberUpdate);
    }

    // summary ক্যাশ আপডেট
    // 🔧 FIX: atomic increment() (delta)
    const txnTypeMap = {deposit:'deposit', withdraw:'withdraw', admission:'admission', fine:'fine'};
    const lastTxn = buildLastTxn(txnTypeMap[type] || 'other', member.name, amount, '', member.phone);
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ cashInHand: _somityDelta(cashChange) }, lastTxn);
    }
    notifyEntryMaker(lastTxn);
    closeTxnModal();
    // WhatsApp মেসেজ পাঠানোর অপশন (ফোন নম্বর থাকলে)
    if (member.phone && ['deposit','withdraw','admission','fine'].includes(type)) {
        showWhatsAppSuccessDialog(member.name, member.phone, type, amount, formattedDate);
    }
}function openLedgerModal(index) {
    const member = appState.members[index]; document.getElementById('ledger-title').innerText = `${member.name} এর লেজার হিস্ট্রি`;
    const isAdmin = (window.isAdminVerified());
    const tbody = document.getElementById('ledger-table-body'); const emptyMsg = document.getElementById('ledger-empty-msg'); tbody.innerHTML = "";
    if(!member.ledger || member.ledger.length === 0) { emptyMsg.classList.remove('hidden'); } else {
        emptyMsg.classList.add('hidden');
        for(let i = member.ledger.length - 1; i >= 0; i--) {
            const entry = member.ledger[i]; let typeColor = 'text-emerald-600 bg-emerald-50';
            if(entry.type === 'উত্তোলন') typeColor = 'text-rose-600 bg-rose-50'; else if(entry.type === 'ভর্তি ফি') typeColor = 'text-amber-600 bg-amber-50'; else if(entry.type === 'জরিমানা') typeColor = 'text-purple-600 bg-purple-50';
            const actionCell = isAdmin
                ? `<td class="p-1 text-center whitespace-nowrap">
                       <div style="display:flex;gap:6px;justify-content:center;align-items:center;">
                           <button onclick="editLedgerEntry(${index}, ${i})" title="সম্পাদনা করুন"
                               style="width:34px;height:34px;border-radius:9px;background:#dbeafe;color:#1d4ed8;border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                               <i class="fa-solid fa-pen"></i>
                           </button>
                           <button onclick="deleteLedgerEntry(${index}, ${i})" title="মুছে ফেলুন"
                               style="width:34px;height:34px;border-radius:9px;background:#fee2e2;color:#dc2626;border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                               <i class="fa-solid fa-trash"></i>
                           </button>
                       </div>
                   </td>`
                : `<td></td>`;
            tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-2 text-xs text-gray-600">${entry.date}</td><td class="p-2 text-center"><span class="px-2 py-0 rounded text-xs font-bold ${typeColor}">${entry.type}</span></td><td class="p-2 text-right font-bold text-slate-700">৳ ${Number(entry.amount).toLocaleString()}</td>${actionCell}</tr>`;
        }
    }
    document.getElementById('ledger-modal').classList.remove('hidden'); document.getElementById('ledger-modal').classList.add('flex');
    document.getElementById('ledger-modal').dataset.memberIndex = index;
}
function closeLedgerModal() { document.getElementById('ledger-modal').classList.add('hidden'); }

function openBankLedgerModal() {
    const isAdmin = (window.isAdminVerified());
    const tbody = document.getElementById('bank-ledger-table-body'); const emptyMsg = document.getElementById('bank-ledger-empty-msg'); tbody.innerHTML = "";
    if(!appState.bankLedger || appState.bankLedger.length === 0) { emptyMsg.classList.remove('hidden'); } else {
        emptyMsg.classList.add('hidden');
        for(let i = appState.bankLedger.length - 1; i >= 0; i--) {
            const entry = appState.bankLedger[i]; let typeColor = entry.type === 'ব্যাংক উত্তোলন' ? 'text-slate-600 bg-slate-100' : 'text-indigo-600 bg-indigo-50';
            const actionCell = isAdmin
                ? `<td class="p-2 text-center space-x-1 whitespace-nowrap"><button onclick="editBankLedgerItem(${i})" class="text-blue-600 hover:text-blue-800 font-bold px-1 cursor-pointer"><i class="fa-solid fa-pen"></i></button><button onclick="deleteBankLedgerItem(${i})" class="text-red-600 hover:text-red-700 font-bold px-1 cursor-pointer"><i class="fa-solid fa-trash"></i></button></td>`
                : `<td></td>`;
            tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50 text-xs"><td class="p-2 text-gray-600">${entry.date}</td><td class="p-2 text-slate-700 font-medium text-center">${entry.purpose}</td><td class="p-2 text-center text-slate-500">${entry.note || "-"}</td><td class="p-2 text-center"><span class="px-1 py-0 rounded text-xs font-bold ${typeColor}">${entry.type}</span></td><td class="p-2 text-right font-bold text-slate-700">৳ ${Number(entry.amount).toLocaleString()}</td>${actionCell}</tr>`;
        }
    }
    // ── "আরও দেখুন" বাটন (পুরনো লেনদেন startAfter() দিয়ে লোড করো) ──
    if (_hasMoreTxns) {
        tbody.innerHTML += `<tr><td colspan="6" class="p-2 text-center">
            <button onclick="loadMoreTransactions()" ${_isLoadingMoreTxns ? 'disabled' : ''} class="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl px-4 py-2 cursor-pointer">
                ${_isLoadingMoreTxns ? 'লোড হচ্ছে...' : 'আরও দেখুন'}
            </button>
        </td></tr>`;
    }
    document.getElementById('bank-ledger-modal').classList.remove('hidden'); document.getElementById('bank-ledger-modal').classList.add('flex');
    if (window._pushModalHistory) window._pushModalHistory(() => closeBankLedgerModal());
}
function closeBankLedgerModal() { if (window._popModalHistory) window._popModalHistory(); document.getElementById('bank-ledger-modal').classList.add('hidden'); }
// ⚡ ব্যাংক লেজার আইটেম মুছুন — Sub-collection থেকে
async function deleteBankLedgerItem(index) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন ব্যাংক রেকর্ড মুছতে পারবেন।'); return; }
    if(!(await window.showConfirm("আপনি কি এই ব্যাংক রেকর্ডটি মুছতে চান?", {icon:'🗑️'}))) return;
    const item = appState.bankLedger[index];
    const docId = item._docId;
    let balChange = 0, cashChange = 0;
    if(item.type === 'ব্যাংকে জমা') { balChange = -item.amount; cashChange = item.amount; }
    else if(item.type === 'ব্যাংক উত্তোলন') { balChange = item.amount; cashChange = -item.amount; }

    if (docId && window.deleteTransactionFromFirestore) {
        await window.deleteTransactionFromFirestore(docId);
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({
            bankBalance: _somityDelta(balChange),
            cashInHand:  _somityDelta(cashChange)
        });
    }
    openBankLedgerModal();
}

// ⚡ ব্যাংক লেজার আইটেম এডিট — Sub-collection আপডেট
async function editBankLedgerItem(index) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন ব্যাংক রেকর্ড এডিট করতে পারবেন।'); return; }
    const item = appState.bankLedger[index];
    const docId = item._docId;
    const newAmount = await window.showPrompt(`নতুন পরিমাণ লিখুন (${item.purpose}):`, item.amount, {type:'number', icon:'✏️'});
    if(newAmount === null) return;
    const amt = Number(newAmount);
    if(isNaN(amt) || amt <= 0) { window.showAlert("সঠিক পরিমাণ দিন!"); return; }

    let balOld = 0, cashOld = 0, balNew = 0, cashNew = 0;
    if(item.type === 'ব্যাংকে জমা') { balOld = -item.amount; cashOld = item.amount; balNew = amt; cashNew = -amt; }
    else if(item.type === 'ব্যাংক উত্তোলন') { balOld = item.amount; cashOld = -item.amount; balNew = -amt; cashNew = amt; }

    if (docId && window.updateTransactionInFirestore) {
        await window.updateTransactionInFirestore(docId, { amount: amt });
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({
            bankBalance: _somityDelta(balOld + balNew),
            cashInHand:  _somityDelta(cashOld + cashNew)
        });
    }
    openBankLedgerModal();
}

function openExpenseLedgerModal() {
    const isAdmin = (window.isAdminVerified());
    const tbody = document.getElementById('expense-ledger-table-body'); const emptyMsg = document.getElementById('expense-ledger-empty-msg'); tbody.innerHTML = "";
    if(!appState.expenseLedger || appState.expenseLedger.length === 0) { emptyMsg.classList.remove('hidden'); } else {
        emptyMsg.classList.add('hidden');
        for(let i = appState.expenseLedger.length - 1; i >= 0; i--) {
            const entry = appState.expenseLedger[i];
            const actionCell = isAdmin
                ? `<td class="p-2 text-center space-x-1 whitespace-nowrap"><button onclick="editExpenseLedgerItem(${i})" class="text-blue-600 hover:text-blue-800 font-bold px-1 cursor-pointer"><i class="fa-solid fa-pen"></i></button><button onclick="deleteExpenseLedgerItem(${i})" class="text-red-600 hover:text-red-700 font-bold px-1 cursor-pointer"><i class="fa-solid fa-trash"></i></button></td>`
                : `<td></td>`;
            tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50 text-xs"><td class="p-2 text-gray-600">${entry.date}</td><td class="p-2 text-slate-700 text-center font-medium">${entry.purpose}</td><td class="p-2 text-right font-bold text-rose-600">৳ ${Number(entry.amount).toLocaleString()}</td>${actionCell}</tr>`;
        }
    }
    document.getElementById('expense-ledger-modal').classList.remove('hidden'); document.getElementById('expense-ledger-modal').classList.add('flex');
    if (window._pushModalHistory) window._pushModalHistory(() => closeExpenseLedgerModal());
}
function closeExpenseLedgerModal() { if (window._popModalHistory) window._popModalHistory(); document.getElementById('expense-ledger-modal').classList.add('hidden'); }
// ⚡ খরচ লেজার আইটেম মুছুন — Sub-collection থেকে
async function deleteExpenseLedgerItem(index) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন খরচের রেকর্ড মুছতে পারবেন।'); return; }
    if(!(await window.showConfirm("আপনি কি এই খরচের রেকর্ডটি মুছতে চান?", {icon:'🗑️'}))) return;
    const item = appState.expenseLedger[index];
    const docId = item._docId;
    if (docId && window.deleteExpenseFromFirestore) {
        await window.deleteExpenseFromFirestore(docId);
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({
            totalExpenses: _somityDelta(-item.amount),
            cashInHand:    _somityDelta(item.amount)
        });
    }
    openExpenseLedgerModal();
}

// ⚡ খরচ লেজার আইটেম এডিট — Sub-collection আপডেট
async function editExpenseLedgerItem(index) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন খরচের রেকর্ড এডিট করতে পারবেন।'); return; }
    const item = appState.expenseLedger[index];
    const docId = item._docId;
    const newAmount = await window.showPrompt(`নতুন খরচের টাকা লিখুন (${item.purpose}):`, item.amount, {type:'number', icon:'✏️'});
    if(newAmount === null) return;
    const amt = Number(newAmount);
    if(isNaN(amt) || amt <= 0) { window.showAlert("সঠিক পরিমাণ দিন!"); return; }
    const diff = amt - item.amount;
    if (docId && window.updateExpenseInFirestore) {
        await window.updateExpenseInFirestore(docId, { amount: amt });
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({
            totalExpenses: _somityDelta(diff),
            cashInHand:    _somityDelta(-diff)
        });
    }
    openExpenseLedgerModal();
}

function openMonthlyReportModal() {
    const select = document.getElementById('report-month-select'); select.innerHTML = ""; let monthsSet = new Set(); monthsSet.add(new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    appState.members.forEach(m => { if(m.ledger) { m.ledger.forEach(entry => { if(entry.type === 'জমা') monthsSet.add(getMonthYearKey(entry.date)); }); } });
    Array.from(monthsSet).forEach(mKey => { let display = mKey.replace('January', 'জানুয়ারি').replace('February', 'ফেব্রুয়ারি').replace('March', 'মার্চ').replace('April', 'এপ্রিল').replace('May', 'মে').replace('June', 'জুন').replace('July', 'জুলাই').replace('August', 'আগস্ট').replace('September', 'সেপ্টেম্বর').replace('October', 'অক্টোবর').replace('November', 'নভেম্বর').replace('December', 'ডিসেম্বর').replace(/2/g, '২').replace(/0/g, '০').replace(/1/g, '১').replace(/6/g, '৬').replace(/3/g, '৩').replace(/4/g, '৪').replace(/5/g, '৫').replace(/7/g, '৭').replace(/8/g, '৮').replace(/9/g, '৯'); select.innerHTML += `<option value="${mKey}">${display}</option>`; });
    generateMonthlyReport(); document.getElementById('monthly-report-modal').classList.remove('hidden'); document.getElementById('monthly-report-modal').classList.add('flex');
}
function closeMonthlyReportModal() { document.getElementById('monthly-report-modal').classList.add('hidden'); }
function generateMonthlyReport() {
    const selectedMonth = document.getElementById('report-month-select').value; const selectElem = document.getElementById('report-month-select'); const selectedText = selectElem.options[selectElem.selectedIndex] ? selectElem.options[selectElem.selectedIndex].text : "";
    document.getElementById('print-report-month-title').innerText = "মাস: " + selectedText; const tbody = document.getElementById('monthly-report-table-body'); const emptyMsg = document.getElementById('monthly-report-empty-msg'); const totalSpan = document.getElementById('monthly-report-total'); tbody.innerHTML = "";
    let grandTotal = 0; let hasData = false;
    appState.members.forEach(m => {
        let monthlySum = 0;
        if(m.ledger) { m.ledger.forEach(entry => { if(entry.type === 'জমা' && getMonthYearKey(entry.date) === selectedMonth) monthlySum += Number(entry.amount); }); }
        if(monthlySum > 0) { hasData = true; grandTotal += monthlySum; tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-2 font-mono font-bold text-slate-600">${m.id}</td><td class="p-2 font-bold text-slate-800">${m.name}</td><td class="p-2 text-right font-bold text-blue-600">৳ ${monthlySum.toLocaleString()}</td></tr>`; }
    });
    totalSpan.innerText = "৳ " + grandTotal.toLocaleString(); if(hasData) emptyMsg.classList.add('hidden'); else emptyMsg.classList.remove('hidden');
}

function openExportModal() { document.getElementById('export-format-modal').classList.remove('hidden'); document.getElementById('export-format-modal').classList.add('flex'); }
function closeExportModal() { document.getElementById('export-format-modal').classList.add('hidden'); document.getElementById('export-format-modal').classList.remove('flex'); }
function showLoadingSpinner() { document.getElementById('loading-spinner').classList.remove('hidden'); }
function hideLoadingSpinner() { document.getElementById('loading-spinner').classList.add('hidden'); }

function downloadReportPDF() {
    closeExportModal();

    var selectElem = document.getElementById('report-month-select');
    if (!selectElem || selectElem.options.length === 0) { window.showAlert("কোনো মাস নির্বাচন করা নেই!"); return; }
    var selectedText = selectElem.options[selectElem.selectedIndex] ? selectElem.options[selectElem.selectedIndex].text : "";

    var tbody = document.getElementById('monthly-report-table-body');
    var totalText = document.getElementById('monthly-report-total').innerText;
    if (!tbody || tbody.querySelectorAll('tr').length === 0) { window.showAlert("এই মাসে কোনো ডেটা নেই!"); return; }

    var somityName = (appState && appState.somityName) ? appState.somityName : (window.currentSomityName || 'Somity Manager');
    var somityCode = (appState && appState.somityCode) ? appState.somityCode : (window.currentSomityCode || '');
    var today = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    // ডেটা টেবিলের সারি তৈরি
    var rowsHtml = '';
    tbody.querySelectorAll('tr').forEach(function(row, i) {
        var cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
            var bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
            rowsHtml += '<tr style="background:' + bg + ';">'
                + '<td style="padding:8px 10px;font-weight:700;color:#475569;text-align:center;">' + (cells[0].innerText || '') + '</td>'
                + '<td style="padding:8px 10px;font-weight:600;color:#1e293b;">' + (cells[1].innerText || '') + '</td>'
                + '<td style="padding:8px 10px;font-weight:700;color:#2563eb;text-align:right;">' + (cells[2].innerText || '') + '</td>'
                + '</tr>';
        }
    });

    var printHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Hind Siliguri', sans-serif; background:#fff; color:#1e293b; }
        .header { background:linear-gradient(135deg,#059669,#047857); color:#fff; padding:22px 24px 18px; text-align:center; }
        .header h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .header p  { font-size:11px; opacity:0.85; margin-bottom:2px; }
        .header h2 { font-size:14px; font-weight:600; margin-top:6px; opacity:0.95; }
        .subheader { background:#f0fdf4; border-bottom:1.5px solid #a7f3d0; padding:8px 24px;
                     display:flex; justify-content:space-between; font-size:11px; color:#059669; font-weight:600; }
        .table-wrap { padding:16px 20px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        thead tr { background:#1e40af; color:#fff; }
        thead th { padding:9px 10px; font-weight:700; text-align:left; }
        thead th:last-child { text-align:right; }
        thead th:first-child { text-align:center; }
        tbody tr { border-bottom:1px solid #e2e8f0; }
        .total-box { margin:4px 20px 16px; background:#eff6ff; border:1.5px solid #3b82f6;
                     border-radius:8px; padding:10px 16px; display:flex; justify-content:space-between;
                     font-size:14px; font-weight:700; color:#1d4ed8; }
        .footer { border-top:1px solid #cbd5e1; margin:0 20px; padding:14px 0 8px;
                  display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#64748b; }
        .sig-line { border-top:1.5px solid #94a3b8; width:140px; padding-top:4px; text-align:center; }
        .gen-info { text-align:center; font-size:9px; color:#94a3b8; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:0; }
        }
    </style></head><body>
    <div class="header">
        <h1>${somityName}</h1>
        ${somityCode ? '<p>সমিতি কোড: ' + somityCode + '</p>' : ''}
        <h2>📊 মাসিক সঞ্চয় রিপোর্ট</h2>
    </div>
    <div class="subheader">
        <span>📅 মাস: ${selectedText}</span>
        <span>তারিখ: ${today}</span>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr>
                <th style="width:80px;">সদস্য আইডি</th>
                <th>সদস্যের নাম</th>
                <th style="width:100px;text-align:right;">সঞ্চয়</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>
    <div class="total-box">
        <span>💰 মোট সংগ্রহ:</span>
        <span>${totalText}</span>
    </div>
    <div class="footer">
        <div class="sig-line">ম্যানেজারের স্বাক্ষর</div>
        <div class="gen-info">Generated by Somity Manager | ${today}</div>
        <div class="sig-line">তারিখ ও সিল</div>
    </div>
    </body></html>`;

    var printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.onload = function() {
        printWin.focus();
        printWin.print();
    };
}


function downloadReportCSV() {
    const selectElem = document.getElementById('report-month-select'); 
    const selectedText = selectElem.options[selectElem.selectedIndex] ? selectElem.options[selectElem.selectedIndex].text : "Report";
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; csvContent += "সদস্য আইডি,সদস্যের নাম,এই মাসের সঞ্চয়\n";
    let grandTotal = 0;
    appState.members.forEach(m => {
        let monthlySum = 0;
        if(m.ledger) { m.ledger.forEach(entry => { if(entry.type === 'জমা' && getMonthYearKey(entry.date) === selectElem.value) { monthlySum += Number(entry.amount); } }); }
        if(monthlySum > 0) { grandTotal += monthlySum; let safeName = m.name.replace(/,/g, " "); csvContent += `${m.id},${safeName},${monthlySum}\n`; }
    });
    csvContent += `,,মোট: ${grandTotal}\n`;
    const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Transactions_Report_${selectedText}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); closeExportModal();
}

function shareReportData() {
    const selectElem = document.getElementById('report-month-select'); const selectedText = selectElem.options[selectElem.selectedIndex] ? selectElem.options[selectElem.selectedIndex].text : "";
    let shareText = `📊 *মাসিক সঞ্চয় রিপোর্ট (${selectedText})*\n\n`; let hasData = false;
    appState.members.forEach(m => { let monthlySum = 0; if(m.ledger) { m.ledger.forEach(entry => { if(entry.type === 'জমা' && getMonthYearKey(entry.date) === selectElem.value) monthlySum += Number(entry.amount); }); }
        if(monthlySum > 0) { hasData = true; shareText += `🆔 আইডি: ${m.id}\n👤 নাম: ${m.name}\n💰 সঞ্চয়: ৳ ${monthlySum.toLocaleString()}\n------------------------\n`; } });
    shareText += `\n*মোট সংগ্রহ:* ${document.getElementById('monthly-report-total').innerText}`;
    if(!hasData) { window.showAlert("শেয়ার করার মতো কোনো ডাটা এই মাসে নেই!"); return; }
    if(navigator.share) { navigator.share({ title: 'মাসিক সঞ্চয় রিপোর্ট', text: shareText }).catch(() => {}); } else { navigator.clipboard.writeText(shareText).then(() => { window.showAlert("রিপোর্ট কপি হয়েছে! এখন পেস্ট করে শেয়ার করুন।"); }); }
}


// ===== সদস্য তালিকা PDF ডাউনলোড (window.print — বাংলা সম্পূর্ণ সাপোর্ট) =====
function downloadMemberListPDF() {
    if (!appState.members || appState.members.length === 0) {
        window.showAlert('কোনো সদস্য নেই!');
        return;
    }

    var somityName = (appState && appState.somityName) ? appState.somityName : (window.currentSomityName || 'Somity Manager');
    var somityCode = (appState && appState.somityCode) ? appState.somityCode : (window.currentSomityCode || '');
    var today = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    var totalSavings = 0;
    var rowsHtml = '';
    appState.members.forEach(function(m, i) {
        totalSavings += Number(m.savings || 0);
        var bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        rowsHtml += '<tr style="background:' + bg + ';">'
            + '<td style="padding:7px 8px;text-align:center;color:#64748b;font-size:11px;">' + (i + 1) + '</td>'
            + '<td style="padding:7px 8px;text-align:center;font-weight:700;color:#1e40af;">' + (m.id || '-') + '</td>'
            + '<td style="padding:7px 8px;font-weight:600;color:#1e293b;">' + (m.name || '-') + '</td>'
            + '<td style="padding:7px 8px;text-align:center;color:#475569;">' + (m.phone || '-') + '</td>'
            + '<td style="padding:7px 8px;color:#475569;">' + (m.address || '-') + '</td>'
            + '<td style="padding:7px 8px;text-align:right;font-weight:700;color:#2563eb;">৳ ' + Number(m.savings || 0).toLocaleString('bn-BD') + '</td>'
            + '</tr>';
    });

    var printHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Hind Siliguri', sans-serif; background:#fff; color:#1e293b; }
        .header { background:linear-gradient(135deg,#059669,#047857); color:#fff; padding:22px 24px 18px; text-align:center; }
        .header h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .header p  { font-size:11px; opacity:0.85; margin-bottom:2px; }
        .header h2 { font-size:14px; font-weight:600; margin-top:6px; opacity:0.95; }
        .subheader { background:#f0fdf4; border-bottom:1.5px solid #a7f3d0; padding:8px 24px;
                     display:flex; justify-content:space-between; font-size:11px; color:#059669; font-weight:600; }
        .table-wrap { padding:14px 16px; }
        table { width:100%; border-collapse:collapse; font-size:11.5px; }
        thead tr { background:#1e40af; color:#fff; }
        thead th { padding:9px 8px; font-weight:700; text-align:left; }
        thead th:first-child, thead th:nth-child(2) { text-align:center; }
        thead th:last-child { text-align:right; }
        tbody tr { border-bottom:1px solid #e2e8f0; }
        .total-box { margin:4px 16px 14px; background:#eff6ff; border:1.5px solid #3b82f6;
                     border-radius:8px; padding:10px 16px; display:flex; justify-content:space-between;
                     font-size:14px; font-weight:700; color:#1d4ed8; }
        .footer { border-top:1px solid #cbd5e1; margin:0 16px; padding:12px 0 8px;
                  display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#64748b; }
        .sig-line { border-top:1.5px solid #94a3b8; width:140px; padding-top:4px; text-align:center; }
        .gen-info { text-align:center; font-size:9px; color:#94a3b8; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:0; }
        }
    </style></head><body>
    <div class="header">
        <h1>${somityName}</h1>
        ${somityCode ? '<p>সমিতি কোড: ' + somityCode + '</p>' : ''}
        <h2>👥 সদস্য তালিকা</h2>
    </div>
    <div class="subheader">
        <span>মোট সদস্য: ${appState.members.length} জন</span>
        <span>তারিখ: ${today}</span>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr>
                <th style="width:32px;">#</th>
                <th style="width:60px;">আইডি</th>
                <th>নাম</th>
                <th style="width:110px;">মোবাইল</th>
                <th style="width:130px;">ঠিকানা</th>
                <th style="width:90px;text-align:right;">সঞ্চয়</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>
    <div class="total-box">
        <span>💰 মোট সঞ্চয়:</span>
        <span>৳ ${totalSavings.toLocaleString('bn-BD')}</span>
    </div>
    <div class="footer">
        <div class="sig-line">ম্যানেজারের স্বাক্ষর</div>
        <div class="gen-info">Generated by Somity Manager | ${today}</div>
        <div class="sig-line">তারিখ ও সিল</div>
    </div>
    </body></html>`;

    var printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.onload = function() {
        printWin.focus();
        printWin.print();
    };
}

// ===== ব্যাংক লেজার PDF ডাউনলোড (window.print — বাংলা সম্পূর্ণ সাপোর্ট) =====
function downloadBankLedgerPDF() {
    var txns = appState.bankLedger || [];
    if (!txns.length) { window.showAlert('কোনো ব্যাংক লেনদেন নেই!'); return; }

    var somityName = (appState && appState.somityName) ? appState.somityName : (window.currentSomityName || 'Somity Manager');
    var somityCode = (appState && appState.somityCode) ? appState.somityCode : (window.currentSomityCode || '');
    var today = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    var rowsHtml = '';
    // সর্বশেষ লেনদেন উপরে (উল্টো ক্রম)
    for (var i = txns.length - 1; i >= 0; i--) {
        var t = txns[i];
        var bg = (txns.length - 1 - i) % 2 === 0 ? '#f8fafc' : '#ffffff';
        var typeColor = (t.type || '').includes('উত্তোলন') ? '#dc2626' : '#4f46e5';
        var typeBg   = (t.type || '').includes('উত্তোলন') ? '#fef2f2' : '#eef2ff';
        rowsHtml += '<tr style="background:' + bg + ';">'
            + '<td style="padding:7px 10px;color:#475569;font-size:11px;">' + (t.date || '-') + '</td>'
            + '<td style="padding:7px 10px;font-weight:600;color:#1e293b;">' + (t.purpose || '-') + '</td>'
            + '<td style="padding:7px 10px;color:#475569;">' + (t.note || '-') + '</td>'
            + '<td style="padding:7px 10px;text-align:center;"><span style="background:' + typeBg + ';color:' + typeColor + ';padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">' + (t.type || '-') + '</span></td>'
            + '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#1d4ed8;">৳ ' + Number(t.amount || 0).toLocaleString('bn-BD') + '</td>'
            + '</tr>';
    }

    var printHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Hind Siliguri', sans-serif; background:#fff; color:#1e293b; }
        .header { background:linear-gradient(135deg,#4f46e5,#3730a3); color:#fff; padding:22px 24px 18px; text-align:center; }
        .header h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .header p  { font-size:11px; opacity:0.85; margin-bottom:2px; }
        .header h2 { font-size:14px; font-weight:600; margin-top:6px; opacity:0.95; }
        .subheader { background:#eef2ff; border-bottom:1.5px solid #c7d2fe; padding:8px 24px;
                     display:flex; justify-content:space-between; font-size:11px; color:#4f46e5; font-weight:600; }
        .table-wrap { padding:14px 16px; }
        table { width:100%; border-collapse:collapse; font-size:11.5px; }
        thead tr { background:#4f46e5; color:#fff; }
        thead th { padding:9px 10px; font-weight:700; text-align:left; }
        thead th:last-child { text-align:right; }
        tbody tr { border-bottom:1px solid #e2e8f0; }
        .footer { border-top:1px solid #cbd5e1; margin:12px 16px 0; padding:12px 0 8px;
                  display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#64748b; }
        .sig-line { border-top:1.5px solid #94a3b8; width:140px; padding-top:4px; text-align:center; }
        .gen-info { text-align:center; font-size:9px; color:#94a3b8; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:0; }
        }
    </style></head><body>
    <div class="header">
        <h1>${somityName}</h1>
        ${somityCode ? '<p>সমিতি কোড: ' + somityCode + '</p>' : ''}
        <h2>🏦 ব্যাংক লেনদেন লেজার</h2>
    </div>
    <div class="subheader">
        <span>মোট এন্ট্রি: ${txns.length} টি</span>
        <span>তারিখ: ${today}</span>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr>
                <th style="width:110px;">তারিখ</th>
                <th>উদ্দেশ্য</th>
                <th style="width:100px;">নোট</th>
                <th style="width:110px;text-align:center;">ধরন</th>
                <th style="width:90px;text-align:right;">পরিমাণ</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>
    <div class="footer">
        <div class="sig-line">ম্যানেজারের স্বাক্ষর</div>
        <div class="gen-info">Generated by Somity Manager | ${today}</div>
        <div class="sig-line">তারিখ ও সিল</div>
    </div>
    </body></html>`;

    var printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.onload = function() {
        printWin.focus();
        printWin.print();
    };
}

// ===== খরচ লেজার PDF ডাউনলোড (window.print — বাংলা সম্পূর্ণ সাপোর্ট) =====
function downloadExpenseLedgerPDF() {
    var expenses = appState.expenseLedger || [];
    if (!expenses.length) { window.showAlert('কোনো খরচের রেকর্ড নেই!'); return; }

    var somityName = (appState && appState.somityName) ? appState.somityName : (window.currentSomityName || 'Somity Manager');
    var somityCode = (appState && appState.somityCode) ? appState.somityCode : (window.currentSomityCode || '');
    var today = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    var totalExp = 0;
    var rowsHtml = '';
    // সর্বশেষ খরচ উপরে
    for (var i = expenses.length - 1; i >= 0; i--) {
        var e = expenses[i];
        totalExp += Number(e.amount || 0);
        var bg = (expenses.length - 1 - i) % 2 === 0 ? '#fff9f9' : '#ffffff';
        rowsHtml += '<tr style="background:' + bg + ';">'
            + '<td style="padding:8px 10px;color:#475569;font-size:11px;">' + (e.date || '-') + '</td>'
            + '<td style="padding:8px 10px;font-weight:600;color:#1e293b;">' + (e.purpose || '-') + '</td>'
            + '<td style="padding:8px 10px;text-align:right;font-weight:700;color:#be123c;">৳ ' + Number(e.amount || 0).toLocaleString('bn-BD') + '</td>'
            + '</tr>';
    }

    var printHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Hind Siliguri', sans-serif; background:#fff; color:#1e293b; }
        .header { background:linear-gradient(135deg,#dc2626,#b91c1c); color:#fff; padding:22px 24px 18px; text-align:center; }
        .header h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .header p  { font-size:11px; opacity:0.85; margin-bottom:2px; }
        .header h2 { font-size:14px; font-weight:600; margin-top:6px; opacity:0.95; }
        .subheader { background:#fff1f2; border-bottom:1.5px solid #fecaca; padding:8px 24px;
                     display:flex; justify-content:space-between; font-size:11px; color:#dc2626; font-weight:600; }
        .table-wrap { padding:14px 20px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        thead tr { background:#dc2626; color:#fff; }
        thead th { padding:9px 10px; font-weight:700; text-align:left; }
        thead th:last-child { text-align:right; }
        tbody tr { border-bottom:1px solid #fee2e2; }
        .total-box { margin:4px 20px 14px; background:#fff1f2; border:1.5px solid #f87171;
                     border-radius:8px; padding:10px 16px; display:flex; justify-content:space-between;
                     font-size:14px; font-weight:700; color:#be123c; }
        .footer { border-top:1px solid #cbd5e1; margin:0 20px; padding:12px 0 8px;
                  display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#64748b; }
        .sig-line { border-top:1.5px solid #94a3b8; width:140px; padding-top:4px; text-align:center; }
        .gen-info { text-align:center; font-size:9px; color:#94a3b8; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:0; }
        }
    </style></head><body>
    <div class="header">
        <h1>${somityName}</h1>
        ${somityCode ? '<p>সমিতি কোড: ' + somityCode + '</p>' : ''}
        <h2>💸 খরচ লেজার</h2>
    </div>
    <div class="subheader">
        <span>মোট এন্ট্রি: ${expenses.length} টি</span>
        <span>তারিখ: ${today}</span>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr>
                <th style="width:120px;">তারিখ</th>
                <th>বিবরণ</th>
                <th style="width:100px;text-align:right;">পরিমাণ</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>
    <div class="total-box">
        <span>💸 মোট খরচ:</span>
        <span>৳ ${totalExp.toLocaleString('bn-BD')}</span>
    </div>
    <div class="footer">
        <div class="sig-line">ম্যানেজারের স্বাক্ষর</div>
        <div class="gen-info">Generated by Somity Manager | ${today}</div>
        <div class="sig-line">তারিখ ও সিল</div>
    </div>
    </body></html>`;

    var printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.onload = function() {
        printWin.focus();
        printWin.print();
    };
}

// 🌱 বিনিয়োগের লেজার PDF
function downloadInvestmentLedgerPDF() {
    var investments = (appState.investments || []).slice().sort((a,b) => (b._sortTime||0) - (a._sortTime||0));
    if (!investments.length) { window.showAlert('কোনো বিনিয়োগের রেকর্ড নেই!'); return; }

    var somityName = (appState && appState.somityName) ? appState.somityName : (window.currentSomityName || 'Somity Manager');
    var somityCode = (appState && appState.somityCode) ? appState.somityCode : (window.currentSomityCode || '');
    var today = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    var totalAmount = 0, totalRemaining = 0, totalProfit = 0;
    var rowsHtml = '';
    investments.forEach(function(inv, idx) {
        var amount = Number(inv.amount) || 0;
        var remaining = inv.remainingPrincipal !== undefined ? Number(inv.remainingPrincipal) : amount;
        var profit = Number(inv.profitBalance) || 0;
        totalAmount += amount; totalRemaining += remaining; totalProfit += profit;
        var statusText = inv.status === 'closed' ? 'সম্পন্ন' : 'চলমান';
        var plColor = profit > 0 ? '#059669' : (profit < 0 ? '#dc2626' : '#475569');
        var bg = idx % 2 === 0 ? '#f0fdfa' : '#ffffff';
        rowsHtml += '<tr style="background:' + bg + ';">'
            + '<td style="padding:8px 10px;font-weight:600;color:#1e293b;">' + (inv.title || '-') + '</td>'
            + '<td style="padding:8px 10px;color:#475569;font-size:11px;">' + (inv.date || '-') + '</td>'
            + '<td style="padding:8px 10px;text-align:right;color:#1e293b;">৳ ' + amount.toLocaleString('bn-BD') + '</td>'
            + '<td style="padding:8px 10px;text-align:right;color:#1e293b;">৳ ' + remaining.toLocaleString('bn-BD') + '</td>'
            + '<td style="padding:8px 10px;text-align:right;font-weight:700;color:' + plColor + ';">৳ ' + profit.toLocaleString('bn-BD') + '</td>'
            + '<td style="padding:8px 10px;text-align:center;font-size:10px;color:#64748b;">' + statusText + '</td>'
            + '</tr>';
    });

    var pool = Number(appState.distributableProfitPool) || 0;
    var totalDistributed = Number(appState.totalProfitDistributed) || 0;

    var printHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Hind Siliguri', sans-serif; background:#fff; color:#1e293b; }
        .header { background:linear-gradient(135deg,#0f766e,#0d9488); color:#fff; padding:22px 24px 18px; text-align:center; }
        .header h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .header p  { font-size:11px; opacity:0.85; margin-bottom:2px; }
        .header h2 { font-size:14px; font-weight:600; margin-top:6px; opacity:0.95; }
        .subheader { background:#f0fdfa; border-bottom:1.5px solid #99f6e4; padding:8px 24px;
                     display:flex; justify-content:space-between; font-size:11px; color:#0f766e; font-weight:600; }
        .table-wrap { padding:14px 20px; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        thead tr { background:#0f766e; color:#fff; }
        thead th { padding:9px 10px; font-weight:700; text-align:left; }
        thead th:nth-child(3), thead th:nth-child(4), thead th:nth-child(5) { text-align:right; }
        thead th:last-child { text-align:center; }
        tbody tr { border-bottom:1px solid #ccfbf1; }
        .totals { margin:4px 20px 14px; background:#f0fdfa; border:1.5px solid #5eead4;
                  border-radius:10px; padding:12px 16px; display:grid; grid-template-columns:1fr 1fr; gap:6px 18px;
                  font-size:12px; font-weight:700; color:#0f766e; }
        .totals .row { display:flex; justify-content:space-between; }
        .footer { border-top:1px solid #cbd5e1; margin:0 20px; padding:12px 0 8px;
                  display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#64748b; }
        .sig-line { border-top:1.5px solid #94a3b8; width:140px; padding-top:4px; text-align:center; }
        .gen-info { text-align:center; font-size:9px; color:#94a3b8; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:0; }
        }
    </style></head><body>
    <div class="header">
        <h1>${somityName}</h1>
        ${somityCode ? '<p>সমিতি কোড: ' + somityCode + '</p>' : ''}
        <h2>🌱 বিনিয়োগের লেজার</h2>
    </div>
    <div class="subheader">
        <span>মোট বিনিয়োগ: ${investments.length} টি</span>
        <span>তারিখ: ${today}</span>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr>
                <th>বিবরণ</th>
                <th style="width:90px;">তারিখ</th>
                <th style="width:90px;">মূল বিনিয়োগ</th>
                <th style="width:90px;">অবশিষ্ট মূলধন</th>
                <th style="width:90px;">মুনাফা ব্যালেন্স</th>
                <th style="width:70px;">অবস্থা</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>
    <div class="totals">
        <div class="row"><span>মোট বিনিয়োগ:</span><span>৳ ${totalAmount.toLocaleString('bn-BD')}</span></div>
        <div class="row"><span>মোট অবশিষ্ট মূলধন:</span><span>৳ ${totalRemaining.toLocaleString('bn-BD')}</span></div>
        <div class="row"><span>মোট মুনাফা ব্যালেন্স:</span><span>৳ ${totalProfit.toLocaleString('bn-BD')}</span></div>
        <div class="row"><span>বণ্টনযোগ্য পুলে বাকি:</span><span>৳ ${pool.toLocaleString('bn-BD')}</span></div>
        <div class="row" style="grid-column:1/-1;"><span>এ পর্যন্ত সর্বমোট বণ্টিত মুনাফা:</span><span>৳ ${totalDistributed.toLocaleString('bn-BD')}</span></div>
    </div>
    <div class="footer">
        <div class="sig-line">ম্যানেজারের স্বাক্ষর</div>
        <div class="gen-info">Generated by Somity Manager | ${today}</div>
        <div class="sig-line">তারিখ ও সিল</div>
    </div>
    </body></html>`;

    var printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.onload = function() {
        printWin.focus();
        printWin.print();
    };
}
// jsPDF helvetica ফন্ট বাংলা Unicode সাপোর্ট করে না।
// এই ফাংশন বাংলা স্ট্রিং থেকে Latin-safe টেক্সট তৈরি করে।
function _pdfSafe(str) {
    if (!str) return '';
    // বাংলা ডিজিট → ইংরেজি ডিজিট
    str = str.replace(/[০-৯]/g, function(c) {
        return String.fromCharCode(c.charCodeAt(0) - 0x09E6 + 48);
    });
    // ৳ চিহ্ন → BDT
    str = str.replace(/৳/g, 'BDT ');
    // বাংলা অক্ষর (U+0980–U+09FF) → খালি (শুধু ASCII অংশ রাখা)
    // কিন্তু যদি পুরোটাই বাংলা হয় তাহলে transliterate করব না,
    // বরং যতটুকু ASCII আছে রাখব, বাকি সরিয়ে দেব।
    var ascii = str.replace(/[\u0980-\u09FF]/g, '');
    // যদি ASCII অংশ খুব ছোট হয় (নাম/ঠিকানা পুরো বাংলা) → original রাখো
    // jsPDF এগুলো '?' হিসেবে দেখাবে, কিন্তু crash হবে না
    return ascii.trim() || str;
}

// বাংলা তারিখ → ইংরেজি তারিখ
function _pdfDate() {
    return new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

// সদস্যের নাম/ঠিকানা PDF-এ দেখানোর জন্য: বাংলা থাকলে romanize করার চেষ্টা
// (সিম্পল fallback — বাংলা অক্ষর থাকলে transliteration না করে আইডি দিয়ে চেনাব)
function _pdfName(name) {
    if (!name) return '-';
    // যদি কোনো Latin অক্ষর থাকে তাহলে Latin অংশ রিটার্ন করো
    var latin = name.replace(/[\u0980-\u09FF\s]/g, '').trim();
    if (latin.length >= 2) return latin;
    // পুরোটা বাংলা — Google Transliterate ছাড়া সম্ভব না,
    // তাই নামটা হুবহু রাখি (jsPDF ? দেখাবে) অথবা fallback
    return name; // jsPDF এটা skip/? করবে — নিচে raw unicode দেওয়া হবে
}

// ===== শেয়ার্ড PDF হেডার হেল্পার =====
function _addPDFHeader(doc, pageW, somityName, somityCode, reportTitle) {
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, pageW, 42, 'F');
    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageW, 5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(somityName, pageW / 2, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (somityCode) doc.text('Somity Code: ' + somityCode, pageW / 2, 26, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTitle, pageW / 2, 36, { align: 'center' });
}

// ===== শেয়ার্ড PDF ফুটার হেল্পার (স্বাক্ষর লাইন + পেজ নম্বর) =====
function _addPDFFooter(doc, pageW, pageH, margin, today) {
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        // ফুটার বিভাজক
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 38, pageW - margin, pageH - 38);

        // বাম: ম্যানেজারের স্বাক্ষর
        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.4);
        doc.line(margin, pageH - 20, margin + 52, pageH - 20);
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text("Manager's Signature", margin, pageH - 14);

        // ডান: তারিখ ও মোহর
        doc.line(pageW - margin - 52, pageH - 20, pageW - margin, pageH - 20);
        doc.text("Date & Seal", pageW - margin - 52, pageH - 14);

        // মাঝে: সফটওয়্যারের নাম
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7.5);
        doc.text('Generated by Somity Manager  |  ' + today, pageW / 2, pageH - 14, { align: 'center' });

        // পেজ নম্বর
        doc.text('Page ' + p + ' of ' + totalPages, pageW - margin, pageH - 8, { align: 'right' });
    }
}


// ⚡ নতুন SUB-COLLECTION ভিত্তিক handleBankAction
async function handleBankAction(action) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন ব্যাংক লেনদেন করতে পারবেন।'); return; }
    const amount     = Number(document.getElementById('bank-amount').value);
    const customDate = document.getElementById('bank-date').value;
    const note       = document.getElementById('bank-note').value.trim();

    if(!amount || amount <= 0) { window.showAlert("সঠিক পরিমাণ লিখুন!"); return; }
    const formattedDate = formatActionDate(customDate);

    // 🔧 FIX: এখন absolute নতুন মান না রেখে শুধু ডেল্টা (পরিবর্তনের পরিমাণ) রাখা হচ্ছে,
    // যা নিচে Firestore-এর atomic increment() এ ব্যবহৃত হবে
    let bankDelta, cashDelta, purpose, txnType, ledgerType;

    if(action === 'to_bank') {
        if(amount > (appState.cashInHand || 0)) { window.showAlert("হাতে পর্যাপ্ত ক্যাশ নেই!"); return; }
        bankDelta = amount;
        cashDelta = -amount;
        purpose = "ব্যাংকে জমা"; ledgerType = "ব্যাংকে জমা"; txnType = 'bank_in';
    } else {
        if(amount > (appState.bankBalance || 0)) { window.showAlert("ব্যাংকে পর্যাপ্ত ব্যালেন্স নেই!"); return; }
        bankDelta = -amount;
        cashDelta = amount;
        purpose = "ব্যাংক থেকে উত্তোলন"; ledgerType = "ব্যাংক উত্তোলন"; txnType = 'bank_out';
    }

    // ⚡ transactions সাব-কালেকশনে নতুন ডকুমেন্ট তৈরি
    if (window.addTransactionToFirestore) {
        await window.addTransactionToFirestore({
            category: 'bank',  // bank | other_fund
            date: formattedDate,
            purpose,
            note,
            type: ledgerType,
            amount
        });
    }
    // summary আপডেট
    const lastTxn = buildLastTxn(txnType, '', amount, note || purpose);
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ bankBalance: _somityDelta(bankDelta), cashInHand: _somityDelta(cashDelta) }, lastTxn);
    }
    notifyEntryMaker(lastTxn);

    document.getElementById('bank-amount').value = "";
    document.getElementById('bank-date').value = "";
    document.getElementById('bank-note').value = "";
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক handleExpenseSubmit
async function handleExpenseSubmit() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন খরচ এন্ট্রি করতে পারবেন।'); return; }
    const purpose    = document.getElementById('expense-purpose').value.trim();
    const amount     = Number(document.getElementById('expense-amount').value);
    const customDate = document.getElementById('expense-date').value;

    if(!purpose || !amount || amount <= 0) { window.showAlert("বিবরণ এবং টাকার পরিমাণ সঠিক দিন!"); return; }
    if(amount > (appState.cashInHand || 0)) { window.showAlert("খরচ করার মতো হাতে পর্যাপ্ত ক্যাশ নেই!"); return; }

    const formattedDate = formatActionDate(customDate);

    // ⚡ expenses সাব-কালেকশনে নতুন ডকুমেন্ট তৈরি
    if (window.addExpenseToFirestore) {
        await window.addExpenseToFirestore({ date: formattedDate, purpose, amount });
    }

    // summary আপডেট
    // 🔧 FIX: atomic increment() (delta)
    const lastTxn = buildLastTxn('expense', '', amount, purpose);
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ cashInHand: _somityDelta(-amount), totalExpenses: _somityDelta(amount) }, lastTxn);
    }
    notifyEntryMaker(lastTxn);

    document.getElementById('expense-purpose').value = "";
    document.getElementById('expense-amount').value = "";
    document.getElementById('expense-date').value = "";
}

// ══════════════════════════════════════════════
// 🌱 বিনিয়োগ (Investment) ফিচার — শুধুমাত্র এডমিন
// টাকা আসে ক্যাশ ইন হ্যান্ড থেকে, লাভ-ক্ষতি ট্র্যাক করা হয়
// ══════════════════════════════════════════════

// 🧮 বিনিয়োগের মূল টাকা + সব রিটার্ন এন্ট্রি থেকে সঠিক অবস্থা (রিমেইনিং প্রিন্সিপাল/মুনাফা/মোট রিটার্ন)
// পুনর্গণনা করে — এন্ট্রি এডিট/ডিলিট করলে এটা দিয়েই সঠিক হিসাব বের করা হয় (একবারে সব রিপ্লে করে)
function _investmentComputeFromReturns(amount, returnsList) {
    let remainingPrincipal = Number(amount) || 0;
    let profitBalance = 0;
    let totalReturned = 0;
    let capitalReturned = 0; // 💰 শুধু মূলধন ফেরত (এটাই সরাসরি cashInHand-এ যোগ হবে; মুনাফা অংশ বণ্টনের আগ পর্যন্ত পুলে থাকবে)
    (returnsList || []).forEach(r => {
        const amt = Number(r.amount) || 0;
        if (r.type === 'capital') {
            const capitalAmt = Math.min(amt, remainingPrincipal);
            remainingPrincipal -= capitalAmt;
            totalReturned += capitalAmt;
            capitalReturned += capitalAmt;
        } else if (r.type === 'profit') {
            profitBalance += amt;
            totalReturned += amt;
        } else if (r.type === 'loss') {
            const fromProfit = Math.min(amt, profitBalance);
            profitBalance -= fromProfit;
            const remainingLoss = amt - fromProfit;
            if (remainingLoss > 0) remainingPrincipal = Math.max(0, remainingPrincipal - remainingLoss);
        }
    });
    return {
        remainingPrincipal,
        profitBalance,
        totalReturned,
        capitalReturned,
        status: remainingPrincipal <= 0 ? 'closed' : 'active'
    };
}

window.addInvestmentToFirestore = async function(data) {
    if (!window.currentSomityId) return null;
    try {
        const { serverTimestamp: sts } = window._firebaseFns;
        const payload = Object.assign({}, data, {
            remainingPrincipal: Number(data.amount) || 0, // 💰 অবশিষ্ট মূলধন — শুরুতে পুরো amount
            profitBalance: 0,                              // 📈 মুনাফা ব্যালেন্স — শুরুতে শূন্য
            totalReturned: 0,
            returns: [],                                    // 📜 প্রতিটা রিটার্ন এন্ট্রির ইতিহাস (এডিট/ডিলিটের জন্য)
            status: 'active',
            createdAt: sts()
        });
        const docRef = await _offlineSafeAddDoc(["somities", window.currentSomityId, "investments"], payload);
        return docRef ? docRef.id : null;
    } catch(e) {
        console.error("addInvestmentToFirestore error:", e);
        return null;
    }
};

window.updateInvestmentInFirestore = async function(docId, fields) {
    if (!window.currentSomityId || !docId) return;
    try {
        const { doc: docFn, updateDoc } = window._firebaseFns;
        await updateDoc(docFn(window._firebaseDb, "somities", window.currentSomityId, "investments", docId), fields);
    } catch(e) {
        console.error("updateInvestmentInFirestore error:", e);
    }
};

window.deleteInvestmentFromFirestore = async function(docId) {
    if (!window.currentSomityId || !docId) return;
    try {
        await _offlineSafeDeleteDoc(["somities", window.currentSomityId, "investments", docId]);
    } catch(e) {
        console.error("deleteInvestmentFromFirestore error:", e);
    }
};

// নতুন বিনিয়োগ এন্ট্রি — ক্যাশ ইন হ্যান্ড থেকে টাকা কাটবে
async function handleInvestmentSubmit() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন বিনিয়োগ এন্ট্রি করতে পারবেন।'); return; }
    const title      = document.getElementById('investment-title').value.trim();
    const amount     = Number(document.getElementById('investment-amount').value);
    const customDate = document.getElementById('investment-date').value;
    const note       = document.getElementById('investment-note').value.trim();

    if (!title || !amount || amount <= 0) { window.showAlert("বিনিয়োগের বিবরণ ও টাকার পরিমাণ সঠিকভাবে দিন!"); return; }
    if (amount > (appState.cashInHand || 0)) { window.showAlert("বিনিয়োগ করার মতো হাতে পর্যাপ্ত ক্যাশ নেই!"); return; }

    const formattedDate = formatActionDate(customDate);

    if (window.addInvestmentToFirestore) {
        await window.addInvestmentToFirestore({ title, amount, date: formattedDate, note });
    }

    const lastTxn = buildLastTxn('investment', '', amount, title);
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ cashInHand: _somityDelta(-amount), totalInvestment: _somityDelta(amount) }, lastTxn);
    }
    notifyEntryMaker(lastTxn);

    document.getElementById('investment-title').value = "";
    document.getElementById('investment-amount').value = "";
    document.getElementById('investment-date').value = "";
    document.getElementById('investment-note').value = "";
    window.closeInvestmentModal();
    window.showAlert('✅ বিনিয়োগ এন্ট্রি সফলভাবে যুক্ত হয়েছে।');
}

// ══════════════════════════════════════════════
// 📈 বিনিয়োগ রিটার্ন এন্ট্রি — মূলধন রিটার্ন / মুনাফা / লস
// ══════════════════════════════════════════════
window.openInvestmentReturnModal = function(docId) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const inv = (appState.investments || []).find(i => i._id === docId);
    if (!inv) { window.showAlert('বিনিয়োগ খুঁজে পাওয়া যায়নি।'); return; }
    const remainingPrincipal = inv.remainingPrincipal !== undefined ? Number(inv.remainingPrincipal) : Number(inv.amount) || 0;
    const profitBalance = Number(inv.profitBalance) || 0;
    window._irContext = {
        docId,
        title: inv.title || '',
        amount: Number(inv.amount) || 0,
        remainingPrincipal,
        profitBalance,
        returns: Array.isArray(inv.returns) ? inv.returns.slice() : [],
        editingReturnId: null // এডিট মোডে থাকলে এখানে সেই এন্ট্রির id বসবে
    };
    const descEl = document.getElementById('ir-modal-desc');
    if (descEl) {
        descEl.innerHTML = `<b>${inv.title || ''}</b><br>অবশিষ্ট মূলধন: ৳ ${remainingPrincipal.toLocaleString()} &nbsp;|&nbsp; মুনাফা ব্যালেন্স: ৳ ${profitBalance.toLocaleString()}`;
    }
    const titleEl = document.getElementById('ir-modal-title');
    if (titleEl) titleEl.textContent = 'বিনিয়োগ রিটার্ন এন্ট্রি';
    const typeSel = document.getElementById('ir-type');
    if (typeSel) typeSel.value = 'capital';
    const amtInput = document.getElementById('ir-amount');
    if (amtInput) amtInput.value = '';
    const modal = document.getElementById('investment-return-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    if (window._pushModalHistory) window._pushModalHistory(window.closeInvestmentReturnModal);
};

// একটা নির্দিষ্ট পুরনো রিটার্ন এন্ট্রি এডিট করার জন্য মডাল খোলা (প্রি-ফিল করা থাকবে)
window.editInvestmentReturnEntry = function(docId, returnId) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const inv = (appState.investments || []).find(i => i._id === docId);
    if (!inv) return;
    const returns = Array.isArray(inv.returns) ? inv.returns : [];
    const entry = returns.find(r => r.id === returnId);
    if (!entry) { window.showAlert('এন্ট্রি খুঁজে পাওয়া যায়নি।'); return; }

    window._irContext = {
        docId,
        title: inv.title || '',
        amount: Number(inv.amount) || 0,
        remainingPrincipal: inv.remainingPrincipal !== undefined ? Number(inv.remainingPrincipal) : Number(inv.amount) || 0,
        profitBalance: Number(inv.profitBalance) || 0,
        returns: returns.slice(),
        editingReturnId: returnId
    };
    const descEl = document.getElementById('ir-modal-desc');
    if (descEl) descEl.innerHTML = `<b>${inv.title || ''}</b> — পুরনো এন্ট্রি সংশোধন করছেন`;
    const titleEl = document.getElementById('ir-modal-title');
    if (titleEl) titleEl.textContent = '✏️ রিটার্ন এন্ট্রি সংশোধন';
    const typeSel = document.getElementById('ir-type');
    if (typeSel) typeSel.value = entry.type;
    const amtInput = document.getElementById('ir-amount');
    if (amtInput) amtInput.value = entry.amount;
    const modal = document.getElementById('investment-return-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    if (window._pushModalHistory) window._pushModalHistory(window.closeInvestmentReturnModal);
};

// একটা রিটার্ন এন্ট্রি ডিলিট করা (সম্পূর্ণ পুনর্গণনা করে সঠিক হিসাব বসানো হবে)
window.deleteInvestmentReturnEntry = async function(docId, returnId) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const inv = (appState.investments || []).find(i => i._id === docId);
    if (!inv) return;
    const oldReturns = Array.isArray(inv.returns) ? inv.returns : [];
    const entry = oldReturns.find(r => r.id === returnId);
    if (!entry) return;

    const proceed = await window.showConfirm(
        `"${entry.type === 'capital' ? 'মূলধন রিটার্ন' : entry.type === 'profit' ? 'মুনাফা' : 'লস'}" এন্ট্রি (৳ ${Number(entry.amount).toLocaleString()}) ডিলিট করবেন? সব হিসাব স্বয়ংক্রিয়ভাবে পুনর্গণনা হয়ে যাবে।`,
        { title: '🗑️ এন্ট্রি ডিলিট নিশ্চিত করুন', icon: '🗑️', okText: 'হ্যাঁ, ডিলিট করুন', cancelText: 'বাতিল', danger: true }
    );
    if (!proceed) return;

    const newReturns = oldReturns.filter(r => r.id !== returnId);
    await _applyInvestmentReturnsChange(inv, oldReturns, newReturns);
    window.showAlert('✅ এন্ট্রি ডিলিট করা হয়েছে ও হিসাব পুনর্গণনা করা হয়েছে।');
};

// ── পুরনো (before) ও নতুন (after) returns তালিকা থেকে সঠিক ডেল্টা বের করে
// ইনভেস্টমেন্ট ডকুমেন্ট ও সমিতির অ্যাগ্রিগেট (cashInHand/pool/totalInvestment) আপডেট করে ──
async function _applyInvestmentReturnsChange(inv, oldReturns, newReturns) {
    const amount = Number(inv.amount) || 0;
    const before = _investmentComputeFromReturns(amount, oldReturns);
    const after  = _investmentComputeFromReturns(amount, newReturns);

    // 💰 cashInHand শুধু মূলধন (capital) ফেরতের ভিত্তিতে বাড়বে/কমবে —
    // মুনাফা (profit) অংশটা সরাসরি ক্যাশ ইন হ্যান্ডে যোগ হবে না, শুধু বণ্টনযোগ্য পুলে জমা থাকবে;
    // "মুনাফা বণ্টন" সম্পন্ন হলে তখনই সেই পরিমাণ ক্যাশ ইন হ্যান্ডে যোগ হবে।
    const cashDelta = after.capitalReturned - before.capitalReturned;
    const poolDelta = after.profitBalance - before.profitBalance;
    const totalInvestmentDelta = after.remainingPrincipal - before.remainingPrincipal;

    await window.updateInvestmentInFirestore(inv._id, {
        returns: newReturns,
        remainingPrincipal: after.remainingPrincipal,
        profitBalance: after.profitBalance,
        totalReturned: after.totalReturned,
        status: after.status
    });

    const somityUpdate = {};
    if (cashDelta) somityUpdate.cashInHand = _somityDelta(cashDelta);
    if (poolDelta) somityUpdate.distributableProfitPool = _somityDelta(poolDelta);
    if (totalInvestmentDelta) somityUpdate.totalInvestment = _somityDelta(totalInvestmentDelta);
    if (Object.keys(somityUpdate).length && window.updateSomityDoc) {
        const lastTxn = buildLastTxn('investment_return', '', Math.abs(cashDelta) || Math.abs(poolDelta) || 1, `${inv.title || ''} (সংশোধন)`);
        await window.updateSomityDoc(somityUpdate, lastTxn);
        notifyEntryMaker(lastTxn);
    }
}

window.closeInvestmentReturnModal = function() {
    const modal = document.getElementById('investment-return-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
};

window.submitInvestmentReturn = async function() {
    const ctx = window._irContext;
    if (!ctx) return;
    const type = document.getElementById('ir-type').value; // capital | profit | loss
    const amount = Number(document.getElementById('ir-amount').value);
    if (!amount || amount <= 0) { window.showAlert('সঠিক টাকার পরিমাণ দিন!'); return; }

    const inv = (appState.investments || []).find(i => i._id === ctx.docId);
    if (!inv) { window.showAlert('বিনিয়োগ খুঁজে পাওয়া যায়নি।'); return; }
    const oldReturns = Array.isArray(inv.returns) ? inv.returns : [];
    const typeLabel = type === 'capital' ? 'মূলধন রিটার্ন' : (type === 'profit' ? 'মুনাফা' : 'লস');

    let newReturns;
    if (ctx.editingReturnId) {
        // ✏️ পুরনো এন্ট্রি সংশোধন — সেই এন্ট্রিটা বদলে দাও
        newReturns = oldReturns.map(r => r.id === ctx.editingReturnId ? { ...r, type, amount } : r);
    } else {
        // ➕ নতুন এন্ট্রি যোগ করো
        const newEntry = { id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), type, amount, createdAt: Date.now() };
        newReturns = [...oldReturns, newEntry];
    }

    // ⚠️ মূলধন রিটার্নের হালকা যাচাই (শুধু সতর্কবার্তা, replay-ই চূড়ান্ত সঠিক হিসাব দেবে)
    const before = _investmentComputeFromReturns(ctx.amount, oldReturns);
    if (type === 'capital' && amount > before.remainingPrincipal && !ctx.editingReturnId) {
        window.showAlert(`⚠️ অবশিষ্ট মূলধনের (৳ ${before.remainingPrincipal.toLocaleString()}) চেয়ে বেশি দেওয়া যাবে না — তাই সর্বোচ্চ পরিমাণ হিসেবে নেওয়া হয়েছে।`);
    }

    await _applyInvestmentReturnsChange(inv, oldReturns, newReturns);

    const after = _investmentComputeFromReturns(ctx.amount, newReturns);
    window.closeInvestmentReturnModal();
    window.showAlert(`✅ "${typeLabel}" এন্ট্রি ${ctx.editingReturnId ? 'সংশোধন' : 'যুক্ত'} হয়েছে।` + (after.status === 'closed' && before.status !== 'closed' ? ' এই বিনিয়োগের মূলধন সম্পূর্ণ ফেরত/শেষ হয়ে যাওয়ায় এটি এখন "সম্পন্ন" হিসেবে চিহ্নিত হলো।' : ''));
};

// পুল ম্যানুয়ালি সংশোধন/শূন্য করার অপশন (টেস্টিং বা ভুল সংশোধনের জন্য)
window.correctProfitPool = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const current = Number(appState.distributableProfitPool) || 0;
    const input = await window.showPrompt(
        `বর্তমান পুল: ৳ ${current.toLocaleString()}। নতুন সঠিক পরিমাণ লিখুন (শূন্য করতে চাইলে 0 লিখুন):`,
        String(current), { title: '✏️ মুনাফা পুল সংশোধন', icon: '✏️', okText: 'সংশোধন করুন' }
    );
    if (input === null || input === undefined || input === '') return;
    const newValue = Number(input);
    if (isNaN(newValue)) { window.showAlert('সঠিক সংখ্যা দিন!'); return; }

    const proceed = await window.showConfirm(
        `পুল ৳ ${current.toLocaleString()} থেকে ৳ ${newValue.toLocaleString()}-এ সরাসরি বদলে দেওয়া হবে (এটা কোনো বিনিয়োগের হিসাব বদলাবে না, শুধু পুলের সংখ্যাটা)। নিশ্চিত?`,
        { title: 'পুল সংশোধন নিশ্চিত করুন', icon: '⚠️', okText: 'হ্যাঁ, সংশোধন করুন', cancelText: 'বাতিল' }
    );
    if (!proceed) return;

    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ distributableProfitPool: newValue });
    }
    appState.distributableProfitPool = newValue;
    renderInvestmentLedger();
    window.showAlert('✅ পুল সংশোধন করা হয়েছে।');
};

// 💵 বণ্টনযোগ্য মুনাফা পুল থেকে সরাসরি ক্যাশ ইন হ্যান্ডে হস্তান্তর
// (কোনো নির্দিষ্ট সদস্যকে না দিয়ে পুরো/আংশিক ব্যালেন্স সাধারণ ক্যাশে যোগ করার জন্য)
window.transferProfitPoolToCash = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const pool = Number(appState.distributableProfitPool) || 0;
    if (pool <= 0) { window.showAlert('বণ্টনযোগ্য মুনাফা পুলে হস্তান্তরের মতো কোনো ব্যালেন্স নেই।'); return; }

    const input = await window.showPrompt(
        `বর্তমান পুল ব্যালেন্স: ৳ ${pool.toLocaleString()}\n\nকত টাকা ক্যাশ ইন হ্যান্ডে হস্তান্তর করতে চান?`,
        String(pool), { title: '💵 পুল থেকে ক্যাশে হস্তান্তর', icon: '💵', okText: 'পরবর্তী' }
    );
    if (input === null || input === undefined || input === '') return;
    const amount = Number(input);
    if (isNaN(amount) || amount <= 0) { window.showAlert('সঠিক টাকার পরিমাণ দিন!'); return; }
    if (amount > pool) { window.showAlert('পুলের ব্যালেন্সের চেয়ে বেশি টাকা হস্তান্তর করা যাবে না।'); return; }

    const proceed = await window.showConfirm(
        `৳ ${amount.toLocaleString()} টাকা মুনাফা পুল থেকে কেটে সরাসরি ক্যাশ ইন হ্যান্ডে যোগ হবে (এটা কোনো নির্দিষ্ট সদস্যের হিসাবে যোগ হবে না, শুধু সাধারণ ক্যাশে যোগ হবে)। নিশ্চিত করবেন?`,
        { title: '💵 হস্তান্তর নিশ্চিত করুন', icon: '💵', okText: 'হ্যাঁ, হস্তান্তর করুন', cancelText: 'বাতিল' }
    );
    if (!proceed) return;

    try {
        const lastTxn = buildLastTxn('profit_distribution', '', amount, 'মুনাফা পুল থেকে ক্যাশ ইন হ্যান্ডে হস্তান্তর');
        if (window.updateSomityDoc) {
            await window.updateSomityDoc({
                distributableProfitPool: _somityDelta(-amount),
                totalProfitDistributed: _somityDelta(amount),
                cashInHand: _somityDelta(amount)
            }, lastTxn);
            notifyEntryMaker(lastTxn);
        }
        renderInvestmentLedger();
        window.showAlert('✅ পুল থেকে ক্যাশ ইন হ্যান্ডে সফলভাবে হস্তান্তর করা হয়েছে।');
    } catch(e) {
        console.error('transferProfitPoolToCash error:', e);
        window.showAlert('❌ হস্তান্তর করতে সমস্যা হয়েছে: ' + e.message);
    }
};

window.openInvestmentModal = function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন বিনিয়োগ এন্ট্রি করতে পারবেন।'); return; }
    if (window._openInvestmentModalUI) window._openInvestmentModalUI();
};
window.closeInvestmentModal = function() {
    if (window._closeInvestmentModalUI) window._closeInvestmentModalUI();
};

// বিনিয়োগ লেজার মডাল খোলা ও রেন্ডার করা
window.openInvestmentLedgerModal = function() {
    const m = document.getElementById('investment-ledger-modal');
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
    renderInvestmentLedger();
    if (window._pushModalHistory) window._pushModalHistory(window.closeInvestmentLedgerModal);
};
window.closeInvestmentLedgerModal = function() {
    const m = document.getElementById('investment-ledger-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
};

function renderInvestmentLedger() {
    const poolEl = document.getElementById('investment-pool-amount');
    if (poolEl) {
        const pool = Number(appState.distributableProfitPool) || 0;
        poolEl.textContent = (pool < 0 ? '-৳ ' + Math.abs(pool).toLocaleString() : '৳ ' + pool.toLocaleString());
        poolEl.style.color = pool < 0 ? '#dc2626' : '#0f766e';
    }
    const body = document.getElementById('investment-ledger-list');
    const emptyMsg = document.getElementById('investment-ledger-empty-msg');
    if (!body) return;
    const list = (appState.investments || []).slice().sort((a,b) => (b._sortTime||0) - (a._sortTime||0));
    if (!list.length) {
        body.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');
    const isAdmin = window.isAdminVerified ? window.isAdminVerified() : false;

    body.innerHTML = list.map(inv => {
        // পুরনো ডেটা (নতুন ফিল্ড আসার আগে তৈরি) হলে fallback হিসেবে amount/totalReturned ব্যবহার করো
        const remainingPrincipal = inv.remainingPrincipal !== undefined ? Number(inv.remainingPrincipal) : Number(inv.amount) || 0;
        const profitBalance = Number(inv.profitBalance) || 0;
        const plColor = profitBalance > 0 ? '#059669' : (profitBalance < 0 ? '#dc2626' : '#64748b');
        const plBg = profitBalance > 0 ? '#ecfdf5' : (profitBalance < 0 ? '#fef2f2' : '#f8fafc');
        const statusBadge = inv.status === 'closed'
            ? '<span style="background:#f1f5f9;color:#64748b;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap;">✅ সম্পন্ন</span>'
            : '<span style="background:#ecfdf5;color:#059669;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap;">🟢 চলমান</span>';
        const returnBtn = (isAdmin && inv.status !== 'closed')
            ? `<button onclick="window.openInvestmentReturnModal('${inv._id}')" style="flex:1;background:#0d9488;color:#fff;border:none;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;">📈 রিটার্ন যোগ করুন</button>`
            : '';
        const editBtn = isAdmin
            ? `<button onclick="window.editInvestmentDetails('${inv._id}')" title="বিনিয়োগের তথ্য সংশোধন" style="background:#f1f5f9;border:none;color:#64748b;font-size:12px;cursor:pointer;padding:3px 7px;border-radius:7px;">✏️</button>`
            : '';
        const returns = Array.isArray(inv.returns) ? inv.returns : [];
        const historyToggleBtn = returns.length
            ? `<button onclick="window.toggleInvestmentHistory('${inv._id}')" id="ih-toggle-${inv._id}" style="flex:1;background:#f0fdfa;color:#0d9488;border:1px solid #99f6e4;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;">📜 ইতিহাস (${returns.length}) ▾</button>`
            : '';
        const historyList = returns.slice().reverse().map(r => {
            const typeLabel = r.type === 'capital' ? '💰 মূলধন রিটার্ন' : (r.type === 'profit' ? '📈 মুনাফা' : '📉 লস');
            const typeColor = r.type === 'loss' ? '#dc2626' : (r.type === 'profit' ? '#059669' : '#1d4ed8');
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:11px;color:${typeColor};font-weight:700;">${typeLabel}</span>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:12px;color:#1e293b;font-weight:800;">৳ ${Number(r.amount).toLocaleString()}</span>
                    <span style="display:flex;gap:2px;">
                        <button onclick="window.editInvestmentReturnEntry('${inv._id}','${r.id}')" title="সংশোধন" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;padding:2px 5px;">✏️</button>
                        <button onclick="window.deleteInvestmentReturnEntry('${inv._id}','${r.id}')" title="ডিলিট" style="background:none;border:none;color:#dc2626;font-size:12px;cursor:pointer;padding:2px 5px;">🗑️</button>
                    </span>
                </div>
            </div>`;
        }).join('');
        const actionRow = (returnBtn || historyToggleBtn)
            ? `<div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0;">${returnBtn}${historyToggleBtn}</div>`
            : '';
        return `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <div style="min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span style="font-weight:800;font-size:14px;color:#134e4a;">${inv.title || ''}</span>
                        ${editBtn}
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:3px;">📅 ${inv.date || ''}</div>
                </div>
                ${statusBadge}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                <div style="background:#f8fafc;border-radius:10px;padding:8px 10px;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:700;">মূল বিনিয়োগ</div>
                    <div style="font-size:13px;font-weight:800;color:#1e293b;">৳ ${(Number(inv.amount)||0).toLocaleString()}</div>
                </div>
                <div style="background:#f8fafc;border-radius:10px;padding:8px 10px;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:700;">অবশিষ্ট মূলধন</div>
                    <div style="font-size:13px;font-weight:800;color:#1e293b;">৳ ${remainingPrincipal.toLocaleString()}</div>
                </div>
            </div>
            <div style="background:${plBg};border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;color:${plColor};font-weight:700;">📈 মুনাফা ব্যালেন্স</span>
                <span style="font-size:14px;font-weight:900;color:${plColor};">৳ ${profitBalance.toLocaleString()}</span>
            </div>
            ${inv.note ? `<div style="font-size:11px;color:#94a3b8;margin-top:8px;">📝 ${inv.note}</div>` : ''}
            ${actionRow}
            <div id="ih-list-${inv._id}" style="display:none;margin-top:8px;background:#f8fafc;border-radius:10px;padding:2px 10px;">${historyList}</div>
        </div>`;
    }).join('');
}

// রিটার্ন এন্ট্রির ইতিহাস দেখানো/লুকানো (অ্যাকর্ডিয়ন)
window.toggleInvestmentHistory = function(docId) {
    const list = document.getElementById('ih-list-' + docId);
    const toggle = document.getElementById('ih-toggle-' + docId);
    if (!list) return;
    const isOpen = list.style.display !== 'none';
    list.style.display = isOpen ? 'none' : 'block';
    if (toggle) toggle.textContent = toggle.textContent.replace(isOpen ? '▴' : '▾', isOpen ? '▾' : '▴');
};

// বিনিয়োগের নিজস্ব তথ্য (শিরোনাম/মূল টাকা/তারিখ/নোট) সংশোধন
window.editInvestmentDetails = async function(docId) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const inv = (appState.investments || []).find(i => i._id === docId);
    if (!inv) return;

    const newTitle = await window.showPrompt('বিনিয়োগের বিবরণ:', inv.title || '', { title: '✏️ বিনিয়োগ সংশোধন', icon: '✏️', okText: 'পরবর্তী' });
    if (newTitle === null || newTitle === undefined || newTitle.trim() === '') return;

    const newAmountStr = await window.showPrompt('মূল বিনিয়োগের টাকা:', String(inv.amount || 0), { title: '✏️ বিনিয়োগ সংশোধন', icon: '✏️', okText: 'সংরক্ষণ করুন' });
    if (newAmountStr === null || newAmountStr === undefined || newAmountStr === '') return;
    const newAmount = Number(newAmountStr);
    if (isNaN(newAmount) || newAmount <= 0) { window.showAlert('সঠিক টাকার পরিমাণ দিন!'); return; }

    const oldAmount = Number(inv.amount) || 0;
    const returns = Array.isArray(inv.returns) ? inv.returns : [];

    // পুরনো amount দিয়ে হিসাব করা আগের অবস্থা বনাম নতুন amount দিয়ে recompute করা নতুন অবস্থা
    const before = _investmentComputeFromReturns(oldAmount, returns);
    const after  = _investmentComputeFromReturns(newAmount, returns);

    const totalInvestmentDelta = after.remainingPrincipal - before.remainingPrincipal;
    // ⚠️ amount বদলালে cashInHand/pool বদলাবে না (সেগুলো শুধু returns এন্ট্রির উপর নির্ভরশীল, amount-এর উপর না)

    await window.updateInvestmentInFirestore(docId, {
        title: newTitle.trim(),
        amount: newAmount,
        remainingPrincipal: after.remainingPrincipal,
        profitBalance: after.profitBalance,
        totalReturned: after.totalReturned,
        status: after.status
    });

    if (totalInvestmentDelta && window.updateSomityDoc) {
        await window.updateSomityDoc({ totalInvestment: _somityDelta(totalInvestmentDelta) });
    }
    window.showAlert('✅ বিনিয়োগের তথ্য সংশোধন করা হয়েছে।');
};

// ══════════════════════════════════════════════
// 📊 মুনাফা বণ্টন (Profit Distribution)
// ══════════════════════════════════════════════

window.openProfitDistributionModal = function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন মুনাফা বণ্টন করতে পারবেন।'); return; }
    const pool = Number(appState.distributableProfitPool) || 0;
    if (pool <= 0) { window.showAlert('বণ্টনযোগ্য মুনাফা নেই (পুল ০ বা ঋণাত্মক)।'); return; }

    // 🟢 সহজীকরণ: মেয়াদ/eligibility অনুযায়ী আর ফিল্টার করা হয় না — সব সক্রিয় (closed নয়) সদস্যই তালিকায় থাকবে,
    // এডমিন নিজে ম্যানুয়ালি বেছে বেছে যাকে যত টাকা দিতে চান তা ঘরে বসিয়ে দেবেন।
    const eligibleMembers = (appState.members || []).filter(m => m.status !== 'closed');

    const listEl = document.getElementById('profit-distribution-list');
    const emptyMsg = document.getElementById('pd-empty-msg');
    const poolTotalEl = document.getElementById('pd-pool-total');
    if (poolTotalEl) poolTotalEl.textContent = '৳ ' + pool.toLocaleString();

    if (!eligibleMembers.length) {
        if (listEl) listEl.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        _pdRecalcTotals();
    } else {
        if (emptyMsg) emptyMsg.classList.add('hidden');
        const totalEligibleSavings = eligibleMembers.reduce((s, m) => s + (Number(m.savings) || 0), 0);
        if (listEl) {
            listEl.innerHTML = eligibleMembers.map(m => {
                const savings = Number(m.savings) || 0;
                const suggested = totalEligibleSavings > 0
                    ? Math.round(pool * (savings / totalEligibleSavings))
                    : 0;
                return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:10px 12px;margin-bottom:8px;">
                    <div style="min-width:0;">
                        <div style="font-weight:800;font-size:13px;color:#1e293b;">${m.name || ''}</div>
                        <div style="font-size:11px;color:#94a3b8;">সঞ্চয়: ৳ ${savings.toLocaleString()}</div>
                    </div>
                    <input type="number" class="pd-amount-input" data-doc-id="${m._docId}" data-name="${(m.name||'').replace(/"/g,'&quot;')}"
                        value="${suggested}" oninput="window._pdRecalcTotals()"
                        style="width:110px;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;text-align:right;font-weight:700;color:#0f766e;">
                </div>`;
            }).join('');
        }
        _pdRecalcTotals();
    }

    const modal = document.getElementById('profit-distribution-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    if (window._pushModalHistory) window._pushModalHistory(window.closeProfitDistributionModal);
};

window.closeProfitDistributionModal = function() {
    const modal = document.getElementById('profit-distribution-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
};

window._pdRecalcTotals = function() {
    const pool = Number(appState.distributableProfitPool) || 0;
    let distributed = 0;
    document.querySelectorAll('.pd-amount-input').forEach(inp => {
        distributed += Number(inp.value) || 0;
    });
    const distEl = document.getElementById('pd-distributed-total');
    const remEl  = document.getElementById('pd-remaining-total');
    if (distEl) distEl.textContent = '৳ ' + distributed.toLocaleString();
    if (remEl) {
        const remaining = pool - distributed;
        remEl.textContent = (remaining < 0 ? '-৳ ' + Math.abs(remaining).toLocaleString() : '৳ ' + remaining.toLocaleString());
        remEl.style.color = remaining < 0 ? '#dc2626' : '#0f766e';
    }
};

window.confirmProfitDistribution = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const inputs = Array.from(document.querySelectorAll('.pd-amount-input'));
    const allocations = inputs
        .map(inp => ({ docId: inp.dataset.docId, name: inp.dataset.name, amount: Number(inp.value) || 0 }))
        .filter(a => a.amount !== 0);

    if (!allocations.length) { window.showAlert('কমপক্ষে একজন সদস্যের জন্য একটা পরিমাণ দিন।'); return; }

    const totalDistributed = allocations.reduce((s, a) => s + a.amount, 0);
    const pool = Number(appState.distributableProfitPool) || 0;
    if (totalDistributed > pool) {
        const proceed = await window.showConfirm(
            `মোট বণ্টিত (৳ ${totalDistributed.toLocaleString()}) পুলের (৳ ${pool.toLocaleString()}) চেয়ে বেশি! এগিয়ে যাবেন?`,
            { title: '⚠️ পুল ছাড়িয়ে যাচ্ছে', icon: '⚠️', okText: 'তবুও এগিয়ে যান', cancelText: 'বাতিল' }
        );
        if (!proceed) return;
    }

    const confirmMsg = allocations.map(a => `${a.name}: ৳ ${a.amount.toLocaleString()}`).join('\n');
    const finalConfirm = await window.showConfirm(
        `নিম্নলিখিত সদস্যদের "লাভ/ক্ষতি" কার্ডে যোগ হবে:\n\n${confirmMsg}\n\nনিশ্চিত করবেন?`,
        { title: 'বণ্টন নিশ্চিত করুন', icon: '📊', okText: 'হ্যাঁ, নিশ্চিত করুন', cancelText: 'বাতিল' }
    );
    if (!finalConfirm) return;

    try {
        const { doc: docFn, updateDoc, increment } = window._firebaseFns;
        for (const a of allocations) {
            await updateDoc(
                docFn(window._firebaseDb, "somities", window.currentSomityId, "members", a.docId),
                { profitLoss: increment(a.amount) }
            );
        }
        if (window.updateSomityDoc) {
            const lastTxn = buildLastTxn('profit_distribution', '', totalDistributed, `মুনাফা বণ্টন — ${allocations.length} জন সদস্য`);
            await window.updateSomityDoc({
                distributableProfitPool: _somityDelta(-totalDistributed),
                totalProfitDistributed: _somityDelta(totalDistributed),
                cashInHand: _somityDelta(totalDistributed) // 💰 বণ্টন সম্পন্ন হওয়ার সাথে সাথেই এই টাকা ক্যাশ ইন হ্যান্ডে যোগ হবে (আগে এটা পুলে জমা ছিল, ক্যাশে যোগ হয়নি)
            }, lastTxn);
            notifyEntryMaker(lastTxn);
        }
        window.closeProfitDistributionModal();
        window.showAlert('✅ মুনাফা সফলভাবে বণ্টন করা হয়েছে।');
    } catch(e) {
        console.error('confirmProfitDistribution error:', e);
        window.showAlert('❌ বণ্টন করতে সমস্যা হয়েছে: ' + e.message);
    }
};

function exportDataBackup() {
    try {
        const jsonString = JSON.stringify(appState, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => { window.showAlert("সফলভাবে ব্যাকআপ ডাটা কপি হয়েছে!"); }).catch(() => { window.showPrompt("নিচের কোডটি সম্পূর্ণ কপি করে সেভ করুন:", jsonString); });
        const blob = new Blob([jsonString], { type: "application/json" }); const blobUrl = URL.createObjectURL(blob); const downloadAnchor = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0,10); downloadAnchor.href = blobUrl; downloadAnchor.download = `somiti_backup_${timestamp}.json`;
        document.body.appendChild(downloadAnchor); downloadAnchor.click(); document.body.removeChild(downloadAnchor); URL.revokeObjectURL(blobUrl);
    } catch (error) { window.showAlert("ব্যাকআপ নিতে সমস্যা হয়েছে: " + error.message); }
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক importDataBackup
// ব্যাকআপ JSON থেকে Firestore-এ সম্পূর্ণ রিস্টোর করে
async function importDataBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    // ✅ FIX: .txt এবং .json উভয় ফাইলই গ্রহণ করো
    const allowedTypes = ['application/json', 'text/plain', ''];
    const allowedExts = ['.json', '.txt'];
    const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
        window.showAlert('❌ ভুল ফাইল ফরম্যাট!\n\nশুধুমাত্র .json বা .txt ফাইল রিস্টোর করা যাবে।\nআপনার Google Drive থেকে ডাউনলোড করা ব্যাকআপ ফাইলটি বেছে নিন।');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // ✅ FIX: UTF-8 BOM এবং extra whitespace সরিয়ে parse করো
            let rawText = e.target.result;
            // BOM (Byte Order Mark) সরাও যদি থাকে
            if (rawText.charCodeAt(0) === 0xFEFF) rawText = rawText.slice(1);
            rawText = rawText.trim();

            let parsedData;
            try {
                parsedData = JSON.parse(rawText);
            } catch (jsonErr) {
                window.showAlert('❌ ফাইলটি সঠিক JSON ফরম্যাটে নেই!\n\nসম্ভাব্য কারণ:\n• ফাইলটি আংশিক ডাউনলোড হয়েছে\n• Google Drive থেকে সরাসরি open না করে Download করুন\n• ফাইলটি edit হয়ে গেছে\n\nError: ' + jsonErr.message);
                return;
            }

            if (!parsedData || typeof parsedData !== 'object' || !('members' in parsedData)) {
                window.showAlert('❌ ভুল ফাইল ফরম্যাট!\n\nএই ফাইলে "members" ডেটা পাওয়া যায়নি।\nসঠিক ব্যাকআপ ফাইল বেছে নিন।');
                return;
            }

            if (!window.currentSomityId) {
                window.showAlert('সমিতি আইডি পাওয়া যায়নি। লগইন করে আবার চেষ্টা করুন।');
                return;
            }

            if (!(await window.showConfirm(
                'ব্যাকআপ রিস্টোর করলে Firestore-এ বিদ্যমান সব ডেটা মুছে যাবে।\nরিস্টোর করবেন?',
                { title: 'সতর্কতা!', okText: 'রিস্টোর করুন' }
            ))) return;

            // লোডিং দেখাও
            const loadingToast = document.createElement('div');
            loadingToast.id = 'restore-toast';
            loadingToast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e293b;color:#fff;padding:20px 32px;border-radius:16px;font-size:14px;font-weight:700;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5);';
            loadingToast.innerHTML = '<div style="width:36px;height:36px;border:4px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:fa-spin 0.8s linear infinite;margin:0 auto 12px;"></div>রিস্টোর হচ্ছে...';
            document.body.appendChild(loadingToast);

            try {
                // ── ১. বিদ্যমান sub-collection ডেটা মুছো ──
                const delMemberPromises = (appState.members || []).map(m => {
                    if (m._docId && window.deleteMemberFromFirestore) return window.deleteMemberFromFirestore(m._docId);
                }).filter(Boolean);
                const delTxnPromises = [...(appState.bankLedger || []), ...(appState.otherFundsLedger || [])].map(t => {
                    if (t._docId && window.deleteTransactionFromFirestore) return window.deleteTransactionFromFirestore(t._docId);
                }).filter(Boolean);
                const delExpPromises = (appState.expenseLedger || []).map(ex => {
                    if (ex._docId && window.deleteExpenseFromFirestore) return window.deleteExpenseFromFirestore(ex._docId);
                }).filter(Boolean);
                await Promise.all([...delMemberPromises, ...delTxnPromises, ...delExpPromises]);

                // ── ২. সদস্যদের Firestore-এ সেভ করো ──
                const members = Array.isArray(parsedData.members) ? parsedData.members : [];
                for (const m of members) {
                    const memberData = {
                        id:          m.id || '',
                        name:        m.name || '',
                        phone:       m.phone || '',
                        address:     m.address || '',
                        institution: m.institution || '',
                        savings:     Number(m.savings || 0),
                        ledger:      Array.isArray(m.ledger) ? m.ledger : [],
                    };
                    if (m.photoUrl) memberData.photoUrl = m.photoUrl;
                    if (window.addMemberToFirestore) await window.addMemberToFirestore(memberData);
                }

                // ── ৩. ব্যাংক লেনদেন Firestore-এ সেভ করো ──
                const bankLedger = Array.isArray(parsedData.bankLedger) ? parsedData.bankLedger : [];
                for (const t of bankLedger) {
                    if (window.addTransactionToFirestore) await window.addTransactionToFirestore({
                        category: 'bank',
                        date:     t.date || '',
                        purpose:  t.purpose || '',
                        note:     t.note || '',
                        type:     t.type || '',
                        amount:   Number(t.amount || 0),
                    });
                }

                // ── ৪. অন্যান্য ফান্ড লেনদেন Firestore-এ সেভ করো ──
                const otherFunds = Array.isArray(parsedData.otherFundsLedger) ? parsedData.otherFundsLedger : [];
                for (const t of otherFunds) {
                    if (window.addTransactionToFirestore) await window.addTransactionToFirestore({
                        category: 'other_fund',
                        amount:   Number(t.amount || 0),
                        member:   t.member || '',
                        purpose:  t.purpose || '',
                        date:     t.date || '',
                        rawDate:  t.rawDate || '',
                    });
                }

                // ── ৫. খরচ Firestore-এ সেভ করো ──
                const expenses = Array.isArray(parsedData.expenseLedger) ? parsedData.expenseLedger : [];
                for (const ex of expenses) {
                    if (window.addExpenseToFirestore) await window.addExpenseToFirestore({
                        date:    ex.date || '',
                        purpose: ex.purpose || '',
                        amount:  Number(ex.amount || 0),
                    });
                }

                // ── ৬. Summary ফিল্ড সেভ করো ──
                if (window.updateSomityDoc) {
                    await window.updateSomityDoc({
                        bankBalance:   Number(parsedData.bankBalance   || 0),
                        cashInHand:    Number(parsedData.cashInHand    || 0),
                        totalExpenses: Number(parsedData.totalExpenses || 0),
                        notices:       Array.isArray(parsedData.notices)  ? parsedData.notices  : [],
                        opinions:      Array.isArray(parsedData.opinions) ? parsedData.opinions : [],
                    });
                }

                loadingToast.remove();
                // ✅ FIX: রিস্টোর শেষে পেজ রিলোড করো যাতে সব ডেটা fresh লোড হয়
                const shouldReload = await window.showConfirm(
                    '• ' + members.length + ' জন সদস্য\n' +
                    '• ' + bankLedger.length + ' টি ব্যাংক লেনদেন\n' +
                    '• ' + expenses.length + ' টি খরচ\n\n' +
                    'হ্যাঁ চাপলে পেজ রিফ্রেশ হবে এবং সব ডেটা দেখাবে।',
                    { title: 'ব্যাকআপ সফলভাবে রিস্টোর হয়েছে!', icon: '✅', okText: 'রিফ্রেশ করুন', cancelText: 'পরে', danger: false }
                );
                if (shouldReload) window.location.reload();

            } catch (firestoreErr) {
                loadingToast.remove();
                console.error('Restore error:', firestoreErr);
                window.showAlert('❌ রিস্টোর করতে সমস্যা হয়েছে!\n\nকারণ: ' + firestoreErr.message + '\n\nFirebase Console → Firestore Rules চেক করুন।');
            }

        } catch (parseErr) {
            // ✅ FIX: এই catch এখন আর কাজে আসবে না কারণ উপরে আলাদাভাবে handle হয়েছে
            window.showAlert('❌ ফাইলটি পড়তে সমস্যা হয়েছে!\nError: ' + parseErr.message);
        }
    };
    // ✅ FIX: UTF-8 encoding দিয়ে পড়ো (বাংলা সমর্থনের জন্য)
    reader.readAsText(file, 'UTF-8');
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক deleteMember
async function deleteMember(index){
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন সদস্য মুছতে পারবেন।'); return; }
    if(!(await window.showConfirm("আপনি কি নিশ্চিতভাবে এই সদস্যকে মুছে ফেলতে চান? তার সমস্ত লেনদেন মুছে যাবে এবং ক্যাশ ইন হ্যান্ড থেকে তা স্বয়ংক্রিয়ভাবে অ্যাডজাস্ট হবে।", {icon:'🗑️'}))) return;

    const member = appState.members[index];
    const docId  = member._docId;

    // ক্যাশ অ্যাডজাস্টমেন্ট (ledger থেকে হিসাব করো)
    let cashAdj = 0;
    if(member.ledger && member.ledger.length > 0) {
        member.ledger.forEach(entry => {
            if(entry.type === 'জমা' || entry.type === 'ভর্তি ফি' || entry.type === 'জরিমানা') { cashAdj -= Number(entry.amount); }
            else if(entry.type === 'উত্তোলন') { cashAdj += Number(entry.amount); }
        });
    } else if (Number(member.savings) > 0) {
        cashAdj = -Number(member.savings);
    }

    // ⚡ Sub-collection থেকে সদস্য মুছুন
    if (docId && window.deleteMemberFromFirestore) {
        await window.deleteMemberFromFirestore(docId);
    }
    // summary ক্যাশ আপডেট
    // 🔧 FIX: atomic increment() (delta)
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ cashInHand: _somityDelta(cashAdj) });
    }
}

// ⚡ খরচ রিসেট — সকল expenses সাব-কালেকশন ডকুমেন্ট মুছে summary আপডেট
async function resetExpenses() {
    if(!(await window.showConfirm("আপনি কি খরচের হিসাব রিসেট করতে চান? সকল খরচের রেকর্ড মুছে যাবে।", {icon:'⚠️'}))) return;
    // সব expense ডকুমেন্ট মুছুন
    const promises = (appState.expenseLedger || []).map(item => {
        if (item._docId && window.deleteExpenseFromFirestore) {
            return window.deleteExpenseFromFirestore(item._docId);
        }
    }).filter(Boolean);
    await Promise.all(promises);
    // summary আপডেট
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({ totalExpenses: 0 });
    }
}

// ⚡ সম্পূর্ণ ডেটা রিসেট — সব সাব-কালেকশন সহ
// ⚡ Firebase Auth দিয়ে পাসওয়ার্ড ভেরিফাই করে ডেটা রিসেট (হার্ডকোডেড পাসওয়ার্ড নেই)
async function clearAllDataWithPassword() {
    if (!window.isAdminVerified()) {
        window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।');
        return;
    }

    // ১. প্রথম নিশ্চিতকরণ
    if (!(await window.showConfirm('সমস্ত সদস্য, লেনদেন ও খরচের ডেটা স্থায়ীভাবে মুছে যাবে।\n\nআপনি কি নিশ্চিত?', { title: 'সতর্কতা!', icon: '⚠️' }))) {
        return;
    }

    // ২. Firebase Auth পাসওয়ার্ড ইনপুট নেওয়া
    const password = await window.showPrompt('আপনার Firebase অ্যাকাউন্টের পাসওয়ার্ড দিন:', '', { title: 'নিরাপত্তা যাচাই', icon: '🔐', type: 'password' });
    if (password === null || password.trim() === '') {
        window.showAlert('পাসওয়ার্ড দেওয়া হয়নি। রিসেট বাতিল।');
        return;
    }

    const auth = window._firebaseAuth;
    const { signInWithEmailAndPassword } = window._firebaseFns;
    const userEmail = window.currentUser?.email;

    if (!auth || !signInWithEmailAndPassword || !userEmail) {
        window.showAlert('অ্যাথেনটিকেশন সার্ভিস পাওয়া যায়নি। পেজ রিলোড করে আবার চেষ্টা করুন।');
        return;
    }

    // ৩. Firebase Auth দিয়ে পাসওয়ার্ড ভেরিফাই
    try {
        await signInWithEmailAndPassword(auth, userEmail, password);
    } catch (e) {
        let msg = '❌ পাসওয়ার্ড ভুল! ডেটা রিসেট বাতিল করা হয়েছে।';
        if (e.code === 'auth/too-many-requests') {
            msg = '⛔ অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।';
        } else if (e.code === 'auth/network-request-failed') {
            msg = '🌐 ইন্টারনেট সংযোগ নেই। পরে আবার চেষ্টা করুন।';
        }
        window.showAlert(msg);
        return;
    }

    // ৪. পাসওয়ার্ড সঠিক — চূড়ান্ত নিশ্চিতকরণ
    if (!(await window.showConfirm('সব ডেটা এখনই মুছে ফেলবেন?\nএই কাজটি পূর্বাবস্থায় ফেরানো যাবে না!', { title: 'পাসওয়ার্ড সঠিক।', icon: '✅' }))) {
        return;
    }

    // ৫. Sub-collection থেকে সব ডেটা মুছুন
    const memberDels = (appState.members || []).map(m => {
        if (m._docId && window.deleteMemberFromFirestore) return window.deleteMemberFromFirestore(m._docId);
    }).filter(Boolean);

    const txnDels = [...(appState.bankLedger || []), ...(appState.otherFundsLedger || [])].map(t => {
        if (t._docId && window.deleteTransactionFromFirestore) return window.deleteTransactionFromFirestore(t._docId);
    }).filter(Boolean);

    const expDels = (appState.expenseLedger || []).map(e => {
        if (e._docId && window.deleteExpenseFromFirestore) return window.deleteExpenseFromFirestore(e._docId);
    }).filter(Boolean);

    const investDels = (appState.investments || []).map(inv => {
        if (inv._id && window.deleteInvestmentFromFirestore) return window.deleteInvestmentFromFirestore(inv._id);
    }).filter(Boolean);

    await Promise.all([...memberDels, ...txnDels, ...expDels, ...investDels]);

    // ৬. মূল ডকুমেন্টের summary রিসেট
    if (window.updateSomityDoc) {
        await window.updateSomityDoc({
            bankBalance: 0,
            cashInHand: 0,
            totalExpenses: 0,
            totalInvestment: 0,
            distributableProfitPool: 0,
            totalProfitDistributed: 0,
            notices: [],
            opinions: []
        });
    }

    renderNoticeCard();
    window.showAlert('✅ সমস্ত ডেটা সফলভাবে রিসেট করা হয়েছে।');
}

// =====================================================================
// 🧮 FIX #5: ক্যাশ ইন হ্যান্ড / ব্যাংক ব্যালেন্স / মোট খরচ পুনঃযাচাই ও সংশোধন
// ── কেন লাগলো? ──
// _somityDelta()/increment() ভিত্তিক সিস্টেম আগের একটা অফলাইন-কুইউ বাগের কারণে
// (উপরে _offlineSafeUpdateDoc-এর বড় কমেন্ট দেখুন) কিছু পুরনো লেনদেনে একই ডেল্টা
// দুইবার যোগ হয়ে গিয়েছিল (যেমন: ৳21,010 দেখাচ্ছিল, সঠিক ৳15,010)। সেই বাগ এখন
// কোড থেকে সরানো হয়েছে — কিন্তু Firestore-এ আগে থেকেই জমে থাকা ভুল মোট সংখ্যাটা
// কোনো কোড-ফিক্স নিজে থেকে সংশোধন করতে পারবে না, কারণ ভুল ইতিমধ্যেই সেভ হয়ে গেছে।
// ── সমাধান ──
// এই ফাংশন প্রতিটি member-এর ledger + bank transactions + expenses — অর্থাৎ
// "সত্যিকারের" উৎস থেকে (ডেল্টা ইতিহাসের উপর নির্ভর না করে) cashInHand/
// bankBalance/totalExpenses শূন্য থেকে যোগ করে, পুরনো বনাম নতুন মান দেখিয়ে
// এডমিনের অনুমতি নিয়ে তারপর সংশোধন করে। পেজিনেশন এড়াতে এখানে সরাসরি সম্পূর্ণ
// সাব-কালেকশন (limit ছাড়া) fetch করা হচ্ছে, যাতে ২৫+ সদস্য/লেনদেন থাকলেও
// হিসাব সম্পূর্ণ ও নির্ভুল হয়।
// =====================================================================
window.recalculateCashInHand = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    if (!window.currentSomityId) return;

    const somityId = window.currentSomityId;
    const db2  = window._firebaseDb;
    const fns  = window._firebaseFns;
    if (!db2 || !fns) { window.showAlert('সিস্টেম প্রস্তুত নয়, পেজ রিলোড করে আবার চেষ্টা করুন।'); return; }
    const { collection: colFn, getDocs } = fns;

    // লোডিং দেখাও (ব্যাকআপ রিস্টোরের মতো একই স্টাইল)
    const loadingToast = document.createElement('div');
    loadingToast.id = 'recalc-toast';
    loadingToast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e293b;color:#fff;padding:20px 32px;border-radius:16px;font-size:14px;font-weight:700;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    loadingToast.innerHTML = '<div style="width:36px;height:36px;border:4px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:fa-spin 0.8s linear infinite;margin:0 auto 12px;"></div>হিসাব পুনঃগণনা করা হচ্ছে...';
    document.body.appendChild(loadingToast);

    try {
        // ── ১. সব সদস্যের ledger থেকে নেট ক্যাশ হিসাব করো (জমা/ভর্তি ফি/জরিমানা = +, উত্তোলন = −) ──
        const membersSnap = await getDocs(colFn(db2, "somities", somityId, "members"));
        let cash = 0;
        membersSnap.forEach(d => {
            const m = d.data();
            if (Array.isArray(m.ledger)) {
                m.ledger.forEach(entry => {
                    const amt = Number(entry.amount) || 0;
                    if (entry.type === 'জমা' || entry.type === 'ভর্তি ফি' || entry.type === 'জরিমানা') cash += amt;
                    else if (entry.type === 'উত্তোলন') cash -= amt;
                });
            }
        });

        // ── ২. transactions সাব-কালেকশন (bank + other_fund) ──
        const txnsSnap = await getDocs(colFn(db2, "somities", somityId, "transactions"));
        let bank = 0;
        txnsSnap.forEach(d => {
            const t   = d.data();
            const amt = Number(t.amount) || 0;
            if (t.category === 'bank') {
                if (t.type === 'ব্যাংকে জমা')      { cash -= amt; bank += amt; }
                else if (t.type === 'ব্যাংক উত্তোলন') { cash += amt; bank -= amt; }
            } else if (t.category === 'other_fund') {
                cash += amt;
            }
        });

        // ── ৩. expenses সাব-কালেকশন ──
        const expSnap = await getDocs(colFn(db2, "somities", somityId, "expenses"));
        let expenses = 0;
        expSnap.forEach(d => { expenses += Number(d.data().amount) || 0; });
        cash -= expenses;

        // ── ৪. investments সাব-কালেকশন (বিনিয়োগ) ──
        // প্রতিটা বিনিয়োগ cashInHand থেকে amount কেটে নেয়, আর শুধু মূলধন ফেরত cashInHand-এ যোগ হয়
        // (মুনাফা অংশ বণ্টনের আগ পর্যন্ত ক্যাশে যোগ হয় না — নিচে ধাপ ৫-এ আলাদাভাবে যোগ হচ্ছে)
        const investSnap = await getDocs(colFn(db2, "somities", somityId, "investments"));
        let investment = 0;
        investSnap.forEach(d => {
            const inv = d.data();
            const amt = Number(inv.amount) || 0;
            const computed = _investmentComputeFromReturns(amt, inv.returns);
            cash -= amt;
            cash += computed.capitalReturned;
            investment += computed.remainingPrincipal; // চলমান/সম্পন্ন যেকোনো অবস্থাতেই অবশিষ্ট মূলধনই সঠিক হিসাব
        });

        // ── ৫. এ পর্যন্ত সদস্যদের মধ্যে সর্বমোট বণ্টিত মুনাফা — এটা distribution সম্পন্ন হওয়ার সময়ই cash-এ যোগ হয়েছিল ──
        const totalProfitDistributed = Number(appState.totalProfitDistributed) || 0;
        cash += totalProfitDistributed;

        loadingToast.remove();

        // ── ৫. পুরনো বনাম নতুন মান তুলনা করে এডমিনকে দেখাও ──
        const oldCash = Number(appState.cashInHand)    || 0;
        const oldBank = Number(appState.bankBalance)   || 0;
        const oldExp  = Number(appState.totalExpenses) || 0;
        const oldInvestment = Number(appState.totalInvestment) || 0;
        const cashDiff = cash - oldCash;

        if (cashDiff === 0 && bank === oldBank && expenses === oldExp && investment === oldInvestment) {
            window.showAlert('✅ হিসাব ইতিমধ্যেই সঠিক আছে — কোনো সংশোধনের প্রয়োজন নেই।');
            return;
        }

        const proceed = await window.showConfirm(
            `ক্যাশ ইন হ্যান্ড: ৳ ${oldCash.toLocaleString()} → ৳ ${cash.toLocaleString()} (পার্থক্য: ৳ ${cashDiff.toLocaleString()})\n` +
            `ব্যাংক ব্যালেন্স: ৳ ${oldBank.toLocaleString()} → ৳ ${bank.toLocaleString()}\n` +
            `মোট খরচ: ৳ ${oldExp.toLocaleString()} → ৳ ${expenses.toLocaleString()}\n` +
            `মোট বিনিয়োগ: ৳ ${oldInvestment.toLocaleString()} → ৳ ${investment.toLocaleString()}\n\n` +
            `সদস্য/ব্যাংক/খরচ/বিনিয়োগের প্রকৃত লেজার থেকে হিসাব পুনঃগণনা করা হয়েছে। উপরের সংশোধিত মান দিয়ে আপডেট করবেন?`,
            { title: '🧮 হিসাব যাচাই সম্পন্ন', icon: '🧮', okText: 'সংশোধন করুন', cancelText: 'বাতিল' }
        );
        if (!proceed) return;

        await window.updateSomityDoc({ cashInHand: cash, bankBalance: bank, totalExpenses: expenses, totalInvestment: investment });
        window.showAlert('✅ হিসাব সংশোধন করা হয়েছে।');
    } catch (e) {
        loadingToast.remove();
        console.error('[Recalculate] ব্যর্থ:', e);
        window.showAlert('❌ পুনঃগণনা ব্যর্থ হয়েছে: ' + e.message);
    }
};

function showOtherFundMembers() {
    const memberSelect = document.getElementById('other-fund-member');
    if (!memberSelect) return;
    const currentValue = memberSelect.value;
    memberSelect.innerHTML = '<option value="">নেই (ঐচ্ছিক)</option>' +
        appState.members.map(m => `<option value="${m.name}">${m.name} (আইডি: ${m.id})</option>`).join('');
    memberSelect.value = currentValue; // আগে থেকে সিলেক্ট করা থাকলে সেটাই ধরে রাখো
}

function openOtherFundModal(editIndex = null) {
    const modal = document.getElementById('other-fund-modal');
    showOtherFundMembers(); // 🐛 ফিক্স: datalist-এর বদলে সরাসরি <select> পপুলেট করো, যা মোবাইলে নির্ভরযোগ্যভাবে কাজ করে

    if(editIndex !== null) {
        const item = appState.otherFundsLedger[editIndex];
        document.getElementById('other-fund-edit-index').value = editIndex;
        document.getElementById('other-fund-amount').value = item.amount;
        document.getElementById('other-fund-member').value = item.member;
        document.getElementById('other-fund-purpose').value = item.purpose;
        document.getElementById('other-fund-date').value = item.rawDate || "";
    } else {
        document.getElementById('other-fund-edit-index').value = "";
        document.getElementById('other-fund-amount').value = "";
        document.getElementById('other-fund-member').value = "";
        document.getElementById('other-fund-purpose').value = "";
        document.getElementById('other-fund-date').value = "";
    }

    renderOtherFundHistory();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window._pushModalHistory) window._pushModalHistory(() => closeOtherFundModal());
}

function closeOtherFundModal() {
    if (window._popModalHistory) window._popModalHistory();
    document.getElementById('other-fund-modal').classList.add('hidden');
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক submitOtherFund
async function submitOtherFund() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন ফান্ড এন্ট্রি করতে পারবেন।'); return; }
    const amount    = Number(document.getElementById('other-fund-amount').value);
    const member    = document.getElementById('other-fund-member').value;
    const purpose   = document.getElementById('other-fund-purpose').value.trim();
    const rawDate   = document.getElementById('other-fund-date').value;
    const editIndex = document.getElementById('other-fund-edit-index').value;

    if(!amount || amount <= 0 || !member) { window.showAlert('সঠিক তথ্য দিন!'); return; }
    const formattedDate = formatActionDate(rawDate);

    if(editIndex !== "") {
        // এডিট মোড — পুরনো ডকুমেন্ট আপডেট করো
        const oldItem = appState.otherFundsLedger[Number(editIndex)];
        const docId   = oldItem._docId;
        const cashAdj = amount - Number(oldItem.amount);

        if (docId && window.updateTransactionInFirestore) {
            await window.updateTransactionInFirestore(docId, { amount, member, purpose, date: formattedDate, rawDate });
        }
        if (window.updateSomityDoc) {
            // 🔧 FIX: atomic increment() (delta)
            await window.updateSomityDoc({ cashInHand: _somityDelta(cashAdj) });
        }
    } else {
        // নতুন ফান্ড এন্ট্রি — transactions সাব-কালেকশনে সেভ করো
        if (window.addTransactionToFirestore) {
            await window.addTransactionToFirestore({
                category: 'other_fund',
                amount, member, purpose,
                date: formattedDate,
                rawDate
            });
        }
        if (window.updateSomityDoc) {
            // 🔧 FIX: atomic increment() (delta)
            await window.updateSomityDoc({ cashInHand: _somityDelta(amount) });
        }
    }
    openOtherFundModal();
}

function renderOtherFundHistory() {
    const container = document.getElementById('other-fund-history');

    if(!appState.otherFundsLedger || appState.otherFundsLedger.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-gray-400 py-4">কোন ফান্ড হিস্টোরি নেই</div>';
        return;
    }

    container.innerHTML = '';

    for(let i = appState.otherFundsLedger.length - 1; i >= 0; i--) {
        const item = appState.otherFundsLedger[i];

        container.innerHTML += `
        <div class="border rounded-xl p-3 bg-slate-50">
            <div class="flex justify-between items-start gap-2">
                <div>
                    <p class="font-bold text-amber-700 text-sm">৳ ${Number(item.amount).toLocaleString()}</p>
                    <p class="text-xs text-slate-600">সদস্য: ${item.member}</p>
                    <p class="text-xs text-slate-500">${item.purpose || 'কোন বিবরণ নেই'}</p>
                    <p class="text-xs text-gray-400 mt-1">${item.date}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="openOtherFundModal(${i})" class="text-blue-600 text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteOtherFund(${i})" class="text-red-600 text-xs font-bold"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক deleteOtherFund
async function deleteOtherFund(index) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন ফান্ড হিস্টোরি মুছতে পারবেন।'); return; }
    if(!(await window.showConfirm('আপনি কি এই ফান্ড হিস্টোরি মুছতে চান?', {icon:'🗑️'}))) return;
    const item  = appState.otherFundsLedger[index];
    const docId = item._docId;
    if (docId && window.deleteTransactionFromFirestore) {
        await window.deleteTransactionFromFirestore(docId);
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({ cashInHand: _somityDelta(-Number(item.amount)) });
    }
    openOtherFundModal();
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক editLedgerEntry (member ডকে ledger অ্যারে আপডেট)
async function editLedgerEntry(memberIndex, entryIndex) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন লেনদেন এডিট করতে পারবেন।'); return; }
    const member = appState.members[memberIndex];
    const entry  = member.ledger[entryIndex];
    const docId  = member._docId;
    const newAmount = await window.showPrompt(`"${entry.type}" এন্ট্রি সম্পাদনা করুন\nনতুন পরিমাণ লিখুন:`, entry.amount, {type:'number', icon:'✏️'});
    if(newAmount === null) return;
    const amt = Number(newAmount);
    if(isNaN(amt) || amt <= 0) { window.showAlert("সঠিক পরিমাণ দিন!"); return; }

    const diff = amt - Number(entry.amount);
    let newSavings = Number(member.savings);
    let cashAdj = 0;
    if(entry.type === 'জমা')       { newSavings += diff; cashAdj = diff; }
    else if(entry.type === 'উত্তোলন') { newSavings -= diff; cashAdj = -diff; }
    else if(entry.type === 'ভর্তি ফি' || entry.type === 'জরিমানা') { cashAdj = diff; }

    const updatedLedger = [...member.ledger];
    updatedLedger[entryIndex] = Object.assign({}, entry, { amount: amt });

    if (docId && window.updateMemberInFirestore) {
        const memberUpdate = { ledger: updatedLedger };
        if(entry.type === 'জমা' || entry.type === 'উত্তোলন') memberUpdate.savings = newSavings;
        await window.updateMemberInFirestore(docId, memberUpdate);
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({ cashInHand: _somityDelta(cashAdj) });
    }
    openLedgerModal(memberIndex);
}

// ⚡ নতুন SUB-COLLECTION ভিত্তিক deleteLedgerEntry
async function deleteLedgerEntry(memberIndex, entryIndex) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন লেনদেন মুছতে পারবেন।'); return; }
    if(!(await window.showConfirm("আপনি কি এই লেনদেনটি মুছতে চান?", {icon:'🗑️'}))) return;
    const member = appState.members[memberIndex];
    const entry  = member.ledger[entryIndex];
    const docId  = member._docId;

    let newSavings = Number(member.savings);
    let cashAdj = 0;
    if(entry.type === 'জমা')           { newSavings -= Number(entry.amount); cashAdj = -Number(entry.amount); }
    else if(entry.type === 'উত্তোলন')   { newSavings += Number(entry.amount); cashAdj =  Number(entry.amount); }
    else if(entry.type === 'ভর্তি ফি' || entry.type === 'জরিমানা') { cashAdj = -Number(entry.amount); }

    const updatedLedger = [...member.ledger];
    updatedLedger.splice(entryIndex, 1);

    if (docId && window.updateMemberInFirestore) {
        const memberUpdate = { ledger: updatedLedger };
        if(entry.type === 'জমা' || entry.type === 'উত্তোলন') memberUpdate.savings = newSavings;
        await window.updateMemberInFirestore(docId, memberUpdate);
    }
    if (window.updateSomityDoc) {
        // 🔧 FIX: atomic increment() (delta)
        await window.updateSomityDoc({ cashInHand: _somityDelta(cashAdj) });
    }
    openLedgerModal(memberIndex);
}

function openMemberSearchModal() {
    const modal = document.getElementById('member-search-modal');
    document.getElementById('member-search-input').value = '';
    filterMemberSearch();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('member-search-input').focus(), 100);
    if (window._pushModalHistory) window._pushModalHistory(() => closeMemberSearchModal());
}

function closeMemberSearchModal() {
    if (window._popModalHistory) window._popModalHistory();
    document.getElementById('member-search-modal').classList.add('hidden');
    document.getElementById('member-search-modal').classList.remove('flex');
}

function filterMemberSearch() {
    const query = document.getElementById('member-search-input').value.trim().toLowerCase();
    const container = document.getElementById('member-search-results');
    container.innerHTML = '';
    if(appState.members.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-gray-400 py-4">কোন সদস্য যোগ করা হয়নি।</div>';
        return;
    }
    const filtered = appState.members.filter(m =>
        m.status !== 'closed' && (m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
    );
    if(filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-gray-400 py-4">কোন সদস্য পাওয়া যায়নি।</div>';
        return;
    }
    filtered.forEach(m => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer transition';
        div.innerHTML = `<div><p class="font-bold text-slate-800 text-sm">${m.name}</p><p class="text-xs text-gray-500 font-mono">আইডি: ${m.id}</p></div><span class="text-emerald-600 font-bold text-xs">সিলেক্ট</span>`;
        div.onclick = () => {
            document.getElementById('qd-member-id').value = m.id;
            document.getElementById('qd-member-name').value = m.name;
            const balWrap = document.getElementById('qd-balance-display');
            if (balWrap) {
                document.getElementById('qd-balance-amount').textContent = _toBanglaNumber(Number(m.savings || 0).toLocaleString());
                balWrap.classList.remove('hidden');
            }
            closeMemberSearchModal();
        };
        container.appendChild(div);
    });
}

// ===== নোটিশ ম্যানেজমেন্ট =====

function toggleNoticePanel() {
    var panel = document.getElementById('notice-panel');
    var card = document.getElementById('notice-card');
    var notifPanel = document.getElementById('notif-history-panel');
    if (notifPanel) notifPanel.style.display = 'none';
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        card.style.display = 'none';
        renderNotices();
    } else {
        panel.style.display = 'none';
        renderNoticeCard();
    }
}

function _getNoticeVoteKey(i) {
    // প্রতিটি নোটিশের জন্য আলাদা ভোট key (sessionStorage থেকে পড়া হবে)
    return 'notice_vote_' + (window.currentSomityId || 'x') + '_' + i;
}

// ✅ FIX: পুরনো নোটিশ (যেগুলো id ফিচার আসার আগে তৈরি হয়েছিল) এর জন্য একটা স্থায়ী id
// লক করে দেয় — বর্তমান array index-টাকেই স্থায়ী id বানিয়ে নেয়, যাতে এর আগের সব
// ভোট (যেগুলো সেই index দিয়েই সেভ হয়েছিল) ঠিকভাবে মিলতে থাকে। একবার id বসে গেলে,
// অন্য কোনো নোটিশ ডিলিট হয়ে index বদলে গেলেও, এই নোটিশের ভোট ভুল জায়গায় যাবে না।
async function _ensureNoticeId(i) {
    if (!appState.notices || !appState.notices[i]) return null;
    var n = appState.notices[i];
    if (n.id) return n.id;
    n.id = 'notice_' + i; // বর্তমান index-টাই স্থায়ী id হিসেবে লক করা হলো
    if (window.updateSomityDoc) {
        try { await window.updateSomityDoc({ notices: appState.notices }); } catch(e) { console.warn('[Notice] id migrate ব্যর্থ:', e); }
    }
    return n.id;
}

async function voteNotice(i, type) {
    // type: 'yes' অথবা 'no'
    if (!appState.notices || !appState.notices[i]) return;
    var n = appState.notices[i];
    var noticeId = await _ensureNoticeId(i); // ✅ FIX: স্থায়ী id ব্যবহার করো, array index না

    // বর্তমান ইউজারের uid বা fallback key
    var uid = (window.currentUser && window.currentUser.uid) ? window.currentUser.uid : 'anon_' + (navigator.userAgent.length);

    // ✅ FIX: ভোট সরাসরি somities মূল ডকুমেন্টে না লিখে votes sub-collection এ সেভ করো
    // সকল সদস্য votes sub-collection এ লিখতে পারবে
    try {
        const fns = window._firebaseFns;
        const dbRef = window._firebaseDb;
        if (fns && dbRef && window.currentSomityId) {
            const voteRef = fns.doc(dbRef, 'somities', window.currentSomityId, 'votes', noticeId + '_' + uid);
            const existing = await fns.getDoc(voteRef);
            if (existing.exists() && existing.data().type === type) {
                // একই ভোটে আবার চাপলে প্রত্যাহার করো
                await _writeNoBlock(fns.deleteDoc(voteRef));
            } else {
                await _writeNoBlock(fns.setDoc(voteRef, {
                    noticeId: noticeId,
                    noticeIndex: i,
                    userId: uid,
                    type: type,
                    createdAt: fns.serverTimestamp()
                }));
            }
        }
    } catch(e) {
        console.error('[Vote] সেভ ব্যর্থ:', e);
        // fallback: local state এ রাখো
        if (!n.votes) n.votes = { yes: 0, no: 0, voters: {} };
        if (!n.votes.voters) n.votes.voters = {};
        var prevVote = n.votes.voters[uid];
        if (prevVote === type) {
            n.votes[type] = Math.max(0, (n.votes[type] || 0) - 1);
            delete n.votes.voters[uid];
        } else {
            if (prevVote) n.votes[prevVote] = Math.max(0, (n.votes[prevVote] || 0) - 1);
            n.votes[type] = (n.votes[type] || 0) + 1;
            n.votes.voters[uid] = type;
        }
        appState.notices[i] = n;
        renderNotices();
        renderNoticeCard();
        return;
    }

    // onSnapshot লিসেনার votes আপডেট করে renderNotices() করবে
    // তবে দ্রুত optimistic UI আপডেটের জন্য local state ও আপডেট করো
    if (!n.votes) n.votes = { yes: 0, no: 0, voters: {} };
    if (!n.votes.voters) n.votes.voters = {};
    var prevVote2 = n.votes.voters[uid];
    if (prevVote2 === type) {
        n.votes[type] = Math.max(0, (n.votes[type] || 0) - 1);
        delete n.votes.voters[uid];
    } else {
        if (prevVote2) n.votes[prevVote2] = Math.max(0, (n.votes[prevVote2] || 0) - 1);
        n.votes[type] = (n.votes[type] || 0) + 1;
        n.votes.voters[uid] = type;
    }
    appState.notices[i] = n;
    renderNotices();
    renderNoticeCard();
}

function _buildVoteHtml(n, i) {
    var votes = n.votes || { yes: 0, no: 0, voters: {} };
    var uid = (window.currentUser && window.currentUser.uid) ? window.currentUser.uid : '';
    var myVote = uid && votes.voters ? votes.voters[uid] : '';
    var yesCount = votes.yes || 0;
    var noCount  = votes.no  || 0;

    var yesStyle = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all .15s;' +
        (myVote === 'yes'
            ? 'background:#22c55e;color:#fff;box-shadow:0 2px 6px rgba(34,197,94,.35);'
            : 'background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;');
    var noStyle  = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all .15s;' +
        (myVote === 'no'
            ? 'background:#ef4444;color:#fff;box-shadow:0 2px 6px rgba(239,68,68,.35);'
            : 'background:#fff1f2;color:#dc2626;border:1.5px solid #fecaca;');

    return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">' +
        '<button onclick="voteNotice(' + i + ',\'yes\')" style="' + yesStyle + '">👍 হ্যাঁ' +
            (yesCount > 0 ? ' <span style="background:rgba(255,255,255,.35);border-radius:10px;padding:0 5px;font-size:11px;">' + yesCount + '</span>' : '') +
        '</button>' +
        '<button onclick="voteNotice(' + i + ',\'no\')" style="' + noStyle + '">👎 না' +
            (noCount > 0 ? ' <span style="background:rgba(255,255,255,.35);border-radius:10px;padding:0 5px;font-size:11px;">' + noCount + '</span>' : '') +
        '</button>' +
        '</div>';
}

function renderNotices() {
    var list = document.getElementById('notice-list');
    var empty = document.getElementById('notice-empty');
    list.innerHTML = '';
    if (!appState.notices || appState.notices.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    appState.notices.forEach(function(n, i) {
        list.innerHTML += '<div style="padding:10px 0;border-bottom:1px dashed #ffe082;">' +
            '<div style="display:flex;align-items:flex-start;gap:8px;">' +
            '<span style="font-size:1rem;margin-top:1px;">📌</span>' +
            '<span style="flex:1;font-size:13px;color:#4e342e;line-height:1.6;">' + n.text + '</span>' +
            (window.isAdminVerified() ? '<button onclick="deleteNotice(' + i + ')" style="background:none;border:none;color:#e53935;font-size:1rem;cursor:pointer;padding:0 2px;flex-shrink:0;">🗑</button>' : '') +
            '</div>' +
            _buildVoteHtml(n, i) +
            '</div>';
    });
}

function renderNoticeCard() {
    var card = document.getElementById('notice-card');
    var body = document.getElementById('notice-card-body');
    var panel = document.getElementById('notice-panel');
    // ✅ FIX: ম্যানেজ প্যানেল (notice-panel) খোলা থাকলে নোটিশ কার্ড (notice-card) জোর করে
    // আবার দেখানো উচিত না। renderNoticeCard() ব্যাকগ্রাউন্ডে বারবার কল হয় (যেকোনো ভোট/
    // ডেটা পরিবর্তনে) — আগে এই চেক না থাকায়, কেউ একবার "ম্যানেজ" প্যানেল খুললে এবং তারপর
    // ব্যাকগ্রাউন্ডে কোনো আপডেট এলে, প্যানেল বন্ধ না করেই কার্ডটাও আবার দেখা যেত — তখন দুটো
    // কার্ডই (একসাথে দুইবার একই নোটিশ) দেখা যেত।
    if (panel && panel.style.display === 'block') {
        return;
    }
    if (!appState.notices || appState.notices.length === 0) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';
    // প্রতিটি নোটিশের জন্য ভোট বাটনসহ রেন্ডার করো
    body.innerHTML = appState.notices.map(function(n, i) {
        return '<div style="padding:6px 0 4px 0;border-bottom:1px dashed #fde68a;margin-bottom:4px;">' +
            '<div style="font-size:13px;color:#1e293b;line-height:1.6;margin-bottom:2px;">📌 ' + n.text + '</div>' +
            '</div>';
    }).join('');
    // ভোট বাটন ইনপুট রোতে দেখাও (প্রথম নোটিশের জন্য)
    var voteRow = document.getElementById('notice-vote-row');
    if (voteRow) {
        if (appState.notices && appState.notices.length > 0) {
            voteRow.innerHTML = _buildVoteHtml(appState.notices[0], 0);
        } else {
            voteRow.innerHTML = '';
        }
    }
    renderOpinions();
}

async function addNotice() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন নোটিশ যুক্ত করতে পারবেন।'); return; }
    var text = await window.showPrompt('নতুন নোটিশ লিখুন:', '', {icon:'📢'});
    if (!text || !text.trim()) return;
    if (!appState.notices) appState.notices = [];
    // ✅ FIX: প্রতিটি নোটিশের জন্য একটা স্থায়ী id দেওয়া হলো — এটা কখনো বদলাবে না,
    // even যদি অন্য কোনো নোটিশ মুছে যাওয়ায় এর array index বদলে যায়। আগে ভোট
    // array index দিয়ে মেলানো হতো, তাই কোনো নোটিশ ডিলিট করলে পরের সব নোটিশের
    // ভোট ভুল নোটিশের সাথে মিলে যেত — এই স্থায়ী id দিয়ে সেটা স্থায়ীভাবে বন্ধ হলো।
    appState.notices.push({ text: text.trim(), id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) });
    if (window.updateSomityDoc) window.updateSomityDoc({ notices: appState.notices });
    renderNotices();
    renderNoticeCard();
}

// 🔔 সব সদস্যকে Push Notification পাঠানো
window.sendPushNotification = async function() {
    if (!window.isAdminVerified()) {
        window.showAlert('শুধুমাত্র এডমিন notification পাঠাতে পারবেন।');
        return;
    }
    const title = await window.showPrompt('Notification-এর শিরোনাম:', 'ডিজিটাল সমিতি ম্যানেজার', {icon:'🔔'});
    if (!title || !title.trim()) return;
    const body = await window.showPrompt('Notification-এর বার্তা:', '', {icon:'📝'});
    if (!body || !body.trim()) return;

    const confirmed = await window.showConfirm(
        `"${title.trim()}"\n${body.trim()}\n\nসব সদস্যকে এই notification পাঠাবেন?`,
        { icon: '🔔', okText: 'পাঠান', danger: false }
    );
    if (!confirmed) return;

    try {
        // Firestore থেকে সব approved সদস্যের তথ্য সংগ্রহ করো
        const fns = window._firebaseFns;
        const db2 = window._firebaseDb;
        const somityId = window.currentSomityId;
        if (!fns || !db2 || !somityId) {
            window.showAlert('Firebase সংযোগ পাওয়া যাচ্ছে না।');
            return;
        }
        const usersSnap = await fns.getDocs(
            fns.query(
                fns.collection(db2, 'users'),
                fns.where('somityId', '==', somityId),
                fns.where('status', '==', 'approved')
            )
        );
        const tokens = [];      // [{uid, name, token}] — যাদের token আছে
        const neverEnabled = []; // [name] — যাদের কখনো token-ই নেই (notification চালু করেননি)
        usersSnap.forEach(d => {
            const data = d.data();
            const t = data.fcmToken;
            const nm = data.name || 'নাম নেই';
            if (t) tokens.push({ uid: d.id, name: nm, token: t });
            else neverEnabled.push(nm);
        });

        if (tokens.length === 0) {
            window.showAlert('⚠️ কোনো সদস্যের notification চালু নেই।\n\nসদস্যদের বলুন একবার অ্যাপ খুলে notification-এ Allow দিতে।');
            return;
        }

        // Netlify Function কল করো
        const resp = await fetch('/.netlify/functions/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title.trim(), body: body.trim(), tokens })
        });
        const result = await resp.json();

        if (resp.ok && result.success) {
            // ✅ FIX: বিস্তারিত রিপোর্ট — কে পেয়েছে, কে পায়নি কেন, কে কখনো চালুই করেনি
            let msg = `✅ Notification পাঠানো হয়েছে!\n${result.sent} জনের কাছে সফল।`;
            if (Array.isArray(result.failures) && result.failures.length > 0) {
                msg += `\n\n⚠️ যাদের কাছে পৌঁছায়নি (${result.failures.length} জন):\n`;
                msg += result.failures.map(f => `• ${f.name || 'অজানা'} — ${f.reason}`).join('\n');

                // ✅ স্থায়ীভাবে বাতিল হওয়া token (UNREGISTERED) স্বয়ংক্রিয়ভাবে পরিষ্কার করো,
                // যাতে পরের বার আর এই মৃত token-এর জন্য চেষ্টা না হয় (অ্যাপ পরে খুললে
                // নতুন token নিজে থেকেই আবার সেভ হয়ে যাবে)
                const deadOnes = result.failures.filter(f => f.uid && /UNREGISTERED|NOT_FOUND/i.test(f.reason || ''));
                for (const f of deadOnes) {
                    try { await fns.updateDoc(fns.doc(db2, 'users', f.uid), { fcmToken: '' }); } catch(_) {}
                }
            }
            if (neverEnabled.length > 0) {
                msg += `\n\n📵 কখনো notification চালু করেননি (${neverEnabled.length} জন):\n`;
                msg += neverEnabled.map(n => `• ${n}`).join('\n');
            }
            window.showAlert(msg);
        } else {
            window.showAlert('❌ Notification পাঠাতে সমস্যা: ' + (result.error || 'অজানা সমস্যা'));
        }
    } catch(e) {
        console.error('[Push] ব্যর্থ:', e);
        window.showAlert('❌ Notification পাঠাতে সমস্যা হয়েছে: ' + e.message);
    }
};

async function deleteNotice(i) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন নোটিশ মুছতে পারবেন।'); return; }
    if (!(await window.showConfirm('এই নোটিশটি মুছবেন? এর সাথে যুক্ত সব ভোট ও মতামতও মুছে যাবে।', {icon:'🗑️'}))) return;

    // ✅ FIX: নোটিশের সাথে যুক্ত ভোট (votes) ও মতামত (opinions) — দুটো sub-collection
    // থেকেই আগে মুছে ফেলো, না হলে এগুলো orphan হয়ে থেকে যেত (মুছে ফেলা নোটিশের
    // ভোট/মতামত অন্য নোটিশের সাথে ভুলভাবে যুক্ত হয়ে যাওয়ার ঝুঁকি ছিল আগের
    // array index ভিত্তিক সিস্টেমে)
    try {
        const noticeId = await _ensureNoticeId(i);
        const fns = window._firebaseFns;
        const dbRef = window._firebaseDb;
        if (noticeId && fns && dbRef && window.currentSomityId) {
            const votesRef = fns.collection(dbRef, 'somities', window.currentSomityId, 'votes');
            const votesQ = fns.query(votesRef, fns.where('noticeId', '==', noticeId));
            const voteSnap = await fns.getDocs(votesQ);
            const deletions = [];
            voteSnap.forEach(d => deletions.push(fns.deleteDoc(d.ref)));

            const opinionsRef = fns.collection(dbRef, 'somities', window.currentSomityId, 'opinions');
            const opinionsQ = fns.query(opinionsRef, fns.where('noticeId', '==', noticeId));
            const opinionSnap = await fns.getDocs(opinionsQ);
            opinionSnap.forEach(d => deletions.push(fns.deleteDoc(d.ref)));

            await Promise.all(deletions);
        }
    } catch(e) {
        console.warn('[Notice] যুক্ত ভোট/মতামত মুছতে সমস্যা হয়েছে (নোটিশ তবুও মুছে যাবে):', e);
    }

    appState.notices.splice(i, 1);
    if (window.updateSomityDoc) window.updateSomityDoc({ notices: appState.notices });
    renderNotices();
    renderNoticeCard();
}

// ===== মতামত ফিচার =====

// লগইন করা সদস্যের নাম বের করো (প্রোফাইল থেকে অটো)
function _getCurrentMemberName() {
    var uid = window.currentUser && window.currentUser.uid;
    if (!uid) return '';

    // ০. প্রোফাইলে সেট করা নাম — সবচেয়ে নির্ভরযোগ্য (users/{uid} থেকে ক্যাশ)
    if (window.currentUserName && window.currentUserName.trim()) return window.currentUserName.trim();

    // ১. appState.members থেকে userId মিলিয়ে খোঁজো
    if (window.appState && Array.isArray(window.appState.members)) {
        var found = window.appState.members.find(function(m) {
            return m.userId === uid || m._docId === uid;
        });
        if (found && found.name) return found.name;
    }

    // ২. Firebase Auth displayName
    if (window.currentUser.displayName) return window.currentUser.displayName;

    // ৩. ইমেইলের প্রথম অংশ (শেষ ফলব্যাক)
    if (window.currentUser.email) return window.currentUser.email.split('@')[0];

    return '';
}

// opinion-name ফিল্ড আর নেই — নাম প্রোফাইল থেকে সরাসরি নেওয়া হয়
function autoFillOpinionName() {
    // deprecated: নাম এখন submitOpinion()-এ _getCurrentMemberName() দিয়ে নেওয়া হয়
}

async function submitOpinion() {
    // প্রোফাইল থেকে নাম অটোমেটিক নিন
    var name = _getCurrentMemberName();
    var text = (document.getElementById('opinion-text').value || '').trim();
    if (!name) { window.showAlert('অনুগ্রহ করে প্রথমে লগইন করুন!'); return; }
    if (!text) { window.showAlert('মতামত লিখুন!'); return; }
    var now = new Date().toLocaleString('bn-BD', {hour12: true});
    var uid = window.currentUser && window.currentUser.uid ? window.currentUser.uid : '';

    // ✅ FIX: কোন নোটিশের জন্য এই মতামত — সেই নোটিশের স্থায়ী id সেভ করো,
    // যাতে নোটিশ মুছলে তার মতামতও সাথে মুছে ফেলা যায় (আগে এই লিংক ছিলোই না,
    // তাই সব মতামত একসাথে মিশে থাকতো, কোনো নির্দিষ্ট নোটিশের সাথে যুক্ত ছিল না)
    var currentNoticeId = (appState.notices && appState.notices[0]) ? await _ensureNoticeId(0) : null;

    // ✅ FIX: মূল somities ডকুমেন্টের বদলে sub-collection এ সেভ করো
    // সকল সদস্য opinions sub-collection এ লিখতে পারবে (Firestore rules অনুযায়ী)
    try {
        const fns = window._firebaseFns;
        const dbRef = window._firebaseDb;
        if (fns && dbRef && window.currentSomityId) {
            const opinionData = { name: name, text: text, date: now, userId: uid, noticeId: currentNoticeId, createdAt: fns.serverTimestamp() };
            await _offlineSafeAddDoc(['somities', window.currentSomityId, 'opinions'], opinionData);
        }
    } catch(e) {
        console.error('[Opinion] সেভ ব্যর্থ:', e);
        window.showAlert('মতামত সেভ হয়নি। আবার চেষ্টা করুন।');
        return;
    }

    document.getElementById('opinion-text').value = '';
    // renderOpinions() — onSnapshot লিসেনার নিজেই আপডেট করবে
}

async function deleteOpinion(i) {
    var myUid = window.currentUser && window.currentUser.uid ? window.currentUser.uid : '';
    var op = appState.opinions && appState.opinions[i];
    var isMe = myUid && op && op.userId === myUid;

    if (!window.isAdminVerified() && !isMe) { window.showAlert('শুধুমাত্র এডমিন বা নিজের মতামত মুছতে পারবেন।'); return; }
    if (!(await window.showConfirm('এই মতামতটি মুছবেন?', {icon:'🗑️'}))) return;

    // ✅ FIX: sub-collection থেকে মুছো
    try {
        var docId = op && op._docId;
        if (docId && window._firebaseFns && window._firebaseDb && window.currentSomityId) {
            const fns = window._firebaseFns;
            const dbRef = window._firebaseDb;
            const ref = fns.doc(dbRef, 'somities', window.currentSomityId, 'opinions', docId);
            await _writeNoBlock(fns.deleteDoc(ref));
        } else {
            // fallback: local array থেকে মুছো (legacy)
            appState.opinions.splice(i, 1);
            renderOpinions();
        }
    } catch(e) {
        console.error('[Opinion] মুছতে ব্যর্থ:', e);
        window.showAlert('মতামত মুছা হয়নি। আবার চেষ্টা করুন।');
    }
    // onSnapshot লিসেনার নিজেই renderOpinions() করবে
}

function renderOpinions() {
    var list = document.getElementById('opinion-list');
    if (!list) return;

    // ✅ FIX: শুধু বর্তমানে দেখানো নোটিশের সাথে যুক্ত মতামতই দেখাও (অন্য
    // নোটিশের মতামত এখানে মিশে যাবে না, এবং নোটিশ মুছলে তার মতামতও মুছে যাবে)
    var currentNoticeId = (appState.notices && appState.notices[0]) ? (appState.notices[0].id || 'notice_0') : null;
    var filtered = [];
    (appState.opinions || []).forEach(function(op, idx) {
        if (currentNoticeId && op.noticeId === currentNoticeId) filtered.push({ op: op, idx: idx });
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="font-size:11px;color:#bbb;text-align:center;padding:6px 0;">এখনো কোনো মতামত নেই।</div>';
        return;
    }
    list.innerHTML = '';
    var myUid = window.currentUser && window.currentUser.uid ? window.currentUser.uid : '';
    var opts = filtered.slice().reverse();
    opts.forEach(function(entry) {
        var op = entry.op;
        var i  = entry.idx; // ✅ ফিল্টার করা subset-এর index না, আসল (ফুল array) index
        var isMe = myUid && op.userId === myUid;

        // সদস্যের avatar — appState.members থেকে খোঁজো
        var avatarHtml = '';
        if (window.appState && Array.isArray(window.appState.members)) {
            var mem = window.appState.members.find(function(m) {
                return op.userId && (m.userId === op.userId || m._docId === op.userId);
            });
            if (mem && mem.photoUrl) {
                avatarHtml = '<img src="' + mem.photoUrl + '" alt="' + op.name + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1.5px solid #fbbf24;flex-shrink:0;">';
            } else {
                var initial = (op.name || '?').charAt(0).toUpperCase();
                avatarHtml = '<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;color:#1e3a8a;font-weight:900;font-size:11px;flex-shrink:0;">' + initial + '</div>';
            }
        } else {
            var initial2 = (op.name || '?').charAt(0).toUpperCase();
            avatarHtml = '<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;color:#1e3a8a;font-weight:900;font-size:11px;flex-shrink:0;">' + initial2 + '</div>';
        }

        var cardBg = isMe ? '#eff6ff' : '#fff8e1';
        var nameBorderColor = isMe ? '#3b82f6' : 'transparent';

        list.innerHTML += '<div style="background:' + cardBg + ';border-radius:10px;padding:7px 10px;margin-bottom:6px;position:relative;border-left:3px solid ' + (isMe ? '#3b82f6' : '#fbbf24') + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
            avatarHtml +
            '<span style="font-size:12px;font-weight:700;color:' + (isMe ? '#1d4ed8' : '#e65100') + ';">' + op.name + (isMe ? ' <span style="font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:8px;padding:0 5px;">আপনি</span>' : '') + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:4px;">' +
            '<span style="font-size:10px;color:#bbb;">' + op.date + '</span>' +
            (window.isAdminVerified() || isMe ? '<button onclick="deleteOpinion(' + i + ')" style="background:none;border:none;color:#e53935;font-size:.85rem;cursor:pointer;padding:0 0 0 6px;">🗑</button>' : '') +
            '</div>' +
            '</div>' +
            '<div style="font-size:12px;color:#4e342e;line-height:1.5;">' + op.text + '</div>' +
            '</div>';
    });
}

// ⚡ Initial render — Firebase লোড হওয়ার আগে খালি UI দেখাবে।
// startFirestoreListener() চালু হলে onSnapshot → renderUI() স্বয়ংক্রিয়ভাবে আপডেট করবে।
renderUI();
renderNoticeCard();
renderOpinions();
renderNotifHistory();
// পুরনো unread notification থাকলে badge দেখাও
if (_notifHistory.length > 0) {
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'block';
}


// =====================================================================
// 👑 SUPER ADMIN — মাস্টার প্যানেল ফাংশনসমূহ
// =====================================================================

async function superAdminLoadSomities() {
    if (!window.isSuperAdmin()) { console.warn('🔒 Access Denied'); return; }

    const listEl   = document.getElementById('sa-somities-list');
    const totalEl  = document.getElementById('sa-total-somities');
    const activeEl = document.getElementById('sa-active-somities');

    listEl.innerHTML = `
        <div style="text-align:center;padding:30px;color:#a5b4fc;">
            <div style="width:36px;height:36px;border:3px solid rgba(165,180,252,0.3);border-top-color:#a5b4fc;border-radius:50%;animation:fa-spin 0.8s linear infinite;margin:0 auto 12px;"></div>
            লোড হচ্ছে...
        </div>`;

    const { getDocs, getDoc, collection, doc: docFn2 } = window._firebaseFns;
    const db = window._firebaseDb;

    let snap;
    try {
        snap = await getDocs(collection(db, 'somities'));
    } catch(e) {
        listEl.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;">❌ লোড করতে ব্যর্থ: ${e.message}</div>`;
        return;
    }

    if (snap.empty) {
        totalEl.textContent  = '0';
        activeEl.textContent = '0';
        listEl.innerHTML = `<div style="text-align:center;padding:30px;color:#64748b;">কোনো সমিতি পাওয়া যায়নি।</div>`;
        return;
    }

    const somities = [];
    snap.forEach(d => somities.push({ id: d.id, ...d.data() }));

    // 📱 প্রতিটা সমিতির মালিকের ফোন নম্বর users/{uid} ডক থেকে নিয়ে আসো
    // (somities ডকে ফোন সরাসরি সেভ থাকে না, users ডকেই থাকে)
    await Promise.all(somities.map(async (s) => {
        if (!s.ownerUid) return;
        try {
            const uSnap = await getDoc(docFn2(db, 'users', s.ownerUid));
            if (uSnap.exists()) s._ownerPhone = uSnap.data().phone || '';
        } catch(_e) { /* ফোন না পেলেও তালিকা লোড থামবে না */ }
    }));
    somities.sort((a, b) => (a.somityName || a.name || '').localeCompare(b.somityName || b.name || '', 'bn'));

    totalEl.textContent  = somities.length;
    const now = Date.now();
    const activeCount = somities.filter(s => {
        if (s.status === 'active') return true;
        if (s.status === 'trial' && (s.trialEndDate || s.subscriptionValidUntil || 0) > now) return true;
        return false;
    }).length;
    activeEl.textContent = activeCount;

    listEl.innerHTML = somities.map(s => {
        const expiryTs  = s.subscriptionValidUntil || s.trialEndDate || 0;
        const expiryStr = expiryTs
            ? new Date(expiryTs).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })
            : '—';
        const isExpired = expiryTs && now > expiryTs;
        const statusLabel = s.status === 'active'  ? '✅ সক্রিয়'
                          : s.status === 'trial'   ? (isExpired ? '🔴 মেয়াদ শেষ (ট্রায়াল)' : '🟡 ট্রায়াল')
                          : s.status === 'expired' ? '🔴 মেয়াদ শেষ'
                          : s.status === 'locked'  ? '🔒 লক'
                          : '⚪ ' + (s.status || 'অজানা');

        return `
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:16px;transition:.2s;" id="sa-card-${s.id}">
            <!-- সমিতির তথ্য -->
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:14px;font-weight:800;color:#e2e8f0;line-height:1.4;word-break:break-word;">${s.somityName || s.name || 'নামহীন সমিতি'}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:3px;font-family:monospace;letter-spacing:.5px;">🔑 ${s.code || s.somityCode || s.id}</div>
                    ${s._ownerPhone ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">📱 ${s._ownerPhone}</div>` : ''}
                </div>
                <span style="flex-shrink:0;font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.08);color:#c4b5fd;white-space:nowrap;">${statusLabel}</span>
            </div>

            <!-- মেয়াদ তথ্য -->
            <div style="background:rgba(0,0,0,0.25);border-radius:10px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:11px;color:#94a3b8;font-weight:600;">📅 বর্তমান মেয়াদ:</span>
                <span style="font-size:12px;font-weight:700;color:${isExpired ? '#f87171' : '#86efac'};">${expiryStr}</span>
            </div>

            <!-- অ্যাকশন বাটন -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                <button onclick="superAdminExtend('${s.id}', 30)"
                    style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:10px;padding:10px 8px;font-size:12px;font-weight:700;cursor:pointer;line-height:1.4;">
                    ➕ ১ মাস বাড়ান<br><span style="font-size:10px;opacity:.85;">(৩০ দিন)</span>
                </button>
                <button onclick="superAdminExtend('${s.id}', 365)"
                    style="background:linear-gradient(135deg,#7c3aed,#4338ca);color:#fff;border:none;border-radius:10px;padding:10px 8px;font-size:12px;font-weight:700;cursor:pointer;line-height:1.4;">
                    🚀 ১ বছর বাড়ান<br><span style="font-size:10px;opacity:.85;">(৩৬৫ দিন)</span>
                </button>
            </div>
            <button onclick="superAdminDeleteSomity('${s.id}', '${(s.somityName || s.name || 'নামহীন সমিতি').replace(/'/g, "\\'")}')"
                style="width:100%;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:8px;font-size:11px;font-weight:700;cursor:pointer;">
                🗑️ এই সমিতি মুছে ফেলুন (অব্যবহৃত/টেস্ট আইডি)
            </button>
        </div>`;
    }).join('');
}

async function superAdminExtend(somityId, days) {
    if (!window.isSuperAdmin()) { window.showAlert('🔒 অ্যাক্সেস নিষিদ্ধ।'); return; }
    if (!(await window.showConfirm(`এই সমিতির মেয়াদ ${days} দিন বাড়াবেন?`, {danger:false, icon:'📅'}))) return;

    const { doc, getDoc, updateDoc } = window._firebaseFns;
    const db = window._firebaseDb;
    const ref = doc(db, 'somities', somityId);

    try {
        // বর্তমান মেয়াদ বের করো
        const snap = await getDoc(ref);
        if (!snap.exists()) { window.showAlert('সমিতি পাওয়া যায়নি!'); return; }
        const data = snap.data();

        const now = Date.now();
        // যদি বর্তমান মেয়াদ ভবিষ্যতে থাকে সেখান থেকে বাড়াও, নইলে আজ থেকে বাড়াও
        const currentExpiry = data.subscriptionValidUntil || data.trialEndDate || 0;
        const baseTs = currentExpiry > now ? currentExpiry : now;
        const newExpiry = baseTs + days * 24 * 60 * 60 * 1000;

        // দুটো ফিল্ড-ই আপডেট করো (trialEndDate ও subscriptionValidUntil) — উভয় চেক পয়েন্টে কাজ করবে
        await updateDoc(ref, {
            subscriptionValidUntil : newExpiry,
            trialEndDate           : newExpiry,
            status                 : 'active',
        });

        // কার্ডে নতুন মেয়াদ দেখাও
        const newDateStr = new Date(newExpiry).toLocaleDateString('bn-BD', { year:'numeric', month:'long', day:'numeric' });
        window.showAlert(`✅ সফল! নতুন মেয়াদ: ${newDateStr}`);

        // তালিকা রিফ্রেশ
        superAdminLoadSomities();

    } catch(e) {
        window.showAlert('❌ আপডেট ব্যর্থ: ' + e.message);
    }
}

// Global exposure for super admin functions
try{window.superAdminLoadSomities = superAdminLoadSomities;}catch(e){}
try{window.superAdminExtend = superAdminExtend;}catch(e){}

// 🗑️ অব্যবহৃত/টেস্ট সমিতি সম্পূর্ণ মুছে ফেলা (সব সাব-কালেকশন + মূল ডক + লিংকড users ডক)
async function superAdminDeleteSomity(somityId, somityName) {
    if (!window.isSuperAdmin()) { window.showAlert('🔒 অ্যাক্সেস নিষিদ্ধ।'); return; }

    // 🔒 বাড়তি সতর্কতা: টাইপ করে নিশ্চিত করতে হবে (স্থায়ীভাবে মুছে যাবে, ফিরিয়ে আনা যাবে না)
    const typed = await window.showPrompt(
        `⚠️ এই কাজটি স্থায়ী — "${somityName}"-এর সব তথ্য (সদস্য, লেনদেন, বিনিয়োগ ইত্যাদি) চিরতরে মুছে যাবে, ফিরিয়ে আনা যাবে না।\n\n` +
        `নিশ্চিত করতে সমিতির নাম হুবহু টাইপ করুন:`,
        '', { type: 'text', icon: '🗑️', title: 'সমিতি মুছে ফেলা নিশ্চিত করুন' }
    );
    if (typed === null) return;
    if (typed.trim() !== somityName.trim()) {
        window.showAlert('⚠️ নাম মিলেনি — মুছে ফেলা বাতিল করা হলো।');
        return;
    }

    const { doc, getDoc, getDocs, collection, deleteDoc, writeBatch } = window._firebaseFns;
    const db = window._firebaseDb;

    try {
        // ১. মালিকের ownerUid বের করো (users ডক মুছতে লাগবে)
        const somityRef = doc(db, 'somities', somityId);
        const somitySnap = await getDoc(somityRef);
        const ownerUid = somitySnap.exists() ? somitySnap.data().ownerUid : null;

        // ২. সব সাব-কালেকশনের ডকুমেন্ট মুছো (ব্যাচে, ৪০০টা করে)
        const subcollections = ['members', 'investments', 'expenses', 'transactions', 'opinions', 'votes'];
        for (const subName of subcollections) {
            const subSnap = await getDocs(collection(db, 'somities', somityId, subName));
            if (subSnap.empty) continue;
            const docs = subSnap.docs;
            for (let i = 0; i < docs.length; i += 400) {
                const batch = writeBatch(db);
                docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }

        // ৩. মূল সমিতি ডকুমেন্ট মুছো
        await deleteDoc(somityRef);

        // ৪. লিংকড users ডকুমেন্ট মুছো (থাকলে)
        if (ownerUid) {
            try { await deleteDoc(doc(db, 'users', ownerUid)); } catch(_e) {}
        }

        window.showAlert(`✅ "${somityName}" সম্পূর্ণভাবে মুছে ফেলা হয়েছে।\n\nℹ️ নোট: এর লগইন অ্যাকাউন্ট (Firebase Authentication) নিরাপত্তার কারণে ক্লায়েন্ট থেকে মুছা যায় না — কিন্তু আর কোনো ডেটা না থাকায় লগইন করলেও কিছুই দেখাবে না।`);
        superAdminLoadSomities();
    } catch(e) {
        window.showAlert('❌ মুছতে ব্যর্থ: ' + e.message);
    }
}
try{window.superAdminDeleteSomity = superAdminDeleteSomity;}catch(e){}

// =====================================================================

// Global exposure for inline HTML handlers
try{window.addNotice=addNotice;}catch(e){}
try{window.autoFillMemberName=autoFillMemberName;}catch(e){}
try{window.clearAllDataWithPassword=clearAllDataWithPassword;}catch(e){}
try{window.clearNotifHistory=clearNotifHistory;}catch(e){}
try{window.closeActionModal=closeActionModal;}catch(e){}
try{window.closeBankLedgerModal=closeBankLedgerModal;}catch(e){}
try{window.closeExpenseLedgerModal=closeExpenseLedgerModal;}catch(e){}
try{window.closeExportModal=closeExportModal;}catch(e){}
try{window.closeFundDropdown=closeFundDropdown;}catch(e){}
try{window.closeLedgerModal=closeLedgerModal;}catch(e){}
try{window.closeMemberSearchModal=closeMemberSearchModal;}catch(e){}
try{window.closeModal=closeModal;}catch(e){}
try{window.closeMonthlyReportModal=closeMonthlyReportModal;}catch(e){}
try{window.closeOtherFundModal=closeOtherFundModal;}catch(e){}
try{window.closeQuickDepositModal=closeQuickDepositModal;}catch(e){}
try{window.closeTxnModal=closeTxnModal;}catch(e){}
try{window.copySomityCode=copySomityCode;}catch(e){}
try{window.copyToClipboard=copyToClipboard;}catch(e){}
try{window.downloadReportCSV=downloadReportCSV;}catch(e){}
try{window.downloadReportPDF=downloadReportPDF;}catch(e){}
try{window.downloadMemberListPDF=downloadMemberListPDF;}catch(e){}
try{window.downloadBankLedgerPDF=downloadBankLedgerPDF;}catch(e){}
try{window.downloadExpenseLedgerPDF=downloadExpenseLedgerPDF;}catch(e){}
try{window.downloadInvestmentLedgerPDF=downloadInvestmentLedgerPDF;}catch(e){}
try{window.exportDataBackup=exportDataBackup;}catch(e){}
try{window.filterMemberSearch=filterMemberSearch;}catch(e){}
try{window.generateMonthlyReport=generateMonthlyReport;}catch(e){}
try{window.handleBankAction=handleBankAction;}catch(e){}
try{window.handleExpenseSubmit=handleExpenseSubmit;}catch(e){}
try{window.handleInvestmentSubmit=handleInvestmentSubmit;}catch(e){}
try{window.renderInvestmentLedger=renderInvestmentLedger;}catch(e){}
// =====================================================================
// 📷 Canvas দিয়ে ছবি compress করার helper ফাংশন
// ফাইল নিয়ে maxW×maxH সাইজে resize করে JPEG base64 data-URL রিটার্ন করে
// =====================================================================
function compressMemberPhoto(file, maxW, maxH) {
    return new Promise(function(resolve, reject) {
        // ✅ FIX: ফাইল সাইজ চেক — 10MB এর বেশি হলে আগেই reject করো (হ্যাং এড়াতে)
        if (file.size > 10 * 1024 * 1024) {
            reject(new Error('ছবির আকার ১০ MB এর বেশি। ছোট ছবি বেছে নিন।'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = reject;
            img.onload = function() {
                // ✅ FIX: requestAnimationFrame দিয়ে main thread আটকানো রোধ করো
                requestAnimationFrame(function() {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width  = maxW;
                        canvas.height = maxH;
                        const ctx = canvas.getContext('2d');
                        // মাঝ থেকে crop করে square বানাও, তারপর resize
                        const srcSize = Math.min(img.width, img.height);
                        const sx = (img.width  - srcSize) / 2;
                        const sy = (img.height - srcSize) / 2;
                        ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, maxW, maxH);
                        // JPEG quality 0.82 তে base64 data-URL
                        resolve(canvas.toDataURL('image/jpeg', 0.82));
                    } catch(canvasErr) {
                        reject(canvasErr);
                    }
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ── ফর্মে ছবি সিলেক্ট করলে তাৎক্ষণিক প্রিভিউ দেখাও ──
// ✅ FIX: ফাইল সাইজ চেক ও error message যোগ করা হয়েছে
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'member-photo-input') {
        const file = e.target.files && e.target.files[0];
        const wrap = document.getElementById('photo-preview-wrap');
        const img  = document.getElementById('photo-preview-img');
        const label = document.getElementById('photo-change-label');

        const labelSpan = document.getElementById('photo-label-text');
        if (file) {
            // ফাইল সাইজ চেক (10MB সীমা)
            if (file.size > 10 * 1024 * 1024) {
                if (labelSpan) { labelSpan.textContent = '⚠️ ১০ MB এর বেশি হওয়া যাবে না। ছোট ছবি বেছে নিন।'; labelSpan.style.color = '#dc2626'; }
                e.target.value = '';
                if (wrap) wrap.classList.add('hidden');
                return;
            }
            // প্রিভিউ দেখাও
            if (wrap && img) {
                compressMemberPhoto(file, 200, 200).then(function(dataUrl) {
                    img.src = dataUrl;
                    wrap.classList.remove('hidden');
                    if (labelSpan) { labelSpan.textContent = 'ছবি নির্বাচিত ✔ (বদলাতে আবার চাপুন)'; labelSpan.style.color = '#059669'; }
                }).catch(function(err) {
                    wrap.classList.add('hidden');
                    if (labelSpan) { labelSpan.textContent = '⚠️ সমস্যা হয়েছে। অন্য ছবি বেছে নিন।'; labelSpan.style.color = '#dc2626'; }
                    console.warn('[Photo Preview] error:', err);
                });
            }
        } else if (wrap) {
            wrap.classList.add('hidden');
        }
    }
});

// opinion-name ফিল্ড সরানো হয়েছে — focusin লিসেনার প্রয়োজন নেই

try{window.handleMemberSubmit=handleMemberSubmit;}catch(e){}
try{window.importDataBackup=importDataBackup;}catch(e){}
try{window.openBankLedgerModal=openBankLedgerModal;}catch(e){}
try{window.openExpenseLedgerModal=openExpenseLedgerModal;}catch(e){}
try{window.openExportModal=openExportModal;}catch(e){}
try{window.openMemberModal=openMemberModal;}catch(e){}
try{window.openMemberSearchModal=openMemberSearchModal;}catch(e){}
try{window.openMonthlyReportModal=openMonthlyReportModal;}catch(e){}
try{window.openOtherFundModal=openOtherFundModal;}catch(e){}
try{window.openQuickDepositModal=openQuickDepositModal;}catch(e){}
try{window.resetExpenses=resetExpenses;}catch(e){}
try{window.shareReportData=shareReportData;}catch(e){}
try{window.showLoginTab=showLoginTab;}catch(e){}
try{window.showOtherFundMembers=showOtherFundMembers;}catch(e){}
try{window.showRegTab=showRegTab;}catch(e){}
try{window.submitOpinion=submitOpinion;}catch(e){}
try{window.submitOtherFund=submitOtherFund;}catch(e){}
try{window.submitQuickDeposit=submitQuickDeposit;}catch(e){}
try{window.submitSavingsTransaction=submitSavingsTransaction;}catch(e){}
try{window.toggleApprovedUsersPanel=toggleApprovedUsersPanel;}catch(e){}
try{window.toggleFundDropdown=toggleFundDropdown;}catch(e){}
try{window.toggleMemberDetails=toggleMemberDetails;}catch(e){}
try{window.toggleNoticePanel=toggleNoticePanel;}catch(e){}
try{window.toggleNotifHistoryPanel=toggleNotifHistoryPanel;}catch(e){}
try{window.togglePendingApprovalPanel=togglePendingApprovalPanel;}catch(e){}
try{window.toggleRegType=toggleRegType;}catch(e){}
try{window.deleteBankLedgerItem=deleteBankLedgerItem;}catch(e){}
try{window.deleteExpenseLedgerItem=deleteExpenseLedgerItem;}catch(e){}
try{window.deleteLedgerEntry=deleteLedgerEntry;}catch(e){}
try{window.deleteMember=deleteMember;}catch(e){}
try{window.deleteNotice=deleteNotice;}catch(e){}
try{window.deleteOpinion=deleteOpinion;}catch(e){}
try{window.voteNotice=voteNotice;}catch(e){}
try{window.autoFillOpinionName=autoFillOpinionName;}catch(e){}
try{window.deleteOtherFund=deleteOtherFund;}catch(e){}
try{window.editBankLedgerItem=editBankLedgerItem;}catch(e){}
try{window.editExpenseLedgerItem=editExpenseLedgerItem;}catch(e){}
try{window.editLedgerEntry=editLedgerEntry;}catch(e){}
try{window.openActionModal=openActionModal;}catch(e){}
try{window.openLedgerModal=openLedgerModal;}catch(e){}
try{window.openTxnModal=openTxnModal;}catch(e){}
try{window.processToastQueue=processToastQueue;}catch(e){}
try{window.toggleActionMenu=toggleActionMenu;}catch(e){}

// =====================================================================
// সদস্য প্রোফাইল ও লেনদেন খাতা — Member Profile Modal System
// =====================================================================

/**
 * সদস্য আইডি দিয়ে প্রোফাইল খোলার পাবলিক ফাংশন।
 * সদস্য তালিকার যেকোনো জায়গা থেকে কল করা যাবে।
 */
window.openMemberProfile = function(memberId) {
    const idx = appState.members.findIndex(m => String(m.id) === String(memberId));
    if (idx >= 0) {
        window.openMemberProfileByIndex(idx);
    } else {
        console.warn('[Profile] সদস্য খুঁজে পাওয়া যায়নি, ID:', memberId);
    }
};

/**
 * সদস্য ইনডেক্স দিয়ে প্রোফাইল খোলার মূল ফাংশন।
 * appState.members[index] থেকে ক্যাশড ডেটা দিয়ে তাৎক্ষণিক দেখায়,
 * তারপর Firestore থেকে সর্বশেষ ডেটা রিফ্রেশ করে।
 */
window.openMemberProfileByIndex = async function(index) {
    const m = appState.members[index];
    if (!m) return;
    await _renderMemberProfileContent(m);
};

/**
 * ✅ নতুন: লগইন করা ব্যবহারকারীর নিজের সদস্য প্রোফাইল খোলার ফাংশন।
 * "দ্রুত কার্যক্রম" গ্রিডের "সদস্য" বাটন থেকে কল হয় — সবাই (সাধারণ সদস্যসহ)
 * নিজের তথ্য দেখতে পারবেন।
 *
 * appState.members শুধু প্রথম পেজ (পেজিনেটেড) ধরে রাখে, তাই ব্যবহারকারীর
 * doc সেখানে নাও থাকতে পারে — তাই PhotoSync সিস্টেমের একই ০-৪ পদ্ধতি
 * (linkedMemberDocId → uid doc → userId field → email field → phone field)
 * ব্যবহার করে সরাসরি Firestore থেকে নির্ভরযোগ্যভাবে খোঁজা হচ্ছে।
 */
// ✅ ফোন নম্বর normalize করো — হাইফেন/স্পেস/+৮৮০ প্রিফিক্স ইত্যাদি সরিয়ে তুলনাযোগ্য
// ফরম্যাটে আনে (গ্লোবালি রি-ইউজ করার জন্য — Shift/Merge ও এই দুটোতেই একই লজিক)
window._normalizePhone = function(p) {
    let s = String(p || '').replace(/\D/g, ''); // শুধু সংখ্যা রাখো
    if (s.length === 13 && s.startsWith('880')) s = '0' + s.slice(3); // 880XXXXXXXXXX
    else if (s.length === 14 && s.startsWith('0880')) s = s.slice(3); // ভুলবশত 0+880
    return s;
};

// ✅ "দ্রুত কার্যক্রম" → "সদস্য" বাটন: টপবারের প্রোফাইলে সংরক্ষিত ফোন নম্বরের সাথে
// সদস্য তালিকার ফোন নম্বর মিলিয়ে সেই সদস্যের আইডি দেখায়
window.showMyMemberIdByPhone = async function() {
    const uid = window.currentUser && window.currentUser.uid;
    if (!uid) { window.showAlert('লগইন তথ্য পাওয়া যাচ্ছে না, পেজ রিলোড করে আবার চেষ্টা করুন।'); return; }

    showLoadingSpinner();
    try {
        const fns = window._firebaseFns;
        const db2 = window._firebaseDb;
        let myPhone = '';
        if (fns && db2) {
            const userSnap = await fns.getDoc(fns.doc(db2, 'users', uid));
            if (userSnap.exists()) myPhone = userSnap.data().phone || '';
        }
        hideLoadingSpinner();

        if (!myPhone) {
            window.showAlert(
                'আপনার প্রোফাইলে কোনো ফোন নম্বর সংরক্ষিত নেই।\n\nটপবারের প্রোফাইল আইকনে গিয়ে আগে ফোন নম্বর যুক্ত করুন।',
                { icon: '📵', title: 'ফোন নম্বর পাওয়া যায়নি' }
            );
            return;
        }

        const normMy = window._normalizePhone(myPhone);
        const match = (appState.members || []).find(
            m => normMy !== '' && window._normalizePhone(m.phone) === normMy
        );

        if (match) {
            window.showAlert(
                `আপনার ফোন নম্বর (${myPhone}) সদস্য তালিকার সাথে মিলেছে।\n\n👤 নাম: ${match.name || '—'}\n🆔 আইডি: ${match.id || '—'}`,
                { icon: '🆔', title: 'আপনার সদস্য আইডি' }
            );
        } else {
            window.showAlert(
                `আপনার ফোন নম্বর (${myPhone})-এর সাথে মিলে এমন কোনো সদস্য, সদস্য তালিকায় পাওয়া যায়নি।\n\nএডমিনের সাথে যোগাযোগ করে সদস্য তালিকায় আপনার সঠিক ফোন নম্বরটি যুক্ত করিয়ে নিন।`,
                { icon: '⚠️', title: 'সদস্য পাওয়া যায়নি' }
            );
        }
    } catch (e) {
        hideLoadingSpinner();
        console.error('[সদস্য আইডি] খুঁজতে সমস্যা:', e.message);
        window.showAlert('সদস্য আইডি খুঁজতে সমস্যা হয়েছে: ' + e.message);
    }
};

window._findMyMemberDoc = async function(uid) {
    const fns = window._firebaseFns;
    const db2 = window._firebaseDb;
    const somityId = window.currentSomityId;
    if (!fns || !db2 || !somityId || !uid) return null;

    try {
        const userSnap = await fns.getDoc(fns.doc(db2, 'users', uid));
        const userData = userSnap.exists() ? userSnap.data() : null;

        // ── পদ্ধতি ০: users/{uid}.linkedMemberDocId ──
        const linkedId = userData ? userData.linkedMemberDocId : null;
        if (linkedId) {
            const ref  = fns.doc(db2, 'somities', somityId, 'members', linkedId);
            const snap = await fns.getDoc(ref);
            if (snap.exists()) return { docId: linkedId, data: snap.data() };
        }

        // ── পদ্ধতি ১: members/{uid} ──
        const ref1  = fns.doc(db2, 'somities', somityId, 'members', uid);
        const snap1 = await fns.getDoc(ref1);
        if (snap1.exists()) return { docId: uid, data: snap1.data() };

        const col = fns.collection(db2, 'somities', somityId, 'members');

        // ── পদ্ধতি ২: userId field ──
        const snap2 = await fns.getDocs(fns.query(col, fns.where('userId', '==', uid)));
        if (!snap2.empty) { const d = snap2.docs[0]; return { docId: d.id, data: d.data() }; }

        // ── পদ্ধতি ৩: email field ──
        const userEmail = (userData && userData.email) || (window.currentUser && window.currentUser.email) || '';
        if (userEmail) {
            const snap3 = await fns.getDocs(fns.query(col, fns.where('email', '==', userEmail)));
            if (!snap3.empty) { const d = snap3.docs[0]; return { docId: d.id, data: d.data() }; }
        }

        // ── পদ্ধতি ৪: phone field ──
        const userPhone = userData && userData.phone;
        if (userPhone) {
            const snap4 = await fns.getDocs(fns.query(col, fns.where('phone', '==', userPhone)));
            if (!snap4.empty) { const d = snap4.docs[0]; return { docId: d.id, data: d.data() }; }
        }
    } catch(e) {
        console.warn('[MyProfile] সদস্য doc খুঁজতে সমস্যা:', e.message);
    }
    return null;
};

window.openMyOwnMemberProfile = async function() {
    const uid = window.currentUser && window.currentUser.uid;
    if (!uid) { window.showAlert('লগইন তথ্য পাওয়া যাচ্ছে না, পেজ রিলোড করে আবার চেষ্টা করুন।'); return; }

    showLoadingSpinner();
    try {
        const found = await window._findMyMemberDoc(uid);
        hideLoadingSpinner();
        if (!found) {
            window.showAlert('⚠️ আপনার সদস্য প্রোফাইল খুঁজে পাওয়া যায়নি।\n\nএডমিনের সাথে যোগাযোগ করুন, তিনি "সদস্য তালিকা"-এ আপনার অ্যাকাউন্ট লিংক করে দিতে পারবেন।');
            return;
        }
        const data = found.data || {};
        await _renderMemberProfileContent(Object.assign({}, data, { _docId: found.docId }));
    } catch(e) {
        hideLoadingSpinner();
        console.error('[MyProfile] প্রোফাইল খুলতে ব্যর্থ:', e);
        window.showAlert('প্রোফাইল লোড করতে সমস্যা হয়েছে: ' + e.message);
    }
};

// ══════════════════════════════════════════════
// 🚪 সদস্যের অ্যাকাউন্ট ক্লোজ (সমিতি ছেড়ে যাওয়া) — সঞ্চয় নিষ্পত্তি সহ
// ডেটা ডিলিট হবে না — শুধু "closed" চিহ্নিত হবে, সক্রিয় তালিকা থেকে সরে যাবে
// ══════════════════════════════════════════════
window.closeMemberAccountPrompt = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const docId = window._currentProfileMemberDocId;
    if (!docId) { window.showAlert('সদস্যের তথ্য পাওয়া যায়নি।'); return; }

    const savings = Number(window._currentProfileMemberSavings) || 0;
    const profitLoss = Number(window._currentProfileMemberProfitLoss) || 0;

    document.getElementById('settlement-member-name').textContent =
        (window._currentProfileMemberName || 'এই সদস্য') + ' — বর্তমান সঞ্চয়: ৳' + savings.toLocaleString() +
        (profitLoss ? ', লাভ/ক্ষতি: ৳' + profitLoss.toLocaleString() : '');

    // ডিফল্ট হিসেবে বর্তমান সঞ্চয় ও (ধনাত্মক হলে) লাভ প্রি-ফিল করা হলো — এডমিন চাইলে বদলাতে পারবেন
    document.getElementById('settlement-savings-amount').value = savings > 0 ? savings : '';
    document.getElementById('settlement-profit-amount').value = profitLoss > 0 ? profitLoss : '';
    updateSettlementTotal();

    // 🔒 বাড়তি সতর্কতা: টাইপ-টু-কনফার্ম রিসেট করো, বাটন ডিজেবল রাখো
    document.getElementById('settlement-confirm-target-name').textContent = window._currentProfileMemberName || 'এই সদস্য';
    document.getElementById('settlement-confirm-name-input').value = '';
    updateSettlementConfirmState();

    document.getElementById('settlement-modal').classList.remove('hidden');
    document.getElementById('settlement-modal').classList.add('flex');
};

window.updateSettlementConfirmState = function() {
    const typed = (document.getElementById('settlement-confirm-name-input').value || '').trim();
    const target = (window._currentProfileMemberName || '').trim();
    const btn = document.getElementById('settlement-confirm-btn');
    if (typed && target && typed === target) {
        btn.disabled = false;
        btn.className = 'flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer';
    } else {
        btn.disabled = true;
        btn.className = 'flex-1 bg-gray-300 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed';
    }
};
function updateSettlementConfirmState() { window.updateSettlementConfirmState(); }

window.closeSettlementModal = function() {
    document.getElementById('settlement-modal').classList.add('hidden');
    document.getElementById('settlement-modal').classList.remove('flex');
};

window.updateSettlementTotal = function() {
    const savingsAmt = Number(document.getElementById('settlement-savings-amount').value) || 0;
    const profitAmt  = Number(document.getElementById('settlement-profit-amount').value) || 0;
    document.getElementById('settlement-total-amount').textContent = '৳ ' + (savingsAmt + profitAmt).toLocaleString();
};
function updateSettlementTotal() { window.updateSettlementTotal(); }

window.submitAccountSettlement = async function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const docId = window._currentProfileMemberDocId;
    const name  = window._currentProfileMemberName || 'এই সদস্য';
    if (!docId) { window.showAlert('সদস্যের তথ্য পাওয়া যায়নি।'); return; }

    // 🔒 বাড়তি সতর্কতা: শুধু বাটন disable-এর উপর নির্ভর না করে এখানেও যাচাই করা হচ্ছে
    const typedConfirm = (document.getElementById('settlement-confirm-name-input').value || '').trim();
    if (typedConfirm !== name.trim()) {
        window.showAlert('⚠️ নিশ্চিত করতে সদস্যের নাম হুবহু টাইপ করুন।');
        return;
    }

    const savingsAmt = Number(document.getElementById('settlement-savings-amount').value) || 0;
    const profitAmt  = Number(document.getElementById('settlement-profit-amount').value) || 0;
    if (savingsAmt < 0 || profitAmt < 0) { window.showAlert('ঋণাত্মক পরিমাণ দেওয়া যাবে না!'); return; }
    const totalAmt = savingsAmt + profitAmt;

    const proceed = await window.showConfirm(
        `"${name}"-কে মোট ৳${totalAmt.toLocaleString()} পরিশোধ করে অ্যাকাউন্ট ক্লোজ করা হবে ` +
        `(সঞ্চয়: ৳${savingsAmt.toLocaleString()} + লাভ: ৳${profitAmt.toLocaleString()})।\n\n` +
        `সঞ্চয় ও ক্যাশ ইন হ্যান্ড থেকে ৳${savingsAmt.toLocaleString()}, এবং শুধু ক্যাশ ইন হ্যান্ড থেকে আরও ৳${profitAmt.toLocaleString()} বিয়োগ হবে।\n\n` +
        `অ্যাকাউন্টটি ক্লোজ হয়ে যাবে (লেনদেনের ইতিহাস মুছবে না, শুধু সক্রিয় তালিকা থেকে সরে যাবে)। আপনি কি নিশ্চিত?`,
        { title: '🚪 নিষ্পত্তি নিশ্চিত করুন', icon: '🚪', okText: 'হ্যাঁ, নিশ্চিত করুন', cancelText: 'বাতিল', danger: true }
    );
    if (!proceed) return;

    const oldSavings = Number(window._currentProfileMemberSavings) || 0;
    const oldProfitLoss = Number(window._currentProfileMemberProfitLoss) || 0;
    const newSavings = Math.max(0, oldSavings - savingsAmt);
    const newProfitLoss = oldProfitLoss - profitAmt;
    const leftoverBalance = newSavings + newProfitLoss;
    const formattedDate = formatActionDate();

    try {
        const { doc: docFn, updateDoc, serverTimestamp: sts } = window._firebaseFns;
        await updateDoc(
            docFn(window._firebaseDb, "somities", window.currentSomityId, "members", docId),
            {
                status: 'closed',
                closedAt: sts(),
                closedBalance: leftoverBalance,
                savings: newSavings,
                profitLoss: newProfitLoss,
                settlementSavingsPaid: savingsAmt,
                settlementProfitPaid: profitAmt,
                settlementDate: formattedDate
            }
        );
        // 💰 ক্যাশ ইন হ্যান্ড থেকে মোট পরিমাণ বিয়োগ (সঞ্চয় + লাভ উভয়ই ক্যাশ থেকে বের হচ্ছে)
        if (totalAmt > 0 && window.updateSomityDoc) {
            const lastTxn = buildLastTxn('withdraw', name, totalAmt, 'সঞ্চয় নিষ্পত্তি — অ্যাকাউন্ট ক্লোজ');
            await window.updateSomityDoc({ cashInHand: _somityDelta(-totalAmt) }, lastTxn);
            notifyEntryMaker(lastTxn);
        }

        // 🧾 সেটেলমেন্ট রশিদ (PDF) তৈরি করো
        printSettlementReceipt(name, savingsAmt, profitAmt, totalAmt, formattedDate);

        window.showAlert('✅ সঞ্চয় নিষ্পত্তি সম্পন্ন হয়েছে ও অ্যাকাউন্ট ক্লোজ করা হয়েছে।');
        closeSettlementModal();
        if (window.closeMemberProfile) window.closeMemberProfile();
    } catch(e) {
        console.error('submitAccountSettlement error:', e);
        window.showAlert('❌ নিষ্পত্তি করতে সমস্যা হয়েছে: ' + e.message);
    }
};

// 🧾 সেটেলমেন্ট রশিদ প্রিন্ট/PDF (স্বাক্ষরের জায়গাসহ)
function printSettlementReceipt(name, savingsAmt, profitAmt, totalAmt, formattedDate) {
    const somityName = (appState && appState.somityName) ? appState.somityName : (window.currentSomityName || 'Somity Manager');
    const somityCode = (appState && appState.somityCode) ? appState.somityCode : (window.currentSomityCode || '');
    const today = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    const memberId    = window._currentProfileMemberId || '';
    const phone       = window._currentProfileMemberPhone || '';
    const address     = window._currentProfileMemberAddress || '';
    const fatherName  = window._currentProfileMemberFatherName || '';
    const dob         = window._currentProfileMemberDob ? formatDobBn(window._currentProfileMemberDob) : '';
    const nidNumber   = window._currentProfileMemberNidNumber || '';
    const nomineeName = window._currentProfileMemberNomineeName || '';
    const nomineePhone = window._currentProfileMemberNomineePhone || '';
    const nomineeRelation = window._currentProfileMemberNomineeRelation || '';

    const infoRow = (label, value) => value ? `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>` : '';

    const printHtml = `
    <html><head><meta charset="UTF-8">
    <title>সঞ্চয় নিষ্পত্তি রশিদ</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Hind Siliguri',sans-serif; }
        body { color:#1e293b; }
        .header { background:linear-gradient(135deg,#be123c,#9f1239); color:#fff; padding:22px 24px 18px; text-align:center; }
        .header h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
        .header p  { font-size:11px; opacity:0.85; margin-bottom:2px; }
        .header h2 { font-size:14px; font-weight:600; margin-top:6px; opacity:0.95; }
        .subheader { background:#fff1f2; border-bottom:1.5px solid #fecaca; padding:8px 24px;
                     display:flex; justify-content:space-between; font-size:11px; color:#be123c; font-weight:600; }
        .info-box { padding:16px 24px; }
        .info-row { display:flex; padding:4px 0; font-size:12.5px; border-bottom:1px dashed #e2e8f0; }
        .info-label { width:130px; color:#64748b; font-weight:600; }
        .info-value { color:#1e293b; font-weight:700; }
        .table-wrap { padding:6px 20px 14px; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        thead tr { background:#be123c; color:#fff; }
        thead th { padding:10px 12px; font-weight:700; text-align:left; }
        thead th:last-child { text-align:right; }
        tbody tr { border-bottom:1px solid #fee2e2; }
        tbody td { padding:10px 12px; }
        tbody td:last-child { text-align:right; font-weight:700; }
        .total-box { margin:8px 20px 20px; background:#fff1f2; border:1.5px solid #f87171;
                     border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between;
                     font-size:15px; font-weight:700; color:#be123c; }
        .footer { border-top:1px solid #cbd5e1; margin:20px 20px 0; padding:40px 0 8px;
                  display:flex; justify-content:space-between; align-items:flex-end; font-size:11px; color:#334155; }
        .sig-line { border-top:1.5px solid #94a3b8; width:170px; padding-top:6px; text-align:center; }
        .gen-info { text-align:center; font-size:9px; color:#94a3b8; padding:16px 0 6px; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:0; }
        }
    </style></head><body>
    <div class="header">
        <h1>${somityName}</h1>
        ${somityCode ? '<p>সমিতি কোড: ' + somityCode + '</p>' : ''}
        <h2>🚪 সঞ্চয় নিষ্পত্তি রশিদ (অ্যাকাউন্ট ক্লোজ)</h2>
    </div>
    <div class="subheader">
        <span>তারিখ: ${today}</span>
        <span>সদস্য আইডি: ${memberId || '-'}</span>
    </div>
    <div class="info-box">
        ${infoRow('সদস্যের নাম', name)}
        ${infoRow('পিতার নাম', fatherName)}
        ${infoRow('জন্ম তারিখ', dob)}
        ${infoRow('NID নম্বর', nidNumber)}
        ${infoRow('মোবাইল নম্বর', phone)}
        ${infoRow('ঠিকানা', address)}
        ${nomineeName ? infoRow('নমিনির নাম', nomineeName + (nomineeRelation ? ' (' + nomineeRelation + ')' : '')) : ''}
        ${nomineePhone ? infoRow('নমিনির মোবাইল', nomineePhone) : ''}
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>বিবরণ</th><th>পরিমাণ (৳)</th></tr></thead>
            <tbody>
                <tr><td>সঞ্চয় পরিশোধ</td><td>${savingsAmt.toLocaleString('bn-BD')}</td></tr>
                <tr><td>লাভ পরিশোধ</td><td>${profitAmt.toLocaleString('bn-BD')}</td></tr>
            </tbody>
        </table>
    </div>
    <div class="total-box">
        <span>💰 সর্বমোট পরিশোধিত:</span>
        <span>৳ ${totalAmt.toLocaleString('bn-BD')}</span>
    </div>
    <div class="footer">
        <div class="sig-line">গ্রহণকারীর স্বাক্ষর</div>
        <div class="sig-line">সমিতির পক্ষে স্বাক্ষর</div>
    </div>
    <div class="gen-info">Generated by Somity Manager | ${today}</div>
    </body></html>`;

    var printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.onload = function() {
        printWin.focus();
        printWin.print();
    };
}

// ══════════════════════════════════════════════
// 🔒 ক্লোজড অ্যাকাউন্ট দেখা ও পুনরায় চালু করা (ভুলবশত ক্লোজ হয়ে গেলে ফিরিয়ে আনার জন্য)
// ══════════════════════════════════════════════
window.openClosedAccountsModal = function() {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই তালিকা দেখতে পারবেন।'); return; }
    renderClosedAccountsList();
    document.getElementById('closed-accounts-modal').classList.remove('hidden');
    document.getElementById('closed-accounts-modal').classList.add('flex');
};

window.closeClosedAccountsModal = function() {
    document.getElementById('closed-accounts-modal').classList.add('hidden');
    document.getElementById('closed-accounts-modal').classList.remove('flex');
};

function renderClosedAccountsList() {
    const closedMembers = (appState.members || []).filter(m => m.status === 'closed');
    const listEl = document.getElementById('closed-accounts-list');
    const emptyMsg = document.getElementById('closed-accounts-empty-msg');
    if (closedMembers.length === 0) {
        listEl.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');
    listEl.innerHTML = closedMembers.map(m => `
        <div style="border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;">
            <div style="font-weight:800;color:#334155;font-size:14px;margin-bottom:2px;">${m.name || '—'} <span style="color:#94a3b8;font-weight:600;font-size:11px;">(আইডি: ${m.id || '—'})</span></div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
                পরিশোধিত ছিল — সঞ্চয়: ৳${Number(m.settlementSavingsPaid||0).toLocaleString()}, লাভ: ৳${Number(m.settlementProfitPaid||0).toLocaleString()}
                ${m.settlementDate ? ' | তারিখ: ' + m.settlementDate : ''}
            </div>
            <button onclick="window.reopenMemberAccount('${m._docId}')" style="width:100%;background:#ecfdf5;color:#047857;border:1.5px solid #a7f3d0;border-radius:10px;padding:9px;font-size:12px;font-weight:800;cursor:pointer;">
                ♻️ পুনরায় চালু করুন
            </button>
        </div>
    `).join('');
}

window.reopenMemberAccount = async function(docId) {
    if (!window.isAdminVerified()) { window.showAlert('শুধুমাত্র এডমিন এই কাজ করতে পারবেন।'); return; }
    const member = (appState.members || []).find(m => m._docId === docId);
    if (!member) { window.showAlert('সদস্যের তথ্য পাওয়া যায়নি।'); return; }

    const savingsPaid = Number(member.settlementSavingsPaid) || 0;
    const profitPaid  = Number(member.settlementProfitPaid) || 0;
    const totalPaid   = savingsPaid + profitPaid;

    const proceed = await window.showConfirm(
        `"${member.name}"-এর অ্যাকাউন্ট পুনরায় চালু করা হবে।\n\n` +
        `আগে পরিশোধ করা ৳${savingsPaid.toLocaleString()} সঞ্চয়ে এবং ৳${profitPaid.toLocaleString()} লাভে ফিরিয়ে দেওয়া হবে, ` +
        `এবং ক্যাশ ইন হ্যান্ড থেকে মোট ৳${totalPaid.toLocaleString()} আবার বিয়োগ হবে (যেহেতু এই টাকা সদস্যকে দেওয়া হয়নি, শুধু হিসাব পুনর্বহাল হচ্ছে)।\n\n` +
        `আপনি কি নিশ্চিত?`,
        { title: '♻️ পুনরায় চালু নিশ্চিত করুন', icon: '♻️', okText: 'হ্যাঁ, চালু করুন', cancelText: 'বাতিল' }
    );
    if (!proceed) return;

    try {
        const { doc: docFn, updateDoc, deleteField } = window._firebaseFns;
        const newSavings = Number(member.savings || 0) + savingsPaid;
        const newProfitLoss = Number(member.profitLoss || 0) + profitPaid;

        await updateDoc(
            docFn(window._firebaseDb, "somities", window.currentSomityId, "members", docId),
            {
                status: 'active',
                savings: newSavings,
                profitLoss: newProfitLoss,
                closedAt: deleteField ? deleteField() : null,
                closedBalance: deleteField ? deleteField() : null,
                settlementSavingsPaid: deleteField ? deleteField() : null,
                settlementProfitPaid: deleteField ? deleteField() : null,
                settlementDate: deleteField ? deleteField() : null
            }
        );

        // 💰 ক্যাশ ইন হ্যান্ড থেকে আবার বিয়োগ (যেহেতু এই টাকা প্রকৃতপক্ষে বের হয়নি, শুধু হিসাব পুনর্বহাল হচ্ছে)
        if (totalPaid > 0 && window.updateSomityDoc) {
            const lastTxn = buildLastTxn('withdraw', member.name, totalPaid, 'অ্যাকাউন্ট পুনরায় চালু — নিষ্পত্তি বাতিল');
            await window.updateSomityDoc({ cashInHand: _somityDelta(-totalPaid) }, lastTxn);
            notifyEntryMaker(lastTxn);
        }

        window.showAlert('✅ অ্যাকাউন্ট পুনরায় চালু করা হয়েছে।');
        renderClosedAccountsList();
        renderUI();
    } catch(e) {
        console.error('reopenMemberAccount error:', e);
        window.showAlert('❌ পুনরায় চালু করতে সমস্যা হয়েছে: ' + e.message);
    }
};

async function _renderMemberProfileContent(m) {
    // ── মডাল খোলো ──
    const modal = document.getElementById('member-profile-modal');
    modal.classList.add('mp-active');
    document.body.style.overflow = 'hidden'; // পেছনের স্ক্রোল বন্ধ
    if (window._pushModalHistory) window._pushModalHistory(() => window.closeMemberProfile());

    // ── অ্যাভাটার: ছবি থাকলে ছবি, না থাকলে নামের প্রথম অক্ষর ──
    const mpAvatarEl = document.getElementById('mp-avatar');
    if (m.photoUrl) {
        mpAvatarEl.innerHTML = `<img src="${m.photoUrl}" alt="${m.name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        mpAvatarEl.style.background = 'none';
        mpAvatarEl.style.padding = '0';
        mpAvatarEl.style.overflow = 'hidden';
    } else {
        const firstChar = (m.name || '?').trim().charAt(0);
        mpAvatarEl.textContent = firstChar;
        mpAvatarEl.style.background = '';
        mpAvatarEl.style.overflow = '';
    }

    // ── প্রোফাইল তথ্য ──
    document.getElementById('mp-name').textContent = m.name || '—';
    document.getElementById('mp-code').textContent = m.id || '—';

    const phoneWrap = document.getElementById('mp-phone-wrap');
    if (m.phone) {
        document.getElementById('mp-phone').textContent = m.phone;
        phoneWrap.style.display = 'flex';
    } else {
        phoneWrap.style.display = 'none';
    }

    const addrWrap = document.getElementById('mp-address-wrap');
    if (m.address) {
        document.getElementById('mp-address').textContent = m.address;
        addrWrap.style.display = 'flex';
    } else {
        addrWrap.style.display = 'none';
    }

    // ── পিতার নাম ──
    const fatherWrap = document.getElementById('mp-father-wrap');
    if (m.fatherName) {
        document.getElementById('mp-father-name').textContent = 'পিতাঃ ' + m.fatherName;
        fatherWrap.style.display = 'flex';
    } else {
        fatherWrap.style.display = 'none';
    }

    // ── জন্ম তারিখ ──
    const dobWrap = document.getElementById('mp-dob-wrap');
    if (m.dob) {
        document.getElementById('mp-dob').textContent = 'জন্ম তারিখঃ ' + formatDobBn(m.dob);
        dobWrap.style.display = 'flex';
    } else {
        dobWrap.style.display = 'none';
    }

    // ── NID নম্বর ──
    const nidWrap = document.getElementById('mp-nid-wrap');
    if (m.nidNumber) {
        document.getElementById('mp-nid').textContent = 'NID: ' + m.nidNumber;
        nidWrap.style.display = 'flex';
    } else {
        nidWrap.style.display = 'none';
    }

    // ── নমিনির তথ্য ──
    const nomineeBox = document.getElementById('mp-nominee-box');
    if (m.nomineeName || m.nomineePhone || m.nomineeRelation) {
        document.getElementById('mp-nominee-name').textContent = m.nomineeName || '—';
        const phoneRow = document.getElementById('mp-nominee-phone-row');
        if (m.nomineePhone) { document.getElementById('mp-nominee-phone').textContent = m.nomineePhone; phoneRow.style.display = ''; }
        else { phoneRow.style.display = 'none'; }
        const relationRow = document.getElementById('mp-nominee-relation-row');
        if (m.nomineeRelation) { document.getElementById('mp-nominee-relation').textContent = m.nomineeRelation; relationRow.style.display = ''; }
        else { relationRow.style.display = 'none'; }
        nomineeBox.style.display = 'block';
    } else {
        nomineeBox.style.display = 'none';
    }

    // ── ক্যাশড ডেটা দিয়ে সামারি কার্ড তাৎক্ষণিক দেখাও ──
    document.getElementById('mp-total-savings').textContent =
        '৳ ' + Number(m.savings || 0).toLocaleString('en-IN');

    // ── লোডিং স্পিনার দেখাও ──
    const tbody = document.getElementById('member-profile-ledger');
    tbody.innerHTML = `<tr><td colspan="5"><div id="mp-loading-row">
        <div style="display:inline-block;width:28px;height:28px;border:3px solid #e2e8f0;
        border-top-color:#3949ab;border-radius:50%;animation:fa-spin .8s linear infinite;
        vertical-align:middle;margin-right:8px;"></div>ফায়ারস্টোর থেকে লোড হচ্ছে...
    </div></td></tr>`;
    document.getElementById('mp-empty-row').style.display = 'none';
    document.getElementById('mp-txn-count').textContent = '';

    // ── ফায়ারস্টোর থেকে সর্বশেষ ডেটা লোড করো ──
    let ledger = Array.isArray(m.ledger) ? [...m.ledger] : [];
    let freshSavings = Number(m.savings || 0);
    let freshProfitLoss = Number(m.profitLoss || 0);

    try {
        const dbRef = window._firebaseDb;
        const fns   = window._firebaseFns;
        if (dbRef && fns && m._docId && window.currentSomityId) {
            const snap = await fns.getDoc(
                fns.doc(dbRef, 'somities', window.currentSomityId, 'members', m._docId)
            );
            if (snap.exists()) {
                const freshData = snap.data();
                if (Array.isArray(freshData.ledger)) {
                    ledger = freshData.ledger;
                }
                if (freshData.savings !== undefined) {
                    freshSavings = Number(freshData.savings);
                }
                if (freshData.profitLoss !== undefined) {
                    freshProfitLoss = Number(freshData.profitLoss);
                }
                // ── ✅ FIX: Firestore থেকে সর্বশেষ photoUrl দিয়ে avatar আপডেট করো ──
                if (freshData.photoUrl && freshData.photoUrl !== m.photoUrl) {
                    mpAvatarEl.innerHTML = `<img src="${freshData.photoUrl}" alt="${m.name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    mpAvatarEl.style.background = 'none';
                    mpAvatarEl.style.padding = '0';
                    mpAvatarEl.style.overflow = 'hidden';
                    // appState local cache-ও আপডেট করো
                    if (window.appState && Array.isArray(window.appState.members)) {
                        const cachedMember = window.appState.members.find(mb => mb._docId === m._docId);
                        if (cachedMember) cachedMember.photoUrl = freshData.photoUrl;
                    }
                }
            }
        }
    } catch (fetchErr) {
        console.warn('[Profile] Firestore ফেচ ব্যর্থ, ক্যাশড ডেটা ব্যবহার করা হচ্ছে:', fetchErr);
    }

    // ── সর্বশেষ সঞ্চয়, লাভ/ক্ষতি ও মোট ব্যালেন্স আপডেট ──
    document.getElementById('mp-total-savings').textContent =
        '৳ ' + freshSavings.toLocaleString('en-IN');

    const plEl = document.getElementById('mp-profit-loss');
    const plIconEl = document.getElementById('mp-pl-icon');
    if (freshProfitLoss > 0) {
        plEl.textContent = '+৳ ' + freshProfitLoss.toLocaleString('en-IN');
        plEl.style.color = '#2563eb'; // লাভ — নীল
        plIconEl.textContent = '📈';
    } else if (freshProfitLoss < 0) {
        plEl.textContent = '-৳ ' + Math.abs(freshProfitLoss).toLocaleString('en-IN');
        plEl.style.color = '#dc2626'; // ক্ষতি — লাল
        plIconEl.textContent = '📉';
    } else {
        plEl.textContent = '৳ 0';
        plEl.style.color = '#64748b';
        plIconEl.textContent = '📊';
    }

    const totalBalance = freshSavings + freshProfitLoss;
    document.getElementById('mp-total-balance').textContent =
        '৳ ' + totalBalance.toLocaleString('en-IN');

    // ── অ্যাকাউন্ট ক্লোজ বাটনের জন্য বর্তমান সদস্যের তথ্য গ্লোবালে রাখো ──
    window._currentProfileMemberDocId = m._docId;
    window._currentProfileMemberName = m.name || '';
    window._currentProfileMemberBalance = totalBalance;
    window._currentProfileMemberSavings = freshSavings;
    window._currentProfileMemberProfitLoss = freshProfitLoss;
    window._currentProfileMemberId = m.id || '';
    window._currentProfileMemberPhone = m.phone || '';
    window._currentProfileMemberAddress = m.address || '';
    window._currentProfileMemberFatherName = m.fatherName || '';
    window._currentProfileMemberDob = m.dob || '';
    window._currentProfileMemberNidNumber = m.nidNumber || '';
    window._currentProfileMemberNomineeName = m.nomineeName || '';
    window._currentProfileMemberNomineePhone = m.nomineePhone || '';
    window._currentProfileMemberNomineeRelation = m.nomineeRelation || '';
    window._currentProfileMemberPhotoUrl = m.photoUrl || '';

    // ── তারিখ অনুযায়ী সর্ট ──
    ledger.sort(function(a, b) {
        const da = new Date(a.rawDate || a.date || 0).getTime();
        const db2 = new Date(b.rawDate || b.date || 0).getTime();
        return da - db2;
    });

    // ── লেনদেন সংখ্যা ব্যাজ ──
    document.getElementById('mp-txn-count').textContent = ledger.length + ' টি লেনদেন';

    // ── খালি অবস্থা ──
    if (ledger.length === 0) {
        tbody.innerHTML = '';
        document.getElementById('mp-empty-row').style.display = 'block';
        return;
    }

    // ── টেবিল রেন্ডার করো ──
    // ধরনের রং নির্ধারণ
    function getTypeBadgeHtml(type) {
        const t = (type || '');
        if (t.includes('জমা'))         return '<span class="mp-badge mp-badge-deposit">⬆ ' + t + '</span>';
        if (t.includes('উত্তোলন'))    return '<span class="mp-badge mp-badge-withdraw">⬇ ' + t + '</span>';
        if (t.includes('ভর্তি'))       return '<span class="mp-badge mp-badge-admission">🎫 ' + t + '</span>';
        if (t.includes('জরিমানা'))     return '<span class="mp-badge mp-badge-fine">⚠ ' + t + '</span>';
        return '<span class="mp-badge mp-badge-other">' + (t || 'অন্যান্য') + '</span>';
    }

    let runningBalance = 0;
    let rows = '';

    ledger.forEach(function(x, i) {
        const type    = (x.type || '').trim();
        const amount  = Number(x.amount || 0);

        // জমা বা উত্তোলন নির্ণয়
        const isDebit = type.includes('উত্তোলন');
        // 🐛 ফিক্স: "ভর্তি ফি"/"জরিমানা" সঞ্চয় ব্যালেন্সে যোগ হয় না (শুধু ক্যাশে যোগ হয়) —
        // তাই এগুলোর টাকার পরিমাণ কলামে দেখাবে কিন্তু রানিং ব্যালেন্সে যোগ/বিয়োগ হবে না।
        // পুরনো ডেটায় affectsSavings ফ্ল্যাগ না থাকলে (ফিক্সের আগের এন্ট্রি) নিরাপদ ডিফল্ট হিসেবে
        // টাইপ নাম দেখে বাদ দেওয়া হচ্ছে।
        const isNonSavingsType = (x.affectsSavings === false) || type.includes('ভর্তি') || type.includes('জরিমানা');
        const creditAmt = isDebit ? 0 : amount;
        const debitAmt  = isDebit ? amount : 0;

        if (!isNonSavingsType) {
            runningBalance += creditAmt - debitAmt;
        }
        const balColor = runningBalance >= 0 ? '#1a237e' : '#dc2626';
        const rowBg    = i % 2 === 0 ? '#f8fafc' : '#ffffff';

        rows += '<tr style="background:' + rowBg + ';">'
            + '<td style="font-size:11px;color:#475569;white-space:nowrap;padding:10px 10px;">'
            +     (x.date || '—')
            + '</td>'
            + '<td style="padding:10px 8px;">'
            +     getTypeBadgeHtml(type)
            + '</td>'
            + '<td class="td-right" style="font-size:12px;font-weight:700;color:#166534;">'
            +     (creditAmt > 0 ? creditAmt.toLocaleString('en-IN') : '')
            + '</td>'
            + '<td class="td-right" style="font-size:12px;font-weight:700;color:#be123c;">'
            +     (debitAmt > 0 ? debitAmt.toLocaleString('en-IN') : '')
            + '</td>'
            + '<td class="td-right" style="font-size:12px;font-weight:900;color:' + balColor + ';">'
            +     runningBalance.toLocaleString('en-IN')
            + '</td>'
            + '</tr>';
    });

    tbody.innerHTML = rows;
};

/**
 * মডাল বন্ধ করার ফাংশন
 */
window.closeMemberProfile = function() {
    if (window._popModalHistory) window._popModalHistory();
    const modal = document.getElementById('member-profile-modal');
    if (modal) {
        modal.classList.remove('mp-active');
        document.body.style.overflow = '';
    }
};

/**
 * সদস্যের স্টেটমেন্ট প্রিন্ট করার ফাংশন।
 * শুধুমাত্র মডালের কনটেন্ট প্রিন্ট হবে, বাকি পেজ হাইড থাকবে।
 */
window.printMemberStatement = function() {
    document.body.classList.add('mp-printing');
    window.print();
    // প্রিন্ট ডায়ালগ বন্ধ হওয়ার পরে ক্লাস সরিয়ে ফেলো
    setTimeout(function() {
        document.body.classList.remove('mp-printing');
    }, 1500);
};

// Escape কী দিয়ে মডাল বন্ধ করার সাপোর্ট
(function() {
    const _origEscHandler = window._mpEscHandler;
    if (_origEscHandler) document.removeEventListener('keydown', _origEscHandler);
    window._mpEscHandler = function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('member-profile-modal');
            if (modal && modal.classList.contains('mp-active')) {
                window.closeMemberProfile();
            }
        }
    };
    document.addEventListener('keydown', window._mpEscHandler);
})();

// ব্যাকগ্রাউন্ডে ক্লিক করলে মডাল বন্ধ হবে
document.addEventListener('click', function(e) {
    const modal = document.getElementById('member-profile-modal');
    if (modal && modal.classList.contains('mp-active') && e.target === modal) {
        window.closeMemberProfile();
    }
});
// ===== সদস্য প্রোফাইল সিস্টেম সমাপ্ত =====