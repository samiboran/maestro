import { useState, useRef, useEffect } from "react";

// Snap noktaları (viewport yüzdesi olarak merkez noktaları)
const SNAP_POINTS = [
  { id: "left", x: 15, y: 35 },
  { id: "right", x: 85, y: 35 },
  { id: "bottom-center", x: 50, y: 85 },
];

const SNAP_THRESHOLD = 150;

export default function DraggablePanel({ 
  id, 
  color, 
  label, 
  children, 
  initialSnap = "left",
  zIndex = 10 
}) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Snap noktasından pozisyon hesapla (merkez noktası olarak)
  function getPositionFromSnap(snapId) {
    const snap = SNAP_POINTS.find(s => s.id === snapId) || SNAP_POINTS[0];
    return {
      x: window.innerWidth * snap.x / 100,
      y: window.innerHeight * snap.y / 100
    };
  }

  // İlk pozisyonu ayarla
  useEffect(() => {
    setPosition(getPositionFromSnap(initialSnap));
  }, [initialSnap]);

  // Resize'da pozisyonu güncelle
  useEffect(() => {
    function handleResize() {
      setPosition(getPositionFromSnap(currentSnap));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentSnap]);

  function handleMouseDown(e) {
    if (e.target.closest('.panel-content')) return;
    setIsDragging(true);
    
    // Tıklanan nokta ile panel merkezi arasındaki fark
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    setPosition({ x, y });
  }

  function handleMouseUp() {
    if (!isDragging) return;
    setIsDragging(false);
    
    // En yakın snap noktasını bul
    let closest = null;
    let minDist = Infinity;
    
    SNAP_POINTS.forEach(snap => {
      const snapX = window.innerWidth * snap.x / 100;
      const snapY = window.innerHeight * snap.y / 100;
      const dist = Math.hypot(position.x - snapX, position.y - snapY);
      if (dist < minDist) {
        minDist = dist;
        closest = snap;
      }
    });
    
    if (closest && minDist < SNAP_THRESHOLD) {
      setPosition(getPositionFromSnap(closest.id));
      setCurrentSnap(closest.id);
    }
  }

  function handleTouchStart(e) {
    const touch = e.touches[0];
    setIsDragging(true);
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const x = touch.clientX - dragOffset.current.x;
    const y = touch.clientY - dragOffset.current.y;
    setPosition({ x, y });
  }

  function handleTouchEnd() {
    handleMouseUp();
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, position]);

  if (!position) return null;

  return (
    <div
      ref={panelRef}
      className={`draggable-panel ${isDragging ? 'dragging' : ''}`}
      style={{
        '--c': color,
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: isDragging ? 100 : zIndex,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="panel-header">
        <div className="drag-handle">⋮⋮</div>
        <div className="model-tag">{label}</div>
      </div>
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}