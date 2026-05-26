(function() {
  const unlockPrompt = document.getElementById('unlock-prompt');
  const noteContainer = document.getElementById('note-container');
  const titleInput = document.getElementById('title-input');
  const noteContent = document.getElementById('note-content');
  const noteDate = document.getElementById('note-date');
  const unlockPassword = document.getElementById('unlock-password');
  const unlockBtn = document.getElementById('unlock-btn');
  const unlockError = document.getElementById('unlock-error');
  const favBtn = document.getElementById('fav-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const downloadBtn = document.getElementById('download-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const primaryBtn = document.getElementById('primary-btn');
  const passwordSection = document.getElementById('password-section');
  const passwordInput = document.getElementById('password-input');
  const toast = document.getElementById('toast');

  const shortId = window.location.pathname.split('/note/')[1] || '';

  let noteData = null;
  let hasChanges = false;

  passwordSection.style.display = 'none';
  passwordInput.style.display = 'none';

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

    titleInput.value = noteData.title || '';
    noteContent.value = noteData.content;
    noteDate.textContent = 'Created: ' + new Date(noteData.created_at).toLocaleString();

    updateFavStar();
    hasChanges = false;
    primaryBtn.disabled = true;
  }

  function updateFavStar() {
    const isFav = window.Favorites.isFav(shortId);
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    favBtn.classList.toggle('active', isFav);
  }

  titleInput.addEventListener('input', function() {
    hasChanges = true;
    primaryBtn.disabled = false;
  });

  noteContent.addEventListener('input', function() {
    hasChanges = true;
    primaryBtn.disabled = false;
  });

  primaryBtn.addEventListener('click', saveNote);

  noteContent.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveNote();
    }
  });

  async function saveNote() {
    const title = titleInput.value.trim();
    const content = noteContent.value;

    if (!content.trim()) {
      showToast('Content cannot be empty');
      return;
    }

    primaryBtn.disabled = true;
    primaryBtn.textContent = '💾 Saving...';

    try {
      const res = await fetch(`/api/note/${shortId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      const data = await res.json();

      if (data.success) {
        hasChanges = false;
        noteData.title = title;
        noteData.content = content;
        showToast('Note saved!');
        primaryBtn.disabled = true;
      } else {
        showToast(data.error || 'Failed to save');
        primaryBtn.disabled = false;
      }
    } catch {
      showToast('Network error');
      primaryBtn.disabled = false;
    } finally {
      primaryBtn.textContent = '💾 Save';
    }
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

  window.addEventListener('beforeunload', function(e) {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  favBtn.addEventListener('click', function() {
    const title = noteData.title || '';
    window.Favorites.toggle(shortId, title);
    updateFavStar();
    showToast(window.Favorites.isFav(shortId) ? 'Added to favorites' : 'Removed from favorites');
  });

  duplicateBtn.addEventListener('click', async function() {
    const content = noteContent.value;

    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.value + ' (copy)', content }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = `/note/${data.short_id}`;
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
