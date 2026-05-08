(function() {
  const list = document.getElementById('favorites-list');

  async function load() {
    list.innerHTML = '<p class="loading">Loading...</p>';

    const notes = await window.Favorites.fetchFavNotes();

    if (notes.length === 0) {
      list.innerHTML = '<p class="hint">No favorite notes yet. Star notes to add them here.</p>';
      return;
    }

    list.innerHTML = '';

    for (const note of notes) {
      const card = document.createElement('div');
      card.className = 'note-card';

      const info = document.createElement('div');
      info.className = 'note-card-info';

      const title = document.createElement('div');
      title.className = 'note-card-title';
      const link = document.createElement('a');
      link.href = `/note/${note.short_id}`;
      link.textContent = note.title || 'Untitled';
      title.appendChild(link);

      const meta = document.createElement('div');
      meta.className = 'note-card-meta';
      meta.textContent = `${note.short_id} · ${new Date(note.created_at).toLocaleDateString()}`;
      if (note.is_protected) {
        meta.textContent += ' 🔒';
      }

      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'note-card-actions';
      window.Favorites.renderStar(note.short_id, actions);

      card.appendChild(info);
      card.appendChild(actions);
      list.appendChild(card);
    }
  }

  load();
})();
