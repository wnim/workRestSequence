import '@testing-library/jest-dom';

// Stub Web Audio API — not available in jsdom
global.AudioContext = class {
  createOscillator() { return { connect: () => {}, frequency: { value: 0 }, start: () => {}, stop: () => {} }; }
  createGain() { return { connect: () => {}, gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
  get currentTime() { return 0; }
  get destination() { return {}; }
  resume() { return Promise.resolve(); }
  get state() { return 'running'; }
};

// Minimal RAF stub
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
