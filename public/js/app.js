(function() {
  const content = document.getElementById('note-content');
  const titleInput = document.getElementById('title-input');
  const passwordBtn = document.getElementById('password-btn');
  const passwordInput = document.getElementById('password-input');
  const primaryBtn = document.getElementById('primary-btn');
  const downloadBtn = document.getElementById('download-btn');
  const favBtn = document.getElementById('fav-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const toast = document.getElementById('toast');
  const shareModal = document.getElementById('share-modal');
  const shareLink = document.getElementById('share-link');
  const copyShareLink = document.getElementById('copy-share-link');
  const closeShareModal = document.getElementById('close-share-modal');

  let isSubmitting = false;
  let createdShortId = null;

  passwordBtn.addEventListener('click', function() {
    passwordInput.classList.toggle('visible');
    if (passwordInput.classList.contains('visible')) {
      passwordInput.focus();
    }
  });

  passwordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      passwordInput.classList.remove('visible');
      if (passwordInput.value && passwordInput.value.length < 4) {
        showToast('Password must be at least 4 characters');
        passwordInput.value = '';
      }
      updatePasswordIcon();
    }
  });

  passwordInput.addEventListener('blur', function() {
    passwordInput.classList.remove('visible');
    if (passwordInput.value && passwordInput.value.length < 4) {
      showToast('Password must be at least 4 characters');
      passwordInput.value = '';
    }
    updatePasswordIcon();
  });

  function updatePasswordIcon() {
    passwordBtn.textContent = passwordInput.value ? '🔓' : '🔒';
    passwordBtn.title = passwordInput.value ? 'Password set. Click to change' : 'Protect this note with a password';
  }

  content.addEventListener('input', function() {
    this.style.height = 'auto';
  });

  primaryBtn.addEventListener('click', createNote);

  content.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      createNote();
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
    showToast('Create the note first to favorite it');
  });

  duplicateBtn.addEventListener('click', function() {
    showToast('Create the note first to duplicate it');
  });

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
      const url = window.location.origin + '/note/' + data.short_id;
      const encodedUrl = encodeURIComponent(url);
      const encodedTitle = encodeURIComponent(title || 'LinkedPad Note');

      shareLink.value = url;
      document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
      document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      document.getElementById('share-whatsapp').href = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
      document.getElementById('share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
      document.getElementById('share-reddit').href = `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;

      primaryBtn.textContent = 'Shared';
      shareModal.classList.remove('hidden');
    } catch (err) {
      showToast('Network error. Please try again.');
      isSubmitting = false;
      primaryBtn.disabled = false;
      primaryBtn.textContent = 'Share';
    }
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

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
})();
