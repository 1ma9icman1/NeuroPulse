import React from 'react';
import { AudioCubeSpace } from './components/AudioCubeSpace';
import type { CameraView, SpatialPosition, SpatialRoutingMode } from './types';

const CENTER: SpatialPosition = { x: 0, y: 0, z: 0 };

export default function App() {
  const noopPosition = (_position: SpatialPosition) => {};
  const noopView = (_view: CameraView) => {};
  const noopMode = (_mode: SpatialRoutingMode) => {};
  const noopAngles = (_yaw: number, _pitch: number) => {};
  const noopZoom = (_zoom: number) => {};

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#02040a]">
      <AudioCubeSpace
        aPos={CENTER}
        bPos={CENTER}
        cPos={CENTER}
        spatialMode="trinaural-isolated"
        cameraView="top"
        cameraYaw={0}
        cameraPitch={0}
        cameraZoom={1}
        aFreq={0}
        bFreq={0}
        cFreq={0}
        isRunning={false}
        onUpdateAPos={noopPosition}
        onUpdateBPos={noopPosition}
        onUpdateCPos={noopPosition}
        onUpdateSpatialMode={noopMode}
        onUpdateCameraView={noopView}
        onUpdateCameraAngles={noopAngles}
        onUpdateCameraZoom={noopZoom}
        onResetCamera={() => {}}
      />
    </main>
  );
}
