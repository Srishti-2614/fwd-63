const KEY = 'messComplaints';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { alert('Could not save: storage is unavailable.'); }
}

/* Feature 1: save complaints from the form */
const form = document.getElementById('complaintForm');
if (form) {
  const date = document.getElementById('date');
  date.max = new Date().toISOString().split('T')[0];
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const list = load();
    list.unshift({
      id: Date.now(),
      name: d.name.trim() || 'Anonymous',
      roll: d.roll.trim(),
      category: d.category, meal: d.meal, date: d.date,
      rating: d.rating, priority: d.priority,
      comment: d.comment.trim(), suggestion: d.suggestion.trim(),
      status: 'Open', created: new Date().toLocaleString()
    });
    save(list);
    form.reset();
    const msg = document.getElementById('msg');
    msg.hidden = false;
    msg.scrollIntoView({ behavior: 'smooth' });
  });
}

/* Features 2 and 3: board with status toggle, filter and search */
const cards = document.getElementById('cards');
if (cards) {
  const q = document.getElementById('q'), fCat = document.getElementById('fCat'), fStatus = document.getElementById('fStatus');

  function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  function render() {
    const all = load();
    const term = q.value.trim().toLowerCase();
    const shown = all.filter(c =>
      (!fCat.value || c.category === fCat.value) &&
      (!fStatus.value || c.status === fStatus.value) &&
      (!term || (c.comment + ' ' + c.suggestion + ' ' + c.category + ' ' + c.name).toLowerCase().includes(term)));

    const open = all.filter(c => c.status === 'Open').length;
    const stats = document.getElementById('stats');
    stats.innerHTML = '';
    [['Total', all.length], ['Open', open], ['Resolved', all.length - open]].forEach(s =>
      stats.appendChild(el('div', s[0] + ': ' + s[1], 'stat')));

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
      let meta = 'By ' + c.name + (c.roll ? ' (' + c.roll + ')' : '') + ' | Incident: ' + c.date;
      if (c.rating) meta += ' | Rating: ' + c.rating + '/5';
      card.appendChild(el('p', meta, 'meta'));

      const act = el('div', undefined, 'card-actions');
      const toggle = el('button', c.status === 'Open' ? 'Mark resolved' : 'Reopen');
      toggle.onclick = () => {
        const list = load(), item = list.find(x => x.id === c.id);
        if (item) { item.status = item.status === 'Open' ? 'Resolved' : 'Open'; save(list); render(); }
      };
      const del = el('button', 'Delete');
      del.onclick = () => { if (confirm('Delete this complaint?')) { save(load().filter(x => x.id !== c.id)); render(); } };
      act.append(toggle, del);
      card.appendChild(act);
      cards.appendChild(card);
    });
  }

  [q, fCat, fStatus].forEach(n => n.addEventListener('input', render));
  render();
}
