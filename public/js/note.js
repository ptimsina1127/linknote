(function() {
  const unlockPrompt = document.getElementById('unlock-prompt');
  const noteContainer = document.getElementById('note-container');
  const noteTitle = document.getElementById('note-title');
  const noteContent = document.getElementById('note-content');
  const noteDate = document.getElementById('note-date');
  const unlockPassword = document.getElementById('unlock-password');
  const unlockBtn = document.getElementById('unlock-btn');
  const unlockError = document.getElementById('unlock-error');
  const favBtn = document.getElementById('fav-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const downloadBtn = document.getElementById('download-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const toast = document.getElementById('toast');

  const shortId = window.location.pathname.split('/note/')[1] || '';

  let noteData = null;

  async function loadNote() {
    try {
      const res = await fetch(`/api/note/${shortId}`);
      if (res.status === 404) {
        window.location.href = '/404';
        return;
      }
      noteData = await res.json();

      if (noteData.is_protected && !noteData.verified) {
        unlockPrompt.classList.remove('hidden');
        return;
      }

      renderNote();
    } catch (err) {
      showToast('Failed to load note');
    }
  }

  function renderNote() {
    unlockPrompt.classList.add('hidden');
    noteContainer.classList.remove('hidden');

    if (noteData.title) {
      noteTitle.textContent = noteData.title;
    } else {
      noteTitle.textContent = 'Untitled Note';
    }

    noteContent.textContent = noteData.content;
    noteDate.textContent = 'Created: ' + new Date(noteData.created_at).toLocaleString();

    updateFavStar();
  }

  function updateFavStar() {
    const isFav = window.Favorites.isFav(shortId);
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    favBtn.classList.toggle('active', isFav);
  }

  unlockBtn.addEventListener('click', async function() {
    const password = unlockPassword.value;
    if (!password) return;

    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Checking...';

    try {
      const res = await fetch(`/api/note/${shortId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        noteData.content = data.content;
        noteData.title = data.title || '';
        noteData.verified = true;
        renderNote();
      } else {
        unlockError.classList.remove('hidden');
        unlockPassword.value = '';
        unlockPassword.focus();
      }
    } catch {
      showToast('Network error');
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Unlock';
    }
  });

  unlockPassword.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') unlockBtn.click();
  });

  favBtn.addEventListener('click', function() {
    const title = noteData.title || '';
    window.Favorites.toggle(shortId, title);
    updateFavStar();
    showToast(window.Favorites.isFav(shortId) ? 'Added to favorites' : 'Removed from favorites');
  });

  duplicateBtn.addEventListener('click', async function() {
    if (!noteData.content) return;

    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noteData.title + ' (copy)', content: noteData.content }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = `/note/${data.short_id}`;
        showToast('Note duplicated! You can now edit this copy.');
      } else {
        showToast(data.error || 'Failed to duplicate');
      }
    } catch {
      showToast('Network error');
    }
  });

  downloadBtn.addEventListener('click', function() {
    window.location.href = `/api/note/${shortId}/download`;
  });

  copyLinkBtn.addEventListener('click', function() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {});
    showToast('Link copied!');
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  loadNote();
})();
