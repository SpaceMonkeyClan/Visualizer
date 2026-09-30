export class BeatDetector {
  constructor(analyser) {
    this.analyser = analyser;
    const binCount = analyser && analyser.frequencyBinCount ? analyser.frequencyBinCount : 256;
    this.currentFreqData = new Uint8Array(binCount);
    this.prevFreqData = new Uint8Array(binCount);
    this.history = [];
    this.lastBeatTime = -Infinity;
    this.cooldown = 160; // 160ms cooldown window
    this.flux = 0;
    this.threshold = 0;
  }

  checkBeat(time) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.currentFreqData);
    }

    // Compute positive spectral flux across sub-bass/bass bins (bins 1 to 16)
    let flux = 0;
    for (let i = 1; i <= 16; i++) {
      const diff = this.currentFreqData[i] - this.prevFreqData[i];
      if (diff > 0) {
        flux += diff;
      }
    }
    this.flux = flux;

    // Rolling history dynamic mean threshold
    const mean = this.history.length > 0
      ? this.history.reduce((sum, val) => sum + val, 0) / this.history.length
      : 0;
    const threshold = mean * 1.35;
    this.threshold = threshold;

    const now = typeof time === 'number'
      ? time
      : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());

    let isBeat = false;
    if (flux > threshold && (now - this.lastBeatTime) >= this.cooldown) {
      isBeat = true;
      this.lastBeatTime = now;
    }

    // Maintain rolling history of the last 30 flux values
    this.history.push(flux);
    if (this.history.length > 30) {
      this.history.shift();
    }

    // Store current frequency data for the next frame
    this.prevFreqData.set(this.currentFreqData);

    return isBeat;
  }
}

export default BeatDetector;
