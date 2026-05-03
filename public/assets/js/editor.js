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
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

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
                return bytes;
            });
    }

    function renderPdfCanvas(bytes, hostEl) {
        if (!window.pdfjsLib) {
            throw new Error('PDF viewer failed to load');
        }
        if (!hostEl) {
            throw new Error('Preview host not found');
        }

        hostEl.classList.remove('d-none');
        hostEl.innerHTML = '<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-1"></div> Rendering preview...</div>';

        return window.pdfjsLib.getDocument({ data: bytes }).promise.then(function(pdf) {
            hostEl.innerHTML = '';
            hostEl.style.background = '#ffffff';

            var renderChain = Promise.resolve();
            for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                (function(n) {
                    renderChain = renderChain.then(function() {
                        return pdf.getPage(n).then(function(page) {
                            var viewport = page.getViewport({ scale: 1.22 });
                            var canvas = document.createElement('canvas');
                            canvas.width = Math.floor(viewport.width);
                            canvas.height = Math.floor(viewport.height);
                            canvas.className = 'd-block mx-auto mb-3 border';
                            canvas.style.background = '#fff';

                            var context = canvas.getContext('2d', { alpha: false });
                            hostEl.appendChild(canvas);

                            return page.render({
                                canvasContext: context,
                                viewport: viewport
                            }).promise;
                        });
                    });
                })(pageNum);
            }

            return renderChain;
        });
    }

    var existingCanvasHost = document.getElementById('pdf-preview-canvas');
    if (existingCanvasHost && existingCanvasHost.dataset.pdfUrl) {
        loadPdfPreview(existingCanvasHost.dataset.pdfUrl)
            .then(function(bytes) {
                return renderPdfCanvas(bytes, existingCanvasHost);
            })
            .then(function() {
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

                    // Set collapsible body id and header target
                    var bodyEl = card.querySelector('.entry-body');
                    bodyEl.id = 'entry-body-' + res.entry_id;
                    var headerEl = card.querySelector('.entry-header');
                    headerEl.setAttribute('data-bs-target', '#entry-body-' + res.entry_id);

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

                    // Update reorder button states
                    var allCards = Array.from(container.querySelectorAll('.entry-card'));
                    allCards.forEach(function(c, i) {
                        var upBtn = c.querySelector('.btn-entry-move-up');
                        var downBtn = c.querySelector('.btn-entry-move-down');
                        if (upBtn) upBtn.disabled = (i === 0);
                        if (downBtn) downBtn.disabled = (i === allCards.length - 1);
                    });

                    // Focus first field of new entry (already open)
                    // Mark tab as having entries (green checkmark)
                    var tabBtn = document.querySelector('[data-bs-target="#tab-' + sectionKey + '"]');
                    if (tabBtn && !tabBtn.querySelector('.bi-check-circle-fill')) {
                        var icon = document.createElement('i');
                        icon.className = 'bi bi-check-circle-fill text-success ms-1';
                        icon.style.fontSize = '0.7rem';
                        tabBtn.appendChild(icon);
                    }

                    // Focus first field of new entry (already open)
                    const firstField = container.lastElementChild.querySelector('.entry-field');
                    if (firstField) firstField.focus();
                }
            })
            .catch(function(err) {
                csAlert('Failed to add entry. Please try again.', {type: 'danger'});
            });
        });
    });

    // ===== DELETE ENTRY =====
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn-delete-entry');
        if (!btn) return;

        csConfirm('Remove this entry? This cannot be undone.', function() {
            var entryId = btn.dataset.entryId;
            var cvId = btn.dataset.cvId;

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
                    const container = card.closest('.entries-container');
                    card.remove();
                    showSaveStatus('saved');

                    // Update reorder button states
                    if (container) {
                        var allCards = Array.from(container.querySelectorAll('.entry-card'));
                        allCards.forEach(function(c, i) {
                            var upBtn = c.querySelector('.btn-entry-move-up');
                            var downBtn = c.querySelector('.btn-entry-move-down');
                            if (upBtn) upBtn.disabled = (i === 0);
                            if (downBtn) downBtn.disabled = (i === allCards.length - 1);
                        });
                    }
                }
            })
            .catch(function() {
                csAlert('Failed to delete entry. Please try again.', {type: 'danger'});
            });
        }, {type: 'danger', title: 'Delete Entry', confirmText: 'Yes, remove'});
    });

    // ===== COMPILE PDF =====
    const compileBtn = document.getElementById('btn-compile');
    if (compileBtn) {
        compileBtn.addEventListener('click', function() {
            this.classList.add('btn-compiling');
            this.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Compiling...';

            // Flush any pending entry autosaves before compiling so all typed
            // content reaches the database before the compile request goes out.
            var pendingSaves = [];
            document.querySelectorAll('.entry-card').forEach(function(card) {
                if (card._saveTimer) {
                    clearTimeout(card._saveTimer);
                    card._saveTimer = null;
                    var entryId = card.dataset.entryId;
                    if (!entryId) return;
                    var data = {};
                    card.querySelectorAll('.entry-field').forEach(function(f) { data[f.name] = f.value; });
                    pendingSaves.push(
                        fetch(API + '/cv/' + CV_ID + '/section/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ entry_id: parseInt(entryId), data: data, _token: CSRF })
                        }).catch(function() {})
                    );
                }
            });

            Promise.all(pendingSaves).then(function() {
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

                        previewFrame.innerHTML = '<div id="pdf-preview-canvas" class="w-100" style="height: 70vh; overflow:auto; background:#fff;"></div>';
                        var host = previewFrame.querySelector('#pdf-preview-canvas');
                        renderPdfCanvas(bytes, host).catch(function() {
                            previewFrame.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-exclamation-triangle me-1"></i>Preview failed. Use Download button.</div>';
                        });
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
                    csAlert('Compilation failed: ' + (res.error || 'Unknown error'), {type: 'danger'});
                }
            })
            .catch(function(err) {
                compileBtn.classList.remove('btn-compiling');
                compileBtn.innerHTML = '<i class="bi bi-filetype-pdf me-1"></i>Compile PDF';
                csAlert('Compilation failed: ' + (err.message || 'Please try again.'), {type: 'danger'});
            });
            }); // end Promise.all then
        }); // end compileBtn click
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
                    csAlert('Failed to load LaTeX source.', {type: 'danger'});
                });
        });
    }

    // ===== FORMATTING HELP =====
    // Button uses data-bs-toggle/data-bs-target as primary trigger; JS is a fallback.
    const formatHelpBtn = document.getElementById('btn-format-help');
    if (formatHelpBtn && !formatHelpBtn.dataset.bsToggle) {
        formatHelpBtn.addEventListener('click', function() {
            var modal = new bootstrap.Modal(document.getElementById('formatHelpModal'));
            modal.show();
        });
    }

    // ===== SECTION MANAGER =====
    var sectionOrder = (window.CV_DATA.sectionData || []).slice();

    function renderSectionManagerList() {
        var list = document.getElementById('section-order-list');
        if (!list) return;
        list.innerHTML = '';
        sectionOrder.forEach(function(s, i) {
            var item = document.createElement('div');
            item.className = 'd-flex align-items-center gap-2 px-2 py-1' +
                (i < sectionOrder.length - 1 ? ' border-bottom' : '');
            item.dataset.sectionId = s.id;
            item.innerHTML =
                '<span class="flex-grow-1 small">' + s.name + '</span>' +
                '<button class="btn btn-sm p-0 text-secondary btn-sec-up" ' + (i === 0 ? 'disabled' : '') + ' title="Move up">' +
                    '<i class="bi bi-chevron-up"></i>' +
                '</button>' +
                '<button class="btn btn-sm p-0 text-secondary btn-sec-down" ' + (i === sectionOrder.length - 1 ? 'disabled' : '') + ' title="Move down">' +
                    '<i class="bi bi-chevron-down"></i>' +
                '</button>';
            list.appendChild(item);
        });
        list.querySelectorAll('.btn-sec-up').forEach(function(btn, i) {
            btn.addEventListener('click', function() {
                if (i === 0) return;
                var tmp = sectionOrder[i - 1];
                sectionOrder[i - 1] = sectionOrder[i];
                sectionOrder[i] = tmp;
                renderSectionManagerList();
            });
        });
        list.querySelectorAll('.btn-sec-down').forEach(function(btn, i) {
            btn.addEventListener('click', function() {
                if (i === sectionOrder.length - 1) return;
                var tmp = sectionOrder[i + 1];
                sectionOrder[i + 1] = sectionOrder[i];
                sectionOrder[i] = tmp;
                renderSectionManagerList();
            });
        });
    }

    // Build list fresh each time the modal opens.
    var sectionManagerModal = document.getElementById('sectionManagerModal');
    if (sectionManagerModal) {
        sectionManagerModal.addEventListener('show.bs.modal', function() {
            sectionOrder = (window.CV_DATA.sectionData || []).slice();
            renderSectionManagerList();
        });
    }

    var resetSectionOrderBtn = document.getElementById('btn-reset-section-order');
    if (resetSectionOrderBtn) {
        resetSectionOrderBtn.addEventListener('click', function() {
            sectionOrder = (window.CV_DATA.sectionData || []).slice().sort(function(a, b) {
                return a.defaultOrder - b.defaultOrder;
            });
            renderSectionManagerList();
        });
    }

    var saveSectionOrderBtn = document.getElementById('btn-save-section-order');
    if (saveSectionOrderBtn) {
        saveSectionOrderBtn.addEventListener('click', function() {
            var order = sectionOrder.map(function(s) { return s.id; });
            saveSectionOrderBtn.disabled = true;
            saveSectionOrderBtn.textContent = 'Saving...';
            fetch(API + '/cv/' + CV_ID + '/sections/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: order, _token: CSRF })
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success) {
                    window.location.reload();
                } else {
                    csAlert('Failed to save section order.', { type: 'danger' });
                    saveSectionOrderBtn.disabled = false;
                    saveSectionOrderBtn.textContent = 'Save';
                }
            })
            .catch(function() {
                csAlert('Error saving section order.', { type: 'danger' });
                saveSectionOrderBtn.disabled = false;
                saveSectionOrderBtn.textContent = 'Save';
            });
        });
    }

    // ===== HEADING COLOR PICKER =====
    var colorInput = document.getElementById('cv-heading-color');
    var colorSaveTimer = null;
    if (colorInput) {
        colorInput.addEventListener('change', function() {
            clearTimeout(colorSaveTimer);
            colorSaveTimer = setTimeout(function() {
                fetch(API + '/cv/' + CV_ID + '/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        primaryColor: colorInput.value,
                        _token: CSRF
                    })
                })
                .then(function(r) { return r.json(); })
                .then(function(res) {
                    if (res.success) {
                        showSaveStatus('saved');
                    }
                })
                .catch(function() {});
            }, 400);
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
                .then(function(bytes) {
                    previewFrame.innerHTML = '<div id="pdf-preview-canvas" class="w-100" style="height: 70vh; overflow:auto; background:#fff;"></div>';
                    var host = previewFrame.querySelector('#pdf-preview-canvas');
                    return renderPdfCanvas(bytes, host);
                })
                .catch(function() {
                    previewFrame.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-exclamation-triangle me-1"></i>Preview failed</div>';
                });
        });
    }

    // ===== ENTRY REORDER + COLLAPSE (single handler to avoid conflicts) =====
    document.addEventListener('click', function(e) {
        // --- Handle reorder buttons first ---
        var btn = e.target.closest('.btn-entry-move-up, .btn-entry-move-down');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();

            var isUp = btn.classList.contains('btn-entry-move-up');
            var card = btn.closest('.entry-card');
            var container = card.closest('.entries-container');
            if (!container) return;

            var cards = Array.from(container.querySelectorAll('.entry-card'));
            var idx = cards.indexOf(card);
            if (idx === -1) return;
            if (isUp && idx === 0) return;
            if (!isUp && idx === cards.length - 1) return;

            // DOM swap
            if (isUp) {
                container.insertBefore(card, cards[idx - 1]);
            } else {
                container.insertBefore(cards[idx + 1], card);
            }

            // Update disabled states
            var updatedCards = Array.from(container.querySelectorAll('.entry-card'));
            updatedCards.forEach(function(c, i) {
                var upBtn = c.querySelector('.btn-entry-move-up');
                var downBtn = c.querySelector('.btn-entry-move-down');
                if (upBtn) upBtn.disabled = (i === 0);
                if (downBtn) downBtn.disabled = (i === updatedCards.length - 1);
            });

            // Persist order via existing API
            var entryOrder = updatedCards.map(function(c) {
                return parseInt(c.dataset.entryId);
            }).filter(function(id) { return !isNaN(id); });

            fetch(API + '/cv/' + CV_ID + '/section/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: entryOrder, _token: CSRF })
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success) showSaveStatus('saved');
            })
            .catch(function() {
                showSaveStatus('error');
            });
            return; // Don't process further
        }

        // --- Handle collapse toggle ---
        var header = e.target.closest('.entry-header');
        if (!header) return;
        if (e.target.closest('.entry-reorder-btns')) return;

        var card = header.closest('.entry-card');
        var body = card.querySelector('.entry-body');
        if (!body) return;

        var bsCollapse = bootstrap.Collapse.getOrCreateInstance(body, { toggle: false });
        bsCollapse.toggle();
    });

    // Update entry summary when fields change
    document.addEventListener('input', function(e) {
        if (!e.target.classList.contains('entry-field')) return;
        var card = e.target.closest('.entry-card');
        if (!card) return;
        var summaryEl = card.querySelector('.entry-summary');
        if (!summaryEl) return;

        var fields = card.querySelectorAll('.entry-field');
        var summary = '';
        for (var i = 0; i < fields.length; i++) {
            var val = fields[i].value.trim();
            if (val) { summary = val.length > 80 ? val.substring(0, 77) + '...' : val; break; }
        }
        summaryEl.textContent = summary || 'New Entry';
    });

    // ===== DOI AUTO-FILL =====
    var doiFillBtn = document.getElementById('btn-doi-fill');
    if (doiFillBtn) {
        doiFillBtn.addEventListener('click', function() {
            var container = document.getElementById('entries-publications');
            if (!container) return;

            var cards = Array.from(container.querySelectorAll('.entry-card'));
            if (cards.length === 0) {
                csAlert('No publication entries found. Add entries first, then enter a DOI in each.', {type: 'warning'});
                return;
            }

            // Find cards that have a DOI field with a value
            var toProcess = [];
            cards.forEach(function(card) {
                var doiField = card.querySelector('.entry-field[name="doi"]');
                if (doiField && doiField.value.trim()) {
                    toProcess.push({ card: card, doi: doiField.value.trim() });
                }
            });

            if (toProcess.length === 0) {
                csAlert('No DOI values found in any entry. Enter a DOI in the DOI field first, then click Fill via DOI.', {type: 'warning'});
                return;
            }

            // Disable button and show progress
            var btn = doiFillBtn;
            var originalHtml = btn.innerHTML;
            btn.disabled = true;
            var completed = 0;
            var total = toProcess.length;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Looking up 0/' + total + '...';

            // Process sequentially to avoid rate limiting
            function processNext(index) {
                if (index >= toProcess.length) {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    csAlert(completed + ' of ' + total + ' publication(s) filled successfully.', {type: 'success'});
                    return;
                }

                var item = toProcess[index];
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Looking up ' + (index + 1) + '/' + total + '...';

                fetch(API + '/api/doi/lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ doi: item.doi, _token: CSRF })
                })
                .then(function(r) { return r.json(); })
                .then(function(res) {
                    if (res.success && res.fields) {
                        // Fill fields in the card
                        var fields = res.fields;
                        Object.keys(fields).forEach(function(fieldName) {
                            var input = item.card.querySelector('.entry-field[name="' + fieldName + '"]');
                            if (input && fields[fieldName]) {
                                input.value = fields[fieldName];
                            }
                        });

                        // Update summary
                        var summaryEl = item.card.querySelector('.entry-summary');
                        if (summaryEl && fields.title) {
                            summaryEl.textContent = fields.title.length > 80 ? fields.title.substring(0, 77) + '...' : fields.title;
                        }

                        // Trigger autosave for this entry
                        var entryId = item.card.dataset.entryId;
                        if (entryId) {
                            var data = {};
                            item.card.querySelectorAll('.entry-field').forEach(function(f) {
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
                            .then(function(r) { return r.json(); })
                            .then(function(sr) {
                                if (sr.success) showSaveStatus('saved');
                            });
                        }

                        completed++;
                    } else if (res.error) {
                        // Highlight the card briefly to show error
                        item.card.classList.add('border-warning');
                        setTimeout(function() { item.card.classList.remove('border-warning'); }, 3000);
                    }
                })
                .catch(function() {
                    item.card.classList.add('border-warning');
                    setTimeout(function() { item.card.classList.remove('border-warning'); }, 3000);
                })
                .finally(function() {
                    // Small delay between requests to be polite to CrossRef
                    setTimeout(function() { processNext(index + 1); }, 500);
                });
            }

            processNext(0);
        });
    }
});
