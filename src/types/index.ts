export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';

export type SpatialRoutingMode = 'trinaural-isolated' | '3d-hrtf';

export type CameraView = 'perspective' | 'top' | 'front';

export type ChannelId = 'a' | 'b' | 'c';

export interface SpatialPosition {
  x: number; // -10 to +10 (left/right meters)
  y: number; // -10 to +10 (elevation/height meters)
  z: number; // -10 to +10 (depth/front-back meters)
}

export interface SolfeggioTone {
  freq: number;
  name: string;
  desc: string;
  category: string;
}

export interface BrainwaveBand {
  id: string;
  name: string;
  min: number;
  max: number;
  defaultDelta: number;
  desc: string;
  details: string;
  color: string;
}

export interface TrinauralConfig {
  // Channel A (Left / Cyan)
  aFreq: number;
  aFineTune: number;
  aWaveform: WaveformType;
  aGain: number;
  aMuted: boolean;
  aPos: SpatialPosition;

  // Channel B (Right / Pink)
  bFreq: number;
  bFineTune: number;
  bWaveform: WaveformType;
  bGain: number;
  bMuted: boolean;
  bPos: SpatialPosition;

  // Channel C (Spatial / Amber)
  cFreq: number;
  cFineTune: number;
  cWaveform: WaveformType;
  cGain: number;
  cMuted: boolean;
  cPos: SpatialPosition;

  // Linking & Delta Mode
  isDeltaLocked: boolean; // When locked, offsets between A, B, and C remain constant
  lockedDeltaAB: number;  // Delta between B and A
  lockedDeltaBC: number;  // Delta between C and B

  // Master & 3D Spatial
  masterVolume: number;
  spatialMode: SpatialRoutingMode;
  cameraView: CameraView;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
}

export interface Preset {
  id: string;
  name: string;
  aFreq: number;
  bFreq: number;
  cFreq: number;
  aWaveform: WaveformType;
  bWaveform: WaveformType;
  cWaveform: WaveformType;
  description: string;
}

export interface CelestialStar {
  id: string;
  name: string;
  bayer: string;
  constellation: string;
  raHours: number; // decimal hours (0 - 24)
  raDeg: number;   // degrees (0 - 360)
  decDeg: number;  // degrees (-90 to +90)
  mag: number;     // apparent visual magnitude
  distLy: number;  // light years
  color: string;   // spectral display color
  x: number;       // mapped to spatial cube (-8 to +8)
  y: number;       // elevation
  z: number;       // depth
}

export interface StarAlignmentPreset {
  id: string;
  name: string;
  description: string;
  relation711Desc: string;
  starAId: string;
  starBId: string;
  starCId: string;
  ratio711Match: number; // percentage match
}

export interface TopPlaneOverlay {
  imageUrl: string | null;
  imageName: string | null;
  opacity: number;
  scale: number;
  visible: boolean;
}

export interface TriangleInteriorAngles {
  angleA: number; // Interior angle at vertex A in degrees
  angleB: number; // Interior angle at vertex B in degrees
  angleC: number; // Interior angle at vertex C in degrees
  sumAngles: number; // mathematically 180°
  sideAB: number; // distance in 3D meters
  sideBC: number; // distance in 3D meters
  sideCA: number; // distance in 3D meters
  perimeter: number;
  area: number; // 3D triangle area in m²
  has711AngleMatch: boolean;
  closestAngleTo711: {
    vertex: 'A' | 'B' | 'C';
    angle: number;
    diff: number;
    matchPct: number;
  };
}

export interface EarthPoint {
  id: string;
  name: string;
  lat: number; // latitude in degrees (-90 to +90)
  lon: number; // longitude in degrees (-180 to +180)
  elevation?: number; // relative elevation
  color: string;
  category?: 'ancient' | 'astronomy' | 'acoustic' | 'custom';
  desc?: string;
}

export interface EarthConfig {
  showEarth: boolean;
  earthRadius: number; // radius scale in 3D units (default ~2.2)
  rotationDeg: number; // current diurnal rotation angle
  isRotating: boolean;
  rotationSpeed: number; // deg per frame
  showGrid: boolean; // lat/lon grid lines
  showAtmosphere: boolean; // glowing atmospheric rim
  showCoastlines: boolean; // continent vector outlines
  arGlassesMode: boolean; // Stereoscopic split view for VR/AR glasses
  arIpd: number; // Inter-pupillary distance factor
}

