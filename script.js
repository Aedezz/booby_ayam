// ==============================
// STATE
// state.items  -> { itemId: qty }
// state.log    -> [{ id, name, change, qtyAfter, time }]  (riwayat hari berjalan)
// ==============================
let state = { items: {}, log: [] };
try {
    const saved = JSON.parse(localStorage.getItem('bobby_state'));
    if (saved) {
        state.items = saved.items || saved || {}; // saved format lama (langsung {id: qty}) tetap kebaca
        state.log = saved.log || [];
    }
} catch (e) {
    console.error("Gagal membaca localStorage, mereset state:", e);
    state = { items: {}, log: [] };
}

// Render UI Menu
function renderMenu() {
    const container = document.getElementById('menuContainer');
    if (!container) return; // Safety check
    container.innerHTML = '';

    let currentCategory = '';

    menuData.forEach(item => {
        // Render Header Kategori
        if (item.category !== currentCategory) {
            const catHeader = document.createElement('h2');
            catHeader.className = 'text-xs font-black text-red-700 bg-red-50 border-l-4 border-red-600 px-3 py-2 mt-6 mb-3 tracking-wider uppercase rounded-r-md shadow-sm';
            catHeader.innerText = item.category;
            container.appendChild(catHeader);
            currentCategory = item.category;
        }

        const qty = state.items[item.id] || 0;

        // Render Item Baris
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center py-3 border-b border-gray-100';
        div.innerHTML = `
            <div class="flex-1 pr-4">
                <h3 class="text-sm font-bold text-gray-800 leading-tight">${item.name}</h3>
                <p class="text-xs text-gray-500 font-medium mt-0.5">Rp ${(item.price).toLocaleString('id-ID')}</p>
            </div>
            <div class="flex items-center gap-3 bg-gray-50 px-2 py-1.5 rounded-full border border-gray-100">
                <button onclick="updateQty('${item.id}', -1)" class="w-8 h-8 flex justify-center items-center bg-white text-gray-600 rounded-full shadow-sm active:bg-gray-100 transition-all font-bold text-lg leading-none select-none touch-manipulation pb-0.5">-</button>
                <span id="qty-${item.id}" class="w-5 text-center font-bold text-gray-800 text-sm">${qty}</span>
                <button onclick="updateQty('${item.id}', 1)" class="w-8 h-8 flex justify-center items-center bg-red-100 text-red-600 rounded-full shadow-sm active:bg-red-200 transition-all font-bold text-lg leading-none select-none touch-manipulation pb-0.5">+</button>
            </div>
        `;
        container.appendChild(div);
    });

    calculateTotal();
}

// Fungsi Update Quantity
function updateQty(id, change) {
    let currentQty = state.items[id] || 0;
    let newQty = currentQty + change;

    if (newQty < 0) newQty = 0;
    if (newQty === currentQty) return; // gak ada perubahan nyata (misal minus dari 0)

    state.items[id] = newQty;

    // Catat riwayat transaksi SAAT ITU JUGA
    const item = menuData.find(m => m.id === id);
    if (item) {
        state.log.push({
            id: id,
            name: item.name,
            change: change,
            qtyAfter: newQty,
            time: new Date().toISOString()
        });
    }

    document.getElementById(`qty-${id}`).innerText = newQty;
    saveState();
    calculateTotal();
    renderRiwayatHariIni();
}

// Hitung Total Omset
function calculateTotal() {
    let total = 0;
    menuData.forEach(item => {
        const qty = state.items[item.id] || 0;
        total += qty * item.price;
    });

    const totalEl = document.getElementById('totalOmset');
    if (totalEl) {
        totalEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
    }
    return total;
}

// Simpan ke Local Storage
function saveState() {
    localStorage.setItem('bobby_state', JSON.stringify(state));
}

// ==============================
// RIWAYAT HARI INI (real-time)
// ==============================
function formatJam(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function renderRiwayatHariIni() {
    const list = document.getElementById('riwayatHariIniList');
    if (!list) return;

    if (state.log.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Belum ada transaksi hari ini.</p>';
        return;
    }

    // Tampilkan terbaru di atas
    const items = [...state.log].reverse();
    list.innerHTML = items.map(entry => {
        const isPlus = entry.change > 0;
        const badge = isPlus
            ? `<span class="text-green-600 font-bold text-xs">+${entry.change}</span>`
            : `<span class="text-red-500 font-bold text-xs">${entry.change}</span>`;
        return `
            <div class="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                <div>
                    <p class="font-semibold text-gray-700">${entry.name}</p>
                    <p class="text-[11px] text-gray-400">${formatJam(entry.time)} &middot; jadi ${entry.qtyAfter}</p>
                </div>
                ${badge}
            </div>
        `;
    }).join('');
}

// ==============================
// RESET HARIAN (arsipkan dulu sebelum direset)
// ==============================
function resetData() {
    if (!confirm('Yakin mau reset semua angka jadi 0 buat shift baru? Riwayat hari ini akan disimpan ke Arsip.')) {
        return;
    }

    if (state.log.length > 0) {
        let archive = [];
        try {
            archive = JSON.parse(localStorage.getItem('bobby_riwayat_archive')) || [];
        } catch (e) {
            archive = [];
        }

        const total = calculateTotal();
        const tanggalEl = document.getElementById('tanggalHariIni');

        archive.push({
            tanggal: tanggalEl ? tanggalEl.innerText : new Date().toLocaleDateString('id-ID'),
            timestamp: new Date().toISOString(),
            total: total,
            items: { ...state.items },
            log: [...state.log]
        });

        localStorage.setItem('bobby_riwayat_archive', JSON.stringify(archive));
    }

    state = { items: {}, log: [] };
    saveState();
    renderMenu();
    renderRiwayatHariIni();
    renderArsipList();
}

// ==============================
// ARSIP (riwayat hari-hari sebelumnya)
// ==============================
function getArchive() {
    try {
        return JSON.parse(localStorage.getItem('bobby_riwayat_archive')) || [];
    } catch (e) {
        return [];
    }
}

function renderArsipList() {
    const list = document.getElementById('riwayatArsipList');
    if (!list) return;

    const archive = getArchive();

    if (archive.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Belum ada arsip. Arsip otomatis kesimpen tiap kamu pencet "Reset Hari Ini".</p>';
        return;
    }

    const items = [...archive].reverse(); // terbaru di atas
    list.innerHTML = items.map((entry, idx) => {
        const realIndex = archive.length - 1 - idx; // index asli di array archive
        return `
            <button onclick="tampilkanDetailArsip(${realIndex})" class="w-full flex justify-between items-center py-3 border-b border-gray-50 text-left active:bg-gray-50 rounded-lg px-2">
                <div>
                    <p class="font-bold text-sm text-gray-800">${entry.tanggal}</p>
                    <p class="text-[11px] text-gray-400">${entry.log.length} transaksi</p>
                </div>
                <span class="font-bold text-sm text-red-600">Rp ${entry.total.toLocaleString('id-ID')}</span>
            </button>
        `;
    }).join('');
}

function tampilkanDetailArsip(index) {
    const archive = getArchive();
    const entry = archive[index];
    if (!entry) return;

    document.getElementById('riwayatArsipList').classList.add('hidden');
    document.getElementById('riwayatArsipDetail').classList.remove('hidden');

    const detailEl = document.getElementById('riwayatArsipDetailContent');

    // Ringkasan stok final per item (bukan log naik-turun) yang terjual hari itu
    let currentCategory = '';
    let ringkasanHtml = '';
    let adaItemTerjual = false;

    menuData.forEach(item => {
        const qty = entry.items[item.id] || 0;
        if (qty > 0) {
            adaItemTerjual = true;

            if (item.category !== currentCategory) {
                ringkasanHtml += `<h3 class="text-[11px] font-black text-red-600 uppercase tracking-wide mt-3 mb-1">${item.category}</h3>`;
                currentCategory = item.category;
            }

            const subtotal = qty * item.price;
            ringkasanHtml += `
                <div class="flex justify-between items-center py-1.5 text-sm">
                    <p class="text-gray-700">${item.name} <span class="text-gray-400 font-semibold">x${qty}</span></p>
                    <p class="font-semibold text-gray-800">Rp ${subtotal.toLocaleString('id-ID')}</p>
                </div>
            `;
        }
    });

    detailEl.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <p class="font-bold text-gray-800">${entry.tanggal}</p>
            <p class="font-bold text-red-600">Rp ${entry.total.toLocaleString('id-ID')}</p>
        </div>
        ${adaItemTerjual ? ringkasanHtml : '<p class="text-xs text-gray-400 text-center py-4">Tidak ada item terjual.</p>'}
    `;
}

function tutupDetailArsip() {
    document.getElementById('riwayatArsipDetail').classList.add('hidden');
    document.getElementById('riwayatArsipList').classList.remove('hidden');
}

// ==============================
// MODAL RIWAYAT (tab: Hari Ini / Arsip)
// ==============================
function bukaModalRiwayat() {
    document.getElementById('modalRiwayat').classList.remove('hidden');
    gantiTabRiwayat('hariini');
}

function tutupModalRiwayat() {
    document.getElementById('modalRiwayat').classList.add('hidden');
    tutupDetailArsip();
}

function gantiTabRiwayat(tab) {
    const tabHariIni = document.getElementById('tabHariIni');
    const tabArsip = document.getElementById('tabArsip');
    const panelHariIni = document.getElementById('panelHariIni');
    const panelArsip = document.getElementById('panelArsip');

    if (tab === 'hariini') {
        tabHariIni.classList.add('bg-red-600', 'text-white');
        tabHariIni.classList.remove('bg-gray-100', 'text-gray-500');
        tabArsip.classList.add('bg-gray-100', 'text-gray-500');
        tabArsip.classList.remove('bg-red-600', 'text-white');
        panelHariIni.classList.remove('hidden');
        panelArsip.classList.add('hidden');
        renderRiwayatHariIni();
    } else {
        tabArsip.classList.add('bg-red-600', 'text-white');
        tabArsip.classList.remove('bg-gray-100', 'text-gray-500');
        tabHariIni.classList.add('bg-gray-100', 'text-gray-500');
        tabHariIni.classList.remove('bg-red-600', 'text-white');
        panelArsip.classList.remove('hidden');
        panelHariIni.classList.add('hidden');
        tutupDetailArsip();
        renderArsipList();
    }
}

// ==============================
// NAVIGASI HALAMAN (Kasir / Stock)
// ==============================
function bukaMenuNav() {
    document.getElementById('menuNav').classList.remove('hidden');
}

function tutupMenuNav() {
    document.getElementById('menuNav').classList.add('hidden');
}

function pindahHalaman(halaman) {
    const pageKasir = document.getElementById('pageKasir');
    const pageStock = document.getElementById('pageStock');
    const navKasir = document.getElementById('navKasir');
    const navStock = document.getElementById('navStock');
    const headerActionsKasir = document.getElementById('headerActionsKasir');
    const headerActionsStock = document.getElementById('headerActionsStock');

    if (halaman === 'kasir') {
        pageKasir.classList.remove('hidden');
        pageStock.classList.add('hidden');
        headerActionsKasir.classList.remove('hidden');
        headerActionsKasir.classList.add('flex');
        headerActionsStock.classList.add('hidden');
        headerActionsStock.classList.remove('flex');
        navKasir.classList.add('bg-red-50', 'text-red-700');
        navKasir.classList.remove('bg-gray-50', 'text-gray-600');
        navStock.classList.add('bg-gray-50', 'text-gray-600');
        navStock.classList.remove('bg-red-50', 'text-red-700');
    } else {
        pageStock.classList.remove('hidden');
        pageKasir.classList.add('hidden');
        headerActionsStock.classList.remove('hidden');
        headerActionsStock.classList.add('flex');
        headerActionsKasir.classList.add('hidden');
        headerActionsKasir.classList.remove('flex');
        navStock.classList.add('bg-red-50', 'text-red-700');
        navStock.classList.remove('bg-gray-50', 'text-gray-600');
        navKasir.classList.add('bg-gray-50', 'text-gray-600');
        navKasir.classList.remove('bg-red-50', 'text-red-700');

        if (typeof renderSemuaStock === 'function') {
            renderSemuaStock();
        }
    }

    tutupMenuNav();
}

// Copy ke WhatsApp
function copyToWA() {
    let dateStr = document.getElementById('tanggalHariIni').innerText;
    let text = `*LAPORAN AYAM BOBBY*\nTanggal: ${dateStr}\n\n`;
    let hasData = false;
    let total = 0;
    let currentCategory = '';

    menuData.forEach(item => {
        const qty = state.items[item.id] || 0;
        if (qty > 0) {
            hasData = true;

            if (item.category !== currentCategory) {
                text += `\n*${item.category.toUpperCase()}*\n`;
                currentCategory = item.category;
            }

            text += `- ${item.name} x${qty} = ${(item.price * qty / 1000)}k\n`;
            total += (qty * item.price);
        }
    });

    if (!hasData) {
        alert('Laporan masih kosong cuy, isi dulu angkanya.');
        return;
    }

    text += `\n------------------\n`;
    text += `*TOTAL OMSET: Rp ${total.toLocaleString('id-ID')}*`;

    navigator.clipboard.writeText(text).then(() => {
        alert('Mantap! Format WA udah disalin, tinggal paste aja bro.');
    }).catch(err => {
        console.error('Gagal copy text: ', err);
        alert('Gagal menyalin otomatis. Silakan coba lagi.');
    });
}

// --- INISIALISASI SAAT SCRIPT DIMUAT ---
// Set tanggal
const tglOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const elemenTanggal = document.getElementById('tanggalHariIni');
if (elemenTanggal) {
    elemenTanggal.innerText = new Date().toLocaleDateString('id-ID', tglOptions);
}

// Jalankan render UI pertama kali
renderMenu();
renderRiwayatHariIni();
renderArsipList();