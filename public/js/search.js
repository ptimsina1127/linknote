(function() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const sortBtn = document.getElementById('sort-btn');
  const pagination = document.getElementById('pagination');

  let currentQuery = '';
  let currentSort = 'desc';
  let currentPage = 1;
  let totalPages = 0;

  let debounceTimer = null;

  function buildUrl() {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    params.set('sort', currentSort);
    params.set('page', currentPage);
    return `/api/search?${params}`;
  }

  async function doSearch() {
    currentQuery = input.value.trim();

    if (!currentQuery) {
      results.innerHTML = '<p class="hint">Start typing to search notes</p>';
      pagination.classList.add('hidden');
      return;
    }

    results.innerHTML = '<p class="loading">Searching...</p>';
    pagination.classList.add('hidden');

    try {
      const res = await fetch(buildUrl());
      const data = await res.json();

      if (data.notes.length === 0) {
        results.innerHTML = '<p class="hint">No notes found matching your search</p>';
        pagination.classList.add('hidden');
        return;
      }

      totalPages = data.totalPages;
      renderResults(data.notes);
      renderPagination(data.page, totalPages);
    } catch {
      results.innerHTML = '<p class="hint">Search failed. Try again.</p>';
    }
  }

  function renderResults(notes) {
    results.innerHTML = '';

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

      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'note-card-actions';
      window.Favorites.renderStar(note.short_id, actions);

      card.appendChild(info);
      card.appendChild(actions);
      results.appendChild(card);
    }
  }

  function renderPagination(page, total) {
    if (total <= 1) {
      pagination.classList.add('hidden');
      return;
    }

    pagination.classList.remove('hidden');
    pagination.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn';
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        doSearch();
      }
    });
    pagination.appendChild(prevBtn);

    const span = document.createElement('span');
    span.textContent = `Page ${page} of ${total}`;
    pagination.appendChild(span);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = page >= total;
    nextBtn.addEventListener('click', () => {
      if (currentPage < total) {
        currentPage++;
        doSearch();
      }
    });
    pagination.appendChild(nextBtn);
  }

  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentPage = 1;
      doSearch();
    }, 300);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      currentPage = 1;
      doSearch();
    }
  });

  sortBtn.addEventListener('click', function() {
    currentSort = currentSort === 'desc' ? 'asc' : 'desc';
    sortBtn.textContent = currentSort === 'desc' ? '↓ Newest' : '↑ Oldest';
    currentPage = 1;
    doSearch();
  });
})();
