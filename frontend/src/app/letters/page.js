'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch, API } from '../api-client';
import PdfOptionsModal from '../../components/PdfOptionsModal';

const LETTER_TYPES = {
  appointment: { label: '📋 Appointment', color: '#7c3aed', bg: '#f3e8ff', desc: 'Appoint a leader' },
  recommendation: { label: '⭐ Recommendation', color: '#15803d', bg: '#dcfce7', desc: 'Recommend a person' },
  good_standing: { label: '✅ Good Standing', color: '#0369a1', bg: '#e0f2fe', desc: 'Certify a person' },
  general: { label: '✉️ General Letter', color: '#b45309', bg: '#fef9e7', desc: 'Free-form' }
};

const CARD_TYPES = {
  invitation: { label: '🎉 Invitation', color: '#0f3460', bg: '#fef9f3', desc: 'Club functions & GA' },
  success: { label: '🏆 Success Card', color: '#15803d', bg: '#f0fdf4', desc: 'Wish them luck in exams' },
  wedding: { label: '💍 Wedding', color: '#be185d', bg: '#fdf4f7', desc: 'Congratulate couples' },
  introduction: { label: '🎊 Introduction', color: '#78350f', bg: '#fef9e7', desc: 'Traditional ceremony' },
  condolence: { label: '🕊️ Condolence', color: '#1e293b', bg: '#f1f5f9', desc: 'Express sympathy' }
};

const ALL_TYPES = { ...LETTER_TYPES, ...CARD_TYPES };

const ROLE_DUTIES = {
  president: 'chairing all general meetings, providing overall leadership and strategic direction, representing the Club in all official matters, and ensuring that the Constitution is upheld',
  vice_president: "supporting the President, presiding over meetings in the President's absence, and coordinating specific duties delegated by the President",
  secretary: 'maintaining Club records and registers, recording minutes of all meetings, handling official correspondence, and issuing notices of meetings',
  treasurer: 'managing the finances of the Club, collecting subscriptions and dues, preparing financial reports, maintaining accurate records of all income and expenditure, and presenting accounts to members at general meetings',
  chairman_loan_committee: 'overseeing the loan committee, reviewing loan applications, and ensuring fair and transparent loan decisions',
  chair_investment_committee: 'overseeing the investment committee, reviewing investment opportunities, and guiding the Club on prudent investment decisions',
  loan_officer_1: 'vetting loan applicants, appraising loan proposals, preparing loan committee minutes, and monitoring loan performance',
  loan_officer_2: 'assisting the Senior Loan Officer, conducting due diligence on loan applicants, and following up on loan recovery',
  it_technician: "maintaining the Club's digital systems and records, providing technical support, and ensuring data security",
  treasurer_loan_committee: 'managing funds disbursed through the loan committee, reconciling loan committee accounts, and reporting to the Treasurer'
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
const defaultTermStart = () => new Date().toISOString().split('T')[0];
const defaultTermEnd = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 2); return d.toISOString().split('T')[0]; };

export default function LettersPage() {
  const [mode, setMode] = useState('letters');
  const [tab, setTab] = useState('compose');
  const [options, setOptions] = useState({ leaders: [], members: [] });
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const emptyLetterForm = {
    type: 'appointment', leaderId: '', memberId: '', termStart: '', termEnd: '',
    subject: '', body: [''], reason: '',
    ovName: '', ovTitle: '', ovOrg: '', ovAddress: '', ovSalutation: ''
  };
  const [letterForm, setLetterForm] = useState(emptyLetterForm);

  const emptyCardForm = {
    type: 'invitation', subject: '', memberId: '',
    eventTitle: '', eventDate: '', eventTime: '', eventVenue: '', dressCode: '', agenda: '', rsvpContact: '',
    candidateName: '', candidatePhoto: '', relationship: 'self', examLevel: 'UCE',
    brideName: '', groomName: '', weddingDate: '', weddingTime: '', weddingVenue: '', receptionVenue: '', couplePhoto: '',
    weddingRelationship: 'self', contributionAmount: '',
    introductionDate: '', introductionTime: '', introductionVenue: '', families: '', groomFamily: '', brideFamily: '',
    condolenceCase: 'club_lost_member', deceasedName: '', lifeDates: '',
    deceasedPhoto: '', funeralDate: '', funeralVenue: '', relativeRelationship: 'father',
    message: ''
  };
  const [cardForm, setCardForm] = useState(emptyCardForm);

  useEffect(() => { fetchOptions(); }, []);
  useEffect(() => { if (tab === 'history') fetchItems(); }, [tab, search, typeFilter, mode]);

  const fetchOptions = async () => {
    try {
      const res = await apiFetch('/api/letters/options');
      const d = await res.json();
      setOptions({ leaders: d.leaders || [], members: d.members || [] });
    } catch (err) { console.error(err); }
  };

  const fetchItems = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);
      if (!typeFilter) params.append('mode', mode);
      const res = await apiFetch(`/api/letters?${params.toString()}`);
      const d = await res.json();
      setItems(d.letters || []);
    } catch (err) { console.error(err); }
    finally { setLoadingList(false); }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setLetterForm({ ...emptyLetterForm });
    setCardForm({ ...emptyCardForm });
    setShowAdvanced(false);
    setMsg('');
  };

  const combinedPeople = useMemo(() => {
    const map = new Map();
    options.members.forEach(m => map.set(m.name.toLowerCase(), { ...m, isLeader: false, _source: 'member' }));
    options.leaders.forEach(l => {
      const key = l.name.toLowerCase();
      const existing = map.get(key);
      if (existing) map.set(key, { ...existing, isLeader: true, role: l.role });
      else map.set(key, {
        _id: l._id, _source: 'leader', isLeader: true, name: l.name,
        memberNumber: l.memberNumber || '', role: l.role,
        totalShares: 0, savings: 0, hasActiveLoan: false, membershipSince: null,
        address: l.address || '', contact: l.contact || '', email: l.email || '', photo: l.photo || ''
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [options]);

  const optionsForLetterType = useMemo(() => {
    if (letterForm.type === 'appointment') return options.leaders.map(l => ({ ...l, _source: 'leader', isLeader: true }));
    if (letterForm.type === 'recommendation' || letterForm.type === 'good_standing') return combinedPeople;
    return [];
  }, [letterForm.type, options, combinedPeople]);

  const selectedLeader = letterForm.leaderId ? options.leaders.find(l => l._id === letterForm.leaderId) : null;
  const selectedMember = letterForm.memberId ? options.members.find(m => m._id === letterForm.memberId) : null;
  const selectedPerson = selectedMember || selectedLeader;

  const autoRecipient = useMemo(() => {
    if (letterForm.type === 'appointment' && selectedLeader) {
      return { name: selectedLeader.name, title: selectedLeader.memberNumber ? `Member No: ${selectedLeader.memberNumber}` : '', organization: '', address: selectedLeader.address || '', salutation: `Dear ${selectedLeader.name},` };
    }
    if ((letterForm.type === 'recommendation' || letterForm.type === 'good_standing') && selectedPerson) {
      const hasDest = letterForm.ovOrg || letterForm.ovAddress;
      return { 
        name: '', 
        title: '', 
        organization: letterForm.ovOrg || '', 
        address: letterForm.ovAddress || '', 
        salutation: letterForm.ovSalutation || (hasDest ? 'Dear Sir/Madam,' : 'To Whom It May Concern') 
      };
    }
    return { name: '', title: '', organization: '', address: '', salutation: 'Dear Sir/Madam' };
  }, [letterForm.type, selectedLeader, selectedPerson, letterForm.ovOrg, letterForm.ovAddress, letterForm.ovSalutation]);

  const finalRecipient = useMemo(() => {
    const hasOverride = letterForm.ovName || letterForm.ovTitle || letterForm.ovOrg || letterForm.ovAddress || letterForm.ovSalutation;
    if (!hasOverride) return autoRecipient;
    return {
      name: letterForm.ovName || autoRecipient.name,
      title: letterForm.ovTitle || autoRecipient.title,
      organization: letterForm.ovOrg || autoRecipient.organization,
      address: letterForm.ovAddress || autoRecipient.address,
      salutation: letterForm.ovSalutation || autoRecipient.salutation
    };
  }, [letterForm, autoRecipient]);

  const templateSubject = (type, person) => {
    if (!person) return '';
    if (type === 'appointment' && person.role) return `APPOINTMENT AS ${person.role.replace(/_/g, ' ').toUpperCase()}`;
    if (type === 'recommendation') return `RECOMMENDATION FOR ${person.name.toUpperCase()}`;
    if (type === 'good_standing') return 'CERTIFICATE OF GOOD STANDING';
    return '';
  };

  const templateBody = (type, person, reason) => {
    if (!person) return [''];
    
    const isLeader = !!person.isLeader;
    const hasShares = Number(person.totalShares) > 0;
    const isMember = !!person.memberNumber;
    
    const parts = [];
    if (isMember) parts.push('member');
    if (hasShares) parts.push('shareholder');
    if (isLeader) parts.push('leader');
    
    let designation = 'member';
    if (parts.length === 1) designation = parts[0];
    else if (parts.length === 2) designation = parts.join(' and ');
    else if (parts.length === 3) designation = parts[0] + ', ' + parts[1] + ', and ' + parts[2];

    if (type === 'appointment') {
      const roleLabel = person.role.replace(/_/g, ' ').toUpperCase();
      const duties = ROLE_DUTIES[person.role] || 'discharging the duties of your office as prescribed by the Constitution';
      return [
        `We, the shareholders and members of CRESTED SS INVESTMENT CLUB LTD, in accordance with the Club Constitution, hereby appoint ${person.name}${person.memberNumber ? ` (Member No. ${person.memberNumber})` : ''} as ${roleLabel} of the Club.`,
        `In this capacity, you shall be responsible for ${duties}.`,
        `You shall be required to uphold the values, Constitution, and Code of Conduct of the Club at all times, and to discharge your duties with integrity, diligence, and transparency.`,
        `We wish you success in this new role and look forward to your contribution to the continued growth and strengthening of our Club.`
      ];
    }
    
    if (type === 'recommendation') {
      const first = person.name.split(' ')[0];
      const lines = [
        `We, the shareholders and members of CRESTED SS INVESTMENT CLUB LTD, are pleased to recommend ${person.name}${person.memberNumber ? ` (Member No. ${person.memberNumber})` : ''}.`
      ];
      
      const sinceText = person.membershipSince ? ` since ${fmtDate(person.membershipSince)}` : '';
      
      let statusLine = `${person.name} is our esteemed ${designation}${sinceText}.`;
      if (isLeader) statusLine += ` ${first} currently serves as the ${(person.role || '').replace(/_/g, ' ')} of our Club.`;
      if (hasShares) statusLine += ` ${first} holds ${person.totalShares} shares in the Club.`;
      statusLine += ` Throughout this period, ${first} has consistently demonstrated commitment, integrity, and responsible conduct in all dealings with the Club and fellow members.`;
      
      lines.push(statusLine);
      if (reason && reason.trim()) lines.push(reason.trim());
      lines.push(`We have no hesitation in recommending ${first} for any purpose deemed fit. Please feel free to contact the Club for any further information.`);
      return lines;
    }
    
    if (type === 'good_standing') {
      const memberNoStr = person.memberNumber ? ` (Member No. ${person.memberNumber})` : '';
      const lines = [
        `This is to certify that ${person.name}${memberNoStr} is a registered ${designation} of CRESTED SS INVESTMENT CLUB LTD in good standing.`
      ];
      
      const sinceText = person.membershipSince ? ` ${person.name.split(' ')[0]} has been a member since ${fmtDate(person.membershipSince)}.` : '';
      
      let statusSentence = `As at the date of this letter, the above-named is current on all membership obligations.`;
      
      const extraInfo = [];
      if (isLeader) extraInfo.push(`currently serves as the ${(person.role || '').replace(/_/g, ' ')}`);
      if (hasShares) extraInfo.push(`holds ${person.totalShares} shares`);
      if (person.savings) extraInfo.push(`has savings of UGX ${fmt(person.savings)}`);
      
      if (extraInfo.length > 0) {
        statusSentence = `As at the date of this letter, the above-named is current on all membership obligations, ${extraInfo.join(', ')}, and remains in good standing.`;
      }
      
      lines.push(statusSentence + sinceText);
      
      if (!person.hasActiveLoan) lines.push('The above-named has no outstanding loans with the Club.');
      lines.push('This certificate is issued upon request and remains valid as at the date of issue.');
      return lines;
    }
    return [''];
  };

  const handleLetterTypeChange = (newType) => {
    setLetterForm({ ...emptyLetterForm, type: newType });
    setShowAdvanced(false);
    setMsg('');
  };

  const handlePersonSelect = (id) => {
    const person = optionsForLetterType.find(p => p._id === id);
    if (!person) {
      setLetterForm({ ...letterForm, leaderId: '', memberId: '', subject: '', body: [''] });
      return;
    }
    let useLeaderId = false;
    if (letterForm.type === 'appointment') useLeaderId = true;
    else if (person._source === 'leader' && !person.memberNumber) useLeaderId = true;
    const newForm = { ...letterForm, leaderId: useLeaderId ? id : '', memberId: useLeaderId ? '' : id };
    if (letterForm.type === 'appointment') {
      newForm.termStart = letterForm.termStart || defaultTermStart();
      newForm.termEnd = letterForm.termEnd || defaultTermEnd();
    }
    newForm.subject = templateSubject(letterForm.type, person);
    newForm.body = templateBody(letterForm.type, person, letterForm.reason);
    setLetterForm(newForm);
  };

  useEffect(() => {
    if (selectedPerson && (letterForm.type === 'recommendation' || letterForm.type === 'good_standing')) {
      const newBody = templateBody(letterForm.type, selectedPerson, letterForm.reason);
      setLetterForm(prev => ({ ...prev, body: newBody }));
    }
  }, [letterForm.ovOrg, letterForm.ovAddress, letterForm.ovSalutation]);

  useEffect(() => {
    if (letterForm.type === 'appointment' && selectedPerson && letterForm.termStart && letterForm.termEnd) {
      const newBody = templateBody('appointment', selectedPerson, letterForm.reason);
      setLetterForm(prev => ({ ...prev, body: newBody }));
    }
  }, [letterForm.termStart, letterForm.termEnd]);

  const updateBody = (idx, val) => {
    const body = [...letterForm.body];
    body[idx] = val;
    setLetterForm({ ...letterForm, body });
  };

  const submitLetter = async () => {
    setMsg('');
    if (!letterForm.subject.trim()) return setMsg('❌ Select a person');
    if (letterForm.type === 'appointment' && !letterForm.leaderId) return setMsg('❌ Select a leader');
    if ((letterForm.type === 'recommendation' || letterForm.type === 'good_standing') && !letterForm.leaderId && !letterForm.memberId) return setMsg('❌ Select a person');

    setSaving(true);
    try {
      const payload = {
        type: letterForm.type,
        leaderId: letterForm.leaderId || null,
        memberId: letterForm.memberId || null,
        termStart: letterForm.termStart || null,
        termEnd: letterForm.termEnd || null,
        reason: letterForm.reason || '',
        subject: letterForm.subject,
        body: letterForm.body.filter(p => p && p.trim()),
        recipient: finalRecipient,
        signatories: ['president', 'secretary']
      };
      const res = await apiFetch('/api/letters', { method: 'POST', body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMsg(`✅ Letter ${d.referenceNumber} created`);
      setPdfModal({ title: `Letter ${d.referenceNumber}`, baseUrl: `${API}/api/letters/${d._id}/pdf` });
      setLetterForm({ ...emptyLetterForm, type: letterForm.type });
      setShowAdvanced(false);
    } catch (err) { setMsg('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = (field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Image too large — max 2MB');
    const reader = new FileReader();
    reader.onload = () => setCardForm(prev => ({ ...prev, [field]: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleCardMemberSelect = (memberId, role) => {
    const m = options.members.find(x => x._id === memberId);
    const updates = { memberId };
    if (m) {
      if (role === 'success') {
        if (cardForm.relationship === 'self') updates.candidateName = m.name;
        if (m.photo && cardForm.relationship === 'self') updates.candidatePhoto = m.photo;
      } else if (role === 'condolence') {
        if (cardForm.condolenceCase === 'club_lost_member') {
          updates.deceasedName = m.name;
          if (m.photo) updates.deceasedPhoto = m.photo;
        }
      }
    }
    setCardForm(prev => ({ ...prev, ...updates }));
  };

  const submitCard = async () => {
    setMsg('');
    const f = cardForm;

    if (f.type === 'invitation' && !f.eventTitle.trim()) return setMsg('❌ Event title required');
    if (f.type === 'invitation' && (!f.eventDate || !f.eventVenue)) return setMsg('❌ Date and venue required');
    if (f.type === 'success' && !f.candidateName.trim()) return setMsg('❌ Candidate name required');
    if (f.type === 'success' && !f.memberId) return setMsg('❌ Select the member this card is for');
    if (f.type === 'wedding' && (!f.brideName.trim() || !f.groomName.trim())) return setMsg('❌ Bride and groom names required');
    if (f.type === 'wedding' && (!f.weddingDate || !f.weddingVenue)) return setMsg('❌ Date and venue required');
    if (f.type === 'introduction' && (!f.brideName.trim() || !f.groomName.trim())) return setMsg('❌ Couple names required');
    if (f.type === 'condolence' && f.condolenceCase === 'member_lost_loved_one' && (!f.memberId || !f.deceasedName.trim())) return setMsg('❌ Select member and enter deceased name');
    if (f.type === 'condolence' && f.condolenceCase === 'club_lost_member' && !f.deceasedName.trim()) return setMsg('❌ Deceased name required');

    setSaving(true);
    try {
      let subject = '';
      switch (f.type) {
        case 'invitation': 
          subject = (f.eventTitle || 'CLUB INVITATION').toUpperCase(); 
          break;
        case 'success': {
          const memName = options.members.find(m => m._id === f.memberId)?.name || 'MEMBER';
          const relLabel = f.relationship === 'self' ? '' : `'S ${f.relationship.toUpperCase()}`;
          subject = `BEST WISHES ${memName.toUpperCase()}${relLabel} — ${f.candidateName.toUpperCase()}`; 
          break;
        }
        case 'wedding': 
          subject = `${f.groomName.toUpperCase()} & ${f.brideName.toUpperCase()} WEDDING`; 
          break;
        case 'introduction': 
          subject = `INTRODUCTION CEREMONY`; 
          break;
        case 'condolence': 
          subject = `CONDOLENCE — ${f.deceasedName.toUpperCase()}`; 
          break;
      }

      const cardDetails = {
        eventTitle: f.eventTitle, eventDate: f.eventDate, eventTime: f.eventTime, eventVenue: f.eventVenue,
        dressCode: f.dressCode, agenda: f.agenda, rsvpContact: f.rsvpContact,
        candidateName: f.candidateName, candidatePhoto: f.candidatePhoto, relationship: f.relationship, examLevel: f.examLevel,
        message: f.message,
        brideName: f.brideName, groomName: f.groomName, couplePhoto: f.couplePhoto,
        weddingDate: f.weddingDate, weddingTime: f.weddingTime,
        weddingVenue: f.weddingVenue, receptionVenue: f.receptionVenue,
        weddingRelationship: f.weddingRelationship, contributionAmount: f.contributionAmount,
        introductionDate: f.introductionDate, introductionTime: f.introductionTime, introductionVenue: f.introductionVenue, 
        families: f.families, groomFamily: f.groomFamily, brideFamily: f.brideFamily,
        condolenceCase: f.condolenceCase,
        deceasedName: f.deceasedName, lifeDates: f.lifeDates,
        deceasedPhoto: f.deceasedPhoto,
        funeralDate: f.funeralDate, funeralVenue: f.funeralVenue,
        relativeRelationship: f.relativeRelationship
      };

      const payload = {
        type: f.type, subject, memberId: f.memberId || null,
        cardDetails, recipient: {},
        signatories: ['president', 'secretary']
      };

      const res = await apiFetch('/api/letters', { method: 'POST', body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMsg(`✅ Card ${d.referenceNumber} created`);
      setPdfModal({ title: `Card ${d.referenceNumber}`, baseUrl: `${API}/api/letters/${d._id}/pdf` });
      setCardForm({ ...emptyCardForm, type: f.type });
    } catch (err) { setMsg('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const deleteItem = async (id, ref) => {
    if (!confirm(`⚠️ DELETE ${ref}?`)) return;
    try {
      const res = await apiFetch(`/api/letters/${id}`, { method: 'DELETE' });
      if (res.ok) fetchItems();
    } catch (err) { alert('Network error'); }
  };

  const currentTypes = mode === 'letters' ? LETTER_TYPES : CARD_TYPES;
  const currentMember = options.members.find(m => m._id === cardForm.memberId);

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>📝 Letters, Cards & Recommendations</h1>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Official club letterhead and beautifully designed cards for every occasion.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => handleModeChange('letters')} style={{ padding: '12px 24px', background: mode === 'letters' ? '#0f3460' : '#fff', color: mode === 'letters' ? '#fff' : '#475569', border: '2px solid ' + (mode === 'letters' ? '#0f3460' : '#e5e7eb'), borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>📄 Letters</button>
        <button onClick={() => handleModeChange('cards')} style={{ padding: '12px 24px', background: mode === 'cards' ? '#7c3aed' : '#fff', color: mode === 'cards' ? '#fff' : '#475569', border: '2px solid ' + (mode === 'cards' ? '#7c3aed' : '#e5e7eb'), borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>🎨 Cards</button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        <TabBtn active={tab === 'compose'} onClick={() => setTab('compose')}>✍️ Compose</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>📚 History</TabBtn>
      </div>

      {msg && (<div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600', fontSize: '13px' }}>{msg}</div>)}

      {tab === 'compose' && mode === 'letters' && (
        <>
          <Section title="1. Choose Letter Type">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {Object.entries(LETTER_TYPES).map(([id, meta]) => (
                <button key={id} onClick={() => handleLetterTypeChange(id)} style={{ padding: '14px 10px', background: letterForm.type === id ? meta.bg : '#fff', border: `2px solid ${letterForm.type === id ? meta.color : '#e5e7eb'}`, borderRadius: '10px', cursor: 'pointer', color: letterForm.type === id ? meta.color : '#64748b', fontWeight: letterForm.type === id ? '700' : '500', fontSize: '13px' }}>
                  <div>{meta.label}</div>
                  <div style={{ fontSize: '10px', fontWeight: '400', marginTop: '4px', opacity: 0.8 }}>{meta.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          {letterForm.type !== 'general' && (
            <Section title="2. Select Person">
              <select value={letterForm.leaderId || letterForm.memberId} onChange={e => handlePersonSelect(e.target.value)} style={input}>
                <option value="">— Choose from the list —</option>
                {optionsForLetterType.map(p => (
                  <option key={p._id} value={p._id}>{p.name}{p.memberNumber ? ` — ${p.memberNumber}` : ''}{p.isLeader ? ' (Leader)' : ''}</option>
                ))}
              </select>
              {selectedPerson && (
                <AutoFilledCard title="Auto-filled" items={[
                  { label: 'Name', value: selectedPerson.name },
                  { label: 'Member No.', value: selectedPerson.memberNumber || '—' },
                  ...(selectedPerson.isLeader ? [{ label: 'Role', value: (selectedPerson.role || '').replace(/_/g, ' ') }] : [])
                ]} />
              )}
            </Section>
          )}

          {letterForm.type === 'appointment' && selectedPerson && (
            <Section title="3. Set Term Limits (Contract Duration)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Term Starts (From) *">
                  <input type="date" value={letterForm.termStart} onChange={e => setLetterForm({ ...letterForm, termStart: e.target.value })} style={input} />
                </Field>
                <Field label="Term Expires (To) *">
                  <input type="date" value={letterForm.termEnd} onChange={e => setLetterForm({ ...letterForm, termEnd: e.target.value })} style={input} />
                </Field>
              </div>
            </Section>
          )}

          {letterForm.type === 'recommendation' && selectedPerson && (
            <Section title="3. Addressee (Where is this recommendation going?)">
              <Field label="Specific Title (e.g. The Manager, The Ambassador)">
                <input type="text" value={letterForm.ovTitle} onChange={e => setLetterForm({ ...letterForm, ovTitle: e.target.value })} style={input} placeholder="Leave blank for 'To Whom It May Concern'" />
              </Field>
              <Field label="Organization / Institution (optional)">
                <input type="text" value={letterForm.ovOrg} onChange={e => setLetterForm({ ...letterForm, ovOrg: e.target.value })} style={input} placeholder="e.g. LUBASA INVESTMENTS LIMITED" />
              </Field>
              <Field label="Specific Address / Location (optional)">
                <input type="text" value={letterForm.ovAddress} onChange={e => setLetterForm({ ...letterForm, ovAddress: e.target.value })} style={input} placeholder="e.g. P.O. BOX 153877 KAMPALA" />
              </Field>
              <Field label="Salutation (optional - auto-filled)">
                <input type="text" value={letterForm.ovSalutation} onChange={e => setLetterForm({ ...letterForm, ovSalutation: e.target.value })} style={input} placeholder="e.g. Dear Sir/Madam," />
              </Field>
            </Section>
          )}

          {letterForm.type === 'general' && (
            <>
              <Section title="Recipient">
                <Field label="Name"><input type="text" value={letterForm.ovName} onChange={e => setLetterForm({ ...letterForm, ovName: e.target.value })} style={input} /></Field>
                <Field label="Organization"><input type="text" value={letterForm.ovOrg} onChange={e => setLetterForm({ ...letterForm, ovOrg: e.target.value })} style={input} /></Field>
                <Field label="Address"><input type="text" value={letterForm.ovAddress} onChange={e => setLetterForm({ ...letterForm, ovAddress: e.target.value })} style={input} /></Field>
              </Section>
              <Section title="Content">
                <Field label="Subject *"><input type="text" value={letterForm.subject} onChange={e => setLetterForm({ ...letterForm, subject: e.target.value })} style={input} /></Field>
                {letterForm.body.map((p, idx) => (
                  <textarea key={idx} value={p} onChange={e => updateBody(idx, e.target.value)} style={{ ...input, minHeight: '80px', marginBottom: '8px', fontFamily: 'inherit' }} />
                ))}
                <button onClick={() => setLetterForm({ ...letterForm, body: [...letterForm.body, ''] })} style={btnAdd}>➕ Add Paragraph</button>
              </Section>
            </>
          )}

          {(selectedPerson || letterForm.type === 'general') && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={submitLetter} disabled={saving} style={{ padding: '14px 28px', background: saving ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : '💾 Save & Preview PDF'}
              </button>
              <button onClick={() => { setLetterForm({ ...emptyLetterForm, type: letterForm.type }); setMsg(''); }} style={btnReset}>Reset</button>
            </div>
          )}
        </>
      )}

      {tab === 'compose' && mode === 'cards' && (
        <>
          <Section title="1. Choose Card Type">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {Object.entries(CARD_TYPES).map(([id, meta]) => (
                <button key={id} onClick={() => { setCardForm({ ...emptyCardForm, type: id }); setMsg(''); }} style={{ padding: '14px 10px', background: cardForm.type === id ? meta.bg : '#fff', border: `2px solid ${cardForm.type === id ? meta.color : '#e5e7eb'}`, borderRadius: '10px', cursor: 'pointer', color: cardForm.type === id ? meta.color : '#64748b', fontWeight: cardForm.type === id ? '700' : '500', fontSize: '12px' }}>
                  <div>{meta.label}</div>
                  <div style={{ fontSize: '10px', fontWeight: '400', marginTop: '4px', opacity: 0.8 }}>{meta.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* INVITATION */}
          {cardForm.type === 'invitation' && (
            <Section title="Invitation Details">
              <Field label="Event Title *"><input type="text" value={cardForm.eventTitle} onChange={e => setCardForm({ ...cardForm, eventTitle: e.target.value })} style={input} placeholder="e.g. ANNUAL GENERAL ASSEMBLY" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Date *"><input type="date" value={cardForm.eventDate} onChange={e => setCardForm({ ...cardForm, eventDate: e.target.value })} style={input} /></Field>
                <Field label="Time"><input type="time" value={cardForm.eventTime} onChange={e => setCardForm({ ...cardForm, eventTime: e.target.value })} style={input} /></Field>
              </div>
              <Field label="Venue *"><input type="text" value={cardForm.eventVenue} onChange={e => setCardForm({ ...cardForm, eventVenue: e.target.value })} style={input} placeholder="e.g. Club Hall, Kampala" /></Field>
              <Field label="Dress Code"><input type="text" value={cardForm.dressCode} onChange={e => setCardForm({ ...cardForm, dressCode: e.target.value })} style={input} /></Field>
              <Field label="Agenda (optional)"><input type="text" value={cardForm.agenda} onChange={e => setCardForm({ ...cardForm, agenda: e.target.value })} style={input} /></Field>
              <Field label="RSVP Contact"><input type="text" value={cardForm.rsvpContact} onChange={e => setCardForm({ ...cardForm, rsvpContact: e.target.value })} style={input} /></Field>
              <Field label="Custom Message (optional — default used if blank)"><textarea value={cardForm.message} onChange={e => setCardForm({ ...cardForm, message: e.target.value })} style={{ ...input, minHeight: '70px', fontFamily: 'inherit' }} /></Field>
            </Section>
          )}

          {/* SUCCESS */}
          {cardForm.type === 'success' && (
            <Section title="Success Card Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Select Member *">
                  <select value={cardForm.memberId} onChange={e => handleCardMemberSelect(e.target.value, 'success')} style={input}>
                    <option value="">— Select Member —</option>
                    {options.members.map(m => <option key={m._id} value={m._id}>{m.name} — {m.memberNumber}</option>)}
                  </select>
                </Field>
                <Field label="Who is sitting for the exam? *">
                  <select value={cardForm.relationship} onChange={e => setCardForm({ ...cardForm, relationship: e.target.value, candidateName: e.target.value === 'self' && currentMember ? currentMember.name : '' })} style={input}>
                    <option value="self">The Member (Self)</option>
                    <option value="son">Member's Son</option>
                    <option value="daughter">Member's Daughter</option>
                    <option value="spouse">Member's Spouse</option>
                  </select>
                </Field>
              </div>

              <Field label="Level of Examination *">
                <select value={cardForm.examLevel || 'UCE'} onChange={e => setCardForm({ ...cardForm, examLevel: e.target.value })} style={input}>
                  <option value="PLE">Primary Leaving Examination (PLE)</option>
                  <option value="UCE">Uganda Certificate of Education (UCE)</option>
                  <option value="UACE">Uganda Advanced Certificate of Education (UACE)</option>
                  <option value="University">University / Tertiary Institution</option>
                </select>
              </Field>
              
              {cardForm.relationship !== 'self' && currentMember && (
                <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '6px', fontSize: '13px', color: '#15803d', marginBottom: '10px', fontWeight: '600' }}>
                  This card will be addressed to: {currentMember.name.toUpperCase()}'S {cardForm.relationship.toUpperCase()}
                </div>
              )}

              <Field label={cardForm.relationship === 'self' ? "Member Name" : `Name of the ${cardForm.relationship}`}>
                <input type="text" value={cardForm.candidateName} onChange={e => setCardForm({ ...cardForm, candidateName: e.target.value })} style={input} disabled={cardForm.relationship === 'self'} />
              </Field>

              <Field label="Photo (optional — 2MB max)">
                <input type="file" accept="image/*" onChange={e => handlePhotoUpload('candidatePhoto', e)} style={input} />
                {cardForm.candidatePhoto && <img src={cardForm.candidatePhoto} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '8px' }} />}
              </Field>
              
              <Field label="Custom Message (optional — general text used if blank)">
                <textarea value={cardForm.message} onChange={e => setCardForm({ ...cardForm, message: e.target.value })} style={{ ...input, minHeight: '80px', fontFamily: 'inherit' }} placeholder="Leave blank for the standard good luck message" />
              </Field>
            </Section>
          )}

          {/* WEDDING */}
          {cardForm.type === 'wedding' && (
            <Section title="Wedding Card Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Select Member (Optional)">
                  <select value={cardForm.memberId} onChange={e => handleCardMemberSelect(e.target.value, 'wedding')} style={input}>
                    <option value="">— Not linked —</option>
                    {options.members.map(m => <option key={m._id} value={m._id}>{m.name} — {m.memberNumber}</option>)}
                  </select>
                </Field>
                <Field label="Whose Wedding is it? *">
                  <select value={cardForm.weddingRelationship} onChange={e => setCardForm({ ...cardForm, weddingRelationship: e.target.value })} style={input}>
                    <option value="self">The Member (Self)</option>
                    <option value="son">Member's Son</option>
                    <option value="daughter">Member's Daughter</option>
                    <option value="parent">Member's Parent</option>
                    <option value="relative">Other Relative</option>
                    <option value="none">Not linked to a member</option>
                  </select>
                </Field>
              </div>

              {cardForm.weddingRelationship !== 'none' && currentMember && cardForm.weddingRelationship !== 'self' && (
                <div style={{ padding: '10px', background: '#fdf2f8', borderRadius: '6px', fontSize: '13px', color: '#be185d', marginBottom: '10px', fontWeight: '600' }}>
                  This wedding card will be for: {cardForm.weddingRelationship.toUpperCase()} OF {currentMember.name.toUpperCase()}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Groom's Name *"><input type="text" value={cardForm.groomName} onChange={e => setCardForm({ ...cardForm, groomName: e.target.value })} style={input} /></Field>
                <Field label="Bride's Name *"><input type="text" value={cardForm.brideName} onChange={e => setCardForm({ ...cardForm, brideName: e.target.value })} style={input} /></Field>
              </div>
              <Field label="Couple Photo (optional — 2MB max)">
                <input type="file" accept="image/*" onChange={e => handlePhotoUpload('couplePhoto', e)} style={input} />
                {cardForm.couplePhoto && <img src={cardForm.couplePhoto} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '8px' }} />}
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Wedding Date *"><input type="date" value={cardForm.weddingDate} onChange={e => setCardForm({ ...cardForm, weddingDate: e.target.value })} style={input} /></Field>
                <Field label="Time"><input type="time" value={cardForm.weddingTime} onChange={e => setCardForm({ ...cardForm, weddingTime: e.target.value })} style={input} /></Field>
              </div>
              <Field label="Venue *"><input type="text" value={cardForm.weddingVenue} onChange={e => setCardForm({ ...cardForm, weddingVenue: e.target.value })} style={input} /></Field>
              <Field label="Reception Venue"><input type="text" value={cardForm.receptionVenue} onChange={e => setCardForm({ ...cardForm, receptionVenue: e.target.value })} style={input} /></Field>
              <Field label="Dress Code"><input type="text" value={cardForm.dressCode} onChange={e => setCardForm({ ...cardForm, dressCode: e.target.value })} style={input} /></Field>
              
              <Field label="Club Pledge / Contribution (UGX) — optional">
                <input type="number" value={cardForm.contributionAmount} onChange={e => setCardForm({ ...cardForm, contributionAmount: e.target.value })} style={input} placeholder="e.g. 500000" />
              </Field>
              
              <Field label="Custom Message (optional)"><textarea value={cardForm.message} onChange={e => setCardForm({ ...cardForm, message: e.target.value })} style={{ ...input, minHeight: '80px', fontFamily: 'inherit' }} /></Field>
            </Section>
          )}

          {/* INTRODUCTION */}
          {cardForm.type === 'introduction' && (
            <Section title="Introduction Ceremony Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Link to Member (Optional)">
                  <select value={cardForm.memberId} onChange={e => handleCardMemberSelect(e.target.value, 'introduction')} style={input}>
                    <option value="">— Not linked —</option>
                    {options.members.map(m => <option key={m._id} value={m._id}>{m.name} — {m.memberNumber}</option>)}
                  </select>
                </Field>
                <Field label="Whose Ceremony is it? *">
                  <select value={cardForm.weddingRelationship} onChange={e => setCardForm({ ...cardForm, weddingRelationship: e.target.value })} style={input}>
                    <option value="self">The Member (Self)</option>
                    <option value="son">Member's Son</option>
                    <option value="daughter">Member's Daughter</option>
                    <option value="parent">Member's Parent</option>
                    <option value="relative">Other Relative</option>
                    <option value="none">Not linked to a member</option>
                  </select>
                </Field>
              </div>

              {cardForm.weddingRelationship !== 'none' && currentMember && cardForm.weddingRelationship !== 'self' && (
                <div style={{ padding: '10px', background: '#fef9e7', borderRadius: '6px', fontSize: '13px', color: '#78350f', marginBottom: '10px', fontWeight: '600' }}>
                  This card will be for: {cardForm.weddingRelationship.toUpperCase()} OF {currentMember.name.toUpperCase()}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Groom's Name *"><input type="text" value={cardForm.groomName} onChange={e => setCardForm({ ...cardForm, groomName: e.target.value })} style={input} /></Field>
                <Field label="Bride's Name *"><input type="text" value={cardForm.brideName} onChange={e => setCardForm({ ...cardForm, brideName: e.target.value })} style={input} /></Field>
              </div>
              <Field label="Couple Photo (optional)">
                <input type="file" accept="image/*" onChange={e => handlePhotoUpload('couplePhoto', e)} style={input} />
                {cardForm.couplePhoto && <img src={cardForm.couplePhoto} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '8px' }} />}
              </Field>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Groom's Family (e.g. The Ssemakula Family)">
                  <input type="text" value={cardForm.groomFamily} onChange={e => setCardForm({ ...cardForm, groomFamily: e.target.value })} style={input} placeholder="e.g. The Ssemakula Family" />
                </Field>
                <Field label="Bride's Family (e.g. The Kaggwa Family)">
                  <input type="text" value={cardForm.brideFamily} onChange={e => setCardForm({ ...cardForm, brideFamily: e.target.value })} style={input} placeholder="e.g. The Kaggwa Family" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Date *"><input type="date" value={cardForm.introductionDate} onChange={e => setCardForm({ ...cardForm, introductionDate: e.target.value })} style={input} /></Field>
                <Field label="Time"><input type="time" value={cardForm.introductionTime} onChange={e => setCardForm({ ...cardForm, introductionTime: e.target.value })} style={input} /></Field>
              </div>
              <Field label="Venue *"><input type="text" value={cardForm.introductionVenue} onChange={e => setCardForm({ ...cardForm, introductionVenue: e.target.value })} style={input} /></Field>
              <Field label="Club Pledge / Contribution (UGX) — optional">
                <input type="number" value={cardForm.contributionAmount} onChange={e => setCardForm({ ...cardForm, contributionAmount: e.target.value })} style={input} placeholder="e.g. 500000" />
              </Field>
              <Field label="Custom Message (optional)"><textarea value={cardForm.message} onChange={e => setCardForm({ ...cardForm, message: e.target.value })} style={{ ...input, minHeight: '80px', fontFamily: 'inherit' }} /></Field>
            </Section>
          )}

          {/* CONDOLENCE */}
          {cardForm.type === 'condolence' && (
            <Section title="Condolence Card Details">
              <Field label="Case">
                <select value={cardForm.condolenceCase} onChange={e => setCardForm({ ...cardForm, condolenceCase: e.target.value, memberId: '', deceasedName: '', deceasedPhoto: '', relativeRelationship: 'father' })} style={input}>
                  <option value="club_lost_member">Club Lost a Member</option>
                  <option value="member_lost_loved_one">Member Lost a Loved One</option>
                </select>
              </Field>

              {cardForm.condolenceCase === 'member_lost_loved_one' ? (
                <>
                  <Field label="Bereaved Member *">
                    <select value={cardForm.memberId} onChange={e => handleCardMemberSelect(e.target.value, 'condolence')} style={input}>
                      <option value="">— Select member who lost a loved one —</option>
                      {options.members.map(m => <option key={m._id} value={m._id}>{m.name} — {m.memberNumber}</option>)}
                    </select>
                  </Field>
                  
                  <Field label="Relationship to the Deceased *">
                    <select value={cardForm.relativeRelationship || 'father'} onChange={e => setCardForm({ ...cardForm, relativeRelationship: e.target.value })} style={input}>
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="daughter">Daughter</option>
                      <option value="son">Son</option>
                      <option value="sister">Sister</option>
                      <option value="brother">Brother</option>
                      <option value="cousin">Cousin</option>
                      <option value="nephew">Nephew</option>
                      <option value="niece">Niece</option>
                      <option value="spouse">Spouse</option>
                      <option value="other">Other Relative</option>
                    </select>
                  </Field>

                  <Field label="Name of the Deceased *">
                    <input type="text" value={cardForm.deceasedName} onChange={e => setCardForm({ ...cardForm, deceasedName: e.target.value })} style={input} />
                  </Field>
                </>
              ) : (
                <Field label="Deceased Member *">
                  <select value={cardForm.memberId} onChange={e => handleCardMemberSelect(e.target.value, 'condolence')} style={input}>
                    <option value="">— Select the departed member —</option>
                    {options.members.map(m => <option key={m._id} value={m._id}>{m.name} — {m.memberNumber}</option>)}
                  </select>
                </Field>
              )}

              <Field label="Deceased Photo (optional — 2MB max)">
                <input type="file" accept="image/*" onChange={e => handlePhotoUpload('deceasedPhoto', e)} style={input} />
                {cardForm.deceasedPhoto && <img src={cardForm.deceasedPhoto} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '8px' }} />}
              </Field>
              <Field label="Life Dates (optional)"><input type="text" value={cardForm.lifeDates} onChange={e => setCardForm({ ...cardForm, lifeDates: e.target.value })} style={input} placeholder="e.g. 1952 — 2026" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Funeral Date"><input type="date" value={cardForm.funeralDate} onChange={e => setCardForm({ ...cardForm, funeralDate: e.target.value })} style={input} /></Field>
                <Field label="Funeral Venue"><input type="text" value={cardForm.funeralVenue} onChange={e => setCardForm({ ...cardForm, funeralVenue: e.target.value })} style={input} /></Field>
              </div>
              <Field label="Custom Message (optional — default used if blank)"><textarea value={cardForm.message} onChange={e => setCardForm({ ...cardForm, message: e.target.value })} style={{ ...input, minHeight: '100px', fontFamily: 'inherit' }} placeholder="Leave blank for auto-generated condolence message" /></Field>
            </Section>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button onClick={submitCard} disabled={saving} style={{ padding: '14px 28px', background: saving ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : '💾 Save & Preview PDF'}
            </button>
            <button onClick={() => { setCardForm({ ...emptyCardForm, type: cardForm.type }); setMsg(''); }} style={btnReset}>Reset</button>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ ...input, maxWidth: '360px' }} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...input, maxWidth: '220px' }}>
              <option value="">All {mode === 'letters' ? 'Letters' : 'Cards'}</option>
              {Object.entries(currentTypes).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
            </select>
          </div>

          {loadingList ? (<p style={{ color: '#64748b' }}>Loading…</p>) : items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <p style={{ color: '#64748b' }}>Nothing here yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff' }}>
                    <th style={th}>Ref #</th><th style={th}>Date</th><th style={th}>Type</th>
                    <th style={th}>Subject</th><th style={th}>For</th><th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l, i) => {
                    const meta = ALL_TYPES[l.type] || {};
                    const displayName = l.cardDetails?.deceasedName || l.cardDetails?.candidateName || l.subjectPerson?.fullName || '—';
                    return (
                      <tr key={l._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{l.referenceNumber}</td>
                        <td style={td}>{new Date(l.date).toLocaleDateString()}</td>
                        <td style={td}><span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: meta.bg, color: meta.color }}>{meta.label}</span></td>
                        <td style={{ ...td, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.subject}</td>
                        <td style={{ ...td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => setPdfModal({ title: l.subject, baseUrl: `${API}/api/letters/${l._id}/pdf` })} style={btnMini('#7c3aed')}>📄 PDF</button>
                            <button onClick={() => deleteItem(l._id, l.referenceNumber)} style={btnMini('#dc2626')}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {pdfModal && <PdfOptionsModal title={pdfModal.title} baseUrl={pdfModal.baseUrl} onClose={() => setPdfModal(null)} />}
    </div>
  );
}

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: active ? '3px solid #7c3aed' : '3px solid transparent', color: active ? '#1e293b' : '#64748b', fontWeight: active ? '600' : '500', cursor: 'pointer', marginBottom: '-2px', fontSize: '14px' }}>{children}</button>
);
const Section = ({ title, children }) => (
  <div style={{ marginBottom: '20px', padding: '16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
    <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
    {children}
  </div>
);
const AutoFilledCard = ({ title, items }) => (
  <div style={{ marginTop: '12px', padding: '12px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
    <div style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', marginBottom: '8px' }}>✓ {title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 16px', fontSize: '12px' }}>
      {items.map((it, i) => <div key={i}><span style={{ color: '#64748b' }}>{it.label}:</span> <strong>{it.value}</strong></div>)}
    </div>
  </div>
);
const Field = ({ label, children }) => (
  <div style={{ marginBottom: '10px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: '#334155' }}>{label}</label>
    {children}
  </div>
);
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };
const btnAdd = { padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };
const btnReset = { padding: '14px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' };
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' });
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };