async function api(action, body) {
  const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  const r = await fetch('api.php?action=' + action, opts);
  let d = {};
  try { d = await r.json(); } catch (e) { throw new Error('Server error. Check that api.php and config.php are uploaded.'); }
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

/* Login guard: every page except the login page needs a session */
if (!document.body.hasAttribute('data-public')) {
  document.body.style.visibility = 'hidden';
  api('me').then(d => {
    if (!d.student && !d.admin) { location.replace('index.html'); return; }
    document.body.style.visibility = '';
    const nav = document.querySelector('nav');
    if (nav) {
      const a = document.createElement('a');
      a.href = '#'; a.textContent = 'Logout (' + (d.student || 'Committee') + ')';
      a.addEventListener('click', async e => { e.preventDefault(); await api('logout', {}); location.replace('index.html'); });
      nav.appendChild(a);
    }
  }).catch(() => location.replace('index.html'));
}

/* Feature 1: submit complaint to the database */
const form = document.getElementById('complaintForm');
if (form) {
  document.getElementById('date').max = new Date().toISOString().split('T')[0];
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('add', Object.fromEntries(new FormData(form)));
      form.reset();
      const msg = document.getElementById('msg');
      msg.hidden = false;
      msg.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { alert(err.message); }
    btn.disabled = false;
  });
}

/* Features 2 to 4: shared board, filters, committee login and status */
const cards = document.getElementById('cards');
if (cards) {
  const q = document.getElementById('q'), fCat = document.getElementById('fCat'), fStatus = document.getElementById('fStatus');
  const loginForm = document.getElementById('loginForm'), logoutBtn = document.getElementById('logoutBtn'), adminState = document.getElementById('adminState');
  let all = [], isAdmin = false;

  function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  async function refresh() {
    try { const d = await api('list'); all = d.complaints; isAdmin = d.admin; }
    catch (err) { cards.textContent = 'Could not load complaints. ' + err.message; return; }
    draw();
  }

  function draw() {
    loginForm.hidden = isAdmin;
    logoutBtn.hidden = !isAdmin;
    adminState.textContent = isAdmin ? 'Logged in as mess committee' : '';
    const term = q.value.trim().toLowerCase();
    const shown = all.filter(c =>
      (!fCat.value || c.category === fCat.value) &&
      (!fStatus.value || c.status === fStatus.value) &&
      (!term || ((c.comment || '') + ' ' + (c.suggestion || '') + ' ' + c.category + ' ' + c.name).toLowerCase().includes(term)));

    const open = all.filter(c => c.status === 'Open').length;
    const stats = document.getElementById('stats');
    stats.innerHTML = '';
    [['Total', all.length], ['Open', open], ['Resolved', all.length - open]].forEach(s => stats.appendChild(el('div', s[0] + ': ' + s[1], 'stat')));

    cards.innerHTML = '';
    if (!shown.length) {
      const box = el('div', undefined, 'empty');
      box.appendChild(el('p', all.length ? 'No complaints match your filters.' : 'No complaints yet. '));
      if (!all.length) { const a = el('a', 'Submit the first one.'); a.href = 'submit.html'; box.firstChild.appendChild(a); }
      cards.appendChild(box);
      return;
    }

    shown.forEach(c => {
      const card = el('div', undefined, 'card' + (c.status === 'Resolved' ? ' resolved' : ''));
      const tags = el('div');
      tags.appendChild(el('span', c.status, 'tag s-' + c.status));
      tags.appendChild(el('span', c.priority, 'tag p-' + c.priority));
      card.appendChild(tags);
      card.appendChild(el('h3', c.category + ' (' + c.meal + ')'));
      card.appendChild(el('p', c.comment));
      if (c.suggestion) card.appendChild(el('p', 'Suggestion: ' + c.suggestion));
      let meta = 'By ' + c.name + (c.roll ? ' (' + c.roll + ')' : '') + ' | Incident: ' + c.incident_date;
      if (c.rating) meta += ' | Rating: ' + c.rating + '/5';
      card.appendChild(el('p', meta, 'meta'));

      if (isAdmin) {
        const act = el('div', undefined, 'card-actions');
        const toggle = el('button', c.status === 'Open' ? 'Mark resolved' : 'Reopen');
        toggle.onclick = async () => {
          try { await api('status', { id: c.id, status: c.status === 'Open' ? 'Resolved' : 'Open' }); refresh(); } catch (e) { alert(e.message); }
        };
        const del = el('button', 'Delete');
        del.onclick = async () => {
          if (!confirm('Delete this complaint?')) return;
          try { await api('delete', { id: c.id }); refresh(); } catch (e) { alert(e.message); }
        };
        act.append(toggle, del);
        card.appendChild(act);
      }
      cards.appendChild(card);
    });
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('login', { password: document.getElementById('pw').value }); document.getElementById('pw').value = ''; refresh(); }
    catch (err) { alert(err.message); }
  });
  logoutBtn.addEventListener('click', async () => { await api('logout', {}); refresh(); });
  [q, fCat, fStatus].forEach(n => n.addEventListener('input', draw));
  refresh();
}

/* Helpers and new pages: quick feedback + dashboard */
function mk(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }

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
  fbForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = fbForm.querySelector('button[type=submit]');
    btn.disabled = true;
    const d = Object.fromEntries(new FormData(fbForm));
    try {
      await api('feedback', d);
      const url = location.origin + location.pathname;
      const text = 'SAU Mess: please rate your meal here: ' + url;
      const holder = document.getElementById('fbLink');
      holder.innerHTML = '';
      if (d.notify === 'whatsapp') {
        let n = d.contact.replace(/\D/g, ''); if (n.length === 10) n = '91' + n;
        const a = mk('a', 'Send myself the feedback link on WhatsApp'); a.href = 'https://wa.me/' + n + '?text=' + encodeURIComponent(text); a.target = '_blank'; a.rel = 'noopener'; holder.appendChild(a);
      } else if (d.notify === 'email') {
        const a = mk('a', 'Email myself the feedback link'); a.href = 'mailto:' + d.contact + '?subject=' + encodeURIComponent('SAU Mess feedback link') + '&body=' + encodeURIComponent(text); holder.appendChild(a);
      }
      fbForm.reset(); wrap.hidden = true;
      const m = document.getElementById('fbDone'); m.hidden = false; m.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { alert(err.message); }
    btn.disabled = false;
  });
}

const mealBars = document.getElementById('mealBars');
if (mealBars) {
  function barRow(label, total, parts) {
    const row = mk('div', undefined, 'bar-row'), l = mk('div', undefined, 'bar-label'), b = mk('div', undefined, 'bar');
    l.append(mk('span', label), mk('span', String(total)));
    parts.forEach(p => { if (p.n > 0) { const i = document.createElement('i'); i.className = p.cls; i.style.width = (p.n / (total || 1) * 100) + '%'; i.title = p.name + ': ' + p.n; b.appendChild(i); } });
    row.append(l, b);
    return row;
  }
  (async () => {
    try {
      const d = await api('stats');
      const fb = {}; let totalFb = 0, happy = 0;
      d.feedback.forEach(r => { const n = +r.n; (fb[r.meal] = fb[r.meal] || {})[r.mood] = n; totalFb += n; if (r.mood === 'Happy') happy += n; });
      mealBars.innerHTML = '';
      ['Breakfast', 'Lunch', 'Snacks', 'Dinner'].forEach(m => {
        const x = fb[m] || {}, h = x.Happy || 0, n = x.Neutral || 0, s = x.Sad || 0;
        mealBars.appendChild(barRow(m, h + n + s, [{ n: h, cls: 'h', name: 'Good' }, { n: n, cls: 'n', name: 'Okay' }, { n: s, cls: 's', name: 'Bad' }]));
      });
      const st = {}; d.status.forEach(r => st[r.status] = +r.n);
      const open = st.Open || 0, res = st.Resolved || 0, totalC = open + res;
      const sb = document.getElementById('statusBars'); sb.innerHTML = '';
      sb.appendChild(barRow('Open', open, [{ n: open, cls: 's', name: 'Open' }]));
      sb.appendChild(barRow('Resolved', res, [{ n: res, cls: 'h', name: 'Resolved' }]));
      const cb = document.getElementById('catBars'); cb.innerHTML = '';
      const max = d.categories.length ? +d.categories[0].n : 1;
      if (!d.categories.length) cb.textContent = 'No complaints yet.';
      d.categories.forEach(c => { const row = barRow(c.category, +c.n, [{ n: +c.n, cls: 'one', name: c.category }]); row.querySelector('i').style.width = (c.n / max * 100) + '%'; cb.appendChild(row); });
      const ds = document.getElementById('dStats'); ds.innerHTML = '';
      [['Feedback received', totalFb], ['Rated good', totalFb ? Math.round(happy / totalFb * 100) + '%' : '-'], ['Complaints', totalC], ['Still open', open]].forEach(s => ds.appendChild(mk('div', s[0] + ': ' + s[1], 'stat')));
    } catch (err) { mealBars.textContent = 'Could not load dashboard. ' + err.message; }
  })();
}

/* Login page */
const loginForm2 = document.getElementById('studentLogin');
if (loginForm2) {
  let committee = false;
  const err = document.getElementById('loginErr'), fields = document.getElementById('studentFields');
  api('me').then(d => { if (d.student || d.admin) location.replace('home.html'); }).catch(() => {});
  document.getElementById('modeToggle').addEventListener('click', e => {
    committee = !committee;
    fields.hidden = committee;
    document.getElementById('sname').required = !committee;
    document.getElementById('enroll').required = !committee;
    document.getElementById('loginTitle').textContent = committee ? 'Mess committee login' : 'Student login';
    document.getElementById('loginHelp').textContent = committee ? 'Committee members only.' : 'Enter your details exactly as they appear in the university records.';
    e.target.textContent = committee ? 'Student login' : 'Mess committee login';
    err.hidden = true;
  });
  loginForm2.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    const btn = loginForm2.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const pw = document.getElementById('spass').value;
      if (committee) await api('login', { password: pw });
      else await api('student_login', { name: document.getElementById('sname').value, enrollment: document.getElementById('enroll').value, password: pw });
      location.href = 'home.html';
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });
}
