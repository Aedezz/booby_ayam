// ==============================
// STATE
// ==============================
let state = { items: {}, log: [], qris: 0 };
try {
    const saved = JSON.parse(localStorage.getItem('bobby_state'));
    if (saved) {
        state.items = saved.items || saved || {};
        state.log = saved.log || [];
        state.qris = saved.qris || 0;
    }
} catch (e) {
    console.error("Gagal membaca localStorage, mereset state:", e);
    state = { items: {}, log: [], qris: 0 };
}

// Render UI Menu
function renderMenu() {
    const container = document.getElementById('menuContainer');
    if (!container) return;
    container.innerHTML = '';

    let currentCategory = '';

    menuData.forEach(item => {
        if (item.category !== currentCategory) {
            const catHeader = document.createElement('h2');
            catHeader.className = 'text-xs font-black text-red-700 bg-red-50 border-l-4 border-red-600 px-3 py-2 mt-6 mb-3 tracking-wider uppercase rounded-r-md shadow-sm';
            catHeader.innerText = item.category;
            container.appendChild(catHeader);
            currentCategory = item.category;
        }

        const qty = state.items[item.id] || 0;

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

    // Set nilai awal input QRIS jika ada
    const inputQris = document.getElementById('inputQris');
    if (inputQris) {
        inputQris.value = state.qris > 0 ? state.qris : '';
    }

    calculateTotal();
}

// Update Quantity
function updateQty(id, change) {
    let currentQty = state.items[id] || 0;
    let newQty = currentQty + change;

    if (newQty < 0) newQty = 0;
    if (newQty === currentQty) return;

    state.items[id] = newQty;

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

// Update nilai QRIS dari Input UI
function updateQris(val) {
    const nominal = parseInt(val) || 0;
    state.qris = nominal;
    saveState();
    calculateTotal();
}

// Hitung Total Omset & Cash (Omset - QRIS)
function calculateTotal() {
    let total = 0;
    menuData.forEach(item => {
        const qty = state.items[item.id] || 0;
        total += qty * item.price;
    });

    const cash = total - state.qris;

    const totalEl = document.getElementById('totalOmset');
    const cashEl = document.getElementById('totalCash');

    if (totalEl) totalEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
    if (cashEl) cashEl.innerText = 'Rp ' + (cash < 0 ? 0 : cash).toLocaleString('id-ID');

    return { total, qris: state.qris, cash: cash < 0 ? 0 : cash };
}

function saveState() {
    localStorage.setItem('bobby_state', JSON.stringify(state));
}

// ==============================
// RIWAYAT HARI INI
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
// RESET HARIAN
// ==============================
function resetData() {
    if (!confirm('Yakin mau reset semua angka jadi 0 buat shift baru? Riwayat hari ini akan disimpan ke Arsip.')) {
        return;
    }

    if (state.log.length > 0 || state.qris > 0) {
        let archive = [];
        try {
            archive = JSON.parse(localStorage.getItem('bobby_riwayat_archive')) || [];
        } catch (e) {
            archive = [];
        }

        const totals = calculateTotal();
        const tanggalEl = document.getElementById('tanggalHariIni');

        archive.push({
            tanggal: tanggalEl ? tanggalEl.innerText : new Date().toLocaleDateString('id-ID'),
            timestamp: new Date().toISOString(),
            total: totals.total,
            qris: totals.qris,
            cash: totals.cash,
            items: { ...state.items },
            log: [...state.log]
        });

        localStorage.setItem('bobby_riwayat_archive', JSON.stringify(archive));
    }

    state = { items: {}, log: [], qris: 0 };
    saveState();
    renderMenu();
    renderRiwayatHariIni();
    renderArsipList();
}

// ==============================
// ARSIP
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
        list.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Belum ada arsip.</p>';
        return;
    }

    const items = [...archive].reverse();
    list.innerHTML = items.map((entry, idx) => {
        const realIndex = archive.length - 1 - idx;
        return `
            <button onclick="tampilkanDetailArsip(${realIndex})" class="w-full flex justify-between items-center py-3 border-b border-gray-50 text-left active:bg-gray-50 rounded-lg px-2">
                <div>
                    <p class="font-bold text-sm text-gray-800">${entry.tanggal}</p>
                    <p class="text-[11px] text-gray-400">Cash: Rp ${(entry.cash || 0).toLocaleString('id-ID')} | QRIS: Rp ${(entry.qris || 0).toLocaleString('id-ID')}</p>
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
        <div class="border-b pb-3 mb-3">
            <p class="font-bold text-gray-800 text-base mb-1">${entry.tanggal}</p>
            <div class="text-xs text-gray-600 space-y-1">
                <div class="flex justify-between"><span>Total Omset:</span> <span class="font-bold">Rp ${entry.total.toLocaleString('id-ID')}</span></div>
                <div class="flex justify-between text-blue-600"><span>QRIS (Digital):</span> <span class="font-bold">Rp ${(entry.qris || 0).toLocaleString('id-ID')}</span></div>
                <div class="flex justify-between text-green-600"><span>Setoran Cash:</span> <span class="font-bold">Rp ${(entry.cash || 0).toLocaleString('id-ID')}</span></div>
            </div>
        </div>
        ${adaItemTerjual ? ringkasanHtml : '<p class="text-xs text-gray-400 text-center py-4">Tidak ada item terjual.</p>'}
    `;
}

function tutupDetailArsip() {
    document.getElementById('riwayatArsipDetail').classList.add('hidden');
    document.getElementById('riwayatArsipList').classList.remove('hidden');
}

// ==============================
// MODAL RIWAYAT
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
// COPY KE WHATSAPP
// ==============================
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

    if (!hasData && state.qris === 0) {
        alert('Laporan masih kosong cuy, isi dulu angkanya.');
        return;
    }

    const qrisVal = state.qris || 0;
    const cashVal = total - qrisVal;

    text += `\n------------------\n`;
    text += `*TOTAL OMSET:* Rp ${total.toLocaleString('id-ID')}\n`;
    text += `*QRIS (Digital):* Rp ${qrisVal.toLocaleString('id-ID')}\n`;
    text += `*SETORAN CASH:* Rp ${(cashVal < 0 ? 0 : cashVal).toLocaleString('id-ID')}`;

    navigator.clipboard.writeText(text).then(() => {
        alert('Mantap! Format WA udah disalin (Omset, QRIS, & Cash). Tinggal paste aja.');
    }).catch(err => {
        console.error('Gagal copy text: ', err);
        alert('Gagal menyalin otomatis. Silakan coba lagi.');
    });
}

// Inisialisasi Tanggal & UI
const tglOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const elemenTanggal = document.getElementById('tanggalHariIni');
if (elemenTanggal) {
    elemenTanggal.innerText = new Date().toLocaleDateString('id-ID', tglOptions);
}

renderMenu();
renderRiwayatHariIni();
renderArsipList();