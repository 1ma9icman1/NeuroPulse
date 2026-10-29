import React from 'react';
import { CesiumCopernicusPreview } from './CesiumCopernicusPreview';

type Site = { id?: string; name: string; lat: number; lon: number; category?: string; color?: string; desc?: string } | null;
type CatalogueSite = { id?: string; name: string; lat: number; lon: number; category?: string; color?: string; desc?: string };
type Props = {
  selectedSite: Site;
  siteCatalogue: CatalogueSite[];
  onBack: () => void;
  onAssignChannel?: (channel: 'a' | 'b' | 'c', latitude: number, longitude: number) => void;
  onSelectSite?: (site: CatalogueSite) => void;
};

/**
 * The Water / Dirt Elevation world now uses the embedded Cesium globe directly.
 * The local GLO-90 GeoTIFF and adjustable soil/sand scenario are part of this
 * view; there is no separate "CESIUM DEM DETAIL" modal to open.
 */
export const EarthElevation: React.FC<Props> = ({
  selectedSite,
  siteCatalogue,
  onBack,
  onSelectSite,
}) => (
  <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-sky-500/30 bg-[#030814]">
    <CesiumCopernicusPreview
      open={true}
      onClose={onBack}
      selectedSite={selectedSite}
      siteCatalogue={siteCatalogue}
      onSelectSite={onSelectSite}
    />
  </div>
);

export default EarthElevation;
