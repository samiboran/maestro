import { useState } from "react";
import { Rnd } from "react-rnd";

export default function DraggablePanel({
  id,
  color,
  label,
  children,
  initialX = 20,
  initialY = 80,
  initialWidth = 380,
  initialHeight = 350,
  zIndex = 10
}) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [zIndexState, setZIndexState] = useState(zIndex);

  const bringToFront = () => {
    document.querySelectorAll('.draggable-panel').forEach(p => {
      p.style.zIndex = '10';
    });
    setZIndexState(100);
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
      onDragStop={(e, d) => setPosition({ x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, pos) => {
        setSize({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height)
        });
        setPosition(pos);
      }}
      minWidth={250}
      minHeight={150}
      bounds="window"
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