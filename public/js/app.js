(function() {
  const content = document.getElementById('note-content');
  const titleInput = document.getElementById('title-input');
  const passwordEnable = document.getElementById('password-enable');
  const passwordInput = document.getElementById('password-input');
  const shareBtn = document.getElementById('share-btn');
  const toast = document.getElementById('toast');
  const modal = document.getElementById('result-modal');
  const resultUrl = document.getElementById('result-url');
  const copyBtn = document.getElementById('copy-btn');
  const viewNoteBtn = document.getElementById('view-note-btn');
  const createAnother = document.getElementById('create-another');

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
        return;
      }

      const url = `${window.location.origin}/note/${data.short_id}`;
      resultUrl.value = url;
      viewNoteBtn.href = url;
      modal.classList.remove('hidden');
    } catch (err) {
      showToast('Network error. Please try again.');
    } finally {
      isSubmitting = false;
      shareBtn.disabled = false;
      shareBtn.textContent = 'Share';
    }
  }

  copyBtn.addEventListener('click', function() {
    resultUrl.select();
    navigator.clipboard.writeText(resultUrl.value).catch(() => {});
    showToast('Link copied!');
  });

  createAnother.addEventListener('click', function() {
    modal.classList.add('hidden');
    content.value = '';
    titleInput.value = '';
    passwordEnable.checked = false;
    passwordInput.disabled = true;
    passwordInput.value = '';
    content.focus();
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
})();
