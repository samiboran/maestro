import { useState } from "react";
import { Rnd } from "react-rnd";

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 180;

const SNAP_POINTS = [
  { id: "left", x: 0, y: 35 },
  { id: "right", xPercent: null, xFromRight: true, y: 60 },
  { id: "bottom-center", x: 50, y: 70 },  // 100'den 70'e düşürdük
];

const SNAP_THRESHOLD = 80;

export default function DraggablePanel({
  id,
  color,
  label,
  children,
  initialX=20, initialY=80,
  zIndex = 10
}) {
const getPositionFromSnap = (snapId) => {
  const snap = SNAP_POINTS.find(s => s.id === snapId) || SNAP_POINTS[0];

  // Güvenli marj ekle (border, scrollbar için)
  const SAFE_MARGIN = 10;
  const maxX = window.innerWidth - PANEL_WIDTH - SAFE_MARGIN;
  const maxY = window.innerHeight - PANEL_HEIGHT - SAFE_MARGIN;

  let x = (window.innerWidth * snap.x) / 100;
  let y = (window.innerHeight * snap.y) / 100;

  // Edge handling with safe margin
  if (snap.xFromRight) {
  x = maxX;
} else if (snap.x === 0) {
  x = SAFE_MARGIN;
} else if (snap.x === 100) {
  x = maxX;
} else {
    x = x - PANEL_WIDTH / 2;
  }

  if (snap.y === 0) {
    y = SAFE_MARGIN;
  } else if (snap.y === 100) {
    y = maxY;
  } else {
    y = y - PANEL_HEIGHT / 2;
  }

  // Clamp to ensure always visible
  x = Math.max(SAFE_MARGIN, Math.min(x, maxX));
  y = Math.max(SAFE_MARGIN, Math.min(y, maxY));

  console.log(`Panel ${snapId}: x=${x}, y=${y}`); // Debug

  return { x: Math.round(x), y: Math.round(y) };
};

  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const [zIndexState, setZIndexState] = useState(zIndex);

  const bringToFront = () => {
    document.querySelectorAll('.draggable-panel').forEach(p => {
      p.style.zIndex = '10';
    });
    setZIndexState(100);
  };

  const getSnapPosition = (currentX, currentY, currentWidth, currentHeight) => {
    let newX = currentX;
    let newY = currentY;

    SNAP_POINTS.forEach(snap => {
      let snapX, snapY;

      // Edge snapping for X
      if (snap.x === 0) {
        snapX = 0;
      } else if (snap.x === 100 || snap.xFromRight) {
    snapX = window.innerWidth - currentWidth - 10;
} else {
        snapX = (window.innerWidth * snap.x / 100) - currentWidth / 2;
      }

      // Edge snapping for Y
      if (snap.y === 0) {
        snapY = 0;
      } else if (snap.y === 100) {
        snapY = window.innerHeight - currentHeight;
      } else {
        snapY = (window.innerHeight * snap.y / 100) - currentHeight / 2;
      }

      const dist = Math.hypot(currentX - snapX, currentY - snapY);
      if (dist < SNAP_THRESHOLD) {
        newX = snapX;
        newY = snapY;
      }
    });

    return { x: Math.round(newX), y: Math.round(newY) };
  };

  const handleDragStop = (e, d) => {
  setPosition({ x: d.x, y: d.y });
};

  return (
    <Rnd
      className="draggable-panel"
      style={{
        '--c': color,
        zIndex: zIndexState,
      }}
      size={size}
      position={position}
      onDragStart={bringToFront}
      onDragStop={handleDragStop}
      onResizeStop={(e, direction, ref, delta, pos) => {
        setSize({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height)
        });
        setPosition(pos);
      }}
      minWidth={200}
      minHeight={120}
      bounds={false}
      dragHandleClassName="panel-header"
    >
      <div className="panel-header">
        <div className="drag-handle">⋮⋮</div>
        <div className="model-tag">{label}</div>
      </div>
      <div className="panel-content">
        {children}
      </div>
    </Rnd>
  );
}