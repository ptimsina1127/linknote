(function() {
  const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

  if (!SpeechRecognition) return;

  const micBtn = document.getElementById('mic-btn');
  if (!micBtn) return;

  micBtn.style.display = '';

  let isListening = false;
  let recognition = null;
  let silenceTimer = null;
  let lastResultIndex = -1;

  const SILENCE_TIMEOUT = 3000;

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

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(function() {
      stopListening();
    }, SILENCE_TIMEOUT);
  }

  function startListening() {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    lastResultIndex = -1;

    recognition.onresult = function(event) {
      resetSilenceTimer();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        if (i <= lastResultIndex) continue;

        lastResultIndex = i;
        const transcript = event.results[i][0].transcript;
        const processed = processTranscript(transcript);
        if (processed) {
          insertText(processed);
        }
      }
    };

    recognition.onerror = function(event) {
      if (event.error === 'no-speech') {
        resetSilenceTimer();
        return;
      }
      console.warn('Speech error:', event.error);
      stopListening();
    };

    recognition.onend = function() {
      if (isListening) {
        stopListening();
      }
    };

    try {
      recognition.start();
      isListening = true;
      micBtn.classList.add('mic-recording');
      micBtn.textContent = '🔴';
      micBtn.title = 'Listening... speak now';
    } catch(e) {
      stopListening();
    }
  }

  function stopListening() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
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
