import { useState, useEffect } from 'react';

const ROLES = ['F1-13', 'F1-14', 'ROL-17', 'ROL-16', 'ROL-00', 'YT-11'];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function TareasPanel() {
  const [bandejas, setBandejas] = useState({});
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBandejas = async () => {
    const results = {};
    await Promise.all(ROLES.map(async (rol) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/bandejas/${rol}`, { credentials: 'include' });
        const data = await res.json();
        results[rol] = data.items || [];
      } catch {
        results[rol] = [];
      }
    }));
    setBandejas(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchBandejas();
    const interval = setInterval(fetchBandejas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const pendientes = (rol) => (bandejas[rol] || []).filter(i => i.estado === 'PENDIENTE');

  return (
    <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Bandejas</span>
        {loading && <span style={{ fontSize: '12px', color: '#9ca3af' }}>cargando...</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {ROLES.map(rol => {
          const count = pendientes(rol).length;
          const active = selected === rol;
          return (
            <button key={rol} onClick={() => setSelected(active ? null : rol)}
              style={{
                padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', border: 'none',
                background: active ? '#1d4ed8' : count > 0 ? '#dbeafe' : '#f3f4f6',
                color: active ? '#fff' : count > 0 ? '#1d4ed8' : '#6b7280',
                fontWeight: count > 0 ? 600 : 400
              }}>
              {rol} {count > 0 && <span>({count})</span>}
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ marginTop: '12px', background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
          {pendientes(selected).length === 0
            ? <p style={{ fontSize: '13px', color: '#6b7280' }}>Sin items pendientes</p>
            : pendientes(selected).map(item => (
              <div key={item.id} style={{ marginBottom: '8px', cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.referencia || item.tipo_entregable}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.rol_remitente} · {item.tipo_entregable}</div>
                {expanded === item.id && (
                  <pre style={{ fontSize: '12px', marginTop: '6px', whiteSpace: 'pre-wrap', color: '#374151' }}>
                    {item.contenido}
                  </pre>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
