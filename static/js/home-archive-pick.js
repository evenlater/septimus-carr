(function () {
  var root = document.getElementById('archPick');
  var dataEl = document.getElementById('arch-pick-data');
  if (!root || !dataEl) return;

  var items = [];
  try {
    items = JSON.parse(dataEl.textContent || '[]');
  } catch (e) {
    return;
  }
  if (!items.length) return;

  // Deterministic per calendar day (visitor's local date), so everyone sees
  // the same pick all day, and it changes the next day without a rebuild.
  // Uses an integer mix (not a plain string hash) so consecutive days don't
  // walk the pool in a visible sequence.
  function daySeedIndex(poolSize) {
    var today = new Date();
    var epochDay = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    var x = (epochDay + 0x9E3779B9) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = x ^ (x >>> 16);
    return Math.abs(x) % poolSize;
  }

  var idx = daySeedIndex(items.length);
  var pick = items[idx];

  var link = document.getElementById('archPickLink');
  var img = document.getElementById('archPickImg');
  var imgWrap = document.getElementById('archPickImgWrap');
  var title = document.getElementById('archPickTitle');
  var date = document.getElementById('archPickDate');

  link.href = pick.url;
  title.textContent = pick.title;
  date.textContent = pick.date;
  if (pick.image) {
    img.src = pick.image;
    img.alt = pick.title;
  } else if (imgWrap) {
    imgWrap.style.display = 'none';
  }

  root.hidden = false;
})();
