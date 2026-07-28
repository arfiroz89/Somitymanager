// =====================================================================
// 🔧 Service Worker — সমিতি ম্যানেজার অফলাইন সাপোর্ট
// Static assets + Firebase SDK (gstatic.com): Cache-First
// Firebase/API ডেটা কল (firestore/auth): Network-First (কখনো cache না)
// =====================================================================

const CACHE_NAME     = 'somity-manager-v55'; // ✅ পাসওয়ার্ড রিসেটে "too-many-requests" এর জন্য স্পষ্ট মেসেজ যোগ (বারবার চেষ্টা করলে Firebase সাময়িকভাবে ব্লক করে)
const OFFLINE_URL    = './index.html';

// ── যেসব ফাইল প্রথমবারই cache করা হবে ──
const PRECACHE_URLS = [
    './',
    './index.html',
    './app.js',
    './style.css?v=46',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    // ✅ FIX: Firebase SDK ফাইলগুলো precache — অফলাইনে app.js এর import যেন ব্যর্থ না হয়
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
];

// ── যেসব URL কখনো cache করব না (always network) — আসল Firestore/Auth ডেটা কল ──
// ⚠️ লক্ষ্য করুন: এখানে 'gstatic' রাখা হয়নি, কারণ Firebase SDK ফাইলগুলো gstatic.com থেকেই আসে।
//    gstatic.com আলাদাভাবে নিচে cache-first হিসেবে হ্যান্ডল করা হয়েছে।
const NEVER_CACHE = [
    'firestore.googleapis',
    'firebaseio',
    'identitytoolkit',
    'securetoken.googleapis',
    'firebaseinstallations',
    'imgbb',
];

// =====================================================================
// INSTALL — precache করো
// =====================================================================
self.addEventListener('install', (event) => {
    console.log('[SW] install — precaching assets');
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // একটি একটি করে cache করো — কোনো একটি ব্যর্থ হলে বাকিগুলো চলবে
            await Promise.allSettled(
                PRECACHE_URLS.map(url =>
                    cache.add(url).catch(e =>
                        console.warn('[SW] precache ব্যর্থ:', url, e.message)
                    )
                )
            );
        })
    );
    self.skipWaiting(); // নতুন SW তাৎক্ষণিক active হবে
});

// =====================================================================
// ACTIVATE — পুরনো cache মুছো
// =====================================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] activate — পুরনো cache পরিষ্কার');
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] পুরনো cache মুছছে:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim()) // সব ট্যাব এই SW এর আওতায় আসবে
    );
});

// =====================================================================
// FETCH — request আসলে কী করব
// =====================================================================
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // ── GET ছাড়া অন্য method (POST/PUT/DELETE) skip করো ──
    if (event.request.method !== 'GET') return;

    let hostname = '';
    try { hostname = new URL(url).hostname; } catch (e) { /* ignore */ }

    // ✅ FIX: gstatic.com (Firebase SDK + Google Fonts ইত্যাদি স্ট্যাটিক ফাইল) — সবসময় Cache-First
    // এগুলো লাইভ ডেটা না, প্রতি ভার্সনে স্থির থাকে — তাই অফলাইনে কাজ করার জন্য cache করা জরুরি।
    if (hostname === 'www.gstatic.com' || hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.match(event.request).then(async (cachedResponse) => {
                if (cachedResponse) {
                    _updateCacheInBackground(event.request);
                    return cachedResponse;
                }
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse && networkResponse.status === 200) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (err) {
                    console.warn('[SW] gstatic অফলাইনে cache-এ পাওয়া যায়নি:', url);
                    return new Response('// অফলাইন — এই ফাইলটি আগে একবার অনলাইনে লোড করা প্রয়োজন।', {
                        status: 503,
                        headers: { 'Content-Type': 'application/javascript' }
                    });
                }
            })
        );
        return;
    }

    // ── আসল Firebase ডেটা API (firestore/auth) / অন্য সার্ভিস — কখনো cache করব না, সরাসরি network ──
    if (NEVER_CACHE.some(keyword => url.includes(keyword))) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // API অফলাইনে ব্যর্থ হলে — nothing to return (Firestore SDK নিজেই IndexedDB cache হ্যান্ডল করে)
                return new Response(JSON.stringify({ error: 'offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // ── Static assets (নিজের সাইটের ফাইল): Cache-First, তারপর Network ──
    event.respondWith(
        caches.match(event.request).then(async (cachedResponse) => {
            if (cachedResponse) {
                // ক্যাশে আছে — দাও, পাশাপাশি background এ আপডেট করো
                _updateCacheInBackground(event.request);
                return cachedResponse;
            }

            // ক্যাশে নেই — network থেকে আনো এবং cache করো
            try {
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            } catch (err) {
                // Network ব্যর্থ + cache ও নেই
                console.warn('[SW] offline fallback for:', url);

                // ✅ FIX: শুধুমাত্র পেজ navigation request (URL সরাসরি লোড/রিফ্রেশ) হলেই
                // index.html ফেরত দেওয়া হবে। app.js/style.css-এর মতো অন্য ফাইলের জন্য
                // ভুলভাবে HTML রিটার্ন করলে ব্রাউজার সেটাকে JS পার্স করতে গিয়ে
                // "SyntaxError: Unexpected token '<'" এরর দিয়ে পুরো অ্যাপ ভেঙে দেয়।
                if (event.request.mode === 'navigate') {
                    const fallback = await caches.match(OFFLINE_URL);
                    if (fallback) return fallback;
                }

                return new Response('// অফলাইন — এই ফাইলটি ক্যাশে পাওয়া যায়নি।', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        })
    );
});

// ── Background এ cache আপডেট (stale-while-revalidate) ──
function _updateCacheInBackground(request) {
    fetch(request).then(response => {
        if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response));
        }
    }).catch(() => {}); // অফলাইনে নীরবে ব্যর্থ হবে
}

// =====================================================================
// MESSAGE — app থেকে SW কে নির্দেশ পাঠানো
// =====================================================================
self.addEventListener('message', (event) => {
    // app.js থেকে 'SKIP_WAITING' message এলে তাৎক্ষণিক activate
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    // 'CACHE_URLS' message এলে নির্দিষ্ট URL গুলো cache করো
    if (event.data && event.data.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
        caches.open(CACHE_NAME).then(cache => {
            event.data.urls.forEach(url => cache.add(url).catch(() => {}));
        });
    }
});

// =====================================================================
// 🔔 PUSH NOTIFICATION — FCM থেকে push message আসলে notification দেখাও
// =====================================================================
self.addEventListener('push', (event) => {
    let data = { title: 'ডিজিটাল সমিতি ম্যানেজার', body: 'নতুন বার্তা আছে।', icon: './icons/icon-192x192.png' };
    try {
        if (event.data) {
            const json = event.data.json();
            if (json.notification) {
                data.title = json.notification.title || data.title;
                data.body  = json.notification.body  || data.body;
            } else if (json.data) {
                data.title = json.data.title || data.title;
                data.body  = json.data.body  || data.body;
            }
        }
    } catch(e) {
        if (event.data) data.body = event.data.text() || data.body;
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || './icons/icon-192x192.png',
            badge: './icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            data: { url: self.location.origin }
        })
    );
});

// notification-এ ক্লিক করলে অ্যাপ খুলবে
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
