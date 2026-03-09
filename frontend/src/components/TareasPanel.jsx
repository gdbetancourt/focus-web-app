import { useState, useEffect } from 'react';

const ROLES_EQUIPO = [
  { id: 'F1-13', nombre: 'Rafael' },
  { id: 'F1-14', nombre: 'Daniela' },
  { id: 'ROL-17', nombre: 'Santiago' },
  { id: 'ROL-16', nombre: 'Luna' },
  { id: 'ROL-00', nombre: 'Carlos' },
  { id: 'YT-11', nombre: 'Marco' },
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function TareasPanel() {
  const [bandejas, setBandejas] = useState({});
  const [misTareas, setMisTareas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [misTareasOpen, setMisTareasOpen] = useState(true);

  const fetchAll = async () => {
    // Bandeja DIR-00
    try {
      const res = await fetch(`${BACKEND_URL}/api/bandejas/DIR-00`, { credentials: 'include', cache: 'no-store', headers: { 'X-Rol-Id': 'DIR-00' } });
      const data = await res.json();
      setMisTareas((data.items || []).filter(i => i.estado === 'PENDIENTE'));
    } catch { setMisTareas([]); }

    // Bandejas equipo
    const results = {};
    await Promise.all(ROLES_EQUIPO.map(async (rol) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/bandejas/${rol.id}`, { credentials: 'include', cache: 'no-store', headers: { 'X-Rol-Id': rol.id } });
        const data = await res.json();
        results[rol.id] = (data.items || []).filter(i => i.estado === 'PENDIENTE');
      } catch { results[rol.id] = []; }
    }));
    setBandejas(results);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const pill = (label, count, active, onClick) => (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', border: 'none',
      background: active ? '#3b82f6' : count > 0 ? '#1e3a5f' : '#374151',
      color: active ? '#fff' : count > 0 ? '#93c5fd' : '#9ca3af',
      fontWeight: count > 0 ? 600 : 400
    }}>{label}{count > 0 && ` (${count})`}</button>
  );

  const itemList = (items) => items.length === 0
    ? <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Sin items pendientes</p>
    : items.map(item => (
      <div key={item.id} style={{ marginBottom: '8px', cursor: 'pointer', borderBottom: '1px solid #1f2937', paddingBottom: '6px' }}
        onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#e5e7eb' }}>{item.referencia || item.tipo_entregable}</div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.rol_remitente} · {item.tipo_entregable}</div>
        {expanded === item.id && (
          <pre style={{ fontSize: '12px', marginTop: '6px', whiteSpace: 'pre-wrap', color: '#d1d5db', background: '#1f2937', padding: '8px', borderRadius: '4px' }}>
            {item.contenido}
          </pre>
        )}
      </div>
    ));

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Mis tareas DIR-00 */}
      <div style={{ background: '#1f2937', borderRadius: '8px', padding: '12px 16px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: misTareasOpen ? '10px' : 0 }}
          onClick={() => setMisTareasOpen(!misTareasOpen)}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#e5e7eb' }}>
            Mis tareas {misTareas.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', marginLeft: '6px' }}>{misTareas.length}</span>}
          </span>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>{misTareasOpen ? '▲' : '▼'}</span>
        </div>
        {misTareasOpen && (
          <div style={{ background: '#111827', borderRadius: '6px', padding: '10px' }}>
            {itemList(misTareas)}
          </div>
        )}
      </div>

      {/* Bandejas equipo */}
      <div style={{ background: '#1f2937', borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#e5e7eb', marginBottom: '10px' }}>Bandejas del equipo</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ROLES_EQUIPO.map(rol => pill(
            rol.nombre,
            (bandejas[rol.id] || []).length,
            selected === rol.id,
            () => setSelected(selected === rol.id ? null : rol.id)
          ))}
        </div>
        {selected && (
          <div style={{ marginTop: '10px', background: '#111827', borderRadius: '6px', padding: '10px' }}>
            {itemList(bandejas[selected] || [])}
          </div>
        )}
      </div>
    </div>
  );
}
