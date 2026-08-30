// ==============================================================
// PIUTANG - Penjualan yang barangnya udah keluar tapi belum dibayar
// Barang di piutang TETAP masuk ke Total Omset (karena tetap penjualan),
// cuma dipisah pencatatannya biar gampang dicek: udah lunas apa belum.
// Piutang TIDAK ikut ke-reset oleh "Reset Hari Ini" -- karena utang gak
// otomatis hilang cuma karena gantian shift/hari.
// ==============================================================

const PT_KEY = 'bobby_piutang';

let piutangList = loadJSON(PT_KEY, []); // [{id, customer, items:[{id,name,qty,price}], total, tanggal, status:'belum'|'lunas', timestamp, timestampLunas}]
let draftPiutang = {}; // { menuItemId: qty } -- sementara pas lagi bikin piutang baru

function todayDisplayPT() {
    const el = document.getElementById('tanggalHariIni');
    return el ? el.innerText : new Date().toLocaleDateString('id-ID');
}

// ==============================
// HITUNG
// ==============================
function hitungTotalPiutangBelumLunas() {
    return piutangList.filter(p => p.status === 'belum').reduce((s, p) => s + p.total, 0);
}

// ==============================
// MODAL UTAMA PIUTANG
// ==============================
function bukaModalPiutang() {
    bukaModalForm('Piutang', buildPiutangTabHtml('belum'));
}

function buildPiutangTabHtml(tab) {
    const totalBelum = hitungTotalPiutangBelumLunas();
    const listBelum = piutangList.filter(p => p.status === 'belum').slice().reverse();
    const listLunas = piutangList.filter(p => p.status === 'lunas').slice().reverse();

    const tabBtn = (key, label) => `
        <button onclick="gantiTabPiutang('${key}')" class="flex-1 text-xs font-bold py-2 rounded-full transition-colors ${tab === key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}">${label}</button>
    `;

    const renderList = (list, isBelum) => {
        if (list.length === 0) {
            return `<p class="text-xs text-gray-400 text-center py-6">${isBelum ? 'Gak ada piutang yang belum lunas. Mantap!' : 'Belum ada riwayat piutang lunas.'}</p>`;
        }
        return list.map(p => {
            const itemsRingkas = p.items.map(i => `${i.name} x${i.qty}`).join(', ');
            return `
                <div class="border-b border-gray-50 py-2.5">
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex-1">
                            <p class="font-bold text-sm text-gray-800">${p.customer || 'Tanpa nama'}</p>
                            <p class="text-[11px] text-gray-400">${itemsRingkas}</p>
                            <p class="text-[11px] text-gray-400">${p.tanggal}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="font-bold text-sm text-gray-800">Rp ${p.total.toLocaleString('id-ID')}</p>
                            ${isBelum
                                ? `<button onclick="tandaiPiutangLunas('${p.id}')" class="text-[11px] font-bold text-green-600 mt-1">✓ Tandai Lunas</button>`
                                : `<button onclick="hapusPiutang('${p.id}')" class="text-[11px] font-bold text-red-400 mt-1">Hapus catatan</button>`}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const contentHtml = tab === 'belum' ? renderList(listBelum, true) : renderList(listLunas, false);

    return `
        <div class="bg-red-50 rounded-xl p-3 mb-3 flex justify-between items-center">
            <span class="text-xs font-bold text-red-700">Total Belum Lunas</span>
            <span class="font-bold text-red-700">Rp ${totalBelum.toLocaleString('id-ID')}</span>
        </div>
        <button onclick="bukaFormPiutangBaru()" class="w-full bg-red-600 text-white font-bold py-2.5 rounded-xl mb-3 text-sm">+ Catat Piutang Baru</button>
        <div class="flex gap-2 mb-3">
            ${tabBtn('belum', 'Belum Lunas')}
            ${tabBtn('lunas', 'Lunas')}
        </div>
        <div>${contentHtml}</div>
    `;
}

function gantiTabPiutang(tab) {
    const body = document.getElementById('modalFormBody');
    if (body) body.innerHTML = buildPiutangTabHtml(tab);
}

function tandaiPiutangLunas(id) {
    const p = piutangList.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Tandai piutang "${p.customer || 'Tanpa nama'}" sebesar Rp ${p.total.toLocaleString('id-ID')} sebagai LUNAS?`)) return;

    p.status = 'lunas';
    p.timestampLunas = new Date().toISOString();
    saveJSON(PT_KEY, piutangList);
    gantiTabPiutang('belum');
    if (typeof renderRingkasanPembayaran === 'function') renderRingkasanPembayaran();
}

function hapusPiutang(id) {
    if (!confirm('Hapus catatan piutang ini? (Cuma hapus catatannya aja, jumlah barang yang udah kesimpen di Total Omset TIDAK ikut berkurang.)')) return;
    piutangList = piutangList.filter(p => p.id !== id);
    saveJSON(PT_KEY, piutangList);
    gantiTabPiutang('lunas');
    if (typeof renderRingkasanPembayaran === 'function') renderRingkasanPembayaran();
}

// ==============================
// FORM: CATAT PIUTANG BARU (pilih item kayak di menu kasir)
// ==============================
function bukaFormPiutangBaru() {
    draftPiutang = {};
    renderFormPiutangBaru();
}

function renderFormPiutangBaru() {
    let currentCategory = '';
    const menuHtml = menuData.map(item => {
        let header = '';
        if (item.category !== currentCategory) {
            header = `<h3 class="text-[11px] font-black text-red-600 uppercase tracking-wide mt-3 mb-1">${item.category}</h3>`;
            currentCategory = item.category;
        }
        const qty = draftPiutang[item.id] || 0;
        return `
            ${header}
            <div class="flex justify-between items-center py-1.5 border-b border-gray-50">
                <div class="flex-1 pr-2">
                    <p class="text-xs font-semibold text-gray-700">${item.name}</p>
                    <p class="text-[11px] text-gray-400">Rp ${item.price.toLocaleString('id-ID')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="ubahDraftPiutang('${item.id}', -1)" class="w-6 h-6 bg-gray-100 rounded-full text-gray-600 font-bold text-sm">-</button>
                    <span class="w-4 text-center text-xs font-bold">${qty}</span>
                    <button onclick="ubahDraftPiutang('${item.id}', 1)" class="w-6 h-6 bg-red-100 rounded-full text-red-600 font-bold text-sm">+</button>
                </div>
            </div>
        `;
    }).join('');

    let totalDraft = 0;
    Object.keys(draftPiutang).forEach(id => {
        const item = menuData.find(m => m.id === id);
        if (item) totalDraft += (draftPiutang[id] || 0) * item.price;
    });

    const html = `
        <button onclick="gantiTabPiutang('belum')" class="text-xs font-bold text-gray-400 mb-3">← Batal</button>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Nama Pembeli (opsional)</label>
            <input id="inputNamaPiutang" type="text" placeholder="Contoh: Pak Budi" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="max-h-[40vh] overflow-y-auto mb-3">${menuHtml}</div>
        <div class="flex justify-between items-center mb-3 font-bold text-sm border-t border-gray-100 pt-2">
            <span>Total</span>
            <span>Rp ${totalDraft.toLocaleString('id-ID')}</span>
        </div>
        <button onclick="submitPiutangBaru()" class="w-full bg-red-600 text-white font-bold py-3 rounded-xl">Simpan sebagai Piutang</button>
    `;

    const body = document.getElementById('modalFormBody');
    if (body) body.innerHTML = html;
}

function ubahDraftPiutang(id, change) {
    const qty = (draftPiutang[id] || 0) + change;
    draftPiutang[id] = qty < 0 ? 0 : qty;
    renderFormPiutangBaru();
}

function submitPiutangBaru() {
    const namaInput = document.getElementById('inputNamaPiutang');
    const customer = namaInput ? namaInput.value.trim() : '';
    const itemIds = Object.keys(draftPiutang).filter(id => draftPiutang[id] > 0);

    if (itemIds.length === 0) {
        alert('Pilih minimal 1 item dulu.');
        return;
    }

    const items = [];
    let total = 0;

    itemIds.forEach(id => {
        const item = menuData.find(m => m.id === id);
        if (!item) return;
        const qty = draftPiutang[id];
        items.push({ id, name: item.name, qty, price: item.price });
        total += qty * item.price;

        // Tetap masuk ke Total Omset & Riwayat kasir hari ini, karena ini tetap penjualan
        updateQty(id, qty);
    });

    piutangList.push({
        id: 'pt_' + Date.now(),
        customer,
        items,
        total,
        tanggal: todayDisplayPT(),
        status: 'belum',
        timestamp: new Date().toISOString(),
        timestampLunas: null
    });
    saveJSON(PT_KEY, piutangList);

    draftPiutang = {};
    gantiTabPiutang('belum');
    if (typeof renderRingkasanPembayaran === 'function') renderRingkasanPembayaran();
}