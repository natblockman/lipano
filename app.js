const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const KEYBOARD_START_MIDI = 21; // A0
const NOTE_COUNT = 88;
const TWO_HAND_START_MIDI = 48; // C3
const TWO_HAND_DEFAULT_KEYS = [
  "q", "2", "w", "3", "e", "r", "5", "t", "6", "y", "7", "u",
  "v", "g", "b", "h", "n", "m", "k", ",", "l", ".", ";", "/",
];
const DEFAULT_NOTE_BINDINGS = Array(NOTE_COUNT).fill("");
TWO_HAND_DEFAULT_KEYS.forEach((key, index) => {
  DEFAULT_NOTE_BINDINGS[TWO_HAND_START_MIDI - KEYBOARD_START_MIDI + index] = key;
});
Object.freeze(DEFAULT_NOTE_BINDINGS);
const DEFAULT_BINDINGS = Object.freeze({
  notes: DEFAULT_NOTE_BINDINGS,
  sustain: " ",
  octaveUp: "ArrowUp",
  octaveDown: "ArrowDown",
  record: "z",
  metronome: "x",
});
const BINDINGS_STORAGE_KEY = "lipano-bindings-v2";
const PREVIOUS_BINDINGS_STORAGE_KEY = "lipano-bindings-v1";
const METRONOME_STORAGE_KEY = "lipano-metronome-v1";
const LEGACY_BINDINGS_STORAGE_KEY = "siam-keys-bindings-v1";
const LEGACY_METRONOME_STORAGE_KEY = "siam-keys-metronome-v1";
const SUSTAIN_RELEASE_SECONDS = 2;

const keyboard = document.querySelector("#keyboard");
const volume = document.querySelector("#volume");
const volumeValue = document.querySelector("#volumeValue");
const soundSelect = document.querySelector("#soundSelect");
const sustainButton = document.querySelector("#sustainButton");
const octaveDown = document.querySelector("#octaveDown");
const octaveUp = document.querySelector("#octaveUp");
const octaveValue = document.querySelector("#octaveValue");
const noteDisplay = document.querySelector("#noteDisplay");
const noteName = document.querySelector("#noteName");
const audioStatus = document.querySelector("#audioStatus");
const recordButton = document.querySelector("#recordButton");
const playButton = document.querySelector("#playButton");
const clearButton = document.querySelector("#clearButton");
const recordTimer = document.querySelector("#recordTimer");
const helpButton = document.querySelector("#helpButton");
const helpDialog = document.querySelector("#helpDialog");
const closeHelp = document.querySelector("#closeHelp");
const keySettings = document.querySelector("#keySettings");
const bindingMessage = document.querySelector("#bindingMessage");
const resetBindings = document.querySelector("#resetBindings");
const doneBindings = document.querySelector("#doneBindings");
const shortcutHint = document.querySelector("#shortcutHint");
const metronomeToggle = document.querySelector("#metronomeToggle");
const metronomeStatus = document.querySelector("#metronomeStatus");
const tempo = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempoValue");
const timeSignature = document.querySelector("#timeSignature");
const beatIndicator = document.querySelector("#beatIndicator");
const tapTempo = document.querySelector("#tapTempo");

let audioContext;
let masterGain;
let compressor;
let octaveShift = 0;
let sustain = false;
let isRecording = false;
let isPlayingBack = false;
let recordingStartedAt = 0;
let recordingTimerId;
let recordedEvents = [];
let playbackTimeouts = [];
let remappingTarget = null;
let bindings = loadBindings();
let metronomeRunning = false;
let metronomeTimerId = null;
let nextBeatTime = 0;
let currentBeat = 0;
let tapTimes = [];
const beatVisualTimeouts = new Set();

const activeVoices = new Map();
const heldInputs = new Set();

function cloneDefaultBindings() {
  return { ...DEFAULT_BINDINGS, notes: [...DEFAULT_BINDINGS.notes] };
}

function loadBindings() {
  try {
    const saved = JSON.parse(localStorage.getItem(BINDINGS_STORAGE_KEY) || localStorage.getItem(PREVIOUS_BINDINGS_STORAGE_KEY) || localStorage.getItem(LEGACY_BINDINGS_STORAGE_KEY));
    if (
      Array.isArray(saved?.notes) &&
      saved.notes.length === DEFAULT_BINDINGS.notes.length &&
      saved.notes.every((key) => typeof key === "string") &&
      ["sustain", "octaveUp", "octaveDown", "record"].every((name) => typeof saved[name] === "string")
    ) return { ...cloneDefaultBindings(), ...saved, notes: [...saved.notes] };
  } catch (_error) {
    // A fresh profile or blocked storage should simply use the defaults.
  }
  return cloneDefaultBindings();
}

function saveBindings() {
  try { localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings)); } catch (_error) { /* Storage is optional. */ }
}

function normalizeEventKey(event) {
  if (event.code === "Space") return " ";
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

function displayKey(key) {
  if (!key) return "—";
  const names = { " ": "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  return names[key] || key.toUpperCase();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function allAssignedKeys() {
  return [
    ...bindings.notes,
    bindings.sustain,
    bindings.octaveUp,
    bindings.octaveDown,
    bindings.record,
    bindings.metronome,
  ].filter(Boolean);
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function noteDetails(midi) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, label: `${name}${octave}` };
}

function initializeAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;
    masterGain.gain.value = Number(volume.value) / 100;
    masterGain.connect(compressor).connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") audioContext.resume();
  audioStatus.textContent = "ระบบเสียงทำงาน";
}

function loadMetronomeSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(METRONOME_STORAGE_KEY) || localStorage.getItem(LEGACY_METRONOME_STORAGE_KEY));
    return {
      bpm: Math.max(40, Math.min(220, Number(saved?.bpm) || 100)),
      beats: [2, 3, 4, 6].includes(Number(saved?.beats)) ? Number(saved.beats) : 4,
    };
  } catch (_error) {
    return { bpm: 100, beats: 4 };
  }
}

function saveMetronomeSettings() {
  try {
    localStorage.setItem(METRONOME_STORAGE_KEY, JSON.stringify({
      bpm: Number(tempo.value),
      beats: Number(timeSignature.value),
    }));
  } catch (_error) { /* Storage is optional. */ }
}

function updateTempoDisplay() {
  const bpm = Number(tempo.value);
  const progress = ((bpm - 40) / 180) * 100;
  tempoValue.textContent = `${bpm} BPM`;
  tempo.style.background = `linear-gradient(90deg, var(--gold) ${progress}%, rgba(255,255,255,.12) ${progress}%)`;
}

function renderBeatIndicator() {
  const beats = Number(timeSignature.value);
  beatIndicator.innerHTML = Array.from({ length: beats }, (_, index) => {
    return `<i class="beat-dot" data-beat="${index}" aria-hidden="true"></i>`;
  }).join("");
}

function flashBeat(beat, scheduledTime) {
  const delay = Math.max(0, (scheduledTime - audioContext.currentTime) * 1000);
  const timeoutId = window.setTimeout(() => {
    beatVisualTimeouts.delete(timeoutId);
    beatIndicator.querySelectorAll(".beat-dot").forEach((dot, index) => {
      dot.classList.toggle("active", index === beat);
    });
  }, delay);
  beatVisualTimeouts.add(timeoutId);
}

function scheduleMetronomeClick(beat, scheduledTime) {
  const oscillator = audioContext.createOscillator();
  const clickGain = audioContext.createGain();
  const isAccent = beat === 0;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(isAccent ? 1500 : 950, scheduledTime);
  clickGain.gain.setValueAtTime(isAccent ? 0.24 : 0.14, scheduledTime);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + 0.055);
  oscillator.connect(clickGain).connect(masterGain);
  oscillator.start(scheduledTime);
  oscillator.stop(scheduledTime + 0.06);
  flashBeat(beat, scheduledTime);
}

function runMetronomeScheduler() {
  if (!metronomeRunning || !audioContext) return;
  while (nextBeatTime < audioContext.currentTime + 0.1) {
    scheduleMetronomeClick(currentBeat, nextBeatTime);
    nextBeatTime += 60 / Number(tempo.value);
    currentBeat = (currentBeat + 1) % Number(timeSignature.value);
  }
}

function startMetronome() {
  initializeAudio();
  metronomeRunning = true;
  currentBeat = 0;
  nextBeatTime = audioContext.currentTime + 0.05;
  metronomeToggle.setAttribute("aria-pressed", "true");
  metronomeStatus.textContent = "กำลังเล่น";
  runMetronomeScheduler();
  metronomeTimerId = window.setInterval(runMetronomeScheduler, 25);
}

function stopMetronome() {
  metronomeRunning = false;
  window.clearInterval(metronomeTimerId);
  metronomeTimerId = null;
  beatVisualTimeouts.forEach(window.clearTimeout);
  beatVisualTimeouts.clear();
  beatIndicator.querySelectorAll(".beat-dot").forEach((dot) => dot.classList.remove("active"));
  metronomeToggle.setAttribute("aria-pressed", "false");
  metronomeStatus.textContent = "ปิดอยู่";
}

function toggleMetronome() {
  if (metronomeRunning) stopMetronome();
  else startMetronome();
}

function registerTempoTap() {
  const now = performance.now();
  if (tapTimes.length && now - tapTimes.at(-1) > 2000) tapTimes = [];
  tapTimes.push(now);
  tapTimes = tapTimes.slice(-5);
  if (tapTimes.length < 2) return;
  const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
  const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  tempo.value = String(Math.max(40, Math.min(220, Math.round(60000 / average))));
  updateTempoDisplay();
  saveMetronomeSettings();
}

function createPianoVoice(midi, velocity = 0.8) {
  initializeAudio();
  const now = audioContext.currentTime;
  const frequency = midiToFrequency(midi);
  const output = audioContext.createGain();
  const toneFilter = audioContext.createBiquadFilter();
  const preset = soundSelect.value;
  const oscillators = [];

  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(preset === "synth" ? 2100 : 4200, now);
  toneFilter.Q.value = preset === "bell" ? 1.8 : 0.6;
  output.connect(toneFilter).connect(masterGain);

  const configs = {
    grand: [
      { type: "triangle", ratio: 1, gain: 0.75, detune: -1.5 },
      { type: "sine", ratio: 2, gain: 0.18, detune: 2 },
      { type: "sine", ratio: 3, gain: 0.07, detune: 0 },
    ],
    warm: [
      { type: "sine", ratio: 1, gain: 0.72, detune: -3 },
      { type: "triangle", ratio: 1, gain: 0.3, detune: 3 },
      { type: "sine", ratio: 2, gain: 0.08, detune: 0 },
    ],
    bell: [
      { type: "sine", ratio: 1, gain: 0.62, detune: 0 },
      { type: "sine", ratio: 2.01, gain: 0.26, detune: 0 },
      { type: "sine", ratio: 3.99, gain: 0.12, detune: 0 },
    ],
    synth: [
      { type: "sawtooth", ratio: 1, gain: 0.34, detune: -7 },
      { type: "sawtooth", ratio: 1, gain: 0.34, detune: 7 },
      { type: "square", ratio: 0.5, gain: 0.08, detune: 0 },
    ],
  };

  const attack = preset === "synth" ? 0.045 : 0.006;
  const peak = velocity * (preset === "synth" ? 0.32 : 0.48);
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), now + attack);
  output.gain.exponentialRampToValueAtTime(Math.max(peak * 0.48, 0.001), now + (preset === "bell" ? 1.2 : 0.65));

  configs[preset].forEach(({ type, ratio, gain, detune }) => {
    const osc = audioContext.createOscillator();
    const partialGain = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = frequency * ratio;
    osc.detune.value = detune;
    partialGain.gain.value = gain;
    osc.connect(partialGain).connect(output);
    osc.start(now);
    oscillators.push(osc);
  });

  return { output, oscillators, midi, released: false };
}

function keyForMidi(midi) {
  return keyboard.querySelector(`[data-midi="${midi - octaveShift * 12}"]`);
}

function playNote(baseMidi, inputId = `note-${baseMidi}`, options = {}) {
  const midi = baseMidi + octaveShift * 12;
  if (activeVoices.has(inputId)) return;

  const voice = createPianoVoice(midi, options.velocity || 0.8);
  activeVoices.set(inputId, voice);
  heldInputs.add(inputId);
  const key = keyForMidi(midi);
  if (key) key.classList.add("active");

  const details = noteDetails(midi);
  noteDisplay.textContent = details.name.replace("♯", "#");
  noteName.textContent = `${details.label} · ${soundSelect.options[soundSelect.selectedIndex].text}`;

  if (isRecording && !options.fromPlayback) {
    recordedEvents.push({ type: "on", midi: baseMidi, time: performance.now() - recordingStartedAt });
  }
}

function releaseVoice(inputId, releaseTime = 0.75) {
  const voice = activeVoices.get(inputId);
  if (!voice || voice.released) return;

  voice.released = true;
  const now = audioContext.currentTime;
  voice.output.gain.cancelScheduledValues(now);
  voice.output.gain.setValueAtTime(Math.max(voice.output.gain.value, 0.001), now);
  voice.output.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
  voice.oscillators.forEach((osc) => osc.stop(now + releaseTime + 0.05));
  activeVoices.delete(inputId);

  const key = keyForMidi(voice.midi);
  if (key) key.classList.remove("active");
}

function stopNote(baseMidi, inputId = `note-${baseMidi}`, options = {}) {
  heldInputs.delete(inputId);
  if (sustain && !options.ignoreSustain) {
    releaseVoice(inputId, SUSTAIN_RELEASE_SECONDS);
  } else {
    releaseVoice(inputId, soundSelect.value === "synth" ? 1.1 : 0.75);
  }

  if (isRecording && !options.fromPlayback) {
    recordedEvents.push({ type: "off", midi: baseMidi, time: performance.now() - recordingStartedAt });
  }
}

function setSustain(nextState) {
  sustain = nextState;
  sustainButton.setAttribute("aria-pressed", String(sustain));
}

function buildKeyboard() {
  const whiteNotes = [];
  const blackNotes = [];

  for (let i = 0; i < NOTE_COUNT; i += 1) {
    const midi = KEYBOARD_START_MIDI + i;
    const noteIndex = midi % 12;
    (noteIndex === 1 || noteIndex === 3 || noteIndex === 6 || noteIndex === 8 || noteIndex === 10 ? blackNotes : whiteNotes).push(midi);
  }

  whiteNotes.forEach((midi, whiteIndex) => {
    const key = document.createElement("button");
    const details = noteDetails(midi);
    const keyboardIndex = midi - KEYBOARD_START_MIDI;
    const mappedKey = bindings.notes[keyboardIndex];
    key.type = "button";
    key.className = "key white";
    key.dataset.midi = midi;
    key.setAttribute("aria-label", `โน้ต ${details.label}`);
    key.innerHTML = `<span class="key-label">${mappedKey ? `<kbd>${escapeHtml(displayKey(mappedKey))}</kbd>` : ""}<span>${details.label}</span></span>`;
    keyboard.appendChild(key);
  });

  blackNotes.forEach((midi) => {
    const previousWhites = Array.from({ length: midi - KEYBOARD_START_MIDI + 1 }, (_, i) => KEYBOARD_START_MIDI + i)
      .filter((note) => ![1, 3, 6, 8, 10].includes(note % 12)).length;
    const details = noteDetails(midi);
    const keyboardIndex = midi - KEYBOARD_START_MIDI;
    const mappedKey = bindings.notes[keyboardIndex];
    const key = document.createElement("button");
    key.type = "button";
    key.className = "key black";
    key.dataset.midi = midi;
    key.setAttribute("aria-label", `โน้ต ${details.label}`);
    key.style.left = `${(previousWhites / whiteNotes.length) * 100}%`;
    key.style.width = `${(0.63 / whiteNotes.length) * 100}%`;
    key.innerHTML = `<span class="key-label">${mappedKey ? `<kbd>${escapeHtml(displayKey(mappedKey))}</kbd>` : ""}<span>${details.label}</span></span>`;
    keyboard.appendChild(key);
  });
}

function centerKeyboardOnMiddleC() {
  const scrollArea = document.querySelector("#keyboardScroll");
  const middleC = keyboard.querySelector('[data-midi="60"]');
  if (!middleC || scrollArea.scrollWidth <= scrollArea.clientWidth) return;
  scrollArea.scrollLeft = Math.max(
    0,
    middleC.offsetLeft - scrollArea.clientWidth / 2 + middleC.offsetWidth / 2,
  );
}

function baseMidiFromKey(key) {
  const index = bindings.notes.indexOf(key);
  return index === -1 ? null : KEYBOARD_START_MIDI + index;
}

function bindingButton(label, key, type, value) {
  const emptyClass = key ? "" : " is-empty";
  return `<div class="binding-item"><span>${escapeHtml(label)}</span><button class="binding-key${emptyClass}" type="button" data-binding-type="${type}" data-binding-value="${value}">${escapeHtml(displayKey(key))}</button></div>`;
}

function renderBindingSettings() {
  const noteGroups = new Map();
  bindings.notes.forEach((key, index) => {
    const details = noteDetails(KEYBOARD_START_MIDI + index);
    if (!noteGroups.has(details.octave)) noteGroups.set(details.octave, []);
    noteGroups.get(details.octave).push(bindingButton(details.label, key, "note", index));
  });
  const noteSections = Array.from(noteGroups, ([octave, buttons]) => `
    <section class="binding-section note-binding-section">
      <h3>อ็อกเทฟ ${octave}</h3>
      <div class="binding-grid">${buttons.join("")}</div>
    </section>`).join("");
  const actions = [
    ["Sustain", bindings.sustain, "sustain"],
    ["อ็อกเทฟ +", bindings.octaveUp, "octaveUp"],
    ["อ็อกเทฟ −", bindings.octaveDown, "octaveDown"],
    ["บันทึก", bindings.record, "record"],
    ["เมโทรนอม", bindings.metronome, "metronome"],
  ].map(([label, key, name]) => bindingButton(label, key, "action", name)).join("");

  const assignedNotes = bindings.notes.filter(Boolean).length;
  keySettings.innerHTML = `
    <div class="binding-summary"><strong>${assignedNotes} / ${NOTE_COUNT}</strong><span>โน้ตที่กำหนดปุ่มแล้ว · คลิก — เพื่อเพิ่มปุ่ม</span></div>
    ${noteSections}
    <section class="binding-section action-bindings"><h3>คำสั่ง</h3><div class="binding-grid">${actions}</div></section>`;
  shortcutHint.innerHTML = `<kbd>${escapeHtml(displayKey(bindings.sustain))}</kbd> ค้างเสียง <span></span> ตั้งค่าโน้ตได้ครบ 88 คีย์`;
}

function cancelRemapping() {
  remappingTarget = null;
  renderBindingSettings();
  bindingMessage.textContent = "";
  bindingMessage.classList.remove("is-success");
}

function beginRemapping(button) {
  renderBindingSettings();
  const selector = `[data-binding-type="${button.dataset.bindingType}"][data-binding-value="${button.dataset.bindingValue}"]`;
  const currentButton = keySettings.querySelector(selector);
  remappingTarget = {
    type: button.dataset.bindingType,
    value: button.dataset.bindingValue,
  };
  currentButton.classList.add("is-waiting");
  currentButton.textContent = "กดปุ่ม…";
  bindingMessage.textContent = "กดปุ่มใหม่ · Backspace/Delete เพื่อล้าง · Esc เพื่อยกเลิก";
  bindingMessage.classList.remove("is-success");
}

function applyRemapping(event) {
  if (!remappingTarget) return false;
  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    cancelRemapping();
    return true;
  }

  if (remappingTarget.type === "note" && ["Backspace", "Delete"].includes(event.key)) {
    bindings.notes[Number(remappingTarget.value)] = "";
    saveBindings();
    remappingTarget = null;
    keyboard.innerHTML = "";
    buildKeyboard();
    renderBindingSettings();
    bindingMessage.textContent = "ล้างปุ่มของโน้ตแล้ว";
    bindingMessage.classList.add("is-success");
    return true;
  }

  const key = normalizeEventKey(event);
  const blocked = ["Tab", "Enter", "Shift", "Control", "Alt", "Meta", "CapsLock"];
  if (blocked.includes(key) || (key.length > 1 && !key.startsWith("Arrow"))) {
    bindingMessage.textContent = "ปุ่มนี้ใช้ตั้งค่าไม่ได้ กรุณาเลือกตัวอักษร ตัวเลข สัญลักษณ์ หรือปุ่มลูกศร";
    return true;
  }

  let oldKey;
  if (remappingTarget.type === "note") oldKey = bindings.notes[Number(remappingTarget.value)];
  else oldKey = bindings[remappingTarget.value];

  if (key !== oldKey && allAssignedKeys().includes(key)) {
    bindingMessage.textContent = `ปุ่ม ${displayKey(key)} ถูกใช้อยู่แล้ว กรุณาเลือกปุ่มอื่น`;
    return true;
  }

  if (remappingTarget.type === "note") bindings.notes[Number(remappingTarget.value)] = key;
  else bindings[remappingTarget.value] = key;
  saveBindings();
  remappingTarget = null;
  keyboard.innerHTML = "";
  buildKeyboard();
  renderBindingSettings();
  bindingMessage.textContent = `ตั้งเป็นปุ่ม ${displayKey(key)} แล้ว`;
  bindingMessage.classList.add("is-success");
  return true;
}

function pointerDown(event) {
  const key = event.target.closest(".key");
  if (!key) return;
  event.preventDefault();
  key.setPointerCapture?.(event.pointerId);
  playNote(Number(key.dataset.midi), `pointer-${event.pointerId}`);
}

function pointerUp(event) {
  stopNote(0, `pointer-${event.pointerId}`);
}

function updateOctave(direction) {
  octaveShift = Math.max(-2, Math.min(2, octaveShift + direction));
  octaveValue.textContent = octaveShift > 0 ? `+${octaveShift}` : String(octaveShift);
  octaveDown.disabled = octaveShift === -2;
  octaveUp.disabled = octaveShift === 2;
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function toggleRecording() {
  if (isPlayingBack) stopPlayback();
  if (!isRecording) {
    recordedEvents = [];
    recordingStartedAt = performance.now();
    isRecording = true;
    recordButton.classList.add("is-recording");
    recordButton.querySelector("span").textContent = "หยุด";
    playButton.disabled = true;
    clearButton.disabled = true;
    recordTimer.textContent = "00:00";
    recordingTimerId = window.setInterval(() => {
      recordTimer.textContent = formatTime(performance.now() - recordingStartedAt);
    }, 250);
  } else {
    isRecording = false;
    window.clearInterval(recordingTimerId);
    recordButton.classList.remove("is-recording");
    recordButton.querySelector("span").textContent = "บันทึก";
    playButton.disabled = recordedEvents.length === 0;
    clearButton.disabled = recordedEvents.length === 0;
  }
}

function stopPlayback() {
  playbackTimeouts.forEach(window.clearTimeout);
  playbackTimeouts = [];
  Array.from(activeVoices.keys()).filter((id) => id.startsWith("playback-")).forEach((id) => releaseVoice(id, 0.15));
  isPlayingBack = false;
  playButton.querySelector("span:last-child").textContent = "เล่นซ้ำ";
  playButton.querySelector(".play-icon").style.borderLeftColor = "";
  recordTimer.textContent = recordedEvents.length ? formatTime(recordedEvents.at(-1).time) : "00:00";
}

function playRecording() {
  if (isPlayingBack) {
    stopPlayback();
    return;
  }
  if (!recordedEvents.length) return;
  initializeAudio();
  isPlayingBack = true;
  playButton.querySelector("span:last-child").textContent = "หยุดเล่น";
  const playbackStartedAt = performance.now();
  const lastTime = recordedEvents.at(-1).time;

  recordedEvents.forEach((event, index) => {
    const id = `playback-${event.midi}`;
    playbackTimeouts.push(window.setTimeout(() => {
      if (event.type === "on") playNote(event.midi, id, { fromPlayback: true });
      else stopNote(event.midi, id, { fromPlayback: true, ignoreSustain: true });
    }, event.time));
  });

  const progressId = window.setInterval(() => {
    recordTimer.textContent = formatTime(Math.min(performance.now() - playbackStartedAt, lastTime));
  }, 100);
  playbackTimeouts.push(progressId);
  playbackTimeouts.push(window.setTimeout(() => {
    window.clearInterval(progressId);
    stopPlayback();
  }, lastTime + 1200));
}

const savedMetronome = loadMetronomeSettings();
tempo.value = String(savedMetronome.bpm);
timeSignature.value = String(savedMetronome.beats);
updateTempoDisplay();
renderBeatIndicator();
buildKeyboard();
renderBindingSettings();
requestAnimationFrame(centerKeyboardOnMiddleC);

keyboard.addEventListener("pointerdown", pointerDown);
keyboard.addEventListener("pointerup", pointerUp);
keyboard.addEventListener("pointercancel", pointerUp);
keyboard.addEventListener("lostpointercapture", pointerUp);

document.addEventListener("keydown", (event) => {
  if (applyRemapping(event)) return;
  if (event.repeat || event.target.matches("select, input")) return;
  if (helpDialog.open) return;
  const key = normalizeEventKey(event);
  if (key === bindings.sustain) {
    event.preventDefault();
    setSustain(true);
    return;
  }
  if (key === bindings.octaveUp) { event.preventDefault(); updateOctave(1); return; }
  if (key === bindings.octaveDown) { event.preventDefault(); updateOctave(-1); return; }
  if (key === bindings.record) { event.preventDefault(); toggleRecording(); return; }
  if (key === bindings.metronome) { event.preventDefault(); toggleMetronome(); return; }
  const midi = baseMidiFromKey(key);
  if (midi !== null) playNote(midi, `keyboard-${key}`);
});

document.addEventListener("keyup", (event) => {
  const key = normalizeEventKey(event);
  if (key === bindings.sustain) { setSustain(false); return; }
  const midi = baseMidiFromKey(key);
  if (midi !== null) stopNote(midi, `keyboard-${key}`);
});

window.addEventListener("blur", () => {
  heldInputs.forEach((inputId) => releaseVoice(inputId, 0.12));
  heldInputs.clear();
  setSustain(false);
});

volume.addEventListener("input", () => {
  const value = Number(volume.value);
  volumeValue.textContent = `${value}%`;
  volume.style.background = `linear-gradient(90deg, var(--gold) ${value}%, rgba(255,255,255,.12) ${value}%)`;
  if (masterGain && audioContext) masterGain.gain.setTargetAtTime(value / 100, audioContext.currentTime, 0.015);
});

sustainButton.addEventListener("click", () => setSustain(!sustain));
metronomeToggle.addEventListener("click", toggleMetronome);
tempo.addEventListener("input", () => {
  updateTempoDisplay();
  saveMetronomeSettings();
});
timeSignature.addEventListener("change", () => {
  currentBeat = 0;
  renderBeatIndicator();
  saveMetronomeSettings();
});
tapTempo.addEventListener("click", registerTempoTap);
octaveDown.addEventListener("click", () => updateOctave(-1));
octaveUp.addEventListener("click", () => updateOctave(1));
recordButton.addEventListener("click", toggleRecording);
playButton.addEventListener("click", playRecording);
clearButton.addEventListener("click", () => {
  stopPlayback();
  recordedEvents = [];
  playButton.disabled = true;
  clearButton.disabled = true;
  recordTimer.textContent = "00:00";
});

helpButton.addEventListener("click", () => {
  cancelRemapping();
  helpDialog.showModal();
});
closeHelp.addEventListener("click", () => {
  cancelRemapping();
  helpDialog.close();
});
doneBindings.addEventListener("click", () => {
  cancelRemapping();
  helpDialog.close();
});
keySettings.addEventListener("click", (event) => {
  const button = event.target.closest(".binding-key");
  if (button) beginRemapping(button);
});
resetBindings.addEventListener("click", () => {
  bindings = cloneDefaultBindings();
  saveBindings();
  remappingTarget = null;
  keyboard.innerHTML = "";
  buildKeyboard();
  renderBindingSettings();
  bindingMessage.textContent = "คืนค่าปุ่มเริ่มต้นแล้ว";
  bindingMessage.classList.add("is-success");
});
helpDialog.addEventListener("click", (event) => {
  const bounds = helpDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    cancelRemapping();
    helpDialog.close();
  }
});
