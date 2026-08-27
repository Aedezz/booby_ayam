const menuData = [
    // CRISPY BIASA
    { id: 'ac_sayap', category: 'Ayam Crispy (Ala Carte)', name: 'Sayap', price: 8000 },
    { id: 'ac_pahabawah', category: 'Ayam Crispy (Ala Carte)', name: 'Paha Bawah', price: 8000 },
    { id: 'ac_dada', category: 'Ayam Crispy (Ala Carte)', name: 'Dada', price: 10000 },
    { id: 'ac_pahaatas', category: 'Ayam Crispy (Ala Carte)', name: 'Paha Atas', price: 10000 },

    { id: 'pn_sayap', category: 'Paket Nasi Biasa', name: 'Paket Sayap + Nasi', price: 11000 },
    { id: 'pn_pahabawah', category: 'Paket Nasi Biasa', name: 'Paket Paha Bawah + Nasi', price: 11000 },
    { id: 'pn_dada', category: 'Paket Nasi Biasa', name: 'Paket Dada + Nasi', price: 13000 },
    { id: 'pn_pahaatas', category: 'Paket Nasi Biasa', name: 'Paket Paha Atas + Nasi', price: 13000 },

    // MENU GEPREK
    { id: 'ac_geprek_sayap', category: 'Menu Geprek', name: 'Geprek Sayap', price: 12000 },
    { id: 'ac_geprek_pahabawah', category: 'Menu Geprek', name: 'Geprek Paha Bawah', price: 12000 },
    { id: 'ac_geprek_dada', category: 'Menu Geprek', name: 'Geprek Dada', price: 14000 },
    { id: 'ac_geprek_pahaatas', category: 'Menu Geprek', name: 'Geprek Paha Atas', price: 14000 },
    { id: 'pn_geprek_sayap', category: 'Menu Geprek', name: 'Paket Geprek Sayap + Nasi', price: 15000 },
    { id: 'pn_geprek_pahabawah', category: 'Menu Geprek', name: 'Paket Geprek Paha Bawah + Nasi', price: 15000 },
    { id: 'pn_geprek_dada', category: 'Menu Geprek', name: 'Paket Geprek Dada + Nasi', price: 16000 },
    { id: 'pn_geprek_pahaatas', category: 'Menu Geprek', name: 'Paket Geprek Paha Atas + Nasi', price: 16000 },

    // MENU SUPERHOT
    { id: 'ac_superhot_sayap', category: 'Menu Superhot', name: 'Superhot Sayap', price: 12000 },
    { id: 'ac_superhot_pahabawah', category: 'Menu Superhot', name: 'Superhot Paha Bawah', price: 12000 },
    { id: 'ac_superhot_dada', category: 'Menu Superhot', name: 'Superhot Dada', price: 14000 },
    { id: 'ac_superhot_pahaatas', category: 'Menu Superhot', name: 'Superhot Paha Atas', price: 14000 },
    { id: 'pn_superhot_sayap', category: 'Menu Superhot', name: 'Paket Superhot Sayap + Nasi', price: 15000 },
    { id: 'pn_superhot_pahabawah', category: 'Menu Superhot', name: 'Paket Superhot Paha Bawah + Nasi', price: 15000 },
    { id: 'pn_superhot_dada', category: 'Menu Superhot', name: 'Paket Superhot Dada + Nasi', price: 16000 },
    { id: 'pn_superhot_pahaatas', category: 'Menu Superhot', name: 'Paket Superhot Paha Atas + Nasi', price: 16000 },

    // MENU SAUS KEJU
    { id: 'ac_keju_sayap', category: 'Menu Saus Keju', name: 'Saus Keju Sayap', price: 12000 },
    { id: 'ac_keju_pahabawah', category: 'Menu Saus Keju', name: 'Saus Keju Paha Bawah', price: 12000 },
    { id: 'ac_keju_dada', category: 'Menu Saus Keju', name: 'Saus Keju Dada', price: 14000 },
    { id: 'ac_keju_pahaatas', category: 'Menu Saus Keju', name: 'Saus Keju Paha Atas', price: 14000 },
    { id: 'pn_keju_sayap', category: 'Menu Saus Keju', name: 'Paket Saus Keju Sayap + Nasi', price: 15000 },
    { id: 'pn_keju_pahabawah', category: 'Menu Saus Keju', name: 'Paket Saus Keju Paha Bawah + Nasi', price: 15000 },
    { id: 'pn_keju_dada', category: 'Menu Saus Keju', name: 'Paket Saus Keju Dada + Nasi', price: 16000 },
    { id: 'pn_keju_pahaatas', category: 'Menu Saus Keju', name: 'Paket Saus Keju Paha Atas + Nasi', price: 16000 },

    // MENU MIX (SUPERHOT + KEJU)
    { id: 'ac_mix_sayap', category: 'Menu Mix (Superhot + Keju)', name: 'Superhot + Keju Sayap', price: 16000 },
    { id: 'ac_mix_pahabawah', category: 'Menu Mix (Superhot + Keju)', name: 'Superhot + Keju Paha Bawah', price: 16000 },
    { id: 'ac_mix_dada', category: 'Menu Mix (Superhot + Keju)', name: 'Superhot + Keju Dada', price: 18000 },
    { id: 'ac_mix_pahaatas', category: 'Menu Mix (Superhot + Keju)', name: 'Superhot + Keju Paha Atas', price: 18000 },
    { id: 'pn_mix_sayap', category: 'Menu Mix (Superhot + Keju)', name: 'Paket Superhot + Keju Sayap + Nasi', price: 17000 },
    { id: 'pn_mix_pahabawah', category: 'Menu Mix (Superhot + Keju)', name: 'Paket Superhot + Keju Paha Bawah + Nasi', price: 17000 },
    { id: 'pn_mix_dada', category: 'Menu Mix (Superhot + Keju)', name: 'Paket Superhot + Keju Dada + Nasi', price: 19000 },
    { id: 'pn_mix_pahaatas', category: 'Menu Mix (Superhot + Keju)', name: 'Paket Superhot + Keju Paha Atas + Nasi', price: 19000 },

    // ADD-ON
    { id: 'add_nasi', category: 'Tambahan', name: 'Nasi', price: 4000 },
    { id: 'add_sambal', category: 'Tambahan', name: 'Sambal Geprek', price: 4000 },
    { id: 'add_superhot', category: 'Tambahan', name: 'Superhot', price: 4000 },
    { id: 'add_keju', category: 'Tambahan', name: 'Keju', price: 4000 
    },
];
