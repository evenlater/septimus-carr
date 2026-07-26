(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var root = document.getElementById('featTl');
  var dataEl = document.getElementById('feat-tl-data');
  if (!root || !dataEl) return;

  var slug = root.getAttribute('data-slug');
  var featUrl = root.getAttribute('data-url');
  var all = [];
  try {
    all = JSON.parse(dataEl.textContent || '[]');
  } catch (e) {
    return;
  }

  var events = all.filter(function (e) {
    if (!e.date || isNaN(e.year)) return false;
    if (e.url === featUrl) return true;                          // sourced from this post, regardless of thread override
    return (e.thread || []).indexOf(slug) !== -1;                 // or explicitly threaded to this post's slug from elsewhere
  });
  if (!events.length) return;

  events.sort(function (a, b) {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  var svg = document.getElementById('featTlSvg');
  var scrollWrap = root.querySelector('.feat-tl-scroll');
  var link = document.getElementById('featTlLink');
  var popover = document.getElementById('featTlPopover');

  var years = events.map(function (e) { return e.year; });
  var min = Math.min.apply(null, years), max = Math.max.apply(null, years);
  var pad = min === max ? 3 : Math.max(2, Math.round((max - min) * 0.15));
  var start = min - pad, end = max + pad;

  var allSlugs = events.map(function (e) { return e.slug; });
  link.href = '/timeline/?highlight=' + encodeURIComponent(allSlugs.join(',')) +
    '&start=' + start + '&end=' + end;

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function drawShape(g, type, cx, cy, r, fill) {
    if (type === 'reading') {
      g.appendChild(svgEl('rect', { x: cx - r, y: cy - r, width: r * 2, height: r * 2, class: 'feat-tl-point', style: 'fill:' + fill }));
    } else if (type === 'historical') {
      g.appendChild(svgEl('rect', {
        x: cx - r * 0.8, y: cy - r * 0.8, width: r * 1.6, height: r * 1.6,
        transform: 'rotate(45 ' + cx + ' ' + cy + ')', class: 'feat-tl-point', style: 'fill:' + fill
      }));
    } else {
      g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r, class: 'feat-tl-point', style: 'fill:' + fill }));
    }
  }

  function pointColor(type) {
    if (type === 'reading') return '#6A5E54';
    if (type === 'historical') return '#1A5A5A';
    return '#C4A055';
  }

  // ---- popover (tap/click driven — works identically on touch and mouse,
  // unlike a native SVG <title> tooltip, which never appears on touch) ----
  function hidePopover() { popover.hidden = true; }
  function showPopover(evs, anchorX) {
    popover.innerHTML = '';
    evs.forEach(function (ev) {
      var row = document.createElement('a');
      row.className = 'tl-pop-row';
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
    var scrollRect = scrollWrap.getBoundingClientRect();
    var left = Math.min(Math.max(8, anchorX - 110), scrollRect.width - 228);
    popover.style.left = left + 'px';
    popover.hidden = false;
  }
  document.addEventListener('click', function (e) {
    if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('.feat-tl-point-group')) {
      hidePopover();
    }
  });

  function render() {
    hidePopover();
    var width = scrollWrap.clientWidth || 600;
    var height = 76;
    var marginL = 20, marginR = 20, axisY = 44;
    var span = end - start;

    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.innerHTML = '';

    function xFor(year) { return marginL + ((year - start) / span) * (width - marginL - marginR); }

    svg.appendChild(svgEl('line', {
      x1: marginL, y1: axisY, x2: width - marginR, y2: axisY, class: 'feat-tl-axis'
    }));

    var pts = events.map(function (ev) { return { ev: ev, x: xFor(ev.year) }; })
      .sort(function (a, b) { return a.x - b.x; });

    var CLUSTER_PX = 14;
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

    clusters.forEach(function (c) {
      var g = svgEl('g', { class: 'feat-tl-point-group', tabindex: '0', role: 'button' });
      if (c.items.length === 1) {
        var ev = c.items[0];
        drawShape(g, ev.type, c.x, axisY, 6, pointColor(ev.type));
      } else {
        g.appendChild(svgEl('circle', { cx: c.x, cy: axisY, r: 10, class: 'feat-tl-cluster' }));
        var count = svgEl('text', { x: c.x, y: axisY + 4, class: 'feat-tl-cluster-count', 'text-anchor': 'middle' });
        count.textContent = c.items.length;
        g.appendChild(count);
      }
      var itemsCopy = c.items;
      var cx = c.x;
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        showPopover(itemsCopy, cx);
      });
      svg.appendChild(g);
    });
  }

  render();
  root.hidden = false;
  window.addEventListener('resize', render);
})();
