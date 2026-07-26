(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var raw = document.getElementById('timeline-data');
  var events = [];
  try {
    events = JSON.parse(raw.textContent || '[]');
  } catch (e) {
    events = [];
  }
  events = events.filter(function (e) { return e.date && !isNaN(e.year); });
  events.sort(function (a, b) {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  // ---- thread labels -------------------------------------------------
  var threadLabels = {};
  events.forEach(function (e) {
    if (e.type === 'essay' && e.thread && e.thread.length === 1) {
      threadLabels[e.thread[0]] = e.title;
    }
  });
  function prettifySlug(slug) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function threadLabel(slug) {
    return threadLabels[slug] || prettifySlug(slug);
  }

  var allThreads = [];
  var threadCounts = {};
  events.forEach(function (e) {
    (e.thread || []).forEach(function (t) {
      if (threadCounts[t] === undefined) { threadCounts[t] = 0; allThreads.push(t); }
      threadCounts[t]++;
    });
  });
  allThreads.sort(function (a, b) { return threadLabel(a).localeCompare(threadLabel(b)); });

  // ---- URL params ------------------------------------------------------
  var params = new URLSearchParams(window.location.search);

  var activeThreads = new Set(allThreads);
  if (params.get('threads')) {
    var reqThreads = params.get('threads').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var valid = reqThreads.filter(function (t) { return allThreads.indexOf(t) !== -1; });
    if (valid.length) activeThreads = new Set(valid);
  }

  var highlightSlugs = (params.get('highlight') || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  var range = { start: null, end: null };
  var pStart = parseInt(params.get('start'), 10);
  var pEnd = parseInt(params.get('end'), 10);
  if (!isNaN(pStart)) range.start = pStart;
  if (!isNaN(pEnd)) range.end = pEnd;

  // ---- DOM refs ----------------------------------------------------
  var svg = document.getElementById('tlSvg');
  var scrollWrap = document.getElementById('tlScroll');
  var popover = document.getElementById('tlPopover');
  var startInput = document.getElementById('tlStartInput');
  var endInput = document.getElementById('tlEndInput');
  var goBtn = document.getElementById('tlRangeGo');
  var fitBtn = document.getElementById('tlFit');
  var threadsToggle = document.getElementById('tlThreadsToggle');
  var threadsCount = document.getElementById('tlThreadsCount');
  var threadsPanel = document.getElementById('tlThreadsPanel');
  var threadsFilter = document.getElementById('tlThreadsFilter');
  var threadsList = document.getElementById('tlThreadsList');
  var threadsAllBtn = document.getElementById('tlThreadsAll');
  var threadsNoneBtn = document.getElementById('tlThreadsNone');

  // ---- helpers -------------------------------------------------------
  function visibleEvents() {
    return events.filter(function (e) {
      return (e.thread || []).some(function (t) { return activeThreads.has(t); });
    });
  }

  function autoRange(evs) {
    if (!evs.length) return { start: 1990, end: 2026 };
    var years = evs.map(function (e) { return e.year; });
    var min = Math.min.apply(null, years), max = Math.max.apply(null, years);
    if (min === max) { min -= 5; max += 5; }
    var pad = Math.max(2, Math.round((max - min) * 0.08));
    return { start: min - pad, end: max + pad };
  }

  var NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  function niceStep(span) {
    for (var i = 0; i < NICE_STEPS.length; i++) {
      if (span / NICE_STEPS[i] <= 9) return NICE_STEPS[i];
    }
    return NICE_STEPS[NICE_STEPS.length - 1];
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  var TYPE_ORDER = { essay: 0, reading: 1, historical: 2 };
  var THREAD_PALETTE = ['#C4A055', '#1A5A5A', '#8B1A28', '#1A4878', '#4A2878', '#285018', '#7A5518', '#304818'];
  function threadColor(slug) {
    var idx = allThreads.indexOf(slug);
    return THREAD_PALETTE[idx % THREAD_PALETTE.length];
  }
  var TYPE_COLOR = { essay: '#C4A055', reading: '#6A5E54', historical: '#1A5A5A' };

  function pointColor(ev, merging) {
    if (merging) {
      var t = (ev.thread || [])[0];
      return threadColor(t);
    }
    return TYPE_COLOR[ev.type] || '#2A0E38';
  }

  function drawShape(parent, type, cx, cy, r, fill, extraClass) {
    var el;
    if (type === 'essay') {
      el = svgEl('circle', { cx: cx, cy: cy, r: r, fill: fill });
    } else if (type === 'reading') {
      el = svgEl('rect', { x: cx - r * 0.82, y: cy - r * 0.82, width: r * 1.64, height: r * 1.64, fill: fill });
    } else {
      el = svgEl('rect', {
        x: cx - r * 0.72, y: cy - r * 0.72, width: r * 1.44, height: r * 1.44, fill: fill,
        transform: 'rotate(45 ' + cx + ' ' + cy + ')'
      });
    }
    el.setAttribute('class', 'tl-point tl-point-' + type + (extraClass ? ' ' + extraClass : ''));
    parent.appendChild(el);
    return el;
  }

  // ---- popover ---------------------------------------------------------
  var pinned = false;
  var hasAutoOpened = false;
  function hidePopover() {
    popover.hidden = true;
    pinned = false;
  }
  function showPopover(evs, anchorX, anchorY, pin) {
    popover.innerHTML = '';
    evs.forEach(function (ev) {
      var row = document.createElement('a');
      var isH = highlightSlugs.indexOf(ev.slug) !== -1;
      row.className = 'tl-pop-row' + (isH ? ' tl-pop-row-highlight' : '');
      row.href = ev.url || '#';
      var yearSpan = document.createElement('span');
      yearSpan.className = 'tl-pop-year';
      yearSpan.textContent = ev.precision === 'year' ? ev.year : ev.date;
      row.appendChild(yearSpan);
      if (ev.image) {
        var img = document.createElement('img');
        img.className = 'tl-pop-img';
        img.src = ev.image;
        img.alt = '';
        img.loading = 'lazy';
        row.appendChild(img);
      }
      var title = document.createElement('span');
      title.className = 'tl-pop-title';
      title.textContent = ev.title;
      row.appendChild(title);
      popover.appendChild(row);
    });
    var rootRect = document.getElementById('tlRoot').getBoundingClientRect();
    var left = Math.min(
      Math.max(8, anchorX - rootRect.left - 110),
      rootRect.width - 228
    );
    popover.style.left = left + 'px';
    popover.style.top = (anchorY - rootRect.top - 14) + 'px';
    popover.style.transform = 'translateY(-100%)';
    popover.hidden = false;
    if (pin) pinned = true;
  }
  document.addEventListener('click', function (e) {
    if (pinned && !popover.contains(e.target) && !e.target.closest('.tl-point, .tl-cluster')) {
      hidePopover();
    }
  });

  function currentRange(evs) {
    return range.start !== null && range.end !== null ? range : autoRange(evs);
  }

  function syncRangeInputs() {
    var r = currentRange(visibleEvents());
    var start = r.start, end = r.end;
    if (end <= start) end = start + 1;
    startInput.value = start;
    endInput.value = end;
  }

  // ---- main render -------------------------------------------------
  function render() {
    var evs = visibleEvents();
    var r = currentRange(evs);
    var start = r.start, end = r.end;
    if (end <= start) end = start + 1;

    var span = end - start;
    var width = scrollWrap.clientWidth || 900;
    var height = 220;
    var marginL = 40, marginR = 40, axisY = 150;

    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.innerHTML = '';

    function xFor(year) {
      return marginL + ((year - start) / span) * (width - marginL - marginR);
    }

    // axis line
    svg.appendChild(svgEl('line', {
      x1: marginL, y1: axisY, x2: width - marginR, y2: axisY, class: 'tl-axis-line'
    }));

    // ticks
    var step = niceStep(span);
    var tickStart = Math.ceil(start / step) * step;
    for (var y = tickStart; y <= end; y += step) {
      var tx = xFor(y);
      svg.appendChild(svgEl('line', { x1: tx, y1: axisY - 4, x2: tx, y2: axisY + 4, class: 'tl-tick' }));
      var label = svgEl('text', { x: tx, y: axisY + 20, class: 'tl-tick-label', 'text-anchor': 'middle' });
      label.textContent = y;
      svg.appendChild(label);
    }

    var merging = activeThreads.size < allThreads.length;

    // project + sort
    var pts = evs.map(function (ev) {
      return { ev: ev, x: xFor(ev.year) };
    }).sort(function (a, b) { return a.x - b.x; });

    // cluster (chain-linkage on pixel proximity)
    var CLUSTER_PX = 15;
    var clusters = [];
    pts.forEach(function (p) {
      var last = clusters[clusters.length - 1];
      if (last && (p.x - last.x) < CLUSTER_PX) {
        last.items.push(p.ev);
        last.x = (last.x * (last.items.length - 1) + p.x) / last.items.length;
      } else {
        clusters.push({ x: p.x, items: [p.ev] });
      }
    });

    var highlightPoints = [];
    var clustersWithHighlight = [];

    clusters.forEach(function (c) {
      var isHighlightCluster = c.items.some(function (ev) { return highlightSlugs.indexOf(ev.slug) !== -1; });
      if (c.items.length === 1) {
        var ev = c.items[0];
        var isH = highlightSlugs.indexOf(ev.slug) !== -1;
        var baseR = isH ? 7.5 : 5;
        var g = svgEl('g', { class: 'tl-point-group', tabindex: '0', role: 'button' });
        if (isH) {
          g.appendChild(svgEl('circle', { cx: c.x, cy: axisY, r: baseR + 4, class: 'tl-point-halo' }));
        }
        drawShape(g, ev.type, c.x, axisY, baseR, pointColor(ev, merging));
        if (isH) {
          var lbl = svgEl('text', {
            x: c.x, y: axisY - 16, class: 'tl-point-label', 'text-anchor': 'middle'
          });
          lbl.textContent = ev.title;
          g.appendChild(lbl);
          highlightPoints.push({ x: c.x, year: ev.year, ev: ev });
        }
        g.addEventListener('mouseenter', function () {
          if (!pinned) showPopover([ev], c.x + svg.getBoundingClientRect().left, axisY + svg.getBoundingClientRect().top, false);
        });
        g.addEventListener('mouseleave', function () { if (!pinned) hidePopover(); });
        g.addEventListener('click', function (e) {
          e.stopPropagation();
          showPopover([ev], c.x + svg.getBoundingClientRect().left, axisY + svg.getBoundingClientRect().top, true);
        });
        svg.appendChild(g);
      } else {
        var r2 = 9 + Math.min(6, c.items.length);
        var g2 = svgEl('g', { class: 'tl-cluster', tabindex: '0', role: 'button' });
        g2.appendChild(svgEl('circle', { cx: c.x, cy: axisY, r: r2, class: 'tl-cluster-circle' + (isHighlightCluster ? ' tl-cluster-highlight' : '') }));
        var count = svgEl('text', { x: c.x, y: axisY + 4, class: 'tl-cluster-count', 'text-anchor': 'middle' });
        count.textContent = c.items.length;
        g2.appendChild(count);
        var itemsCopy = c.items;
        g2.addEventListener('mouseenter', function () {
          if (!pinned) showPopover(itemsCopy, c.x + svg.getBoundingClientRect().left, axisY + svg.getBoundingClientRect().top, false);
        });
        g2.addEventListener('mouseleave', function () { if (!pinned) hidePopover(); });
        g2.addEventListener('click', function (e) {
          e.stopPropagation();
          showPopover(itemsCopy, c.x + svg.getBoundingClientRect().left, axisY + svg.getBoundingClientRect().top, true);
        });
        svg.appendChild(g2);
        if (isHighlightCluster) {
          clustersWithHighlight.push({ x: c.x, items: c.items });
        }
        c.items.forEach(function (ev) {
          if (highlightSlugs.indexOf(ev.slug) !== -1) highlightPoints.push({ x: c.x, year: ev.year, ev: ev });
        });
      }
    });

    // connectors between highlighted points, in chronological order
    if (highlightPoints.length >= 2) {
      highlightPoints.sort(function (a, b) { return a.year - b.year; });
      for (var i = 0; i < highlightPoints.length - 1; i++) {
        var a = highlightPoints[i], b = highlightPoints[i + 1];
        var cy = axisY - 42;
        var path = svgEl('path', {
          d: 'M ' + a.x + ' ' + (axisY - 10) + ' Q ' + ((a.x + b.x) / 2) + ' ' + cy + ' ' + b.x + ' ' + (axisY - 10),
          class: 'tl-connector'
        });
        svg.insertBefore(path, svg.firstChild.nextSibling);
        var delta = b.year - a.year;
        var midX = (a.x + b.x) / 2;
        var dLabel = svgEl('text', { x: midX, y: cy - 6, class: 'tl-connector-label', 'text-anchor': 'middle' });
        dLabel.textContent = delta === 0 ? 'same year' : (delta + (delta === 1 ? ' year apart' : ' years apart'));
        svg.appendChild(dLabel);
      }
    }

    if (!hasAutoOpened && highlightSlugs.length && clustersWithHighlight.length) {
      hasAutoOpened = true;
      var target = clustersWithHighlight[0];
      var svgRect = svg.getBoundingClientRect();
      showPopover(target.items, target.x + svgRect.left, axisY + svgRect.top, true);
    }
  }

  // ---- thread panel ---------------------------------------------------
  function renderThreadsPanel(filterText) {
    threadsList.innerHTML = '';
    var q = (filterText || '').toLowerCase();
    allThreads.forEach(function (t) {
      var lbl = threadLabel(t);
      if (q && lbl.toLowerCase().indexOf(q) === -1) return;
      var row = document.createElement('label');
      row.className = 'tl-thread-row';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = activeThreads.has(t);
      cb.addEventListener('change', function () {
        if (cb.checked) activeThreads.add(t); else activeThreads.delete(t);
        syncUrl();
        updateThreadsCount();
        render();
      });
      row.appendChild(cb);
      var text = document.createElement('span');
      text.textContent = lbl + ' (' + threadCounts[t] + ')';
      row.appendChild(text);
      threadsList.appendChild(row);
    });
  }

  function updateThreadsCount() {
    if (activeThreads.size === allThreads.length) {
      threadsCount.textContent = '';
    } else {
      threadsCount.textContent = activeThreads.size + '/' + allThreads.length;
    }
  }

  threadsToggle.addEventListener('click', function () {
    var open = threadsPanel.hidden;
    threadsPanel.hidden = !open;
    threadsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderThreadsPanel(threadsFilter.value);
  });
  threadsFilter.addEventListener('input', function () { renderThreadsPanel(threadsFilter.value); });
  threadsAllBtn.addEventListener('click', function () {
    activeThreads = new Set(allThreads);
    renderThreadsPanel(threadsFilter.value);
    updateThreadsCount();
    syncUrl();
    render();
  });
  threadsNoneBtn.addEventListener('click', function () {
    activeThreads = new Set();
    renderThreadsPanel(threadsFilter.value);
    updateThreadsCount();
    syncUrl();
    render();
  });

  // ---- range controls ---------------------------------------------
  function applyRangeInputs() {
    var evs = visibleEvents();
    var fallback = currentRange(evs);
    var s = parseInt(startInput.value, 10);
    var e = parseInt(endInput.value, 10);
    if (isNaN(s)) s = fallback.start;
    if (isNaN(e)) e = fallback.end;
    if (s > e) { var tmp = s; s = e; e = tmp; }
    if (e === s) e = s + 1;
    range = { start: s, end: e };
    syncUrl();
    render();
    syncRangeInputs();
  }
  goBtn.addEventListener('click', applyRangeInputs);
  [startInput, endInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        applyRangeInputs();
        inp.blur();
      }
    });
  });
  fitBtn.addEventListener('click', function () {
    range = { start: null, end: null };
    syncUrl();
    render();
    syncRangeInputs();
  });

  function syncUrl() {
    var p = new URLSearchParams(window.location.search);
    if (range.start !== null && range.end !== null) {
      p.set('start', range.start);
      p.set('end', range.end);
    } else {
      p.delete('start');
      p.delete('end');
    }
    if (activeThreads.size < allThreads.length) {
      p.set('threads', Array.from(activeThreads).join(','));
    } else {
      p.delete('threads');
    }
    var qs = p.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  window.addEventListener('resize', render);
  scrollWrap.addEventListener('scroll', function () { hidePopover(); });

  updateThreadsCount();
  render();
  syncRangeInputs();
})();