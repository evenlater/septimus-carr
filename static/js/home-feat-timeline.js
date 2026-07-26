(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var root = document.getElementById('featTl');
  var dataEl = document.getElementById('feat-tl-data');
  if (!root || !dataEl) return;

  var slug = root.getAttribute('data-slug');
  var all = [];
  try {
    all = JSON.parse(dataEl.textContent || '[]');
  } catch (e) {
    return;
  }

  var events = all.filter(function (e) {
    return e.date && !isNaN(e.year) && (e.thread || []).indexOf(slug) !== -1;
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

  function render() {
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
      var g = svgEl('g', { class: 'feat-tl-point-group' });
      if (c.items.length === 1) {
        var ev = c.items[0];
        drawShape(g, ev.type, c.x, axisY, 6, pointColor(ev.type));
        var t = svgEl('title', {});
        t.textContent = (ev.precision === 'year' ? ev.year : ev.date) + ' — ' + ev.title;
        g.appendChild(t);
        g.addEventListener('click', function () { window.location.href = ev.url; });
      } else {
        g.appendChild(svgEl('circle', { cx: c.x, cy: axisY, r: 10, class: 'feat-tl-cluster' }));
        var count = svgEl('text', { x: c.x, y: axisY + 4, class: 'feat-tl-cluster-count', 'text-anchor': 'middle' });
        count.textContent = c.items.length;
        g.appendChild(count);
        var t2 = svgEl('title', {});
        t2.textContent = c.items.map(function (ev) { return (ev.precision === 'year' ? ev.year : ev.date) + ' — ' + ev.title; }).join('\n');
        g.appendChild(t2);
        var slugs = c.items.map(function (ev) { return ev.slug; });
        g.addEventListener('click', function () {
          window.location.href = '/timeline/?highlight=' + encodeURIComponent(slugs.join(',')) + '&start=' + start + '&end=' + end;
        });
      }
      svg.appendChild(g);
    });
  }

  render();
  root.hidden = false;
  window.addEventListener('resize', render);
})();
