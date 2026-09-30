'use client';

// ==================== REUSABLE MEMBER SEARCH ====================
// Usage:
//   <MemberSearch value={search} onChange={setSearch} placeholder="Search members..." />
// Or with a label:
//   <MemberSearch value={search} onChange={setSearch} label="Search" />

export default function MemberSearch({ value, onChange, placeholder = 'Search...', label = '' }) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155', fontSize: '13px' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '14px',
          color: '#94a3b8',
          pointerEvents: 'none'
        }}>🔍</span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '10px 14px 10px 36px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            background: '#fff'
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#94a3b8',
              padding: '2px 6px'
            }}
            title="Clear search"
          >✕</button>
        )}
      </div>
    </div>
  );
}

// ==================== HELPER — filter any list of objects ====================
// Usage:
//   const filtered = filterBySearch(members, search, ['firstName', 'surname', 'memberNumber', 'contact', 'email']);
export function filterBySearch(list, query, fields) {
  if (!query || !query.trim()) return list;
  const q = query.toLowerCase().trim();
  return list.filter(item =>
    fields.some(field => {
      const value = getNestedValue(item, field);
      return String(value || '').toLowerCase().includes(q);
    })
  );
}

function getNestedValue(obj, path) {
  if (!obj) return '';
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : ''), obj);
}