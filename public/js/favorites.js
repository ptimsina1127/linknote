(function() {
  window.Favorites = {
    STORAGE_KEY: 'linknote_favorites',

    getAll() {
      try {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      } catch { return {}; }
    },

    isFav(shortId) {
      const favs = this.getAll();
      return !!favs[shortId];
    },

    toggle(shortId, title) {
      const favs = this.getAll();
      if (favs[shortId]) {
        delete favs[shortId];
      } else {
        favs[shortId] = { title: title || '', added: Date.now() };
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favs));
      return !!favs[shortId];
    },

    getIds() {
      return Object.keys(this.getAll());
    },

    async fetchFavNotes() {
      const ids = this.getIds();
      const notes = [];

      for (const id of ids) {
        try {
          const res = await fetch(`/api/note/${id}/meta`);
          if (res.ok) {
            const data = await res.json();
            notes.push(data);
          } else {
            this.toggle(id);
          }
        } catch {
          this.toggle(id);
        }
      }

      notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return notes;
    },

    renderStar(shortId, container) {
      const isFav = this.isFav(shortId);
      const star = document.createElement('button');
      star.className = 'fav-star' + (isFav ? ' active' : '');
      star.textContent = isFav ? '★' : '☆';
      star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
      star.addEventListener('click', async (e) => {
        e.stopPropagation();
        let title = '';
        try {
          const res = await fetch(`/api/note/${shortId}/meta`);
          if (res.ok) {
            const data = await res.json();
            title = data.title || '';
          }
        } catch {}
        const nowFav = this.toggle(shortId, title);
        star.textContent = nowFav ? '★' : '☆';
        star.className = 'fav-star' + (nowFav ? ' active' : '');
        star.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
        showToast(nowFav ? 'Added to favorites' : 'Removed from favorites');
      });
      container.appendChild(star);
    }
  };

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  window.showToast = showToast;
})();
