import { SolfeggioTone, BrainwaveBand } from '../types';

export const SOLFEGGIO_TONES: SolfeggioTone[] = [
  {
    freq: 174,
    name: '174 Hz',
    desc: 'Deep relaxation, pain relief, and a sense of physical security.',
    category: 'Foundation',
  },
  {
    freq: 285,
    name: '285 Hz',
    desc: 'Tissue repair, cellular healing, and body awareness.',
    category: 'Regeneration',
  },
  {
    freq: 396,
    name: '396 Hz',
    desc: 'Releasing fear, guilt, and grounding the root chakra.',
    category: 'Root Chakra',
  },
  {
    freq: 417,
    name: '417 Hz',
    desc: 'Undoing negative situations, facilitating emotional change, and clearing blocks.',
    category: 'Sacral Chakra',
  },
  {
    freq: 432,
    name: '432 Hz',
    desc: 'Alternative musical tuning associated with reduced heart rate and relaxation.',
    category: 'Verdi Natural Tuning',
  },
  {
    freq: 440,
    name: '440 Hz',
    desc: 'The international standard musical pitch (A4) used for general orchestration and tuning.',
    category: 'Concert Pitch',
  },
  {
    freq: 528,
    name: '528 Hz',
    desc: 'Claimed "love frequency" or "DNA repair" tone tied to transformation and emotional renewal.',
    category: 'Transformation',
  },
  {
    freq: 639,
    name: '639 Hz',
    desc: 'Heart chakra resonance meant to improve relationship harmony and empathy.',
    category: 'Heart Chakra',
  },
  {
    freq: 741,
    name: '741 Hz',
    desc: 'Throat chakra tone focused on mental clarity, problem-solving, and expression.',
    category: 'Throat Chakra',
  },
  {
    freq: 852,
    name: '852 Hz',
    desc: 'Third-eye awakening, intuition, and spiritual alignment.',
    category: 'Third Eye',
  },
  {
    freq: 963,
    name: '963 Hz',
    desc: 'Crown chakra or "God frequency" associated with higher consciousness and unity.',
    category: 'Crown Chakra',
  },
];

export const BRAINWAVE_BANDS: BrainwaveBand[] = [
  {
    id: 'delta',
    name: 'Delta',
    min: 0.5,
    max: 4.0,
    defaultDelta: 2.5,
    desc: 'Deep, dreamless sleep and physical recovery.',
    details: 'Slowest brainwave band associated with immune restoration, growth hormone release, and somatic renewal.',
    color: '#38bdf8', // Sky Blue
  },
  {
    id: 'theta',
    name: 'Theta',
    min: 4.0,
    max: 8.0,
    defaultDelta: 6.0,
    desc: 'Light sleep, deep meditation, and creativity.',
    details: 'Hypnagogic state bridging conscious and unconscious mind, memory consolidation, and intuitive insight.',
    color: '#a855f7', // Electric Purple
  },
  {
    id: 'alpha',
    name: 'Alpha',
    min: 8.0,
    max: 12.0,
    defaultDelta: 10.0,
    desc: 'Relaxed alertness, calm, and mild focus.',
    details: 'Smooth bridge state of effortless immersion, stress reduction, and flow state performance.',
    color: '#00f0ff', // Vivid Neon Cyan
  },
  {
    id: 'beta',
    name: 'Beta',
    min: 12.0,
    max: 30.0,
    defaultDelta: 18.0,
    desc: 'Active thinking, concentration, and everyday alertness.',
    details: 'Fast-wave state associated with conscious executive tasks, critical analysis, and active problem-solving.',
    color: '#f59e0b', // Amber Gold
  },
  {
    id: 'gamma',
    name: 'Gamma',
    min: 30.0,
    max: 100.0,
    defaultDelta: 40.0,
    desc: 'High-level cognitive processing and problem-solving.',
    details: 'Fastest neural synchrony band facilitating multi-sensory information binding, epiphany states, and heightened perception.',
    color: '#ff007f', // Hot Magenta
  },
];
