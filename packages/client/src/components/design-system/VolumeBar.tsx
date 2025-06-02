import { useRef, useEffect, useState } from 'react';
import { Button } from './Button';
import { FaVolumeUp, FaVolumeDown } from 'react-icons/fa';

export interface VolumeBarProps {
  volume: number;
  isMuted: boolean;
  onVolumeDown: () => void;
  onVolumeUp: () => void;
  disabled?: boolean;
  onVolumeChange?: (volume: number) => void;
  title?: string;
  className?: string;
}

export function VolumeBar({
  volume,
  isMuted,
  onVolumeDown,
  onVolumeUp,
  disabled = false,
  onVolumeChange,
  title = "Volume Control",
  className = ""
}: VolumeBarProps) {
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastTimeRef = useRef(0);

  // Dynamically compute how many bars fit the container width
  const [barCount, setBarCount] = useState(20);
  
  useEffect(() => {
    if (!volumeBarRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const gap = 2; // px (smaller gap)
        const barWidth = 6; // px (slightly narrower bars)
        const count = Math.max(1, Math.floor((width + gap) / (barWidth + gap)));
        setBarCount(count);
      }
    });
    obs.observe(volumeBarRef.current);
    return () => obs.disconnect();
  }, [volumeBarRef]);

  // Setup drag-to-adjust volume (if onVolumeChange is provided)
  useEffect(() => {
    if (!onVolumeChange) return;
    
    const onPointerUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
    return () => {
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [onVolumeChange]);

  const updateVolumeFromPointer = (clientX: number) => {
    if (!onVolumeChange) return;
    
    const rect = volumeBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    let percent = ((clientX - rect.left) / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));
    const vol = Math.round(percent);
    
    // Throttle backend calls to ~1 per 100ms
    const now = Date.now();
    if (now - lastTimeRef.current >= 100) {
      lastTimeRef.current = now;
      onVolumeChange(vol);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    if (onVolumeChange) {
      isDragging.current = true;
      updateVolumeFromPointer(e.clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!onVolumeChange || !isDragging.current) return;
    updateVolumeFromPointer(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    if (onVolumeChange) {
      isDragging.current = true;
      updateVolumeFromPointer(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!onVolumeChange || !isDragging.current) return;
    updateVolumeFromPointer(e.touches[0].clientX);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || isDragging.current) return;
    if (onVolumeChange) {
      updateVolumeFromPointer(e.clientX);
    }
  };

  return (
    <div className={`mb-6 w-full ${className}`}>
      <div className="text-white mb-3 font-medium text-center">{title}</div>
      
      <div className="text-center text-white text-lg font-bold mb-3">
        {volume}{isMuted ? ' (Muted)' : ''}
      </div>
      
      <div className="flex items-end justify-between gap-4 w-full">
        <Button 
          className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center flex-shrink-0"
          onClick={onVolumeDown}
          disabled={disabled}
          title="Volume Down"
        >
          <FaVolumeDown className="text-xl" />
        </Button>
        
        <div
          ref={volumeBarRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onClick={handleClick}
          style={{ 
            cursor: onVolumeChange ? 'ew-resize' : 'default', 
            flex: '1 1 0' 
          }}
          className="flex items-end justify-between h-10 px-1"
        >
          {Array.from({ length: barCount }, (_, i) => {
            const step = 100 / barCount;
            const barLevel = (i + 1) * step;
            const isActive = volume >= barLevel;
            const barHeight = `${10 + (i * 1.5)}px`;

            return (
              <div
                key={i}
                className="transition-all duration-200"
                style={{
                  height: barHeight,
                  width: '6px',
                  backgroundColor: isActive 
                    ? (isMuted ? '#BB8274' : '#6A869C')
                    : '#4F4F4F',
                  opacity: isActive ? (isMuted ? 0.7 : 1) : 0.3,
                  borderRadius: '2px',
                  boxShadow: isActive && !isMuted ? '0 0 4px rgba(106, 134, 156, 0.4)' : 'none'
                }}
              />
            );
          })}
        </div>
        
        <Button 
          className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center flex-shrink-0"
          onClick={onVolumeUp}
          disabled={disabled}
          title="Volume Up"
        >
          <FaVolumeUp className="text-xl" />
        </Button>
      </div>
    </div>
  );
}