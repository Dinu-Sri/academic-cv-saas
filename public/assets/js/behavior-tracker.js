/*
 * CVScholar behavior tracker (timeline-style analytics)
 */
(function () {
    var cfg = window.CVBehaviorConfig || {};
    if (!cfg.enabled || !cfg.endpoint) {
        return;
    }

    if (Math.floor(Math.random() * 100) + 1 > (cfg.samplingRate || 100)) {
        return;
    }

    var SESSION_KEY = 'cvb_session_id';
    var sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = makeId();
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    var queue = [];
    var flushTimer = null;
    var pageStartedAt = Date.now();
    var lastClickSelector = '';
    var lastClickAt = 0;
    var repeatedClickCount = 0;
    var seenScrollMilestones = {};
    var trackedForms = {};
    var fieldLastEmitAt = {};

    function makeId() {
        var rand = Math.random().toString(36).slice(2);
        var now = Date.now().toString(36);
        return (now + '_' + rand).slice(0, 40);
    }

    function currentPath() {
        return window.location.pathname + window.location.search;
    }

    function selectorFor(el) {
        if (!el || !(el instanceof Element)) return '';
        if (el.id) return '#' + el.id;

        var parts = [];
        var cur = el;
        for (var i = 0; i < 3 && cur && cur.nodeType === 1; i++) {
            var part = cur.tagName.toLowerCase();
            if (cur.classList && cur.classList.length) {
                part += '.' + Array.prototype.slice.call(cur.classList, 0, 2).join('.');
            }
            parts.unshift(part);
            cur = cur.parentElement;
        }
        return parts.join(' > ').slice(0, 255);
    }

    function safeText(el) {
        if (!el || !(el instanceof Element)) return '';
        if (cfg.maskInputs && (el.matches('input, textarea') || el.closest('input, textarea'))) {
            return '[masked]';
        }
        var txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        return txt.slice(0, 80);
    }

    function fieldName(el) {
        if (!el || !(el instanceof Element)) return 'unknown';
        return (el.getAttribute('name') || el.id || el.getAttribute('data-field') || el.tagName.toLowerCase()).slice(0, 120);
    }

    function formKey(el) {
        if (!el || !(el instanceof Element)) return 'unknown_form';
        var form = el.closest('form');
        if (!form) return 'no_form';
        var idPart = form.id ? '#' + form.id : '';
        var actionPart = (form.getAttribute('action') || '').slice(0, 80);
        return (idPart || actionPart || selectorFor(form)).slice(0, 120);
    }

    function pushEvent(eventType, extra) {
        var item = {
            event_type: eventType,
            path: currentPath(),
            event_at_ms: Date.now(),
            metadata: extra || {}
        };
        if (extra && typeof extra.selector === 'string') {
            item.selector = extra.selector.slice(0, 255);
        }
        if (extra && typeof extra.duration_ms === 'number') {
            item.duration_ms = Math.max(0, Math.min(extra.duration_ms, 86400000));
        }
        if (extra && typeof extra.scroll_depth === 'number') {
            item.scroll_depth = Math.max(0, Math.min(extra.scroll_depth, 100));
        }
        if (extra && typeof extra.frustration_score === 'number') {
            item.frustration_score = Math.max(0, Math.min(extra.frustration_score, 10));
        }

        queue.push(item);

        if (queue.length >= 20) {
            flush();
        } else {
            scheduleFlush();
        }
    }

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(function () {
            flushTimer = null;
            flush();
        }, 12000);
    }

    function flush(useBeacon) {
        if (!queue.length) return;

        var payload = {
            csrf_token: cfg.csrfToken || '',
            session_id: sessionId,
            path: currentPath(),
            events: queue.splice(0, queue.length)
        };

        var body = JSON.stringify(payload);

        if (useBeacon && navigator.sendBeacon) {
            var blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon(cfg.endpoint, blob);
            return;
        }

        fetch(cfg.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': cfg.csrfToken || ''
            },
            body: body,
            credentials: 'same-origin',
            keepalive: true
        }).catch(function () {
            // Non-blocking by design.
        });
    }

    function reportPageLeave() {
        var dwell = Date.now() - pageStartedAt;

        var abandonedForms = [];
        Object.keys(trackedForms).forEach(function (key) {
            if (trackedForms[key] && trackedForms[key].started && !trackedForms[key].submitted && trackedForms[key].filled > 0) {
                abandonedForms.push({
                    form_key: key,
                    fields_filled: trackedForms[key].filled
                });
            }
        });

        if (abandonedForms.length > 0) {
            pushEvent('form_abandon', {
                frustration_score: 5,
                metadata: {
                    forms_count: abandonedForms.length,
                    forms: abandonedForms
                }
            });
        }

        pushEvent('page_leave', {
            duration_ms: dwell,
            metadata: {
                visibility: document.visibilityState || 'unknown'
            }
        });
        flush(true);
    }

    pushEvent('page_view', {
        metadata: {
            title: document.title.slice(0, 120),
            referrer: (document.referrer || '').slice(0, 255),
            viewport_w: window.innerWidth,
            viewport_h: window.innerHeight
        }
    });

    if (window.location.pathname === '/plans') {
        pushEvent('pricing_view', {
            metadata: {
                path: currentPath()
            }
        });
    }

    document.addEventListener('click', function (ev) {
        var target = ev.target && ev.target.closest('a, button, [role="button"], .btn, input, select, textarea');
        if (!target) return;

        var sel = selectorFor(target);
        var now = Date.now();
        if (sel === lastClickSelector && (now - lastClickAt) < 1200) {
            repeatedClickCount += 1;
        } else {
            repeatedClickCount = 1;
        }

        lastClickSelector = sel;
        lastClickAt = now;

        pushEvent('click', {
            selector: sel,
            metadata: {
                text: safeText(target),
                tag: target.tagName.toLowerCase(),
                href: target.getAttribute('href') || ''
            }
        });

        if (window.location.pathname === '/plans') {
            var planEl = target.closest('[data-plan], [data-plan-slug], .plan-card, .pricing-card');
            var planSlug = '';
            if (planEl) {
                planSlug = planEl.getAttribute('data-plan') || planEl.getAttribute('data-plan-slug') || '';
            }
            if (!planSlug && target.getAttribute('href') && target.getAttribute('href').indexOf('/plans/checkout/') !== -1) {
                var parts = target.getAttribute('href').split('/plans/checkout/');
                planSlug = (parts[1] || '').split('?')[0];
            }

            pushEvent('pricing_click_plan', {
                selector: sel,
                metadata: {
                    plan: (planSlug || 'unknown').slice(0, 50),
                    text: safeText(target)
                }
            });
        }

        if (repeatedClickCount >= 3) {
            pushEvent('rage_click', {
                selector: sel,
                frustration_score: 8,
                metadata: {
                    repeat_count: repeatedClickCount
                }
            });
        }
    }, true);

    document.addEventListener('focusin', function (ev) {
        var target = ev.target;
        if (!target || !(target instanceof Element)) return;
        if (!target.matches('input, textarea, select')) return;

        var fName = fieldName(target);
        var fKey = formKey(target);
        if (!trackedForms[fKey]) {
            trackedForms[fKey] = { started: false, submitted: false, filled: 0 };
        }

        pushEvent('field_focus', {
            selector: selectorFor(target),
            metadata: {
                field_name: fName,
                field_type: (target.getAttribute('type') || target.tagName.toLowerCase()).slice(0, 40),
                form_key: fKey
            }
        });
    }, true);

    document.addEventListener('input', function (ev) {
        var target = ev.target;
        if (!target || !(target instanceof Element)) return;
        if (!target.matches('input, textarea, select')) return;

        var fName = fieldName(target);
        var fKey = formKey(target);
        var emitKey = fKey + '|' + fName;
        var now = Date.now();

        if (!trackedForms[fKey]) {
            trackedForms[fKey] = { started: false, submitted: false, filled: 0 };
        }

        if (!trackedForms[fKey].started) {
            trackedForms[fKey].started = true;
            pushEvent('form_start', {
                metadata: {
                    form_key: fKey
                }
            });
        }

        if (!fieldLastEmitAt[emitKey] || (now - fieldLastEmitAt[emitKey]) > 1500) {
            var value = '';
            try {
                value = String(target.value || '');
            } catch (e) {
                value = '';
            }

            pushEvent('field_fill', {
                selector: selectorFor(target),
                metadata: {
                    field_name: fName,
                    field_type: (target.getAttribute('type') || target.tagName.toLowerCase()).slice(0, 40),
                    value_length: value.length,
                    form_key: fKey
                }
            });

            fieldLastEmitAt[emitKey] = now;
        }
    }, true);

    document.addEventListener('change', function (ev) {
        var target = ev.target;
        if (!target || !(target instanceof Element)) return;
        if (!target.matches('input, textarea, select')) return;

        var fName = fieldName(target);
        var fKey = formKey(target);
        if (!trackedForms[fKey]) {
            trackedForms[fKey] = { started: false, submitted: false, filled: 0 };
        }

        trackedForms[fKey].filled += 1;
        pushEvent('field_blur', {
            selector: selectorFor(target),
            metadata: {
                field_name: fName,
                form_key: fKey
            }
        });
    }, true);

    document.addEventListener('submit', function (ev) {
        var form = ev.target;
        if (!form || !(form instanceof HTMLFormElement)) return;

        var fKey = formKey(form);
        if (!trackedForms[fKey]) {
            trackedForms[fKey] = { started: false, submitted: false, filled: 0 };
        }
        trackedForms[fKey].submitted = true;

        var filledCount = 0;
        var fields = form.querySelectorAll('input, textarea, select');
        for (var i = 0; i < fields.length; i++) {
            var value = '';
            try {
                value = String(fields[i].value || '');
            } catch (e) {
                value = '';
            }
            if (value.trim() !== '') {
                filledCount++;
            }
        }

        pushEvent('form_submit', {
            metadata: {
                form_key: fKey,
                fields_total: fields.length,
                fields_filled: filledCount
            }
        });
    }, true);

    document.addEventListener('change', function (ev) {
        var target = ev.target;
        if (!target || !(target instanceof Element)) return;

        var templateId = '';
        if (target.matches('[name="template_id"], [data-template-id]')) {
            templateId = String(target.value || target.getAttribute('data-template-id') || '').slice(0, 50);
        } else if (target.closest('[data-template-id]')) {
            templateId = String(target.closest('[data-template-id]').getAttribute('data-template-id') || '').slice(0, 50);
        }

        if (templateId !== '') {
            pushEvent('cv_template_change', {
                selector: selectorFor(target),
                metadata: {
                    template_id: templateId
                }
            });
        }
    }, true);

    window.addEventListener('scroll', function () {
        var doc = document.documentElement;
        var maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
        var depth = Math.round((window.scrollY / maxScroll) * 100);
        var milestones = [25, 50, 75, 100];

        for (var i = 0; i < milestones.length; i++) {
            var m = milestones[i];
            if (depth >= m && !seenScrollMilestones[m]) {
                seenScrollMilestones[m] = true;
                pushEvent('scroll_depth', {
                    scroll_depth: m,
                    metadata: { depth: m }
                });
            }
        }
    }, { passive: true });

    window.addEventListener('error', function (ev) {
        pushEvent('js_error', {
            frustration_score: 6,
            metadata: {
                message: String(ev.message || '').slice(0, 255),
                source: String(ev.filename || '').slice(0, 255),
                line: ev.lineno || 0,
                col: ev.colno || 0
            }
        });
    });

    window.addEventListener('unhandledrejection', function (ev) {
        pushEvent('unhandled_rejection', {
            frustration_score: 6,
            metadata: {
                message: String((ev.reason && ev.reason.message) || ev.reason || '').slice(0, 255)
            }
        });
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            reportPageLeave();
        } else if (document.visibilityState === 'visible') {
            pageStartedAt = Date.now();
            pushEvent('focus', { metadata: { source: 'visibilitychange' } });
        }
    });

    window.addEventListener('beforeunload', function () {
        reportPageLeave();
    });

    window.addEventListener('pagehide', function () {
        reportPageLeave();
    });

    window.setInterval(function () {
        flush();
    }, 15000);
})();
