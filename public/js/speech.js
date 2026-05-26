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
  let committedPos = -1;

  const SILENCE_TIMEOUT = 1500;

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

  function getTextarea() {
    return document.getElementById('note-content');
  }

  function removeInterimText() {
    const textarea = getTextarea();
    if (!textarea || committedPos === -1) return;
    textarea.value = textarea.value.substring(0, committedPos);
  }

  function insertFinal(text) {
    const textarea = getTextarea();
    if (!textarea) return;

    if (committedPos === -1) {
      committedPos = textarea.selectionStart;
    }

    removeInterimText();

    const before = textarea.value.substring(0, committedPos);
    const after = textarea.value.substring(committedPos);
    textarea.value = before + text + after;
    committedPos += text.length;
    textarea.selectionStart = textarea.selectionEnd = committedPos;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  }

  function showInterim(text) {
    const textarea = getTextarea();
    if (!textarea) return;

    if (committedPos === -1) {
      committedPos = textarea.selectionStart;
    }

    removeInterimText();

    const before = textarea.value.substring(0, committedPos);
    textarea.value = before + text;
    textarea.selectionStart = textarea.selectionEnd = committedPos + text.length;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  }

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(stopListening, SILENCE_TIMEOUT);
  }

  function startListening() {
    committedPos = -1;
    lastResultIndex = -1;

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
      resetSilenceTimer();

      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal && i > lastResultIndex) {
          lastResultIndex = i;
          const processed = processTranscript(transcript);
          if (processed) {
            insertFinal(processed);
          }
        } else if (!event.results[i].isFinal) {
          interim += transcript;
        }
      }

      if (interim) {
        showInterim(interim);
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
        const textarea = getTextarea();
        if (textarea && committedPos > -1 && textarea.value.length > committedPos) {
          const pending = textarea.value.substring(committedPos);
          if (pending.trim()) {
            const processed = processTranscript(pending);
            insertFinal(processed);
          }
        }
        stopListening();
      }
    };

    try {
      recognition.start();
      isListening = true;
      micBtn.classList.add('mic-recording');
      micBtn.textContent = '🔴';
      micBtn.title = 'Listening... speak now';
    } catch (e) {
      stopListening();
    }
  }

  function stopListening() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
      recognition = null;
    }
    isListening = false;
    committedPos = -1;
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
