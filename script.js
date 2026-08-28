// ==============================
// STATE
// ==============================
//
// state.items -> { itemId: qty }
// state.log   -> [{ id, name, change, qtyAfter, time }]
// state.qris  -> nominal QRIS manual
//
// ==============================

let state = {
    items: {},
    log: [],
    qris: 0
};


// ==============================
// LOAD DATA DARI LOCAL STORAGE
// ==============================

try {

    const saved = JSON.parse(
        localStorage.getItem('bobby_state')
    );

    if (saved) {

        // Format baru
        if (
            saved.items !== undefined ||
            saved.log !== undefined ||
            saved.qris !== undefined
        ) {

            state.items = saved.items || {};
            state.log = saved.log || [];
            state.qris = Number(saved.qris) || 0;

        }

        // Format lama
        else {

            state.items = saved || {};
            state.log = [];
            state.qris = 0;

        }

    }

} catch (e) {

    console.error(
        "Gagal membaca localStorage, mereset state:",
        e
    );

    state = {
        items: {},
        log: [],
        qris: 0
    };

}


// ==============================
// RENDER MENU
// ==============================

function renderMenu() {

    const container =
        document.getElementById('menuContainer');

    if (!container) return;

    container.innerHTML = '';

    let currentCategory = '';


    menuData.forEach(item => {

        // Header kategori
        if (item.category !== currentCategory) {

            const catHeader =
                document.createElement('h2');

            catHeader.className =
                'text-xs font-black text-red-700 bg-red-50 border-l-4 border-red-600 px-3 py-2 mt-6 mb-3 tracking-wider uppercase rounded-r-md shadow-sm';

            catHeader.innerText =
                item.category;

            container.appendChild(catHeader);

            currentCategory =
                item.category;
        }


        // Quantity
        const qty =
            state.items[item.id] || 0;


        // Baris item
        const div =
            document.createElement('div');

        div.className =
            'flex justify-between items-center py-3 border-b border-gray-100';


        div.innerHTML = `

            <div class="flex-1 pr-4">

                <h3 class="text-sm font-bold text-gray-800 leading-tight">
                    ${item.name}
                </h3>

                <p class="text-xs text-gray-500 font-medium mt-0.5">
                    Rp ${item.price.toLocaleString('id-ID')}
                </p>

            </div>


            <div class="flex items-center gap-3 bg-gray-50 px-2 py-1.5 rounded-full border border-gray-100">

                <button
                    onclick="updateQty('${item.id}', -1)"
                    class="w-8 h-8 flex justify-center items-center bg-white text-gray-600 rounded-full shadow-sm active:bg-gray-100 transition-all font-bold text-lg leading-none select-none touch-manipulation pb-0.5"
                >
                    -
                </button>


                <span
                    id="qty-${item.id}"
                    class="w-5 text-center font-bold text-gray-800 text-sm"
                >
                    ${qty}
                </span>


                <button
                    onclick="updateQty('${item.id}', 1)"
                    class="w-8 h-8 flex justify-center items-center bg-red-100 text-red-600 rounded-full shadow-sm active:bg-red-200 transition-all font-bold text-lg leading-none select-none touch-manipulation pb-0.5"
                >
                    +
                </button>

            </div>

        `;

        container.appendChild(div);

    });


    calculateTotal();

}


// ==============================
// UPDATE QUANTITY
// ==============================

function updateQty(id, change) {

    let currentQty =
        state.items[id] || 0;

    let newQty =
        currentQty + change;


    // Jangan boleh minus
    if (newQty < 0) {
        newQty = 0;
    }


    // Tidak ada perubahan
    if (newQty === currentQty) {
        return;
    }


    state.items[id] =
        newQty;


    // Cari produk
    const item =
        menuData.find(m => m.id === id);


    // Catat transaksi
    if (item) {

        state.log.push({

            id: id,

            name: item.name,

            change: change,

            qtyAfter: newQty,

            time: new Date().toISOString()

        });

    }


    // Update angka langsung
    const qtyEl =
        document.getElementById(`qty-${id}`);

    if (qtyEl) {
        qtyEl.innerText =
            newQty;
    }


    // Simpan
    saveState();


    // Hitung ulang
    calculateTotal();


    // Update riwayat
    renderRiwayatHariIni();

}


// ==============================
// HITUNG OMSET
// ==============================

function getTotalOmset() {

    let total = 0;


    menuData.forEach(item => {

        const qty =
            state.items[item.id] || 0;

        total +=
            qty * item.price;

    });


    return total;
}


// ==============================
// HITUNG QRIS
// ==============================

function getTotalQRIS() {

    return Number(state.qris) || 0;

}


// ==============================
// HITUNG SETORAN
// ==============================
//
// SETORAN = OMSET - QRIS
//
// ==============================

function getTotalSetoran() {

    const totalOmset =
        getTotalOmset();

    const totalQRIS =
        getTotalQRIS();


    // Jangan sampai hasil negatif
    return Math.max(
        0,
        totalOmset - totalQRIS
    );

}


// ==============================
// UPDATE SEMUA TOTAL
// ==============================

function calculateTotal() {

    const totalOmset =
        getTotalOmset();

    const totalQRIS =
        getTotalQRIS();

    const totalSetoran =
        getTotalSetoran();


    // ==========================
    // TOTAL OMSET
    // ==========================

    const totalEl =
        document.getElementById('totalOmset');

    if (totalEl) {

        totalEl.innerText =
            'Rp ' +
            totalOmset.toLocaleString('id-ID');

    }


    // ==========================
    // INPUT QRIS
    // ==========================

    const qrisInput =
        document.getElementById('inputQRIS');

    if (
        qrisInput &&
        document.activeElement !== qrisInput
    ) {

        qrisInput.value =
            totalQRIS > 0
                ? totalQRIS.toLocaleString('id-ID')
                : '';

    }


    // ==========================
    // SETORAN
    // ==========================

    const setoranEl =
        document.getElementById('totalSetoran');

    if (setoranEl) {

        setoranEl.innerText =
            'Rp ' +
            totalSetoran.toLocaleString('id-ID');

    }


    return {
        total: totalOmset,
        qris: totalQRIS,
        setoran: totalSetoran
    };

}


// ==============================
// QRIS MANUAL
// ==============================

function updateQRIS(value) {

    // Ambil angka saja
    const angka =
        String(value).replace(/\D/g, '');


    state.qris =
        Number(angka) || 0;


    // Simpan
    saveState();


    // Update setoran
    calculateTotal();

}


// ==============================
// EVENT INPUT QRIS
// ==============================

function pasangEventQRIS() {

    const inputQRIS =
        document.getElementById('inputQRIS');

    if (!inputQRIS) return;


    inputQRIS.addEventListener(
        'input',
        function () {

            updateQRIS(
                this.value
            );

        }
    );


    inputQRIS.addEventListener(
        'blur',
        function () {

            const qris =
                Number(state.qris) || 0;


            this.value =
                qris > 0
                    ? qris.toLocaleString('id-ID')
                    : '';


            calculateTotal();

        }
    );

}


// ==============================
// SIMPAN STATE
// ==============================

function saveState() {

    localStorage.setItem(
        'bobby_state',
        JSON.stringify(state)
    );

}


// ==============================
// FORMAT JAM
// ==============================

function formatJam(isoString) {

    const d =
        new Date(isoString);

    return d.toLocaleTimeString(
        'id-ID',
        {
            hour: '2-digit',
            minute: '2-digit'
        }
    );

}


// ==============================
// RIWAYAT HARI INI
// ==============================

function renderRiwayatHariIni() {

    const list =
        document.getElementById(
            'riwayatHariIniList'
        );


    if (!list) return;


    if (state.log.length === 0) {

        list.innerHTML =
            '<p class="text-xs text-gray-400 text-center py-6">Belum ada transaksi hari ini.</p>';

        return;

    }


    // Terbaru di atas
    const items =
        [...state.log].reverse();


    list.innerHTML =
        items.map(entry => {

            const isPlus =
                entry.change > 0;


            const badge =
                isPlus

                    ? `<span class="text-green-600 font-bold text-xs">+${entry.change}</span>`

                    : `<span class="text-red-500 font-bold text-xs">${entry.change}</span>`;


            return `

                <div class="flex justify-between items-center py-2 border-b border-gray-50 text-sm">

                    <div>

                        <p class="font-semibold text-gray-700">
                            ${entry.name}
                        </p>

                        <p class="text-[11px] text-gray-400">
                            ${formatJam(entry.time)}
                            &middot;
                            jadi ${entry.qtyAfter}
                        </p>

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

    if (
        !confirm(
            'Yakin mau reset semua angka jadi 0 buat shift baru? Riwayat hari ini akan disimpan ke Arsip.'
        )
    ) {
        return;
    }


    // ==========================
    // AMBIL HASIL SEBELUM RESET
    // ==========================

    const hasil =
        calculateTotal();


    // ==========================
    // SIMPAN KE ARSIP
    // ==========================

    if (state.log.length > 0) {

        let archive = [];

        try {

            archive =
                JSON.parse(
                    localStorage.getItem(
                        'bobby_riwayat_archive'
                    )
                ) || [];

        } catch (e) {

            archive = [];

        }


        const tanggalEl =
            document.getElementById(
                'tanggalHariIni'
            );


        archive.push({

            tanggal:
                tanggalEl
                    ? tanggalEl.innerText
                    : new Date().toLocaleDateString('id-ID'),

            timestamp:
                new Date().toISOString(),

            total:
                hasil.total,

            qris:
                hasil.qris,

            setoran:
                hasil.setoran,

            items:
                { ...state.items },

            log:
                [...state.log]

        });


        localStorage.setItem(
            'bobby_riwayat_archive',
            JSON.stringify(archive)
        );

    }


    // ==========================
    // RESET
    // ==========================

    state = {
        items: {},
        log: [],
        qris: 0
    };


    saveState();


    // Render ulang
    renderMenu();

    renderRiwayatHariIni();

    renderArsipList();

}


// ==============================
// GET ARCHIVE
// ==============================

function getArchive() {

    try {

        return JSON.parse(
            localStorage.getItem(
                'bobby_riwayat_archive'
            )
        ) || [];

    } catch (e) {

        return [];

    }

}


// ==============================
// RENDER ARSIP
// ==============================

function renderArsipList() {

    const list =
        document.getElementById(
            'riwayatArsipList'
        );


    if (!list) return;


    const archive =
        getArchive();


    if (archive.length === 0) {

        list.innerHTML =
            '<p class="text-xs text-gray-400 text-center py-6">Belum ada arsip. Arsip otomatis tersimpan tiap kamu pencet "Reset Hari Ini".</p>';

        return;

    }


    // Terbaru di atas
    const items =
        [...archive].reverse();


    list.innerHTML =
        items.map((entry, idx) => {

            const realIndex =
                archive.length - 1 - idx;


            const total =
                Number(entry.total) || 0;


            const qris =
                Number(entry.qris) || 0;


            const setoran =
                entry.setoran !== undefined

                    ? Number(entry.setoran)

                    : Math.max(
                        0,
                        total - qris
                    );


            return `

                <button
                    onclick="tampilkanDetailArsip(${realIndex})"
                    class="w-full flex justify-between items-center py-3 border-b border-gray-50 text-left active:bg-gray-50 rounded-lg px-2"
                >

                    <div>

                        <p class="font-bold text-sm text-gray-800">
                            ${entry.tanggal}
                        </p>

                        <p class="text-[11px] text-gray-400">
                            ${entry.log.length} transaksi
                            · QRIS Rp ${qris.toLocaleString('id-ID')}
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

        }).join('');

}


// ==============================
// DETAIL ARSIP
// ==============================

function tampilkanDetailArsip(index) {

    const archive =
        getArchive();


    const entry =
        archive[index];


    if (!entry) return;


    document
        .getElementById('riwayatArsipList')
        .classList.add('hidden');


    document
        .getElementById('riwayatArsipDetail')
        .classList.remove('hidden');


    const detailEl =
        document.getElementById(
            'riwayatArsipDetailContent'
        );


    const total =
        Number(entry.total) || 0;


    const qris =
        Number(entry.qris) || 0;


    const setoran =
        entry.setoran !== undefined

            ? Number(entry.setoran)

            : Math.max(
                0,
                total - qris
            );


    // ==========================
    // RINGKASAN PRODUK
    // ==========================

    let currentCategory = '';

    let ringkasanHtml = '';

    let adaItemTerjual = false;


    menuData.forEach(item => {

        const qty =
            entry.items[item.id] || 0;


        if (qty > 0) {

            adaItemTerjual = true;


            if (
                item.category !==
                currentCategory
            ) {

                ringkasanHtml += `

                    <h3 class="text-[11px] font-black text-red-600 uppercase tracking-wide mt-3 mb-1">
                        ${item.category}
                    </h3>

                `;

                currentCategory =
                    item.category;

            }


            const subtotal =
                qty * item.price;


            ringkasanHtml += `

                <div class="flex justify-between items-center py-1.5 text-sm">

                    <p class="text-gray-700">

                        ${item.name}

                        <span class="text-gray-400 font-semibold">
                            x${qty}
                        </span>

                    </p>

                    <p class="font-semibold text-gray-800">
                        Rp ${subtotal.toLocaleString('id-ID')}
                    </p>

                </div>

            `;

        }

    });


    // ==========================
    // DETAIL HTML
    // ==========================

    detailEl.innerHTML = `

        <div class="mb-4">

            <p class="font-bold text-gray-800 mb-3">
                ${entry.tanggal}
            </p>


            <div class="space-y-2">

                <!-- OMSET -->
                <div class="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">

                    <span class="text-xs font-semibold text-gray-500">
                        Total Omset
                    </span>

                    <span class="text-sm font-bold text-gray-800">
                        Rp ${total.toLocaleString('id-ID')}
                    </span>

                </div>


                <!-- QRIS -->
                <div class="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">

                    <span class="text-xs font-semibold text-gray-500">
                        QRIS
                    </span>

                    <span class="text-sm font-bold text-gray-800">
                        Rp ${qris.toLocaleString('id-ID')}
                    </span>

                </div>


                <!-- SETORAN -->
                <div class="flex justify-between items-center bg-red-50 border border-red-100 rounded-lg px-3 py-2">

                    <span class="text-xs font-bold text-red-700">
                        Setoran
                    </span>

                    <span class="text-sm font-black text-red-700">
                        Rp ${setoran.toLocaleString('id-ID')}
                    </span>

                </div>

            </div>

        </div>


        ${
            adaItemTerjual

                ? ringkasanHtml

                : '<p class="text-xs text-gray-400 text-center py-4">Tidak ada item terjual.</p>'
        }

    `;

}


// ==============================
// TUTUP DETAIL ARSIP
// ==============================

function tutupDetailArsip() {

    document
        .getElementById('riwayatArsipDetail')
        .classList.add('hidden');


    document
        .getElementById('riwayatArsipList')
        .classList.remove('hidden');

}


// ==============================
// MODAL RIWAYAT
// ==============================

function bukaModalRiwayat() {

    document
        .getElementById('modalRiwayat')
        .classList.remove('hidden');


    gantiTabRiwayat('hariini');

}


function tutupModalRiwayat() {

    document
        .getElementById('modalRiwayat')
        .classList.add('hidden');


    tutupDetailArsip();

}


// ==============================
// GANTI TAB RIWAYAT
// ==============================

function gantiTabRiwayat(tab) {

    const tabHariIni =
        document.getElementById(
            'tabHariIni'
        );


    const tabArsip =
        document.getElementById(
            'tabArsip'
        );


    const panelHariIni =
        document.getElementById(
            'panelHariIni'
        );


    const panelArsip =
        document.getElementById(
            'panelArsip'
        );


    if (tab === 'hariini') {

        tabHariIni.classList.add(
            'bg-red-600',
            'text-white'
        );

        tabHariIni.classList.remove(
            'bg-gray-100',
            'text-gray-500'
        );


        tabArsip.classList.add(
            'bg-gray-100',
            'text-gray-500'
        );

        tabArsip.classList.remove(
            'bg-red-600',
            'text-white'
        );


        panelHariIni.classList.remove(
            'hidden'
        );

        panelArsip.classList.add(
            'hidden'
        );


        renderRiwayatHariIni();

    }


    else {

        tabArsip.classList.add(
            'bg-red-600',
            'text-white'
        );

        tabArsip.classList.remove(
            'bg-gray-100',
            'text-gray-500'
        );


        tabHariIni.classList.add(
            'bg-gray-100',
            'text-gray-500'
        );

        tabHariIni.classList.remove(
            'bg-red-600',
            'text-white'
        );


        panelArsip.classList.remove(
            'hidden'
        );

        panelHariIni.classList.add(
            'hidden'
        );


        tutupDetailArsip();

        renderArsipList();

    }

}


// ==============================
// NAVIGASI
// ==============================

function bukaMenuNav() {

    document
        .getElementById('menuNav')
        .classList.remove('hidden');

}


function tutupMenuNav() {

    document
        .getElementById('menuNav')
        .classList.add('hidden');

}


function pindahHalaman(halaman) {

    const pageKasir =
        document.getElementById(
            'pageKasir'
        );


    const pageStock =
        document.getElementById(
            'pageStock'
        );


    const navKasir =
        document.getElementById(
            'navKasir'
        );


    const navStock =
        document.getElementById(
            'navStock'
        );


    const headerActionsKasir =
        document.getElementById(
            'headerActionsKasir'
        );


    const headerActionsStock =
        document.getElementById(
            'headerActionsStock'
        );


    if (halaman === 'kasir') {

        pageKasir.classList.remove(
            'hidden'
        );

        pageStock.classList.add(
            'hidden'
        );


        headerActionsKasir.classList.remove(
            'hidden'
        );

        headerActionsKasir.classList.add(
            'flex'
        );


        headerActionsStock.classList.add(
            'hidden'
        );

        headerActionsStock.classList.remove(
            'flex'
        );


        navKasir.classList.add(
            'bg-red-50',
            'text-red-700'
        );

        navKasir.classList.remove(
            'bg-gray-50',
            'text-gray-600'
        );


        navStock.classList.add(
            'bg-gray-50',
            'text-gray-600'
        );

        navStock.classList.remove(
            'bg-red-50',
            'text-red-700'
        );

    }


    else {

        pageStock.classList.remove(
            'hidden'
        );

        pageKasir.classList.add(
            'hidden'
        );


        headerActionsStock.classList.remove(
            'hidden'
        );

        headerActionsStock.classList.add(
            'flex'
        );


        headerActionsKasir.classList.add(
            'hidden'
        );

        headerActionsKasir.classList.remove(
            'flex'
        );


        navStock.classList.add(
            'bg-red-50',
            'text-red-700'
        );

        navStock.classList.remove(
            'bg-gray-50',
            'text-gray-600'
        );


        navKasir.classList.add(
            'bg-gray-50',
            'text-gray-600'
        );

        navKasir.classList.remove(
            'bg-red-50',
            'text-red-700'
        );


        if (
            typeof renderSemuaStock ===
            'function'
        ) {

            renderSemuaStock();

        }

    }


    tutupMenuNav();

}


// ==============================
// COPY LAPORAN KASIR KE WHATSAPP
// ==============================

function copyToWA() {

    const dateStr =
        document.getElementById(
            'tanggalHariIni'
        ).innerText;


    let text =
        `*LAPORAN AYAM BOBBY*\n`;

    text +=
        `Tanggal: ${dateStr}\n\n`;


    let hasData = false;

    let currentCategory = '';


    // ==========================
    // PRODUK
    // ==========================

    menuData.forEach(item => {

        const qty =
            state.items[item.id] || 0;


        if (qty > 0) {

            hasData = true;


            if (
                item.category !==
                currentCategory
            ) {

                text +=
                    `\n*${item.category.toUpperCase()}*\n`;

                currentCategory =
                    item.category;

            }


            text +=
                `- ${item.name} x${qty} = ${(item.price * qty / 1000)}k\n`;

        }

    });


    // ==========================
    // JIKA KOSONG
    // ==========================

    if (!hasData) {

        alert(
            'Laporan masih kosong cuy, isi dulu angkanya.'
        );

        return;

    }


    // ==========================
    // HASIL KEUANGAN
    // ==========================

    const hasil =
        calculateTotal();


    text +=
        `\n------------------\n`;


    text +=
        `*TOTAL OMSET: Rp ${hasil.total.toLocaleString('id-ID')}*\n`;


    text +=
        `*QRIS: Rp ${hasil.qris.toLocaleString('id-ID')}*\n`;


    text +=
        `*SETORAN: Rp ${hasil.setoran.toLocaleString('id-ID')}*`;


    // ==========================
    // COPY
    // ==========================

    navigator.clipboard
        .writeText(text)

        .then(() => {

            alert(
                'Mantap! Format WA udah disalin, tinggal paste aja bro.'
            );

        })

        .catch(err => {

            console.error(
                'Gagal copy text: ',
                err
            );

            alert(
                'Gagal menyalin otomatis. Silakan coba lagi.'
            );

        });

}


// ==============================
// TANGGAL HARI INI
// ==============================

const tglOptions = {

    weekday: 'long',

    year: 'numeric',

    month: 'long',

    day: 'numeric'

};


const elemenTanggal =
    document.getElementById(
        'tanggalHariIni'
    );


if (elemenTanggal) {

    elemenTanggal.innerText =
        new Date().toLocaleDateString(
            'id-ID',
            tglOptions
        );

}


// ==============================
// INISIALISASI
// ==============================

renderMenu();

renderRiwayatHariIni();

renderArsipList();

pasangEventQRIS();

calculateTotal();