// ============================================================
// STOCK.JS - MONITORING & REKONSILIASI STOK AYAM BOBBY
// ============================================================

// ==============================
// STORAGE KEY
// ==============================

const SK_BAHAN = 'bobby_bahan_baku';
const SK_MASUK = 'bobby_stok_masuk';
const SK_KELUAR = 'bobby_stok_keluar';
const SK_MASAK = 'bobby_stok_masak';
const SK_MAPPING = 'bobby_produk_mapping';
const SK_SISA_FISIK = 'bobby_sisa_fisik';


// ==============================
// HELPER JSON
// ==============================

function loadJSON(key, fallback) {

    try {

        const v = JSON.parse(
            localStorage.getItem(key)
        );

        return v === null || v === undefined
            ? fallback
            : v;

    } catch (e) {

        return fallback;

    }

}


function saveJSON(key, val) {

    localStorage.setItem(
        key,
        JSON.stringify(val)
    );

}


// ==============================
// DATA
// ==============================

let bahanBakuList =
    loadJSON(SK_BAHAN, []);

let stokMasukList =
    loadJSON(SK_MASUK, []);

let stokKeluarList =
    loadJSON(SK_KELUAR, []);

let stokMasakList =
    loadJSON(SK_MASAK, []);

let produkMapping =
    loadJSON(SK_MAPPING, {});

let sisaFisikHarian =
    loadJSON(SK_SISA_FISIK, {});


// ==============================
// AYAM KEMBALI
// ==============================

let ayamKembali =
    Number(
        localStorage.getItem(
            'bobby_ayam_kembali'
        )
    ) || 0;


// ==============================
// NORMALISASI MAPPING LAMA
// ==============================

Object.keys(produkMapping).forEach(k => {

    if (
        produkMapping[k] &&
        !Array.isArray(produkMapping[k])
    ) {

        produkMapping[k] =
            [produkMapping[k]];

    }

});


let tempResep = [];


// ==============================
// TANGGAL
// ==============================

function todayKey() {

    const d = new Date();

    const y =
        d.getFullYear();

    const m =
        String(
            d.getMonth() + 1
        ).padStart(2, '0');

    const day =
        String(
            d.getDate()
        ).padStart(2, '0');

    return `${y}-${m}-${day}`;

}


// ==============================
// AYAM UTUH DIKEMBALIKAN
// ==============================

function ubahAyamKembali(change) {

    const bahanAyam =
        bahanBakuList.find(b =>
            String(b.nama)
                .toLowerCase()
                .trim() === 'ayam'
        );


    if (!bahanAyam) {

        alert(
            'Bahan baku "Ayam" belum ditemukan. Tambahkan bahan baku Ayam terlebih dahulu.'
        );

        return;

    }


    // ==========================================
    // TAMBAH AYAM KEMBALI KE GUDANG
    // ==========================================

    if (change > 0) {

        const jumlah =
            Number(change);


        // Cek stok lapangan TERBARU
        const stokLapangan =
            hitungStokLapanganMentah(
                bahanAyam.id
            );


        // Tidak boleh mengembalikan lebih
        // dari stok yang ada di lapangan
        if (
            jumlah > stokLapangan
        ) {

            alert(
                `Stok ayam di lapangan cuma ${stokLapangan} ekor.`
            );

            return;

        }


        // Simpan transaksi pengembalian
        stokMasukList.push({

            id:
                'return_' +
                Date.now(),

            bahanBakuId:
                bahanAyam.id,

            jumlah:
                jumlah,

            tanggal:
                todayKey(),

            harga:
                0,

            catatan:
                'Ayam utuh dikembalikan dari lapangan',

            tipe:
                'pengembalian',

            timestamp:
                new Date().toISOString()

        });


        saveJSON(
            SK_MASUK,
            stokMasukList
        );


        // Update counter ayam kembali
        ayamKembali += jumlah;


        localStorage.setItem(
            'bobby_ayam_kembali',
            ayamKembali
        );


        // LANGSUNG UPDATE SEMUA INDIKATOR
        renderAyamKembali();

        renderSemuaStock();

        renderTotalPengeluaran();


        return;

    }


    // ==========================================
    // KURANGI AYAM KEMBALI
    // ==========================================

    if (change < 0) {

        const jumlahKurang =
            Math.abs(
                Number(change)
            );


        if (
            ayamKembali <= 0
        ) {

            return;

        }


        const jumlahHapus =
            Math.min(
                jumlahKurang,
                ayamKembali
            );


        let sisaHapus =
            jumlahHapus;


        // Hapus transaksi pengembalian
        // yang paling baru terlebih dahulu
        for (
            let i =
                stokMasukList.length - 1;

            i >= 0 &&
            sisaHapus > 0;

            i--
        ) {

            const x =
                stokMasukList[i];


            if (
                x.tipe ===
                    'pengembalian' &&

                x.bahanBakuId ===
                    bahanAyam.id
            ) {

                const ambil =
                    Math.min(
                        Number(
                            x.jumlah || 0
                        ),
                        sisaHapus
                    );


                x.jumlah -=
                    ambil;


                sisaHapus -=
                    ambil;


                if (
                    x.jumlah <= 0
                ) {

                    stokMasukList.splice(
                        i,
                        1
                    );

                }

            }

        }


        ayamKembali -=
            jumlahHapus;


        if (
            ayamKembali < 0
        ) {

            ayamKembali = 0;

        }


        localStorage.setItem(
            'bobby_ayam_kembali',
            ayamKembali
        );


        saveJSON(
            SK_MASUK,
            stokMasukList
        );


        // LANGSUNG UPDATE
        renderAyamKembali();

        renderSemuaStock();

        renderTotalPengeluaran();

    }

}


// ==============================
// RENDER AYAM KEMBALI
// ==============================

function renderAyamKembali() {

    const el =
        document.getElementById(
            'jumlahAyamKembali'
        );


    if (!el) return;


    el.innerText =
        ayamKembali +
        ' Ekor';

}


// ==============================
// PERHITUNGAN STOK UTAMA / GUDANG
// ==============================

function hitungStokUtama(
    bahanBakuId
) {

    // Semua stok masuk
    // termasuk pengembalian
    const masuk =
        stokMasukList
            .filter(x =>
                x.bahanBakuId ===
                bahanBakuId
            )
            .reduce(
                (s, x) =>
                    s +
                    Number(
                        x.jumlah || 0
                    ),
                0
            );


    // Semua stok keluar
    const keluar =
        stokKeluarList
            .filter(x =>
                x.bahanBakuId ===
                bahanBakuId
            )
            .reduce(
                (s, x) =>
                    s +
                    Number(
                        x.jumlah || 0
                    ),
                0
            );


    return masuk - keluar;

}


// ==============================
// STOK LAPANGAN
// ==============================
//
// RUMUS:
//
// Stok Lapangan
// = Stok Keluar
// - Stok yang sudah dimasak
// - Stok yang dikembalikan
//
// Contoh:
//
// Keluar       = 2
// Masak        = 0
// Kembali      = 1
// ----------------
// Lapangan     = 1
//
// Kalau kembali 1 lagi:
//
// Keluar       = 2
// Masak        = 0
// Kembali      = 2
// ----------------
// Lapangan     = 0
//
// ==============================

function hitungStokLapanganMentah(
    bahanBakuId
) {

    // ==========================================
    // TOTAL STOK KELUAR KE LAPANGAN
    // ==========================================

    const keluar =
        stokKeluarList
            .filter(x =>
                x.bahanBakuId ===
                bahanBakuId
            )
            .reduce(
                (s, x) =>
                    s +
                    Number(
                        x.jumlah || 0
                    ),
                0
            );


    // ==========================================
    // TOTAL YANG SUDAH DIPROSES / DIMASAK
    // ==========================================

    const dimasak =
        stokMasakList
            .filter(x =>
                x.bahanBakuId ===
                bahanBakuId
            )
            .reduce(
                (s, x) =>
                    s +
                    Number(
                        x.jumlahDiproses || 0
                    ),
                0
            );


    // ==========================================
    // TOTAL YANG DIKEMBALIKAN KE GUDANG
    // ==========================================

    const dikembalikan =
        stokMasukList
            .filter(x =>
                x.bahanBakuId ===
                    bahanBakuId &&

                x.tipe ===
                    'pengembalian'
            )
            .reduce(
                (s, x) =>
                    s +
                    Number(
                        x.jumlah || 0
                    ),
                0
            );


    // ==========================================
    // RUMUS FINAL
    // ==========================================

    const hasil =
        keluar -
        dimasak -
        dikembalikan;


    // Jangan pernah tampilkan minus
    return Math.max(
        0,
        hasil
    );

}


// ==============================
// JENIS PRODUK
// ==============================

function getJenisProdukList() {

    const set =
        new Set();


    bahanBakuList.forEach(b => {

        (b.resepKonversi || [])
            .forEach(r => {

                if (
                    r.jenisProduk
                ) {

                    set.add(
                        r.jenisProduk
                    );

                }

            });

    });


    return Array.from(set);

}


// ==============================
// STOK MASAK HARI INI
// ==============================

function getStokMasakHariIni(
    jenisProduk,
    tanggal
) {

    tanggal =
        tanggal ||
        todayKey();


    let total = 0;


    stokMasakList
        .filter(m =>
            m.tanggal ===
            tanggal
        )
        .forEach(m => {

            (m.hasil || [])
                .forEach(h => {

                    if (
                        h.jenisProduk ===
                        jenisProduk
                    ) {

                        total +=
                            Number(
                                h.jumlah || 0
                            );

                    }

                });

        });


    return total;

}


// ==============================
// PENJUALAN
// ==============================

function getPenjualanTercatat(
    jenisProduk
) {

    let total = 0;


    if (
        typeof state !==
            'undefined' &&

        state &&

        state.items
    ) {

        Object.keys(
            state.items
        )
            .forEach(menuId => {

                const rows =
                    produkMapping[
                        menuId
                    ] || [];


                rows.forEach(row => {

                    if (
                        row.jenisProduk ===
                        jenisProduk
                    ) {

                        total +=
                            (
                                state.items[
                                    menuId
                                ] || 0
                            ) *
                            (
                                row.jumlahPerPorsi ||
                                1
                            );

                    }

                });

            });

    }


    return total;

}


// ==============================
// SISA FISIK
// ==============================

function getSisaFisik(
    jenisProduk
) {

    const key =
        todayKey();


    const val =
        sisaFisikHarian[key]
            ? sisaFisikHarian[key][jenisProduk]
            : undefined;


    return (
        val === undefined ||
        val === null
    )
        ? ''
        : val;

}


function simpanSisaFisik(
    jenisProduk,
    jumlah
) {

    const key =
        todayKey();


    if (
        !sisaFisikHarian[key]
    ) {

        sisaFisikHarian[key] =
            {};

    }


    sisaFisikHarian[key][jenisProduk] =
        jumlah;


    saveJSON(
        SK_SISA_FISIK,
        sisaFisikHarian
    );

}


// ==============================
// PENGELUARAN HARI INI
// ==============================

function hitungPengeluaranHariIni() {

    const tanggal =
        todayKey();


    return stokMasukList
        .filter(x =>
            x.tanggal ===
                tanggal &&

            x.tipe !==
                'pengembalian'
        )
        .reduce(
            (s, x) =>
                s +
                (
                    Number(
                        x.jumlah || 0
                    ) *
                    Number(
                        x.harga || 0
                    )
                ),
            0
        );

}


// ==============================
// PEMASUKAN KASIR
// ==============================

function hitungPemasukanHariIni() {

    let total = 0;


    if (
        typeof state !==
            'undefined' &&

        state &&

        state.items &&

        typeof menuData !==
            'undefined'
    ) {

        Object.keys(
            state.items
        )
            .forEach(menuId => {

                const qty =
                    state.items[
                        menuId
                    ];


                const menu =
                    menuData.find(
                        m =>
                            m.id ===
                            menuId
                    );


                if (
                    menu &&
                    qty > 0
                ) {

                    total +=
                        qty *
                        (
                            menu.price ||
                            0
                        );

                }

            });

    }


    return total;

}


// ==============================
// TOTAL PENGELUARAN / PEMASUKAN
// ==============================

function renderTotalPengeluaran() {

    const el =
        document.getElementById(
            'totalPengeluaranStock'
        );


    if (!el) return;


    const pengeluaran =
        hitungPengeluaranHariIni();


    const pemasukan =
        hitungPemasukanHariIni();


    const selisih =
        pemasukan -
        pengeluaran;


    const warnaSelisih =
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

        <span class="font-bold ${warnaSelisih}">
            Selisih:
            Rp ${selisih.toLocaleString('id-ID')}
        </span>

    `;

}


// ==============================
// LAPORAN WHATSAPP
// ==============================

function copyLaporanStockToWA() {

    const tanggal =
        todayKey();


    const tanggalEl =
        document.getElementById(
            'tanggalHariIni'
        );


    const tanggalDisplay =
        tanggalEl
            ? tanggalEl.innerText
            : tanggal;


    const masukHariIni =
        stokMasukList.filter(
            x =>
                x.tanggal ===
                tanggal
        );


    const keluarHariIni =
        stokKeluarList.filter(
            x =>
                x.tanggal ===
                tanggal
        );


    if (
        masukHariIni.length === 0 &&
        keluarHariIni.length === 0
    ) {

        alert(
            'Belum ada transaksi stok hari ini.'
        );

        return;

    }


    let text =
        `*LAPORAN STOK AYAM BOBBY*\n` +
        `Tanggal: ${tanggalDisplay}\n`;


    let totalPengeluaran = 0;


    // ==========================
    // STOK MASUK
    // ==========================

    const pembelian =
        masukHariIni.filter(
            x =>
                x.tipe !==
                'pengembalian'
        );


    if (
        pembelian.length > 0
    ) {

        text +=
            `\n*STOK MASUK / PEMBELIAN*\n`;


        pembelian.forEach(x => {

            const bahan =
                bahanBakuList.find(
                    b =>
                        b.id ===
                        x.bahanBakuId
                );


            const namaBahan =
                bahan
                    ? bahan.nama
                    : '(bahan sudah dihapus)';


            const satuan =
                bahan
                    ? bahan.satuan
                    : '';


            const subtotal =
                Number(
                    x.jumlah || 0
                ) *
                Number(
                    x.harga || 0
                );


            totalPengeluaran +=
                subtotal;


            const hargaText =
                x.harga
                    ? ` @Rp${Number(x.harga).toLocaleString('id-ID')} = Rp${subtotal.toLocaleString('id-ID')}`
                    : ' (harga belum diisi)';


            text +=
                `- ${namaBahan} x${x.jumlah} ${satuan}` +
                `${hargaText}` +
                `${
                    x.catatan
                        ? ' — ' + x.catatan
                        : ''
                }\n`;

        });

    }


    // ==========================
    // AYAM DIKEMBALIKAN
    // ==========================

    const pengembalianHariIni =
        masukHariIni.filter(
            x =>
                x.tipe ===
                'pengembalian'
        );


    if (
        pengembalianHariIni.length > 0
    ) {

        text +=
            `\n*AYAM UTUH DIKEMBALIKAN DARI LAPANGAN*\n`;


        pengembalianHariIni.forEach(x => {

            const bahan =
                bahanBakuList.find(
                    b =>
                        b.id ===
                        x.bahanBakuId
                );


            const namaBahan =
                bahan
                    ? bahan.nama
                    : 'Ayam';


            const satuan =
                bahan
                    ? bahan.satuan
                    : 'ekor';


            text +=
                `- ${namaBahan} x${x.jumlah} ${satuan} → masuk kembali ke gudang\n`;

        });

    }


    // ==========================
    // STOK KELUAR
    // ==========================

    if (
        keluarHariIni.length > 0
    ) {

        text +=
            `\n*STOK KELUAR KE LAPANGAN*\n`;


        keluarHariIni.forEach(x => {

            const bahan =
                bahanBakuList.find(
                    b =>
                        b.id ===
                        x.bahanBakuId
                );


            const namaBahan =
                bahan
                    ? bahan.nama
                    : '(bahan sudah dihapus)';


            const satuan =
                bahan
                    ? bahan.satuan
                    : '';


            text +=
                `- ${namaBahan} x${x.jumlah} ${satuan}` +
                `${
                    x.catatan
                        ? ' — ' + x.catatan
                        : ''
                }\n`;

        });

    }


    // ==========================
    // TOTAL UANG
    // ==========================

    const pemasukan =
        hitungPemasukanHariIni();


    const selisih =
        pemasukan -
        totalPengeluaran;


    const statusDuit =
        selisih >= 0
            ? 'LABA / PLUS'
            : 'RUGI / NOMBOK';


    text +=
        `\n------------------\n`;


    text +=
        `*TOTAL BELI BAHAN: Rp ${totalPengeluaran.toLocaleString('id-ID')}*\n`;


    text +=
        `*TOTAL PENJUALAN: Rp ${pemasukan.toLocaleString('id-ID')}*\n`;


    text +=
        `*SELISIH (${statusDuit}): Rp ${selisih.toLocaleString('id-ID')}*`;


    navigator.clipboard
        .writeText(text)
        .then(() => {

            alert(
                'Mantap! Laporan stok sudah disalin, tinggal paste ke WA.'
            );

        })
        .catch(err => {

            console.error(
                'Gagal copy text:',
                err
            );


            alert(
                'Gagal menyalin otomatis. Silakan coba lagi.'
            );

        });

}


// ==============================
// TAMBAH BAHAN BAKU
// ==============================

function tambahBahanBaku(
    nama,
    satuan,
    resepKonversiArr
) {

    const id =
        'bb_' + Date.now();


    bahanBakuList.push({

        id,

        nama,

        satuan,

        resepKonversi:
            resepKonversiArr || []

    });


    saveJSON(
        SK_BAHAN,
        bahanBakuList
    );


    renderSemuaStock();

}


// ==============================
// STOK MASUK
// ==============================

function submitStokMasuk(
    bahanBakuId
) {

    const jumlah =
        Number(
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
        Number(
            document.getElementById(
                'inputHargaMasuk'
            ).value
        ) || 0;


    const catatan =
        document.getElementById(
            'inputCatatanMasuk'
        ).value.trim();


    if (
        !jumlah ||
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
            Date.now(),

        bahanBakuId,

        jumlah,

        tanggal,

        harga,

        catatan,

        tipe:
            'pembelian',

        timestamp:
            new Date().toISOString()

    });


    saveJSON(
        SK_MASUK,
        stokMasukList
    );


    renderSemuaStock();

    renderTotalPengeluaran();

    tutupModalForm();

}


// ==============================
// STOK KELUAR
// ==============================

function submitStokKeluar(
    bahanBakuId
) {

    const jumlah =
        Number(
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


    const tersedia =
        hitungStokUtama(
            bahanBakuId
        );


    if (
        !jumlah ||
        jumlah <= 0
    ) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;

    }


    if (
        jumlah > tersedia
    ) {

        alert(
            `Stok gudang cuma tersedia ${tersedia}. Gak bisa keluar lebih dari itu.`
        );

        return;

    }


    stokKeluarList.push({

        id:
            'out_' +
            Date.now(),

        bahanBakuId,

        jumlah,

        tanggal,

        catatan,

        timestamp:
            new Date().toISOString()

    });


    saveJSON(
        SK_KELUAR,
        stokKeluarList
    );


    renderSemuaStock();

    tutupModalForm();

}


// ==============================
// PROSES MASAK
// ==============================

function prosesMasak(
    bahanBakuId,
    jumlahDiproses,
    tanggal
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id ===
                bahanBakuId
        );


    if (!bahan) return;


    const tersedia =
        hitungStokLapanganMentah(
            bahanBakuId
        );


    if (
        jumlahDiproses >
        tersedia
    ) {

        alert(
            `Stok lapangan ${bahan.nama} cuma tersisa ${tersedia} ${bahan.satuan}.`
        );

        return;

    }


    const hasil =
        (bahan.resepKonversi || [])
            .map(r => ({

                jenisProduk:
                    r.jenisProduk,

                jumlah:
                    r.jumlahPerUnit *
                    jumlahDiproses

            }));


    stokMasakList.push({

        id:
            'sm_' +
            Date.now(),

        bahanBakuId,

        jumlahDiproses,

        tanggal:
            tanggal ||
            todayKey(),

        timestamp:
            new Date().toISOString(),

        hasil

    });


    saveJSON(
        SK_MASAK,
        stokMasakList
    );


    renderSemuaStock();

}


// ==============================
// SUBMIT MASAK
// ==============================

function submitMasak(
    bahanBakuId
) {

    const jumlah =
        Number(
            document.getElementById(
                'inputJumlahMasak'
            ).value
        );


    const tanggal =
        document.getElementById(
            'inputTanggalMasak'
        ).value ||
        todayKey();


    if (
        !jumlah ||
        jumlah <= 0
    ) {

        alert(
            'Jumlah harus diisi dan lebih dari 0.'
        );

        return;

    }


    prosesMasak(
        bahanBakuId,
        jumlah,
        tanggal
    );


    tutupModalForm();

}


// ==============================
// MAPPING PRODUK
// ==============================

function tambahMappingRow(
    menuItemId
) {

    if (
        !produkMapping[menuItemId]
    ) {

        produkMapping[menuItemId] =
            [];

    }


    produkMapping[menuItemId].push({

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

    produkMapping[
        menuItemId
    ].splice(
        index,
        1
    );


    if (
        produkMapping[
            menuItemId
        ].length === 0
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

    produkMapping[
        menuItemId
    ][index].jenisProduk =
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

    produkMapping[
        menuItemId
    ][index].jumlahPerPorsi =
        Number(jumlah) || 1;


    saveJSON(
        SK_MAPPING,
        produkMapping
    );


    renderRekonsiliasi();

}


// ==============================
// SISA FISIK
// ==============================

function ubahSisaFisik(
    jenis,
    jumlah
) {

    simpanSisaFisik(
        jenis,
        jumlah === ''
            ? ''
            : Number(jumlah)
    );


    renderRekonsiliasi();

}


// ==============================
// MODAL
// ==============================

function bukaModalForm(
    title,
    bodyHtml
) {

    document.getElementById(
        'modalFormTitle'
    ).innerText =
        title;


    document.getElementById(
        'modalFormBody'
    ).innerHTML =
        bodyHtml;


    document.getElementById(
        'modalForm'
    ).classList.remove(
        'hidden'
    );

}


function tutupModalForm() {

    document.getElementById(
        'modalForm'
    ).classList.add(
        'hidden'
    );

}


// ==============================
// HAPUS BAHAN BAKU
// ==============================

function hapusBahanBaku(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id ===
                bahanBakuId
        );


    if (!bahan) return;


    if (
        !confirm(
            `Yakin mau hapus bahan baku "${bahan.nama}"? Semua riwayat stok masuk, keluar, dan masak yang terkait bahan ini juga akan ikut terhapus. Tindakan ini gak bisa dibatalkan.`
        )
    ) {

        return;

    }


    bahanBakuList =
        bahanBakuList.filter(
            b =>
                b.id !==
                bahanBakuId
        );


    stokMasukList =
        stokMasukList.filter(
            x =>
                x.bahanBakuId !==
                bahanBakuId
        );


    stokKeluarList =
        stokKeluarList.filter(
            x =>
                x.bahanBakuId !==
                bahanBakuId
        );


    stokMasakList =
        stokMasakList.filter(
            x =>
                x.bahanBakuId !==
                bahanBakuId
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


    renderSemuaStock();

}


// ==============================
// RIWAYAT BAHAN
// ==============================

function bukaModalRiwayatBahan(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id ===
                bahanBakuId
        );


    if (!bahan) return;


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
                b.id ===
                bahanBakuId
        );


    if (!bahan) {

        return `
            <p class="text-xs text-gray-400 text-center py-6">
                Bahan baku tidak ditemukan.
            </p>
        `;

    }


    const masuk =
        stokMasukList
            .filter(
                x =>
                    x.bahanBakuId ===
                    bahanBakuId
            )
            .map(
                x => ({

                    ...x,

                    tipe:
                        x.tipe ===
                        'pengembalian'
                            ? 'pengembalian'
                            : 'masuk'

                })
            );


    const keluar =
        stokKeluarList
            .filter(
                x =>
                    x.bahanBakuId ===
                    bahanBakuId
            )
            .map(
                x => ({

                    ...x,

                    tipe:
                        'keluar'

                })
            );


    const masak =
        stokMasakList
            .filter(
                x =>
                    x.bahanBakuId ===
                    bahanBakuId
            )
            .map(
                x => ({

                    ...x,

                    tipe:
                        'masak',

                    jumlah:
                        x.jumlahDiproses

                })
            );


    const semua = [
        ...masuk,
        ...keluar,
        ...masak
    ].sort(
        (a, b) =>
            new Date(
                b.timestamp
            ) -
            new Date(
                a.timestamp
            )
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


    return semua
        .map(x => {

            let warna;

            let label;

            let tanda;


            if (
                x.tipe ===
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
                x.tipe ===
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
                x.tipe ===
                'keluar'
            ) {

                warna =
                    'text-orange-500';

                label =
                    'Keluar';

                tanda =
                    '-';

            }

            else {

                warna =
                    'text-red-600';

                label =
                    'Masak';

                tanda =
                    '-';

            }


            return `

                <div class="flex justify-between items-center py-2 border-b border-gray-50 text-sm">

                    <div>

                        <p class="font-semibold text-gray-700">

                            ${label}

                            <span class="${warna} font-bold">

                                ${tanda}${x.jumlah}
                                ${bahan.satuan}

                            </span>

                        </p>


                        <p class="text-[11px] text-gray-400">

                            ${x.tanggal}

                            ${
                                x.catatan
                                    ? ' · ' +
                                      x.catatan
                                    : ''
                            }

                        </p>

                    </div>


                    <button
                        onclick="hapusTransaksiBahan(
                            '${bahanBakuId}',
                            '${x.tipe}',
                            '${x.id}'
                        )"
                        class="text-red-500 font-bold text-xs px-2 shrink-0"
                    >
                        Hapus
                    </button>

                </div>

            `;

        })
        .join('');

}


// ==============================
// HAPUS TRANSAKSI
// ==============================

function hapusTransaksiBahan(
    bahanBakuId,
    tipe,
    id
) {

    if (
        !confirm(
            'Hapus transaksi ini?'
        )
    ) return;


    if (
        tipe === 'masuk' ||
        tipe === 'pengembalian'
    ) {

        const target =
            stokMasukList.find(
                x =>
                    x.id ===
                    id
            );


        // Kalau pengembalian
        if (
            target &&
            target.tipe ===
                'pengembalian'
        ) {

            ayamKembali -=
                Number(
                    target.jumlah || 0
                );


            if (
                ayamKembali < 0
            ) {

                ayamKembali = 0;

            }


            localStorage.setItem(
                'bobby_ayam_kembali',
                ayamKembali
            );

        }


        stokMasukList =
            stokMasukList.filter(
                x =>
                    x.id !==
                    id
            );


        saveJSON(
            SK_MASUK,
            stokMasukList
        );

    }


    else if (
        tipe === 'keluar'
    ) {

        stokKeluarList =
            stokKeluarList.filter(
                x =>
                    x.id !==
                    id
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
                x =>
                    x.id !==
                    id
            );


        saveJSON(
            SK_MASAK,
            stokMasakList
        );

    }


    refreshModalRiwayatBahan(
        bahanBakuId
    );


    renderAyamKembali();

    renderSemuaStock();

    renderTotalPengeluaran();

}


// ==============================
// FORM TAMBAH BAHAN
// ==============================

function bukaModalTambahBahan() {

    tempResep = [];

    renderFormBahanBaku();

}


function renderFormBahanBaku() {

    const resepRowsHtml =
        tempResep
            .map(
                (r, i) => `

                <div class="flex gap-2 mb-2 items-center">

                    <input
                        type="text"
                        value="${r.jenisProduk}"
                        onchange="tempResep[${i}].jenisProduk=this.value"
                        placeholder="Nama potongan (mis: Dada)"
                        class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    >

                    <input
                        type="number"
                        min="0"
                        value="${r.jumlahPerUnit}"
                        onchange="tempResep[${i}].jumlahPerUnit=Number(this.value)"
                        placeholder="Jml"
                        class="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    >

                    <button
                        onclick="tempResep.splice(${i},1); renderFormBahanBaku();"
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

            <label class="text-xs font-bold text-gray-500 block mb-1">
                Konversi Hasil Olahan (opsional)
            </label>


            <p class="text-[11px] text-gray-400 mb-2">

                Isi kalau bahan ini diproses/dimasak
                menjadi beberapa jenis potongan.

                Contoh:
                1 ekor ayam jadi 4 dada,
                2 sayap, dst.

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


        <button
            onclick="submitTambahBahan()"
            class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            Simpan Bahan Baku
        </button>

    `;


    bukaModalForm(
        'Tambah Bahan Baku',
        html
    );

}


function submitTambahBahan() {

    const nama =
        document.getElementById(
            'inputNamaBahan'
        ).value.trim();


    const satuan =
        document.getElementById(
            'inputSatuanBahan'
        ).value.trim();


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
        tempResep.filter(
            r =>
                r.jenisProduk &&
                r.jenisProduk.trim() !== '' &&
                r.jumlahPerUnit > 0
        );


    tambahBahanBaku(
        nama,
        satuan,
        resepValid
    );


    tutupModalForm();

}


// ==============================
// FORM STOK MASUK
// ==============================

function bukaModalStokMasuk(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id ===
                bahanBakuId
        );


    if (!bahan) return;


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
                Harga per ekor
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
                Catatan (opsional)
            </label>

            <input
                id="inputCatatanMasuk"
                type="text"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <button
            onclick="submitStokMasuk('${bahanBakuId}')"
            class="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            Simpan Stok Masuk
        </button>

    `;


    bukaModalForm(
        'Catat Stok Masuk',
        html
    );

}


// ==============================
// FORM STOK KELUAR
// ==============================

function bukaModalStokKeluar(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id ===
                bahanBakuId
        );


    if (!bahan) return;


    const tersedia =
        hitungStokUtama(
            bahanBakuId
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
                ${tersedia} ${bahan.satuan}
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
                Catatan (opsional)
            </label>

            <input
                id="inputCatatanKeluar"
                type="text"
                placeholder="Contoh: dibawa ke gerobak/lapangan"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >

        </div>


        <button
            onclick="submitStokKeluar('${bahanBakuId}')"
            class="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-2"
        >
            Simpan Stok Keluar
        </button>

    `;


    bukaModalForm(
        'Catat Stok Keluar',
        html
    );

}


// ==============================
// FORM MASAK
// ==============================

function bukaModalMasak(
    bahanBakuId
) {

    const bahan =
        bahanBakuList.find(
            b =>
                b.id ===
                bahanBakuId
        );


    if (!bahan) return;


    const tersedia =
        hitungStokLapanganMentah(
            bahanBakuId
        );


    const resepHtml =
        (bahan.resepKonversi || [])
            .map(
                r =>
                    `<p class="text-[11px] text-gray-500">
                        ${r.jumlahPerUnit}
                        ${r.jenisProduk}
                        /
                        ${bahan.satuan}
                    </p>`
            )
            .join('');


    const html = `

        <p class="text-sm font-bold text-gray-800 mb-1">
            ${bahan.nama}
        </p>


        <p class="text-[11px] text-gray-400 mb-2">

            Stok lapangan:

            <span class="font-bold text-gray-700">
                ${tersedia} ${bahan.satuan}
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
            onclick="submitMasak('${bahanBakuId}')"
            class="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-2"
        >
            Proses & Simpan
        </button>

    `;


    bukaModalForm(
        'Proses Masak',
        html
    );

}


// ==============================
// FORM MAPPING
// ==============================

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
            </p>
            `
        );

        return;

    }


    if (
        typeof menuData ===
            'undefined' ||
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
        buildMappingHtml(
            jenisOptions
        )
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
                    produkMapping[
                        item.id
                    ] || [];


                const rowsHtml =
                    mappingRows
                        .map(
                            (
                                row,
                                idx
                            ) => {

                                const options =
                                    [
                                        '<option value="">- pilih jenis -</option>'
                                    ]
                                        .concat(
                                            jenisOptions
                                                .map(
                                                    j =>
                                                        `<option value="${j}" ${
                                                            row.jenisProduk === j
                                                                ? 'selected'
                                                                : ''
                                                        }>
                                                            ${j}
                                                        </option>`
                                                )
                                        )
                                        .join('');


                                return `

                                    <div class="flex gap-2 mb-1.5 items-center">

                                        <select
                                            onchange="updateMappingRowJenis('${item.id}', ${idx}, this.value)"
                                            class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                                        >
                                            ${options}
                                        </select>


                                        <input
                                            type="number"
                                            min="1"
                                            value="${row.jumlahPerPorsi}"
                                            onchange="updateMappingRowJumlah('${item.id}', ${idx}, this.value)"
                                            class="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                                            placeholder="Qty"
                                        >


                                        <button
                                            onclick="hapusMappingRow('${item.id}', ${idx})"
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
                            '<p class="text-[11px] text-gray-300 mb-1">Belum dipetakan</p>'
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

            Tentuin tiap menu di kasir itu
            jual jenis potongan apa dan berapa
            pcs per porsi.

        </p>

        ${rows}

    `;

}


// ==============================
// RENDER BAHAN BAKU
// ==============================

function renderBahanBakuList() {

    const container =
        document.getElementById(
            'listBahanBaku'
        );


    if (!container) return;


    if (
        bahanBakuList.length === 0
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
            .map(b => {

                const stokUtama =
                    hitungStokUtama(
                        b.id
                    );


                const stokLapangan =
                    hitungStokLapanganMentah(
                        b.id
                    );


                const bisaMasak =
                    b.resepKonversi &&
                    b.resepKonversi.length >
                    0;


                return `

                    <div class="bg-white rounded-xl border border-gray-100 p-3">

                        <div class="flex justify-between items-start mb-2">

                            <div>

                                <p class="font-bold text-sm text-gray-800">
                                    ${b.nama}
                                </p>


                                <p class="text-[11px] text-gray-400">

                                    Stok Gudang:

                                    <span class="font-bold text-gray-700">
                                        ${stokUtama}
                                        ${b.satuan}
                                    </span>


                                    &middot;


                                    Stok Lapangan:

                                    <span class="font-bold text-gray-700">
                                        ${stokLapangan}
                                        ${b.satuan}
                                    </span>

                                </p>

                            </div>


                            <div class="flex items-center gap-1 shrink-0">

                                <button
                                    onclick="bukaModalRiwayatBahan('${b.id}')"
                                    title="Riwayat transaksi"
                                    class="w-7 h-7 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 text-xs"
                                >
                                    📜
                                </button>


                                <button
                                    onclick="hapusBahanBaku('${b.id}')"
                                    title="Hapus bahan baku"
                                    class="w-7 h-7 flex items-center justify-center bg-red-50 rounded-full text-red-500 text-xs"
                                >
                                    🗑
                                </button>

                            </div>

                        </div>


                        <div class="flex gap-2">

                            <button
                                onclick="bukaModalStokMasuk('${b.id}')"
                                class="flex-1 text-[11px] font-bold py-1.5 rounded-full bg-green-50 text-green-700"
                            >
                                + Masuk
                            </button>


                            <button
                                onclick="bukaModalStokKeluar('${b.id}')"
                                class="flex-1 text-[11px] font-bold py-1.5 rounded-full bg-orange-50 text-orange-700"
                            >
                                - Keluar
                            </button>


                            ${
                                bisaMasak
                                    ? `
                                    <button
                                        onclick="bukaModalMasak('${b.id}')"
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

            })
            .join('');

}


// ==============================
// REKONSILIASI
// ==============================

function renderRekonsiliasi() {

    const tbody =
        document.getElementById(
            'tabelRekonsiliasi'
        );


    if (!tbody) return;


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


    const rows =
        jenisList
            .map(jenis => {

                const masak =
                    getStokMasakHariIni(
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
                        : Number(
                            fisikVal
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

                    totalFisik +=
                        fisik;


                    totalSelisih +=
                        selisih;

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
        totalSelisih > 0
            ? `+${totalSelisih}`
            : `${totalSelisih}`;


    const totalWarna =
        totalSelisih === 0
            ? 'text-green-600'
            : (
                totalSelisih < 0
                    ? 'text-red-500'
                    : 'text-blue-600'
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
                ${totalFisik}
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


// ==============================
// RENDER SEMUA
// ==============================

function renderSemuaStock() {

    renderBahanBakuList();

    renderRekonsiliasi();

    renderAyamKembali();

    renderTotalPengeluaran();

}


// ==============================
// INITIAL RENDER
// ==============================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        renderAyamKembali();

        renderSemuaStock();

    }
);