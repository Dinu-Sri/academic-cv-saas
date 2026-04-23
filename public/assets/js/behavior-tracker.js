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
