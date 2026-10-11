/* The original Nokia OTT data is decoded here; no replacement sound assets. */
window.BounceAudio = {
  enabled: (typeof localStorage !== 'undefined' && localStorage.getItem('bounce:sound')) !== 'off',
  volume: (() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('bounce:volume') : null;
    return stored !== null && stored.trim() && Number.isFinite(Number(stored)) ? Math.max(0, Math.min(1, Number(stored))) : 1;
  })(),
  keyTones: typeof localStorage !== 'undefined' && localStorage.getItem('bounce:keytones') === 'on',
  context: null,
  master: null,
  setVolume(vol) {
    if (!Number.isFinite(Number(vol))) return;
    this.volume = Math.max(0, Math.min(1, Number(vol)));
    if (this.master) this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
    if (typeof localStorage !== 'undefined') localStorage.setItem('bounce:volume', String(this.volume));
  },
  setKeyTones(on) {
    this.keyTones = Boolean(on);
    if (typeof localStorage !== 'undefined') localStorage.setItem('bounce:keytones', this.keyTones ? 'on' : 'off');
  },
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !this.enabled) return;
    this.context ||= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
  },
  decode(data) {
    // Nokia Smart Messaging 3.0, section 3.6: MSB-first command bitstream.
    let bit = 0;
    const read = count => { let n = 0; for (let i = 0; i < count; i++,bit++) { if(bit >= data.length * 8) throw new Error('Truncated Nokia sound'); n = n * 2 + ((data[bit >> 3] >>> (7 - (bit & 7))) & 1); } return n; };
    if (read(8) !== 2 || read(8) !== 0x4a || read(7) !== 0x1d) throw new Error('Unsupported Nokia sound header');
    const type = read(3);
    if (type === 1) { const titleLength = read(4); for(let i = 0; i < titleLength; i++) read(8); }
    else if(type !== 2) throw new Error('Unsupported Nokia song type');
    const tempos = [25,28,31,35,40,45,50,56,63,70,80,90,100,112,125,140,160,180,200,225,250,285,320,355,400,450,500,565,635,715,800,900];
    let tempo = 63, scale = 1, style = 0, volume = 1;
    const result = [], patterns = new Map(), count = read(8);
    for (let pattern = 0; pattern < count; pattern++) {
      if(read(3) !== 0) throw new Error('Invalid Nokia sound pattern');
      const id = read(2), loops = read(4), instructions = read(8);
      const notes = []; scale = 1; style = 0;
      for(let instruction = 0; instruction < instructions; instruction++) {
        const command = read(3);
        if(command === 1) {
          const pitch = read(4), length = read(3), modifier = read(2);
          if(pitch > 12 || length > 5) throw new Error('Invalid Nokia sound note');
          const duration = (240 / tempo) / 2 ** length * [1,1.5,1.75,2/3][modifier];
          const midi = 60 + scale * 12 + pitch - 1;
          notes.push({ frequency: pitch ? 440 * 2 ** ((midi - 69) / 12) : 0, duration, gate: [20/21,1,.5][style] ?? 1, volume });
        } else if(command === 2) scale = read(2);
        else if(command === 3) style = read(2);
        else if(command === 4) tempo = tempos[read(5)];
        else if(command === 5) volume = read(4) / 15;
        else throw new Error('Unsupported Nokia sound instruction');
      }
      if(instructions) patterns.set(id,notes);
      const sequence = instructions ? notes : patterns.get(id) || [];
      for(let i = 0; i <= (loops === 15 ? 0 : loops); i++) result.push(...sequence);
    }
    return result;
  },
  play(sound, repeat = 1) {
    this.stop(sound);
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    if (this.active && this.active !== sound) this.stop(this.active);
    this.active = sound;
    let time = this.context.currentTime + .005;
    sound.nodes = [];
    for (let loop = 0; loop < Math.max(1, Math.min(repeat, 10)); loop++) {
      for (const note of sound.notes) {
        if (note.frequency) {
          const oscillator = this.context.createOscillator();
          const gain = this.context.createGain();
          oscillator.type = 'square';
          oscillator.frequency.value = note.frequency;
          gain.gain.setValueAtTime(.055 * (sound.gain ?? 1) * (note.volume ?? 1), time);
          gain.gain.setValueAtTime(0, time + Math.max(.005, note.duration * (note.gate ?? 1)));
          oscillator.connect(gain).connect(this.master);
          oscillator.start(time); oscillator.stop(time + note.duration);
          sound.nodes.push(oscillator);
        }
        time += note.duration;
      }
    }
    sound.state = 0;
    sound.endsAt = time;
  },
  stop(sound) { for (const node of sound.nodes || []) { try { node.stop(); } catch {} } sound.nodes = []; sound.state = 1; },
  beep(freq = 800, duration = 0.032) {
    if (!this.enabled || !this.keyTones || !this.context || this.context.state !== 'running') return;
    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const now = this.context.currentTime;
      gain.gain.setValueAtTime(0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }
};
