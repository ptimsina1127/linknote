(function() {
  const unlockPrompt = document.getElementById('unlock-prompt');
  const noteContainer = document.getElementById('note-container');
  const titleInput = document.getElementById('title-input');
  const noteContent = document.getElementById('note-content');
  const noteDate = document.getElementById('note-date');
  const unlockPassword = document.getElementById('unlock-password');
  const unlockBtn = document.getElementById('unlock-btn');
  const unlockError = document.getElementById('unlock-error');
  const passwordBtn = document.getElementById('password-btn');
  const passwordInput = document.getElementById('password-input');
  const pwRevealBtn = document.getElementById('pw-reveal-btn');
  const favBtn = document.getElementById('fav-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const toast = document.getElementById('toast');
  const shareModal = document.getElementById('share-modal');
  const shareLink = document.getElementById('share-link');
  const copyShareLink = document.getElementById('copy-share-link');
  const closeShareModal = document.getElementById('close-share-modal');
  const autosaveIndicator = document.getElementById('autosave-indicator');

  const shortId = window.location.pathname.split('/note/')[1] || '';

  let noteData = null;
  let saveTimeout = null;
  let isSaving = false;
  let indicatorTimeout = null;

  pwRevealBtn.style.display = 'none';
  passwordInput.style.display = 'none';

  passwordBtn.addEventListener('click', function() {
    if (!noteData) return;
    passwordInput.style.display = '';
    passwordInput.classList.toggle('visible');
    pwRevealBtn.style.display = passwordInput.classList.contains('visible') ? '' : 'none';
    if (passwordInput.classList.contains('visible')) {
      passwordInput.focus();
    } else {
      passwordInput.style.display = 'none';
    }
  });

  pwRevealBtn.addEventListener('click', function() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    pwRevealBtn.textContent = isPassword ? '🙈' : '👁';
    pwRevealBtn.title = isPassword ? 'Hide password' : 'Show password';
  });

  passwordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      passwordInput.classList.remove('visible');
      pwRevealBtn.style.display = 'none';
      passwordInput.style.display = 'none';
      setPassword();
    }
  });

  passwordInput.addEventListener('blur', function() {
    passwordInput.classList.remove('visible');
    pwRevealBtn.style.display = 'none';
    passwordInput.style.display = 'none';
    if (passwordInput.value) setPassword();
  });

  async function setPassword() {
    const pw = passwordInput.value;
    if (pw && pw.length < 4) {
      showToast('Password must be at least 4 characters');
      passwordInput.value = '';
      return;
    }
    try {
      const res = await fetch(`/api/note/${shortId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput.value.trim() || '',
          content: noteContent.value,
          password: pw || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        noteData.is_protected = !!pw;
        showIndicator(pw ? 'Password saved' : 'Password removed');
      } else {
        showToast(data.error || 'Failed to set password');
      }
    } catch {
      showToast('Network error');
    }
    passwordInput.value = '';
    passwordInput.type = 'password';
    pwRevealBtn.textContent = '👁';
    pwRevealBtn.title = 'Show password';
    updatePasswordIcon();
  }

  function updatePasswordIcon() {
    if (noteData && noteData.is_protected) {
      passwordBtn.textContent = '🔓';
      passwordBtn.title = 'Password is set. Click to change';
    } else {
      passwordBtn.textContent = '🔒';
      passwordBtn.title = 'Protect this note with a password';
    }
  }

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
    updatePasswordIcon();
  }

  function updateFavStar() {
    const isFav = window.Favorites.isFav(shortId);
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    favBtn.classList.toggle('active', isFav);
  }

  function debounceSave() {
    clearTimeout(saveTimeout);
    showIndicator('Saving...');
    saveTimeout = setTimeout(autosave, 2000);
  }

  titleInput.addEventListener('input', debounceSave);
  noteContent.addEventListener('input', debounceSave);

  async function autosave() {
    if (isSaving || !noteData) return;
    const title = titleInput.value.trim();
    const content = noteContent.value;

    if (!content.trim()) return;

    isSaving = true;

    try {
      const res = await fetch(`/api/note/${shortId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      const data = await res.json();

      if (data.success) {
        noteData.title = title;
        noteData.content = content;
        showIndicator('Saved');
      } else {
        showIndicator('Save failed');
      }
    } catch {
      showIndicator('Save failed');
    } finally {
      isSaving = false;
    }
  }

  function showIndicator(msg) {
    autosaveIndicator.textContent = msg;
    autosaveIndicator.classList.add('show');
    clearTimeout(indicatorTimeout);
    if (msg !== 'Saving...') {
      indicatorTimeout = setTimeout(function() {
        autosaveIndicator.classList.remove('show');
      }, 2000);
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

  shareBtn.addEventListener('click', function() {
    const url = window.location.href;
    const title = encodeURIComponent(noteData.title || 'LinkedPad Note');
    const encodedUrl = encodeURIComponent(url);

    shareLink.value = url;
    document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?text=${title}&url=${encodedUrl}`;
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    document.getElementById('share-whatsapp').href = `https://wa.me/?text=${title}%20${encodedUrl}`;
    document.getElementById('share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    document.getElementById('share-reddit').href = `https://reddit.com/submit?url=${encodedUrl}&title=${title}`;

    shareModal.classList.remove('hidden');
  });

  copyShareLink.addEventListener('click', function() {
    shareLink.select();
    navigator.clipboard.writeText(shareLink.value).catch(() => {});
    showToast('Link copied!');
  });

  closeShareModal.addEventListener('click', function() {
    shareModal.classList.add('hidden');
  });

  shareModal.addEventListener('click', function(e) {
    if (e.target === shareModal) shareModal.classList.add('hidden');
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  loadNote();
})();
