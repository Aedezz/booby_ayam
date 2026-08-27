// State untuk menyimpan quantity
let state = {};
try {
    state = JSON.parse(localStorage.getItem('dfresto_state')) || {};
} catch (e) {
    console.error("Gagal membaca localStorage, mereset state:", e);
    state = {};
}

// Render UI
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

        const qty = state[item.id] || 0;

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
    let currentQty = state[id] || 0;
    let newQty = currentQty + change;
    
    if (newQty < 0) newQty = 0;
    state[id] = newQty;
    
    document.getElementById(`qty-${id}`).innerText = newQty;
    saveState();
    calculateTotal();
}

// Hitung Total Omset
function calculateTotal() {
    let total = 0;
    menuData.forEach(item => {
        const qty = state[item.id] || 0;
        total += qty * item.price;
    });
    
    const totalEl = document.getElementById('totalOmset');
    if (totalEl) {
        totalEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
    }
}

// Simpan ke Local Storage
function saveState() {
    localStorage.setItem('dfresto_state', JSON.stringify(state));
}

// Reset Data Harian
function resetData() {
    if (confirm('Yakin mau reset semua angka jadi 0 buat shift baru?')) {
        state = {};
        saveState();
        renderMenu();
    }
}

// Copy ke WhatsApp
function copyToWA() {
    let dateStr = document.getElementById('tanggalHariIni').innerText;
    let text = `*LAPORAN D'FRESTO*\nTanggal: ${dateStr}\n\n`;
    let hasData = false;
    let total = 0;
    let currentCategory = '';

    menuData.forEach(item => {
        const qty = state[item.id] || 0;
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
