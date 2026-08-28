// ============================================================
// STOCK.JS - MONITORING & REKONSILIASI STOK AYAM BOBBY
// FULL VERSION
//
// SISTEM:
// 1. MASTER BAHAN BAKU = PERMANEN
// 2. SALDO GUDANG = PERMANEN / CARRY OVER
// 3. TRANSAKSI HARIAN = MASUK, KELUAR, MASAK, KEMBALI
// 4. RESET = ARSIP + HAPUS TRANSAKSI HARI INI
// 5. SALDO GUDANG TIDAK DIHAPUS SAAT RESET
// 6. PENGEMBALIAN OTOMATIS MENGIKUTI BAHAN BAKU
// ============================================================


// ============================================================
// STORAGE KEY
// ============================================================

const SK_BAHAN =
    'bobby_bahan_baku';

const SK_MASUK =
    'bobby_stok_masuk';

const SK_KELUAR =
    'bobby_stok_keluar';

const SK_MASAK =
    'bobby_stok_masak';

const SK_MAPPING =
    'bobby_produk_mapping';

const SK_SISA_FISIK =
    'bobby_sisa_fisik';

const SK_SALDO_GUDANG =
    'bobby_saldo_gudang';


// ============================================================
// HELPER
// ============================================================

function safeNumber(
    value,
    fallback = 0
) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}


function safeString(
    value,
    fallback = ''
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;

    }

    return String(value);

}


function loadJSON(
    key,
    fallback
) {

    try {

        const raw =
            localStorage.getItem(
                key
            );

        if (
            raw === null ||
            raw === ''
        ) {

            return fallback;

        }

        const parsed =
            JSON.parse(raw);

        return (
            parsed === null ||
            parsed === undefined
        )
            ? fallback
            : parsed;

    } catch (error) {

        console.warn(
            `[STOCK] Gagal membaca ${key}:`,
            error
        );

        return fallback;

    }

}


function saveJSON(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;

    } catch (error) {

        console.error(
            `[STOCK] Gagal menyimpan ${key}:`,
            error
        );

        return false;

    }

}


function getElement(
    id
) {

    return document.getElementById(
        id
    );

}


function escapeHTML(
    value
) {

    return safeString(
        value
    )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );

}


// ============================================================
// TANGGAL
// ============================================================

function todayKey() {

    const d =
        new Date();

    const year =
        d.getFullYear();

    const month =
        String(
            d.getMonth() + 1
        ).padStart(
            2,
            '0'
        );

    const day =
        String(
            d.getDate()
        ).padStart(
            2,
            '0'
        );

    return `${year}-${month}-${day}`;

}


function formatTanggalIndonesia(
    tanggal
) {

    if (!tanggal) {

        return '-';

    }

    const d =
        new Date(
            `${tanggal}T00:00:00`
        );

    if (
        Number.isNaN(
            d.getTime()
        )
    ) {

        return tanggal;

    }

    return d.toLocaleDateString(
        'id-ID',
        {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }
    );

}


// ============================================================
// DATA
// ============================================================

let bahanBakuList =
    loadJSON(
        SK_BAHAN,
        []
    );

let stokMasukList =
    loadJSON(
        SK_MASUK,
        []
    );

let stokKeluarList =
    loadJSON(
        SK_KELUAR,
        []
    );

let stokMasakList =
    loadJSON(
        SK_MASAK,
        []
    );

let produkMapping =
    loadJSON(
        SK_MAPPING,
        {}
    );

let sisaFisikHarian =
    loadJSON(
        SK_SISA_FISIK,
        {}
    );

let saldoGudang =
    loadJSON(
        SK_SALDO_GUDANG,
        null
    );

let tempResep = [];


// ============================================================
// VALIDASI DATA
// ============================================================

if (
    !Array.isArray(
        bahanBakuList
    )
) {

    bahanBakuList = [];

}


if (
    !Array.isArray(
        stokMasukList
    )
) {

    stokMasukList = [];

}


if (
    !Array.isArray(
        stokKeluarList
    )
) {

    stokKeluarList = [];

}


if (
    !Array.isArray(
        stokMasakList
    )
) {

    stokMasakList = [];

}


if (
    typeof produkMapping !==
        'object' ||
    produkMapping === null ||
    Array.isArray(
        produkMapping
    )
) {

    produkMapping = {};

}


if (
    typeof sisaFisikHarian !==
        'object' ||
    sisaFisikHarian === null ||
    Array.isArray(
        sisaFisikHarian
    )
) {

    sisaFisikHarian = {};

}


// ============================================================
// NORMALISASI MAPPING LAMA
// ============================================================

Object.keys(
    produkMapping
).forEach(
    key => {

        if (
            produkMapping[key] &&
            !Array.isArray(
                produkMapping[key]
            )
        ) {

            produkMapping[key] = [
                produkMapping[key]
            ];

        }

    }
);


// ============================================================
// NORMALISASI BAHAN
// ============================================================

bahanBakuList =
    bahanBakuList
        .filter(
            bahan =>
                bahan &&
                typeof bahan ===
                    'object'
        )
        .map(
            bahan => ({

                ...bahan,

                id:
                    safeString(
                        bahan.id
                    ),

                nama:
                    safeString(
                        bahan.nama,
                        'Bahan'
                    ),

                satuan:
                    safeString(
                        bahan.satuan,
                        'unit'
                    ),

                resepKonversi:
                    Array.isArray(
                        bahan.resepKonversi
                    )
                        ? bahan.resepKonversi
                            .filter(
                                row =>
                                    row &&
                                    typeof row ===
                                        'object'
                            )
                            .map(
                                row => ({

                                    ...row,

                                    jenisProduk:
                                        safeString(
                                            row.jenisProduk
                                        ).trim(),

                                    jumlahPerUnit:
                                        Math.max(
                                            0,
                                            safeNumber(
                                                row.jumlahPerUnit,
                                                0
                                            )
                                        )

                                })
                            )
                        : []

            })
        );


// ============================================================
// NORMALISASI TRANSAKSI
// ============================================================

function normalizeTransaction(
    transaction
) {

    if (
        !transaction ||
        typeof transaction !==
            'object'
    ) {

        return null;

    }

    return {

        ...transaction,

        id:
            safeString(
                transaction.id,
                'trx_' +
                Date.now() +
                '_' +
                Math.random()
        ),

        bahanBakuId:
            safeString(
                transaction.bahanBakuId
            ),

        jumlah:
            Math.max(
                0,
                safeNumber(
                    transaction.jumlah,
                    0
                )
            ),

        jumlahDiproses:
            Math.max(
                0,
                safeNumber(
                    transaction.jumlahDiproses,
                    0
                )
            ),

        harga:
            Math.max(
                0,
                safeNumber(
                    transaction.harga,
                    0
                )
            ),

        tanggal:
            safeString(
                transaction.tanggal,
                todayKey()
            ),

        catatan:
            safeString(
                transaction.catatan
            ),

        tipe:
            safeString(
                transaction.tipe
            ),

        timestamp:
            safeString(
                transaction.timestamp,
                new Date().toISOString()
            )

    };

}


stokMasukList =
    stokMasukList
        .map(
            normalizeTransaction
        )
        .filter(Boolean);


stokKeluarList =
    stokKeluarList
        .map(
            normalizeTransaction
        )
        .filter(Boolean);


stokMasakList =
    stokMasakList
        .map(
            normalizeTransaction
        )
        .filter(Boolean);


// ============================================================
// SALDO GUDANG
// ============================================================
//
// PENTING:
//
// Kalau storage saldo belum pernah ada,
// sistem menghitung saldo awal dari transaksi lama:
//
// SEMUA MASUK - SEMUA KELUAR
//
// Setelah itu saldo disimpan permanen.
// Jadi ke depannya reset TIDAK menghapus saldo.
// ============================================================

function initializeSaldoGudang() {

    if (
        saldoGudang &&
        typeof saldoGudang ===
            'object' &&
        !Array.isArray(
            saldoGudang
        )
    ) {

        return;

    }


    saldoGudang = {};


    bahanBakuList.forEach(
        bahan => {

            let total =
                0;


            stokMasukList
                .filter(
                    transaction =>
                        String(
                            transaction.bahanBakuId
                        ) ===
                        String(
                            bahan.id
                        )
                )
                .forEach(
                    transaction => {

                        total +=
                            Math.max(
                                0,
                                safeNumber(
                                    transaction.jumlah,
                                    0
                                )
                            );

                    }
                );


            stokKeluarList
                .filter(
                    transaction =>
                        String(
                            transaction.bahanBakuId
                        ) ===
                        String(
                            bahan.id
                        )
                )
                .forEach(
                    transaction => {

                        total -=
                            Math.max(
                                0,
                                safeNumber(
                                    transaction.jumlah,
                                    0
                                )
                            );

                    }
                );


            saldoGudang[
                bahan.id
            ] =
                Math.max(
                    0,
                    total
                );

        }
    );


    saveJSON(
        SK_SALDO_GUDANG,
        saldoGudang
    );

}


initializeSaldoGudang();


// ============================================================
// PASTIKAN BAHAN BARU PUNYA SALDO
// ============================================================

function ensureSaldoBahan(
    bahanBakuId
) {

    if (
        !saldoGudang ||
        typeof saldoGudang !==
            'object'
    ) {

        saldoGudang = {};

    }


    const id =
        String(
            bahanBakuId
        );


    if (
        saldoGudang[id] ===
            undefined ||
        saldoGudang[id] ===
            null ||
        !Number.isFinite(
            Number(
                saldoGudang[id]
            )
        )
    ) {

        saldoGudang[id] =
            0;

    }

}


function simpanSaldoGudang() {

    saveJSON(
        SK_SALDO_GUDANG,
        saldoGudang
    );

}


function getSaldoGudang(
    bahanBakuId
) {

    ensureSaldoBahan(
        bahanBakuId
    );


    return Math.max(
        0,
        safeNumber(
            saldoGudang[
                String(
                    bahanBakuId
                )
            ],
            0
        )
    );

}


function tambahSaldoGudang(
    bahanBakuId,
    jumlah
) {

    ensureSaldoBahan(
        bahanBakuId
    );


    const id =
        String(
            bahanBakuId
        );


    saldoGudang[id] =
        Math.max(
            0,
            getSaldoGudang(
                bahanBakuId
            ) +
            safeNumber(
                jumlah,
                0
            )
        );


    simpanSaldoGudang();

}


function kurangiSaldoGudang(
    bahanBakuId,
    jumlah
) {

    ensureSaldoBahan(
        bahanBakuId
    );


    const id =
        String(
            bahanBakuId
        );


    saldoGudang[id] =
        Math.max(
            0,
            getSaldoGudang(
                bahanBakuId
            ) -
            safeNumber(
                jumlah,
                0
            )
        );


    simpanSaldoGudang();

}


// ============================================================
// TAMBAH SALDO UNTUK BAHAN YANG BARU DITAMBAHKAN
// ============================================================

bahanBakuList.forEach(
    bahan => {

        ensureSaldoBahan(
            bahan.id
        );

    }
);

simpanSaldoGudang();


// ============================================================
// CARI BAHAN
// ============================================================

function getBahanById(
    bahanBakuId
) {

    return bahanBakuList.find(
        bahan =>
            String(
                bahan.id
            ) ===
            String(
                bahanBakuId
            )
    );

}


// ============================================================
// TRANSAKSI BERDASARKAN TANGGAL
// ============================================================

function transaksiTanggal(
    transaction
) {

    return safeString(
        transaction?.tanggal
    );

}


function getTransaksiMasukTanggal(
    tanggal = todayKey()
) {

    return stokMasukList.filter(
        transaction =>
            transaksiTanggal(
                transaction
            ) ===
            tanggal
    );

}


function getTransaksiKeluarTanggal(
    tanggal = todayKey()
) {

    return stokKeluarList.filter(
        transaction =>
            transaksiTanggal(
                transaction
            ) ===
            tanggal
    );

}


function getTransaksiMasakTanggal(
    tanggal = todayKey()
) {

    return stokMasakList.filter(
        transaction =>
            transaksiTanggal(
                transaction
            ) ===
            tanggal
    );

}


// ============================================================
// PERHITUNGAN TRANSAKSI BAHAN
// ============================================================

function hitungPembelian(
    bahanBakuId,
    tanggal = todayKey()
) {

    return stokMasukList
        .filter(
            transaction =>
                String(
                    transaction.bahanBakuId
                ) ===
                String(
                    bahanBakuId
                ) &&
                transaksiTanggal(
                    transaction
                ) ===
                tanggal &&
                transaction.tipe !==
                    'pengembalian'
        )
        .reduce(
            (
                total,
                transaction
            ) =>
                total +
                Math.max(
                    0,
                    safeNumber(
                        transaction.jumlah,
                        0
                    )
                ),
            0
        );

}


function hitungPengembalian(
    bahanBakuId,
    tanggal = todayKey()
) {

    return stokMasukList
        .filter(
            transaction =>
                String(
                    transaction.bahanBakuId
                ) ===
                String(
                    bahanBakuId
                ) &&
                transaksiTanggal(
                    transaction
                ) ===
                tanggal &&
                transaction.tipe ===
                    'pengembalian'
        )
        .reduce(
            (
                total,
                transaction
            ) =>
                total +
                Math.max(
                    0,
                    safeNumber(
                        transaction.jumlah,
                        0
                    )
                ),
            0
        );

}


function hitungKeluar(
    bahanBakuId,
    tanggal = todayKey()
) {

    return stokKeluarList
        .filter(
            transaction =>
                String(
                    transaction.bahanBakuId
                ) ===
                String(
                    bahanBakuId
                ) &&
                transaksiTanggal(
                    transaction
                ) ===
                tanggal
        )
        .reduce(
            (
                total,
                transaction
            ) =>
                total +
                Math.max(
                    0,
                    safeNumber(
                        transaction.jumlah,
                        0
                    )
                ),
            0
        );

}


function hitungMasakBahan(
    bahanBakuId,
    tanggal = todayKey()
) {

    return stokMasakList
        .filter(
            transaction =>
                String(
                    transaction.bahanBakuId
                ) ===
                String(
                    bahanBakuId
                ) &&
                transaksiTanggal(
                    transaction
                ) ===
                tanggal
        )
        .reduce(
            (
                total,
                transaction
            ) =>
                total +
                Math.max(
                    0,
                    safeNumber(
                        transaction.jumlahDiproses,
                        0
                    )
                ),
            0
        );

}


// ============================================================
// STOK GUDANG
// ============================================================
//
// SEKARANG BUKAN HASIL PERHITUNGAN TRANSAKSI HARI INI.
//
// Stok Gudang = saldo permanen.
//
// RESET TIDAK MENGUBAH NILAI INI.
// ============================================================

function hitungStokUtama(
    bahanBakuId
) {

    return getSaldoGudang(
        bahanBakuId
    );

}


// ============================================================
// STOK LAPANGAN HARI INI
// ============================================================
//
// KELUAR HARI INI
// - MASAK HARI INI
// - KEMBALI HARI INI
//
// ============================================================

function hitungStokLapanganMentah(
    bahanBakuId,
    tanggal = todayKey()
) {

    const keluar =
        hitungKeluar(
            bahanBakuId,
            tanggal
        );


    const masak =
        hitungMasakBahan(
            bahanBakuId,
            tanggal
        );


    const kembali =
        hitungPengembalian(
            bahanBakuId,
            tanggal
        );


    return Math.max(
        0,
        keluar -
        masak -
        kembali
    );

}


// ============================================================
// JENIS PRODUK
// ============================================================

function getJenisProdukList() {

    const set =
        new Set();


    bahanBakuList.forEach(
        bahan => {

            const resep =
                Array.isArray(
                    bahan.resepKonversi
                )
                    ? bahan.resepKonversi
                    : [];


            resep.forEach(
                row => {

                    const jenis =
                        safeString(
                            row.jenisProduk
                        ).trim();


                    if (jenis) {

                        set.add(
                            jenis
                        );

                    }

                }
            );

        }
    );


    return Array.from(
        set
    );

}


// ============================================================
// STOK HASIL MASAK
// ============================================================

function getStokMasakHariIni(
    jenisProduk,
    tanggal = todayKey()
) {

    let total =
        0;


    stokMasakList
        .filter(
            transaction =>
                transaksiTanggal(
                    transaction
                ) ===
                tanggal
        )
        .forEach(
            transaction => {

                const hasil =
                    Array.isArray(
                        transaction.hasil
                    )
                        ? transaction.hasil
                        : [];


                hasil.forEach(
                    row => {

                        if (
                            safeString(
                                row.jenisProduk
                            ) ===
                            jenisProduk
                        ) {

                            total +=
                                Math.max(
                                    0,
                                    safeNumber(
                                        row.jumlah,
                                        0
                                    )
                                );

                        }

                    }
                );

            }
        );


    return total;

}


// ============================================================
// PENJUALAN
// ============================================================

function getPenjualanTercatat(
    jenisProduk
) {

    let total =
        0;


    try {

        if (
            typeof state ===
                'undefined' ||
            !state ||
            !state.items
        ) {

            return 0;

        }


        if (
            typeof menuData ===
                'undefined' ||
            !Array.isArray(
                menuData
            )
        ) {

            return 0;

        }


        Object.keys(
            state.items
        ).forEach(
            menuId => {

                const qty =
                    Math.max(
                        0,
                        safeNumber(
                            state.items[
                                menuId
                            ],
                            0
                        )
                    );


                if (
                    qty <= 0
                ) {

                    return;

                }


                const mappingRows =
                    Array.isArray(
                        produkMapping[
                            menuId
                        ]
                    )
                        ? produkMapping[
                            menuId
                        ]
                        : [];


                mappingRows.forEach(
                    row => {

                        if (
                            safeString(
                                row.jenisProduk
                            ) !==
                            jenisProduk
                        ) {

                            return;

                        }


                        const perPorsi =
                            Math.max(
                                0,
                                safeNumber(
                                    row.jumlahPerPorsi,
                                    1
                                )
                            );


                        total +=
                            qty *
                            perPorsi;

                    }
                );

            }
        );

    } catch (error) {

        console.error(
            '[STOCK] Gagal membaca penjualan:',
            error
        );

    }


    return total;

}


// ============================================================
// SISA FISIK
// ============================================================

function getSisaFisik(
    jenisProduk,
    tanggal = todayKey()
) {

    if (
        !sisaFisikHarian[
            tanggal
        ]
    ) {

        return '';

    }


    const value =
        sisaFisikHarian[
            tanggal
        ][
            jenisProduk
        ];


    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {

        return '';

    }


    return Math.max(
        0,
        safeNumber(
            value,
            0
        )
    );

}


function simpanSisaFisik(
    jenisProduk,
    jumlah,
    tanggal = todayKey()
) {

    if (
        !sisaFisikHarian[
            tanggal
        ]
    ) {

        sisaFisikHarian[
            tanggal
        ] = {};

    }


    if (
        jumlah === '' ||
        jumlah === null ||
        jumlah === undefined
    ) {

        delete sisaFisikHarian[
            tanggal
        ][
            jenisProduk
        ];

    } else {

        sisaFisikHarian[
            tanggal
        ][
            jenisProduk
        ] =
            Math.max(
                0,
                safeNumber(
                    jumlah,
                    0
                )
            );

    }


    saveJSON(
        SK_SISA_FISIK,
        sisaFisikHarian
    );

}


function ubahSisaFisik(
    jenisProduk,
    jumlah
) {

    simpanSisaFisik(
        jenisProduk,
        jumlah
    );


    renderRekonsiliasi();

}


// ============================================================
// JUMLAH PENGELUARAN BAHAN HARI INI
// ============================================================

function hitungPengeluaranHariIni() {

    return stokMasukList
        .filter(
            transaction =>
                transaksiTanggal(
                    transaction
                ) ===
                todayKey() &&
                transaction.tipe !==
                    'pengembalian'
        )
        .reduce(
            (
                total,
                transaction
            ) => {

                const jumlah =
                    Math.max(
                        0,
                        safeNumber(
                            transaction.jumlah,
                            0
                        )
                    );


                const harga =
                    Math.max(
                        0,
                        safeNumber(
                            transaction.harga,
                            0
                        )
                    );


                return total +
                    (
                        jumlah *
                        harga
                    );

            },
            0
        );

}


// ============================================================
// PEMASUKAN KASIR
// ============================================================

function hitungPemasukanHariIni() {

    let total =
        0;


    try {

        if (
            typeof state ===
                'undefined' ||
            !state ||
            !state.items
        ) {

            return 0;

        }


        if (
            typeof menuData ===
                'undefined' ||
            !Array.isArray(
                menuData
            )
        ) {

            return 0;

        }


        Object.keys(
            state.items
        ).forEach(
            menuId => {

                const qty =
                    Math.max(
                        0,
                        safeNumber(
                            state.items[
                                menuId
                            ],
                            0
                        )
                    );


                if (
                    qty <= 0
                ) {

                    return;

                }


                const menu =
                    menuData.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                menuId
                            )
                    );


                if (!menu) {

                    return;

                }


                total +=
                    qty *
                    Math.max(
                        0,
                        safeNumber(
                            menu.price,
                            0
                        )
                    );

            }
        );

    } catch (error) {

        console.error(
            '[STOCK] Gagal menghitung pemasukan:',
            error
        );

    }


    return total;

}


// ============================================================
// TOTAL UANG
// ============================================================

function renderTotalPengeluaran() {

    const el =
        getElement(
            'totalPengeluaranStock'
        );


    if (!el) {

        return;

    }


    const pengeluaran =
        hitungPengeluaranHariIni();


    const pemasukan =
        hitungPemasukanHariIni();


    const selisih =
        pemasukan -
        pengeluaran;


    const warna =
        selisih >= 0
            ? 'text-green-600'
            : 'text-red-500';


    el.innerHTML = `

        <span class="text-gray-500">
            Beli Bahan:
            Rp ${pengeluaran.toLocaleString('id-ID')}
        </span>

        <br>

        <span class="text-blue-500">
            Hasil Jual:
            Rp ${pemasukan.toLocaleString('id-ID')}
        </span>

        <br>

        <span class="font-bold ${warna}">
            Selisih:
            Rp ${selisih.toLocaleString('id-ID')}
        </span>

    `;

}


// ============================================================
// PENGEMBALIAN STOK DINAMIS
// ============================================================

function getJumlahDikembalikanHariIni(
    bahanBakuId
) {

    return hitungPengembalian(
        bahanBakuId,
        todayKey()
    );

}


function ubahStokDikembalikan(
    bahanBakuId,
    change
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        return;

    }


    const nilai =
        Math.floor(
            safeNumber(
                change,
                0
            )
        );


    if (
        nilai === 0
    ) {

        return;

    }


    const tanggal =
        todayKey();


    // ========================================================
    // TAMBAH PENGEMBALIAN
    // ========================================================

    if (
        nilai > 0
    ) {

        const lapangan =
            hitungStokLapanganMentah(
                bahanBakuId,
                tanggal
            );


        if (
            lapangan <= 0
        ) {

            alert(
                `Tidak ada ${bahan.nama} di lapangan yang bisa dikembalikan.`
            );

            return;

        }


        const jumlah =
            Math.min(
                nilai,
                lapangan
            );


        stokMasukList.push({

            id:
                'return_' +
                Date.now() +
                '_' +
                Math.random()
                    .toString(36)
                    .slice(2),

            bahanBakuId:
                bahan.id,

            jumlah,

            tanggal,

            harga:
                0,

            catatan:
                `${bahan.nama} dikembalikan dari lapangan`,

            tipe:
                'pengembalian',

            timestamp:
                new Date().toISOString()

        });


        // Kembali ke gudang
        tambahSaldoGudang(
            bahanBakuId,
            jumlah
        );


        saveJSON(
            SK_MASUK,
            stokMasukList
        );


        renderSemuaStock();

        return;

    }


    // ========================================================
    // KURANGI PENGEMBALIAN
    // ========================================================

    let sisa =
        Math.min(
            Math.abs(
                nilai
            ),
            getJumlahDikembalikanHariIni(
                bahanBakuId
            )
        );


    if (
        sisa <= 0
    ) {

        return;

    }


    for (
        let i =
            stokMasukList.length - 1;

        i >= 0 &&
        sisa > 0;

        i--
    ) {

        const transaction =
            stokMasukList[
                i
            ];


        if (
            transaction.tipe !==
                'pengembalian'
        ) {

            continue;

        }


        if (
            String(
                transaction.bahanBakuId
            ) !==
            String(
                bahanBakuId
            )
        ) {

            continue;

        }


        if (
            transaksiTanggal(
                transaction
            ) !==
            tanggal
        ) {

            continue;

        }


        const jumlahTransaksi =
            Math.max(
                0,
                safeNumber(
                    transaction.jumlah,
                    0
                )
            );


        const ambil =
            Math.min(
                jumlahTransaksi,
                sisa
            );


        transaction.jumlah =
            jumlahTransaksi -
            ambil;


        // Batalkan saldo gudang
        kurangiSaldoGudang(
            bahanBakuId,
            ambil
        );


        sisa -=
            ambil;


        if (
            transaction.jumlah <=
                0
        ) {

            stokMasukList.splice(
                i,
                1
            );

        }

    }


    saveJSON(
        SK_MASUK,
        stokMasukList
    );


    renderSemuaStock();

}


// ============================================================
// TAMBAH BAHAN BAKU
// ============================================================

function tambahBahanBaku(
    nama,
    satuan,
    resepKonversiArr
) {

    const namaClean =
        safeString(
            nama
        ).trim();


    const satuanClean =
        safeString(
            satuan
        ).trim();


    if (
        !namaClean ||
        !satuanClean
    ) {

        return false;

    }


    const id =
        'bb_' +
        Date.now() +
        '_' +
        Math.random()
            .toString(36)
            .slice(2);


    bahanBakuList.push({

        id,

        nama:
            namaClean,

        satuan:
            satuanClean,

        resepKonversi:
            Array.isArray(
                resepKonversiArr
            )
                ? resepKonversiArr
                    .filter(
                        row =>
                            row &&
                            safeString(
                                row.jenisProduk
                            ).trim() !== '' &&
                            safeNumber(
                                row.jumlahPerUnit,
                                0
                            ) > 0
                    )
                    .map(
                        row => ({

                            jenisProduk:
                                safeString(
                                    row.jenisProduk
                                ).trim(),

                            jumlahPerUnit:
                                safeNumber(
                                    row.jumlahPerUnit,
                                    1
                                )

                        })
                    )
                : []

    });


    // Bahan baru selalu mulai 0
    saldoGudang[id] =
        0;


    simpanSaldoGudang();


    saveJSON(
        SK_BAHAN,
        bahanBakuList
    );


    renderSemuaStock();

    return true;

}


// ============================================================
// FORM TAMBAH BAHAN
// ============================================================

function bukaModalTambahBahan() {

    tempResep = [];

    renderFormBahanBaku();

}


function renderFormBahanBaku() {

    const rows =
        tempResep
            .map(
                (
                    row,
                    index
                ) => `

                    <div class="flex gap-2 mb-2 items-center">

                        <input
                            type="text"
                            value="${escapeHTML(row.jenisProduk)}"
                            onchange="tempResep[${index}].jenisProduk=this.value"
                            placeholder="Nama potongan"
                            class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        >

                        <input
                            type="number"
                            min="0"
                            value="${safeNumber(row.jumlahPerUnit, 1)}"
                            onchange="tempResep[${index}].jumlahPerUnit=Number(this.value)"
                            class="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        >

                        <button
                            onclick="tempResep.splice(${index},1);renderFormBahanBaku()"
                            class="text-red-500 font-bold px-2"
                        >
                            ✕
                        </button>

                    </div>

                `
            )
            .join('');


    bukaModalForm(

        'Tambah Bahan Baku',

        `

            <div class="mb-3">

                <label class="text-xs font-bold text-gray-500">
                    Nama Bahan Baku
                </label>

                <input
                    id="inputNamaBahan"
                    type="text"
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
                    placeholder="Contoh: ekor / kg / liter"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >

            </div>


            <div class="mb-3">

                <label class="text-xs font-bold text-gray-500">
                    Konversi Hasil Olahan
                </label>

                <p class="text-[11px] text-gray-400 mb-2">
                    Contoh: 1 ekor ayam menghasilkan 4 dada dan 2 sayap.
                </p>

                ${rows}


                <button
                    onclick="tempResep.push({jenisProduk:'',jumlahPerUnit:1});renderFormBahanBaku()"
                    class="text-xs font-bold text-red-600 mt-1"
                >
                    + Tambah Jenis Potongan
                </button>

            </div>


            <button
                onclick="submitTambahBahan()"
                class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2"
            >
                Simpan Bahan Baku
            </button>

        `
    );

}


function submitTambahBahan() {

    const namaEl =
        getElement(
            'inputNamaBahan'
        );


    const satuanEl =
        getElement(
            'inputSatuanBahan'
        );


    const nama =
        namaEl
            ? namaEl.value.trim()
            : '';


    const satuan =
        satuanEl
            ? satuanEl.value.trim()
            : '';


    if (
        !nama ||
        !satuan
    ) {

        alert(
            'Nama dan satuan wajib diisi.'
        );

        return;

    }


    const resepValid =
        tempResep
            .filter(
                row =>
                    safeString(
                        row.jenisProduk
                    ).trim() !== '' &&
                    safeNumber(
                        row.jumlahPerUnit,
                        0
                    ) > 0
            );


    tambahBahanBaku(
        nama,
        satuan,
        resepValid
    );


    tutupModalForm();

}


// ============================================================
// FORM STOK MASUK
// ============================================================

function bukaModalStokMasuk(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        return;

    }


    bukaModalForm(

        'Catat Stok Masuk',

        `

            <p class="text-sm font-bold text-gray-800 mb-3">

                ${escapeHTML(
                    bahan.nama
                )}

                <span class="text-gray-400 font-normal">
                    (${escapeHTML(
                        bahan.satuan
                    )})
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
                    value="${todayKey()}"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >

            </div>


            <div class="mb-3">

                <label class="text-xs font-bold text-gray-500">
                    Harga per ${escapeHTML(
                        bahan.satuan
                    )}
                </label>

                <input
                    id="inputHargaMasuk"
                    type="number"
                    min="0"
                    placeholder="Belum wajib diisi"
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
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >

            </div>


            <button
                onclick="submitStokMasuk('${escapeHTML(
                    bahan.id
                )}')"
                class="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-2"
            >
                Simpan Stok Masuk
            </button>

        `
    );

}


// ============================================================
// SUBMIT STOK MASUK
// ============================================================

function submitStokMasuk(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        alert(
            'Bahan baku tidak ditemukan.'
        );

        return;

    }


    const jumlahEl =
        getElement(
            'inputJumlahMasuk'
        );


    const tanggalEl =
        getElement(
            'inputTanggalMasuk'
        );


    const hargaEl =
        getElement(
            'inputHargaMasuk'
        );


    const catatanEl =
        getElement(
            'inputCatatanMasuk'
        );


    const jumlah =
        Math.floor(
            safeNumber(
                jumlahEl
                    ? jumlahEl.value
                    : 0,
                0
            )
        );


    const tanggal =
        tanggalEl &&
        tanggalEl.value
            ? tanggalEl.value
            : todayKey();


    const harga =
        Math.max(
            0,
            safeNumber(
                hargaEl
                    ? hargaEl.value
                    : 0,
                0
            )
        );


    const catatan =
        catatanEl
            ? safeString(
                catatanEl.value
            ).trim()
            : '';


    if (
        jumlah <= 0
    ) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;

    }


    stokMasukList.push({

        id:
            'in_' +
            Date.now() +
            '_' +
            Math.random()
                .toString(36)
                .slice(2),

        bahanBakuId:
            bahan.id,

        jumlah,

        tanggal,

        harga,

        catatan,

        tipe:
            'pembelian',

        timestamp:
            new Date().toISOString()

    });


    // ========================================================
    // STOK MASUK = TAMBAH SALDO GUDANG
    // ========================================================

    tambahSaldoGudang(
        bahanBakuId,
        jumlah
    );


    saveJSON(
        SK_MASUK,
        stokMasukList
    );


    renderSemuaStock();

    tutupModalForm();

}


// ============================================================
// FORM STOK KELUAR
// ============================================================

function bukaModalStokKeluar(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        return;

    }


    const tersedia =
        hitungStokUtama(
            bahanBakuId
        );


    bukaModalForm(

        'Catat Stok Keluar',

        `

            <p class="text-sm font-bold text-gray-800 mb-1">

                ${escapeHTML(
                    bahan.nama
                )}

                <span class="text-gray-400 font-normal">
                    (${escapeHTML(
                        bahan.satuan
                    )})
                </span>

            </p>


            <p class="text-[11px] text-gray-400 mb-3">

                Stok gudang tersedia:

                <span class="font-bold text-gray-700">
                    ${tersedia}
                    ${escapeHTML(
                        bahan.satuan
                    )}
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
                    max="${tersedia}"
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
                    value="${todayKey()}"
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
                    placeholder="Contoh: dibawa ke lapangan"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >

            </div>


            <button
                onclick="submitStokKeluar('${escapeHTML(
                    bahan.id
                )}')"
                class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-2"
            >
                Simpan Stok Keluar
            </button>

        `
    );

}


// ============================================================
// SUBMIT STOK KELUAR
// ============================================================

function submitStokKeluar(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        alert(
            'Bahan baku tidak ditemukan.'
        );

        return;

    }


    const jumlahEl =
        getElement(
            'inputJumlahKeluar'
        );


    const tanggalEl =
        getElement(
            'inputTanggalKeluar'
        );


    const catatanEl =
        getElement(
            'inputCatatanKeluar'
        );


    const jumlah =
        Math.floor(
            safeNumber(
                jumlahEl
                    ? jumlahEl.value
                    : 0,
                0
            )
        );


    const tanggal =
        tanggalEl &&
        tanggalEl.value
            ? tanggalEl.value
            : todayKey();


    const catatan =
        catatanEl
            ? safeString(
                catatanEl.value
            ).trim()
            : '';


    const tersedia =
        hitungStokUtama(
            bahanBakuId
        );


    if (
        jumlah <= 0
    ) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;

    }


    if (
        jumlah >
        tersedia
    ) {

        alert(
            `Stok gudang cuma tersedia ${tersedia} ${bahan.satuan}.`
        );

        return;

    }


    stokKeluarList.push({

        id:
            'out_' +
            Date.now() +
            '_' +
            Math.random()
                .toString(36)
                .slice(2),

        bahanBakuId:
            bahan.id,

        jumlah,

        tanggal,

        catatan,

        timestamp:
            new Date().toISOString()

    });


    // ========================================================
    // STOK KELUAR = KURANGI SALDO GUDANG
    // ========================================================

    kurangiSaldoGudang(
        bahanBakuId,
        jumlah
    );


    saveJSON(
        SK_KELUAR,
        stokKeluarList
    );


    renderSemuaStock();

    tutupModalForm();

}


// ============================================================
// FORM MASAK
// ============================================================

function bukaModalMasak(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        return;

    }


    const tersedia =
        hitungStokLapanganMentah(
            bahanBakuId
        );


    const resep =
        Array.isArray(
            bahan.resepKonversi
        )
            ? bahan.resepKonversi
            : [];


    const resepHtml =
        resep
            .map(
                row => `

                    <p class="text-[11px] text-gray-500">

                        ${safeNumber(
                            row.jumlahPerUnit,
                            0
                        )}

                        ${escapeHTML(
                            row.jenisProduk
                        )}

                        /

                        ${escapeHTML(
                            bahan.satuan
                        )}

                    </p>

                `
            )
            .join('');


    bukaModalForm(

        'Proses Masak',

        `

            <p class="text-sm font-bold text-gray-800 mb-1">
                ${escapeHTML(
                    bahan.nama
                )}
            </p>


            <p class="text-[11px] text-gray-400 mb-2">

                Stok lapangan:

                <span class="font-bold text-gray-700">
                    ${tersedia}
                    ${escapeHTML(
                        bahan.satuan
                    )}
                </span>

            </p>


            <div class="bg-gray-50 rounded-lg p-2 mb-3">

                <p class="text-[11px] font-bold text-gray-500 mb-1">
                    Konversi per ${escapeHTML(
                        bahan.satuan
                    )}:
                </p>

                ${
                    resepHtml ||
                    '<p class="text-[11px] text-gray-400">Belum ada konversi.</p>'
                }

            </div>


            <div class="mb-3">

                <label class="text-xs font-bold text-gray-500">
                    Jumlah Diproses (${escapeHTML(
                        bahan.satuan
                    )})
                </label>

                <input
                    id="inputJumlahMasak"
                    type="number"
                    min="0"
                    max="${tersedia}"
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
                    value="${todayKey()}"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >

            </div>


            <button
                onclick="submitMasak('${escapeHTML(
                    bahan.id
                )}')"
                class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2"
            >
                Proses & Simpan
            </button>

        `
    );

}


// ============================================================
// PROSES MASAK
// ============================================================

function prosesMasak(
    bahanBakuId,
    jumlahDiproses,
    tanggal
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        alert(
            'Bahan baku tidak ditemukan.'
        );

        return false;

    }


    const jumlah =
        Math.floor(
            safeNumber(
                jumlahDiproses,
                0
            )
        );


    const tanggalFinal =
        tanggal ||
        todayKey();


    if (
        jumlah <= 0
    ) {

        alert(
            'Jumlah masak harus lebih dari 0.'
        );

        return false;

    }


    const tersedia =
        hitungStokLapanganMentah(
            bahanBakuId,
            tanggalFinal
        );


    if (
        jumlah >
        tersedia
    ) {

        alert(
            `Stok lapangan ${bahan.nama} cuma tersisa ${tersedia} ${bahan.satuan}.`
        );

        return false;

    }


    const resep =
        Array.isArray(
            bahan.resepKonversi
        )
            ? bahan.resepKonversi
            : [];


    const hasil =
        resep
            .filter(
                row =>
                    safeString(
                        row.jenisProduk
                    ).trim() !== '' &&
                    safeNumber(
                        row.jumlahPerUnit,
                        0
                    ) > 0
            )
            .map(
                row => ({

                    jenisProduk:
                        safeString(
                            row.jenisProduk
                        ).trim(),

                    jumlah:
                        safeNumber(
                            row.jumlahPerUnit,
                            0
                        ) *
                        jumlah

                })
            );


    stokMasakList.push({

        id:
            'sm_' +
            Date.now() +
            '_' +
            Math.random()
                .toString(36)
                .slice(2),

        bahanBakuId:
            bahan.id,

        jumlahDiproses:
            jumlah,

        tanggal:
            tanggalFinal,

        hasil,

        timestamp:
            new Date().toISOString()

    });


    saveJSON(
        SK_MASAK,
        stokMasakList
    );


    renderSemuaStock();

    return true;

}


function submitMasak(
    bahanBakuId
) {

    const jumlahEl =
        getElement(
            'inputJumlahMasak'
        );


    const tanggalEl =
        getElement(
            'inputTanggalMasak'
        );


    const jumlah =
        Math.floor(
            safeNumber(
                jumlahEl
                    ? jumlahEl.value
                    : 0
            )
        );


    const tanggal =
        tanggalEl &&
        tanggalEl.value
            ? tanggalEl.value
            : todayKey();


    const berhasil =
        prosesMasak(
            bahanBakuId,
            jumlah,
            tanggal
        );


    if (
        berhasil
    ) {

        tutupModalForm();

    }

}

// ============================================================
// MAPPING PRODUK
// ============================================================
//
// Mapping:
// MENU KASIR
//      ↓
// JENIS PRODUK
//      ↓
// JUMLAH PER PORSI
//
// Contoh:
// Ayam Dada  → Dada x1
// Paket 2    → Dada x1 + Sayap x1
// ============================================================

function tambahMappingRow(
    menuItemId
) {

    if (
        !Array.isArray(
            produkMapping[
                menuItemId
            ]
        )
    ) {

        produkMapping[
            menuItemId
        ] = [];

    }


    produkMapping[
        menuItemId
    ].push({

        jenisProduk:
            '',

        jumlahPerPorsi:
            1

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
        !Array.isArray(
            produkMapping[
                menuItemId
            ]
        )
    ) {

        return;

    }


    if (
        !produkMapping[
            menuItemId
        ][index]
    ) {

        return;

    }


    produkMapping[
        menuItemId
    ].splice(
        index,
        1
    );


    if (
        produkMapping[
            menuItemId
        ].length ===
            0
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
        !produkMapping[
            menuItemId
        ] ||
        !produkMapping[
            menuItemId
        ][index]
    ) {

        return;

    }


    produkMapping[
        menuItemId
    ][index].jenisProduk =
        safeString(
            jenisProduk
        ).trim();


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
        !produkMapping[
            menuItemId
        ] ||
        !produkMapping[
            menuItemId
        ][index]
    ) {

        return;

    }


    const nilai =
        Math.max(
            1,
            safeNumber(
                jumlah,
                1
            )
        );


    produkMapping[
        menuItemId
    ][index].jumlahPerPorsi =
        nilai;


    saveJSON(
        SK_MAPPING,
        produkMapping
    );


    renderRekonsiliasi();

}


function bukaModalMapping() {

    const jenisList =
        getJenisProdukList();


    if (
        typeof menuData ===
            'undefined' ||
        !Array.isArray(
            menuData
        ) ||
        menuData.length ===
            0
    ) {

        bukaModalForm(

            'Mapping Produk',

            `
                <p class="text-xs text-gray-400 text-center py-6">
                    Data menu kasir belum ditemukan.
                </p>
            `

        );

        return;

    }


    if (
        jenisList.length ===
            0
    ) {

        bukaModalForm(

            'Mapping Produk',

            `
                <p class="text-xs text-gray-400 text-center py-6">
                    Belum ada jenis produk.
                    <br>
                    Tambahkan konversi pada bahan baku terlebih dahulu.
                </p>
            `

        );

        return;

    }


    bukaModalForm(

        'Mapping Produk ke Kasir',

        buildMappingHtml(
            jenisList
        )

    );

}


function refreshModalMapping() {

    const body =
        getElement(
            'modalFormBody'
        );


    if (!body) {

        return;

    }


    body.innerHTML =
        buildMappingHtml(
            getJenisProdukList()
        );

}


function buildMappingHtml(
    jenisList
) {

    if (
        typeof menuData ===
            'undefined' ||
        !Array.isArray(
            menuData
        )
    ) {

        return `

            <p class="text-xs text-gray-400 text-center py-6">
                Data menu kasir belum ditemukan.
            </p>

        `;

    }


    const rows =
        menuData
            .map(
                item => {

                    const mappings =
                        Array.isArray(
                            produkMapping[
                                item.id
                            ]
                        )
                            ? produkMapping[
                                item.id
                            ]
                            : [];


                    const mappingRowsHtml =
                        mappings
                            .map(
                                (
                                    mapping,
                                    index
                                ) => {

                                    const selectedJenis =
                                        safeString(
                                            mapping.jenisProduk
                                        );


                                    const options =
                                        `
                                        <option value="">
                                            - pilih jenis -
                                        </option>
                                        ` +

                                        jenisList
                                            .map(
                                                jenis => `

                                                    <option
                                                        value="${escapeHTML(
                                                            jenis
                                                        )}"
                                                        ${
                                                            selectedJenis ===
                                                            jenis
                                                                ? 'selected'
                                                                : ''
                                                        }
                                                    >
                                                        ${escapeHTML(
                                                            jenis
                                                        )}
                                                    </option>

                                                `
                                            )
                                            .join('');


                                    return `

                                        <div class="flex gap-2 mb-1.5 items-center">

                                            <select
                                                onchange="updateMappingRowJenis('${escapeHTML(
                                                    item.id
                                                )}', ${index}, this.value)"
                                                class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                                            >

                                                ${options}

                                            </select>


                                            <input
                                                type="number"
                                                min="1"
                                                value="${Math.max(
                                                    1,
                                                    safeNumber(
                                                        mapping.jumlahPerPorsi,
                                                        1
                                                    )
                                                )}"
                                                onchange="updateMappingRowJumlah('${escapeHTML(
                                                    item.id
                                                )}', ${index}, this.value)"
                                                class="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                                            >


                                            <button
                                                type="button"
                                                onclick="hapusMappingRow('${escapeHTML(
                                                    item.id
                                                )}', ${index})"
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

                        <div class="border-b border-gray-100 py-3">

                            <p class="text-sm font-bold text-gray-700 mb-1">

                                ${escapeHTML(
                                    item.name
                                )}

                            </p>


                            ${
                                mappingRowsHtml ||

                                `
                                    <p class="text-[11px] text-gray-300 mb-1">
                                        Belum dipetakan
                                    </p>
                                `
                            }


                            <button
                                type="button"
                                onclick="tambahMappingRow('${escapeHTML(
                                    item.id
                                )}')"
                                class="text-[11px] font-bold text-red-600"
                            >
                                + Tambah potongan
                            </button>

                        </div>

                    `;

                }
            )
            .join('');


    return `

        <div class="mb-3">

            <p class="text-[11px] text-gray-400 leading-relaxed">

                Tentukan produk kasir menggunakan
                jenis potongan dari bahan baku.

                <br>

                Angka di sebelah kanan adalah
                jumlah potongan per 1 porsi.

            </p>

        </div>


        ${rows}

    `;

}

// ============================================================
// HAPUS BAHAN BAKU
// ============================================================

function hapusBahanBaku(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        return;

    }


    const yakin =
        confirm(
            `Yakin mau hapus "${bahan.nama}"?\n\nData bahan, saldo gudang, dan seluruh transaksi bahan ini akan dihapus.\n\nTindakan ini tidak bisa dibatalkan.`
        );


    if (!yakin) {

        return;

    }


    delete saldoGudang[
        String(
            bahanBakuId
        )
    ];


    bahanBakuList =
        bahanBakuList.filter(
            row =>
                String(
                    row.id
                ) !==
                String(
                    bahanBakuId
                )
        );


    stokMasukList =
        stokMasukList.filter(
            row =>
                String(
                    row.bahanBakuId
                ) !==
                String(
                    bahanBakuId
                )
        );


    stokKeluarList =
        stokKeluarList.filter(
            row =>
                String(
                    row.bahanBakuId
                ) !==
                String(
                    bahanBakuId
                )
        );


    stokMasakList =
        stokMasakList.filter(
            row =>
                String(
                    row.bahanBakuId
                ) !==
                String(
                    bahanBakuId
                )
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

    simpanSaldoGudang();


    renderSemuaStock();

}


// ============================================================
// RIWAYAT BAHAN
// ============================================================

function bukaModalRiwayatBahan(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
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
        getElement(
            'modalFormBody'
        );


    if (!body) {

        return;

    }


    body.innerHTML =
        buildRiwayatBahanHtml(
            bahanBakuId
        );

}


function buildRiwayatBahanHtml(
    bahanBakuId
) {

    const bahan =
        getBahanById(
            bahanBakuId
        );


    if (!bahan) {

        return `

            <p class="text-xs text-gray-400 text-center py-6">
                Bahan baku tidak ditemukan.
            </p>

        `;

    }


    const transaksiMasuk =
        stokMasukList
            .filter(
                row =>
                    String(
                        row.bahanBakuId
                    ) ===
                    String(
                        bahanBakuId
                    )
            )
            .map(
                row => ({

                    ...row,

                    riwayatTipe:
                        row.tipe ===
                            'pengembalian'
                            ? 'pengembalian'
                            : 'masuk'

                })
            );


    const transaksiKeluar =
        stokKeluarList
            .filter(
                row =>
                    String(
                        row.bahanBakuId
                    ) ===
                    String(
                        bahanBakuId
                    )
            )
            .map(
                row => ({

                    ...row,

                    riwayatTipe:
                        'keluar',

                    jumlah:
                        safeNumber(
                            row.jumlah,
                            0
                        )

                })
            );


    const transaksiMasak =
        stokMasakList
            .filter(
                row =>
                    String(
                        row.bahanBakuId
                    ) ===
                    String(
                        bahanBakuId
                    )
            )
            .map(
                row => ({

                    ...row,

                    riwayatTipe:
                        'masak',

                    jumlah:
                        safeNumber(
                            row.jumlahDiproses,
                            0
                        )

                })
            );


    const semuaTransaksi = [

        ...transaksiMasuk,

        ...transaksiKeluar,

        ...transaksiMasak

    ];


    semuaTransaksi.sort(
        (
            a,
            b
        ) => {

            const ta =
                new Date(
                    a.timestamp ||
                    `${a.tanggal}T00:00:00`
                ).getTime();


            const tb =
                new Date(
                    b.timestamp ||
                    `${b.tanggal}T00:00:00`
                ).getTime();


            return (
                Number.isFinite(tb)
                    ? tb
                    : 0
            ) -
            (
                Number.isFinite(ta)
                    ? ta
                    : 0
            );

        }
    );


    if (
        semuaTransaksi.length ===
            0
    ) {

        return `

            <p class="text-xs text-gray-400 text-center py-6">
                Belum ada transaksi buat bahan ini.
            </p>

        `;

    }


    return semuaTransaksi
        .map(
            transaction => {

                let warna =
                    'text-gray-600';

                let label =
                    'Transaksi';

                let tanda =
                    '';


                if (
                    transaction.riwayatTipe ===
                    'pengembalian'
                ) {

                    warna =
                        'text-blue-600';

                    label =
                        'Dikembalikan';

                    tanda =
                        '+';

                }

                else if (
                    transaction.riwayatTipe ===
                    'masuk'
                ) {

                    warna =
                        'text-green-600';

                    label =
                        'Masuk';

                    tanda =
                        '+';

                }

                else if (
                    transaction.riwayatTipe ===
                    'keluar'
                ) {

                    warna =
                        'text-orange-500';

                    label =
                        'Keluar';

                    tanda =
                        '-';

                }

                else if (
                    transaction.riwayatTipe ===
                    'masak'
                ) {

                    warna =
                        'text-red-600';

                    label =
                        'Masak';

                    tanda =
                        '-';

                }


                return `

                    <div class="flex justify-between items-center py-2 border-b border-gray-50">

                        <div class="min-w-0">

                            <p class="font-semibold text-sm text-gray-700">

                                ${label}

                                <span class="${warna} font-bold">

                                    ${tanda}${safeNumber(
                                        transaction.jumlah,
                                        0
                                    )}

                                    ${escapeHTML(
                                        bahan.satuan
                                    )}

                                </span>

                            </p>


                            <p class="text-[11px] text-gray-400">

                                ${escapeHTML(
                                    transaction.tanggal
                                )}

                                ${
                                    transaction.catatan
                                        ? ' · ' +
                                          escapeHTML(
                                              transaction.catatan
                                          )
                                        : ''
                                }

                            </p>

                        </div>


                        <button
                            onclick="hapusTransaksiBahan('${escapeHTML(
                                bahanBakuId
                            )}','${escapeHTML(
                                transaction.riwayatTipe
                            )}','${escapeHTML(
                                transaction.id
                            )}')"
                            class="text-red-500 font-bold text-xs px-2"
                        >
                            Hapus
                        </button>

                    </div>

                `;

            }
        )
        .join('');

}


// ============================================================
// HAPUS TRANSAKSI
// ============================================================
//
// PENTING:
//
// Karena saldo gudang sekarang permanen,
// menghapus transaksi harus membalik efek transaksinya.
//
// MASUK       → saldo dikurangi
// PENGEMBALIAN→ saldo dikurangi
// KELUAR      → saldo ditambah
// MASAK       → tidak menyentuh saldo gudang
// ============================================================

function hapusTransaksiBahan(
    bahanBakuId,
    tipe,
    id
) {

    if (
        !confirm(
            'Hapus transaksi ini? Saldo gudang akan disesuaikan kembali.'
        )
    ) {

        return;

    }


    const targetId =
        String(
            id
        );


    if (
        tipe === 'masuk' ||
        tipe === 'pengembalian'
    ) {

        const target =
            stokMasukList.find(
                row =>
                    String(
                        row.id
                    ) ===
                    targetId
            );


        if (target) {

            const jumlah =
                Math.max(
                    0,
                    safeNumber(
                        target.jumlah,
                        0
                    )
                );


            kurangiSaldoGudang(
                target.bahanBakuId,
                jumlah
            );

        }


        stokMasukList =
            stokMasukList.filter(
                row =>
                    String(
                        row.id
                    ) !==
                    targetId
            );


        saveJSON(
            SK_MASUK,
            stokMasukList
        );

    }


    else if (
        tipe === 'keluar'
    ) {

        const target =
            stokKeluarList.find(
                row =>
                    String(
                        row.id
                    ) ===
                    targetId
            );


        if (target) {

            const jumlah =
                Math.max(
                    0,
                    safeNumber(
                        target.jumlah,
                        0
                    )
                );


            tambahSaldoGudang(
                target.bahanBakuId,
                jumlah
            );

        }


        stokKeluarList =
            stokKeluarList.filter(
                row =>
                    String(
                        row.id
                    ) !==
                    targetId
            );


        saveJSON(
            SK_KELUAR,
            stokKeluarList
        );

    }


    else if (
        tipe === 'masak'
    ) {

        stokMasakList =
            stokMasakList.filter(
                row =>
                    String(
                        row.id
                    ) !==
                    targetId
            );


        saveJSON(
            SK_MASAK,
            stokMasakList
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
        getElement(
            'listBahanBaku'
        );


    if (!container) {

        return;

    }


    if (
        bahanBakuList.length ===
            0
    ) {

        container.innerHTML = `

            <p class="text-xs text-gray-400 text-center py-6">
                Belum ada bahan baku.
            </p>

        `;

        return;

    }


    container.innerHTML =
        bahanBakuList
            .map(
                bahan => {

                    const stokGudang =
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
                        bahan.resepKonversi.length >
                            0;


                    return `

                        <div class="bg-white rounded-xl border border-gray-100 p-3">

                            <div class="flex justify-between items-start mb-2">

                                <div class="min-w-0">

                                    <p class="font-bold text-sm text-gray-800">
                                        ${escapeHTML(
                                            bahan.nama
                                        )}
                                    </p>


                                    <p class="text-[11px] text-gray-400">

                                        Stok Gudang:

                                        <span class="font-bold text-gray-700">
                                            ${stokGudang}
                                            ${escapeHTML(
                                                bahan.satuan
                                            )}
                                        </span>


                                        &middot;


                                        Stok Lapangan:

                                        <span class="font-bold text-gray-700">
                                            ${stokLapangan}
                                            ${escapeHTML(
                                                bahan.satuan
                                            )}
                                        </span>

                                    </p>

                                </div>


                                <div class="flex items-center gap-1 shrink-0">

                                    <button
                                        onclick="bukaModalRiwayatBahan('${escapeHTML(
                                            bahan.id
                                        )}')"
                                        title="Riwayat"
                                        class="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 text-xs"
                                    >
                                        📜
                                    </button>


                                    <button
                                        onclick="hapusBahanBaku('${escapeHTML(
                                            bahan.id
                                        )}')"
                                        title="Hapus"
                                        class="w-7 h-7 flex items-center justify-center bg-red-50 rounded-full text-red-500 text-xs"
                                    >
                                        🗑
                                    </button>

                                </div>

                            </div>


                            <div class="flex gap-2">

                                <button
                                    onclick="bukaModalStokMasuk('${escapeHTML(
                                        bahan.id
                                    )}')"
                                    class="flex-1 text-[11px] font-bold py-1.5 rounded-full bg-green-50 text-green-700"
                                >
                                    + Masuk
                                </button>


                                <button
                                    onclick="bukaModalStokKeluar('${escapeHTML(
                                        bahan.id
                                    )}')"
                                    class="flex-1 text-[11px] font-bold py-1.5 rounded-full bg-orange-50 text-orange-700"
                                >
                                    - Keluar
                                </button>


                                ${
                                    bisaMasak
                                        ? `

                                            <button
                                                onclick="bukaModalMasak('${escapeHTML(
                                                    bahan.id
                                                )}')"
                                                class="flex-1 text-[11px] font-bold py-1.5 rounded-full bg-red-50 text-red-700"
                                            >
                                                Masak
                                            </button>

                                        `
                                        : ''
                                }

                            </div>

                        </div>

                    `;

                }
            )
            .join('');

}


// ============================================================
// RENDER SECTION PENGEMBALIAN DINAMIS
// ============================================================
//
// HTML lama yang bertuliskan:
// "Ayam Utuh Dikembalikan"
//
// akan otomatis diganti.
// ============================================================

function ensureDynamicReturnSection() {

    const existing =
        getElement(
            'listStokDikembalikan'
        );


    if (existing) {

        return existing;

    }


    const stockPage =
        getElement(
            'pageStock'
        );


    if (!stockPage) {

        return null;

    }


    const sections =
        stockPage.querySelectorAll(
            'section'
        );


    let target =
        null;


    sections.forEach(
        section => {

            const text =
                safeString(
                    section.innerText
                )
                    .toLowerCase();


            if (
                text.includes(
                    'ayam utuh dikembalikan'
                )
            ) {

                target =
                    section;

            }

        }
    );


    if (!target) {

        return null;

    }


    target.innerHTML = `

        <div class="flex justify-between items-center mb-3">

            <h2 class="text-xs font-black text-red-700 uppercase tracking-wider">
                Stok Dikembalikan
            </h2>

        </div>


        <p class="text-[11px] text-gray-400 mb-3">

            Daftar otomatis mengikuti
            Bahan Baku & Stok di atas.

        </p>


        <div
            id="listStokDikembalikan"
            class="space-y-3"
        ></div>

    `;


    return getElement(
        'listStokDikembalikan'
    );

}


function renderStokDikembalikan() {

    const container =
        ensureDynamicReturnSection();


    if (!container) {

        return;

    }


    if (
        bahanBakuList.length ===
            0
    ) {

        container.innerHTML = `

            <div class="bg-gray-50 border border-gray-100 rounded-xl p-4">

                <p class="text-xs text-gray-400 text-center">
                    Belum ada bahan baku.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        bahanBakuList
            .map(
                bahan => {

                    const kembali =
                        getJumlahDikembalikanHariIni(
                            bahan.id
                        );


                    const lapangan =
                        hitungStokLapanganMentah(
                            bahan.id
                        );


                    const minusDisabled =
                        kembali <= 0
                            ? 'opacity-40'
                            : '';


                    const plusDisabled =
                        lapangan <= 0
                            ? 'opacity-40'
                            : '';


                    return `

                        <div class="bg-gray-50 border border-gray-100 rounded-xl p-4">

                            <div class="flex justify-between items-center gap-3">

                                <div class="min-w-0">

                                    <p class="text-sm font-bold text-gray-800">
                                        ${escapeHTML(
                                            bahan.nama
                                        )}
                                    </p>


                                    <p class="text-[10px] text-gray-400">

                                        Lapangan:

                                        <span class="font-bold text-gray-600">
                                            ${lapangan}
                                            ${escapeHTML(
                                                bahan.satuan
                                            )}
                                        </span>

                                    </p>

                                </div>


                                <div class="flex items-center gap-3 bg-white px-2 py-1.5 rounded-full border border-gray-200 shrink-0">

                                    <button
                                        onclick="ubahStokDikembalikan('${escapeHTML(
                                            bahan.id
                                        )}', -1)"
                                        class="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 rounded-full shadow-sm font-bold text-lg ${minusDisabled}"
                                    >
                                        -
                                    </button>


                                    <span class="w-12 text-center font-bold text-gray-800 text-sm">
                                        ${kembali}
                                    </span>


                                    <button
                                        onclick="ubahStokDikembalikan('${escapeHTML(
                                            bahan.id
                                        )}', 1)"
                                        class="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-full shadow-sm font-bold text-lg ${plusDisabled}"
                                    >
                                        +
                                    </button>

                                </div>

                            </div>


                            <p class="text-[10px] text-gray-400 mt-2">

                                Dikembalikan:

                                <span class="font-bold text-blue-600">
                                    ${kembali}
                                    ${escapeHTML(
                                        bahan.satuan
                                    )}
                                </span>

                            </p>

                        </div>

                    `;

                }
            )
            .join('');

}


// ============================================================
// REKONSILIASI
// ============================================================

function renderRekonsiliasi() {

    const tbody =
        getElement(
            'tabelRekonsiliasi'
        );


    if (!tbody) {

        return;

    }


    const jenisList =
        getJenisProdukList();


    if (
        jenisList.length ===
            0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="p-4 text-center text-gray-400 text-xs"
                >
                    Belum ada jenis produk.
                </td>

            </tr>

        `;

        return;

    }


    let totalMasak =
        0;

    let totalTerjual =
        0;

    let totalHarusnya =
        0;

    let totalFisik =
        0;

    let totalSelisih =
        0;

    let adaFisik =
        false;


    const rows =
        jenisList
            .map(
                jenis => {

                    const masak =
                        getStokMasakHariIni(
                            jenis
                        );


                    const terjual =
                        getPenjualanTercatat(
                            jenis
                        );


                    const harusnya =
                        Math.max(
                            0,
                            masak -
                            terjual
                        );


                    const fisikValue =
                        getSisaFisik(
                            jenis
                        );


                    const fisik =
                        fisikValue === ''
                            ? null
                            : Math.max(
                                0,
                                safeNumber(
                                    fisikValue,
                                    0
                                )
                            );


                    const selisih =
                        fisik === null
                            ? null
                            : fisik -
                              harusnya;


                    totalMasak +=
                        masak;

                    totalTerjual +=
                        terjual;

                    totalHarusnya +=
                        harusnya;


                    if (
                        fisik !== null
                    ) {

                        adaFisik =
                            true;

                        totalFisik +=
                            fisik;

                        totalSelisih +=
                            selisih;

                    }


                    let warna =
                        'text-gray-300';


                    if (
                        selisih !== null
                    ) {

                        if (
                            selisih === 0
                        ) {

                            warna =
                                'text-green-600';

                        }

                        else if (
                            selisih < 0
                        ) {

                            warna =
                                'text-red-500';

                        }

                        else {

                            warna =
                                'text-blue-600';

                        }

                    }


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
                                ${escapeHTML(
                                    jenis
                                )}
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
                                    value="${
                                        fisikValue === ''
                                            ? ''
                                            : fisikValue
                                    }"
                                    onchange="ubahSisaFisik('${escapeHTML(
                                        jenis
                                    )}', this.value)"
                                    class="w-14 border border-gray-200 rounded px-1 py-0.5 text-right text-xs"
                                >

                            </td>


                            <td class="p-2 text-right font-bold ${warna}">
                                ${teks}
                            </td>

                        </tr>

                    `;

                }
            )
            .join('');


    const totalText =
        !adaFisik
            ? '-'
            : (
                totalSelisih > 0
                    ? `+${totalSelisih}`
                    : `${totalSelisih}`
            );


    const totalColor =
        !adaFisik
            ? 'text-gray-300'
            : (
                totalSelisih === 0
                    ? 'text-green-600'
                    : (
                        totalSelisih < 0
                            ? 'text-red-500'
                            : 'text-blue-600'
                    )
            );


    tbody.innerHTML =
        rows +
        `

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
                    ${
                        adaFisik
                            ? totalFisik
                            : '-'
                    }
                </td>

                <td class="p-2 text-right ${totalColor}">
                    ${totalText}
                </td>

            </tr>

        `;

}


// ============================================================
// ARSIP STOCK
// ============================================================

const SK_KASIR_ARCHIVE =
    'bobby_riwayat_archive';


function getKasirArchive() {

    const archive =
        loadJSON(
            SK_KASIR_ARCHIVE,
            []
        );


    return Array.isArray(
        archive
    )
        ? archive
        : [];

}


function buildStockArchiveSnapshot(
    tanggal = todayKey()
) {

    const transaksiMasuk =
        getTransaksiMasukTanggal(
            tanggal
        );


    const transaksiKeluar =
        getTransaksiKeluarTanggal(
            tanggal
        );


    const transaksiMasak =
        getTransaksiMasakTanggal(
            tanggal
        );


    const bahan =
        bahanBakuList.map(
            material => {

                const pembelian =
                    hitungPembelian(
                        material.id,
                        tanggal
                    );


                const pengembalian =
                    hitungPengembalian(
                        material.id,
                        tanggal
                    );


                const masuk =
                    pembelian +
                    pengembalian;


                const keluar =
                    hitungKeluar(
                        material.id,
                        tanggal
                    );


                const masak =
                    hitungMasakBahan(
                        material.id,
                        tanggal
                    );


                const saldoAkhir =
                    hitungStokUtama(
                        material.id
                    );


                const saldoAwal =
                    Math.max(
                        0,
                        saldoAkhir -
                        pembelian -
                        pengembalian +
                        keluar
                    );


                const lapanganAkhir =
                    hitungStokLapanganMentah(
                        material.id,
                        tanggal
                    );


                return {

                    id:
                        material.id,

                    nama:
                        material.nama,

                    satuan:
                        material.satuan,

                    saldoAwal,

                    pembelian,

                    pengembalian,

                    masuk,

                    keluar,

                    masak,

                    stokGudang:
                        saldoAkhir,

                    stokLapangan:
                        lapanganAkhir

                };

            }
        );


    const fisik =
        sisaFisikHarian[
            tanggal
        ]
            ? {
                ...sisaFisikHarian[
                    tanggal
                ]
            }
            : {};


    return {

        tanggal,

        tanggalDisplay:
            formatTanggalIndonesia(
                tanggal
            ),

        bahan,

        transaksi: {

            masuk:
                transaksiMasuk.map(
                    transaction => ({

                        id:
                            transaction.id,

                        bahanBakuId:
                            transaction.bahanBakuId,

                        jumlah:
                            safeNumber(
                                transaction.jumlah,
                                0
                            ),

                        harga:
                            safeNumber(
                                transaction.harga,
                                0
                            ),

                        catatan:
                            safeString(
                                transaction.catatan
                            ),

                        tipe:
                            safeString(
                                transaction.tipe
                            ),

                        tanggal:
                            transaction.tanggal

                    })
                ),

            keluar:
                transaksiKeluar.map(
                    transaction => ({

                        id:
                            transaction.id,

                        bahanBakuId:
                            transaction.bahanBakuId,

                        jumlah:
                            safeNumber(
                                transaction.jumlah,
                                0
                            ),

                        catatan:
                            safeString(
                                transaction.catatan
                            ),

                        tanggal:
                            transaction.tanggal

                    })
                ),

            masak:
                transaksiMasak.map(
                    transaction => ({

                        id:
                            transaction.id,

                        bahanBakuId:
                            transaction.bahanBakuId,

                        jumlahDiproses:
                            safeNumber(
                                transaction.jumlahDiproses,
                                0
                            ),

                        hasil:
                            Array.isArray(
                                transaction.hasil
                            )
                                ? transaction.hasil
                                : [],

                        tanggal:
                            transaction.tanggal

                    })
                )

        },

        fisik

    };

}


// ============================================================
// CEK DATA STOCK HARI INI
// ============================================================

function adaDataStockHariIni(
    tanggal = todayKey()
) {

    return (

        stokMasukList.some(
            transaction =>
                transaksiTanggal(
                    transaction
                ) ===
                tanggal
        ) ||

        stokKeluarList.some(
            transaction =>
                transaksiTanggal(
                    transaction
                ) ===
                tanggal
        ) ||

        stokMasakList.some(
            transaction =>
                transaksiTanggal(
                    transaction
                ) ===
                tanggal
        ) ||

        Boolean(
            sisaFisikHarian[
                tanggal
            ]
        )

    );

}


// ============================================================
// BERSIHKAN TRANSAKSI STOCK HARI INI
// ============================================================
//
// SALDO GUDANG TIDAK DISENTUH.
// ============================================================

function clearStockHariIni(
    tanggal = todayKey()
) {

    stokMasukList =
        stokMasukList.filter(
            transaction =>
                transaksiTanggal(
                    transaction
                ) !==
                tanggal
        );


    stokKeluarList =
        stokKeluarList.filter(
            transaction =>
                transaksiTanggal(
                    transaction
                ) !==
                tanggal
        );


    stokMasakList =
        stokMasakList.filter(
            transaction =>
                transaksiTanggal(
                    transaction
                ) !==
                tanggal
        );


    delete sisaFisikHarian[
        tanggal
    ];


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
        SK_SISA_FISIK,
        sisaFisikHarian
    );


    // SALDO GUDANG SENGAJA TIDAK DIHAPUS.
    simpanSaldoGudang();

}


// ============================================================
// DETAIL STOCK ARSIP
// ============================================================

function buildStockArchiveHtml(
    stock
) {

    if (!stock) {

        return '';

    }


    let html = `

        <div class="mt-5">

            <p class="text-xs font-black text-red-600 uppercase tracking-wide mb-3">
                Laporan Stock
            </p>

    `;


    stock.bahan.forEach(
        material => {

            const adaAktivitas =
                material.pembelian > 0 ||
                material.pengembalian > 0 ||
                material.keluar > 0 ||
                material.masak > 0;


            if (
                !adaAktivitas
            ) {

                return;

            }


            html += `

                <div class="border border-gray-100 rounded-xl p-3 mb-2">

                    <div class="flex justify-between items-start gap-2">

                        <p class="font-bold text-sm text-gray-800">
                            ${escapeHTML(
                                material.nama
                            )}
                        </p>


                        <p class="text-[10px] text-gray-400">
                            ${escapeHTML(
                                material.satuan
                            )}
                        </p>

                    </div>


                    <div class="grid grid-cols-2 gap-2 mt-2">

                        <div class="bg-gray-50 rounded-lg p-2">

                            <p class="text-[10px] text-gray-400">
                                Stok Awal
                            </p>

                            <p class="font-black text-sm text-gray-700">
                                ${material.saldoAwal}
                            </p>

                        </div>


                        <div class="bg-gray-50 rounded-lg p-2">

                            <p class="text-[10px] text-gray-400">
                                Stok Akhir
                            </p>

                            <p class="font-black text-sm text-gray-700">
                                ${material.stokGudang}
                            </p>

                        </div>


                        <div class="bg-green-50 rounded-lg p-2">

                            <p class="text-[10px] text-green-600">
                                Beli
                            </p>

                            <p class="font-bold text-sm text-green-700">
                                +${material.pembelian}
                            </p>

                        </div>


                        <div class="bg-blue-50 rounded-lg p-2">

                            <p class="text-[10px] text-blue-600">
                                Kembali
                            </p>

                            <p class="font-bold text-sm text-blue-700">
                                +${material.pengembalian}
                            </p>

                        </div>


                        <div class="bg-orange-50 rounded-lg p-2">

                            <p class="text-[10px] text-orange-600">
                                Keluar
                            </p>

                            <p class="font-bold text-sm text-orange-700">
                                -${material.keluar}
                            </p>

                        </div>


                        <div class="bg-red-50 rounded-lg p-2">

                            <p class="text-[10px] text-red-600">
                                Masak
                            </p>

                            <p class="font-bold text-sm text-red-700">
                                ${material.masak}
                            </p>

                        </div>

                    </div>


                    <div class="grid grid-cols-2 gap-2 mt-2">

                        <div class="bg-gray-50 rounded-lg p-2">

                            <p class="text-[10px] text-gray-400">
                                Gudang Akhir
                            </p>

                            <p class="font-black text-sm text-gray-700">
                                ${material.stokGudang}
                                ${escapeHTML(
                                    material.satuan
                                )}
                            </p>

                        </div>


                        <div class="bg-gray-50 rounded-lg p-2">

                            <p class="text-[10px] text-gray-400">
                                Lapangan Akhir
                            </p>

                            <p class="font-black text-sm text-gray-700">
                                ${material.stokLapangan}
                                ${escapeHTML(
                                    material.satuan
                                )}
                            </p>

                        </div>

                    </div>

                </div>

            `;

        }
    );


    html += `

        <div class="mt-4">

            <p class="text-[11px] font-black text-gray-500 uppercase mb-2">
                Detail Transaksi Stock
            </p>

    `;


    const detailRows =
        [];


    (
        stock.transaksi?.masuk ||
        []
    ).forEach(
        transaction => {

            detailRows.push({

                ...transaction,

                jumlah:
                    safeNumber(
                        transaction.jumlah,
                        0
                    ),

                label:
                    transaction.tipe ===
                        'pengembalian'
                        ? 'Pengembalian'
                        : 'Masuk',

                sign:
                    '+',

                color:
                    transaction.tipe ===
                        'pengembalian'
                        ? 'text-blue-600'
                        : 'text-green-600'

            });

        }
    );


    (
        stock.transaksi?.keluar ||
        []
    ).forEach(
        transaction => {

            detailRows.push({

                ...transaction,

                label:
                    'Keluar',

                sign:
                    '-',

                color:
                    'text-orange-500'

            });

        }
    );


    (
        stock.transaksi?.masak ||
        []
    ).forEach(
        transaction => {

            detailRows.push({

                ...transaction,

                jumlah:
                    safeNumber(
                        transaction.jumlahDiproses,
                        0
                    ),

                label:
                    'Masak',

                sign:
                    '-',

                color:
                    'text-red-600'

            });

        }
    );


    detailRows.forEach(
        transaction => {

            const bahan =
                stock.bahan.find(
                    material =>
                        String(
                            material.id
                        ) ===
                        String(
                            transaction.bahanBakuId
                        )
                );


            const nama =
                bahan
                    ? bahan.nama
                    : 'Bahan';


            const satuan =
                bahan
                    ? bahan.satuan
                    : 'unit';


            html += `

                <div class="flex justify-between py-2 border-b border-gray-50 text-xs">

                    <span class="text-gray-600">

                        ${escapeHTML(
                            transaction.label
                        )}

                        ·

                        ${escapeHTML(
                            nama
                        )}

                    </span>


                    <span class="font-bold ${transaction.color}">

                        ${transaction.sign}${transaction.jumlah}

                        ${escapeHTML(
                            satuan
                        )}

                    </span>

                </div>

            `;

        }
    );


    html += `

        </div>

    `;


    html += `

        </div>

    `;


    return html;

}


// ============================================================
// RESET TERPADU
// ============================================================
//
// INI YANG DIPAKAI TOMBOL "RESET HARI INI".
//
// Yang diarsipkan:
// - Kasir
// - QRIS
// - Setoran
// - Stock masuk
// - Stock keluar
// - Masak
// - Pengembalian
// - Stok awal gudang
// - Stok akhir gudang
//
// Yang di-reset:
// - Kasir
// - QRIS
// - transaksi stock hari ini
// - rekonsiliasi fisik hari ini
//
// Yang TIDAK di-reset:
// - Master bahan
// - Resep
// - Mapping
// - SALDO GUDANG
// ============================================================

function resetDataTerpadu() {

    const tanggal =
        todayKey();


    const adaKasir =
        typeof state !==
            'undefined' &&
        state &&
        (
            (
                state.log &&
                state.log.length > 0
            ) ||

            (
                state.items &&
                Object.values(
                    state.items
                ).some(
                    qty =>
                        safeNumber(
                            qty,
                            0
                        ) > 0
                )
            ) ||

            safeNumber(
                state.qris,
                0
            ) > 0
        );


    const adaStock =
        adaDataStockHariIni(
            tanggal
        );


    if (
        !adaKasir &&
        !adaStock
    ) {

        alert(
            'Belum ada data hari ini yang bisa di-reset.'
        );

        return;

    }


    const yakin =
        confirm(
            'RESET HARI INI?\n\nData Kasir + QRIS + Stok Masuk + Stok Keluar + Masak + Pengembalian + Rekonsiliasi akan masuk Arsip terlebih dahulu.\n\nStok Gudang yang masih tersisa TIDAK akan hilang. Stok tersebut menjadi saldo awal untuk hari berikutnya.\n\nMaster Bahan Baku, Resep, dan Mapping tetap aman.'
        );


    if (!yakin) {

        return;

    }


    // ========================================================
    // HASIL KASIR
    // ========================================================

    let hasilKasir = {

        total:
            0,

        qris:
            0,

        setoran:
            0

    };


    if (
        typeof calculateTotal ===
            'function'
    ) {

        try {

            hasilKasir =
                calculateTotal() || hasilKasir;

        } catch (error) {

            console.error(
                '[STOCK] Gagal mengambil hasil kasir:',
                error
            );

        }

    }


    // ========================================================
    // STOCK SNAPSHOT SEBELUM DIHAPUS
    // ========================================================

    const stockSnapshot =
        adaStock
            ? buildStockArchiveSnapshot(
                tanggal
            )
            : null;


    // ========================================================
    // ARCHIVE KASIR LAMA
    // ========================================================

    const archive =
        getKasirArchive();


    let tanggalDisplay =
        tanggal;


    const tanggalEl =
        getElement(
            'tanggalHariIni'
        );


    if (
        tanggalEl &&
        tanggalEl.innerText
    ) {

        tanggalDisplay =
            tanggalEl.innerText;

    }


    archive.push({

        tanggal:
            tanggalDisplay,

        tanggalKey:
            tanggal,

        timestamp:
            new Date().toISOString(),

        total:
            safeNumber(
                hasilKasir.total,
                0
            ),

        qris:
            safeNumber(
                hasilKasir.qris,
                0
            ),

        setoran:
            safeNumber(
                hasilKasir.setoran,
                0
            ),

        items:
            typeof state !==
                'undefined' &&
            state &&
            state.items
                ? {
                    ...state.items
                }
                : {},

        log:
            typeof state !==
                'undefined' &&
            state &&
            Array.isArray(
                state.log
            )
                ? [
                    ...state.log
                ]
                : [],

        stock:
            stockSnapshot

    });


    saveJSON(
        SK_KASIR_ARCHIVE,
        archive
    );


    // ========================================================
    // RESET KASIR
    // ========================================================

    if (
        typeof state !==
            'undefined'
    ) {

        state = {

            items: {},

            log: [],

            qris: 0

        };


        if (
            typeof saveState ===
                'function'
        ) {

            saveState();

        } else {

            saveJSON(
                'bobby_state',
                state
            );

        }

    }


    // ========================================================
    // RESET TRANSAKSI STOCK HARI INI
    //
    // SALDO GUDANG TETAP.
    // ========================================================

    clearStockHariIni(
        tanggal
    );


    // ========================================================
    // RENDER KASIR
    // ========================================================

    if (
        typeof renderMenu ===
            'function'
    ) {

        renderMenu();

    }


    if (
        typeof renderRiwayatHariIni ===
            'function'
    ) {

        renderRiwayatHariIni();

    }


    if (
        typeof calculateTotal ===
            'function'
    ) {

        calculateTotal();

    }


    // ========================================================
    // RENDER STOCK
    // ========================================================

    renderSemuaStock();


    // ========================================================
    // RENDER ARSIP
    // ========================================================

    renderArsipListTerpadu();


    alert(
        'Reset berhasil.\n\nAktivitas hari ini sudah diarsipkan.\nStok gudang yang tersisa tetap dibawa ke hari berikutnya.'
    );

}


// ============================================================
// ARSIP STOCK LIST
// ============================================================

function renderArsipListTerpadu() {

    const list =
        getElement(
            'riwayatArsipList'
        );


    if (!list) {

        return;

    }


    const archive =
        getKasirArchive();


    if (
        archive.length === 0
    ) {

        list.innerHTML = `

            <p class="text-xs text-gray-400 text-center py-6">
                Belum ada arsip.
            </p>

        `;

        return;

    }


    list.innerHTML =
        [...archive]
            .reverse()
            .map(
                (
                    entry,
                    reverseIndex
                ) => {

                    const realIndex =
                        archive.length -
                        1 -
                        reverseIndex;


                    const total =
                        safeNumber(
                            entry.total,
                            0
                        );


                    const qris =
                        safeNumber(
                            entry.qris,
                            0
                        );


                    const setoran =
                        safeNumber(
                            entry.setoran,
                            Math.max(
                                0,
                                total -
                                qris
                            )
                        );


                    const kasirLog =
                        Array.isArray(
                            entry.log
                        )
                            ? entry.log.length
                            : 0;


                    let stockCount =
                        0;


                    if (
                        entry.stock &&
                        entry.stock.transaksi
                    ) {

                        stockCount +=
                            (
                                entry.stock.transaksi
                                    .masuk ||
                                []
                            ).length;


                        stockCount +=
                            (
                                entry.stock.transaksi
                                    .keluar ||
                                []
                            ).length;


                        stockCount +=
                            (
                                entry.stock.transaksi
                                    .masak ||
                                []
                            ).length;

                    }


                    return `

                        <button
                            onclick="tampilkanDetailArsip(${realIndex})"
                            class="w-full flex justify-between items-center py-3 border-b border-gray-50 text-left active:bg-gray-50 rounded-lg px-2"
                        >

                            <div>

                                <p class="font-bold text-sm text-gray-800">
                                    ${escapeHTML(
                                        entry.tanggal ||
                                        '-'
                                    )}
                                </p>


                                <p class="text-[11px] text-gray-400">

                                    ${kasirLog} transaksi kasir

                                    ${
                                        entry.stock
                                            ? ` · ${stockCount} transaksi stock`
                                            : ''
                                    }

                                </p>

                            </div>


                            <div class="text-right">

                                <p class="font-bold text-sm text-red-600">
                                    Setoran
                                </p>


                                <p class="font-black text-sm text-gray-900">
                                    Rp ${setoran.toLocaleString('id-ID')}
                                </p>

                            </div>

                        </button>

                    `;

                }
            )
            .join('');

}


// ============================================================
// DETAIL ARSIP
// ============================================================

function tampilkanDetailArsipTerpadu(
    index
) {

    const archive =
        getKasirArchive();


    const entry =
        archive[
            index
        ];


    if (!entry) {

        return;

    }


    const listEl =
        getElement(
            'riwayatArsipList'
        );


    const detailEl =
        getElement(
            'riwayatArsipDetail'
        );


    const contentEl =
        getElement(
            'riwayatArsipDetailContent'
        );


    if (
        !listEl ||
        !detailEl ||
        !contentEl
    ) {

        return;

    }


    listEl.classList.add(
        'hidden'
    );


    detailEl.classList.remove(
        'hidden'
    );


    const total =
        safeNumber(
            entry.total,
            0
        );


    const qris =
        safeNumber(
            entry.qris,
            0
        );


    const setoran =
        safeNumber(
            entry.setoran,
            Math.max(
                0,
                total -
                qris
            )
        );


    let currentCategory =
        '';


    let produkHtml =
        '';


    let adaProduk =
        false;


    if (
        typeof menuData !==
            'undefined' &&
        Array.isArray(
            menuData
        )
    ) {

        menuData.forEach(
            item => {

                const qty =
                    entry.items &&
                    entry.items[
                        item.id
                    ]
                        ? safeNumber(
                            entry.items[
                                item.id
                            ],
                            0
                        )
                        : 0;


                if (
                    qty <= 0
                ) {

                    return;

                }


                adaProduk =
                    true;


                if (
                    item.category !==
                    currentCategory
                ) {

                    produkHtml += `

                        <p class="text-[11px] font-black text-red-600 uppercase tracking-wide mt-3 mb-1">
                            ${escapeHTML(
                                item.category
                            )}
                        </p>

                    `;


                    currentCategory =
                        item.category;

                }


                const subtotal =
                    qty *
                    safeNumber(
                        item.price,
                        0
                    );


                produkHtml += `

                    <div class="flex justify-between items-center py-1.5 text-sm">

                        <span class="text-gray-700">

                            ${escapeHTML(
                                item.name
                            )}

                            <span class="text-gray-400 font-semibold">
                                x${qty}
                            </span>

                        </span>


                        <span class="font-semibold text-gray-800">
                            Rp ${subtotal.toLocaleString('id-ID')}
                        </span>

                    </div>

                `;

            }
        );

    }


    contentEl.innerHTML = `

        <div>

            <p class="font-bold text-gray-800 mb-3">
                ${escapeHTML(
                    entry.tanggal ||
                    '-'
                )}
            </p>


            <div class="space-y-2">

                <div class="flex justify-between bg-gray-50 rounded-lg px-3 py-2">

                    <span class="text-xs font-semibold text-gray-500">
                        Total Omset
                    </span>

                    <span class="text-sm font-bold text-gray-800">
                        Rp ${total.toLocaleString('id-ID')}
                    </span>

                </div>


                <div class="flex justify-between bg-gray-50 rounded-lg px-3 py-2">

                    <span class="text-xs font-semibold text-gray-500">
                        QRIS
                    </span>

                    <span class="text-sm font-bold text-gray-800">
                        Rp ${qris.toLocaleString('id-ID')}
                    </span>

                </div>


                <div class="flex justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2">

                    <span class="text-xs font-bold text-red-700">
                        Setoran
                    </span>

                    <span class="text-sm font-black text-red-700">
                        Rp ${setoran.toLocaleString('id-ID')}
                    </span>

                </div>

            </div>


            ${
                adaProduk
                    ? `

                        <div class="mt-4">

                            <p class="text-xs font-black text-red-600 uppercase tracking-wide mb-2">
                                Penjualan
                            </p>

                            ${produkHtml}

                        </div>

                    `
                    : ''
            }


            ${
                entry.stock
                    ? buildStockArchiveHtml(
                        entry.stock
                    )
                    : ''
            }

        </div>

    `;

}


// ============================================================
// RENDER SEMUA
// ============================================================

function renderSemuaStock() {

    try {

        renderBahanBakuList();

    } catch (error) {

        console.error(
            '[STOCK] Error bahan baku:',
            error
        );

    }


    try {

        renderStokDikembalikan();

    } catch (error) {

        console.error(
            '[STOCK] Error pengembalian:',
            error
        );

    }


    try {

        renderRekonsiliasi();

    } catch (error) {

        console.error(
            '[STOCK] Error rekonsiliasi:',
            error
        );

    }


    try {

        renderTotalPengeluaran();

    } catch (error) {

        console.error(
            '[STOCK] Error total:',
            error
        );

    }

}


// ============================================================
// MODAL
// ============================================================

function bukaModalForm(
    title,
    bodyHtml
) {

    const titleEl =
        getElement(
            'modalFormTitle'
        );


    const bodyEl =
        getElement(
            'modalFormBody'
        );


    const modalEl =
        getElement(
            'modalForm'
        );


    if (
        !titleEl ||
        !bodyEl ||
        !modalEl
    ) {

        console.error(
            '[STOCK] Modal tidak ditemukan.'
        );

        return;

    }


    titleEl.innerText =
        safeString(
            title
        );


    bodyEl.innerHTML =
        safeString(
            bodyHtml
        );


    modalEl.classList.remove(
        'hidden'
    );

}


function tutupModalForm() {

    const modalEl =
        getElement(
            'modalForm'
        );


    if (modalEl) {

        modalEl.classList.add(
            'hidden'
        );

    }

}


// ============================================================
// GLOBAL EXPORT
// ============================================================

window.todayKey =
    todayKey;

window.getBahanById =
    getBahanById;

window.hitungStokUtama =
    hitungStokUtama;

window.hitungStokLapanganMentah =
    hitungStokLapanganMentah;

window.getJenisProdukList =
    getJenisProdukList;

window.getStokMasakHariIni =
    getStokMasakHariIni;

window.getPenjualanTercatat =
    getPenjualanTercatat;

window.getSisaFisik =
    getSisaFisik;

window.simpanSisaFisik =
    simpanSisaFisik;

window.ubahSisaFisik =
    ubahSisaFisik;

window.hitungPengeluaranHariIni =
    hitungPengeluaranHariIni;

window.hitungPemasukanHariIni =
    hitungPemasukanHariIni;

window.renderTotalPengeluaran =
    renderTotalPengeluaran;

window.copyLaporanStockToWA =
    copyLaporanStockToWA;

window.tambahBahanBaku =
    tambahBahanBaku;

window.bukaModalTambahBahan =
    bukaModalTambahBahan;

window.renderFormBahanBaku =
    renderFormBahanBaku;

window.submitTambahBahan =
    submitTambahBahan;

window.bukaModalStokMasuk =
    bukaModalStokMasuk;

window.submitStokMasuk =
    submitStokMasuk;

window.bukaModalStokKeluar =
    bukaModalStokKeluar;

window.submitStokKeluar =
    submitStokKeluar;

window.bukaModalMasak =
    bukaModalMasak;

window.prosesMasak =
    prosesMasak;

window.submitMasak =
    submitMasak;

window.bukaModalForm =
    bukaModalForm;

window.tutupModalForm =
    tutupModalForm;

window.hapusBahanBaku =
    hapusBahanBaku;

window.bukaModalRiwayatBahan =
    bukaModalRiwayatBahan;

window.refreshModalRiwayatBahan =
    refreshModalRiwayatBahan;

window.buildRiwayatBahanHtml =
    buildRiwayatBahanHtml;

window.hapusTransaksiBahan =
    hapusTransaksiBahan;

window.ubahStokDikembalikan =
    ubahStokDikembalikan;

window.getJumlahDikembalikanHariIni =
    getJumlahDikembalikanHariIni;

window.renderStokDikembalikan =
    renderStokDikembalikan;

window.tambahMappingRow =
tambahMappingRow;

window.hapusMappingRow =
    hapusMappingRow;

window.updateMappingRowJenis =
    updateMappingRowJenis;

window.updateMappingRowJumlah =
    updateMappingRowJumlah;

window.bukaModalMapping =
    bukaModalMapping;

window.refreshModalMapping =
    refreshModalMapping;

window.buildMappingHtml =
    buildMappingHtml;

window.renderBahanBakuList =
    renderBahanBakuList;

window.renderRekonsiliasi =
    renderRekonsiliasi;

window.renderSemuaStock =
    renderSemuaStock;

window.buildStockArchiveSnapshot =
    buildStockArchiveSnapshot;

window.buildStockArchiveHtml =
    buildStockArchiveHtml;

window.renderArsipList =
    renderArsipListTerpadu;

window.tampilkanDetailArsip =
    tampilkanDetailArsipTerpadu;


// ============================================================
// RESET UTAMA
// ============================================================
//
// Karena stock.js dimuat SETELAH script.js,
// fungsi resetData() yang dipanggil HTML akan memakai
// fungsi ini.
//
// ============================================================

window.resetData =
    resetDataTerpadu;


// ============================================================
// COPY LAPORAN STOCK
// ============================================================

function copyLaporanStockToWA() {

    const tanggal =
        todayKey();


    const masukHariIni =
        getTransaksiMasukTanggal(
            tanggal
        );


    const keluarHariIni =
        getTransaksiKeluarTanggal(
            tanggal
        );


    const masakHariIni =
        getTransaksiMasakTanggal(
            tanggal
        );


    if (
        masukHariIni.length === 0 &&
        keluarHariIni.length === 0 &&
        masakHariIni.length === 0
    ) {

        alert(
            'Belum ada transaksi stock hari ini.'
        );

        return;

    }


    let text =
        `*LAPORAN STOCK AYAM BOBBY*\n`;

    text +=
        `Tanggal: ${formatTanggalIndonesia(
            tanggal
        )}\n\n`;


    text +=
        `*RINGKASAN STOCK*\n`;


    bahanBakuList.forEach(
        bahan => {

            const beli =
                hitungPembelian(
                    bahan.id,
                    tanggal
                );


            const kembali =
                hitungPengembalian(
                    bahan.id,
                    tanggal
                );


            const keluar =
                hitungKeluar(
                    bahan.id,
                    tanggal
                );


            const masak =
                hitungMasakBahan(
                    bahan.id,
                    tanggal
                );


            const gudang =
                hitungStokUtama(
                    bahan.id
                );


            const lapangan =
                hitungStokLapanganMentah(
                    bahan.id,
                    tanggal
                );


            if (
                beli === 0 &&
                kembali === 0 &&
                keluar === 0 &&
                masak === 0
            ) {

                return;

            }


            text +=
                `\n*${bahan.nama}*\n`;

            text +=
                `Beli: +${beli} ${bahan.satuan}\n`;

            text +=
                `Kembali: +${kembali} ${bahan.satuan}\n`;

            text +=
                `Keluar: -${keluar} ${bahan.satuan}\n`;

            text +=
                `Masak: ${masak} ${bahan.satuan}\n`;

            text +=
                `Gudang: ${gudang} ${bahan.satuan}\n`;

            text +=
                `Lapangan: ${lapangan} ${bahan.satuan}\n`;

        }
    );


    navigator.clipboard
        .writeText(
            text
        )
        .then(
            () => {

                alert(
                    'Laporan stock sudah disalin.'
                );

            }
        )
        .catch(
            () => {

                fallbackCopyText(
                    text
                );

            }
        );

}


function fallbackCopyText(
    text
) {

    try {

        const textarea =
            document.createElement(
                'textarea'
            );


        textarea.value =
            text;


        textarea.style.position =
            'fixed';

        textarea.style.opacity =
            '0';


        document.body.appendChild(
            textarea
        );


        textarea.select();


        document.execCommand(
            'copy'
        );


        textarea.remove();


        alert(
            'Laporan stock sudah disalin.'
        );

    } catch (error) {

        console.error(
            '[STOCK] Copy error:',
            error
        );


        alert(
            'Gagal menyalin laporan.'
        );

    }

}


window.copyLaporanStockToWA =
    copyLaporanStockToWA;


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        try {

            // Pastikan semua bahan sudah memiliki saldo.
            bahanBakuList.forEach(
                bahan => {

                    ensureSaldoBahan(
                        bahan.id
                    );

                }
            );


            simpanSaldoGudang();


            renderSemuaStock();


            renderArsipListTerpadu();

        } catch (error) {

            console.error(
                '[STOCK] Initialization error:',
                error
            );

        }

    }
);