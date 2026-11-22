'use strict';

const nmaEntryIncident = (() => {
  function createAudio(audio) {
    const bus = audio.createGain();
    const level = audio.createGain();
    const compressor = audio.createDynamicsCompressor();
    level.gain.value = .58;
    compressor.threshold.value = -16;
    compressor.ratio.value = 3.5;
    bus.connect(compressor).connect(level).connect(audio.destination);
    const hiss = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const channel = hiss.getChannelData(0);
    for (let index = 0; index < channel.length; index++) channel[index] = Math.random() * 2 - 1;

    function envelope(at, duration, peak, attack, release) {
      const volume = audio.createGain();
      volume.gain.setValueAtTime(.0001, at);
      volume.gain.linearRampToValueAtTime(peak, at + attack);
      volume.gain.setValueAtTime(peak, at + duration - release);
      volume.gain.exponentialRampToValueAtTime(.0001, at + duration);
      volume.connect(bus);
      return volume;
    }

    function tone(at, duration, from, to, peak, type = 'sine', attack = .025, release = .09) {
      const voice = audio.createOscillator();
      voice.type = type;
      voice.frequency.setValueAtTime(from, at);
      voice.frequency.exponentialRampToValueAtTime(to, at + duration);
      voice.connect(envelope(at, duration, peak, attack, release));
      voice.start(at);
      voice.stop(at + duration);
    }

    function noise(at, duration, frequency, peak, q = 1.1) {
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = q;
      source.buffer = hiss;
      source.loop = true;
      source.connect(filter).connect(envelope(at, duration, peak, .008, Math.min(.075, duration * .45)));
      source.start(at, Math.random() * 1.15);
      source.stop(at + duration);
    }

    function relay(at) {
      tone(at, .14, 136, 63, .17, 'triangle', .006, .105);
      noise(at + .004, .12, 680, .22, 1.3);
      noise(at + .065, .21, 1120, .13);
      noise(at + .192, .088, 1760, .12, 2);
      tone(at + .04, .23, 488, 232, .045, 'triangle', .012, .07);
    }

    function alarm(at, duration) {
      const pitch = 322;
      const half = duration * .52;
      tone(at, duration, pitch * .52, pitch * .49, .095, 'sine', .07, .13);
      tone(at, half, pitch * .98, pitch * 1.11, .135, 'triangle', .055, .058);
      tone(at + half * .78, duration - half * .78, pitch * 1.43, pitch * 1.28, .105, 'triangle', .048, .105);
      tone(at + .028, duration - .042, pitch * 2.03, pitch * 1.92, .032, 'sine', .045, .11);
      noise(at + .014, duration - .016, 850, .075, 1.5);
    }

    return cue => {
      const at = audio.currentTime + .012;
      if (cue === 'warning') {
        relay(at);
        alarm(at + .045, .68);
        alarm(at + .82, .64);
      } else if (cue === 'quiet') {
        bus.gain.setTargetAtTime(0, at, .006);
      } else if (cue === 'incident') {
        tone(at, 5, 65, 61, .061, 'sine', .28, .025);
        tone(at, 5, 132, 123, .032, 'triangle', .36, .025);
        noise(at, 5, 227, .045, .7);
      } else if (cue === 'fault') {
        relay(at);
        alarm(at + .045, .56);
      }
    };
  }

  return { createAudio };
})();
