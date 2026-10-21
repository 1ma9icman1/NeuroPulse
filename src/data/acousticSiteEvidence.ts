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
  researchBandHz: number;
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
  }
];
