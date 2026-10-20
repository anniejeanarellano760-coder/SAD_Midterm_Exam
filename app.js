const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sb2 = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false, storageKey:'sb-signup'}});
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => new Date(d).toLocaleString('en-PH', {timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short'});
const opts = (arr, cur) => arr.map(v => `<option ${String(v) === String(cur) ? 'selected' : ''}>${esc(v)}</option>`).join('');
const badge = (t, empty) => t ? `<span class="b ${t.replace(/\W/g, '')}">${esc(t)}</span>` : `<span class="b">${empty}</span>`;
const YEARS = ['2026-2027', '2025-2026'];
let me, programs = [], D = {}, sel = {ay:'2026-2027', sem:'1'}, F = {q:'', fp:'All', fc:'All'}, tab = 'dash', openId = null, editId = null;

const IC = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const EYE = IC('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>');
const EYEOFF = IC('<path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M1 1l22 22"/>');
const NAV = {
  scholar:[['home','Overview',IC('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>')],['submit','Submit grades',IC('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>')],['mine','My submissions',IC('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>')],['access','Access check',IC('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>')]],
  staff:[['dash','Dashboard',IC('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>')],['sch','Scholars',IC('<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>')],['sub','Submissions',IC('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h6"/>')]]};
const shell = (items, cur, go) => {
  const ini = esc(me.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)), staff = me.role === 'staff';
  $('#app').innerHTML = `<div class="shell"><nav class="side" aria-label="Main"><div class="usr"><span class="av">${ini}</span><div><b>${esc(me.full_name)}</b><small>${staff ? 'Scholarship Office' : esc(me.student_id || 'Scholar')}</small></div></div><span class="lbl">${staff ? 'Staff menu' : 'Scholar menu'}</span>${items.map(([k, l, ic]) => `<button data-t="${k}" class="${k === cur ? 'on' : ''}">${ic}<span>${l}</span></button>`).join('')}<button class="so" id="so">${IC('<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>')}<span>Sign out</span></button></nav><section id="pane"></section></div>`;
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => go(b.dataset.t));
  $('#so').onclick = () => $('#out').click();
};
const mark = t => document.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
let mt;
function msg(t, ok) { const m = $('#msg'); clearTimeout(mt); m.textContent = t || ''; m.className = ok ? 'ok' : 'err'; m.hidden = !t; if (t && ok) mt = setTimeout(() => m.hidden = true, 5000); }

// ---------- auth ----------
function showLogin(e) {
  $('#who').textContent = ''; $('#out').hidden = true;
  $('#app').innerHTML = `<div class="login"><aside><div><h2>Keep your scholarship in good standing</h2><p>Submit your semester grades, follow their verification, and see your renewal decision in one place.</p></div><dl><dt>Scholars</dt><dd>Submit grades and track every semester.</dd><dt>Staff</dt><dd>Verify evidence, check compliance and decide renewals.</dd></dl></aside><form id="lf"><h2>Sign in</h2><p class="sub">Use the account issued by the Scholarship Office.</p><label>Email<input id="em" type="email" autocomplete="username" required></label><label>Password<div class="pw"><input id="pw" type="password" autocomplete="current-password" required><button type="button" id="eye" aria-label="Show password" aria-pressed="false">${EYE}</button></div></label><button class="pri" style="width:100%">Sign in</button></form></div>`;
  $('#eye').onclick = () => { const i = $('#pw'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#eye').innerHTML = show ? EYEOFF : EYE; $('#eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password'); $('#eye').setAttribute('aria-pressed', String(show)); };
  msg(e);
  $('#lf').onsubmit = async ev => {
    ev.preventDefault();
    const {error} = await sb.auth.signInWithPassword({email:$('#em').value, password:$('#pw').value});
    if (error) return msg('Sign in failed: ' + error.message);
    msg(''); init();
  };
}
$('#out').onclick = async () => { await sb.auth.signOut(); showLogin(); };

async function init() {
  const {data:{session}} = await sb.auth.getSession();
  if (!session) return showLogin();
  const {data:p, error} = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (error) return showLogin('Could not load your profile: ' + error.message);
  me = p;
  programs = (await sb.from('programs').select('*').order('name')).data || [];
  $('#who').innerHTML = `<span class="chip role-${me.role}">${me.role === 'staff' ? 'Staff' : 'Scholar'}</span>`; $('#out').hidden = false;
  me.role === 'staff' ? staffView() : scholarView();
}

// ---------- scholar ----------
function readForm() {
  const v = id => $('#' + id).value.trim(), e = [], n = {};
  const gwa = Number(v('gwa'));
  if (!/^\d(\.\d{1,2})?$/.test(v('gwa')) || gwa < 1 || gwa > 5) e.push('GWA must be between 1.00 and 5.00.');
  [['units','Enrolled units'], ['failed','Failed count'], ['inc','Incomplete count'], ['drop','Dropped count']].forEach(([k, l]) => {
    if (!/^\d+$/.test(v(k))) e.push(l + ' must be a whole number, 0 or more.'); else n[k] = Number(v(k));
  });
  if (!v('ref')) e.push('Grade-document reference is required.');
  return {e, row:{gwa, enrolled_units:n.units, failed_count:n.failed, incomplete_count:n.inc, dropped_count:n.drop, evidence_ref:v('ref')}};
}

async function saveSub() {
  const {e, row} = readForm();
  if (e.length) return msg(e.join(' '));
  const r = editId
    ? await sb.from('submissions').update(row).eq('id', editId).select()
    : await sb.from('submissions').insert({...row, scholar_id:me.id, academic_year:$('#ay').value, semester:Number($('#sem').value)}).select();
  if (r.error) return msg(r.error.code === '23505' ? 'You already submitted a summary for this academic year and semester.'
    : r.error.code === '42501' ? 'You are not assigned to a scholarship program yet. Contact the Scholarship Office.' : r.error.message);
  if (editId && !r.data.length) return msg('This submission can no longer be corrected.');
  msg(editId ? 'Correction resubmitted. Status: Pending verification.' : 'Submitted. Status: Pending verification.', true);
  editId = null; await loadScholar(); sShow('mine');
}

let S = {}, stab = 'home';
async function loadScholar() {
  const [a, r] = await Promise.all([
    sb.from('scholar_assignments').select('programs(name)').eq('scholar_id', me.id).maybeSingle(),
    sb.from('submissions').select('*').eq('scholar_id', me.id).order('submitted_at', {ascending:false})]);
  S = {prog:a.data?.programs?.name, sub:r.data || []};
}
function sShow(t) { stab = t; mark(t); ({home:sHome, submit:sSubmit, mine:sMine, access:sAccess})[t](); }
function startEdit(id) { editId = id; sShow('submit'); }
async function scholarView() {
  shell(NAV.scholar, stab, sShow); $('#pane').innerHTML = '<p class="mut">Loading…</p>';
  await loadScholar(); sShow(stab);
}

function sHome() {
  const L = S.sub[0], ret = S.sub.find(r => r.verification_status === 'Returned');
  $('#pane').innerHTML = `<div class="card"><h2>Welcome, ${esc(me.full_name)}</h2><p class="sub">Scholarship program: <b>${esc(S.prog || 'Not assigned yet')}</b></p>
  ${ret ? `<div class="note bad"><span><b>Returned for correction:</b> ${esc(ret.verification_reason)}</span><button class="pri" id="fx">Correct now</button></div>` : ''}
  ${L ? `<h3>Latest submission: ${esc(L.academic_year)} semester ${L.semester}</h3><div class="stats"><div class="st p t"><b>${esc(L.verification_status)}</b>Submission status</div>
  <div class="st c t"><b>${esc(L.compliance_result || 'Not evaluated')}</b>Academic compliance</div><div class="st t"><b>${esc(L.renewal_decision || 'No decision yet')}</b>Renewal decision</div></div>
  <p class="mut">Submitted ${fmt(L.submitted_at)}</p>` : `<p>You have not submitted grades yet.</p><button class="pri" id="go">Submit grades</button>`}</div>`;
  if (ret) $('#fx').onclick = () => startEdit(ret.id);
  if (!L) $('#go').onclick = () => sShow('submit');
}

function sSubmit() {
  const r = editId ? S.sub.find(x => x.id === editId) : null;
  $('#pane').innerHTML = `<div class="card"><h2>${r ? 'Correct and resubmit' : 'Submit semester grades'}</h2><p class="sub">Enter the grades exactly as they appear on your grade document.</p>
  ${r ? `<div class="note bad"><span><b>Returned:</b> ${esc(r.verification_reason)}</span></div>` : ''}${S.prog ? '' : '<div class="note bad">You are not assigned to a scholarship program yet. Contact the Scholarship Office.</div>'}
  <div class="row"><label>Academic year<select id="ay">${opts(YEARS)}</select></label><label>Semester<select id="sem">${opts([1, 2])}</select></label>
  <label>GWA (1.00 best, 5.00 failing)<input id="gwa" inputmode="decimal"></label><label>Enrolled units<input id="units" inputmode="numeric"></label></div>
  <div class="row"><label>Failed subjects<input id="failed" inputmode="numeric" value="0"></label><label>Incomplete grades<input id="inc" inputmode="numeric" value="0"></label>
  <label>Dropped subjects<input id="drop" inputmode="numeric" value="0"></label><label>Grade-document reference<input id="ref" placeholder="e.g. file name or link"></label></div>
  <div class="actions"><button class="pri" id="sv">${r ? 'Resubmit correction' : 'Submit'}</button>${r ? '<button id="cx">Cancel</button>' : ''}</div></div>`;
  $('#sv').onclick = saveSub;
  if (r) {
    $('#ay').value = r.academic_year; $('#sem').value = r.semester; $('#ay').disabled = $('#sem').disabled = true;
    $('#gwa').value = r.gwa; $('#units').value = r.enrolled_units; $('#failed').value = r.failed_count; $('#inc').value = r.incomplete_count; $('#drop').value = r.dropped_count; $('#ref').value = r.evidence_ref;
    $('#cx').onclick = () => { editId = null; sShow('mine'); };
  }
}

function sMine() {
  $('#pane').innerHTML = `<div class="card"><h2>My submissions</h2><p class="sub">Each semester you submitted, with its verification, compliance and renewal status.</p><div class="tw"><table><tr><th>Term</th><th>GWA</th><th>Units</th><th>F / INC / Drop</th><th>Evidence</th><th>Submitted</th><th>Status</th><th>Compliance</th><th>Renewal</th><th></th></tr>
  ${S.sub.map(r => `<tr><td>${esc(r.academic_year)} S${r.semester}</td><td>${Number(r.gwa).toFixed(2)}</td><td>${r.enrolled_units}</td><td>${r.failed_count} / ${r.incomplete_count} / ${r.dropped_count}</td><td>${esc(r.evidence_ref)}</td><td>${fmt(r.submitted_at)}</td>
  <td>${badge(r.verification_status)}${r.verification_reason ? `<div class="fail">Reason: ${esc(r.verification_reason)}</div>` : ''}</td><td>${badge(r.compliance_result, 'Not evaluated')}</td><td>${badge(r.renewal_decision, 'No decision')}</td>
  <td>${r.verification_status === 'Returned' ? `<button data-e="${r.id}">Correct</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="10" class="mut">No submissions yet. Open Submit grades to add one.</td></tr>'}</table></div></div>`;
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => startEdit(b.dataset.e));
}

function sAccess() {
  $('#pane').innerHTML = `<div class="card"><h2>Access check</h2><p class="mut">Tries actions the database must deny for a scholar. Use it as role-isolation evidence (TC08).</p><div class="actions"><button id="t1">Read other scholars' records</button><button id="t2">Verify a submission</button></div><p id="tr"></p></div>`;
  $('#t1').onclick = async () => { const r = await sb.from('submissions').select('id').neq('scholar_id', me.id); $('#tr').textContent = r.error ? 'Denied: ' + r.error.message : `Returned ${r.data.length} other scholar records. Expected 0.`; };
  $('#t2').onclick = async () => { const r = await sb.from('submissions').update({verification_status:'Verified'}).neq('scholar_id', me.id).select(); const own = await sb.from('submissions').update({verification_status:'Verified'}).eq('scholar_id', me.id).select();
    $('#tr').textContent = (r.error || own.error) ? 'Denied: ' + (r.error || own.error).message : `Verification changed ${r.data.length + own.data.length} rows. Expected 0 (denied by the database).`; };
}

// ---------- staff ----------
async function loadStaff() {
  const [p, a, s] = await Promise.all([
    sb.from('profiles').select('*').eq('role', 'scholar').order('student_id'),
    sb.from('scholar_assignments').select('*, programs(*)'),
    sb.from('submissions').select('*, profiles(student_id, full_name)').order('submitted_at')]);
  D = {sch:p.data || [], asg:Object.fromEntries((a.data || []).map(x => [x.scholar_id, x])), sub:s.data || []};
}

async function staffView() {
  shell(NAV.staff, tab, show); $('#pane').innerHTML = '<p class="mut">Loading…</p>';
  await loadStaff(); show(tab);
}

function show(t) { tab = t; openId = null; mark(t); ({dash, sch:scholars, sub:subs})[t](); }

const termSel = () => `<label>Academic year<select id="ay">${opts(YEARS, sel.ay)}</select></label><label>Semester<select id="sem">${opts([1, 2], sel.sem)}</select></label>`;
const termBind = fn => { $('#ay').onchange = e => { sel.ay = e.target.value; fn(); }; $('#sem').onchange = e => { sel.sem = e.target.value; fn(); }; };
const inTerm = s => s.academic_year === sel.ay && String(s.semester) === String(sel.sem);

function dash() {
  const rows = D.sub.filter(inTerm), c = f => rows.filter(f).length;
  const pend = '<h3>Waiting for verification</h3>' + (rows.filter(s => s.verification_status === 'Pending').map(s => `<p class="qrow"><span><b>${esc(s.profiles?.student_id)}</b> ${esc(s.profiles?.full_name)} <span class="mut">submitted ${fmt(s.submitted_at)}</span></span><button data-q="${s.id}">Review</button></p>`).join('') || '<p class="mut">Nothing is waiting for verification in this semester.</p>');
  $('#pane').innerHTML = `<div class="card"><h2>Dashboard</h2><p class="sub">Verification and compliance progress for the selected semester.</p><div class="row">${termSel()}</div><div class="stats">
  <div class="st"><b>${Object.keys(D.asg).length}</b>Assigned scholars</div><div class="st p"><b>${c(s => s.verification_status === 'Pending')}</b>Pending verification</div>
  <div class="st c"><b>${c(s => s.compliance_result === 'Compliant')}</b>Compliant</div><div class="st d"><b>${c(s => s.compliance_result === 'With Deficiency')}</b>With deficiency</div></div>${pend}</div>`;
  termBind(dash);
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { show('sub'); openSub(b.dataset.q); });
}

function scholars() {
  $('#pane').innerHTML = `<div class="card"><h2>Scholars</h2><p class="mut">Register a new scholar, or update a student ID, name or program in the list below.</p>
  <h3>Register scholar</h3><div class="row"><label>Full name<input id="an" autocomplete="off"></label><label>Student ID<input id="as" autocomplete="off"></label><label>Email<input id="ae" type="email" autocomplete="off"></label><label>Temporary password<input id="ap" autocomplete="off" placeholder="At least 6 characters"></label>
  <label>Program<select id="ag"><option value="">Select a program</option>${programs.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label></div><div class="actions" style="margin-top:0"><button class="pri" id="add">Register</button></div>
  <h3>Registered scholars</h3>
  <div class="tw"><table><tr><th>Account</th><th>Student ID</th><th>Name</th><th>Program</th><th></th></tr>
  ${D.sch.map(p => `<tr data-id="${p.id}"><td class="mut">${p.id.slice(0, 8)}</td><td><input class="sid" value="${esc(p.student_id)}"></td><td><input class="nm" value="${esc(p.full_name)}"></td>
  <td><select class="pg"><option value="">Not assigned</option>${programs.map(g => `<option value="${g.id}" ${D.asg[p.id]?.program_id === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></td><td><button class="sv">Save</button></td></tr>`).join('')}</table></div></div>`;
  $('#add').onclick = async () => {
    const name = $('#an').value.trim(), sid = $('#as').value.trim(), em = $('#ae').value.trim(), pw = $('#ap').value, pg = $('#ag').value;
    if (!name || !sid || !em || !pg) return msg('Enter the name, student ID, email and program.');
    if (pw.length < 6) return msg('The temporary password needs at least 6 characters.');
    if (D.sch.some(p => p.student_id === sid)) return msg('That student ID is already used.');
    $('#add').disabled = true;
    const {data, error} = await sb2.auth.signUp({email:em, password:pw, options:{data:{full_name:name}}});
    if (error || !data.user || data.user.identities?.length === 0) { $('#add').disabled = false; return msg(error ? error.message : 'That email is already registered.'); }
    const id = data.user.id;
    let r = await sb.from('profiles').update({student_id:sid, full_name:name}).eq('id', id).select();
    if (!r.error && r.data.length) r = await sb.from('scholar_assignments').upsert({scholar_id:id, program_id:pg}, {onConflict:'scholar_id'});
    await loadStaff();
    if (r.error || (r.data && !r.data.length)) { scholars(); return msg('The login was created but the details were not saved. Finish them in the list below.'); }
    msg('Scholar added. Give the temporary password to the scholar privately.', true); scholars();
  };
  document.querySelectorAll('.sv').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr'), id = tr.dataset.id, name = tr.querySelector('.nm').value.trim(), sid = tr.querySelector('.sid').value.trim(), pg = tr.querySelector('.pg').value;
    if (!name) return msg('Name is required.');
    let r = await sb.from('profiles').update({student_id:sid || null, full_name:name}).eq('id', id).select();
    if (r.error) return msg(r.error.code === '23505' ? 'That student ID is already used.' : r.error.message);
    if (pg) { r = await sb.from('scholar_assignments').upsert({scholar_id:id, program_id:pg}, {onConflict:'scholar_id'}); if (r.error) return msg(r.error.message); }
    msg('Scholar saved.', true); await loadStaff(); scholars();
  });
}

function subs() {
  $('#pane').innerHTML = `<div class="card"><h2>Submissions</h2><p class="sub">Search, filter and open a submission to verify, evaluate and decide renewal.</p><div class="row"><label>Search<input id="q" placeholder="Student ID or name" value="${esc(F.q)}"></label>
  <label>Program<select id="fp">${opts(['All', ...programs.map(p => p.name)], F.fp)}</select></label><label>Compliance<select id="fc">${opts(['All', 'Compliant', 'With Deficiency', 'Not evaluated'], F.fc)}</select></label>${termSel()}</div><div id="lst"></div></div><div id="det"></div>`;
  $('#q').oninput = e => { F.q = e.target.value; list(); }; $('#fp').onchange = e => { F.fp = e.target.value; list(); }; $('#fc').onchange = e => { F.fc = e.target.value; list(); };
  termBind(subs); list();
}

function list() {
  const q = F.q.toLowerCase();
  const rows = D.sub.filter(inTerm).filter(s => (!q || `${s.profiles?.student_id} ${s.profiles?.full_name}`.toLowerCase().includes(q))
    && (F.fp === 'All' || D.asg[s.scholar_id]?.programs?.name === F.fp)
    && (F.fc === 'All' || (F.fc === 'Not evaluated' ? !s.compliance_result : s.compliance_result === F.fc)));
  $('#lst').innerHTML = `<div class="tw"><table><tr><th>ID</th><th>Name</th><th>Program</th><th>GWA</th><th>Submitted</th><th>Status</th><th>Compliance</th><th>Renewal</th><th></th></tr>
  ${rows.map(s => `<tr><td>${esc(s.profiles?.student_id)}</td><td>${esc(s.profiles?.full_name)}</td><td>${esc(D.asg[s.scholar_id]?.programs?.name)}</td><td>${Number(s.gwa).toFixed(2)}</td><td>${fmt(s.submitted_at)}</td>
  <td>${badge(s.verification_status)}</td><td>${badge(s.compliance_result, 'Not evaluated')}</td><td>${badge(s.renewal_decision, 'No decision')}</td><td><button data-o="${s.id}">Open</button></td></tr>`).join('') || '<tr><td colspan="9" class="mut">No submissions match these filters.</td></tr>'}</table></div>`;
  document.querySelectorAll('[data-o]').forEach(b => b.onclick = () => openSub(b.dataset.o));
}

// Thresholds come from the program record (database), not from this code.
function evaluate(s, p) {
  const late = new Date(s.submitted_at) > new Date(p.deadline), g = Number(s.gwa).toFixed(2), mg = Number(p.max_gwa).toFixed(2);
  const c = [
    [!!s.evidence_ref, `Grade-document reference present`, `Grade-document reference is missing`],
    [Number(s.gwa) <= Number(p.max_gwa), `GWA ${g} (maximum ${mg})`, `GWA ${g} is above the maximum of ${mg}`],
    [s.enrolled_units >= p.min_units, `Enrolled units ${s.enrolled_units} (minimum ${p.min_units})`, `Enrolled units ${s.enrolled_units} are below the minimum of ${p.min_units}`],
    [s.failed_count <= p.max_failed, `Failed subjects ${s.failed_count} (allowed ${p.max_failed})`, `${s.failed_count} failed subject(s); allowed ${p.max_failed}`],
    [s.incomplete_count <= p.max_incomplete, `Incomplete grades ${s.incomplete_count} (allowed ${p.max_incomplete})`, `${s.incomplete_count} incomplete grade(s); allowed ${p.max_incomplete}`],
    [s.dropped_count <= p.max_dropped, `Dropped subjects ${s.dropped_count} (allowed ${p.max_dropped})`, `${s.dropped_count} dropped subject(s); allowed ${p.max_dropped}`],
    [!late, `Submitted ${fmt(s.submitted_at)} (deadline ${fmt(p.deadline)})`, `Submitted late: ${fmt(s.submitted_at)} is after the deadline ${fmt(p.deadline)}`]];
  const reasons = c.filter(x => !x[0]).map(x => x[2]);
  return {c, reasons, result:reasons.length ? 'With Deficiency' : 'Compliant'};
}

async function act(patch, ok) {
  const r = await sb.from('submissions').update(patch).eq('id', openId).select();
  if (r.error) return msg(r.error.message);
  if (!r.data.length) return msg('The update was not allowed.');
  const id = openId; msg(ok, true); await loadStaff(); subs(); openSub(id);
}

async function openSub(id) {
  openId = id;
  const s = D.sub.find(x => x.id === id), p = D.asg[s.scholar_id]?.programs, verified = s.verification_status === 'Verified';
  const ev = verified && p ? evaluate(s, p) : null;
  const h = (await sb.from('decision_history').select('*, profiles(full_name)').eq('submission_id', id).order('created_at')).data || [];
  $('#det').innerHTML = `<div class="card"><div class="head"><h2>${esc(s.profiles?.student_id)} ${esc(s.profiles?.full_name)}: ${esc(p?.name || 'No program')}</h2><button id="cl">Close</button></div>
  <p>GWA ${Number(s.gwa).toFixed(2)} | Units ${s.enrolled_units} | Failed ${s.failed_count} | Incomplete ${s.incomplete_count} | Dropped ${s.dropped_count}<br>Evidence: ${esc(s.evidence_ref)} | Submitted ${fmt(s.submitted_at)}</p>
  <h3>1. Verification ${badge(s.verification_status)}</h3>${s.verification_reason ? `<p class="fail">Reason: ${esc(s.verification_reason)}</p>` : ''}
  <label>Reason (required to return)<input id="rs"></label><div class="actions"><button class="pri" id="bv">Mark Verified</button><button id="br">Return for correction</button></div>
  <h3>2. Compliance ${badge(s.compliance_result, 'Not evaluated')}</h3>
  ${ev ? `<ul class="ck">${ev.c.map(x => `<li class="${x[0] ? 'pass' : 'fail'}">${x[0] ? 'Pass' : 'Fail'}: ${esc(x[0] ? x[1] : x[2])}</li>`).join('')}</ul>` : '<p class="mut">Evaluation needs verified evidence and an assigned program.</p>'}
  <div class="actions"><button class="pri" id="be">Evaluate</button></div>
  <h3>3. Renewal ${badge(s.renewal_decision, 'No decision')}</h3>
  <label>Decision note<textarea id="nt" rows="2">${esc(s.decision_note)}</textarea></label><div class="actions"><button class="pri" id="ba">Approve renewal</button><button id="bh">Hold renewal</button></div>
  <h3>History</h3><div class="tw"><table><tr><th>When</th><th>Action</th><th>Change</th><th>Notes</th><th>By</th></tr>${h.map(x => `<tr><td>${fmt(x.created_at)}</td><td>${esc(x.action_type)}</td><td>${esc(x.old_value || 'none')} to ${esc(x.new_value)}</td><td>${esc(x.notes)}</td><td>${esc(x.profiles?.full_name || 'system')}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No changes logged yet.</td></tr>'}</table></div></div>`;
  $('#bv').onclick = () => { if (s.verification_status !== 'Pending') return msg('Only Pending submissions can be marked Verified.'); act({verification_status:'Verified', verification_reason:null}, 'Marked Verified.'); };
  $('#br').onclick = () => { if (s.verification_status === 'Returned') return msg('Already returned. Waiting for the scholar to correct and resubmit.'); const r = $('#rs').value.trim(); if (!r) return msg('Enter a reason to return this submission.');
    act({verification_status:'Returned', verification_reason:r, compliance_result:null, deficiency_reasons:null, renewal_decision:null, decision_note:null}, 'Returned to the scholar for correction.'); };
  $('#be').onclick = () => { if (!verified) return msg('Only verified submissions can be evaluated. Verify the evidence first.');
    if (!p) return msg('Assign a program to this scholar first.');
    const r = evaluate(s, p); act({compliance_result:r.result, deficiency_reasons:r.reasons, ...(s.renewal_decision === 'Approved' && r.result !== 'Compliant' ? {renewal_decision:null, decision_note:null} : {})}, 'Evaluation saved: ' + r.result + '.'); };
  const decide = d => { if (!verified || !s.compliance_result) return msg('Verify and evaluate this submission before recording a renewal decision.');
    if (d === 'Approved' && s.compliance_result !== 'Compliant') return msg('Cannot approve a record With Deficiency. You may hold renewal.');
    act({renewal_decision:d, decision_note:$('#nt').value.trim() || null}, 'Renewal ' + d.toLowerCase() + '.'); };
  $('#ba').onclick = () => decide('Approved'); $('#bh').onclick = () => decide('Held');
  $('#cl').onclick = () => { $('#det').innerHTML = ''; openId = null; };
  $('#det').scrollIntoView({behavior:'smooth'});
}

init();
