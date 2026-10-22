const Letter = require('../models/Letter');
const LetterCounter = require('../models/LetterCounter');
const Leader = require('../models/Leader');
const Member = require('../models/Member');
const { generateLetterPDF } = require('../utils/letterheadPDF');
const { generateCardPDF } = require('../utils/cardPDF');

const CARD_TYPES = ['invitation', 'success', 'wedding', 'introduction', 'condolence'];

const PREFIX = {
  appointment: 'APPT', recommendation: 'REC', good_standing: 'GSC', general: 'LTR',
  invitation: 'INV', success: 'SUCC', wedding: 'WED', introduction: 'INTRO', condolence: 'COND'
};

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

async function nextRefNumber(type) {
  const year = new Date().getFullYear();
  const counter = await LetterCounter.findOneAndUpdate(
    { type, year },
    { $inc: { count: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `CRS/${PREFIX[type]}/${year}/${String(counter.count).padStart(3, '0')}`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function computeTotalShares(m) {
  const s = m.shares || {};
  return (s.golden || 0) + (s.platinum || 0) + (s.silver || 0) + (s.bronze || 0);
}

// ==================== DEFAULT CARD MESSAGES ====================
function buildDefaultCardMessage(type, details, member) {
  const d = details || {};
  const memberName = member ? `${member.firstName} ${member.surname}` : '';
  const memberNum = member ? member.memberNumber : '';
  const memberRef = memberName
    ? `${memberName}${memberNum ? ` (Member No. ${memberNum})` : ''}`
    : '';
  const amountStr = d.contributionAmount
    ? `UGX ${Number(d.contributionAmount).toLocaleString()}`
    : '';

  if (type === 'condolence') {
    const condCase = d.condolenceCase || 'club_lost_member';

    if (condCase === 'member_lost_loved_one') {
      const rel = (d.relationship || 'loved one').trim();
      const dec = (d.deceasedName || '').trim();
      const relStr = dec ? `${rel}, ${dec}` : rel;
      let msg = memberRef
        ? `The Club extends its sincere condolences to ${memberRef}, our member, on the loss of their beloved ${relStr}.`
        : `The Club extends its sincere condolences on the loss of a beloved ${relStr}.`;
      if (amountStr) msg += ` The Club has contributed ${amountStr} to help in the burial arrangements.`;
      msg += ` May the Almighty grant you and your family strength, comfort, and peace during this difficult time.`;
      return msg;
    }

    // club_lost_member
    let msg = memberRef
      ? `The Club extends its sincere condolences to the family of our late member, ${memberRef}.`
      : `The Club extends its sincere condolences to the family of the late ${d.deceasedName || 'our beloved member'}.`;
    if (amountStr) msg += ` The Club has contributed ${amountStr} to help in the burial arrangements.`;
    msg += ` Our thoughts and prayers are with the family during this time of grief.`;
    return msg;
  }

  if (type === 'wedding') {
    const groom = (d.groomName || '').trim();
    const bride = (d.brideName || '').trim();
    const couple = groom && bride ? `${groom} and ${bride}` : (groom || bride);
    let msg = `The Club congratulates ${couple} on the joyous occasion of their wedding.`;
    if (amountStr) msg += ` The Club has contributed ${amountStr} as a token of our love and support.`;
    msg += ` We wish you a blessed, fruitful, and lifelong union filled with joy.`;
    return msg;
  }

  if (type === 'introduction') {
    const groom = (d.groomName || '').trim();
    const bride = (d.brideName || '').trim();
    const couple = groom && bride ? `${groom} and ${bride}` : (groom || bride);
    let msg = `The Club congratulates ${couple} on the joyous occasion of their introduction ceremony.`;
    if (amountStr) msg += ` The Club has contributed ${amountStr} as a token of our love and support.`;
    msg += ` May your journey together be filled with blessings.`;
    return msg;
  }

  if (type === 'success') {
    const candidate = (d.candidateName || memberName || 'our candidate').trim();
    const achievement = d.examName
      ? `passing ${d.examName}${d.schoolName ? ` at ${d.schoolName}` : ''}`
      : 'this outstanding achievement';
    let msg = `The Club congratulates ${candidate} on ${achievement}.`;
    if (amountStr) msg += ` The Club has contributed ${amountStr} in recognition of this milestone.`;
    msg += ` May this success mark the beginning of many more achievements to come. Continue to shine!`;
    return msg;
  }

  if (type === 'invitation') {
    const ev = (d.eventTitle || 'our upcoming function').trim();
    return `The Club cordially invites you to attend ${ev}. Your presence will be an honor to us.`;
  }

  return '';
}

// ==================== LETTER CONTENT ====================
async function buildLetterContent(payload) {
  const { type, leaderId, memberId, termStart, termEnd, reason } = payload;
  let leader = null, member = null;

  const subjectPerson = {};
  let subject = (payload.subject || '').trim();
  let body = Array.isArray(payload.body) ? payload.body.filter(p => p && p.trim()) : [];

  if (leaderId) {
    leader = await Leader.findById(leaderId);
    if (leader) {
      subjectPerson.fullName = leader.name;
      subjectPerson.memberNumber = leader.memberNumber || '';
      subjectPerson.role = leader.role;
    }
  }
  if (memberId) {
    member = await Member.findById(memberId);
    if (member) {
      subjectPerson.fullName = `${member.firstName} ${member.surname}`;
      subjectPerson.memberNumber = member.memberNumber;
      subjectPerson.membershipSince = member.dateOfSubscription;
      subjectPerson.savings = Number(member.savings) || 0;
      subjectPerson.totalShares = computeTotalShares(member);
      subjectPerson.hasActiveLoan = !!member.activeLoanId;
    }
  }
  if (termStart) subjectPerson.termStart = new Date(termStart);
  if (termEnd) subjectPerson.termEnd = new Date(termEnd);

  if (body.length === 0) {
    if (type === 'appointment' && leader) {
      const duties = ROLE_DUTIES[leader.role] || 'discharging the duties of your office as prescribed by the Constitution';
      const roleLabel = leader.role.replace(/_/g, ' ').toUpperCase();
      const termClause = (termStart && termEnd)
        ? `for a term commencing ${fmtDate(termStart)} and ending ${fmtDate(termEnd)}`
        : 'for a term of two (2) years effective from the date of this letter';
      subject = subject || `APPOINTMENT AS ${roleLabel}`;
      body = [
        `We, the shareholders and members of CRESTED SS INVESTMENT CLUB LTD, in accordance with the Club Constitution, hereby appoint ${leader.name}${leader.memberNumber ? ` (Member No. ${leader.memberNumber})` : ''} as ${roleLabel} of the Club, ${termClause}.`,
        `In this capacity, you shall be responsible for ${duties}.`,
        `You shall be required to uphold the values, Constitution, and Code of Conduct of the Club at all times, and to discharge your duties with integrity, diligence, and transparency.`,
        `We wish you success in this new role and look forward to your contribution to the continued growth and strengthening of our Club.`
      ];
    } else if (type === 'recommendation') {
      const person = member
        ? { name: `${member.firstName} ${member.surname}`, memberNumber: member.memberNumber, isLeader: false }
        : leader
        ? { name: leader.name, memberNumber: leader.memberNumber, role: leader.role, isLeader: true }
        : null;

      if (person) {
        subject = subject || `RECOMMENDATION FOR ${person.name.toUpperCase()}`;
        const first = person.name.split(' ')[0];
        const lines = [];
        if (person.isLeader) {
          lines.push(`We, the shareholders and members of CRESTED SS INVESTMENT CLUB LTD, are pleased to recommend ${person.name}${person.memberNumber ? ` (Member No. ${person.memberNumber})` : ''}.`);
          lines.push(`${person.name} serves as ${person.role.replace(/_/g, ' ')} of our Club and has consistently demonstrated commitment, integrity, and responsible conduct in all dealings with the Club and fellow members.`);
        } else {
          lines.push(`We, the shareholders and members of CRESTED SS INVESTMENT CLUB LTD, are pleased to recommend ${person.name} (Member No. ${person.memberNumber}).`);
          lines.push(`The above-named has been a member of our Club since ${fmtDate(subjectPerson.membershipSince)}. During this period, they have demonstrated commitment, integrity, and responsible conduct in their dealings with the Club and fellow members.`);
        }
        if (reason && reason.trim()) lines.push(reason.trim());
        lines.push(`We have no hesitation in recommending ${first} for any purpose they may deem fit. Please feel free to contact the Club for any further information.`);
        body = lines;
      }
    } else if (type === 'good_standing' && member) {
      subject = subject || 'CERTIFICATE OF GOOD STANDING';
      const gsBody = [
        `This is to certify that ${subjectPerson.fullName} (Member No. ${subjectPerson.memberNumber}) is a registered shareholder and member of CRESTED SS INVESTMENT CLUB LTD in good standing.`,
        `As at the date of this letter, the above-named is current on all membership obligations and holds ${subjectPerson.totalShares} shares in the Club, with savings of UGX ${subjectPerson.savings.toLocaleString()}.`
      ];
      if (!subjectPerson.hasActiveLoan) gsBody.push(`The above-named has no outstanding loans with the Club.`);
      gsBody.push(`This certificate is issued upon request and remains valid as at the date of issue.`);
      body = gsBody;
    }
  }

  return {
    type, referenceNumber: await nextRefNumber(type), date: new Date(),
    recipient: {
      name: payload.recipient?.name || '', title: payload.recipient?.title || '',
      organization: payload.recipient?.organization || '', address: payload.recipient?.address || '',
      salutation: payload.recipient?.salutation || 'Dear Sir/Madam'
    },
    subject, body,
    leaderId: leaderId || null, memberId: memberId || null,
    subjectPerson, cardDetails: {},
    signatories: (payload.signatories && payload.signatories.length) ? payload.signatories : ['president', 'secretary'],
    createdBy: payload.createdBy || 'admin', notes: payload.notes || ''
  };
}

// ==================== CARD CONTENT ====================
async function buildCardContent(payload) {
  const { type, memberId, cardDetails, subject } = payload;
  let member = null;
  if (memberId) { try { member = await Member.findById(memberId); } catch {} }

  const subjectPerson = {};
  if (member) {
    subjectPerson.fullName = `${member.firstName} ${member.surname}`;
    subjectPerson.memberNumber = member.memberNumber;
    subjectPerson.membershipSince = member.dateOfSubscription;
    subjectPerson.savings = Number(member.savings) || 0;
    subjectPerson.totalShares = computeTotalShares(member);
  }

  const details = { ...(cardDetails || {}) };

  // Auto-fill deceased name & photo from member if club lost member and not typed
  if (type === 'condolence' && details.condolenceCase !== 'member_lost_loved_one' && member) {
    if (!details.deceasedName) details.deceasedName = `${member.firstName} ${member.surname}`;
    if (!details.deceasedPhoto && member.photo) details.deceasedPhoto = member.photo;
  }

  // Auto-fill couple names if member linked and field empty
  if ((type === 'wedding' || type === 'introduction') && member) {
    const fullName = `${member.firstName} ${member.surname}`;
    if (!details.groomName && !details.brideName) {
      // can't tell which one — leave to user
    }
  }

  // Auto-fill candidate name/photo from member for success
  if (type === 'success' && member) {
    if (!details.candidateName) details.candidateName = `${member.firstName} ${member.surname}`;
    if (!details.candidatePhoto && member.photo) details.candidatePhoto = member.photo;
  }

  // Build default message if none provided
  if (!details.message || !details.message.trim()) {
    details.message = buildDefaultCardMessage(type, details, member);
  }

  return {
    type, referenceNumber: await nextRefNumber(type), date: new Date(),
    recipient: payload.recipient || {},
    subject: subject || type.toUpperCase(),
    body: [],
    memberId: memberId || null,
    subjectPerson,
    cardDetails: details,
    signatories: (payload.signatories && payload.signatories.length) ? payload.signatories : ['president', 'secretary'],
    createdBy: payload.createdBy || 'admin', notes: payload.notes || ''
  };
}

// ==================== CREATE / LIST / GET / DELETE ====================
exports.createLetter = async (req, res) => {
  try {
    if (!req.body?.type) return res.status(400).json({ error: 'type is required' });
    const isCard = CARD_TYPES.includes(req.body.type);
    const content = isCard ? await buildCardContent(req.body) : await buildLetterContent(req.body);
    if (!content.subject) return res.status(400).json({ error: 'subject is required' });
    const letter = await Letter.create(content);
    res.status(201).json(letter);
  } catch (err) {
    console.error('createLetter:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listLetters = async (req, res) => {
  try {
    const { type, search, mode } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (mode === 'letters') filter.type = { $in: ['appointment', 'recommendation', 'good_standing', 'general'] };
    if (mode === 'cards') filter.type = { $in: CARD_TYPES };
    if (search) {
      filter.$or = [
        { referenceNumber: new RegExp(search, 'i') },
        { subject: new RegExp(search, 'i') },
        { 'subjectPerson.fullName': new RegExp(search, 'i') },
        { 'cardDetails.deceasedName': new RegExp(search, 'i') },
        { 'cardDetails.candidateName': new RegExp(search, 'i') }
      ];
    }
    const letters = await Letter.find(filter).sort('-createdAt').limit(200);
    res.json({ letters, total: letters.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLetter = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Not found' });
    res.json(letter);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteLetter = async (req, res) => {
  try {
    const letter = await Letter.findByIdAndDelete(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', referenceNumber: letter.referenceNumber });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.letterPDF = async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Not found' });
    const requestedSigs = req.query.signatories
      ? req.query.signatories.split(',').filter(Boolean)
      : (letter.signatories || []);
    if (CARD_TYPES.includes(letter.type)) {
      await generateCardPDF(letter, res, requestedSigs);
    } else {
      await generateLetterPDF(letter, res, requestedSigs);
    }
  } catch (err) {
    console.error('letterPDF:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

exports.getLetterOptions = async (req, res) => {
  try {
    const [leaders, members] = await Promise.all([
      Leader.find({ active: { $ne: false } }).select('name role memberNumber active').sort('order name'),
      Member.find({ active: { $ne: false } })
        .select('firstName surname memberNumber shares savings activeLoanId dateOfSubscription contact email address photo active')
        .sort('memberNumber')
    ]);

    const memberNumbers = leaders.map(l => l.memberNumber).filter(Boolean);
    const linkedMembers = memberNumbers.length
      ? await Member.find({ memberNumber: { $in: memberNumbers } }).select('memberNumber address contact email photo')
      : [];
    const infoMap = {};
    linkedMembers.forEach(m => {
      infoMap[m.memberNumber] = {
        address: m.address || '', contact: m.contact || '',
        email: m.email || '', photo: m.photo || ''
      };
    });

    res.json({
      leaders: leaders.map(l => ({
        _id: l._id, name: l.name, role: l.role, memberNumber: l.memberNumber || '',
        address: infoMap[l.memberNumber]?.address || '',
        contact: infoMap[l.memberNumber]?.contact || '',
        email: infoMap[l.memberNumber]?.email || '',
        photo: infoMap[l.memberNumber]?.photo || '',
        active: l.active !== false
      })),
      members: members.map(m => ({
        _id: m._id,
        name: `${m.firstName} ${m.surname}`,
        memberNumber: m.memberNumber,
        totalShares: computeTotalShares(m),
        savings: Number(m.savings) || 0,
        hasActiveLoan: !!m.activeLoanId,
        membershipSince: m.dateOfSubscription,
        address: m.address || '', contact: m.contact || '', email: m.email || '',
        photo: m.photo || ''
      }))
    });
  } catch (err) {
    console.error('getLetterOptions:', err.message);
    res.status(500).json({ error: err.message });
  }
};