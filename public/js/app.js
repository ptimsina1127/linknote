(function() {
  const content = document.getElementById('note-content');
  const titleInput = document.getElementById('title-input');
  const passwordBtn = document.getElementById('password-btn');
  const pwPopup = document.getElementById('pw-popup');
  const passwordInput = document.getElementById('password-input');
  const pwRevealBtn = document.getElementById('pw-reveal-btn');
  const pwOkBtn = document.getElementById('pw-ok-btn');
  const pwDialog = document.getElementById('pw-dialog');
  const pwDialogTitle = document.getElementById('pw-dialog-title');
  const pwDialogMsg = document.getElementById('pw-dialog-msg');
  const pwDialogOk = document.getElementById('pw-dialog-ok');
  const primaryBtn = document.getElementById('primary-btn');
  const downloadBtn = document.getElementById('download-btn');
  const favBtn = document.getElementById('fav-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const shareModal = document.getElementById('share-modal');
  const shareLink = document.getElementById('share-link');
  const copyShareLink = document.getElementById('copy-share-link');
  const closeShareModal = document.getElementById('close-share-modal');
  const autosaveIndicator = document.getElementById('autosave-indicator');

  let isSubmitting = false;
  let createdShortId = null;
  let saveTimeout = null;
  let isSaving = false;
  let indicatorTimeout = null;
  let dirty = false;
  let pending = false;
  let retryTimeout = null;

  function openPwPopup() {
    pwPopup.classList.add('visible');
    passwordInput.focus();
  }

  function closePwPopup() {
    pwPopup.classList.remove('visible');
  }

  passwordBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
  pwRevealBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
  pwOkBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });

  passwordBtn.addEventListener('click', function() {
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

  function confirmPassword() {
    const val = passwordInput.value;
    if (val && val.length < 4) {
      showToast('Password must be at least 4 characters');
      passwordInput.value = '';
      closePwPopup();
      updatePasswordIcon();
      return;
    }
    closePwPopup();
    updatePasswordIcon();
    if (createdShortId) {
      persistPassword(val || null);
    }
    if (val) {
      showPwDialog('Password set', 'This note will be protected with the password you entered.');
    } else {
      showToast('Password removed');
    }
  }

  async function persistPassword(password) {
    try {
      const res = await fetch(`/api/note/${createdShortId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.value.trim(), content: content.value, password }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to update password');
      }
    } catch {
      showToast('Network error');
    }
  }

  pwOkBtn.addEventListener('click', confirmPassword);

  passwordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmPassword();
    }
  });

  passwordInput.addEventListener('blur', function() {
    if (passwordInput.value && passwordInput.value.length < 4) {
      showToast('Password must be at least 4 characters');
      passwordInput.value = '';
    }
    closePwPopup();
    updatePasswordIcon();
  });

  function updatePasswordIcon() {
    const wasSet = !!passwordInput.value;
    passwordBtn.innerHTML = wasSet ? ICONS.lock : ICONS.lockOpen;
    passwordBtn.title = wasSet ? 'Password set. Click to change' : 'Protect this note with a password';
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

  content.addEventListener('input', function() {
    this.style.height = 'auto';
    debounceSave();
  });
  titleInput.addEventListener('input', debounceSave);

  primaryBtn.addEventListener('click', onShare);

  content.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onShare();
    }
  });

  downloadBtn.addEventListener('click', function() {
    const text = content.value;
    if (!text.trim()) {
      showToast('Nothing to download');
      return;
    }
    const t = titleInput.value.trim() || 'note';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'note'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  favBtn.addEventListener('click', function() {
    if (createdShortId) {
      const title = titleInput.value.trim() || '';
      window.Favorites.toggle(createdShortId, title);
      const isFav = window.Favorites.isFav(createdShortId);
      favBtn.innerHTML = isFav ? ICONS.starFilled : ICONS.star;
      favBtn.classList.toggle('active', isFav);
      showToast(isFav ? 'Added to favorites' : 'Removed from favorites');
    } else {
      showToast('Create the note first to favorite it');
    }
  });

  duplicateBtn.addEventListener('click', async function() {
    const noteContent = content.value.trim();
    if (!noteContent) {
      showToast('Write something before duplicating');
      return;
    }

    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.value.trim() + ' (copy)', content: noteContent }),
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

  function hideIndicator() {
    autosaveIndicator.classList.remove('show');
  }

  function debounceSave() {
    clearTimeout(saveTimeout);
    clearTimeout(retryTimeout);
    if (!content.value.trim()) {
      clearTimeout(indicatorTimeout);
      dirty = false;
      hideIndicator();
      return;
    }
    dirty = true;
    showIndicator('Saving...');
    saveTimeout = setTimeout(autosave, 1000);
  }

  async function autosave() {
    const noteContent = content.value;
    const title = titleInput.value.trim();

    if (!noteContent.trim()) {
      dirty = false;
      hideIndicator();
      return;
    }

    if (isSaving) {
      pending = true;
      return;
    }

    isSaving = true;
    try {
      if (createdShortId) {
        const res = await fetch(`/api/note/${createdShortId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content: noteContent }),
        });
        const data = await res.json();
        if (data.success) {
          if (content.value === noteContent && titleInput.value.trim() === title) {
            dirty = false;
            showIndicator('Saved');
          } else {
            showIndicator('Saving...');
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(autosave, 500);
          }
        } else {
          showIndicator('Save failed');
          scheduleRetry();
        }
      } else {
        const res = await fetch('/api/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content: noteContent, password: passwordInput.value || null }),
        });
        const data = await res.json();
        if (res.ok) {
          createdShortId = data.short_id;
          history.replaceState(null, '', window.location.origin + '/note/' + data.short_id);
          if (content.value === noteContent && titleInput.value.trim() === title) {
            dirty = false;
            showIndicator('Saved');
          } else {
            showIndicator('Saving...');
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(autosave, 500);
          }
        } else {
          showIndicator('Save failed');
          scheduleRetry();
        }
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
    if (!dirty || isSaving) return;
    const noteContent = content.value;
    const title = titleInput.value.trim();
    if (!noteContent.trim()) return;
    try {
      if (createdShortId) {
        fetch(`/api/note/${createdShortId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content: noteContent }),
          keepalive: true,
        });
      } else {
        fetch('/api/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content: noteContent, password: passwordInput.value || null }),
          keepalive: true,
        });
      }
    } catch {}
  }

  window.addEventListener('pagehide', flushOnExit);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') flushOnExit();
  });

  async function onShare() {
    if (createdShortId) {
      if (dirty) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
        while (isSaving) {
          await new Promise((r) => setTimeout(r, 50));
        }
        await autosave();
      }
      openShareModal(createdShortId);
      return;
    }
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (isSaving) {
      while (isSaving) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (createdShortId) {
        openShareModal(createdShortId);
        return;
      }
    }
    createNote();
  }

  async function createNote() {
    if (isSubmitting) return;

    const noteContent = content.value.trim();
    if (!noteContent) {
      showToast('Please write something before sharing');
      return;
    }

    const title = titleInput.value.trim();
    let password = passwordInput.value || null;

    if (password && password.length < 4) {
      showToast('Password must be at least 4 characters');
      return;
    }

    isSubmitting = true;
    primaryBtn.disabled = true;
    primaryBtn.textContent = 'Creating...';

    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: noteContent, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to create note');
        isSubmitting = false;
        primaryBtn.disabled = false;
        primaryBtn.textContent = 'Share';
        return;
      }

      createdShortId = data.short_id;
      isSubmitting = false;
      primaryBtn.disabled = false;
      primaryBtn.textContent = 'Share';

      const url = window.location.origin + '/note/' + data.short_id;
      history.replaceState(null, '', '/note/' + data.short_id);

      openShareModal(data.short_id);
    } catch (err) {
      showToast('Network error. Please try again.');
      isSubmitting = false;
      primaryBtn.disabled = false;
      primaryBtn.textContent = 'Share';
    }
  }

  function openShareModal(id) {
    const url = window.location.origin + '/note/' + id;
    const title = encodeURIComponent(titleInput.value.trim() || 'LinkedPad Note');
    const encodedUrl = encodeURIComponent(url);

    shareLink.value = url;
    document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?text=${title}&url=${encodedUrl}`;
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    document.getElementById('share-whatsapp').href = `https://wa.me/?text=${title}%20${encodedUrl}`;
    document.getElementById('share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    document.getElementById('share-reddit').href = `https://reddit.com/submit?url=${encodedUrl}&title=${title}`;

    shareModal.classList.remove('hidden');
  }

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

})();
