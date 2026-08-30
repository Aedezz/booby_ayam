// ==============================================================
// HALAMAN STOCK - Monitoring & Rekonsiliasi Stok
// Alur: Stok Masuk / Retur -> Stok Keluar (ke lapangan) -> Stok Masak
//       (jadi jenis produk siap jual) -> Rekonsiliasi vs Penjualan Kasir
// Semua data di sini (kecuali definisi Bahan Baku) direset & diarsipkan
// bareng tombol "Reset Hari Ini" di halaman Kasir.
// ==============================================================

const SK_BAHAN = 'bobby_bahan_baku';
const SK_MASUK = 'bobby_stok_masuk';
const SK_KELUAR = 'bobby_stok_keluar';
const SK_MASAK = 'bobby_stok_masak';
const SK_RETUR = 'bobby_stok_retur';
const SK_MAPPING = 'bobby_produk_mapping';
const SK_SISA_FISIK = 'bobby_sisa_fisik';
const SK_STOCK_ARCHIVE = 'bobby_stock_archive';

function loadJSON(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
}

let bahanBakuList = loadJSON(SK_BAHAN, []);       // [{id, nama, satuan, resepKonversi:[{jenisProduk, jumlahPerUnit}]}]  -- TIDAK direset harian
let stokMasukList = loadJSON(SK_MASUK, []);       // [{id, bahanBakuId, jumlah, tanggal, harga, catatan, timestamp}]
let stokKeluarList = loadJSON(SK_KELUAR, []);     // [{id, bahanBakuId, jumlah, tanggal, catatan, timestamp}]
let stokMasakList = loadJSON(SK_MASAK, []);       // [{id, bahanBakuId, jumlahDiproses, tanggal, timestamp, hasil:[{jenisProduk, jumlah}]}]
let stokReturList = loadJSON(SK_RETUR, []);       // [{id, bahanBakuId, jumlah, tanggal, catatan, timestamp}]
let produkMapping = loadJSON(SK_MAPPING, {});     // { menuItemId: [ {jenisProduk, jumlahPerPorsi}, ... ] }
let sisaFisikSaatIni = loadJSON(SK_SISA_FISIK, {}); // { jenisProduk: qty } -- periode berjalan (sejak reset terakhir)
let stockArchiveList = loadJSON(SK_STOCK_ARCHIVE, []); // riwayat laporan stock per periode/hari

// Normalisasi format lama mapping (single object) ke array
Object.keys(produkMapping).forEach(k => {
    if (produkMapping[k] && !Array.isArray(produkMapping[k])) {
        produkMapping[k] = [produkMapping[k]];
    }
});

let tempResep = []; // dipakai sementara pas isi form tambah/edit bahan baku
let tempNamaBahan = '';
let tempSatuanBahan = '';
let editingBahanBakuId = null; // null = mode tambah baru, isi id = mode edit

function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ==============================
// PERHITUNGAN STOK (selalu dari data periode berjalan / belum direset)
// ==============================
function hitungStokUtama(bahanBakuId) {
    const masuk = stokMasukList.filter(x => x.bahanBakuId === bahanBakuId).reduce((s, x) => s + x.jumlah, 0);
    const retur = stokReturList.filter(x => x.bahanBakuId === bahanBakuId).reduce((s, x) => s + x.jumlah, 0);
    const keluar = stokKeluarList.filter(x => x.bahanBakuId === bahanBakuId).reduce((s, x) => s + x.jumlah, 0);
    return masuk + retur - keluar;
}

function hitungStokLapanganMentah(bahanBakuId) {
    const keluar = stokKeluarList.filter(x => x.bahanBakuId === bahanBakuId).reduce((s, x) => s + x.jumlah, 0);
    const retur = stokReturList.filter(x => x.bahanBakuId === bahanBakuId).reduce((s, x) => s + x.jumlah, 0);
    const dimasak = stokMasakList.filter(x => x.bahanBakuId === bahanBakuId).reduce((s, x) => s + x.jumlahDiproses, 0);
    return keluar - retur - dimasak;
}

function getJenisProdukList() {
    const set = new Set();
    bahanBakuList.forEach(b => (b.resepKonversi || []).forEach(r => set.add(r.jenisProduk)));
    return Array.from(set);
}

function getStokMasakSaatIni(jenisProduk) {
    let total = 0;
    stokMasakList.forEach(m => {
        m.hasil.forEach(h => { if (h.jenisProduk === jenisProduk) total += h.jumlah; });
    });
    return total;
}

function getPenjualanTercatat(jenisProduk) {
    let total = 0;
    if (typeof state !== 'undefined' && state && state.items) {
        Object.keys(state.items).forEach(menuId => {
            const rows = produkMapping[menuId] || [];
            rows.forEach(row => {
                if (row.jenisProduk === jenisProduk) {
                    total += (state.items[menuId] || 0) * (row.jumlahPerPorsi || 1);
                }
            });
        });
    }
    return total;
}

function getSisaFisik(jenisProduk) {
    const val = sisaFisikSaatIni[jenisProduk];
    return (val === undefined || val === null) ? '' : val;
}

function simpanSisaFisik(jenisProduk, jumlah) {
    sisaFisikSaatIni[jenisProduk] = jumlah;
    saveJSON(SK_SISA_FISIK, sisaFisikSaatIni);
}

function hitungPengeluaranSaatIni() {
    return stokMasukList.reduce((s, x) => s + (x.jumlah * (x.harga || 0)), 0);
}

// ==============================
// AKSI: BAHAN BAKU
// ==============================
function tambahBahanBaku(nama, satuan, resepKonversiArr) {
    const id = 'bb_' + Date.now();
    bahanBakuList.push({ id, nama, satuan, resepKonversi: resepKonversiArr || [] });
    saveJSON(SK_BAHAN, bahanBakuList);
    renderSemuaStock();
}

function hapusBahanBaku(bahanBakuId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    if (!confirm(`Yakin mau hapus bahan baku "${bahan.nama}"? Semua riwayat stok masuk, keluar, retur, dan masak yang terkait bahan ini juga akan ikut terhapus. Tindakan ini gak bisa dibatalkan.`)) {
        return;
    }

    bahanBakuList = bahanBakuList.filter(b => b.id !== bahanBakuId);
    stokMasukList = stokMasukList.filter(x => x.bahanBakuId !== bahanBakuId);
    stokKeluarList = stokKeluarList.filter(x => x.bahanBakuId !== bahanBakuId);
    stokMasakList = stokMasakList.filter(x => x.bahanBakuId !== bahanBakuId);
    stokReturList = stokReturList.filter(x => x.bahanBakuId !== bahanBakuId);

    saveJSON(SK_BAHAN, bahanBakuList);
    saveJSON(SK_MASUK, stokMasukList);
    saveJSON(SK_KELUAR, stokKeluarList);
    saveJSON(SK_MASAK, stokMasakList);
    saveJSON(SK_RETUR, stokReturList);

    renderSemuaStock();
}

// ==============================
// AKSI: STOK MASUK
// ==============================
function submitStokMasuk(bahanBakuId, entryId) {
    const jumlah = Number(document.getElementById('inputJumlahMasuk').value);
    const tanggal = document.getElementById('inputTanggalMasuk').value || todayKey();
    const harga = Number(document.getElementById('inputHargaMasuk').value) || 0;
    const catatan = document.getElementById('inputCatatanMasuk').value.trim();

    if (!jumlah || jumlah <= 0) { alert('Jumlah harus diisi dan lebih dari 0.'); return; }

    if (entryId) {
        const entry = stokMasukList.find(x => x.id === entryId);
        if (entry) {
            entry.jumlah = jumlah;
            entry.tanggal = tanggal;
            entry.harga = harga;
            entry.catatan = catatan;
            saveJSON(SK_MASUK, stokMasukList);
        }
        renderSemuaStock();
        bukaModalRiwayatBahan(bahanBakuId);
    } else {
        stokMasukList.push({
            id: 'in_' + Date.now(),
            bahanBakuId, jumlah, tanggal, harga, catatan,
            timestamp: new Date().toISOString()
        });
        saveJSON(SK_MASUK, stokMasukList);
        renderSemuaStock();
        tutupModalForm();
    }
}

// ==============================
// AKSI: STOK KELUAR
// ==============================
function submitStokKeluar(bahanBakuId, entryId) {
    const jumlah = Number(document.getElementById('inputJumlahKeluar').value);
    const tanggal = document.getElementById('inputTanggalKeluar').value || todayKey();
    const catatan = document.getElementById('inputCatatanKeluar').value.trim();

    let entry = null;
    if (entryId) entry = stokKeluarList.find(x => x.id === entryId);

    const tersediaDasar = hitungStokUtama(bahanBakuId) + (entry ? entry.jumlah : 0);

    if (!jumlah || jumlah <= 0) { alert('Jumlah harus diisi dan lebih dari 0.'); return; }
    if (jumlah > tersediaDasar) { alert(`Stok gudang cuma tersedia ${tersediaDasar}. Gak bisa keluar lebih dari itu.`); return; }

    if (entryId && entry) {
        entry.jumlah = jumlah;
        entry.tanggal = tanggal;
        entry.catatan = catatan;
        saveJSON(SK_KELUAR, stokKeluarList);
        renderSemuaStock();
        bukaModalRiwayatBahan(bahanBakuId);
    } else {
        stokKeluarList.push({
            id: 'out_' + Date.now(),
            bahanBakuId, jumlah, tanggal, catatan,
            timestamp: new Date().toISOString()
        });
        saveJSON(SK_KELUAR, stokKeluarList);
        renderSemuaStock();
        tutupModalForm();
    }
}

// ==============================
// AKSI: RETUR (barang balik ke stok gudang, BUKAN pembelian baru)
// ==============================
function bukaModalRetur(bahanBakuId, entryId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    let entry = null;
    if (entryId) {
        entry = stokReturList.find(x => x.id === entryId);
        if (!entry) return;
    }

    const tersediaDasar = hitungStokLapanganMentah(bahanBakuId) + (entry ? entry.jumlah : 0);

    const html = `
        <p class="text-sm font-bold text-gray-800 mb-1">${bahan.nama} <span class="text-gray-400 font-normal">(${bahan.satuan})</span></p>
        <p class="text-[11px] text-gray-400 mb-3">Buat catat barang yang balik lagi dari lapangan ke stok gudang — misal Ayam Utuh yang gak jadi kejual / dikembalikan customer. Otomatis ngurangin Stok Lapangan & nambahin Stok Gudang. TIDAK dihitung sebagai pengeluaran baru.</p>
        <p class="text-[11px] text-gray-400 mb-3">Stok lapangan saat ini: <span class="font-bold text-gray-700">${tersediaDasar} ${bahan.satuan}</span></p>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Jumlah Kembali</label>
            <input id="inputJumlahRetur" type="number" min="0" max="${tersediaDasar}" value="${entry ? entry.jumlah : ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Tanggal</label>
            <input id="inputTanggalRetur" type="date" value="${entry ? entry.tanggal : todayKey()}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Catatan</label>
            <input id="inputCatatanRetur" type="text" value="${entry && entry.catatan ? entry.catatan : ''}" placeholder="Contoh: Ayam Utuh gak jadi diambil customer" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <button onclick="submitRetur('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">${entry ? 'Simpan Perubahan' : 'Simpan Retur'}</button>
    `;
    bukaModalForm(entry ? 'Edit Retur' : 'Retur / Barang Kembali', html);
}

function submitRetur(bahanBakuId, entryId) {
    const jumlah = Number(document.getElementById('inputJumlahRetur').value);
    const tanggal = document.getElementById('inputTanggalRetur').value || todayKey();
    const catatan = document.getElementById('inputCatatanRetur').value.trim();

    let entry = null;
    if (entryId) entry = stokReturList.find(x => x.id === entryId);

    const tersediaDasar = hitungStokLapanganMentah(bahanBakuId) + (entry ? entry.jumlah : 0);

    if (!jumlah || jumlah <= 0) { alert('Jumlah harus diisi dan lebih dari 0.'); return; }
    if (jumlah > tersediaDasar) { alert(`Stok lapangan cuma tersedia ${tersediaDasar}. Gak bisa retur lebih dari itu.`); return; }

    if (entryId && entry) {
        entry.jumlah = jumlah;
        entry.tanggal = tanggal;
        entry.catatan = catatan;
        saveJSON(SK_RETUR, stokReturList);
        renderSemuaStock();
        bukaModalRiwayatBahan(bahanBakuId);
    } else {
        stokReturList.push({
            id: 'ret_' + Date.now(),
            bahanBakuId, jumlah, tanggal, catatan,
            timestamp: new Date().toISOString()
        });
        saveJSON(SK_RETUR, stokReturList);
        renderSemuaStock();
        tutupModalForm();
    }
}

// ==============================
// AKSI: STOK MASAK
// ==============================
function submitMasak(bahanBakuId, entryId) {
    const jumlah = Number(document.getElementById('inputJumlahMasak').value);
    const tanggal = document.getElementById('inputTanggalMasak').value || todayKey();
    if (!jumlah || jumlah <= 0) { alert('Jumlah harus diisi dan lebih dari 0.'); return; }

    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    let entry = null;
    if (entryId) entry = stokMasakList.find(x => x.id === entryId);

    const tersediaDasar = hitungStokLapanganMentah(bahanBakuId) + (entry ? entry.jumlahDiproses : 0);
    if (jumlah > tersediaDasar) {
        alert(`Stok lapangan ${bahan.nama} cuma tersedia ${tersediaDasar} ${bahan.satuan}.`);
        return;
    }

    const hasil = (bahan.resepKonversi || []).map(r => ({
        jenisProduk: r.jenisProduk,
        jumlah: r.jumlahPerUnit * jumlah
    }));

    if (entryId && entry) {
        entry.jumlahDiproses = jumlah;
        entry.tanggal = tanggal;
        entry.hasil = hasil;
        saveJSON(SK_MASAK, stokMasakList);
        renderSemuaStock();
        bukaModalRiwayatBahan(bahanBakuId);
    } else {
        stokMasakList.push({
            id: 'sm_' + Date.now(),
            bahanBakuId, jumlahDiproses: jumlah,
            tanggal,
            timestamp: new Date().toISOString(),
            hasil
        });
        saveJSON(SK_MASAK, stokMasakList);
        renderSemuaStock();
        tutupModalForm();
    }
}

// ==============================
// RESET & ARSIP STOCK (dipanggil bareng "Reset Hari Ini" di Kasir)
// Bahan Baku (definisi) TIDAK direset, cuma data transaksionalnya.
// ==============================
function resetStockHarian() {
    const adaData = stokMasukList.length || stokKeluarList.length || stokMasakList.length || stokReturList.length;
    if (!adaData) return;

    const tanggalEl = document.getElementById('tanggalHariIni');
    const tanggalDisplay = tanggalEl ? tanggalEl.innerText : new Date().toLocaleDateString('id-ID');

    const ringkasanBahan = bahanBakuList.map(b => {
        const totalMasuk = stokMasukList.filter(x => x.bahanBakuId === b.id).reduce((s, x) => s + x.jumlah, 0);
        const totalRetur = stokReturList.filter(x => x.bahanBakuId === b.id).reduce((s, x) => s + x.jumlah, 0);
        const totalKeluar = stokKeluarList.filter(x => x.bahanBakuId === b.id).reduce((s, x) => s + x.jumlah, 0);
        const totalDimasak = stokMasakList.filter(x => x.bahanBakuId === b.id).reduce((s, x) => s + x.jumlahDiproses, 0);
        const pengeluaran = stokMasukList.filter(x => x.bahanBakuId === b.id).reduce((s, x) => s + (x.jumlah * (x.harga || 0)), 0);

        return {
            nama: b.nama, satuan: b.satuan,
            totalMasuk, totalRetur, totalKeluar, totalDimasak,
            stokAkhirGudang: totalMasuk + totalRetur - totalKeluar,
            stokAkhirLapangan: totalKeluar - totalRetur - totalDimasak,
            pengeluaran
        };
    });

    const ringkasanRekonsiliasi = getJenisProdukList().map(jenis => {
        const masak = getStokMasakSaatIni(jenis);
        const terjual = getPenjualanTercatat(jenis);
        const harusnya = masak - terjual;
        const fisikVal = getSisaFisik(jenis);
        const fisik = fisikVal === '' ? null : Number(fisikVal);
        const selisih = fisik === null ? null : (fisik - harusnya);
        return { jenis, masak, terjual, harusnya, fisik, selisih };
    });

    stockArchiveList.push({
        tanggal: tanggalDisplay,
        timestamp: new Date().toISOString(),
        totalPengeluaran: hitungPengeluaranSaatIni(),
        bahanBaku: ringkasanBahan,
        rekonsiliasi: ringkasanRekonsiliasi
    });
    saveJSON(SK_STOCK_ARCHIVE, stockArchiveList);

    // Reset data transaksional, TAPI bawa sisa Gudang & Lapangan (kalau masih ada) jadi saldo awal
    // periode baru -- biar gak perlu itung ulang / double check tiap reset. Sisa 0 ya tetap 0.
    const tanggalBaru = todayKey();
    const masukBaru = [];
    const keluarBaru = [];

    bahanBakuList.forEach((b, idx) => {
        const ringkasan = ringkasanBahan[idx];
        const sisaGudang = Math.max(0, ringkasan.stokAkhirGudang);
        const sisaLapangan = Math.max(0, ringkasan.stokAkhirLapangan);
        const totalBawa = sisaGudang + sisaLapangan;

        if (totalBawa > 0) {
            masukBaru.push({
                id: 'in_' + Date.now() + '_' + b.id,
                bahanBakuId: b.id,
                jumlah: totalBawa,
                tanggal: tanggalBaru,
                harga: 0, // saldo bawaan, bukan pembelian baru -- gak dihitung pengeluaran
                catatan: 'Saldo awal (sisa dari periode sebelumnya)',
                timestamp: new Date().toISOString()
            });
        }
        if (sisaLapangan > 0) {
            keluarBaru.push({
                id: 'out_' + Date.now() + '_' + b.id,
                bahanBakuId: b.id,
                jumlah: sisaLapangan,
                tanggal: tanggalBaru,
                catatan: 'Saldo awal (sisa dari periode sebelumnya)',
                timestamp: new Date().toISOString()
            });
        }
    });

    stokMasukList = masukBaru;
    stokKeluarList = keluarBaru;

    // Sisa fisik potongan (Dada/Sayap/dll) yang masih ada, dibawa jadi stok Masak awal
    // periode baru -- siap dijual lagi. Cuma yang emang KEISI angka Sisa Fisik-nya
    // (bukan yang dikosongin) yang dibawa, biar gak nebak-nebak.
    const masakBaru = [];
    ringkasanRekonsiliasi.forEach(r => {
        if (r.fisik !== null && r.fisik > 0) {
            masakBaru.push({
                id: 'sm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                bahanBakuId: null, // gak nempel ke bahan baku tertentu, ini murni saldo potongan sisa
                jumlahDiproses: 0,
                tanggal: tanggalBaru,
                timestamp: new Date().toISOString(),
                hasil: [{ jenisProduk: r.jenis, jumlah: r.fisik }],
                catatan: 'Saldo awal (sisa fisik dari periode sebelumnya)'
            });
        }
    });
    stokMasakList = masakBaru;

    stokReturList = [];
    sisaFisikSaatIni = {};

    saveJSON(SK_MASUK, stokMasukList);
    saveJSON(SK_KELUAR, stokKeluarList);
    saveJSON(SK_MASAK, stokMasakList);
    saveJSON(SK_RETUR, stokReturList);
    saveJSON(SK_SISA_FISIK, sisaFisikSaatIni);

    renderSemuaStock();
}

// ==============================
// ARSIP STOCK (viewer)
// ==============================
function bukaModalArsipStock() {
    bukaModalForm('Arsip Stock', buildArsipStockListHtml());
}

function buildArsipStockListHtml() {
    if (stockArchiveList.length === 0) {
        return '<p class="text-xs text-gray-400 text-center py-6">Belum ada arsip. Arsip kesimpen otomatis tiap kamu pencet "Reset Hari Ini" di halaman Kasir (kalau ada data stock periode itu).</p>';
    }
    const items = [...stockArchiveList].reverse();
    return items.map((entry, idx) => {
        const realIndex = stockArchiveList.length - 1 - idx;
        return `
            <button onclick="tampilkanDetailArsipStock(${realIndex})" class="w-full flex justify-between items-center py-3 border-b border-gray-50 text-left active:bg-gray-50 rounded-lg px-2">
                <div>
                    <p class="font-bold text-sm text-gray-800">${entry.tanggal}</p>
                    <p class="text-[11px] text-gray-400">${entry.bahanBaku.length} bahan baku</p>
                </div>
                <span class="font-bold text-sm text-red-600">Rp ${entry.totalPengeluaran.toLocaleString('id-ID')}</span>
            </button>
        `;
    }).join('');
}

function tampilkanDetailArsipStock(index) {
    const entry = stockArchiveList[index];
    if (!entry) return;

    const bahanHtml = entry.bahanBaku.map(b => `
        <div class="border-b border-gray-50 py-2">
            <p class="text-sm font-bold text-gray-700">${b.nama} <span class="text-gray-400 font-normal text-xs">(${b.satuan})</span></p>
            <p class="text-[11px] text-gray-400">Masuk ${b.totalMasuk} &middot; Retur ${b.totalRetur} &middot; Keluar ${b.totalKeluar} &middot; Dimasak ${b.totalDimasak}</p>
            <p class="text-[11px] text-gray-500">Sisa Gudang: <span class="font-bold">${b.stokAkhirGudang}</span> &middot; Sisa Lapangan: <span class="font-bold">${b.stokAkhirLapangan}</span> &middot; Pengeluaran: <span class="font-bold text-red-600">Rp ${b.pengeluaran.toLocaleString('id-ID')}</span></p>
        </div>
    `).join('');

    const rekonHtml = entry.rekonsiliasi.length ? `
        <table class="w-full text-xs mt-2">
            <thead><tr class="bg-gray-50 text-gray-500 text-left"><th class="p-1.5">Produk</th><th class="p-1.5 text-right">Masak</th><th class="p-1.5 text-right">Terjual</th><th class="p-1.5 text-right">Harusnya</th><th class="p-1.5 text-right">Fisik</th><th class="p-1.5 text-right">Selisih</th></tr></thead>
            <tbody>
                ${entry.rekonsiliasi.map(r => {
                    const warna = r.selisih === null ? 'text-gray-300' : (r.selisih === 0 ? 'text-green-600' : (r.selisih < 0 ? 'text-red-500' : 'text-blue-600'));
                    const teks = r.selisih === null ? '-' : (r.selisih > 0 ? `+${r.selisih}` : `${r.selisih}`);
                    return `<tr class="border-t border-gray-50"><td class="p-1.5">${r.jenis}</td><td class="p-1.5 text-right">${r.masak}</td><td class="p-1.5 text-right">${r.terjual}</td><td class="p-1.5 text-right">${r.harusnya}</td><td class="p-1.5 text-right">${r.fisik === null ? '-' : r.fisik}</td><td class="p-1.5 text-right font-bold ${warna}">${teks}</td></tr>`;
                }).join('')}
            </tbody>
        </table>
    ` : '<p class="text-[11px] text-gray-400 mt-2">Gak ada data rekonsiliasi.</p>';

    document.getElementById('modalFormBody').innerHTML = `
        <button onclick="bukaModalArsipStock()" class="text-xs font-bold text-gray-400 mb-3">← Kembali ke daftar arsip</button>
        <div class="flex justify-between items-center mb-3">
            <p class="font-bold text-gray-800">${entry.tanggal}</p>
            <p class="font-bold text-red-600">Rp ${entry.totalPengeluaran.toLocaleString('id-ID')}</p>
        </div>
        <p class="text-[11px] font-black text-red-600 uppercase tracking-wide mb-1">Bahan Baku</p>
        ${bahanHtml}
        <p class="text-[11px] font-black text-red-600 uppercase tracking-wide mt-3 mb-1">Rekonsiliasi</p>
        ${rekonHtml}
    `;
}

// ==============================
// AKSI: MAPPING PRODUK (menu kasir -> jenis produk, bisa lebih dari 1 baris)
// ==============================
function tambahMappingRow(menuItemId) {
    if (!produkMapping[menuItemId]) produkMapping[menuItemId] = [];
    produkMapping[menuItemId].push({ jenisProduk: '', jumlahPerPorsi: 1 });
    saveJSON(SK_MAPPING, produkMapping);
    refreshModalMapping();
}

function hapusMappingRow(menuItemId, index) {
    produkMapping[menuItemId].splice(index, 1);
    if (produkMapping[menuItemId].length === 0) delete produkMapping[menuItemId];
    saveJSON(SK_MAPPING, produkMapping);
    refreshModalMapping();
    renderRekonsiliasi();
}

function updateMappingRowJenis(menuItemId, index, jenisProduk) {
    produkMapping[menuItemId][index].jenisProduk = jenisProduk;
    saveJSON(SK_MAPPING, produkMapping);
    renderRekonsiliasi();
}

function updateMappingRowJumlah(menuItemId, index, jumlah) {
    produkMapping[menuItemId][index].jumlahPerPorsi = Number(jumlah) || 1;
    saveJSON(SK_MAPPING, produkMapping);
    renderRekonsiliasi();
}

// ==============================
// AKSI: SISA FISIK
// ==============================
function ubahSisaFisik(jenis, jumlah) {
    simpanSisaFisik(jenis, jumlah === '' ? '' : Number(jumlah));
    renderRekonsiliasi();
}

// ==============================
// LAPORAN STOCK KE WHATSAPP (Masuk, Retur & Keluar periode berjalan)
// ==============================
function copyLaporanStockToWA() {
    const tanggalEl = document.getElementById('tanggalHariIni');
    const tanggalDisplay = tanggalEl ? tanggalEl.innerText : todayKey();

    if (stokMasukList.length === 0 && stokKeluarList.length === 0 && stokReturList.length === 0 && stokMasakList.length === 0) {
        alert('Belum ada transaksi stok periode ini.');
        return;
    }

    let text = `*LAPORAN STOK AYAM BOBBY*\nTanggal: ${tanggalDisplay}\n`;
    let totalPengeluaran = 0;

    const labelMap = { masuk: 'Masuk', keluar: 'Keluar', masak: 'Masak', retur: 'Retur' };
    const tandaMap = { masuk: '+', keluar: '-', masak: '-', retur: '+' };

    bahanBakuList.forEach(b => {
        const riwayat = hitungRiwayatBahanDenganSaldo(b.id).slice().reverse(); // urut lama -> baru buat laporan
        if (riwayat.length === 0) return;

        text += `\n*${b.nama.toUpperCase()}* (${b.satuan})\n`;

        riwayat.forEach(x => {
            let baris = `- ${labelMap[x.tipe]} ${tandaMap[x.tipe]}${x.jumlah}`;

            if (x.tipe === 'masuk') {
                const subtotal = x.jumlah * (x.harga || 0);
                totalPengeluaran += subtotal;
                baris += x.harga ? ` (Rp${subtotal.toLocaleString('id-ID')})` : ' (harga belum diisi)';
            }

            baris += ` → Gudang: ${x.gudangSetelah}, Lapangan: ${x.lapanganSetelah}`;
            if (x.catatan) baris += ` — ${x.catatan}`;

            text += baris + '\n';
        });
    });

    text += `\n------------------\n`;
    text += `*TOTAL PENGELUARAN: Rp ${totalPengeluaran.toLocaleString('id-ID')}*`;

    navigator.clipboard.writeText(text).then(() => {
        alert('Mantap! Laporan stock udah disalin, tinggal paste ke WA.');
    }).catch(err => {
        console.error('Gagal copy text: ', err);
        alert('Gagal menyalin otomatis. Silakan coba lagi.');
    });
}

// ==============================
// MODAL FORM GENERIK
// ==============================
function bukaModalForm(title, bodyHtml) {
    document.getElementById('modalFormTitle').innerText = title;
    document.getElementById('modalFormBody').innerHTML = bodyHtml;
    document.getElementById('modalForm').classList.remove('hidden');
}

function tutupModalForm() {
    document.getElementById('modalForm').classList.add('hidden');
}

// --- Form: Tambah / Edit Bahan Baku ---
function bukaModalTambahBahan() {
    editingBahanBakuId = null;
    tempNamaBahan = '';
    tempSatuanBahan = '';
    tempResep = [];
    renderFormBahanBaku();
}

function bukaModalEditBahan(bahanBakuId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    editingBahanBakuId = bahanBakuId;
    tempNamaBahan = bahan.nama;
    tempSatuanBahan = bahan.satuan;
    tempResep = (bahan.resepKonversi || []).map(r => ({ ...r })); // salinan, biar gak ubah data asli sebelum disimpan
    renderFormBahanBaku();
}

function renderFormBahanBaku() {
    const resepRowsHtml = tempResep.map((r, i) => `
        <div class="flex gap-2 mb-2 items-center">
            <input type="text" value="${r.jenisProduk}" onchange="tempResep[${i}].jenisProduk=this.value" placeholder="Nama potongan (mis: Dada)" class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
            <input type="number" min="0" value="${r.jumlahPerUnit}" onchange="tempResep[${i}].jumlahPerUnit=Number(this.value)" placeholder="Jml" class="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
            <button onclick="tempResep.splice(${i},1); renderFormBahanBaku();" class="text-red-500 font-bold px-2">✕</button>
        </div>
    `).join('');

    const html = `
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Nama Bahan Baku</label>
            <input id="inputNamaBahan" type="text" value="${tempNamaBahan}" oninput="tempNamaBahan=this.value" placeholder="Contoh: Ayam" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Satuan</label>
            <input id="inputSatuanBahan" type="text" value="${tempSatuanBahan}" oninput="tempSatuanBahan=this.value" placeholder="Contoh: ekor / kg / liter" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500 block mb-1">Konversi Hasil Olahan (opsional)</label>
            <p class="text-[11px] text-gray-400 mb-2">Isi kalau bahan ini diproses/dimasak jadi beberapa jenis potongan. Kosongkan kalau bahan langsung dipakai apa adanya (misal minyak, bumbu).</p>
            <div id="resepRows">${resepRowsHtml}</div>
            <button onclick="tempResep.push({jenisProduk:'',jumlahPerUnit:1}); renderFormBahanBaku();" class="text-xs font-bold text-red-600 mt-1">+ Tambah Jenis Potongan</button>
        </div>
        ${editingBahanBakuId ? '<p class="text-[11px] text-orange-500 mb-2">Catatan: kalau kamu ubah/hapus nama jenis potongan di sini, riwayat stok masak yang udah kepakai nama lama TETAP pakai nama lama (gak ikut berubah).</p>' : ''}
        <button onclick="submitFormBahanBaku()" class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2">${editingBahanBakuId ? 'Simpan Perubahan' : 'Simpan Bahan Baku'}</button>
    `;
    bukaModalForm(editingBahanBakuId ? 'Edit Bahan Baku' : 'Tambah Bahan Baku', html);
}

function submitFormBahanBaku() {
    const nama = tempNamaBahan.trim();
    const satuan = tempSatuanBahan.trim();
    if (!nama || !satuan) { alert('Nama dan satuan wajib diisi.'); return; }

    const resepValid = tempResep.filter(r => r.jenisProduk && r.jenisProduk.trim() !== '' && r.jumlahPerUnit > 0);

    if (editingBahanBakuId) {
        const bahan = bahanBakuList.find(b => b.id === editingBahanBakuId);
        if (bahan) {
            bahan.nama = nama;
            bahan.satuan = satuan;
            bahan.resepKonversi = resepValid;
            saveJSON(SK_BAHAN, bahanBakuList);
        }
        editingBahanBakuId = null;
        renderSemuaStock();
    } else {
        tambahBahanBaku(nama, satuan, resepValid);
    }

    tutupModalForm();
}

// --- Form: Stok Masuk ---
function bukaModalStokMasuk(bahanBakuId, entryId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    let entry = null;
    if (entryId) {
        entry = stokMasukList.find(x => x.id === entryId);
        if (!entry) return;
    }

    const html = `
        <p class="text-sm font-bold text-gray-800 mb-3">${bahan.nama} <span class="text-gray-400 font-normal">(${bahan.satuan})</span></p>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Jumlah Masuk</label>
            <input id="inputJumlahMasuk" type="number" min="0" value="${entry ? entry.jumlah : ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Tanggal</label>
            <input id="inputTanggalMasuk" type="date" value="${entry ? entry.tanggal : todayKey()}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Harga (opsional, nanti diatur sendiri)</label>
            <input id="inputHargaMasuk" type="number" min="0" value="${entry && entry.harga ? entry.harga : ''}" placeholder="Belum wajib diisi" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Catatan (opsional)</label>
            <input id="inputCatatanMasuk" type="text" value="${entry && entry.catatan ? entry.catatan : ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <button onclick="submitStokMasuk('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})" class="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-2">${entry ? 'Simpan Perubahan' : 'Simpan Stok Masuk'}</button>
    `;
    bukaModalForm(entry ? 'Edit Stok Masuk' : 'Catat Stok Masuk', html);
}

// --- Form: Stok Keluar ---
function bukaModalStokKeluar(bahanBakuId, entryId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    let entry = null;
    if (entryId) {
        entry = stokKeluarList.find(x => x.id === entryId);
        if (!entry) return;
    }

    const tersediaDasar = hitungStokUtama(bahanBakuId) + (entry ? entry.jumlah : 0);

    const html = `
        <p class="text-sm font-bold text-gray-800 mb-1">${bahan.nama} <span class="text-gray-400 font-normal">(${bahan.satuan})</span></p>
        <p class="text-[11px] text-gray-400 mb-3">Stok gudang tersedia: <span class="font-bold text-gray-700">${tersediaDasar} ${bahan.satuan}</span></p>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Jumlah Keluar</label>
            <input id="inputJumlahKeluar" type="number" min="0" max="${tersediaDasar}" value="${entry ? entry.jumlah : ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Tanggal</label>
            <input id="inputTanggalKeluar" type="date" value="${entry ? entry.tanggal : todayKey()}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Catatan (opsional)</label>
            <input id="inputCatatanKeluar" type="text" value="${entry && entry.catatan ? entry.catatan : ''}" placeholder="Contoh: dibawa ke gerobak/lapangan" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <button onclick="submitStokKeluar('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})" class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-2">${entry ? 'Simpan Perubahan' : 'Simpan Stok Keluar'}</button>
    `;
    bukaModalForm(entry ? 'Edit Stok Keluar' : 'Catat Stok Keluar', html);
}

// --- Form: Masak ---
function bukaModalMasak(bahanBakuId, entryId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;

    let entry = null;
    if (entryId) {
        entry = stokMasakList.find(x => x.id === entryId);
        if (!entry) return;
    }

    const tersediaDasar = hitungStokLapanganMentah(bahanBakuId) + (entry ? entry.jumlahDiproses : 0);
    const resepHtml = (bahan.resepKonversi || []).map(r => `<p class="text-[11px] text-gray-500">${r.jumlahPerUnit} ${r.jenisProduk} / ${bahan.satuan}</p>`).join('');

    const html = `
        <p class="text-sm font-bold text-gray-800 mb-1">${bahan.nama}</p>
        <p class="text-[11px] text-gray-400 mb-2">Stok lapangan (belum diolah): <span class="font-bold text-gray-700">${tersediaDasar} ${bahan.satuan}</span></p>
        <div class="bg-gray-50 rounded-lg p-2 mb-3">
            <p class="text-[11px] font-bold text-gray-500 mb-1">Konversi per ${bahan.satuan}:</p>
            ${resepHtml}
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Jumlah Diproses (${bahan.satuan})</label>
            <input id="inputJumlahMasak" type="number" min="0" max="${tersediaDasar}" value="${entry ? entry.jumlahDiproses : ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <div class="mb-3">
            <label class="text-xs font-bold text-gray-500">Tanggal</label>
            <input id="inputTanggalMasak" type="date" value="${entry ? entry.tanggal : todayKey()}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
        </div>
        <button onclick="submitMasak('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})" class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2">${entry ? 'Simpan Perubahan' : 'Proses & Simpan'}</button>
    `;
    bukaModalForm(entry ? 'Edit Proses Masak' : 'Proses Masak', html);
}

// --- Form: Mapping Produk ---
function bukaModalMapping() {
    const jenisOptions = getJenisProdukList();

    if (jenisOptions.length === 0) {
        bukaModalForm('Mapping Produk', `<p class="text-xs text-gray-400 text-center py-6">Belum ada jenis produk. Tambahkan bahan baku dengan konversi hasil olahan dulu di halaman Stock.</p>`);
        return;
    }

    if (typeof menuData === 'undefined' || !menuData.length) {
        bukaModalForm('Mapping Produk', `<p class="text-xs text-gray-400 text-center py-6">Data menu kasir belum ketemu.</p>`);
        return;
    }

    bukaModalForm('Mapping Produk ke Kasir', buildMappingHtml(jenisOptions));
}

function refreshModalMapping() {
    const jenisOptions = getJenisProdukList();
    const body = document.getElementById('modalFormBody');
    if (body) body.innerHTML = buildMappingHtml(jenisOptions);
}

function buildMappingHtml(jenisOptions) {
    const rows = menuData.map(item => {
        const mappingRows = produkMapping[item.id] || [];
        const rowsHtml = mappingRows.map((row, idx) => {
            const options = ['<option value="">- pilih jenis -</option>']
                .concat(jenisOptions.map(j => `<option value="${j}" ${row.jenisProduk === j ? 'selected' : ''}>${j}</option>`))
                .join('');
            return `
                <div class="flex gap-2 mb-1.5 items-center">
                    <select onchange="updateMappingRowJenis('${item.id}', ${idx}, this.value)" class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs">${options}</select>
                    <input type="number" min="1" value="${row.jumlahPerPorsi}" onchange="updateMappingRowJumlah('${item.id}', ${idx}, this.value)" class="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" placeholder="Qty">
                    <button onclick="hapusMappingRow('${item.id}', ${idx})" class="text-red-500 font-bold px-1">✕</button>
                </div>
            `;
        }).join('');

        return `
            <div class="border-b border-gray-50 py-2">
                <p class="text-sm font-semibold text-gray-700 mb-1">${item.name}</p>
                ${rowsHtml || '<p class="text-[11px] text-gray-300 mb-1">Belum dipetakan</p>'}
                <button onclick="tambahMappingRow('${item.id}')" class="text-[11px] font-bold text-red-600">+ Tambah potongan</button>
            </div>
        `;
    }).join('');

    return `<p class="text-[11px] text-gray-400 mb-3">Tentuin tiap menu di kasir itu jual jenis potongan apa dan berapa pcs per porsi. Untuk menu yang gak konsumsi potongan (nasi, sambal, keju), biarin kosong aja. Untuk menu "Ayam Utuh", tambahkan beberapa baris sekaligus (misal Dada x4, Sayap x2, Paha Atas x2, Paha Bawah x2).</p>${rows}`;
}

// ==============================
// RIWAYAT TRANSAKSI PER BAHAN BAKU (hapus satu-satu buat koreksi human error)
// ==============================
function hitungRiwayatBahanDenganSaldo(bahanBakuId) {
    const masuk = stokMasukList.filter(x => x.bahanBakuId === bahanBakuId).map(x => ({ ...x, tipe: 'masuk' }));
    const keluar = stokKeluarList.filter(x => x.bahanBakuId === bahanBakuId).map(x => ({ ...x, tipe: 'keluar' }));
    const masak = stokMasakList.filter(x => x.bahanBakuId === bahanBakuId).map(x => ({ ...x, tipe: 'masak', jumlah: x.jumlahDiproses }));
    const retur = stokReturList.filter(x => x.bahanBakuId === bahanBakuId).map(x => ({ ...x, tipe: 'retur' }));

    // Urutkan dari yang paling lama ke paling baru buat ngitung saldo berjalan
    const kronologis = [...masuk, ...keluar, ...masak, ...retur].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let gudang = 0, lapangan = 0;
    kronologis.forEach(x => {
        if (x.tipe === 'masuk') { gudang += x.jumlah; }
        else if (x.tipe === 'retur') { gudang += x.jumlah; lapangan -= x.jumlah; }
        else if (x.tipe === 'keluar') { gudang -= x.jumlah; lapangan += x.jumlah; }
        else if (x.tipe === 'masak') { lapangan -= x.jumlah; }
        x.gudangSetelah = gudang;
        x.lapanganSetelah = lapangan;
    });

    return kronologis.slice().reverse(); // terbaru di atas buat ditampilin
}

function bukaModalRiwayatBahan(bahanBakuId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return;
    bukaModalForm(`Riwayat ${bahan.nama}`, buildRiwayatBahanHtml(bahanBakuId));
}

function refreshModalRiwayatBahan(bahanBakuId) {
    const body = document.getElementById('modalFormBody');
    if (body) body.innerHTML = buildRiwayatBahanHtml(bahanBakuId);
}

function buildRiwayatBahanHtml(bahanBakuId) {
    const bahan = bahanBakuList.find(b => b.id === bahanBakuId);
    if (!bahan) return '<p class="text-xs text-gray-400 text-center py-6">Bahan baku tidak ditemukan.</p>';

    const semua = hitungRiwayatBahanDenganSaldo(bahanBakuId);

    if (semua.length === 0) {
        return '<p class="text-xs text-gray-400 text-center py-6">Belum ada transaksi buat bahan ini.</p>';
    }

    const labelMap = { masuk: 'Masuk', keluar: 'Keluar', masak: 'Masak', retur: 'Retur' };
    const warnaMap = { masuk: 'text-green-600', keluar: 'text-orange-500', masak: 'text-red-600', retur: 'text-blue-600' };
    const tandaMap = { masuk: '+', keluar: '-', masak: '-', retur: '+' };
    const editFnMap = { masuk: 'bukaModalStokMasuk', keluar: 'bukaModalStokKeluar', masak: 'bukaModalMasak', retur: 'bukaModalRetur' };

    return semua.map(x => {
        const hargaInfo = (x.tipe === 'masuk') ? (x.harga ? ` &middot; @Rp${x.harga.toLocaleString('id-ID')}` : ' &middot; <span class="text-orange-400">harga belum diisi</span>') : '';
        return `
        <div class="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
            <div>
                <p class="font-semibold text-gray-700">${labelMap[x.tipe]} <span class="${warnaMap[x.tipe]} font-bold">${tandaMap[x.tipe]}${x.jumlah} ${bahan.satuan}</span></p>
                <p class="text-[11px] text-gray-400">${x.tanggal}${x.catatan ? ' &middot; ' + x.catatan : ''}${hargaInfo}</p>
                <p class="text-[11px] text-gray-400">→ Gudang: <span class="font-semibold text-gray-600">${x.gudangSetelah}</span> &middot; Lapangan: <span class="font-semibold text-gray-600">${x.lapanganSetelah}</span></p>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
                <button onclick="${editFnMap[x.tipe]}('${bahanBakuId}', '${x.id}')" class="text-blue-500 font-bold text-xs px-2">Edit</button>
                <button onclick="hapusTransaksiBahan('${bahanBakuId}', '${x.tipe}', '${x.id}')" class="text-red-500 font-bold text-xs px-2">Hapus</button>
            </div>
        </div>
    `;
    }).join('');
}

function hapusTransaksiBahan(bahanBakuId, tipe, id) {
    if (!confirm('Hapus transaksi ini?')) return;

    if (tipe === 'masuk') {
        stokMasukList = stokMasukList.filter(x => x.id !== id);
        saveJSON(SK_MASUK, stokMasukList);
    } else if (tipe === 'keluar') {
        stokKeluarList = stokKeluarList.filter(x => x.id !== id);
        saveJSON(SK_KELUAR, stokKeluarList);
    } else if (tipe === 'masak') {
        stokMasakList = stokMasakList.filter(x => x.id !== id);
        saveJSON(SK_MASAK, stokMasakList);
    } else if (tipe === 'retur') {
        stokReturList = stokReturList.filter(x => x.id !== id);
        saveJSON(SK_RETUR, stokReturList);
    }

    refreshModalRiwayatBahan(bahanBakuId);
    renderSemuaStock();
}

// ==============================
// RENDER
// ==============================
function renderBahanBakuList() {
    const container = document.getElementById('listBahanBaku');
    if (!container) return;

    if (bahanBakuList.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Belum ada bahan baku. Tambahkan dulu lewat tombol + Bahan Baku.</p>';
        return;
    }

    container.innerHTML = bahanBakuList.map(b => {
        const stokUtama = hitungStokUtama(b.id);
        const stokLapangan = hitungStokLapanganMentah(b.id);
        const bisaMasak = b.resepKonversi && b.resepKonversi.length > 0;

        return `
            <div class="bg-white rounded-xl border border-gray-100 p-3">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-bold text-sm text-gray-800">${b.nama}</p>
                        <p class="text-[11px] text-gray-400">Stok Gudang: <span class="font-bold text-gray-700">${stokUtama} ${b.satuan}</span> &middot; Stok Lapangan: <span class="font-bold text-gray-700">${stokLapangan} ${b.satuan}</span></p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="bukaModalEditBahan('${b.id}')" title="Edit bahan baku" class="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 text-xs">✏️</button>
                        <button onclick="bukaModalRiwayatBahan('${b.id}')" title="Riwayat transaksi" class="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 text-xs">📜</button>
                        <button onclick="hapusBahanBaku('${b.id}')" title="Hapus bahan baku" class="w-7 h-7 flex items-center justify-center bg-red-50 rounded-full text-red-500 text-xs">🗑</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <button onclick="bukaModalStokMasuk('${b.id}')" class="text-[11px] font-bold py-1.5 rounded-full bg-green-50 text-green-700">+ Masuk</button>
                    <button onclick="bukaModalStokKeluar('${b.id}')" class="text-[11px] font-bold py-1.5 rounded-full bg-orange-50 text-orange-700">- Keluar</button>
                </div>
                <div class="grid ${bisaMasak ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
                    ${bisaMasak ? `<button onclick="bukaModalMasak('${b.id}')" class="text-[11px] font-bold py-1.5 rounded-full bg-red-50 text-red-700">Masak</button>` : ''}
                    <button onclick="bukaModalRetur('${b.id}')" class="text-[11px] font-bold py-1.5 rounded-full bg-blue-50 text-blue-700">↩ Retur</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderRekonsiliasi() {
    const tbody = document.getElementById('tabelRekonsiliasi');
    if (!tbody) return;

    const jenisList = getJenisProdukList();
    if (jenisList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 text-xs">Belum ada jenis produk. Tambah bahan baku dengan konversi hasil olahan dulu.</td></tr>`;
        return;
    }

    let totalMasak = 0, totalTerjual = 0, totalHarusnya = 0, totalFisik = 0, totalSelisih = 0;

    const rows = jenisList.map(jenis => {
        const masak = getStokMasakSaatIni(jenis);
        const terjual = getPenjualanTercatat(jenis);
        const harusnya = masak - terjual;
        const fisikVal = getSisaFisik(jenis);
        const fisik = fisikVal === '' ? null : Number(fisikVal);
        const selisih = fisik === null ? null : (fisik - harusnya);

        totalMasak += masak;
        totalTerjual += terjual;
        totalHarusnya += harusnya;
        if (fisik !== null) { totalFisik += fisik; totalSelisih += selisih; }

        const warna = selisih === null ? 'text-gray-300' : (selisih === 0 ? 'text-green-600' : (selisih < 0 ? 'text-red-500' : 'text-blue-600'));
        const teks = selisih === null ? '-' : (selisih > 0 ? `+${selisih}` : `${selisih}`);

        return `
            <tr class="border-t border-gray-50">
                <td class="p-2 font-semibold text-gray-700">${jenis}</td>
                <td class="p-2 text-right">${masak}</td>
                <td class="p-2 text-right">${terjual}</td>
                <td class="p-2 text-right">${harusnya}</td>
                <td class="p-2 text-right">
                    <input type="number" value="${fisikVal}" onchange="ubahSisaFisik('${jenis}', this.value)" class="w-14 border border-gray-200 rounded px-1 py-0.5 text-right text-xs">
                </td>
                <td class="p-2 text-right font-bold ${warna}">${teks}</td>
            </tr>
        `;
    }).join('');

    const totalTeks = totalSelisih > 0 ? `+${totalSelisih}` : `${totalSelisih}`;
    const totalWarna = totalSelisih === 0 ? 'text-green-600' : (totalSelisih < 0 ? 'text-red-500' : 'text-blue-600');

    const rowTotal = `
        <tr class="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <td class="p-2">Total</td>
            <td class="p-2 text-right">${totalMasak}</td>
            <td class="p-2 text-right">${totalTerjual}</td>
            <td class="p-2 text-right">${totalHarusnya}</td>
            <td class="p-2 text-right">${totalFisik}</td>
            <td class="p-2 text-right ${totalWarna}">${totalTeks}</td>
        </tr>
    `;

    tbody.innerHTML = rows + rowTotal;
}

function renderTotalPengeluaran() {
    const el = document.getElementById('totalPengeluaranStock');
    if (!el) return;
    el.innerText = 'Rp ' + hitungPengeluaranSaatIni().toLocaleString('id-ID');
}

function renderSemuaStock() {
    renderBahanBakuList();
    renderRekonsiliasi();
    renderTotalPengeluaran();
}