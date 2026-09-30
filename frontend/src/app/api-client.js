// Central API client — attaches user identity to every request

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // ==================== IDENTITY RESOLUTION ====================
  // Priority: staff session > member session

  const staff = localStorage.getItem('admin') || localStorage.getItem('user');
  const staffRole = localStorage.getItem('role');

  if (staff && staffRole) {
    try {
      const u = JSON.parse(staff);
      if (u.id) headers['X-User-Id'] = u.id;
      headers['X-User-Role'] = staffRole;
    } catch {}
  } else {
    const member = localStorage.getItem('member');
    if (member) {
      try {
        const m = JSON.parse(member);
        if (m.id) headers['X-User-Id'] = m.id;
        headers['X-User-Role'] = 'member';
      } catch {}
    }
  }

  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, { ...options, headers });

  return res;
}

// ==================== SESSION HELPERS ====================
export function saveSession(user, role, cardAccess) {
  localStorage.setItem('admin', JSON.stringify(user));
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('role', role);
  localStorage.setItem('cardAccess', cardAccess === 'all' ? 'all' : JSON.stringify(cardAccess || []));
  localStorage.setItem('token', 'session');
}

export function clearSession() {
  ['admin', 'user', 'role', 'cardAccess', 'token', 'member', 'mustChangePassword'].forEach(k => localStorage.removeItem(k));
}

export function getSession() {
  const data = localStorage.getItem('admin') || localStorage.getItem('user');
  if (!data) return null;
  try {
    return {
      user: JSON.parse(data),
      role: localStorage.getItem('role') || 'admin',
      cardAccess: localStorage.getItem('cardAccess')
    };
  } catch { return null; }
}

export function hasCardAccess(cardId) {
  const access = localStorage.getItem('cardAccess');
  const role = localStorage.getItem('role');
  if (access === 'all' || role === 'admin' || role === 'it_technician') return true;
  try {
    return JSON.parse(access || '[]').includes(cardId);
  } catch { return false; }
}