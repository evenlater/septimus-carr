(function () {
  var raw = document.getElementById('calendar-data');
  var events = [];
  try {
    events = JSON.parse(raw.textContent || '[]');
  } catch (e) {
    events = [];
  }

  var byDate = {};
  events.forEach(function (ev) {
    if (!ev.date) return;
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  });

  var mobileQuery = window.matchMedia('(max-width: 640px)');
  var mode = mobileQuery.matches ? 'week' : 'month';
  var view = new Date();
  var deepLinkKey = null;

  var dateParam = new URLSearchParams(window.location.search).get('date');
  if (dateParam) {
    var parts = dateParam.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      var dy = parts[0], dm = parts[1] - 1, dd = parts[2] || 1;
      view = new Date(dy, dm, dd);
      deepLinkKey = dateKey(dy, dm, dd);
    }
  }

  var root = document.getElementById('calRoot');
  var label = document.getElementById('calPeriodLabel');
  var prevBtn = document.getElementById('calPrev');
  var nextBtn = document.getElementById('calNext');
  var yearInput = document.getElementById('calYearInput');
  var yearGoBtn = document.getElementById('calYearGo');
  var todayBtn = document.getElementById('calToday');

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  function eventClass(ev) {
    if (ev.type === 'essay') {
      var slug = (ev.category || '').toLowerCase();
      return 'cal-event pill-' + slug;
    }
    if (ev.type === 'reading') return 'cal-event cal-event-reading';
    return 'cal-event cal-event-historical';
  }

  function eventChip(ev) {
    var a = document.createElement('a');
    a.className = eventClass(ev);
    a.href = ev.url || '#';
    a.textContent = ev.title;
    return a;
  }

  function renderMonth() {
    var y = view.getFullYear(), m = view.getMonth();
    label.textContent = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    var first = new Date(y, m, 1);
    var gridStart = new Date(y, m, 1 - first.getDay());

    var grid = document.createElement('div');
    grid.className = 'cal-grid';

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) {
      var h = document.createElement('div');
      h.className = 'cal-dayhead';
      h.textContent = d;
      grid.appendChild(h);
    });

    for (var i = 0; i < 35; i++) {
      var cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      var inMonth = cellDate.getMonth() === m;
      var key = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

      var cell = document.createElement('div');
      cell.className = 'cal-cell' + (inMonth ? '' : ' cal-cell-out') + (key === deepLinkKey ? ' cal-cell-target' : '');

      var num = document.createElement('div');
      num.className = 'cal-daynum';
      num.textContent = cellDate.getDate();
      cell.appendChild(num);

      (byDate[key] || []).forEach(function (ev) {
        cell.appendChild(eventChip(ev));
      });

      grid.appendChild(cell);
    }

    root.innerHTML = '';
    root.appendChild(grid);
  }

  function renderWeek() {
    var start = new Date(view);
    start.setDate(view.getDate() - view.getDay());
    var end = new Date(start);
    end.setDate(start.getDate() + 6);

    label.textContent =
      start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' \u2013 ' +
      end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    var list = document.createElement('div');
    list.className = 'cal-week';

    for (var i = 0; i < 7; i++) {
      var cellDate = new Date(start);
      cellDate.setDate(start.getDate() + i);
      var key = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

      var row = document.createElement('div');
      row.className = 'cal-weekrow' + (key === deepLinkKey ? ' cal-weekrow-target' : '');

      var dh = document.createElement('div');
      dh.className = 'cal-weekday';
      dh.textContent = cellDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      row.appendChild(dh);

      var dayEvents = byDate[key] || [];
      if (dayEvents.length === 0) {
        var none = document.createElement('div');
        none.className = 'cal-weekempty';
        none.textContent = 'No entries';
        row.appendChild(none);
      } else {
        dayEvents.forEach(function (ev) {
          row.appendChild(eventChip(ev));
        });
      }

      list.appendChild(row);
    }

    root.innerHTML = '';
    root.appendChild(list);
  }

  function render() {
    if (mode === 'month') renderMonth();
    else renderWeek();
  }

  prevBtn.addEventListener('click', function () {
    if (mode === 'month') view.setMonth(view.getMonth() - 1);
    else view.setDate(view.getDate() - 7);
    render();
  });

  nextBtn.addEventListener('click', function () {
    if (mode === 'month') view.setMonth(view.getMonth() + 1);
    else view.setDate(view.getDate() + 7);
    render();
  });

  yearGoBtn.addEventListener('click', function () {
    var y = parseInt(yearInput.value, 10);
    if (!isNaN(y)) {
      view.setFullYear(y);
      view.setMonth(0);
      view.setDate(1);
      render();
    }
  });

  todayBtn.addEventListener('click', function () {
    view = new Date();
    render();
  });

  mobileQuery.addEventListener('change', function (e) {
    mode = e.matches ? 'week' : 'month';
    render();
  });

  render();
})();