document.addEventListener('DOMContentLoaded', () => {
    // GANTI DENGAN URL "APLIKASI WEB" ANDA
    const API_URL = 'https://script.google.com/macros/s/AKfycbznLpe9CLQHofvMoDwka3kXJMxc7Yu49E0RXcawiR87QjEF4Iu6NHV_diqmBI685yO2/exec';

    // --- Variabel Global ---
    let allData = [];
    let currentFilter = 'All';
    let currentSearchTerm = '';
    let currentSortOrder = 'newest-first';
    let searchTimeout;
    let isModalOpen = false;
    let currentPage = 1;
    const ROWS_PER_PAGE = 10;

    // --- Referensi Elemen HTML ---
    const tableBody = document.getElementById('table-body');
    const loadingIndicator = document.getElementById('loading');
    const syncIndicator = document.getElementById('syncIndicator');
    const dataCard = document.querySelector('.data-card');
    const addNewBtn = document.getElementById('addNewBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const themeToggle = document.getElementById('theme-toggle');
    const statTotal = document.getElementById('statTotal');
    const statSelesai = document.getElementById('statSelesai');
    const statDiproses = document.getElementById('statDiproses');
    const statBelum = document.getElementById('statBelum');
    const deleteConfirmationModal = document.getElementById('deleteConfirmationModal');
    const searchInput = document.querySelector('.search-bar input');
    const filterPills = document.querySelectorAll('.filter-pills .pill');
    const sortSelect = document.getElementById('sort-select');
    const paginationControls = document.getElementById('pagination-controls');

    // ==========================================================
    // FUNGSI INTI (FETCH, RENDER, UPDATE)
    // ==========================================================

    async function fetchData(isBackgroundUpdate = false) {
        if (isModalOpen) return;
        if (isBackgroundUpdate) {
            syncIndicator?.classList.add('visible');
        } else {
            loadingIndicator.style.display = 'block';
            tableBody.innerHTML = '';
        }

        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Network response was not ok`);
            const data = await response.json();

            if (JSON.stringify(allData) !== JSON.stringify(data)) {
                dataCard?.classList.add('is-syncing');
                setTimeout(() => {
                    allData = data;
                    filterAndRenderData();
                    dataCard?.classList.remove('is-syncing');
                }, 400);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (!isBackgroundUpdate) loadingIndicator.innerHTML = 'Gagal memuat data.';
        } finally {
            if (loadingIndicator.style.display === 'block') loadingIndicator.style.display = 'none';
            if (isBackgroundUpdate) setTimeout(() => syncIndicator?.classList.remove('visible'), 500);
        }
    }

    function filterAndRenderData() {
        const expandedRowIds = new Set();
        document.querySelectorAll('.table-row.expanded').forEach(row => expandedRowIds.add(row.id));

        let processedData = [...allData];
        if (currentFilter !== 'All') processedData = processedData.filter(p => p.jenis_verifikasi === currentFilter);
        if (currentSearchTerm) processedData = processedData.filter(p => p.nama_perusahaan.toLowerCase().includes(currentSearchTerm.toLowerCase()));
        
        processedData.sort((a, b) => {
            const timeA = parseInt(a.id.split('-')[1]);
            const timeB = parseInt(b.id.split('-')[1]);
            return currentSortOrder === 'oldest-first' ? timeA - timeB : timeB - timeA;
        });

        updateDashboardStats(processedData);
        renderTable(processedData);
        renderPagination(processedData.length);

        expandedRowIds.forEach(rowId => {
            const rowElement = document.getElementById(rowId);
            if (rowElement) rowElement.classList.add('expanded');
        });
    }

    function renderTable(dataToRender) {
        tableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const endIndex = startIndex + ROWS_PER_PAGE;
        const paginatedData = dataToRender.slice(startIndex, endIndex);

        if (paginatedData.length > 0) {
            paginatedData.forEach(perusahaan => {
                const mainRow = createMainRow(perusahaan);
                const detailRow = createDetailRow(perusahaan);
                tableBody.appendChild(mainRow);
                tableBody.appendChild(detailRow);
            });
            attachCheckboxListeners();
        } else {
            tableBody.innerHTML = `<div class="table-row-nodata"><p>Tidak ada data.</p></div>`;
        }
    }
    
    // ==========================================================
    // PEMBUAT TAMPILAN (ROW, DETAIL, STATS, PAGINASI)
    // ==========================================================

    function createMainRow(p) {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.id = `row-${p.id}`;
        row.innerHTML = `
            <div class="col project-name">${p.nama_perusahaan}</div>
            <div class="col" data-label="Tipe"><span class="pill-base type-pill ${p.jenis_verifikasi}">${p.jenis_verifikasi}</span></div>
            <div class="col" data-label="Status"><span id="status-${p.id}" class="pill-base status-pill ${p.status_global}">${p.status_global}</span></div>
            <div class="col" data-label="Aksi">
                <div class="action-buttons">
                    <button title="Edit" data-tooltip="Edit" class="action-btn edit-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
                    <button title="Hapus" data-tooltip="Hapus" class="action-btn delete-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" y2="17"/><line x1="14" y2="17" y1="11"/></svg></button>
                </div>
            </div>`;
        row.addEventListener('click', e => !e.target.closest('.action-btn') && row.classList.toggle('expanded'));
        row.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); openEditModal(p); });
        row.querySelector('.delete-btn').addEventListener('click', async e => {
            e.stopPropagation();
            try {
                await showDeleteConfirmationModal(p.nama_perusahaan, p.id);
                deleteCompanyData(p.id);
            } catch { console.log('Penghapusan dibatalkan.'); }
        });
        return row;
    }

    function createDetailRow(p) {
        const detail = document.createElement('div');
        detail.className = 'checklist-details';
        const notesHTML = (p.catatan && p.catatan.trim() !== '') ? `<div class="notes-section"><h4 class="notes-title">Catatan</h4><p>${p.catatan}</p></div>` : '';
        const checklistItemsHTML = p.checklist.map(item => `
            <li class="checklist-item">
                <input type="checkbox" id="${p.id}-${item.tugas.replace(/\s/g, '-')}" ${item.selesai === 1 ? 'checked' : ''} data-task-name="${item.tugas}" data-company-id="${p.id}">
                <label for="${p.id}-${item.tugas.replace(/\s/g, '-')}">${item.tugas}</label>
            </li>`).join('');
        detail.innerHTML = `${notesHTML}<div class="checklist-section"><h4 class="checklist-title">Checklist Verifikasi</h4><ul>${checklistItemsHTML}</ul></div>`;
        return detail;
    }

    function updateDashboardStats(data) {
        statTotal.textContent = data.length;
        statSelesai.textContent = data.filter(p => p.status_global === 'selesai').length;
        statDiproses.textContent = data.filter(p => p.status_global === 'diproses').length;
        statBelum.textContent = data.filter(p => p.status_global === 'belum').length;
    }

    function renderPagination(totalRows) {
        paginationControls.innerHTML = '';
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-secondary';
        prevBtn.textContent = 'Sebelumnya';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                filterAndRenderData();
            }
        });

        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-secondary';
        nextBtn.textContent = 'Selanjutnya';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                filterAndRenderData();
            }
        });

        paginationControls.append(prevBtn, pageInfo, nextBtn);
    }
    
    // ==========================================================
    // MODAL & KONFIRMASI
    // ==========================================================

    function showDeleteConfirmationModal(companyName, companyId) {
        return new Promise((resolve, reject) => {
            isModalOpen = true;
            deleteConfirmationModal.classList.add('visible');
            
            const nameSpan = document.getElementById('deleteConfirmName');
            const input = document.getElementById('deleteConfirmInput');
            const confirmBtn = document.getElementById('deleteModalConfirmBtn');
            const cancelBtn = document.getElementById('deleteModalCancelBtn');
            const form = document.getElementById('deleteConfirmForm');

            nameSpan.textContent = companyName;
            input.value = '';
            confirmBtn.disabled = true;

            const onInput = () => confirmBtn.disabled = input.value !== companyName;
            input.addEventListener('input', onInput);

            const cleanup = () => {
                form.removeEventListener('submit', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                input.removeEventListener('input', onInput);
                deleteConfirmationModal.classList.remove('visible');
                isModalOpen = false;
            };

            const onConfirm = (e) => { e.preventDefault(); cleanup(); resolve(); };
            const onCancel = () => { cleanup(); reject(); };

            form.addEventListener('submit', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
        });
    }
    
    // ==========================================================
    // FUNGSI EKSPOR CSV
    // ==========================================================

    function exportToCsv(filename, rows) {
        const processRow = row => {
            const checklistString = row.checklist.map(c => `${c.tugas} (${c.selesai === 1 ? 'Selesai' : 'Belum'})`).join('; ');
            let cleanCatatan = row.catatan ? row.catatan.replace(/"/g, '""') : '';
            let finalVal = `"${row.nama_perusahaan}","${row.jenis_verifikasi}","${row.status_global}","${cleanCatatan}","${checklistString}"`;
            return finalVal + '\n';
        };

        let csvFile = 'Nama Perusahaan,Jenis Verifikasi,Status,Catatan,Checklist\n';
        rows.forEach(row => csvFile += processRow(row));

        const blob = new Blob([`\uFEFF${csvFile}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ==========================================================
    // EVENT LISTENERS & INISIALISASI
    // ==========================================================

    searchInput.addEventListener('input', e => {
        currentSearchTerm = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            filterAndRenderData();
        }, 300);
    });

    filterPills.forEach(pill => {
        pill.addEventListener('click', e => {
            filterPills.forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.textContent.trim() === 'Semua' ? 'All' : e.currentTarget.textContent.trim();
            currentPage = 1;
            filterAndRenderData();
        });
    });

    sortSelect.addEventListener('change', e => {
        currentSortOrder = e.target.value;
        currentPage = 1;
        filterAndRenderData();
    });

    exportCsvBtn.addEventListener('click', () => {
        let dataToExport = [...allData];
        if (currentFilter !== 'All') dataToExport = dataToExport.filter(p => p.jenis_verifikasi === currentFilter);
        if (currentSearchTerm) dataToExport = dataToExport.filter(p => p.nama_perusahaan.toLowerCase().includes(currentSearchTerm.toLowerCase()));
        
        const date = new Date().toISOString().slice(0,10);
        exportToCsv(`verifikasi-data-${date}.csv`, dataToExport);
    });
    
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.checked = false;
        }
    }
    
    themeToggle.addEventListener('change', () => {
        const selectedTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', selectedTheme);
        applyTheme(selectedTheme);
    });
    
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (systemPrefersDark) {
        applyTheme('dark');
    }

    // Animasi Pembuka
    window.addEventListener('load', () => {
        const startupAnimation = document.getElementById('startup-animation');
        setTimeout(() => {
            if (startupAnimation) startupAnimation.classList.add('hidden');
        }, 2500);
    });

    // Inisialisasi Aplikasi
    fetchData();
    setInterval(() => fetchData(true), 15000);

    // --- SISA FUNGSI-FUNGSI LAMA YANG TIDAK BERUBAH ---
    // (showConfirmationModal, openEditModal, dan semua event listener form)
    // NOTE: Kode ini disalin dari file lama Anda untuk memastikan kelengkapan.
    
    function attachCheckboxListeners() { document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => { checkbox.addEventListener('change', async (event) => { const isChecked = event.target.checked; const taskName = event.target.dataset.taskName; const companyId = event.target.dataset.companyId; try { const actionText = isChecked ? "menyelesaikan" : "membatalkan"; await showConfirmationModal('Konfirmasi Tindakan', `Anda yakin ingin ${actionText} verifikasi untuk "${taskName}"?`); updateTaskStatus(companyId, taskName, isChecked); } catch (rejection) { event.target.checked = !isChecked; } }); }); }
    async function updateTaskStatus(companyId, taskName, isChecked) { const statusToSend = isChecked ? 1 : 0; const checkbox = document.getElementById(`${companyId}-${taskName.replace(/\s/g, '-')}`); if (checkbox) checkbox.disabled = true; try { const updateUrl = `${API_URL}?action=update&id=${encodeURIComponent(companyId)}&tugas=${encodeURIComponent(taskName)}&selesai=${statusToSend}`; const response = await fetch(updateUrl); if (!response.ok) throw new Error('Gagal menyimpan ke server'); await fetchData(true); } catch (error) { console.error('Gagal update status:', error); alert('Gagal menyimpan perubahan. Mengembalikan ke kondisi semula.'); if (checkbox) checkbox.checked = !isChecked; } finally { if (checkbox) checkbox.disabled = false; } }
    async function deleteCompanyData(companyId) { const rowElement = document.getElementById(`row-${companyId}`); if (rowElement) rowElement.style.opacity = '0.5'; try { const deleteUrl = `${API_URL}?action=deleteData&id=${encodeURIComponent(companyId)}`; const response = await fetch(deleteUrl); const result = await response.json(); if (result.status !== 'success') throw new Error(result.message || 'Gagal menghapus data.'); await fetchData(); } catch (error) { alert('Gagal menghapus data. Coba lagi.'); if (rowElement) rowElement.style.opacity = '1'; console.error('Error deleting data:', error); } }
    const confirmationModal = document.getElementById('confirmationModal');
    function showConfirmationModal(title, message) { return new Promise((resolve, reject) => { isModalOpen = true; confirmationModal.classList.add('visible'); const modalTitle = document.getElementById('modalTitle'); const modalMessage = document.getElementById('modalMessage'); const confirmBtn = document.getElementById('modalConfirmBtn'); const cancelBtn = document.getElementById('modalCancelBtn'); modalTitle.textContent = title; modalMessage.textContent = message; const cleanup = () => { confirmationModal.classList.remove('visible'); isModalOpen = false; }; const onConfirm = () => { cleanup(); resolve(true); }; const onCancel = () => { cleanup(); reject(false); }; confirmBtn.addEventListener('click', onConfirm, { once: true }); cancelBtn.addEventListener('click', onCancel, { once: true }); }); }
    const addDataModal = document.getElementById('addDataModal'); const addDataForm = document.getElementById('addDataForm'); const addModalCancelBtn = document.getElementById('addModalCancelBtn'); const addFounderBtn = document.getElementById('addFounderBtn'); const founderNameInput = document.getElementById('founderName'); const founderList = document.getElementById('founderList'); function addFounderToList(name, listElement) { const li = document.createElement('li'); li.textContent = `Data Pendiri: ${name}`; const removeBtn = document.createElement('button'); removeBtn.innerHTML = '&times;'; removeBtn.className = 'remove-founder-btn'; removeBtn.type = 'button'; removeBtn.onclick = () => li.remove(); li.appendChild(removeBtn); listElement.appendChild(li); }
    addNewBtn.addEventListener('click', () => { addDataModal.classList.add('visible'); isModalOpen = true; });
    addModalCancelBtn.addEventListener('click', () => { addDataModal.classList.remove('visible'); addDataForm.reset(); founderList.innerHTML = ''; isModalOpen = false; });
    addFounderBtn.addEventListener('click', () => { const name = founderNameInput.value.trim(); if (name) { addFounderToList(name, founderList); founderNameInput.value = ''; founderNameInput.focus(); } });
    founderNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFounderBtn.click(); } });
    addDataForm.addEventListener('submit', async (event) => { event.preventDefault(); const confirmBtn = document.querySelector('#addDataForm .btn-primary'); confirmBtn.textContent = 'Menyimpan...'; confirmBtn.disabled = true; const subTasks = []; document.querySelectorAll('#addDataForm .task-checkbox-group input:checked').forEach(cb => { subTasks.push(cb.value); }); document.querySelectorAll('#founderList li').forEach(li => { subTasks.push(li.childNodes[0].nodeValue.trim()); }); if (subTasks.length === 0) { alert('Mohon pilih atau tambahkan minimal satu sub-tugas.'); confirmBtn.textContent = 'Simpan Data'; confirmBtn.disabled = false; return; } const nama = document.getElementById('namaPerusahaan').value; const jenis = document.getElementById('jenisVerifikasi').value; const tugasString = subTasks.join('\n'); const catatan = document.getElementById('catatan').value; const addUrl = `${API_URL}?action=addData&nama=${encodeURIComponent(nama)}&jenis=${encodeURIComponent(jenis)}&subTugas=${encodeURIComponent(tugasString)}&catatan=${encodeURIComponent(catatan)}`; try { const response = await fetch(addUrl); const result = await response.json(); if (result.status !== 'success') throw new Error(result.message); addDataModal.classList.remove('visible'); isModalOpen = false; addDataForm.reset(); founderList.innerHTML = ''; await fetchData(); } catch (error) { alert('Gagal menambahkan data: ' + error.message); } finally { confirmBtn.textContent = 'Simpan Data'; confirmBtn.disabled = false; } });
    const editDataModal = document.getElementById('editDataModal'); const editDataForm = document.getElementById('editDataForm'); const editModalCancelBtn = document.getElementById('editModalCancelBtn'); const editAddFounderBtn = document.getElementById('editAddFounderBtn'); const editFounderNameInput = document.getElementById('editFounderName'); const editFounderList = document.getElementById('editFounderList'); function openEditModal(perusahaan) { document.getElementById('editCompanyId').value = perusahaan.id; document.getElementById('editNamaPerusahaan').value = perusahaan.nama_perusahaan; document.getElementById('editJenisVerifikasi').value = perusahaan.jenis_verifikasi; document.getElementById('editCatatan').value = perusahaan.catatan || ''; const editCheckboxes = document.querySelectorAll('#editTaskCheckboxGroup input'); editCheckboxes.forEach(cb => cb.checked = false); editFounderList.innerHTML = ''; perusahaan.checklist.forEach(item => { const task = item.tugas; const standardCheckbox = Array.from(editCheckboxes).find(cb => cb.value === task); if (standardCheckbox) { standardCheckbox.checked = true; } else if (task.startsWith('Data Pendiri:')) { const founderName = task.replace('Data Pendiri:', '').trim(); addFounderToList(founderName, editFounderList); } }); if (editDataModal) { editDataModal.classList.add('visible'); isModalOpen = true; } }
    editAddFounderBtn.addEventListener('click', () => { const name = editFounderNameInput.value.trim(); if (name) { addFounderToList(name, editFounderList); editFounderNameInput.value = ''; editFounderNameInput.focus(); } });
    editFounderNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editAddFounderBtn.click(); } });
    editModalCancelBtn.addEventListener('click', () => { editDataModal.classList.remove('visible'); isModalOpen = false; });
    editDataForm.addEventListener('submit', async (event) => { event.preventDefault(); const confirmBtn = document.getElementById('editModalConfirmBtn'); confirmBtn.textContent = 'Menyimpan...'; confirmBtn.disabled = true; const subTasks = []; document.querySelectorAll('#editTaskCheckboxGroup input:checked').forEach(cb => { subTasks.push(cb.value); }); document.querySelectorAll('#editFounderList li').forEach(li => { subTasks.push(li.childNodes[0].nodeValue.trim()); }); if (subTasks.length === 0) { alert('Mohon pilih atau tambahkan minimal satu sub-tugas.'); confirmBtn.textContent = 'Simpan Perubahan'; confirmBtn.disabled = false; return; } const id = document.getElementById('editCompanyId').value; const nama = document.getElementById('editNamaPerusahaan').value; const jenis = document.getElementById('editJenisVerifikasi').value; const tugasString = subTasks.join('\n'); const catatan = document.getElementById('editCatatan').value; const editUrl = `${API_URL}?action=editData&id=${id}&nama=${encodeURIComponent(nama)}&jenis=${encodeURIComponent(jenis)}&subTugas=${encodeURIComponent(tugasString)}&catatan=${encodeURIComponent(catatan)}`; try { const response = await fetch(editUrl); const result = await response.json(); if (result.status !== 'success') throw new Error(result.message); editDataModal.classList.remove('visible'); isModalOpen = false; await fetchData(); } catch (error) { alert('Gagal menyimpan perubahan: ' + error.message); } finally { confirmBtn.textContent = 'Simpan Perubahan'; confirmBtn.disabled = false; } });
});