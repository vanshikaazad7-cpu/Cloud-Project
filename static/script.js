/**
 * AI Communication Coach — script.js
 * Handles: Web Speech API recording, waveform animation,
 *          interview mode, Flask API calls, results rendering.
 */

/* ══════════════════════════════════════════════
   DOM refs
   ══════════════════════════════════════════════ */
const micBtn           = document.getElementById('micBtn');
const micLabel         = document.getElementById('micLabel');
const timerEl          = document.getElementById('timer');
const transcriptionArea= document.getElementById('transcriptionArea');
const wordCountEl      = document.getElementById('wordCount');
const clearBtn         = document.getElementById('clearBtn');
const analyzeBtn       = document.getElementById('analyzeBtn');
const btnText          = analyzeBtn.querySelector('.btn-text');
const btnLoader        = analyzeBtn.querySelector('.btn-loader');
const resultsSection   = document.getElementById('resultsSection');
const waveformCanvas   = document.getElementById('waveformCanvas');

// Interview mode
const interviewToggle  = document.getElementById('interviewToggle');
const interviewBanner  = document.getElementById('interviewBanner');
const interviewQuestion= document.getElementById('interviewQuestion');
const nextQuestionBtn  = document.getElementById('nextQuestionBtn');

// Results
const sentimentIcon    = document.getElementById('sentimentIcon');
const sentimentValue   = document.getElementById('sentimentValue');
const posBar = document.getElementById('posBar'); const posPct = document.getElementById('posPct');
const neuBar = document.getElementById('neuBar'); const neuPct = document.getElementById('neuPct');
const negBar = document.getElementById('negBar'); const negPct = document.getElementById('negPct');
const cpFill           = document.getElementById('cpFill');
const cpText           = document.getElementById('cpText');
const wpmValue         = document.getElementById('wpmValue');
const gaugeFill        = document.getElementById('gaugeFill');
const phrasesWrap      = document.getElementById('phrasesWrap');
const suggestionsList  = document.getElementById('suggestionsList');

/* ══════════════════════════════════════════════
   State
   ══════════════════════════════════════════════ */
let isRecording       = false;
let recognition       = null;
let timerInterval     = null;
let recordingStart    = 0;
let elapsedSeconds    = 0;
let animFrameId       = null;
let audioCtx          = null;
let analyserNode      = null;
let micStream         = null;

/* ══════════════════════════════════════════════
   Interview Questions
   ══════════════════════════════════════════════ */
const INTERVIEW_QUESTIONS = [
  "Tell me about yourself.",
  "What are your greatest strengths?",
  "What is your biggest weakness?",
  "Where do you see yourself in 5 years?",
  "Why do you want this job?",
  "Describe a challenge you've overcome.",
  "Tell me about a time you showed leadership.",
  "How do you handle stress and pressure?",
  "What motivates you?",
  "Why should we hire you?",
  "Describe your ideal work environment.",
  "Tell me about a time you worked in a team.",
];
let questionIndex = 0;

interviewToggle.addEventListener('click', () => {
  const isActive = interviewToggle.classList.toggle('active');
  interviewBanner.classList.toggle('hidden', !isActive);
  if (isActive) showQuestion(0);
});

nextQuestionBtn.addEventListener('click', () => {
  questionIndex = (questionIndex + 1) % INTERVIEW_QUESTIONS.length;
  showQuestion(questionIndex);
});

function showQuestion(idx) {
  interviewQuestion.style.opacity = '0';
  setTimeout(() => {
    interviewQuestion.textContent = INTERVIEW_QUESTIONS[idx];
    interviewQuestion.style.transition = 'opacity 0.35s';
    interviewQuestion.style.opacity = '1';
  }, 150);
}

/* ══════════════════════════════════════════════
   Word count live update
   ══════════════════════════════════════════════ */
transcriptionArea.addEventListener('input', () => {
  const words = transcriptionArea.value.trim().split(/\s+/).filter(Boolean);
  wordCountEl.textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;
  analyzeBtn.disabled = words.length === 0;
});

/* ══════════════════════════════════════════════
   Clear button
   ══════════════════════════════════════════════ */
clearBtn.addEventListener('click', () => {
  transcriptionArea.value = '';
  wordCountEl.textContent = '0 words';
  analyzeBtn.disabled = true;
  resultsSection.classList.add('hidden');
});

/* ══════════════════════════════════════════════
   Waveform Canvas Visualisation
   ══════════════════════════════════════════════ */
const ctx2d = waveformCanvas.getContext('2d');

function drawIdleWave() {
  const W = waveformCanvas.width;
  const H = waveformCanvas.height;
  ctx2d.clearRect(0, 0, W, H);
  ctx2d.strokeStyle = 'rgba(168,85,247,0.25)';
  ctx2d.lineWidth = 2;
  ctx2d.beginPath();
  ctx2d.moveTo(0, H / 2);
  ctx2d.lineTo(W, H / 2);
  ctx2d.stroke();
}
drawIdleWave();

function startWaveformVisualisation(stream) {
  if (audioCtx) audioCtx.close();
  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 256;
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyserNode);
  const bufLen = analyserNode.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    analyserNode.getByteTimeDomainData(dataArr);
    const W = waveformCanvas.width;
    const H = waveformCanvas.height;
    ctx2d.clearRect(0, 0, W, H);

    // Gradient stroke
    const grad = ctx2d.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0,   '#a855f7');
    grad.addColorStop(0.5, '#3b82f6');
    grad.addColorStop(1,   '#06b6d4');
    ctx2d.strokeStyle = grad;
    ctx2d.lineWidth = 2.5;
    ctx2d.lineJoin = 'round';
    ctx2d.beginPath();

    const sliceW = W / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = dataArr[i] / 128.0;
      const y = (v * H) / 2;
      i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
      x += sliceW;
    }
    ctx2d.lineTo(W, H / 2);
    ctx2d.stroke();
  }
  draw();
}

function stopWaveformVisualisation() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  drawIdleWave();
}

/* ══════════════════════════════════════════════
   Timer helpers
   ══════════════════════════════════════════════ */
function startTimer() {
  recordingStart = Date.now();
  elapsedSeconds = 0;
  timerEl.classList.add('visible');
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - recordingStart) / 1000);
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const s = String(elapsedSeconds % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 500);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerEl.classList.remove('visible');
}

/* ══════════════════════════════════════════════
   Speech Recognition (Web Speech API)
   ══════════════════════════════════════════════ */
function buildRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.continuous     = true;
  rec.interimResults = true;
  rec.lang           = 'en-US';

  let finalTranscript = '';

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      e.results[i].isFinal ? (finalTranscript += t + ' ') : (interim += t);
    }
    transcriptionArea.value = finalTranscript + interim;
    transcriptionArea.dispatchEvent(new Event('input'));
  };

  rec.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    if (e.error === 'not-allowed') {
      alert('Microphone access denied. Please allow microphone permissions.');
      stopRecording();
    }
  };

  rec.onend = () => { if (isRecording) rec.start(); }; // keep alive
  return rec;
}

async function startRecording() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startWaveformVisualisation(micStream);
  } catch {
    alert('Could not access microphone.');
    return;
  }

  recognition = buildRecognition();
  if (recognition) {
    recognition.start();
  } else {
    console.warn('Web Speech API not supported. You can still type text manually.');
  }

  isRecording = true;
  micBtn.classList.add('recording');
  micLabel.textContent = 'Recording…';
  startTimer();
}

function stopRecording() {
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  if (micStream)   { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  stopWaveformVisualisation();
  stopTimer();
  isRecording = false;
  micBtn.classList.remove('recording');
  micLabel.textContent = 'Tap to Record';
}

micBtn.addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});

/* ══════════════════════════════════════════════
   Analyze — call Flask backend
   ══════════════════════════════════════════════ */
analyzeBtn.addEventListener('click', async () => {
  const text = transcriptionArea.value.trim();
  if (!text) return;

  // Loading state
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  analyzeBtn.disabled = true;

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, duration: Math.max(elapsedSeconds, 30) }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');
    renderResults(data);
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
  } finally {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    analyzeBtn.disabled = false;
  }
});

/* ══════════════════════════════════════════════
   Render Results
   ══════════════════════════════════════════════ */
function renderResults(data) {
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ── Sentiment ──
  const emojiMap = { positive: '😊', neutral: '😐', negative: '😟' };
  const colorMap = {
    positive: 'var(--clr-green)',
    neutral:  'var(--clr-blue)',
    negative: 'var(--clr-red)',
  };
  const label = data.sentiment || 'neutral';
  sentimentIcon.textContent  = emojiMap[label] || '😐';
  sentimentValue.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  sentimentValue.style.color = colorMap[label] || 'inherit';

  const scores = data.sentiment_scores || {};
  animateBar(posBar, posPct, (scores.positive || 0) * 100);
  animateBar(neuBar, neuPct, (scores.neutral  || 0) * 100);
  animateBar(negBar, negPct, (scores.negative || 0) * 100);

  // ── Confidence circular progress ──
  const conf = parseFloat(data.confidence_score) || 0;
  const circumference = 251.2; // 2π × 40
  const offset = circumference - (conf / 100) * circumference;
  cpFill.style.strokeDashoffset = offset;
  cpText.textContent = `${Math.round(conf)}%`;

  // Inject SVG gradient definition once
  ensureGradientDef();

  // ── WPM gauge ──
  const wpm = parseInt(data.words_per_minute) || 0;
  wpmValue.textContent = wpm;
  // Ideal speaking: 120–160 wpm → map 0–250 wpm to 0–100%
  const gaugePercent = Math.min(100, (wpm / 250) * 100);
  gaugeFill.style.width = `${gaugePercent}%`;

  // ── Key phrases ──
  phrasesWrap.innerHTML = '';
  const phrases = data.key_phrases || [];
  if (phrases.length === 0) {
    phrasesWrap.innerHTML = '<span style="color:var(--clr-muted);font-size:0.88rem">No key phrases detected.</span>';
  } else {
    phrases.forEach((phrase, i) => {
      const chip = document.createElement('span');
      chip.className = 'phrase-chip';
      chip.textContent = phrase;
      chip.style.animationDelay = `${i * 0.07}s`;
      phrasesWrap.appendChild(chip);
    });
  }

  // ── Suggestions ──
  suggestionsList.innerHTML = '';
  const suggestions = data.suggestions || [];
  suggestions.forEach((s, i) => {
    const li = document.createElement('li');
    li.textContent = s;
    li.style.animationDelay = `${i * 0.08}s`;
    suggestionsList.appendChild(li);
  });
}

function animateBar(barEl, pctEl, value) {
  const pct = Math.round(value);
  // Use setTimeout so CSS transition fires after element is in DOM
  setTimeout(() => {
    barEl.style.width = `${pct}%`;
    pctEl.textContent = `${pct}%`;
  }, 50);
}

function ensureGradientDef() {
  const svgEl = document.querySelector('.circular-progress');
  if (!svgEl || svgEl.querySelector('#gradConf')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="gradConf" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>`;
  svgEl.prepend(defs);
}
