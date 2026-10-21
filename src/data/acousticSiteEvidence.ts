/**
 * Evidence-led archaeoacoustic reference records.
 * Frequencies are transcribed as reported by the cited research; do not round measured values to 110 Hz.
 */
export interface AcousticSiteEvidence {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: string;
  period: string;
  measuredFrequenciesHz: number[];
  researchBandHz?: number;
  measurementContext?: string;
  measurements?: { parameter: string; frequencyHz: number; reportedValue: number; unit: string; method: string }[];
  status: 'published-measurement' | 'candidate-only';
  summary: string;
  caveat: string;
  sources: { label: string; url: string; year: number; publication: string }[];
}

export const ACOUSTIC_SITE_EVIDENCE: AcousticSiteEvidence[] = [
  {
    id: 'hal-saflieni-hypogeum',
    name: 'Ħal Saflieni Hypogeum — Oracle Room',
    lat: 35.8728,
    lon: 14.5069,
    region: 'Paola, Malta',
    period: 'Neolithic; commonly dated broadly to the 4th–3rd millennium BCE',
    measuredFrequenciesHz: [70, 114],
    researchBandHz: 110,
    status: 'published-measurement',
    summary: 'A 2015 archaeoacoustic paper reports strong room resonance at 70 Hz and 114 Hz. The 2017 peer-reviewed study applied a systematic acoustic measurement approach; a 2020 paper further examined the site’s measured frequency spectrum and geometry.',
    caveat: 'The reported upper resonance is 114 Hz, not 110 Hz. It is displayed in the 110 Hz investigation band only as a nearby measured result (difference: +4 Hz); the original measured value is preserved. This does not establish a global Earth resonance or a shared frequency at other ancient sites.',
    sources: [
      { label: 'Debertolis, Coimbra & Eneix (2015), Archaeoacoustic Analysis of the Ħal Saflieni Hypogeum in Malta', url: 'https://doi.org/10.15640/jaa.v3n1a4', year: 2015, publication: 'Journal of Anthropology and Archaeology 3(1)' },
      { label: 'Till (2017), An archaeoacoustic study of the Ħal Saflieni Hypogeum on Malta', url: 'https://doi.org/10.15184/aqy.2016.258', year: 2017, publication: 'Antiquity 91(355), 74–89' },
      { label: 'Wolfe, Swanson & Till (2020), The frequency spectrum and geometry of the Ħal Saflieni Hypogeum appear tuned', url: 'https://doi.org/10.1016/j.jasrep.2020.102623', year: 2020, publication: 'Journal of Archaeological Science: Reports 34, 102623' }
    ]

  },
  {
    id: 'la-pasiega-turret-cave', name: 'La Pasiega Turret Cave', lat: 43.286, lon: -3.967,
    region: 'Cantabria, Spain', period: 'Palaeolithic painted cave',
    measuredFrequenciesHz: [125, 250, 500, 1000, 2000], status: 'published-measurement',
    summary: 'Published in-situ acoustic characterization of a prehistoric painted cave. The study reports early decay time (EDT) by octave band, not a single natural resonance frequency.',
    measurementContext: 'Reported EDT: 1.92 s at 125 Hz, 1.62 s at 250 Hz, 1.58 s at 500 Hz, 1.40 s at 1000 Hz, and 1.16 s at 2000 Hz; reported average 1.54 s over 125–1000 Hz. Measurements were made at selected cave positions and compared with concert halls.',
    measurements: [
      { parameter: 'EDT', frequencyHz: 125, reportedValue: 1.92, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 250, reportedValue: 1.62, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 500, reportedValue: 1.58, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 1000, reportedValue: 1.40, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 2000, reportedValue: 1.16, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' }
    ],
    caveat: 'These values describe sound decay at each frequency band. They are not evidence that the cave produces or is tuned to 110 Hz.',
    sources: [{ label: 'Till (2019), Sound Archaeology: A Study of the Acoustics of Three World Heritage Sites', url: 'https://doi.org/10.3390/acoustics1030039', year: 2019, publication: 'Acoustics 1(3), 661–692' }]
  },
  {
    id: 'paphos-theatre', name: 'Paphos Theatre', lat: 34.7585, lon: 32.4053,
    region: 'Nea Paphos, Cyprus', period: 'Ancient theatre; used from approximately the 3rd century BCE to the late 4th century CE',
    measuredFrequenciesHz: [125, 250, 500, 1000, 2000], status: 'published-measurement',
    summary: 'An in-situ study examined early decay time at multiple audience positions and frequency bands in the ancient theatre.',
    measurementContext: 'The study reports octave-band EDT values that vary by receiver position. The paper/review reports a 1.79 s average over 125–2000 Hz; this is a band average, not a resonance peak. The primary paper discusses position-by-position differences and limitations of averaging.',
    measurements: [{ parameter: 'EDT average (125–2000 Hz)', frequencyHz: 125, reportedValue: 1.79, unit: 's band average', method: 'In-situ acoustic survey; omnidirectional source, multiple receiver positions, ODEON analysis' }],
    caveat: '1.79 s is the reported average across a 125–2000 Hz band, not a measurement at exactly 125 Hz or a resonance at 1.79 Hz. It is not evidence of a 110 Hz resonance.',
    sources: [
      { label: 'Till (2019), Sound Archaeology: A Study of the Acoustics of Three World Heritage Sites', url: 'https://doi.org/10.3390/acoustics1030039', year: 2019, publication: 'Acoustics 1(3), 661–692' },
      { label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361' }
    ]
  },
  {
    id: 'acheiropoietos-basilica', name: 'Acheiropoietos Basilica', lat: 40.6355, lon: 22.9431,
    region: 'Thessaloniki, Greece', period: 'Early Byzantine basilica, 5th century CE',
    measuredFrequenciesHz: [500], status: 'published-measurement',
    summary: 'A published field-measurement summary reports reverberation time of 2.72 seconds in the 500 Hz band.',
    measurementContext: 'The 2023 literature review reports T60 = 2.72 s at 500 Hz. The summarized survey used an 8-second logarithmic sine sweep covering 20 Hz–24 kHz, repeated ten times per microphone location, with measurement microphones and a directional powered loudspeaker at multiple source/receiver positions.',
    measurements: [{ parameter: 'T60', frequencyHz: 500, reportedValue: 2.72, unit: 's', method: '8-second logarithmic sine sweep, 20 Hz–24 kHz, repeated 10 times per microphone location' }],
    caveat: 'T60 is reverberation time at the 500 Hz test band, not a natural resonance frequency generated by the building.',
    sources: [{ label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361; Table 2 measurement summary' }]
  },
  {
    id: 'hagia-sophia-thessaloniki', name: 'Hagia Sophia Cathedral', lat: 40.6328, lon: 22.9477,
    region: 'Thessaloniki, Greece', period: 'Early Byzantine church, broadly 7th century CE in its present form',
    measuredFrequenciesHz: [500], status: 'published-measurement',
    summary: 'A published field-measurement summary reports reverberation time of 2.86 seconds in the 500 Hz band for Hagia Sophia in Thessaloniki.',
    measurementContext: 'The 2023 literature review reports T60 = 2.86 s at 500 Hz. The summarized survey used an 8-second logarithmic sine sweep covering 20 Hz–24 kHz, repeated ten times per microphone location, with measurement microphones and a directional powered loudspeaker at multiple source/receiver positions. Measurements were scheduled at the same time of day to limit temperature and humidity variation.',
    measurements: [{ parameter: 'T60', frequencyHz: 500, reportedValue: 2.86, unit: 's', method: '8-second logarithmic sine sweep, 20 Hz–24 kHz, repeated 10 times per microphone location' }],
    caveat: 'This record refers to Hagia Sophia in Thessaloniki, Greece—not Istanbul. T60 is reverberation time at the 500 Hz test band, not a natural resonance frequency.',
    sources: [{ label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361; Table 2 measurement summary' }]
  }
];
