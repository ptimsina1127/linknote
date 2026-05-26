(function() {
  const content = document.getElementById('note-content');
  const titleInput = document.getElementById('title-input');
  const passwordEnable = document.getElementById('password-enable');
  const passwordInput = document.getElementById('password-input');
  const shareBtn = document.getElementById('share-btn');
  const downloadBtn = document.getElementById('download-btn');
  const toast = document.getElementById('toast');

  let isSubmitting = false;

  passwordEnable.addEventListener('change', function() {
    passwordInput.disabled = !this.checked;
    if (!this.checked) passwordInput.value = '';
  });

  content.addEventListener('input', function() {
    this.style.height = 'auto';
  });

  shareBtn.addEventListener('click', createNote);

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
    const title = titleInput.value.trim() || 'note';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'note'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  async function createNote() {
    if (isSubmitting) return;

    const noteContent = content.value.trim();
    if (!noteContent) {
      showToast('Please write something before sharing');
      return;
    }

    const title = titleInput.value.trim();
    let password = null;

    if (passwordEnable.checked && passwordInput.value.length >= 4) {
      password = passwordInput.value;
    } else if (passwordEnable.checked && passwordInput.value.length > 0 && passwordInput.value.length < 4) {
      showToast('Password must be at least 4 characters');
      return;
    }

    isSubmitting = true;
    shareBtn.disabled = true;
    shareBtn.textContent = 'Creating...';

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
        shareBtn.disabled = false;
        shareBtn.textContent = 'Share';
        return;
      }

      window.location.href = `/note/${data.short_id}`;
    } catch (err) {
      showToast('Network error. Please try again.');
      isSubmitting = false;
      shareBtn.disabled = false;
      shareBtn.textContent = 'Share';
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
})();
