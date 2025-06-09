// ==========================================================
// KODE SCRIPT.JS FINAL (DIRAPIKAN DAN DIPERBAIKI)
// ==========================================================

// GANTI DENGAN URL "APLIKASI WEB" ANDA YANG SUDAH BERFUNGSI
const API_URL = 'https://script.google.com/macros/s/AKfycbznLpe9CLQHofvMoDwka3kXJMxc7Yu49E0RXcawiR87QjEF4Iu6NHV_diqmBI685yO2/exec';

// --- Variabel Global ---
let allData = [];
let currentFilter = 'All';
let currentSearchTerm = '';
let currentSortOrder = 'newest-first';
let searchTimeout;

// --- Referensi Elemen HTML ---
const tableBody = document.getElementById('table-body');
const loadingIndicator = document.getElementById('loading');

// Modal Tambah Data
const addNewBtn = document.getElementById('addNewBtn');
const addDataModal = document.getElementById('addDataModal');
const addDataForm = document.getElementById('addDataForm');
const addModalCancelBtn = document.getElementById('addModalCancelBtn');
const addFounderBtn = document.getElementById('addFounderBtn');
const founderNameInput = document.getElementById('founderName');
const founderList = document.getElementById('founderList');

// Modal Edit Data
const editDataModal = document.getElementById('editDataModal');
const editDataForm = document.getElementById('editDataForm');
const editModalCancelBtn = document.getElementById('editModalCancelBtn');
const editAddFounderBtn = document.getElementById('editAddFounderBtn');
const editFounderNameInput = document.getElementById('editFounderName');
const editFounderList = document.getElementById('editFounderList');

// Filter & Pencarian
const searchInput = document.querySelector('.search-bar input');
const filterPills = document.querySelectorAll('.filter-pills .pill');
const sortSelect = document.getElementById('sort-select'); 

// --- FUNGSI-FUNGSI UTAMA ---

async function fetchData() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (tableBody) tableBody.innerHTML = '';
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Network response was not ok`);
        const data = await response.json();
        allData = data;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        filterAndRenderData();
    } catch (error) {
        if (loadingIndicator) loadingIndicator.innerHTML = 'Gagal memuat data.';
        console.error('Terjadi error saat fetchData:', error);
    }
}

function filterAndRenderData() {
    let processedData = [...allData];

    // 1. Langkah Filtering (tidak ada perubahan)
    if (currentFilter !== 'All') {
        processedData = processedData.filter(p => p.jenis_verifikasi === currentFilter);
    }

    // 2. Langkah Pencarian (tidak ada perubahan)
    if (currentSearchTerm) {
        processedData = processedData.filter(p =>
            p.nama_perusahaan.toLowerCase().includes(currentSearchTerm.toLowerCase())
        );
    }

    // 3. LANGKAH BARU: Pengurutan (Sorting)
    processedData.sort((a, b) => {
        // Ekstrak timestamp dari ID (misal: "P-1717908264000" -> 1717908264000)
        const timeA = parseInt(a.id.split('-')[1]);
        const timeB = parseInt(b.id.split('-')[1]);

        if (currentSortOrder === 'oldest-first') {
            return timeA - timeB; // Urutan menaik (Lama ke Baru)
        } else {
            return timeB - timeA; // Urutan menurun (Terbaru ke Lama)
        }
    });

    // 4. Render data yang sudah diproses
    renderTable(processedData);
}

function renderTable(dataToRender) {
    if (tableBody) tableBody.innerHTML = '';
    if (dataToRender.length > 0) {
        dataToRender.forEach(perusahaan => {
            const mainRow = createMainRow(perusahaan);
            const detailRow = createDetailRow(perusahaan);
            if (mainRow && detailRow) {
                tableBody.appendChild(mainRow);
                tableBody.appendChild(detailRow);
            }
        });
        
        attachCheckboxListeners();
    } else {
        const noDataRow = `<div class="table-row-nodata"><p>Tidak ada data yang cocok dengan kriteria.</p></div>`;
        if (tableBody) tableBody.innerHTML = noDataRow;
    }
}

async function updateTaskStatus(companyId, taskName, isChecked) {
    const statusToSend = isChecked ? 1 : 0;
    const checkbox = document.getElementById(`${companyId}-${taskName.replace(/\s/g, '-')}`);
    if (checkbox) checkbox.disabled = true;
    
    const updateUrl = `${API_URL}?action=update&id=${encodeURIComponent(companyId)}&tugas=${encodeURIComponent(taskName)}&selesai=${statusToSend}`;
    
    try {
        const response = await fetch(updateUrl);
        if (!response.ok) throw new Error('Gagal menyimpan ke server');
        
        const dataToUpdate = allData.find(p => p.id === companyId);
        if (dataToUpdate) {
            const taskToUpdate = dataToUpdate.checklist.find(t => t.tugas === taskName);
            if (taskToUpdate) taskToUpdate.selesai = statusToSend;
            
            const tugasSelesai = dataToUpdate.checklist.filter(t => t.selesai === 1).length;
            if (tugasSelesai === dataToUpdate.checklist.length) { 
                dataToUpdate.status_global = 'selesai'; 
            }
            else if (tugasSelesai === 0) { 
                dataToUpdate.status_global = 'belum'; 
            }
            else { 
                dataToUpdate.status_global = 'diproses'; 
            }
        }
        
        const statusElement = document.getElementById(`status-${companyId}`);
        if (statusElement) {
            statusElement.className = `pill-base status-pill ${dataToUpdate.status_global}`;
            statusElement.textContent = dataToUpdate.status_global;
        }
        
    } catch (error) {
        console.error('Gagal update status:', error);
        alert('Gagal menyimpan perubahan. Mengembalikan ke kondisi semula.');
        if (checkbox) checkbox.checked = !isChecked;
    } finally {
        if (checkbox) checkbox.disabled = false;
    }
}

async function deleteCompanyData(companyId) {
    const rowElement = document.getElementById(`row-${companyId}`);
    const detailElement = rowElement.nextElementSibling;
    if(rowElement) rowElement.style.opacity = '0.5';
    if(detailElement) detailElement.style.opacity = '0.5';

    const deleteUrl = `${API_URL}?action=deleteData&id=${encodeURIComponent(companyId)}`;
    try {
        const response = await fetch(deleteUrl);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Gagal menghapus data.');
        allData = allData.filter(p => p.id !== companyId);
        filterAndRenderData();
    } catch (error) {
        alert('Gagal menghapus data. Coba lagi.');
        if(rowElement) rowElement.style.opacity = '1';
        if(detailElement) detailElement.style.opacity = '1';
        console.error('Error deleting data:', error);
    }
}

function showConfirmationModal(title, message) {
    const modal = document.getElementById('confirmationModal');
    
    if (!modal) {
        console.warn("Modal konfirmasi tidak ditemukan. Menggunakan fallback confirm()");
        return window.confirm(`${title}\n${message}`) 
            ? Promise.resolve() 
            : Promise.reject();
    }

    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add('visible');
    
    return new Promise((resolve, reject) => {
        const onConfirm = () => {
            modal.classList.remove('visible');
            resolve(true);
        };
        
        const onCancel = () => {
            modal.classList.remove('visible');
            reject(false);
        };
        
        confirmBtn.addEventListener('click', onConfirm, { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });
    });
}

// --- FUNGSI-FUNGSI PEMBUAT TAMPILAN (RENDER) ---

function createMainRow(perusahaan) {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.id = `row-${perusahaan.id}`;
    
    // === PERUBAHAN DIMULAI DI SINI: Menambahkan atribut data-label ===
    row.innerHTML = `
        <div class="col project-name">${perusahaan.nama_perusahaan}</div>
        <div class="col" data-label="Tipe">
            <span class="pill-base type-pill ${perusahaan.jenis_verifikasi}">${perusahaan.jenis_verifikasi}</span>
        </div>
        <div class="col" data-label="Status">
            <span id="status-${perusahaan.id}" class="pill-base status-pill ${perusahaan.status_global}">${perusahaan.status_global}</span>
        </div>
        <div class="col" data-label="Aksi">
            <div class="action-buttons">
                <button title="Edit" class="action-btn edit-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                    </svg>
                </button>
                <button title="Hapus" class="action-btn delete-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" x2="10" y1="11" y2="17"/>
                        <line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
    // === PERUBAHAN SELESAI DI SINI ===
    
    row.addEventListener('click', (event) => { 
        if (event.target.closest('.action-btn')) return; 
        row.classList.toggle('expanded'); 
    });
    
    const editBtn = row.querySelector('.edit-btn');
    editBtn.addEventListener('click', (event) => { 
        event.stopPropagation(); 
        openEditModal(perusahaan); 
    });

    const deleteBtn = row.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        try {
            await showConfirmationModal('Konfirmasi Hapus', `Anda yakin ingin menghapus data untuk "${perusahaan.nama_perusahaan}"?`);
            deleteCompanyData(perusahaan.id);
        } catch (rejection) { 
            console.log('Penghapusan dibatalkan.'); 
        }
    });
    
    return row;
}

function createDetailRow(perusahaan) {
    const detail = document.createElement('div');
    detail.className = 'checklist-details';
    
    const hasNote = perusahaan.catatan && perusahaan.catatan.trim() !== '';
    const notesHTML = hasNote ? `
        <div class="notes-section">
            <h4 class="notes-title">Catatan</h4>
            <p>${perusahaan.catatan}</p>
        </div>
    ` : '';

    const checklistItemsHTML = perusahaan.checklist.map(item => {
        const uniqueId = `${perusahaan.id}-${item.tugas.replace(/\s/g, '-')}`;
        return `
            <li class="checklist-item">
                <input type="checkbox" id="${uniqueId}" 
                    ${item.selesai === 1 ? 'checked' : ''}
                    data-task-name="${item.tugas}" 
                    data-company-id="${perusahaan.id}">
                <label for="${uniqueId}">${item.tugas}</label>
            </li>
        `;
    }).join('');
    
    detail.innerHTML = `
        ${notesHTML}
        <div class="checklist-section">
            <h4 class="checklist-title">Checklist Verifikasi</h4>
            <ul>${checklistItemsHTML}</ul>
        </div>
    `;
    
    return detail;
}

function attachCheckboxListeners() {
    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const isChecked = event.target.checked;
            const taskName = event.target.dataset.taskName;
            const companyId = event.target.dataset.companyId;
            
            try {
                const actionText = isChecked ? "menyelesaikan" : "membatalkan";
                await showConfirmationModal(
                    'Konfirmasi Tindakan', 
                    `Anda yakin ingin ${actionText} verifikasi untuk "${taskName}"?`
                );
                updateTaskStatus(companyId, taskName, isChecked);
            } catch (rejection) {
                event.target.checked = !isChecked;
            }
        });
    });
}

// --- LOGIKA FORM ---

function addFounderToList(name, listElement) {
    const li = document.createElement('li');
    li.textContent = `Data Pendiri: ${name}`;
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '&times;';
    removeBtn.className = 'remove-founder-btn';
    removeBtn.type = 'button';
    removeBtn.onclick = () => li.remove();
    
    li.appendChild(removeBtn);
    listElement.appendChild(li);
}

addNewBtn.addEventListener('click', () => addDataModal.classList.add('visible'));

addModalCancelBtn.addEventListener('click', () => {
    addDataModal.classList.remove('visible');
    addDataForm.reset();
    founderList.innerHTML = '';
});

addFounderBtn.addEventListener('click', () => {
    const name = founderNameInput.value.trim();
    if (name) {
        addFounderToList(name, founderList);
        founderNameInput.value = '';
        founderNameInput.focus();
    }
});

founderNameInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        addFounderBtn.click(); 
    }
});

addDataForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const confirmBtn = document.querySelector('#addDataForm .btn-primary');
    confirmBtn.textContent = 'Menyimpan...';
    confirmBtn.disabled = true;
    
    const subTasks = [];
    document.querySelectorAll('#addDataForm .task-checkbox-group input:checked').forEach(cb => {
        subTasks.push(cb.value);
    });
    
    document.querySelectorAll('#founderList li').forEach(li => {
        subTasks.push(li.childNodes[0].nodeValue.trim());
    });
    
    if (subTasks.length === 0) {
        alert('Mohon pilih atau tambahkan minimal satu sub-tugas.');
        confirmBtn.textContent = 'Simpan Data';
        confirmBtn.disabled = false;
        return;
    }
    
    const nama = document.getElementById('namaPerusahaan').value;
    const jenis = document.getElementById('jenisVerifikasi').value;
    const tugasString = subTasks.join('\n');
    const catatan = document.getElementById('catatan').value;
    const addUrl = `${API_URL}?action=addData&nama=${encodeURIComponent(nama)}&jenis=${encodeURIComponent(jenis)}&subTugas=${encodeURIComponent(tugasString)}&catatan=${encodeURIComponent(catatan)}`;
    
    try {
        const response = await fetch(addUrl);
        const result = await response.json();
        
        if (result.status !== 'success') throw new Error(result.message);
        
        addDataModal.classList.remove('visible');
        addDataForm.reset();
        founderList.innerHTML = '';
        allData.unshift(result.newRowData);
        filterAndRenderData();
    } catch (error) {
        alert('Gagal menambahkan data: ' + error.message);
    } finally {
        confirmBtn.textContent = 'Simpan Data';
        confirmBtn.disabled = false;
    }
});

function openEditModal(perusahaan) {
    document.getElementById('editCompanyId').value = perusahaan.id;
    document.getElementById('editNamaPerusahaan').value = perusahaan.nama_perusahaan;
    document.getElementById('editJenisVerifikasi').value = perusahaan.jenis_verifikasi;
    document.getElementById('editCatatan').value = perusahaan.catatan || ''; 

    const editCheckboxes = document.querySelectorAll('#editTaskCheckboxGroup input');
    editCheckboxes.forEach(cb => cb.checked = false);
    editFounderList.innerHTML = '';
    
    perusahaan.checklist.forEach(item => {
        const task = item.tugas;
        const standardCheckbox = Array.from(editCheckboxes).find(cb => cb.value === task);
        
        if (standardCheckbox) { 
            standardCheckbox.checked = true; 
        } 
        else if (task.startsWith('Data Pendiri:')) {
            const founderName = task.replace('Data Pendiri:', '').trim();
            addFounderToList(founderName, editFounderList);
        }
    });
    
    if(editDataModal) editDataModal.classList.add('visible');
}

editAddFounderBtn.addEventListener('click', () => {
    const name = editFounderNameInput.value.trim();
    if (name) {
        addFounderToList(name, editFounderList);
        editFounderNameInput.value = '';
        editFounderNameInput.focus();
    }
});

editFounderNameInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        editAddFounderBtn.click(); 
    }
});

editModalCancelBtn.addEventListener('click', () => editDataModal.classList.remove('visible'));

editDataForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const confirmBtn = document.getElementById('editModalConfirmBtn');
    confirmBtn.textContent = 'Menyimpan...';
    confirmBtn.disabled = true;
    
    const subTasks = [];
    document.querySelectorAll('#editTaskCheckboxGroup input:checked').forEach(cb => {
        subTasks.push(cb.value);
    });
    
    document.querySelectorAll('#editFounderList li').forEach(li => {
        subTasks.push(li.childNodes[0].nodeValue.trim());
    });
    
    if (subTasks.length === 0) {
        alert('Mohon pilih atau tambahkan minimal satu sub-tugas.');
        confirmBtn.textContent = 'Simpan Perubahan';
        confirmBtn.disabled = false;
        return;
    }
    
    const id = document.getElementById('editCompanyId').value;
    const nama = document.getElementById('editNamaPerusahaan').value;
    const jenis = document.getElementById('editJenisVerifikasi').value;
    const tugasString = subTasks.join('\n');
    const catatan = document.getElementById('editCatatan').value;
    const editUrl = `${API_URL}?action=editData&id=${id}&nama=${encodeURIComponent(nama)}&jenis=${encodeURIComponent(jenis)}&subTugas=${encodeURIComponent(tugasString)}&catatan=${encodeURIComponent(catatan)}`;
    
    try {
        const response = await fetch(editUrl);
        const result = await response.json();
        
        if (result.status !== 'success') throw new Error(result.message);
        
        editDataModal.classList.remove('visible');
        await fetchData(); // Fetch ulang data untuk sinkronisasi penuh
    } catch (error) {
        alert('Gagal menyimpan perubahan: ' + error.message);
    } finally {
        confirmBtn.textContent = 'Simpan Perubahan';
        confirmBtn.disabled = false;
    }
});

searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filterAndRenderData();
    }, 300);
});

filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
        filterPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        currentFilter = e.currentTarget.textContent.trim();
        if (currentFilter === 'Semua') {
            currentFilter = 'All'; 
        }
        
        filterAndRenderData();
    });
});

sortSelect.addEventListener('change', (e) => {
    currentSortOrder = e.target.value;
    filterAndRenderData(); 
});

// ===== KODE UNTUK MENGHILANGKAN ANIMASI PEMBUKA =====
window.addEventListener('load', () => {
    const startupAnimation = document.getElementById('startup-animation');
    // Beri sedikit jeda agar animasi terlihat
    setTimeout(() => {
        if (startupAnimation) {
            startupAnimation.classList.add('hidden');
        }
    }, 1500); // Tunggu 1.5 detik sebelum menghilang
});

fetchData();