// ==============================================================
// STOCK.JS - MONITORING & REKONSILIASI STOK AYAM BOBBY
// ==============================================================
//
// ALUR:
//
// GUDANG:
// Stok Masuk + Retur - Stok Keluar = Stok Gudang
//
// LAPANGAN:
// Stok Keluar - Retur - Masak = Stok Lapangan Mentah
//
// PRODUK SIAP JUAL:
// Stok Masak - Terjual = Harusnya Sisa
//
// REKONSILIASI:
// Fisik - Harusnya = Selisih
//
// RESET HARIAN:
// 1. Arsipkan seluruh data periode berjalan.
// 2. Bahan baku TIDAK dihapus.
// 3. Sisa gudang dibawa ke periode baru sebagai saldo awal.
// 4. Sisa lapangan dibawa ke periode baru sebagai saldo awal.
// 5. Sisa fisik produk dibawa sebagai stok masak awal.
// 6. Transaksi periode lama dikosongkan.
//
// ==============================================================


// ============================================================
// STORAGE KEY
// ============================================================

const SK_BAHAN = 'bobby_bahan_baku';
const SK_MASUK = 'bobby_stok_masuk';
const SK_KELUAR = 'bobby_stok_keluar';
const SK_MASAK = 'bobby_stok_masak';
const SK_RETUR = 'bobby_stok_retur';
const SK_MAPPING = 'bobby_produk_mapping';
const SK_SISA_FISIK = 'bobby_sisa_fisik';
const SK_STOCK_ARCHIVE = 'bobby_stock_archive';


// ============================================================
// HELPER LOCAL STORAGE
// ============================================================

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);

        if (raw === null || raw === undefined) {
            return fallback;
        }

        const parsed = JSON.parse(raw);

        return parsed === null || parsed === undefined
            ? fallback
            : parsed;

    } catch (error) {
        console.error(`Gagal membaca localStorage: ${key}`, error);
        return fallback;
    }
}


function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Gagal menyimpan localStorage: ${key}`, error);
    }
}


// ============================================================
// DATA UTAMA
// ============================================================

// Bahan baku = MASTER PERMANEN
let bahanBakuList = loadJSON(SK_BAHAN, []);

// Transaksi periode berjalan
let stokMasukList = loadJSON(SK_MASUK, []);
let stokKeluarList = loadJSON(SK_KELUAR, []);
let stokMasakList = loadJSON(SK_MASAK, []);
let stokReturList = loadJSON(SK_RETUR, []);

// Mapping menu kasir -> jenis produk
let produkMapping = loadJSON(SK_MAPPING, {});

// Sisa fisik produk siap jual
let sisaFisikSaatIni = loadJSON(SK_SISA_FISIK, {});

// Arsip semua periode
let stockArchiveList = loadJSON(SK_STOCK_ARCHIVE, []);


// ============================================================
// NORMALISASI DATA LAMA
// ============================================================

// Mapping lama mungkin berbentuk:
//
// {
//     menuId: {
//         jenisProduk: "Dada",
//         jumlahPerPorsi: 1
//     }
// }
//
// Diubah menjadi:
//
// {
//     menuId: [
//         {
//             jenisProduk: "Dada",
//             jumlahPerPorsi: 1
//         }
//     ]
// }

Object.keys(produkMapping).forEach(menuId => {

    if (
        produkMapping[menuId] &&
        !Array.isArray(produkMapping[menuId])
    ) {
        produkMapping[menuId] = [
            produkMapping[menuId]
        ];
    }

});

saveJSON(SK_MAPPING, produkMapping);


// ============================================================
// TEMP FORM
// ============================================================

let tempResep = [];

let tempNamaBahan = '';

let tempSatuanBahan = '';

let editingBahanBakuId = null;


// ============================================================
// TANGGAL
// ============================================================

function todayKey() {

    const d = new Date();

    const y = d.getFullYear();

    const m = String(
        d.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
        d.getDate()
    ).padStart(2, '0');

    return `${y}-${m}-${day}`;
}


// ============================================================
// ANGKA AMAN
// ============================================================

function angka(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
}


// ============================================================
// ID UNIK
// ============================================================

function generateId(prefix) {

    return (
        prefix +
        '_' +
        Date.now() +
        '_' +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );
}


// ============================================================
// FORMAT RUPIAH
// ============================================================

function formatRupiah(value) {

    return Number(value || 0)
        .toLocaleString('id-ID');
}


// ============================================================
// PERHITUNGAN STOK GUDANG
// ============================================================

function hitungStokUtama(bahanBakuId) {

    const masuk =
        stokMasukList
            .filter(x =>
                x.bahanBakuId === bahanBakuId
            )
            .reduce(
                (sum, x) =>
                    sum + angka(x.jumlah),
                0
            );

    const retur =
        stokReturList
            .filter(x =>
                x.bahanBakuId === bahanBakuId
            )
            .reduce(
                (sum, x) =>
                    sum + angka(x.jumlah),
                0
            );

    const keluar =
        stokKeluarList
            .filter(x =>
                x.bahanBakuId === bahanBakuId
            )
            .reduce(
                (sum, x) =>
                    sum + angka(x.jumlah),
                0
            );

    return masuk + retur - keluar;
}


// ============================================================
// PERHITUNGAN STOK LAPANGAN MENTAH
// ============================================================

function hitungStokLapanganMentah(bahanBakuId) {

    const keluar =
        stokKeluarList
            .filter(x =>
                x.bahanBakuId === bahanBakuId
            )
            .reduce(
                (sum, x) =>
                    sum + angka(x.jumlah),
                0
            );

    const retur =
        stokReturList
            .filter(x =>
                x.bahanBakuId === bahanBakuId
            )
            .reduce(
                (sum, x) =>
                    sum + angka(x.jumlah),
                0
            );

    const dimasak =
        stokMasakList
            .filter(x =>
                x.bahanBakuId === bahanBakuId &&
                x.saldoAwal !== true
            )
            .reduce(
                (sum, x) =>
                    sum + angka(x.jumlahDiproses),
                0
            );

    return keluar - retur - dimasak;
}


// ============================================================
// DAFTAR JENIS PRODUK
// ============================================================

function getJenisProdukList() {

    const set = new Set();

    bahanBakuList.forEach(bahan => {

        (bahan.resepKonversi || [])
            .forEach(resep => {

                const jenis =
                    String(
                        resep.jenisProduk || ''
                    ).trim();

                if (jenis) {
                    set.add(jenis);
                }

            });

    });

    // Tambahkan jenis produk yang masih tersimpan
    // dari saldo fisik supaya tidak hilang setelah reset.

    Object.keys(sisaFisikSaatIni || {})
        .forEach(jenis => {

            if (
                jenis &&
                Number(sisaFisikSaatIni[jenis]) >= 0
            ) {
                set.add(jenis);
            }

        });

    // Tambahkan jenis dari stok masak
    stokMasakList.forEach(masak => {

        (masak.hasil || [])
            .forEach(hasil => {

                const jenis =
                    String(
                        hasil.jenisProduk || ''
                    ).trim();

                if (jenis) {
                    set.add(jenis);
                }

            });

    });

    return Array.from(set);
}


// ============================================================
// TOTAL HASIL MASAK
// ============================================================

function getStokMasakSaatIni(jenisProduk) {

    let total = 0;

    stokMasakList.forEach(masak => {

        (masak.hasil || [])
            .forEach(hasil => {

                if (
                    hasil.jenisProduk === jenisProduk
                ) {
                    total += angka(hasil.jumlah);
                }

            });

    });

    return total;
}


// ============================================================
// PENJUALAN DARI KASIR
// ============================================================

function getPenjualanTercatat(jenisProduk) {

    let total = 0;

    if (
        typeof state === 'undefined' ||
        !state ||
        !state.items
    ) {
        return 0;
    }

    Object.keys(state.items)
        .forEach(menuId => {

            const jumlahTerjual =
                angka(state.items[menuId]);

            if (jumlahTerjual <= 0) {
                return;
            }

            const mappings =
                produkMapping[menuId] || [];

            mappings.forEach(mapping => {

                if (
                    mapping.jenisProduk === jenisProduk
                ) {

                    const perPorsi =
                        angka(
                            mapping.jumlahPerPorsi
                        ) || 1;

                    total +=
                        jumlahTerjual *
                        perPorsi;
                }

            });

        });

    return total;
}


// ============================================================
// SISA FISIK
// ============================================================

function getSisaFisik(jenisProduk) {

    if (
        !sisaFisikSaatIni ||
        !Object.prototype.hasOwnProperty.call(
            sisaFisikSaatIni,
            jenisProduk
        )
    ) {
        return '';
    }

    return sisaFisikSaatIni[jenisProduk];
}


function simpanSisaFisik(
    jenisProduk,
    jumlah
) {

    if (!jenisProduk) {
        return;
    }

    sisaFisikSaatIni[jenisProduk] =
        jumlah;

    saveJSON(
        SK_SISA_FISIK,
        sisaFisikSaatIni
    );
}


// ============================================================
// TOTAL PENGELUARAN
// ============================================================

function hitungPengeluaranSaatIni() {

    return stokMasukList.reduce(
        (sum, entry) => {

            const jumlah =
                angka(entry.jumlah);

            const harga =
                angka(entry.harga);

            return sum + (
                jumlah * harga
            );

        },
        0
    );
}


// ============================================================
// AKSI BAHAN BAKU
// ============================================================

function tambahBahanBaku(
    nama,
    satuan,
    resepKonversiArr
) {

    const id =
        generateId('bb');

    bahanBakuList.push({

        id,

        nama: String(nama).trim(),

        satuan: String(satuan).trim(),

        resepKonversi:
            resepKonversiArr || []

    });

    saveJSON(
        SK_BAHAN,
        bahanBakuList
    );

    renderSemuaStock();
}


function hapusBahanBaku(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b => b.id === bahanBakuId
        );

    if (!bahan) {
        return;
    }

    const yakin =
        confirm(
            `Yakin mau hapus bahan baku "${bahan.nama}"?\n\n` +
            `Semua riwayat stok masuk, keluar, retur, dan masak ` +
            `yang terkait bahan ini juga akan ikut terhapus.\n\n` +
            `Tindakan ini gak bisa dibatalkan.`
        );

    if (!yakin) {
        return;
    }

    bahanBakuList =
        bahanBakuList.filter(
            b => b.id !== bahanBakuId
        );

    stokMasukList =
        stokMasukList.filter(
            x => x.bahanBakuId !== bahanBakuId
        );

    stokKeluarList =
        stokKeluarList.filter(
            x => x.bahanBakuId !== bahanBakuId
        );

    stokMasakList =
        stokMasakList.filter(
            x => x.bahanBakuId !== bahanBakuId
        );

    stokReturList =
        stokReturList.filter(
            x => x.bahanBakuId !== bahanBakuId
        );

    saveJSON(
        SK_BAHAN,
        bahanBakuList
    );

    saveJSON(
        SK_MASUK,
        stokMasukList
    );

    saveJSON(
        SK_KELUAR,
        stokKeluarList
    );

    saveJSON(
        SK_MASAK,
        stokMasakList
    );

    saveJSON(
        SK_RETUR,
        stokReturList
    );

    renderSemuaStock();
}


// ============================================================
// STOK MASUK
// ============================================================

function submitStokMasuk(
    bahanBakuId,
    entryId
) {

    const jumlah =
        angka(
            document.getElementById(
                'inputJumlahMasuk'
            ).value
        );

    const tanggal =
        document.getElementById(
            'inputTanggalMasuk'
        ).value ||
        todayKey();

    const harga =
        angka(
            document.getElementById(
                'inputHargaMasuk'
            ).value
        );

    const catatan =
        document.getElementById(
            'inputCatatanMasuk'
        ).value.trim();


    if (jumlah <= 0) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;
    }


    if (entryId) {

        const entry =
            stokMasukList.find(
                x => x.id === entryId
            );

        if (!entry) {
            return;
        }

        // Saldo awal tidak boleh diedit menjadi transaksi pembelian.
        if (entry.saldoAwal === true) {

            alert(
                'Saldo awal tidak boleh diedit sebagai stok masuk baru.'
            );

            return;
        }

        entry.jumlah = jumlah;
        entry.tanggal = tanggal;
        entry.harga = harga;
        entry.catatan = catatan;

        saveJSON(
            SK_MASUK,
            stokMasukList
        );

        renderSemuaStock();

        bukaModalRiwayatBahan(
            bahanBakuId
        );

        return;
    }


    stokMasukList.push({

        id: generateId('in'),

        bahanBakuId,

        jumlah,

        tanggal,

        harga,

        catatan,

        timestamp:
            new Date().toISOString(),

        saldoAwal: false

    });

    saveJSON(
        SK_MASUK,
        stokMasukList
    );

    renderSemuaStock();

    tutupModalForm();
}


// ============================================================
// STOK KELUAR
// ============================================================

function submitStokKeluar(
    bahanBakuId,
    entryId
) {

    const jumlah =
        angka(
            document.getElementById(
                'inputJumlahKeluar'
            ).value
        );

    const tanggal =
        document.getElementById(
            'inputTanggalKeluar'
        ).value ||
        todayKey();

    const catatan =
        document.getElementById(
            'inputCatatanKeluar'
        ).value.trim();


    let entry = null;

    if (entryId) {

        entry =
            stokKeluarList.find(
                x => x.id === entryId
            );
    }


    const tersediaDasar =
        hitungStokUtama(
            bahanBakuId
        ) +
        (
            entry
                ? angka(entry.jumlah)
                : 0
        );


    if (jumlah <= 0) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;
    }


    if (jumlah > tersediaDasar) {

        alert(
            `Stok gudang cuma tersedia ${tersediaDasar}. ` +
            `Gak bisa keluar lebih dari itu.`
        );

        return;
    }


    if (entryId && entry) {

        entry.jumlah = jumlah;
        entry.tanggal = tanggal;
        entry.catatan = catatan;

        saveJSON(
            SK_KELUAR,
            stokKeluarList
        );

        renderSemuaStock();

        bukaModalRiwayatBahan(
            bahanBakuId
        );

        return;
    }


    stokKeluarList.push({

        id: generateId('out'),

        bahanBakuId,

        jumlah,

        tanggal,

        catatan,

        timestamp:
            new Date().toISOString(),

        saldoAwal: false

    });

    saveJSON(
        SK_KELUAR,
        stokKeluarList
    );

    renderSemuaStock();

    tutupModalForm();
}


// ============================================================
// RETUR
// ============================================================

function bukaModalRetur(
    bahanBakuId,
    entryId
) {

    const bahan =
        bahanBakuList.find(
            b => b.id === bahanBakuId
        );

    if (!bahan) {
        return;
    }


    let entry = null;

    if (entryId) {

        entry =
            stokReturList.find(
                x => x.id === entryId
            );

        if (!entry) {
            return;
        }
    }


    const tersediaDasar =
        hitungStokLapanganMentah(
            bahanBakuId
        ) +
        (
            entry
                ? angka(entry.jumlah)
                : 0
        );


    const html = `

        <p class="text-sm font-bold text-gray-800 mb-1">
            ${bahan.nama}
            <span class="text-gray-400 font-normal">
                (${bahan.satuan})
            </span>
        </p>

        <p class="text-[11px] text-gray-400 mb-3">
            Barang yang balik dari lapangan ke gudang.
            Tidak dihitung sebagai pembelian baru.
        </p>

        <p class="text-[11px] text-gray-400 mb-3">
            Stok lapangan saat ini:
            <span class="font-bold text-gray-700">
                ${tersediaDasar} ${bahan.satuan}
            </span>
        </p>

        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Jumlah Kembali
            </label>

            <input
                id="inputJumlahRetur"
                type="number"
                min="0"
                max="${tersediaDasar}"
                value="${entry ? entry.jumlah : ''}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>

        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Tanggal
            </label>

            <input
                id="inputTanggalRetur"
                type="date"
                value="${entry ? entry.tanggal : todayKey()}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>

        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Catatan
            </label>

            <input
                id="inputCatatanRetur"
                type="text"
                value="${entry && entry.catatan ? entry.catatan : ''}"
                placeholder="Contoh: Ayam utuh gak jadi diambil customer"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>

        <button
            onclick="submitRetur('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})"
            class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            ${entry ? 'Simpan Perubahan' : 'Simpan Retur'}
        </button>
    `;


    bukaModalForm(
        entry
            ? 'Edit Retur'
            : 'Retur / Barang Kembali',
        html
    );
}


function submitRetur(
    bahanBakuId,
    entryId
) {

    const jumlah =
        angka(
            document.getElementById(
                'inputJumlahRetur'
            ).value
        );

    const tanggal =
        document.getElementById(
            'inputTanggalRetur'
        ).value ||
        todayKey();

    const catatan =
        document.getElementById(
            'inputCatatanRetur'
        ).value.trim();


    let entry = null;

    if (entryId) {

        entry =
            stokReturList.find(
                x => x.id === entryId
            );
    }


    const tersediaDasar =
        hitungStokLapanganMentah(
            bahanBakuId
        ) +
        (
            entry
                ? angka(entry.jumlah)
                : 0
        );


    if (jumlah <= 0) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;
    }


    if (jumlah > tersediaDasar) {

        alert(
            `Stok lapangan cuma tersedia ${tersediaDasar}.`
        );

        return;
    }


    if (entryId && entry) {

        entry.jumlah = jumlah;
        entry.tanggal = tanggal;
        entry.catatan = catatan;

        saveJSON(
            SK_RETUR,
            stokReturList
        );

        renderSemuaStock();

        bukaModalRiwayatBahan(
            bahanBakuId
        );

        return;
    }


    stokReturList.push({

        id: generateId('ret'),

        bahanBakuId,

        jumlah,

        tanggal,

        catatan,

        timestamp:
            new Date().toISOString()

    });

    saveJSON(
        SK_RETUR,
        stokReturList
    );

    renderSemuaStock();

    tutupModalForm();
}


// ============================================================
// STOK MASAK
// ============================================================

function submitMasak(
    bahanBakuId,
    entryId
) {

    const jumlah =
        angka(
            document.getElementById(
                'inputJumlahMasak'
            ).value
        );

    const tanggal =
        document.getElementById(
            'inputTanggalMasak'
        ).value ||
        todayKey();


    if (jumlah <= 0) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;
    }


    const bahan =
        bahanBakuList.find(
            b => b.id === bahanBakuId
        );

    if (!bahan) {
        return;
    }


    let entry = null;

    if (entryId) {

        entry =
            stokMasakList.find(
                x => x.id === entryId
            );

        if (!entry) {
            return;
        }

        if (entry.saldoAwal === true) {

            alert(
                'Saldo stok masak awal tidak boleh diedit sebagai proses masak.'
            );

            return;
        }
    }


    const tersediaDasar =
        hitungStokLapanganMentah(
            bahanBakuId
        ) +
        (
            entry
                ? angka(entry.jumlahDiproses)
                : 0
        );


    if (jumlah > tersediaDasar) {

        alert(
            `Stok lapangan ${bahan.nama} cuma tersedia ` +
            `${tersediaDasar} ${bahan.satuan}.`
        );

        return;
    }


    const hasil =
        (bahan.resepKonversi || [])
            .map(resep => ({

                jenisProduk:
                    resep.jenisProduk,

                jumlah:
                    angka(resep.jumlahPerUnit) *
                    jumlah

            }));


    if (entryId && entry) {

        entry.jumlahDiproses = jumlah;
        entry.tanggal = tanggal;
        entry.hasil = hasil;

        saveJSON(
            SK_MASAK,
            stokMasakList
        );

        renderSemuaStock();

        bukaModalRiwayatBahan(
            bahanBakuId
        );

        return;
    }


    stokMasakList.push({

        id: generateId('sm'),

        bahanBakuId,

        jumlahDiproses: jumlah,

        tanggal,

        timestamp:
            new Date().toISOString(),

        hasil,

        saldoAwal: false

    });


    saveJSON(
        SK_MASAK,
        stokMasakList
    );

    renderSemuaStock();

    tutupModalForm();
}


// ============================================================
// RESET STOCK HARIAN
// ============================================================
//
// PERBAIKAN UTAMA:
//
// Saldo Gudang dan Lapangan dibawa secara terpisah.
//
// Sebelumnya total sisa gudang + lapangan dimasukkan ke STOK MASUK,
// lalu sisa lapangan dimasukkan lagi ke STOK KELUAR.
//
// Sekarang tetap begitu secara matematis,
// tetapi diberi flag saldoAwal supaya:
// - tidak dianggap pembelian
// - tidak dianggap transaksi baru
// - lebih aman saat riwayat
// - lebih mudah dibedakan dari transaksi asli
//
// ============================================================

function resetStockHarian() {

    const adaData =
        stokMasukList.length > 0 ||
        stokKeluarList.length > 0 ||
        stokMasakList.length > 0 ||
        stokReturList.length > 0 ||
        Object.keys(sisaFisikSaatIni || {}).length > 0;


    if (!adaData) {
        return;
    }


    const tanggalEl =
        document.getElementById(
            'tanggalHariIni'
        );


    const tanggalDisplay =
        tanggalEl
            ? tanggalEl.innerText
            : new Date().toLocaleDateString(
                'id-ID'
            );


    // ========================================================
    // HITUNG RINGKASAN BAHAN BAKU
    // ========================================================

    const ringkasanBahan =
        bahanBakuList.map(bahan => {

            const totalMasuk =
                stokMasukList
                    .filter(
                        x =>
                            x.bahanBakuId === bahan.id
                    )
                    .reduce(
                        (sum, x) =>
                            sum + angka(x.jumlah),
                        0
                    );


            const totalRetur =
                stokReturList
                    .filter(
                        x =>
                            x.bahanBakuId === bahan.id
                    )
                    .reduce(
                        (sum, x) =>
                            sum + angka(x.jumlah),
                        0
                    );


            const totalKeluar =
                stokKeluarList
                    .filter(
                        x =>
                            x.bahanBakuId === bahan.id
                    )
                    .reduce(
                        (sum, x) =>
                            sum + angka(x.jumlah),
                        0
                    );


            const totalDimasak =
                stokMasakList
                    .filter(
                        x =>
                            x.bahanBakuId === bahan.id &&
                            x.saldoAwal !== true
                    )
                    .reduce(
                        (sum, x) =>
                            sum + angka(
                                x.jumlahDiproses
                            ),
                        0
                    );


            const pengeluaran =
                stokMasukList
                    .filter(
                        x =>
                            x.bahanBakuId === bahan.id &&
                            x.saldoAwal !== true
                    )
                    .reduce(
                        (sum, x) =>
                            sum +
                            (
                                angka(x.jumlah) *
                                angka(x.harga)
                            ),
                        0
                    );


            const stokAkhirGudang =
                totalMasuk +
                totalRetur -
                totalKeluar;


            const stokAkhirLapangan =
                totalKeluar -
                totalRetur -
                totalDimasak;


            return {

                id: bahan.id,

                nama: bahan.nama,

                satuan: bahan.satuan,

                totalMasuk,

                totalRetur,

                totalKeluar,

                totalDimasak,

                stokAkhirGudang:
                    Math.max(
                        0,
                        stokAkhirGudang
                    ),

                stokAkhirLapangan:
                    Math.max(
                        0,
                        stokAkhirLapangan
                    ),

                pengeluaran

            };

        });


    // ========================================================
    // REKONSILIASI
    // ========================================================

    const ringkasanRekonsiliasi =
        getJenisProdukList()
            .map(jenis => {

                const masak =
                    getStokMasakSaatIni(
                        jenis
                    );


                const terjual =
                    getPenjualanTercatat(
                        jenis
                    );


                const harusnya =
                    masak -
                    terjual;


                const fisikVal =
                    getSisaFisik(
                        jenis
                    );


                const fisik =
                    fisikVal === ''
                        ? null
                        : angka(fisikVal);


                const selisih =
                    fisik === null
                        ? null
                        : fisik - harusnya;


                return {

                    jenis,

                    masak,

                    terjual,

                    harusnya,

                    fisik,

                    selisih

                };

            });


    // ========================================================
    // SIMPAN ARSIP
    // ========================================================

    stockArchiveList.push({

        tanggal:
            tanggalDisplay,

        timestamp:
            new Date().toISOString(),

        totalPengeluaran:
            hitungPengeluaranSaatIni(),

        bahanBaku:
            ringkasanBahan,

        rekonsiliasi:
            ringkasanRekonsiliasi

    });


    saveJSON(
        SK_STOCK_ARCHIVE,
        stockArchiveList
    );


    // ========================================================
    // SIAPKAN SALDO PERIODE BARU
    // ========================================================

    const tanggalBaru =
        todayKey();


    const masukBaru = [];

    const keluarBaru = [];


    bahanBakuList.forEach(
        bahan => {

            const ringkasan =
                ringkasanBahan.find(
                    x =>
                        x.id === bahan.id
                );


            if (!ringkasan) {
                return;
            }


            const sisaGudang =
                Math.max(
                    0,
                    angka(
                        ringkasan.stokAkhirGudang
                    )
                );


            const sisaLapangan =
                Math.max(
                    0,
                    angka(
                        ringkasan.stokAkhirLapangan
                    )
                );


            // ------------------------------------------------
            // SALDO GUDANG
            // ------------------------------------------------

            const totalBawa =
                sisaGudang +
                sisaLapangan;


            if (totalBawa > 0) {

                masukBaru.push({

                    id:
                        generateId('saldo_in'),

                    bahanBakuId:
                        bahan.id,

                    jumlah:
                        totalBawa,

                    tanggal:
                        tanggalBaru,

                    harga: 0,

                    catatan:
                        'Saldo awal (sisa dari periode sebelumnya)',

                    timestamp:
                        new Date().toISOString(),

                    saldoAwal: true

                });

            }


            // ------------------------------------------------
            // SALDO LAPANGAN
            // ------------------------------------------------

            if (sisaLapangan > 0) {

                keluarBaru.push({

                    id:
                        generateId('saldo_out'),

                    bahanBakuId:
                        bahan.id,

                    jumlah:
                        sisaLapangan,

                    tanggal:
                        tanggalBaru,

                    catatan:
                        'Saldo awal (sisa dari periode sebelumnya)',

                    timestamp:
                        new Date().toISOString(),

                    saldoAwal: true

                });

            }

        }
    );


    // ========================================================
    // SALDO FISIK -> STOK MASAK AWAL
    // ========================================================

    const masakBaru = [];


    ringkasanRekonsiliasi
        .forEach(r => {

            if (
                r.fisik !== null &&
                r.fisik > 0
            ) {

                masakBaru.push({

                    id:
                        generateId('saldo_masak'),

                    // null karena bukan proses dari
                    // bahan baku mentah baru.
                    bahanBakuId:
                        null,

                    jumlahDiproses:
                        0,

                    tanggal:
                        tanggalBaru,

                    timestamp:
                        new Date().toISOString(),

                    hasil: [

                        {

                            jenisProduk:
                                r.jenis,

                            jumlah:
                                r.fisik

                        }

                    ],

                    catatan:
                        'Saldo awal (sisa fisik dari periode sebelumnya)',

                    saldoAwal:
                        true

                });

            }

        });


    // ========================================================
    // GANTI PERIODE
    // ========================================================

    stokMasukList =
        masukBaru;

    stokKeluarList =
        keluarBaru;

    stokMasakList =
        masakBaru;

    stokReturList =
        [];


    // Sisa fisik dikosongkan karena
    // sudah dipindahkan menjadi stok masak awal.

    sisaFisikSaatIni =
        {};


    // ========================================================
    // SIMPAN SEMUA
    // ========================================================

    saveJSON(
        SK_MASUK,
        stokMasukList
    );

    saveJSON(
        SK_KELUAR,
        stokKeluarList
    );

    saveJSON(
        SK_MASAK,
        stokMasakList
    );

    saveJSON(
        SK_RETUR,
        stokReturList
    );

    saveJSON(
        SK_SISA_FISIK,
        sisaFisikSaatIni
    );


    renderSemuaStock();
}


// ============================================================
// ARSIP STOCK
// ============================================================

function bukaModalArsipStock() {

    bukaModalForm(
        'Arsip Stock',
        buildArsipStockListHtml()
    );

}


function buildArsipStockListHtml() {

    if (
        stockArchiveList.length === 0
    ) {

        return `
            <p class="text-xs text-gray-400 text-center py-6">
                Belum ada arsip.
                Arsip tersimpan otomatis setiap Reset Hari Ini.
            </p>
        `;

    }


    const items =
        [...stockArchiveList]
            .reverse();


    return items
        .map(
            (entry, idx) => {

                const realIndex =
                    stockArchiveList.length -
                    1 -
                    idx;


                return `

                    <button
                        onclick="tampilkanDetailArsipStock(${realIndex})"
                        class="w-full flex justify-between items-center py-3 border-b border-gray-50 text-left active:bg-gray-50 rounded-lg px-2"
                    >

                        <div>

                            <p class="font-bold text-sm text-gray-800">
                                ${entry.tanggal}
                            </p>

                            <p class="text-[11px] text-gray-400">
                                ${(entry.bahanBaku || []).length}
                                bahan baku
                            </p>

                        </div>

                        <span class="font-bold text-sm text-red-600">
                            Rp ${formatRupiah(entry.totalPengeluaran)}
                        </span>

                    </button>

                `;

            }
        )
        .join('');

}


function tampilkanDetailArsipStock(index) {

    const entry =
        stockArchiveList[index];

    if (!entry) {
        return;
    }


    const bahanHtml =
        (entry.bahanBaku || [])
            .map(b => `

                <div class="border-b border-gray-50 py-2">

                    <p class="text-sm font-bold text-gray-700">

                        ${b.nama}

                        <span class="text-gray-400 font-normal text-xs">
                            (${b.satuan})
                        </span>

                    </p>

                    <p class="text-[11px] text-gray-400">
                        Masuk ${b.totalMasuk}
                        &middot;
                        Retur ${b.totalRetur}
                        &middot;
                        Keluar ${b.totalKeluar}
                        &middot;
                        Dimasak ${b.totalDimasak}
                    </p>

                    <p class="text-[11px] text-gray-500">

                        Sisa Gudang:
                        <span class="font-bold">
                            ${b.stokAkhirGudang}
                        </span>

                        &middot;

                        Sisa Lapangan:
                        <span class="font-bold">
                            ${b.stokAkhirLapangan}
                        </span>

                        &middot;

                        Pengeluaran:
                        <span class="font-bold text-red-600">
                            Rp ${formatRupiah(b.pengeluaran)}
                        </span>

                    </p>

                </div>

            `)
            .join('');


    const rekon =
        entry.rekonsiliasi || [];


    const rekonHtml =
        rekon.length
            ? `

                <table class="w-full text-xs mt-2">

                    <thead>

                        <tr class="bg-gray-50 text-gray-500 text-left">

                            <th class="p-1.5">
                                Produk
                            </th>

                            <th class="p-1.5 text-right">
                                Masak
                            </th>

                            <th class="p-1.5 text-right">
                                Terjual
                            </th>

                            <th class="p-1.5 text-right">
                                Harusnya
                            </th>

                            <th class="p-1.5 text-right">
                                Fisik
                            </th>

                            <th class="p-1.5 text-right">
                                Selisih
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rekon.map(r => {

                            const warna =
                                r.selisih === null
                                    ? 'text-gray-300'
                                    : (
                                        r.selisih === 0
                                            ? 'text-green-600'
                                            : (
                                                r.selisih < 0
                                                    ? 'text-red-500'
                                                    : 'text-blue-600'
                                            )
                                    );


                            const teks =
                                r.selisih === null
                                    ? '-'
                                    : (
                                        r.selisih > 0
                                            ? `+${r.selisih}`
                                            : `${r.selisih}`
                                    );


                            return `

                                <tr class="border-t border-gray-50">

                                    <td class="p-1.5">
                                        ${r.jenis}
                                    </td>

                                    <td class="p-1.5 text-right">
                                        ${r.masak}
                                    </td>

                                    <td class="p-1.5 text-right">
                                        ${r.terjual}
                                    </td>

                                    <td class="p-1.5 text-right">
                                        ${r.harusnya}
                                    </td>

                                    <td class="p-1.5 text-right">
                                        ${
                                            r.fisik === null
                                                ? '-'
                                                : r.fisik
                                        }
                                    </td>

                                    <td class="p-1.5 text-right font-bold ${warna}">
                                        ${teks}
                                    </td>

                                </tr>

                            `;

                        }).join('')}

                    </tbody>

                </table>

            `
            : `
                <p class="text-[11px] text-gray-400 mt-2">
                    Gak ada data rekonsiliasi.
                </p>
            `;


    document.getElementById(
        'modalFormBody'
    ).innerHTML = `

        <button
            onclick="bukaModalArsipStock()"
            class="text-xs font-bold text-gray-400 mb-3"
        >
            ← Kembali ke daftar arsip
        </button>

        <div class="flex justify-between items-center mb-3">

            <p class="font-bold text-gray-800">
                ${entry.tanggal}
            </p>

            <p class="font-bold text-red-600">
                Rp ${formatRupiah(entry.totalPengeluaran)}
            </p>

        </div>

        <p class="text-[11px] font-black text-red-600 uppercase tracking-wide mb-1">
            Bahan Baku
        </p>

        ${bahanHtml}

        <p class="text-[11px] font-black text-red-600 uppercase tracking-wide mt-3 mb-1">
            Rekonsiliasi
        </p>

        ${rekonHtml}

    `;

}


// ============================================================
// MAPPING PRODUK
// ============================================================

function tambahMappingRow(
    menuItemId
) {

    if (
        !produkMapping[menuItemId]
    ) {

        produkMapping[menuItemId] = [];

    }


    produkMapping[menuItemId]
        .push({

            jenisProduk: '',

            jumlahPerPorsi: 1

        });


    saveJSON(
        SK_MAPPING,
        produkMapping
    );


    refreshModalMapping();
}


function hapusMappingRow(
    menuItemId,
    index
) {

    if (
        !produkMapping[menuItemId]
    ) {
        return;
    }


    produkMapping[menuItemId]
        .splice(index, 1);


    if (
        produkMapping[menuItemId]
            .length === 0
    ) {

        delete produkMapping[
            menuItemId
        ];

    }


    saveJSON(
        SK_MAPPING,
        produkMapping
    );


    refreshModalMapping();

    renderRekonsiliasi();
}


function updateMappingRowJenis(
    menuItemId,
    index,
    jenisProduk
) {

    if (
        !produkMapping[menuItemId] ||
        !produkMapping[menuItemId][index]
    ) {
        return;
    }


    produkMapping[menuItemId][index]
        .jenisProduk =
        jenisProduk;


    saveJSON(
        SK_MAPPING,
        produkMapping
    );


    renderRekonsiliasi();
}


function updateMappingRowJumlah(
    menuItemId,
    index,
    jumlah
) {

    if (
        !produkMapping[menuItemId] ||
        !produkMapping[menuItemId][index]
    ) {
        return;
    }


    produkMapping[menuItemId][index]
        .jumlahPerPorsi =
        Math.max(
            1,
            angka(jumlah)
        );


    saveJSON(
        SK_MAPPING,
        produkMapping
    );


    renderRekonsiliasi();
}


// ============================================================
// SISA FISIK
// ============================================================

function ubahSisaFisik(
    jenis,
    jumlah
) {

    simpanSisaFisik(
        jenis,
        jumlah === ''
            ? ''
            : Math.max(
                0,
                angka(jumlah)
            )
    );


    renderRekonsiliasi();
}


// ============================================================
// LAPORAN STOCK KE WHATSAPP
// ============================================================

function copyLaporanStockToWA() {

    const tanggalEl =
        document.getElementById(
            'tanggalHariIni'
        );


    const tanggalDisplay =
        tanggalEl
            ? tanggalEl.innerText
            : todayKey();


    if (
        stokMasukList.length === 0 &&
        stokKeluarList.length === 0 &&
        stokReturList.length === 0 &&
        stokMasakList.length === 0
    ) {

        alert(
            'Belum ada transaksi stok periode ini.'
        );

        return;
    }


    let text =
        `*LAPORAN STOK AYAM BOBBY*\n` +
        `Tanggal: ${tanggalDisplay}\n`;


    let totalPengeluaran = 0;


    const labelMap = {

        masuk: 'Masuk',

        keluar: 'Keluar',

        masak: 'Masak',

        retur: 'Retur'

    };


    const tandaMap = {

        masuk: '+',

        keluar: '-',

        masak: '-',

        retur: '+'

    };


    bahanBakuList.forEach(
        bahan => {

            const riwayat =
                hitungRiwayatBahanDenganSaldo(
                    bahan.id
                )
                .slice()
                .reverse();


            if (
                riwayat.length === 0
            ) {
                return;
            }


            text +=
                `\n*${bahan.nama.toUpperCase()}* (${bahan.satuan})\n`;


            riwayat.forEach(
                transaksi => {

                    let baris =
                        `- ${labelMap[transaksi.tipe]} ` +
                        `${tandaMap[transaksi.tipe]}` +
                        `${transaksi.jumlah}`;


                    if (
                        transaksi.tipe === 'masuk'
                    ) {

                        const subtotal =
                            angka(
                                transaksi.jumlah
                            ) *
                            angka(
                                transaksi.harga
                            );


                        totalPengeluaran +=
                            subtotal;


                        if (
                            transaksi.harga > 0
                        ) {

                            baris +=
                                ` (Rp${formatRupiah(subtotal)})`;

                        } else {

                            baris +=
                                ' (saldo awal / harga belum diisi)';

                        }

                    }


                    baris +=
                        ` → Gudang: ${transaksi.gudangSetelah}, ` +
                        `Lapangan: ${transaksi.lapanganSetelah}`;


                    if (
                        transaksi.catatan
                    ) {

                        baris +=
                            ` — ${transaksi.catatan}`;

                    }


                    text +=
                        baris +
                        '\n';

                }
            );

        }
    );


    text +=
        `\n------------------\n` +
        `*TOTAL PENGELUARAN: Rp ${formatRupiah(totalPengeluaran)}*`;


    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard
            .writeText(text)
            .then(() => {

                alert(
                    'Mantap! Laporan stock udah disalin, tinggal paste ke WA.'
                );

            })
            .catch(error => {

                console.error(
                    'Gagal copy text:',
                    error
                );

                alert(
                    'Gagal menyalin otomatis.'
                );

            });

    } else {

        const textarea =
            document.createElement(
                'textarea'
            );

        textarea.value =
            text;

        document.body.appendChild(
            textarea
        );

        textarea.select();

        try {

            document.execCommand(
                'copy'
            );

            alert(
                'Laporan stock berhasil disalin.'
            );

        } catch (error) {

            alert(
                'Gagal menyalin laporan.'
            );

        }

        document.body.removeChild(
            textarea
        );

    }

}


// ============================================================
// MODAL FORM GENERIK
// ============================================================

function bukaModalForm(
    title,
    bodyHtml
) {

    const titleEl =
        document.getElementById(
            'modalFormTitle'
        );

    const bodyEl =
        document.getElementById(
            'modalFormBody'
        );

    const modalEl =
        document.getElementById(
            'modalForm'
        );


    if (titleEl) {
        titleEl.innerText =
            title;
    }


    if (bodyEl) {
        bodyEl.innerHTML =
            bodyHtml;
    }


    if (modalEl) {
        modalEl.classList.remove(
            'hidden'
        );
    }

}


function tutupModalForm() {

    const modal =
        document.getElementById(
            'modalForm'
        );


    if (modal) {
        modal.classList.add(
            'hidden'
        );
    }

}


// ============================================================
// FORM TAMBAH / EDIT BAHAN BAKU
// ============================================================

function bukaModalTambahBahan() {

    editingBahanBakuId =
        null;

    tempNamaBahan =
        '';

    tempSatuanBahan =
        '';

    tempResep =
        [];

    renderFormBahanBaku();

}


function bukaModalEditBahan(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id === bahanBakuId
        );


    if (!bahan) {
        return;
    }


    editingBahanBakuId =
        bahanBakuId;


    tempNamaBahan =
        bahan.nama;


    tempSatuanBahan =
        bahan.satuan;


    tempResep =
        (
            bahan.resepKonversi ||
            []
        ).map(
            resep => ({
                ...resep
            })
        );


    renderFormBahanBaku();

}


function renderFormBahanBaku() {

    const resepRowsHtml =
        tempResep
            .map(
                (resep, index) => `

                    <div class="flex gap-2 mb-2 items-center">

                        <input
                            type="text"
                            value="${resep.jenisProduk || ''}"
                            onchange="tempResep[${index}].jenisProduk=this.value"
                            placeholder="Nama potongan (mis: Dada)"
                            class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        >

                        <input
                            type="number"
                            min="0"
                            value="${resep.jumlahPerUnit || 1}"
                            onchange="tempResep[${index}].jumlahPerUnit=Number(this.value)"
                            placeholder="Jml"
                            class="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        >

                        <button
                            onclick="tempResep.splice(${index},1); renderFormBahanBaku();"
                            class="text-red-500 font-bold px-2"
                        >
                            ✕
                        </button>

                    </div>

                `
            )
            .join('');


    const html = `

        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Nama Bahan Baku
            </label>

            <input
                id="inputNamaBahan"
                type="text"
                value="${tempNamaBahan}"
                oninput="tempNamaBahan=this.value"
                placeholder="Contoh: Ayam"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Satuan
            </label>

            <input
                id="inputSatuanBahan"
                type="text"
                value="${tempSatuanBahan}"
                oninput="tempSatuanBahan=this.value"
                placeholder="Contoh: ekor / kg / liter"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500 block mb-1">
                Konversi Hasil Olahan
            </label>

            <p class="text-[11px] text-gray-400 mb-2">
                Isi kalau bahan ini diproses menjadi beberapa jenis potongan.
                Kosongkan untuk bahan yang langsung digunakan.
            </p>

            <div id="resepRows">
                ${resepRowsHtml}
            </div>

            <button
                onclick="tempResep.push({jenisProduk:'',jumlahPerUnit:1}); renderFormBahanBaku();"
                class="text-xs font-bold text-red-600 mt-1"
            >
                + Tambah Jenis Potongan
            </button>

        </div>


        ${
            editingBahanBakuId
                ? `
                    <p class="text-[11px] text-orange-500 mb-2">
                        Kalau nama jenis potongan diubah,
                        riwayat stok masak lama tetap menggunakan nama lama.
                    </p>
                `
                : ''
        }


        <button
            onclick="submitFormBahanBaku()"
            class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            ${
                editingBahanBakuId
                    ? 'Simpan Perubahan'
                    : 'Simpan Bahan Baku'
            }
        </button>

    `;


    bukaModalForm(
        editingBahanBakuId
            ? 'Edit Bahan Baku'
            : 'Tambah Bahan Baku',
        html
    );

}


function submitFormBahanBaku() {

    const nama =
        tempNamaBahan.trim();


    const satuan =
        tempSatuanBahan.trim();


    if (!nama || !satuan) {

        alert(
            'Nama dan satuan wajib diisi.'
        );

        return;
    }


    const resepValid =
        tempResep
            .filter(
                resep =>
                    resep.jenisProduk &&
                    resep.jenisProduk.trim() !== '' &&
                    angka(
                        resep.jumlahPerUnit
                    ) > 0
            )
            .map(
                resep => ({

                    jenisProduk:
                        resep.jenisProduk.trim(),

                    jumlahPerUnit:
                        angka(
                            resep.jumlahPerUnit
                        )

                })
            );


    if (editingBahanBakuId) {

        const bahan =
            bahanBakuList.find(
                b =>
                    b.id ===
                    editingBahanBakuId
            );


        if (bahan) {

            bahan.nama =
                nama;

            bahan.satuan =
                satuan;

            bahan.resepKonversi =
                resepValid;


            saveJSON(
                SK_BAHAN,
                bahanBakuList
            );

        }


        editingBahanBakuId =
            null;


        renderSemuaStock();

    } else {

        tambahBahanBaku(
            nama,
            satuan,
            resepValid
        );

    }


    tutupModalForm();

}


// ============================================================
// MODAL STOK MASUK
// ============================================================

function bukaModalStokMasuk(
    bahanBakuId,
    entryId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id === bahanBakuId
        );


    if (!bahan) {
        return;
    }


    let entry = null;


    if (entryId) {

        entry =
            stokMasukList.find(
                x =>
                    x.id === entryId
            );


        if (!entry) {
            return;
        }

    }


    if (
        entry &&
        entry.saldoAwal === true
    ) {

        alert(
            'Saldo awal tidak perlu diedit.'
        );

        return;
    }


    const html = `

        <p class="text-sm font-bold text-gray-800 mb-3">

            ${bahan.nama}

            <span class="text-gray-400 font-normal">
                (${bahan.satuan})
            </span>

        </p>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Jumlah Masuk
            </label>

            <input
                id="inputJumlahMasuk"
                type="number"
                min="0"
                value="${entry ? entry.jumlah : ''}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Tanggal
            </label>

            <input
                id="inputTanggalMasuk"
                type="date"
                value="${entry ? entry.tanggal : todayKey()}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Harga per ${bahan.satuan}
            </label>

            <input
                id="inputHargaMasuk"
                type="number"
                min="0"
                value="${entry && entry.harga ? entry.harga : ''}"
                placeholder="Contoh: 67000"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Catatan
            </label>

            <input
                id="inputCatatanMasuk"
                type="text"
                value="${entry && entry.catatan ? entry.catatan : ''}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <button
            onclick="submitStokMasuk('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})"
            class="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            ${
                entry
                    ? 'Simpan Perubahan'
                    : 'Simpan Stok Masuk'
            }
        </button>

    `;


    bukaModalForm(
        entry
            ? 'Edit Stok Masuk'
            : 'Catat Stok Masuk',
        html
    );

}


// ============================================================
// MODAL STOK KELUAR
// ============================================================

function bukaModalStokKeluar(
    bahanBakuId,
    entryId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id === bahanBakuId
        );


    if (!bahan) {
        return;
    }


    let entry = null;


    if (entryId) {

        entry =
            stokKeluarList.find(
                x =>
                    x.id === entryId
            );


        if (!entry) {
            return;
        }

    }


    const tersediaDasar =
        hitungStokUtama(
            bahanBakuId
        ) +
        (
            entry
                ? angka(entry.jumlah)
                : 0
        );


    const html = `

        <p class="text-sm font-bold text-gray-800 mb-1">

            ${bahan.nama}

            <span class="text-gray-400 font-normal">
                (${bahan.satuan})
            </span>

        </p>


        <p class="text-[11px] text-gray-400 mb-3">

            Stok gudang tersedia:

            <span class="font-bold text-gray-700">
                ${tersediaDasar} ${bahan.satuan}
            </span>

        </p>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Jumlah Keluar
            </label>

            <input
                id="inputJumlahKeluar"
                type="number"
                min="0"
                max="${tersediaDasar}"
                value="${entry ? entry.jumlah : ''}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Tanggal
            </label>

            <input
                id="inputTanggalKeluar"
                type="date"
                value="${entry ? entry.tanggal : todayKey()}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Catatan
            </label>

            <input
                id="inputCatatanKeluar"
                type="text"
                value="${entry && entry.catatan ? entry.catatan : ''}"
                placeholder="Contoh: dibawa ke gerobak/lapangan"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <button
            onclick="submitStokKeluar('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})"
            class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-2"
        >
            ${
                entry
                    ? 'Simpan Perubahan'
                    : 'Simpan Stok Keluar'
            }
        </button>

    `;


    bukaModalForm(
        entry
            ? 'Edit Stok Keluar'
            : 'Catat Stok Keluar',
        html
    );

}


// ============================================================
// MODAL MASAK
// ============================================================

function bukaModalMasak(
    bahanBakuId,
    entryId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id === bahanBakuId
        );


    if (!bahan) {
        return;
    }


    let entry = null;


    if (entryId) {

        entry =
            stokMasakList.find(
                x =>
                    x.id === entryId
            );


        if (!entry) {
            return;
        }


        if (entry.saldoAwal === true) {

            alert(
                'Saldo awal tidak bisa diedit sebagai transaksi masak.'
            );

            return;
        }

    }


    const tersediaDasar =
        hitungStokLapanganMentah(
            bahanBakuId
        ) +
        (
            entry
                ? angka(entry.jumlahDiproses)
                : 0
        );


    const resepHtml =
        (bahan.resepKonversi || [])
            .map(
                resep => `

                    <p class="text-[11px] text-gray-500">
                        ${resep.jumlahPerUnit}
                        ${resep.jenisProduk}
                        /
                        ${bahan.satuan}
                    </p>

                `
            )
            .join('');


    const html = `

        <p class="text-sm font-bold text-gray-800 mb-1">
            ${bahan.nama}
        </p>


        <p class="text-[11px] text-gray-400 mb-2">

            Stok lapangan:
            <span class="font-bold text-gray-700">
                ${tersediaDasar} ${bahan.satuan}
            </span>

        </p>


        <div class="bg-gray-50 rounded-lg p-2 mb-3">

            <p class="text-[11px] font-bold text-gray-500 mb-1">
                Konversi per ${bahan.satuan}:
            </p>

            ${resepHtml}

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Jumlah Diproses (${bahan.satuan})
            </label>

            <input
                id="inputJumlahMasak"
                type="number"
                min="0"
                max="${tersediaDasar}"
                value="${entry ? entry.jumlahDiproses : ''}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <div class="mb-3">

            <label class="text-xs font-bold text-gray-500">
                Tanggal
            </label>

            <input
                id="inputTanggalMasak"
                type="date"
                value="${entry ? entry.tanggal : todayKey()}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <button
            onclick="submitMasak('${bahanBakuId}', ${entryId ? `'${entryId}'` : 'null'})"
            class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            ${
                entry
                    ? 'Simpan Perubahan'
                    : 'Proses & Simpan'
            }
        </button>

    `;


    bukaModalForm(
        entry
            ? 'Edit Proses Masak'
            : 'Proses Masak',
        html
    );

}


// ============================================================
// MODAL MAPPING
// ============================================================

function bukaModalMapping() {

    const jenisOptions =
        getJenisProdukList();


    if (
        jenisOptions.length === 0
    ) {

        bukaModalForm(

            'Mapping Produk',

            `
                <p class="text-xs text-gray-400 text-center py-6">
                    Belum ada jenis produk.
                    Tambahkan bahan baku dengan konversi hasil olahan dulu.
                </p>
            `

        );

        return;
    }


    if (
        typeof menuData === 'undefined' ||
        !menuData ||
        !menuData.length
    ) {

        bukaModalForm(

            'Mapping Produk',

            `
                <p class="text-xs text-gray-400 text-center py-6">
                    Data menu kasir belum ketemu.
                </p>
            `

        );

        return;
    }


    bukaModalForm(
        'Mapping Produk ke Kasir',
        buildMappingHtml(jenisOptions)
    );

}


function refreshModalMapping() {

    const jenisOptions =
        getJenisProdukList();


    const body =
        document.getElementById(
            'modalFormBody'
        );


    if (body) {

        body.innerHTML =
            buildMappingHtml(
                jenisOptions
            );

    }

}


function buildMappingHtml(
    jenisOptions
) {

    const rows =
        menuData
            .map(item => {

                const mappingRows =
                    produkMapping[item.id] ||
                    [];


                const rowsHtml =
                    mappingRows
                        .map(
                            (row, index) => {

                                const options =
                                    [
                                        '<option value="">- pilih jenis -</option>'
                                    ]
                                    .concat(
                                        jenisOptions.map(
                                            jenis => `
                                                <option
                                                    value="${jenis}"
                                                    ${
                                                        row.jenisProduk === jenis
                                                            ? 'selected'
                                                            : ''
                                                    }
                                                >
                                                    ${jenis}
                                                </option>
                                            `
                                        )
                                    )
                                    .join('');


                                return `

                                    <div class="flex gap-2 mb-1.5 items-center">

                                        <select
                                            onchange="updateMappingRowJenis('${item.id}', ${index}, this.value)"
                                            class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                                        >
                                            ${options}
                                        </select>

                                        <input
                                            type="number"
                                            min="1"
                                            value="${row.jumlahPerPorsi || 1}"
                                            onchange="updateMappingRowJumlah('${item.id}', ${index}, this.value)"
                                            class="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                                            placeholder="Qty"
                                        >

                                        <button
                                            onclick="hapusMappingRow('${item.id}', ${index})"
                                            class="text-red-500 font-bold px-1"
                                        >
                                            ✕
                                        </button>

                                    </div>

                                `;

                            }
                        )
                        .join('');


                return `

                    <div class="border-b border-gray-50 py-2">

                        <p class="text-sm font-semibold text-gray-700 mb-1">
                            ${item.name}
                        </p>

                        ${
                            rowsHtml ||
                            `
                                <p class="text-[11px] text-gray-300 mb-1">
                                    Belum dipetakan
                                </p>
                            `
                        }

                        <button
                            onclick="tambahMappingRow('${item.id}')"
                            class="text-[11px] font-bold text-red-600"
                        >
                            + Tambah potongan
                        </button>

                    </div>

                `;

            })
            .join('');


    return `

        <p class="text-[11px] text-gray-400 mb-3">

            Tentuin tiap menu di kasir itu jual jenis potongan apa
            dan berapa pcs per porsi.

            Untuk menu seperti nasi, sambal, keju,
            biarkan kosong.

            Untuk Ayam Utuh,
            tambahkan beberapa baris.

        </p>

        ${rows}

    `;

}


// ============================================================
// RIWAYAT TRANSAKSI
// ============================================================
//
// PERBAIKAN:
//
// Saldo awal tetap muncul sebagai transaksi,
// tetapi diberi label khusus.
//
// Perhitungan saldo memakai urutan timestamp.
//
// Kalau timestamp rusak / kosong,
// tetap aman dengan fallback.
// ============================================================

function hitungRiwayatBahanDenganSaldo(
    bahanBakuId
) {

    const masuk =
        stokMasukList
            .filter(
                x =>
                    x.bahanBakuId === bahanBakuId
            )
            .map(
                x => ({
                    ...x,
                    tipe: 'masuk'
                })
            );


    const keluar =
        stokKeluarList
            .filter(
                x =>
                    x.bahanBakuId === bahanBakuId
            )
            .map(
                x => ({
                    ...x,
                    tipe: 'keluar'
                })
            );


    const masak =
        stokMasakList
            .filter(
                x =>
                    x.bahanBakuId === bahanBakuId &&
                    x.saldoAwal !== true
            )
            .map(
                x => ({

                    ...x,

                    tipe: 'masak',

                    jumlah:
                        angka(
                            x.jumlahDiproses
                        )

                })
            );


    const retur =
        stokReturList
            .filter(
                x =>
                    x.bahanBakuId === bahanBakuId
            )
            .map(
                x => ({
                    ...x,
                    tipe: 'retur'
                })
            );


    const kronologis =
        [
            ...masuk,
            ...keluar,
            ...masak,
            ...retur
        ]
        .sort(
            (a, b) => {

                const ta =
                    new Date(
                        a.timestamp ||
                        `${a.tanggal || '1970-01-01'}T00:00:00`
                    ).getTime();


                const tb =
                    new Date(
                        b.timestamp ||
                        `${b.tanggal || '1970-01-01'}T00:00:00`
                    ).getTime();


                return ta - tb;

            }
        );


    let gudang = 0;

    let lapangan = 0;


    kronologis.forEach(
        transaksi => {

            const jumlah =
                angka(
                    transaksi.jumlah
                );


            if (
                transaksi.tipe === 'masuk'
            ) {

                gudang +=
                    jumlah;

            }

            else if (
                transaksi.tipe === 'retur'
            ) {

                gudang +=
                    jumlah;

                lapangan -=
                    jumlah;

            }

            else if (
                transaksi.tipe === 'keluar'
            ) {

                gudang -=
                    jumlah;

                lapangan +=
                    jumlah;

            }

            else if (
                transaksi.tipe === 'masak'
            ) {

                lapangan -=
                    jumlah;

            }


            transaksi.gudangSetelah =
                Math.max(
                    0,
                    gudang
                );


            transaksi.lapanganSetelah =
                Math.max(
                    0,
                    lapangan
                );

        }
    );


    return kronologis
        .slice()
        .reverse();

}


// ============================================================
// MODAL RIWAYAT
// ============================================================

function bukaModalRiwayatBahan(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id === bahanBakuId
        );


    if (!bahan) {
        return;
    }


    bukaModalForm(

        `Riwayat ${bahan.nama}`,

        buildRiwayatBahanHtml(
            bahanBakuId
        )

    );

}


function refreshModalRiwayatBahan(
    bahanBakuId
) {

    const body =
        document.getElementById(
            'modalFormBody'
        );


    if (body) {

        body.innerHTML =
            buildRiwayatBahanHtml(
                bahanBakuId
            );

    }

}


function buildRiwayatBahanHtml(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id === bahanBakuId
        );


    if (!bahan) {

        return `
            <p class="text-xs text-gray-400 text-center py-6">
                Bahan baku tidak ditemukan.
            </p>
        `;

    }


    const semua =
        hitungRiwayatBahanDenganSaldo(
            bahanBakuId
        );


    if (
        semua.length === 0
    ) {

        return `
            <p class="text-xs text-gray-400 text-center py-6">
                Belum ada transaksi buat bahan ini.
            </p>
        `;

    }


    const labelMap = {

        masuk: 'Masuk',

        keluar: 'Keluar',

        masak: 'Masak',

        retur: 'Retur'

    };


    const warnaMap = {

        masuk: 'text-green-600',

        keluar: 'text-orange-500',

        masak: 'text-red-600',

        retur: 'text-blue-600'

    };


    const tandaMap = {

        masuk: '+',

        keluar: '-',

        masak: '-',

        retur: '+'

    };


    const editFnMap = {

        masuk:
            'bukaModalStokMasuk',

        keluar:
            'bukaModalStokKeluar',

        masak:
            'bukaModalMasak',

        retur:
            'bukaModalRetur'

    };


    return semua
        .map(
            transaksi => {

                const isSaldoAwal =
                    transaksi.saldoAwal === true;


                const hargaInfo =
                    transaksi.tipe === 'masuk'
                        ? (
                            transaksi.harga > 0
                                ? ` &middot; @Rp${formatRupiah(transaksi.harga)}`
                                : ' &middot; <span class="text-orange-400">saldo awal / harga belum diisi</span>'
                        )
                        : '';


                const saldoLabel =
                    isSaldoAwal
                        ? `
                            <span class="ml-1 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                SALDO AWAL
                            </span>
                        `
                        : '';


                const tombol =
                    isSaldoAwal
                        ? ''
                        : `

                            <button
                                onclick="${editFnMap[transaksi.tipe]}('${bahanBakuId}', '${transaksi.id}')"
                                class="text-blue-500 font-bold text-xs px-2"
                            >
                                Edit
                            </button>

                            <button
                                onclick="hapusTransaksiBahan('${bahanBakuId}', '${transaksi.tipe}', '${transaksi.id}')"
                                class="text-red-500 font-bold text-xs px-2"
                            >
                                Hapus
                            </button>

                        `;


                return `

                    <div class="flex justify-between items-center py-2 border-b border-gray-50 text-sm">

                        <div>

                            <p class="font-semibold text-gray-700">

                                ${labelMap[transaksi.tipe]}

                                <span class="${warnaMap[transaksi.tipe]} font-bold">

                                    ${tandaMap[transaksi.tipe]}
                                    ${transaksi.jumlah}
                                    ${bahan.satuan}

                                </span>

                                ${saldoLabel}

                            </p>


                            <p class="text-[11px] text-gray-400">

                                ${transaksi.tanggal || ''}

                                ${
                                    transaksi.catatan
                                        ? ' &middot; ' +
                                          transaksi.catatan
                                        : ''
                                }

                                ${hargaInfo}

                            </p>


                            <p class="text-[11px] text-gray-400">

                                → Gudang:
                                <span class="font-semibold text-gray-600">
                                    ${transaksi.gudangSetelah}
                                </span>

                                &middot;

                                Lapangan:
                                <span class="font-semibold text-gray-600">
                                    ${transaksi.lapanganSetelah}
                                </span>

                            </p>

                        </div>


                        <div class="flex flex-col items-end gap-1 shrink-0">

                            ${tombol}

                        </div>

                    </div>

                `;

            }
        )
        .join('');

}


// ============================================================
// HAPUS TRANSAKSI
// ============================================================

function hapusTransaksiBahan(
    bahanBakuId,
    tipe,
    id
) {

    // Jangan izinkan menghapus saldo awal
    // karena saldo awal berasal dari hasil reset.

    let transaksi = null;


    if (tipe === 'masuk') {

        transaksi =
            stokMasukList.find(
                x => x.id === id
            );

    }

    else if (tipe === 'keluar') {

        transaksi =
            stokKeluarList.find(
                x => x.id === id
            );

    }

    else if (tipe === 'masak') {

        transaksi =
            stokMasakList.find(
                x => x.id === id
            );

    }

    else if (tipe === 'retur') {

        transaksi =
            stokReturList.find(
                x => x.id === id
            );

    }


    if (
        transaksi &&
        transaksi.saldoAwal === true
    ) {

        alert(
            'Saldo awal tidak bisa dihapus dari sini.'
        );

        return;
    }


    if (
        !confirm(
            'Hapus transaksi ini?'
        )
    ) {
        return;
    }


    if (tipe === 'masuk') {

        stokMasukList =
            stokMasukList.filter(
                x => x.id !== id
            );

        saveJSON(
            SK_MASUK,
            stokMasukList
        );

    }

    else if (tipe === 'keluar') {

        stokKeluarList =
            stokKeluarList.filter(
                x => x.id !== id
            );

        saveJSON(
            SK_KELUAR,
            stokKeluarList
        );

    }

    else if (tipe === 'masak') {

        stokMasakList =
            stokMasakList.filter(
                x => x.id !== id
            );

        saveJSON(
            SK_MASAK,
            stokMasakList
        );

    }

    else if (tipe === 'retur') {

        stokReturList =
            stokReturList.filter(
                x => x.id !== id
            );

        saveJSON(
            SK_RETUR,
            stokReturList
        );

    }


    refreshModalRiwayatBahan(
        bahanBakuId
    );

    renderSemuaStock();

}


// ============================================================
// RENDER BAHAN BAKU
// ============================================================

function renderBahanBakuList() {

    const container =
        document.getElementById(
            'listBahanBaku'
        );


    if (!container) {
        return;
    }


    if (
        bahanBakuList.length === 0
    ) {

        container.innerHTML = `

            <p class="text-xs text-gray-400 text-center py-6">
                Belum ada bahan baku.
                Tambahkan dulu lewat tombol + Bahan Baku.
            </p>

        `;

        return;
    }


    container.innerHTML =
        bahanBakuList
            .map(bahan => {

                const stokUtama =
                    hitungStokUtama(
                        bahan.id
                    );


                const stokLapangan =
                    hitungStokLapanganMentah(
                        bahan.id
                    );


                const bisaMasak =
                    Array.isArray(
                        bahan.resepKonversi
                    ) &&
                    bahan.resepKonversi.length > 0;


                return `

                    <div class="bg-white rounded-xl border border-gray-100 p-3">

                        <div class="flex justify-between items-start mb-2">

                            <div>

                                <p class="font-bold text-sm text-gray-800">
                                    ${bahan.nama}
                                </p>

                                <p class="text-[11px] text-gray-400">

                                    Stok Gudang:

                                    <span class="font-bold text-gray-700">
                                        ${stokUtama}
                                        ${bahan.satuan}
                                    </span>

                                    &middot;

                                    Stok Lapangan:

                                    <span class="font-bold text-gray-700">
                                        ${stokLapangan}
                                        ${bahan.satuan}
                                    </span>

                                </p>

                            </div>


                            <div class="flex items-center gap-1 shrink-0">

                                <button
                                    onclick="bukaModalEditBahan('${bahan.id}')"
                                    title="Edit bahan baku"
                                    class="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 text-xs"
                                >
                                    ✏️
                                </button>


                                <button
                                    onclick="bukaModalRiwayatBahan('${bahan.id}')"
                                    title="Riwayat transaksi"
                                    class="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 text-xs"
                                >
                                    📜
                                </button>


                                <button
                                    onclick="hapusBahanBaku('${bahan.id}')"
                                    title="Hapus bahan baku"
                                    class="w-7 h-7 flex items-center justify-center bg-red-50 rounded-full text-red-500 text-xs"
                                >
                                    🗑
                                </button>

                            </div>

                        </div>


                        <div class="grid grid-cols-2 gap-2 mb-2">

                            <button
                                onclick="bukaModalStokMasuk('${bahan.id}')"
                                class="text-[11px] font-bold py-1.5 rounded-full bg-green-50 text-green-700"
                            >
                                + Masuk
                            </button>


                            <button
                                onclick="bukaModalStokKeluar('${bahan.id}')"
                                class="text-[11px] font-bold py-1.5 rounded-full bg-orange-50 text-orange-700"
                            >
                                - Keluar
                            </button>

                        </div>


                        <div
                            class="grid ${
                                bisaMasak
                                    ? 'grid-cols-2'
                                    : 'grid-cols-1'
                            } gap-2"
                        >

                            ${
                                bisaMasak
                                    ? `
                                        <button
                                            onclick="bukaModalMasak('${bahan.id}')"
                                            class="text-[11px] font-bold py-1.5 rounded-full bg-red-50 text-red-700"
                                        >
                                            Masak
                                        </button>
                                    `
                                    : ''
                            }


                            <button
                                onclick="bukaModalRetur('${bahan.id}')"
                                class="text-[11px] font-bold py-1.5 rounded-full bg-blue-50 text-blue-700"
                            >
                                ↩ Retur
                            </button>

                        </div>

                    </div>

                `;

            })
            .join('');

}


// ============================================================
// RENDER REKONSILIASI
// ============================================================

function renderRekonsiliasi() {

    const tbody =
        document.getElementById(
            'tabelRekonsiliasi'
        );


    if (!tbody) {
        return;
    }


    const jenisList =
        getJenisProdukList();


    if (
        jenisList.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="p-4 text-center text-gray-400 text-xs"
                >
                    Belum ada jenis produk.
                    Tambah bahan baku dengan
                    konversi hasil olahan dulu.
                </td>

            </tr>

        `;

        return;
    }


    let totalMasak = 0;

    let totalTerjual = 0;

    let totalHarusnya = 0;

    let totalFisik = 0;

    let totalSelisih = 0;

    let jumlahFisikTerisi = 0;


    const rows =
        jenisList
            .map(jenis => {

                const masak =
                    getStokMasakSaatIni(
                        jenis
                    );


                const terjual =
                    getPenjualanTercatat(
                        jenis
                    );


                const harusnya =
                    masak -
                    terjual;


                const fisikVal =
                    getSisaFisik(
                        jenis
                    );


                const fisik =
                    fisikVal === ''
                        ? null
                        : angka(fisikVal);


                const selisih =
                    fisik === null
                        ? null
                        : fisik - harusnya;


                totalMasak +=
                    masak;


                totalTerjual +=
                    terjual;


                totalHarusnya +=
                    harusnya;


                if (
                    fisik !== null
                ) {

                    totalFisik +=
                        fisik;

                    totalSelisih +=
                        selisih;

                    jumlahFisikTerisi++;

                }


                const warna =
                    selisih === null
                        ? 'text-gray-300'
                        : (
                            selisih === 0
                                ? 'text-green-600'
                                : (
                                    selisih < 0
                                        ? 'text-red-500'
                                        : 'text-blue-600'
                                )
                        );


                const teks =
                    selisih === null
                        ? '-'
                        : (
                            selisih > 0
                                ? `+${selisih}`
                                : `${selisih}`
                        );


                return `

                    <tr class="border-t border-gray-50">

                        <td class="p-2 font-semibold text-gray-700">
                            ${jenis}
                        </td>


                        <td class="p-2 text-right">
                            ${masak}
                        </td>


                        <td class="p-2 text-right">
                            ${terjual}
                        </td>


                        <td class="p-2 text-right">
                            ${harusnya}
                        </td>


                        <td class="p-2 text-right">

                            <input
                                type="number"
                                min="0"
                                value="${fisikVal}"
                                onchange="ubahSisaFisik('${jenis}', this.value)"
                                class="w-14 border border-gray-200 rounded px-1 py-0.5 text-right text-xs"
                            >

                        </td>


                        <td class="p-2 text-right font-bold ${warna}">
                            ${teks}
                        </td>

                    </tr>

                `;

            })
            .join('');


    const totalTeks =
        jumlahFisikTerisi === 0
            ? '-'
            : (
                totalSelisih > 0
                    ? `+${totalSelisih}`
                    : `${totalSelisih}`
            );


    const totalWarna =
        jumlahFisikTerisi === 0
            ? 'text-gray-300'
            : (
                totalSelisih === 0
                    ? 'text-green-600'
                    : (
                        totalSelisih < 0
                            ? 'text-red-600'
                            : 'text-blue-600'
                    )
            );


    const rowTotal = `

        <tr class="border-t-2 border-gray-200 bg-gray-50 font-bold">

            <td class="p-2">
                Total
            </td>

            <td class="p-2 text-right">
                ${totalMasak}
            </td>

            <td class="p-2 text-right">
                ${totalTerjual}
            </td>

            <td class="p-2 text-right">
                ${totalHarusnya}
            </td>

            <td class="p-2 text-right">
                ${jumlahFisikTerisi > 0 ? totalFisik : '-'}
            </td>

            <td class="p-2 text-right ${totalWarna}">
                ${totalTeks}
            </td>

        </tr>

    `;


    tbody.innerHTML =
        rows +
        rowTotal;

}


// ============================================================
// RENDER TOTAL PENGELUARAN
// ============================================================

function renderTotalPengeluaran() {

    const el =
        document.getElementById(
            'totalPengeluaranStock'
        );


    if (!el) {
        return;
    }


    el.innerText =
        'Rp ' +
        formatRupiah(
            hitungPengeluaranSaatIni()
        );

}


// ============================================================
// RENDER SEMUA
// ============================================================

function renderSemuaStock() {

    renderBahanBakuList();

    renderRekonsiliasi();

    renderTotalPengeluaran();

}


// ============================================================
// AUTO RENDER SAAT SCRIPT SELESAI
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        renderSemuaStock();

    }
);