import React, { useRef, useState, useEffect, useCallback } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: number;
  color?: string;
  decimals?: number;
  onChange: (val: number) => void;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  size = 64,
  color = '#00f0ff',
  decimals = 2,
  onChange,
}) => {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const dragStartY = useRef(0);
  const dragStartVal = useRef(value);

  // Normalized value 0..1
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Angle range: -135deg to +135deg (total 270 degrees)
  const angle = -135 + norm * 270;

  // Arc path math
  const strokeWidth = size * 0.08;
  const radius = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, arcSweep, 0, end.x, end.y].join(' ');
  };

  const bgArc = describeArc(cx, cy, radius, -135, 135);
  const valArc = describeArc(cx, cy, radius, -135, -135 + Math.max(1, norm * 270));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      const deltaY = dragStartY.current - e.clientY;
      const speed = e.shiftKey ? 0.0005 : 0.003;
      const range = max - min;
      let nextVal = dragStartVal.current + deltaY * speed * range;

      // Snap to step
      if (step > 0) {
        nextVal = Math.round(nextVal / step) * step;
      }

      nextVal = Math.max(min, Math.min(max, nextVal));
      onChange(Number(nextVal.toFixed(decimals)));
    },
    [isDragging, max, min, step, decimals, onChange]
  );

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleInputSubmit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(Number(clamped.toFixed(decimals)));
    }
    setIsEditing(false);
  };

  useEffect(() => {
    setInputValue(value.toFixed(decimals));
  }, [value, decimals]);

  return (
    <div className="flex flex-col items-center select-none group">
      {/* Knob Dial */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => setIsEditing(true)}
        className="relative cursor-ns-resize touch-none"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Track */}
          <path
            d={bgArc}
            fill="none"
            stroke="#1f293d"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Arc */}
          <path
            d={valArc}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        </svg>

        {/* Center Cap with Rotary Pointer */}
        <div
          className="absolute rounded-full border border-slate-700 bg-gradient-to-b from-[#182234] to-[#0c1320] shadow-md flex items-center justify-center"
          style={{
            width: size * 0.68,
            height: size * 0.68,
            top: size * 0.16,
            left: size * 0.16,
          }}
        >
          {/* Rotating Notch Indicator */}
          <div
            className="w-full h-full absolute flex justify-center items-start pt-1 transition-transform"
            style={{
              transform: `rotate(${angle}deg)`,
            }}
          >
            <div
              className="w-1 rounded-full shadow-sm"
              style={{
                height: size * 0.16,
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
          </div>

          {/* Subtle center screw dimple */}
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
        </div>
      </div>

      {/* Label and Value Input / Readout */}
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1">
        {label}
      </span>

      {isEditing ? (
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputSubmit}
          onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
          className="w-16 px-1 text-center bg-slate-900 border border-cyan-400 text-xs font-mono text-white rounded outline-none"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className="text-xs font-mono font-bold tabular-nums cursor-text hover:text-white transition-colors"
          style={{ color }}
          title="Double-click to type exact value"
        >
          {value.toFixed(decimals)}
          <span className="text-[10px] text-slate-400 ml-0.5 font-normal">{unit}</span>
        </span>
      )}
    </div>
  );
};
