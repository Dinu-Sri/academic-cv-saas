/**
 * CV Editor JavaScript
 */
document.addEventListener('DOMContentLoaded', function() {
    if (!window.CV_DATA) return;

    const API = window.CV_DATA.apiUrl;
    const CV_ID = window.CV_DATA.id;
    const CSRF = window.CV_DATA.csrfToken;

    let autosaveTimer = null;

    // ===== LOAD PDF PREVIEW (base64 JSON to bypass download managers) =====
    function loadPdfPreview(url) {
        return fetch(url)
            .then(function(r) {
                if (!r.ok) throw new Error('Failed to load PDF');
                return r.json();
            })
            .then(function(data) {
                if (!data.pdf_base64) throw new Error('No PDF data');
                var binary = atob(data.pdf_base64);
                var bytes = new Uint8Array(binary.length);
                for (var i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                var blob = new Blob([bytes], { type: 'application/pdf' });
                return URL.createObjectURL(blob);
            });
    }

    var existingFrame = document.getElementById('pdf-preview-frame');
    if (existingFrame && existingFrame.dataset.pdfUrl) {
        loadPdfPreview(existingFrame.dataset.pdfUrl)
            .then(function(blobUrl) {
                existingFrame.src = blobUrl;
                existingFrame.classList.remove('d-none');
                var loading = document.getElementById('pdf-loading');
                if (loading) loading.remove();
            })
            .catch(function() {
                var loading = document.getElementById('pdf-loading');
                if (loading) loading.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Failed to load preview';
            });
    }

    // ===== AUTOSAVE Personal Info =====
    document.querySelectorAll('.personal-field').forEach(function(field) {
        field.addEventListener('input', function() {
            clearTimeout(autosaveTimer);
            showSaveStatus('saving');
            autosaveTimer = setTimeout(savePersonalInfo, 1000);
        });
    });

    function savePersonalInfo() {
        const form = document.getElementById('personal-info-form');
        if (!form) return;

        const data = {};
        form.querySelectorAll('.personal-field').forEach(function(field) {
            data[field.name] = field.value;
        });

        fetch(API + '/api/cv/autosave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cv_id: CV_ID,
                _token: CSRF,
                personal_info: data
            })
        })
        .then(r => r.json())
        .then(function(res) {
            if (res.success) {
                showSaveStatus('saved', res.saved_at);
            }
        })
        .catch(function() {
            showSaveStatus('error');
        });
    }

    // ===== SAVE ENTRY FIELDS =====
    document.addEventListener('input', function(e) {
        if (!e.target.classList.contains('entry-field')) return;

        const entryCard = e.target.closest('.entry-card');
        if (!entryCard) return;

        clearTimeout(entryCard._saveTimer);
        showSaveStatus('saving');

        entryCard._saveTimer = setTimeout(function() {
            const entryId = entryCard.dataset.entryId;
            if (!entryId) return; // New entry, not saved yet

            const data = {};
            entryCard.querySelectorAll('.entry-field').forEach(function(f) {
                data[f.name] = f.value;
            });

            fetch(API + '/cv/' + CV_ID + '/section/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_id: parseInt(entryId),
                    data: data,
                    _token: CSRF
                })
            })
            .then(r => r.json())
            .then(function(res) {
                if (res.success) showSaveStatus('saved');
            })
            .catch(function() {
                showSaveStatus('error');
            });
        }, 1000);
    });

    // ===== ADD ENTRY =====
    document.querySelectorAll('.btn-add-entry').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const sectionId = this.dataset.sectionId;
            const sectionKey = this.dataset.sectionKey;
            const cvId = this.dataset.cvId;

            // Create new entry via API
            fetch(API + '/cv/' + cvId + '/section/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: parseInt(sectionId),
                    data: {},
                    _token: CSRF
                })
            })
            .then(r => r.json())
            .then(function(res) {
                if (res.success) {
                    // Clone template and append
                    const template = document.getElementById('entry-template-' + sectionKey);
                    const container = document.getElementById('entries-' + sectionKey);

                    // Remove empty state
                    const emptyState = container.querySelector('.empty-state');
                    if (emptyState) emptyState.remove();

                    const clone = template.content.cloneNode(true);
                    const card = clone.querySelector('.entry-card');
                    card.dataset.entryId = res.entry_id;

                    // Set data attributes on fields
                    card.querySelectorAll('.entry-field').forEach(function(f) {
                        f.dataset.entryId = res.entry_id;
                        f.dataset.cvId = cvId;
                    });

                    // Set delete button data
                    const deleteBtn = card.querySelector('.btn-delete-entry');
                    deleteBtn.dataset.entryId = res.entry_id;
                    deleteBtn.dataset.cvId = cvId;

                    container.appendChild(clone);

                    // Focus first field
                    const firstField = container.lastElementChild.querySelector('.entry-field');
                    if (firstField) firstField.focus();
                }
            })
            .catch(function(err) {
                alert('Failed to add entry. Please try again.');
            });
        });
    });

    // ===== DELETE ENTRY =====
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn-delete-entry');
        if (!btn) return;

        if (!confirm('Remove this entry?')) return;

        const entryId = btn.dataset.entryId;
        const cvId = btn.dataset.cvId;

        fetch(API + '/cv/' + cvId + '/section/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entry_id: parseInt(entryId),
                _token: CSRF
            })
        })
        .then(r => r.json())
        .then(function(res) {
            if (res.success) {
                const card = btn.closest('.entry-card');
                card.remove();
                showSaveStatus('saved');
            }
        })
        .catch(function() {
            alert('Failed to delete entry. Please try again.');
        });
    });

    // ===== COMPILE PDF =====
    const compileBtn = document.getElementById('btn-compile');
    if (compileBtn) {
        compileBtn.addEventListener('click', function() {
            this.classList.add('btn-compiling');
            this.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Compiling...';

            fetch(API + '/cv/compile/' + CV_ID, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _token: CSRF })
            })
            .then(function(r) {
                if (!r.ok) {
                    return r.text().then(function(text) {
                        try { var j = JSON.parse(text); throw new Error(j.error || 'Server error'); }
                        catch(e) { if (e.message) throw e; throw new Error('Server error (' + r.status + ')'); }
                    });
                }
                return r.json();
            })
            .then(function(res) {
                compileBtn.classList.remove('btn-compiling');
                compileBtn.innerHTML = '<i class="bi bi-filetype-pdf me-1"></i>Compile PDF';

                if (res.success) {
                    // PDF data is already in the response as base64
                    var previewFrame = document.querySelector('.preview-frame');
                    previewFrame.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-1"></div> Loading preview...</div>';

                    try {
                        var binary = atob(res.pdf_base64);
                        var bytes = new Uint8Array(binary.length);
                        for (var i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        var blob = new Blob([bytes], { type: 'application/pdf' });
                        var blobUrl = URL.createObjectURL(blob);
                        previewFrame.innerHTML = '<iframe src="' + blobUrl + '" class="w-100" style="height: 70vh; border: none;"></iframe>';
                    } catch(e) {
                        previewFrame.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-exclamation-triangle me-1"></i>Preview failed. Use Download button.</div>';
                    }

                    // Show download button if hidden (static one from PHP)
                    var existingDownload = document.getElementById('btn-download-pdf');
                    if (!existingDownload) {
                        var downloadBtn = document.createElement('a');
                        downloadBtn.id = 'btn-download-pdf';
                        downloadBtn.href = API + '/cv/download/' + CV_ID;
                        downloadBtn.className = 'btn btn-primary btn-sm';
                        downloadBtn.innerHTML = '<i class="bi bi-download me-1"></i>Download';
                        compileBtn.parentNode.appendChild(downloadBtn);
                    }
                } else {
                    alert('Compilation failed: ' + (res.error || 'Unknown error'));
                }
            })
            .catch(function(err) {
                compileBtn.classList.remove('btn-compiling');
                compileBtn.innerHTML = '<i class="bi bi-filetype-pdf me-1"></i>Compile PDF';
                alert('Compilation failed: ' + (err.message || 'Please try again.'));
            });
        });
    }

    // ===== VIEW LATEX =====
    const latexBtn = document.getElementById('btn-preview-latex');
    if (latexBtn) {
        latexBtn.addEventListener('click', function() {
            fetch(API + '/api/cv/' + CV_ID + '/latex')
                .then(r => r.json())
                .then(function(res) {
                    document.getElementById('latex-output').textContent = res.latex || 'No LaTeX generated.';
                    var modal = new bootstrap.Modal(document.getElementById('latexModal'));
                    modal.show();
                })
                .catch(function() {
                    alert('Failed to load LaTeX source.');
                });
        });
    }

    // ===== STATUS INDICATOR =====
    function showSaveStatus(status, time) {
        const el = document.getElementById('autosave-status');
        if (!el) return;

        switch (status) {
            case 'saving':
                el.className = 'text-warning small';
                el.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i>Saving...';
                break;
            case 'saved':
                el.className = 'text-success small';
                el.innerHTML = '<i class="bi bi-cloud-check me-1"></i>Saved' + (time ? ' ' + time : '');
                break;
            case 'error':
                el.className = 'text-danger small';
                el.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Save failed';
                break;
        }
    }

    // ===== REFRESH PREVIEW =====
    var refreshBtn = document.getElementById('btn-refresh-preview');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            var previewFrame = document.querySelector('.preview-frame');
            previewFrame.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-1"></div> Loading preview...</div>';
            loadPdfPreview(API + '/cv/preview-data/' + CV_ID)
                .then(function(blobUrl) {
                    previewFrame.innerHTML = '<iframe src="' + blobUrl + '" class="w-100" style="height: 70vh; border: none;"></iframe>';
                })
                .catch(function() {
                    previewFrame.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-exclamation-triangle me-1"></i>Preview failed</div>';
                });
        });
    }
});
