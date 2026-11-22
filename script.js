const KEY_COMPLAINTS = 'messComplaints', KEY_FEEDBACK = 'messFeedback';

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
}
function save(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { alert('Could not save: browser storage is unavailable.'); }
}
function mk(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

/* Dark / light mode */
(function () {
  const root = document.documentElement, nav = document.querySelector('nav');
  if (!nav) return;
  const btn = mk('button', '', 'theme-toggle');
  btn.type = 'button';
  function paint() {
    const dark = root.dataset.theme === 'dark';
    btn.textContent = dark ? '\u2600 Light' : '\u263E Dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  btn.addEventListener('click', () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = t;
    try { localStorage.setItem('messTheme', t); } catch (e) {}
    paint();
  });
  paint();
  nav.appendChild(btn);
})();

/* Complaint form */
const form = document.getElementById('complaintForm');
if (form) {
  document.getElementById('date').max = new Date().toISOString().split('T')[0];
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const list = load(KEY_COMPLAINTS);
    list.unshift({
      id: Date.now(),
      name: d.name.trim() || 'Anonymous', roll: d.roll.trim(),
      category: d.category, meal: d.meal, incident_date: d.date,
      rating: d.rating, priority: d.priority,
      comment: d.comment.trim(), suggestion: d.suggestion.trim(),
      status: 'Open'
    });
    save(KEY_COMPLAINTS, list);
    form.reset();
    const msg = document.getElementById('msg');
    msg.hidden = false;
    msg.scrollIntoView({ behavior: 'smooth' });
  });
}

/* Quick feedback form */
const fbForm = document.getElementById('feedbackForm');
if (fbForm) {
  const wrap = document.getElementById('contactWrap'), input = document.getElementById('contact'), label = document.getElementById('contactLabel');
  fbForm.querySelectorAll('input[name=notify]').forEach(r => r.addEventListener('change', () => {
    const v = fbForm.elements.notify.value;
    wrap.hidden = v === 'none';
    label.textContent = v === 'whatsapp' ? 'WhatsApp number (with or without +91)' : 'Email address';
    input.required = v !== 'none';
    input.placeholder = v === 'whatsapp' ? '9876543210' : 'you@example.com';
  }));
  fbForm.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(fbForm));
    if (d.notify === 'whatsapp' && !/^\+?[0-9 \-]{10,15}$/.test(d.contact.trim())) { alert('Enter a valid WhatsApp number'); return; }
    if (d.notify === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contact.trim())) { alert('Enter a valid email'); return; }
    const list = load(KEY_FEEDBACK);
    list.unshift({ id: Date.now(), meal: d.meal, mood: d.mood, comment: d.comment.trim(), notify: d.notify });
    save(KEY_FEEDBACK, list);

    const url = location.origin + location.pathname;
    const text = 'SAU Mess: please rate your meal here: ' + url;
    const holder = document.getElementById('fbLink');
    holder.innerHTML = '';
    if (d.notify === 'whatsapp') {
      let n = d.contact.replace(/\D/g, ''); if (n.length === 10) n = '91' + n;
      const a = mk('a', 'Send myself the feedback link on WhatsApp'); a.href = 'https://wa.me/' + n + '?text=' + encodeURIComponent(text); a.target = '_blank'; a.rel = 'noopener'; holder.appendChild(a);
    } else if (d.notify === 'email') {
      const a = mk('a', 'Email myself the feedback link'); a.href = 'mailto:' + d.contact.trim() + '?subject=' + encodeURIComponent('SAU Mess feedback link') + '&body=' + encodeURIComponent(text); holder.appendChild(a);
    }
    fbForm.reset(); wrap.hidden = true;
    const m = document.getElementById('fbDone'); m.hidden = false; m.scrollIntoView({ behavior: 'smooth' });
  });
}

/* Complaints board */
const cards = document.getElementById('cards');
if (cards) {
  const q = document.getElementById('q'), fCat = document.getElementById('fCat'), fStatus = document.getElementById('fStatus');

  function render() {
    const all = load(KEY_COMPLAINTS);
    const term = q.value.trim().toLowerCase();
    const shown = all.filter(c =>
      (!fCat.value || c.category === fCat.value) &&
      (!fStatus.value || c.status === fStatus.value) &&
      (!term || ((c.comment || '') + ' ' + (c.suggestion || '') + ' ' + c.category + ' ' + c.name).toLowerCase().includes(term)));

    const open = all.filter(c => c.status === 'Open').length;
    const stats = document.getElementById('stats');
    stats.innerHTML = '';
    [['Total', all.length], ['Open', open], ['Resolved', all.length - open]].forEach(s => stats.appendChild(mk('div', s[0] + ': ' + s[1], 'stat')));

    cards.innerHTML = '';
    if (!shown.length) {
      const box = mk('div', undefined, 'empty');
      box.appendChild(mk('p', all.length ? 'No complaints match your filters.' : 'No complaints yet. '));
      if (!all.length) { const a = mk('a', 'Submit the first one.'); a.href = 'submit.html'; box.firstChild.appendChild(a); }
      cards.appendChild(box);
      return;
    }

    shown.forEach(c => {
      const card = mk('div', undefined, 'card' + (c.status === 'Resolved' ? ' resolved' : ''));
      const tags = mk('div');
      tags.appendChild(mk('span', c.status, 'tag s-' + c.status));
      tags.appendChild(mk('span', c.priority, 'tag p-' + c.priority));
      card.appendChild(tags);
      card.appendChild(mk('h3', c.category + ' (' + c.meal + ')'));
      card.appendChild(mk('p', c.comment));
      if (c.suggestion) card.appendChild(mk('p', 'Suggestion: ' + c.suggestion));
      let meta = 'By ' + c.name + (c.roll ? ' (' + c.roll + ')' : '') + ' | Incident: ' + c.incident_date;
      if (c.rating) meta += ' | Rating: ' + c.rating + '/5';
      card.appendChild(mk('p', meta, 'meta'));

      const act = mk('div', undefined, 'card-actions');
      const toggle = mk('button', c.status === 'Open' ? 'Mark resolved' : 'Reopen');
      toggle.onclick = () => {
        const list = load(KEY_COMPLAINTS), item = list.find(x => x.id === c.id);
        if (item) { item.status = item.status === 'Open' ? 'Resolved' : 'Open'; save(KEY_COMPLAINTS, list); render(); }
      };
      const del = mk('button', 'Delete');
      del.onclick = () => { if (confirm('Delete this complaint?')) { save(KEY_COMPLAINTS, load(KEY_COMPLAINTS).filter(x => x.id !== c.id)); render(); } };
      act.append(toggle, del);
      card.appendChild(act);
      cards.appendChild(card);
    });
  }

  [q, fCat, fStatus].forEach(n => n.addEventListener('input', render));
  render();
}

/* Dashboard */
const mealBars = document.getElementById('mealBars');
if (mealBars) {
  function barRow(label, total, parts) {
    const row = mk('div', undefined, 'bar-row'), l = mk('div', undefined, 'bar-label'), b = mk('div', undefined, 'bar');
    l.append(mk('span', label), mk('span', String(total)));
    parts.forEach(p => { if (p.n > 0) { const i = document.createElement('i'); i.className = p.cls; i.style.width = (p.n / (total || 1) * 100) + '%'; i.title = p.name + ': ' + p.n; b.appendChild(i); } });
    row.append(l, b);
    return row;
  }
  const fbList = load(KEY_FEEDBACK), cList = load(KEY_COMPLAINTS);
  const fb = {}; let happy = 0;
  fbList.forEach(r => { (fb[r.meal] = fb[r.meal] || {})[r.mood] = ((fb[r.meal] || {})[r.mood] || 0) + 1; if (r.mood === 'Happy') happy++; });
  mealBars.innerHTML = '';
  ['Breakfast', 'Lunch', 'Snacks', 'Dinner'].forEach(m => {
    const x = fb[m] || {}, h = x.Happy || 0, n = x.Neutral || 0, s = x.Sad || 0;
    mealBars.appendChild(barRow(m, h + n + s, [{ n: h, cls: 'h', name: 'Good' }, { n: n, cls: 'n', name: 'Okay' }, { n: s, cls: 's', name: 'Bad' }]));
  });
  const open = cList.filter(c => c.status === 'Open').length, res = cList.length - open;
  const sb = document.getElementById('statusBars'); sb.innerHTML = '';
  sb.appendChild(barRow('Open', open, [{ n: open, cls: 's', name: 'Open' }]));
  sb.appendChild(barRow('Resolved', res, [{ n: res, cls: 'h', name: 'Resolved' }]));
  const counts = {}; cList.forEach(c => counts[c.category] = (counts[c.category] || 0) + 1);
  const cats = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const cb = document.getElementById('catBars'); cb.innerHTML = '';
  if (!cats.length) cb.textContent = 'No complaints yet.';
  cats.forEach(([name, n]) => { const row = barRow(name, n, [{ n: n, cls: 'one', name: name }]); row.querySelector('i').style.width = (n / cats[0][1] * 100) + '%'; cb.appendChild(row); });
  const ds = document.getElementById('dStats'); ds.innerHTML = '';
  [['Feedback received', fbList.length], ['Rated good', fbList.length ? Math.round(happy / fbList.length * 100) + '%' : '-'], ['Complaints', cList.length], ['Still open', open]].forEach(s => ds.appendChild(mk('div', s[0] + ': ' + s[1], 'stat')));
}
