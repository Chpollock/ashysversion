// Hidden dev calibration tool — open with ?calibrate. WYSIWYG over the real
// room render: drag each cat to set x/y, slider for scale, toggle anchor & z,
// cycle the pose, and step through room states (from rug-down onward). Save
// persists an override to localStorage (live in normal play); Export copies a
// copy-pasteable petSpots patch. Off in normal play; zero impact on Ashton.

import { useState } from 'react';
import { PETS, poseImage, CALIB_KEY } from '../game/petSpots.js';
import { roomImageForState, PROJECTS } from '../game/roomStates.js';

const CALIB_PETS = ['boombox', 'remy'];
const RUG_DOWN = 7; // rug complete — calibrate from here onward

// Deep-ish copy of the calibratable fields for every spot
function seedEdits() {
  const e = {};
  for (const petId of CALIB_PETS) {
    e[petId] = {};
    for (const s of PETS[petId].spots) {
      e[petId][s.id] = {
        position: { ...s.position }, scale: s.scale, anchor: s.anchor ?? 'feet_center',
        zOrder: s.zOrder ?? 6, poses: s.poses, minRoomState: s.minRoomState ?? 0, label: s.label,
      };
    }
  }
  return e;
}

export default function CalibrateOverlay({ onClose }) {
  const [edits, setEdits] = useState(seedEdits);
  const [cs, setCs] = useState(Math.max(RUG_DOWN, PROJECTS.length)); // preview state
  const [sel, setSel] = useState({ petId: 'boombox', spotId: 'sunbeam' });
  const [poseIdx, setPoseIdx] = useState({}); // { 'pet|spot': index }
  const [exported, setExported] = useState(null);
  const [dragging, setDragging] = useState(null); // { petId, spotId } | null

  const cur = edits[sel.petId]?.[sel.spotId];

  function patch(field, value) {
    setEdits(e => ({ ...e, [sel.petId]: { ...e[sel.petId], [sel.spotId]: { ...e[sel.petId][sel.spotId], [field]: value } } }));
  }

  function pct(e) {
    const r = e.currentTarget.offsetParent?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }
  function onDown(e, petId, spotId) {
    setSel({ petId, spotId });
    setDragging({ petId, spotId });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (!dragging) return;
    const p = pct(e);
    if (!p) return;
    const { petId, spotId } = dragging;
    setEdits(prev => ({ ...prev, [petId]: { ...prev[petId], [spotId]: { ...prev[petId][spotId], position: { x: +p.x.toFixed(1), y: +p.y.toFixed(1) } } } }));
  }
  function onUp() { setDragging(null); }

  function buildOverride() {
    const out = {};
    for (const petId of CALIB_PETS) {
      out[petId] = {};
      for (const sid of Object.keys(edits[petId])) {
        const s = edits[petId][sid];
        out[petId][sid] = { position: s.position, scale: s.scale, anchor: s.anchor, zOrder: s.zOrder };
      }
    }
    return out;
  }
  function save() {
    try { localStorage.setItem(CALIB_KEY, JSON.stringify(buildOverride())); } catch { /* ignore */ }
    setExported('saved');
    setTimeout(() => setExported(null), 1500);
  }
  function exportConfig() {
    const text = JSON.stringify(buildOverride(), null, 2);
    navigator.clipboard?.writeText(text).catch(() => {});
    console.log('[pet-calib] override:\n' + text);
    setExported(text);
  }
  function clearOverride() {
    try { localStorage.removeItem(CALIB_KEY); } catch { /* ignore */ }
    setEdits(seedEdits());
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1a1410', overflow: 'hidden', fontFamily: 'Georgia, serif' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src={roomImageForState(cs)} alt="" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />

        {CALIB_PETS.map(petId => edits[petId] && Object.entries(edits[petId]).map(([spotId, s]) => {
          if ((s.minRoomState ?? 0) > cs) return null;
          const selected = sel.petId === petId && sel.spotId === spotId;
          const poses = s.poses?.length ? s.poses : ['curl_sleep'];
          const pi = poseIdx[`${petId}|${spotId}`] ?? 0;
          const img = poseImage(petId, poses[pi % poses.length]);
          const ty = s.anchor === 'feet_center' ? '-100%' : '-50%';
          return (
            <div key={`${petId}-${spotId}`}
              onPointerDown={e => onDown(e, petId, spotId)} onPointerMove={onMove} onPointerUp={onUp}
              style={{
                position: 'absolute', left: `${s.position.x}%`, top: `${s.position.y}%`,
                width: `${s.scale}%`, transform: `translate(-50%, ${ty})`, zIndex: s.zOrder ?? 6,
                cursor: 'grab', touchAction: 'none',
                outline: selected ? '2px dashed #ffd24a' : 'none', opacity: selected ? 1 : 0.7,
              }}>
              {img
                ? <img src={img} alt="" draggable={false} style={{ width: '100%', height: 'auto', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '1', background: '#caa46a', borderRadius: '50%' }} />}
              <div style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#ffd24a', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 4 }}>{spotId}</div>
            </div>
          );
        }))}
      </div>

      {/* Control panel */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(20,15,10,0.92)', color: '#ffe', padding: '10px 12px calc(12px + env(safe-area-inset-bottom))', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>CALIBRATE</strong>
          <select value={sel.petId} onChange={e => setSel({ petId: e.target.value, spotId: PETS[e.target.value].spots[0].id })}>
            {CALIB_PETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={sel.spotId} onChange={e => setSel(s => ({ ...s, spotId: e.target.value }))}>
            {PETS[sel.petId].spots.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
          </select>
          <button onClick={() => setCs(c => Math.max(RUG_DOWN, c - 1))}>state −</button>
          <span>state {cs}/{PROJECTS.length}</span>
          <button onClick={() => setCs(c => Math.min(PROJECTS.length, c + 1))}>state +</button>
        </div>
        {cur && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>scale {cur.scale}
              <input type="range" min="8" max="70" step="1" value={cur.scale} onChange={e => patch('scale', +e.target.value)} style={{ verticalAlign: 'middle' }} />
            </label>
            <button onClick={() => patch('anchor', cur.anchor === 'feet_center' ? 'body_center' : 'feet_center')}>anchor: {cur.anchor}</button>
            <button onClick={() => patch('zOrder', cur.zOrder - 1)}>z−</button>
            <span>z {cur.zOrder}</span>
            <button onClick={() => patch('zOrder', cur.zOrder + 1)}>z+</button>
            <button onClick={() => setPoseIdx(p => ({ ...p, [`${sel.petId}|${sel.spotId}`]: (p[`${sel.petId}|${sel.spotId}`] ?? 0) + 1 }))}>pose ↻</button>
            <span style={{ opacity: 0.7 }}>x {cur.position.x} y {cur.position.y}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={save}>💾 Save (live)</button>
          <button onClick={exportConfig}>⧉ Export</button>
          <button onClick={clearOverride}>reset</button>
          <button onClick={onClose} style={{ marginLeft: 'auto' }}>✕ close</button>
          {exported === 'saved' && <span style={{ color: '#9f9' }}>saved ✓</span>}
        </div>
        {exported && exported !== 'saved' && (
          <textarea readOnly value={exported} onFocus={e => e.target.select()} style={{ width: '100%', height: 60, fontSize: 10, fontFamily: 'monospace' }} />
        )}
      </div>
    </div>
  );
}
