// ==============================================================
// PENGELUARAN - catat semua biaya operasional (gas, plastik, gaji, dll)
// Disimpan per tanggal, TIDAK ikut ke-reset oleh "Reset Hari Ini".
// ==============================================================

const PG_KEY = 'bobby_pengeluaran';
const PG_KATEGORI = ['Bahan Baku', 'Gas / Listrik', 'Gaji', 'Kemasan', 'Transport', 'Lain-lain'];

let pengeluaranList = loadJSON(PG_KEY, []); // [{id, nama, kategori, jumlah, tanggalKey, tanggal, timestamp}]

function pgTodayKey() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (waktu lokal)
}

function pgTodayDisplay() {
    const el = document.getElementById('tanggalHariIni');
    return el ? el.innerText : new Date().toLocaleDateString('id-ID');
}

function hitungPengeluaranHariIni() {
    const key = pgTodayKey();
    return pengeluaranList.filter(p => p.tanggalKey === key).reduce((s, p) => s + p.jumlah, 0);
}

function bukaModalPengeluaran() {
    bukaModalForm('Pengeluaran', buildPengeluaranHtml('hariini'));
}

function gantiTabPengeluaran(tab) {
    const body = document.getElementById('modalFormBody');
    if (body) body.innerHTML = buildPengeluaranHtml(tab);
}

function buildPengeluaranHtml(tab) {
    const key = pgTodayKey();
    const listHariIni = pengeluaranList.filter(p => p.tanggalKey === key).slice().reverse();
    const totalHariIni = hitungPengeluaranHariIni();

    const tabBtn = (k, label) => `
        <button onclick="gantiTabPengeluaran('${k}')" class="flex-1 text-xs font-bold py-2 rounded-full transition-colors ${tab === k ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}">${label}</button>
    `;

    const rowHtml = p => `
        <div class="flex justify-between items-center py-2 border-b border-gray-50">
            <div class="flex-1 pr-2">
                <p class="text-sm font-semibold text-gray-700">${p.nama}</p>
                <p class="text-[11px] text-gray-400">${p.kategori}</p>
            </div>
            <div class="text-right shrink-0">
                <p class="text-sm font-bold text-gray-800">Rp ${p.jumlah.toLocaleString('id-ID')}</p>
                <button onclick="hapusPengeluaran('${p.id}', '${tab}')" class="text-[11px] font-bold text-red-400">Hapus</button>
            </div>
        </div>
    `;

    let content = '';

    if (tab === 'hariini') {
        content = listHariIni.length === 0
            ? '<p class="text-xs text-gray-400 text-center py-6">Belum ada pengeluaran hari ini.</p>'
            : listHariIni.map(rowHtml).join('');
    } else {
        // Riwayat dikelompokkan per tanggal
        const grup = {};
        pengeluaranList.forEach(p => {
            if (!grup[p.tanggalKey]) grup[p.tanggalKey] = { tanggal: p.tanggal, items: [], total: 0 };
            grup[p.tanggalKey].items.push(p);
            grup[p.tanggalKey].total += p.jumlah;
        });
        const keys = Object.keys(grup).sort().reverse();

        content = keys.length === 0
            ? '<p class="text-xs text-gray-400 text-center py-6">Belum ada riwayat pengeluaran.</p>'
            : keys.map(k => `
                <div class="mb-4">
                    <div class="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 mb-1">
                        <span class="text-xs font-bold text-gray-700">${grup[k].tanggal}</span>
                        <span class="text-xs font-bold text-red-600">Rp ${grup[k].total.toLocaleString('id-ID')}</span>
                    </div>
                    ${grup[k].items.slice().reverse().map(rowHtml).join('')}
                </div>
            `).join('');
    }

    const formHtml = tab === 'hariini' ? `
        <div class="bg-gray-50 rounded-xl p-3 mb-3">
            <input id="inputNamaPengeluaran" type="text" placeholder="Beli apa? (cth: Gas 3kg)" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 bg-white">
            <div class="flex gap-2 mb-2">
                <select id="inputKategoriPengeluaran" class="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
                    ${PG_KATEGORI.map(k => `<option value="${k}">${k}</option>`).join('')}
                </select>
                <input id="inputJumlahPengeluaran" type="number" inputmode="numeric" min="0" placeholder="Rp" class="w-28 text-right border border-gray-200 rounded-lg px-2 py-2 text-sm font-bold bg-white">
            </div>
            <button onclick="tambahPengeluaran()" class="w-full bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm">+ Catat Pengeluaran</button>
        </div>
    ` : '';

    const copyBtn = (tab === 'hariini' && listHariIni.length > 0)
        ? `<button onclick="copyPengeluaranToWA()" class="w-full bg-gray-800 text-white font-bold py-2.5 rounded-xl mt-3 text-sm">Copy Pengeluaran ke WhatsApp</button>`
        : '';

    return `
        <div class="bg-red-50 rounded-xl p-3 mb-3 flex justify-between items-center">
            <span class="text-xs font-bold text-red-700">Total Hari Ini</span>
            <span class="font-bold text-red-700">Rp ${totalHariIni.toLocaleString('id-ID')}</span>
        </div>
        ${formHtml}
        <div class="flex gap-2 mb-3">
            ${tabBtn('hariini', 'Hari Ini')}
            ${tabBtn('riwayat', 'Riwayat')}
        </div>
        <div>${content}</div>
        ${copyBtn}
    `;
}

function tambahPengeluaran() {
    const nama = document.getElementById('inputNamaPengeluaran').value.trim();
    const kategori = document.getElementById('inputKategoriPengeluaran').value;
    const jumlah = Number(document.getElementById('inputJumlahPengeluaran').value) || 0;

    if (!nama) { alert('Isi dulu nama pengeluarannya.'); return; }
    if (jumlah <= 0) { alert('Jumlahnya harus lebih dari 0.'); return; }

    pengeluaranList.push({
        id: 'pg_' + Date.now(),
        nama,
        kategori,
        jumlah,
        tanggalKey: pgTodayKey(),
        tanggal: pgTodayDisplay(),
        timestamp: new Date().toISOString()
    });
    saveJSON(PG_KEY, pengeluaranList);
    gantiTabPengeluaran('hariini');
}

function hapusPengeluaran(id, tab) {
    if (!confirm('Hapus catatan pengeluaran ini?')) return;
    pengeluaranList = pengeluaranList.filter(p => p.id !== id);
    saveJSON(PG_KEY, pengeluaranList);
    gantiTabPengeluaran(tab || 'hariini');
}

function copyPengeluaranToWA() {
    const key = pgTodayKey();
    const list = pengeluaranList.filter(p => p.tanggalKey === key);
    if (list.length === 0) { alert('Belum ada pengeluaran hari ini.'); return; }

    let text = `*PENGELUARAN AYAM BOBBY*\nTanggal: ${pgTodayDisplay()}\n\n`;
    PG_KATEGORI.forEach(kat => {
        const items = list.filter(p => p.kategori === kat);
        if (items.length === 0) return;
        text += `*${kat.toUpperCase()}*\n`;
        items.forEach(p => { text += `- ${p.nama} = Rp ${p.jumlah.toLocaleString('id-ID')}\n`; });
        text += `\n`;
    });
    text += `------------------\n*TOTAL PENGELUARAN: Rp ${hitungPengeluaranHariIni().toLocaleString('id-ID')}*`;

    navigator.clipboard.writeText(text).then(() => {
        alert('Format WA pengeluaran udah disalin!');
    }).catch(() => alert('Gagal menyalin otomatis. Coba lagi.'));
}