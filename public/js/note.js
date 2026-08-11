(function() {
  const noteContainer = document.getElementById('note-container');
  const titleInput = document.getElementById('title-input');
  const noteContent = document.getElementById('note-content');
  const noteDate = document.getElementById('note-date');
  const passwordBtn = document.getElementById('password-btn');
  const pwPopup = document.getElementById('pw-popup');
  const passwordInput = document.getElementById('password-input');
  const pwRevealBtn = document.getElementById('pw-reveal-btn');
  const pwOkBtn = document.getElementById('pw-ok-btn');
  const pwDialog = document.getElementById('pw-dialog');
  const pwDialogTitle = document.getElementById('pw-dialog-title');
  const pwDialogMsg = document.getElementById('pw-dialog-msg');
  const pwDialogOk = document.getElementById('pw-dialog-ok');
  const favBtn = document.getElementById('fav-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const shareModal = document.getElementById('share-modal');
  const shareLink = document.getElementById('share-link');
  const copyShareLink = document.getElementById('copy-share-link');
  const closeShareModal = document.getElementById('close-share-modal');
  const autosaveIndicator = document.getElementById('autosave-indicator');
  const lockScreen = document.getElementById('lock-screen');
  const lockPasswordInput = document.getElementById('lock-password-input');
  const lockUnlockBtn = document.getElementById('lock-unlock-btn');
  const lockError = document.getElementById('lock-error');

  const shortId = window.location.pathname.split('/note/')[1] || '';

  let noteData = null;
  let saveTimeout = null;
  let isSaving = false;
  let indicatorTimeout = null;
  let dirty = false;
  let pending = false;
  let retryTimeout = null;

  function openPwPopup() {
    passwordInput.placeholder = isUnlockMode() ? 'Enter password' : 'Password (min 4 chars)';
    pwPopup.classList.add('visible');
    passwordInput.focus();
  }

  function closePwPopup() {
    pwPopup.classList.remove('visible');
  }

  passwordBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
  pwRevealBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
  pwOkBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
  lockUnlockBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });

  lockUnlockBtn.addEventListener('click', unlockLockedNote);

  lockPasswordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      unlockLockedNote();
    }
  });

  passwordBtn.addEventListener('click', function() {
    if (!noteData) return;
    if (pwPopup.classList.contains('visible')) {
      closePwPopup();
    } else {
      openPwPopup();
    }
  });

  pwRevealBtn.addEventListener('click', function() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    pwRevealBtn.innerHTML = isPassword ? ICONS.eyeOff : ICONS.eye;
    pwRevealBtn.title = isPassword ? 'Hide password' : 'Show password';
    passwordInput.focus();
  });

  passwordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isUnlockMode()) {
        unlockNote();
      } else {
        setPassword();
      }
    }
  });

  passwordInput.addEventListener('blur', function() {
    if (isUnlockMode()) {
      closePwPopup();
      passwordInput.value = '';
      return;
    }
    if (passwordInput.value && passwordInput.value.length < 4) {
      showToast('Password must be at least 4 characters');
      passwordInput.value = '';
      closePwPopup();
      updatePasswordIcon();
      return;
    }
    if (passwordInput.value) {
      setPassword();
    } else {
      closePwPopup();
    }
  });

  pwOkBtn.addEventListener('click', function() {
    if (isUnlockMode()) {
      unlockNote();
    } else {
      setPassword();
    }
  });

  function isUnlockMode() {
    return !!(noteData && noteData.is_protected);
  }

  async function unlockNote() {
    const pw = passwordInput.value;
    if (!pw) return;

    try {
      const res = await fetch(`/api/note/${shortId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        noteData.content = data.content;
        noteData.title = data.title || '';
        noteData.is_protected = false;
        noteData.verified = true;
        closePwPopup();
        passwordInput.value = '';
        passwordInput.type = 'password';
        pwRevealBtn.innerHTML = ICONS.eye;
        pwRevealBtn.title = 'Show password';
        renderNote();
        showToast('Note unlocked');
      } else {
        showToast(data.error || 'Incorrect password');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch {
      showToast('Network error');
    }
  }

  async function setPassword() {
    const pw = passwordInput.value;
    if (pw && pw.length < 4) {
      showToast('Password must be at least 4 characters');
      passwordInput.value = '';
      closePwPopup();
      updatePasswordIcon();
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
        noteData.verified = true;
        if (pw) {
          showPwDialog('Password set', 'This note is now protected with a password.');
        } else {
          showToast('Password removed');
        }
      } else {
        showToast(data.error || 'Failed to set password');
      }
    } catch {
      showToast('Network error');
    }
    closePwPopup();
    passwordInput.value = '';
    passwordInput.type = 'password';
    pwRevealBtn.innerHTML = ICONS.eye;
    pwRevealBtn.title = 'Show password';
    updatePasswordIcon();
  }

  function showPwDialog(title, msg) {
    pwDialogTitle.textContent = title;
    pwDialogMsg.textContent = msg;
    pwDialog.classList.remove('hidden');
  }

  pwDialogOk.addEventListener('click', function() {
    pwDialog.classList.add('hidden');
  });

  pwDialog.addEventListener('click', function(e) {
    if (e.target === pwDialog) pwDialog.classList.add('hidden');
  });

  function updatePasswordIcon() {
    if (noteData && noteData.is_protected) {
      passwordBtn.innerHTML = ICONS.lock;
      passwordBtn.title = 'This note is locked. Click to unlock';
    } else {
      passwordBtn.innerHTML = ICONS.lockOpen;
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
        renderProtected();
        return;
      }

      renderNote();
    } catch (err) {
      showToast('Failed to load note');
    }
  }

  async function unlockLockedNote() {
    const pw = lockPasswordInput.value;
    if (!pw) return;
    lockUnlockBtn.disabled = true;
    try {
      const res = await fetch(`/api/note/${shortId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        noteData.content = data.content;
        noteData.title = data.title || '';
        noteData.verified = true;
        lockScreen.classList.add('hidden');
        lockError.classList.add('hidden');
        noteContainer.classList.remove('hidden');
        renderNote();
      } else {
        lockError.textContent = res.status === 429
          ? 'Too many attempts. Please wait a minute.'
          : (data.error || 'Incorrect password');
        lockError.classList.remove('hidden');
        lockPasswordInput.value = '';
        lockPasswordInput.focus();
      }
    } catch {
      lockError.textContent = 'Network error';
      lockError.classList.remove('hidden');
    } finally {
      lockUnlockBtn.disabled = false;
    }
  }

  function renderProtected() {
    noteContainer.classList.add('hidden');
    lockScreen.classList.remove('hidden');
    lockError.classList.add('hidden');
    lockPasswordInput.value = '';
    updatePasswordIcon();
    lockPasswordInput.focus();
  }

  function renderNote() {
    noteContainer.classList.remove('hidden');
    noteContent.readOnly = false;
    noteContent.placeholder = 'Edit your note content here';
    titleInput.value = noteData.title || '';
    noteContent.value = noteData.content;
    noteDate.textContent = 'Created: ' + new Date(noteData.created_at).toLocaleString();

    updateFavStar();
    updatePasswordIcon();
  }

  function updateFavStar() {
    const isFav = window.Favorites.isFav(shortId);
    favBtn.innerHTML = isFav ? ICONS.starFilled : ICONS.star;
    favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    favBtn.classList.toggle('active', isFav);
  }

  function debounceSave() {
    clearTimeout(saveTimeout);
    clearTimeout(retryTimeout);
    if (!noteContent.value.trim()) {
      clearTimeout(indicatorTimeout);
      dirty = false;
      autosaveIndicator.classList.remove('show');
      return;
    }
    dirty = true;
    showIndicator('Saving...');
    saveTimeout = setTimeout(autosave, 1000);
  }

  titleInput.addEventListener('input', debounceSave);
  noteContent.addEventListener('input', debounceSave);

  async function autosave() {
    if (!noteData) return;
    const title = titleInput.value.trim();
    const content = noteContent.value;

    if (!content.trim()) {
      dirty = false;
      clearTimeout(indicatorTimeout);
      autosaveIndicator.classList.remove('show');
      return;
    }

    if (isSaving) {
      pending = true;
      return;
    }

    isSaving = true;

    try {
      const res = await fetch(`/api/note/${shortId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      const data = await res.json();

      if (data.success) {
        if (noteContent.value === content && titleInput.value.trim() === title) {
          noteData.title = title;
          noteData.content = content;
          dirty = false;
          showIndicator('Saved');
        } else {
          showIndicator('Saving...');
          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(autosave, 500);
        }
      } else if (res.status === 401) {
        dirty = false;
        autosaveIndicator.classList.remove('show');
        renderProtected();
        showToast('Password required to continue editing');
      } else {
        showIndicator('Save failed');
        scheduleRetry();
      }
    } catch {
      showIndicator('Save failed');
      scheduleRetry();
    } finally {
      isSaving = false;
      if (pending) {
        pending = false;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(autosave, 50);
      }
    }
  }

  function scheduleRetry() {
    clearTimeout(retryTimeout);
    retryTimeout = setTimeout(autosave, 3000);
  }

  function flushOnExit() {
    if (!noteData || !dirty || isSaving) return;
    const title = titleInput.value.trim();
    const content = noteContent.value;
    if (!content.trim()) return;
    try {
      fetch(`/api/note/${shortId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
        keepalive: true,
      });
    } catch {}
  }

  window.addEventListener('pagehide', flushOnExit);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') flushOnExit();
  });

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
        window.open(`/note/${data.short_id}`, '_blank');
      } else {
        showToast(data.error || 'Failed to duplicate');
      }
    } catch {
      showToast('Network error');
    }
  });

  downloadBtn.addEventListener('click', function() {
    if (!noteContent.value.trim()) {
      showToast('Nothing to download');
      return;
    }
    window.location.href = `/api/note/${shortId}/download`;
  });

  shareBtn.addEventListener('click', async function() {
    if (!noteContent.value.trim()) {
      showToast('Nothing to share');
      return;
    }
    if (dirty) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
      while (isSaving) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await autosave();
    }
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

  loadNote();
})();
