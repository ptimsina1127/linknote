(function() {
  const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

  if (!SpeechRecognition) {
    return;
  }

  const micBtn = document.getElementById('mic-btn');
  if (!micBtn) return;

  micBtn.style.display = '';

  let isListening = false;
  let recognition = null;

  const commandMap = {
    'enter': '\n',
    'new line': '\n',
    'newline': '\n',
    'full stop': '. ',
    'period': '. ',
    'question mark': '? ',
    'comma': ', ',
    'exclamation mark': '! ',
    'exclamation point': '! ',
    'colon': ': ',
    'semicolon': '; ',
    'space': ' ',
  };

  function processTranscript(transcript) {
    let text = transcript.trim();

    for (const [phrase, replacement] of Object.entries(commandMap)) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      text = text.replace(regex, replacement);
    }

    return text;
  }

  function insertText(text) {
    const textarea = document.getElementById('note-content');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  }

  function startListening() {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      const processed = processTranscript(transcript);
      insertText(processed);
      stopListening();
    };

    recognition.onerror = function(event) {
      console.warn('Speech error:', event.error);
      stopListening();
    };

    recognition.onend = function() {
      stopListening();
    };

    recognition.start();
    isListening = true;
    micBtn.classList.add('mic-recording');
    micBtn.textContent = '🔴';
    micBtn.title = 'Listening... tap to stop';
  }

  function stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
      recognition = null;
    }
    isListening = false;
    micBtn.classList.remove('mic-recording');
    micBtn.textContent = '🎤';
    micBtn.title = 'Speech-to-text (Chrome/Edge only)';
  }

  micBtn.addEventListener('click', function() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
})();
