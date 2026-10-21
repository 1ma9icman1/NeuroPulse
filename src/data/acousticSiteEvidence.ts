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
  measurements?: { parameter: string; frequencyHz?: number; frequencyBand?: string; reportedValue: number; unit: string; method: string }[];
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
    measurements: [{ parameter: 'EDT average', frequencyBand: '125–2000 Hz average', reportedValue: 1.79, unit: 's', method: 'In-situ acoustic survey; omnidirectional source, multiple receiver positions, ODEON analysis' }],
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
    sources: [
      { label: 'Gerstel et al. (2018), Soundscapes of Byzantium: The Acheiropoietos Basilica and the Cathedral of Hagia Sophia in Thessaloniki', url: 'https://ascsa.edu.gr/publications/hesperia/article/87/1/177-213', year: 2018, publication: 'Hesperia 87(1), 177–213; primary field measurement study' },
      { label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361; cross-check of reported T60 values' }
    ]
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

  {
    id: 'newgrange-chamber-resonance', name: 'Newgrange Passage Tomb — central chamber', lat: 53.6947, lon: -6.4756,
    region: 'County Meath, Ireland', period: 'Neolithic passage tomb, c. 3200 BCE',
    measuredFrequenciesHz: [110], researchBandHz: 110, status: 'published-measurement',
    summary: 'A 1996 archaeoacoustic study reported a primary chamber resonance at approximately 110 Hz at Newgrange.',
    measurementContext: 'Reported chamber resonance: approximately 110 Hz. This is a site-specific acoustic report, not evidence of a universal or astronomical 110 Hz signal.',
    measurements: [{ parameter: 'Primary chamber resonance', frequencyHz: 110, reportedValue: 110, unit: 'Hz', method: 'Acoustic resonance measurements of chambered prehistoric monuments; value reported approximately in the published literature' }],
    caveat: 'Approximate reported value. Re-measurement under documented conditions would be needed to assess uncertainty and reproducibility.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Resonance in ancient structures', url: 'https://doi.org/10.1121/1.415990', year: 1996, publication: 'Journal of the Acoustical Society of America 99, 649–658' },
      { label: 'Cook, Pajot & Leuchter (2008), Ancient Architectural Acoustic Resonance Patterns and Regional Brain Activity', url: 'https://doi.org/10.2752/175169608783489099', year: 2008, publication: 'Time and Mind 1(1), 95–104' }]
  },
  {
    id: 'stonehenge-chamber-acoustics', name: 'Stonehenge — acoustic model / resonance study', lat: 51.1789, lon: -1.8262,
    region: 'Wiltshire, England', period: 'Late Neolithic to Bronze Age monument',
    measuredFrequenciesHz: [114], status: 'published-measurement',
    summary: 'An exploratory acoustic modelling source reports an approximately 114 Hz relationship for Stonehenge; this is not a direct field measurement of an enclosed chamber.',
    measurementContext: 'The cited project compares predicted cavity dimensions with archaeological measurements and lists Stonehenge at approximately 114 Hz. This is model-based/exploratory evidence, not the same evidence class as a measured enclosed chamber resonance.',
    measurements: [{ parameter: 'Modelled acoustic frequency', frequencyHz: 114, reportedValue: 114, unit: 'Hz', method: 'Exploratory acoustic model compared against monument dimensions; not a controlled in-situ resonance measurement' }],
    caveat: 'Not a direct, controlled resonance measurement; avoid treating the approximate frequency as proof of intended tuning.',
    sources: [{ label: 'The Song of the Stone — ALBA Project', url: 'https://alba-project.org/song-of-the-stone/', year: 2026, publication: 'Exploratory acoustic model and site-dimension comparison' }]
  },
  {
    id: 'el-castillo-cave-amplification', name: 'El Castillo Cave — 108–110 Hz amplification band', lat: 43.2967, lon: -3.9994,
    region: 'Cantabria, Spain', period: 'Palaeolithic cave with evidence of prehistoric activity',
    measuredFrequenciesHz: [108, 110], researchBandHz: 110, status: 'published-measurement',
    summary: 'An archaeoacoustic study reported frequency-dependent amplification near 100 Hz, with the greatest effect at 108 and 110 Hz in a tested cave setup.',
    measurementContext: 'The study used simulated tones emitted at a proposed ritual location and recorded them at a likely audience position. The result is frequency-dependent sound amplification in the tested setup, not proof of a single intrinsic cave resonance or ancient tuning intent.',
    measurements: [{ parameter: 'Amplification test frequency', frequencyHz: 108, reportedValue: 108, unit: 'Hz', method: 'Simulated-tone playback and recorded sound-intensity comparison' }, { parameter: 'Amplification test frequency', frequencyHz: 110, reportedValue: 110, unit: 'Hz', method: 'Simulated-tone playback and recorded sound-intensity comparison' }],
    caveat: 'Setup-specific amplification, not proof that the cave produces a fixed 110 Hz resonance. Repeat measurements and geometry controls matter.',
    sources: [{ label: 'Gaona et al. (2014), Archaeoacoustic Investigation of a Prehistoric Cave Site: Frequency-Dependent Sound Amplification and Potential Relevance for Neurotheology', url: 'https://doi.org/10.14704/nq.2014.12.4.772', year: 2014, publication: 'NeuroQuantology 12(4)' }]
  },
];
