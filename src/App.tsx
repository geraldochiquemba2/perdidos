import { useState, useRef, useEffect, useCallback } from 'react'

interface Element {
  id: number
  x: number
  y: number
  width: number
  height: number
  color: string
  label: string
  type: 'rect' | 'circle' | 'text'
  fontSize?: number
  animation?: string
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
]

const SHAPES: Element['type'][] = ['rect', 'circle', 'text']

function App() {
  const [elements, setElements] = useState<Element[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [animationEnabled, setAnimationEnabled] = useState(true)
  const canvasRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  const addElement = useCallback(() => {
    const type = SHAPES[Math.floor(Math.random() * SHAPES.length)]
    const newEl: Element = {
      id: nextId.current++,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      width: type === 'text' ? 150 : Math.random() * 100 + 80,
      height: type === 'text' ? 40 : Math.random() * 80 + 60,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      label: type === 'text' ? 'Label' : `#${nextId.current - 1}`,
      type,
      fontSize: type === 'text' ? 24 : 14,
      animation: animationEnabled ? ['float', 'pulse', 'rotate'][Math.floor(Math.random() * 3)] : undefined,
    }
    setElements(prev => [...prev, newEl])
  }, [animationEnabled])

  const handleMouseDown = (e: React.MouseEvent, id?: number) => {
    if (id !== undefined) {
      e.stopPropagation()
      setSelectedId(id)
      const el = elements.find(el => el.id === id)
      if (el) {
        setIsDragging(true)
        setDragOffset({
          x: e.clientX / zoom - pan.x - el.x,
          y: e.clientY / zoom - pan.y - el.y,
        })
      }
    } else {
      setSelectedId(null)
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && selectedId !== null) {
      const newX = e.clientX / zoom - pan.x - dragOffset.x
      const newY = e.clientY / zoom - pan.y - dragOffset.y
      setElements(prev =>
        prev.map(el => el.id === selectedId ? { ...el, x: newX, y: newY } : el)
      )
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }, [isDragging, selectedId, isPanning, panStart, zoom, pan, dragOffset])

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.min(Math.max(prev * delta, 0.2), 3))
  }

  const deleteSelected = () => {
    if (selectedId !== null) {
      setElements(prev => prev.filter(el => el.id !== selectedId))
      setSelectedId(null)
    }
  }

  const getAnimationStyle = (animation?: string) => {
    if (!animation || !animationEnabled) return {}
    const animations: Record<string, React.CSSProperties> = {
      float: { animation: 'float 3s ease-in-out infinite' },
      pulse: { animation: 'pulse 2s ease-in-out infinite' },
      rotate: { animation: 'rotate 4s linear infinite' },
    }
    return animations[animation] || {}
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Toolbar */}
      <div style={{
        padding: '12px 20px',
        background: '#16213e',
        borderBottom: '1px solid #0f3460',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        zIndex: 10,
      }}>
        <button onClick={addElement} style={{
          padding: '8px 16px',
          background: '#0f3460',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
        }}>
          + Add Element
        </button>
        <button onClick={() => setElements([])} style={{
          padding: '8px 16px',
          background: '#e74c3c',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
        }}>
          Clear All
        </button>
        <button onClick={deleteSelected} disabled={selectedId === null} style={{
          padding: '8px 16px',
          background: selectedId !== null ? '#e67e22' : '#555',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: selectedId !== null ? 'pointer' : 'not-allowed',
          fontWeight: 600,
        }}>
          Delete Selected
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={animationEnabled}
            onChange={(e) => setAnimationEnabled(e.target.checked)}
            style={{ accentColor: '#4ECDC4' }}
          />
          Animations
        </label>
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#aaa' }}>
          Zoom: {Math.round(zoom * 100)}% | Elements: {elements.length} | Scroll to zoom | Drag canvas to pan
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          flex: 1,
          overflow: 'hidden',
          background: '#1a1a2e',
          backgroundImage: 'radial-gradient(circle, #2a2a4a 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          cursor: isPanning ? 'grabbing' : 'grab',
          position: 'relative',
        }}
      >
        <div style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
        }}>
          {elements.map(el => (
            <div
              key={el.id}
              onMouseDown={(e) => handleMouseDown(e, el.id)}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                background: el.type === 'circle' ? 'transparent' : el.color,
                border: el.type === 'circle' ? `3px solid ${el.color}` : selectedId === el.id ? '3px solid #fff' : '2px solid transparent',
                borderRadius: el.type === 'circle' ? '50%' : '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'move',
                userSelect: 'none',
                transition: isDragging ? 'none' : 'box-shadow 0.2s',
                boxShadow: selectedId === el.id ? '0 0 20px rgba(78, 205, 196, 0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
                ...getAnimationStyle(el.animation),
              }}
            >
              <span style={{
                color: el.type === 'circle' ? el.color : '#fff',
                fontWeight: 600,
                fontSize: el.fontSize || 14,
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                {el.label}
              </span>
              {selectedId === el.id && (
                <div style={{
                  position: 'absolute',
                  top: -24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#4ECDC4',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}>
                  {el.type.toUpperCase()} | {el.animation || 'none'}
                </div>
              )}
            </div>
          ))}
        </div>

        {elements.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#555',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>Click "Add Element" to start</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              Drag to move | Scroll to zoom | Press Delete to remove
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
