/* ================================================================
   CHAT GUMI IA — GitHub Pages V2 (todo en el navegador, localStorage)
   Creado por k4927789-wq
   Arreglado: key correcta (Gumi) + historial de conversación
   ================================================================ */

/* ===== CADA IA CON SU PROPIA API, SUS RUTAS Y SU KEY ===== */
const AI_MODELS = {
  gemini: {
    name: 'Gemini',
    key: 'Gumi',
    urls: [
      'https://api.stellarwa.xyz/ai/gemini'
    ]
  },
  chatgpt: {
    name: 'ChatGPT',
    key: 'Gumi',
    urls: [
      'https://api.stellarwa.xyz/ai/chatgpt',
      'https://api.stellarwa.xyz/ai/gpt'
    ]
  },
  copilot: {
    name: 'Copilot',
    key: 'Gumi',
    urls: [
      'https://api.stellarwa.xyz/ai/copilot',
      'https://api.stellarwa.xyz/ai/chatgpt'
    ]
  }
};

const AVATAR = 'https://inmiku.infinityfreeapp.com/u/ImMiku_adddca1a.jpg';
const GREETING = "Hola, soy Gumi ♪ ¿En qué te ayudo hoy?";
const MAX_HISTORY_MSGS = 12;

let currentUser = null;
let model = 'gemini';
let history = [];
let pendingAttach = null;
let modalImageData = null;
let modalViewOnly = false;
let busy = false;
let pendingAvatar = null;

const $ = id => document.getElementById(id);

/* ================= LOGIN (localStorage) ================= */
function getUsers(){ return JSON.parse(localStorage.getItem('gumi_users') || '{}'); }
function saveUsers(u){ localStorage.setItem('gumi_users', JSON.stringify(u)); }
function getAvatars(){ return JSON.parse(localStorage.getItem('gumi_avatars') || '{}'); }
function saveAvatars(a){ localStorage.setItem('gumi_avatars', JSON.stringify(a)); }
function myAvatar(){ return currentUser ? (getAvatars()[currentUser] || null) : null; }
function chatKey(){ return 'gumi_chat_' + currentUser; }

function pickLoginAvatar(){ $('avatarPicker').click(); }
$('avatarPicker').addEventListener('change', async e => {
  const f = e.target.files[0];
  if(!f) return;
  if(f.size > 2 * 1024 * 1024){ toast('Foto muy grande (máx 2MB)'); e.target.value=''; return; }
  pendingAvatar = await fileToDataURL(f);
  $('avatarPreview').src = pendingAvatar;
  e.target.value = '';
});

function doLogin(){
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;
  if(!u || !p){ $('loginMsg').textContent = '⚠️ Completa usuario y contraseña'; return; }
  const users = getUsers();
  if(!users[u]){
    users[u] = p; saveUsers(users);
    $('loginMsg').textContent = '✨ Cuenta creada, bienvenido ' + u;
  } else if(users[u] !== p){
    $('loginMsg').textContent = '❌ Contraseña incorrecta'; return;
  }
  currentUser = u;
  sessionStorage.setItem('gumi_session', u);
  if(pendingAvatar){
    const av = getAvatars(); av[u] = pendingAvatar; saveAvatars(av);
    pendingAvatar = null;
  }
  sessionStorage.setItem('gumi_session', u);
  enterApp();
}

function changeAvatar(){ if(!currentUser){ toast('Inicia sesión primero'); return; } $('avatarChangePicker').click(); }
$('avatarChangePicker').addEventListener('change', async e => {
  const f = e.target.files[0];
  if(!f) return;
  if(f.size > 2 * 1024 * 1024){ toast('Foto muy grande (máx 2MB)'); e.target.value=''; return; }
  const data = await fileToDataURL(f);
  const av = getAvatars(); av[currentUser] = data; saveAvatars(av);
  $('badgeAvatar').src = data;
  $('chatBox').innerHTML = '';
  history.forEach(m => renderMsg(m));
  scrollDown();
  toast('Foto de perfil actualizada ♪');
  e.target.value = '';
});

function logout(){
  sessionStorage.removeItem('gumi_session');
  currentUser = null; history = []; pendingAvatar = null;
  $('badgeAvatar').src = AVATAR;
  $('badgeName').textContent = 'invitado';
  $('chatBox').innerHTML = '';
  $('loginScreen').classList.remove('hidden');
  $('loginMsg').textContent = '';
  $('avatarPreview').src = AVATAR;
  renderMsg({ role:'ai', text:GREETING, time:new Date().toLocaleString() });
}
function enterApp(){
  const av = myAvatar();
  if(av) $('badgeAvatar').src = av;
  $('badgeName').textContent = currentUser;
  $('loginScreen').classList.add('hidden');
  loadHistory();
  $('msgInput').focus();
}
function loadHistory(){
  history = JSON.parse(localStorage.getItem(chatKey()) || 'null') || [];
  $('chatBox').innerHTML = '';
  if(history.length === 0){
    history.push({ role:'ai', text:GREETING, time:new Date().toLocaleString() });
  }
  history.forEach(m => renderMsg(m));
  scrollDown();
  persist();
}
function persist(){
  localStorage.setItem(chatKey(), JSON.stringify(history.slice(-300)));
}

/* ================= RENDER ================= */
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderMsg(m){
  const box = $('chatBox');
  const div = document.createElement('div');
  div.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
  let inner;
  if(m.role === 'ai'){
    inner = '<img class="avatar" src="' + AVATAR + '">';
  } else {
    const av = (m.user === currentUser) ? myAvatar() : (m.userAvatar || null);
    inner = av
      ? '<img class="avatar" src="' + av + '" style="border-color:var(--orange)">'
      : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;background:var(--card2);border-color:var(--orange);font-size:1rem">👤</div>';
  }
  inner += '<div class="bubble"><div class="meta">' + (m.role === 'ai' ? '♪ Gumi' : 'Tú') + ' · ' + (m.time || '') + '</div>';
  if(m.text) inner += '<div>' + escapeHtml(m.text) + '</div>';
  if(m.image) inner += '<img src="' + m.image + '"' + (m.role === 'user' ? ' class="clickable" onclick="viewImage(this.src)"' : '') + '>';
  if(m.file && !m.image){
    if(m.fileType && m.fileType.indexOf('video/') === 0) inner += '<video controls src="' + m.file + '"></video>';
    else inner += '<a class="filechip" href="' + m.file + '" download="' + (m.fileName || 'archivo') + '">📄 ' + escapeHtml(m.fileName || 'archivo') + ' (descargar)</a>';
  }
  if(m.role === 'ai' && m.text){
    const codes = [...m.text.matchAll(/```(\w*)\n?([\s\S]*?)```/g)];
    if(codes.length){
      inner += '<div class="dl">';
      codes.forEach((c, i) => {
        inner += '<button onclick="downloadText(\'gumi_code_' + i + '.txt\', ' + JSON.stringify(c[2]) + ')">⬇ Código ' + (i + 1) + '</button>';
      });
      inner += '</div>';
    }
  }
  inner += '</div>';
  div.innerHTML = inner;
  box.appendChild(div);
}
function addMsg(role, text, opts){
  const m = Object.assign({ role, text: text || '', time: new Date().toLocaleString() }, opts || {});
  history.push(m); persist(); renderMsg(m); scrollDown();
  return m;
}
function scrollDown(){ const b = $('chatBox'); b.scrollTop = b.scrollHeight; }
function showTyping(){
  const d = document.createElement('div');
  d.className = 'msg ai'; d.id = 'typing';
  d.innerHTML = '<img class="avatar" src="' + AVATAR + '"><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>';
  $('chatBox').appendChild(d); scrollDown();
}
function hideTyping(){ const t = $('typing'); if(t) t.remove(); }
function toast(msg){
  const t = $('toast'); t.textContent = msg;
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
}

/* ================================================================
   IA — key correcta (proyectsV2) + historial de conversación
   ================================================================ */
function systemPrompt(){
  return 'Eres Gumi, una chica cantante de Vocaloid muy alegre, amable y serviable. ' +
    'Preséntate con "Hola, soy Gumi ¿en qué te ayudo?" cuando saluden. ' +
    'Responde SIEMPRE como ella, dulce y con emojis musicales a veces (♪ 🎵 🎶). ' +
    'Si te piden código, entrégalo en bloques ```código```. ' +
    'Responde siempre en español.';
}

/** Incluye los últimos mensajes para que la IA recuerde el contexto */
function buildPrompt(userText){
  const recent = history.filter(m => m.role === 'user' || m.role === 'ai').slice(-MAX_HISTORY_MSGS);
  let ctx = '/Gumi\n' + systemPrompt() + '\n\n--- Conversación reciente ---\n';
  recent.forEach(m => {
    const who = m.role === 'ai' ? 'Gumi' : 'Usuario';
    let line = who + ': ' + (m.text || '');
    if(m.image) line += ' [envió una imagen]';
    if(m.fileName && !m.image) line += ' [archivo: ' + m.fileName + ']';
    ctx += line + '\n';
  });
  ctx += 'Usuario: ' + userText + '\nGumi:';
  return ctx;
}

function extractReply(raw){
  if(!raw) return null;
  if(typeof raw === 'string'){
    const t = raw.trim();
    if(!t) return null;
    if(t[0] === '{' || t[0] === '['){
      try{ return extractReply(JSON.parse(t)); }catch(e){ return t; }
    }
    return t;
  }
  if(typeof raw === 'object'){
    if(raw.status === false) return null;
    return raw.response || raw.result || raw.answer || raw.message ||
           raw.data || raw.text || raw.reply || raw.output ||
           (raw.data && (raw.data.result || raw.data.response)) || null;
  }
  return null;
}

async function tryRequest(url, method, fields){
  try{
    let res;
    if(method === 'POST'){
      const body = new URLSearchParams();
      for(const k in fields) body.append(k, fields[k]);
      const sep = url.indexOf('?') >= 0 ? '&' : '?';
      res = await fetch(url + sep + 'key=' + encodeURIComponent(fields.key || ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
    } else {
      const qs = new URLSearchParams(fields).toString();
      const sep = url.indexOf('?') >= 0 ? '&' : '?';
      res = await fetch(url + sep + qs);
    }
    if(!res.ok) return null;
    const txt = await res.text();
    if(!txt) return null;
    try{
      const parsed = extractReply(JSON.parse(txt));
      if(parsed) return String(parsed);
    }catch(e){ /* texto plano */ }
    if(txt.length > 0 && txt.length < 20000 && txt.indexOf('"status":false') < 0) return txt;
    return null;
  }catch(e){ return null; }
}

async function callAI(prompt, imageData){
  const cfg = AI_MODELS[model];
  const paramNames = ['text', 'q', 'prompt', 'message'];

  for(const baseUrl of cfg.urls){
    // Key SIEMPRE en la query: ?key=proyectsV2 (así funciona stellarwa)
    const url = baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(cfg.key);
    for(const pname of paramNames){
      const fields = {};
      fields[pname] = prompt;
      if(imageData) fields.image = imageData;
      let r = await tryRequest(url, 'GET', fields);
      if(r) return r;
      r = await tryRequest(url, 'POST', Object.assign({ key: cfg.key }, fields));
      if(r) return r;
    }
  }
  throw new Error('ninguna forma de llamar a ' + cfg.name + ' funcionó (¿la API está caída o la key cambió?)');
}

async function askGumi(userText, imageData){
  showTyping();
  try{
    const prompt = buildPrompt(userText);
    const reply = await callAI(prompt, imageData);
    hideTyping();
    addMsg('ai', reply);
  }catch(e){
    hideTyping();
    addMsg('ai', '¡Uy! No pude conectarme con ' + AI_MODELS[model].name +
      ' ♪ Intenta de nuevo o toca el botón 🔌 para probar la conexión. (' + e.message + ')');
  }
}

async function testAI(){
  const cfg = AI_MODELS[model];
  toast('Probando conexión con ' + cfg.name + '...');
  const start = Date.now();
  try{
    await callAI('Responde solo: conexión OK');
    toast('✅ ' + cfg.name + ' responde en ' + ((Date.now()-start)/1000).toFixed(1) + 's');
  }catch(e){
    toast('❌ ' + cfg.name + ' no responde: ' + e.message);
  }
}

/* ================= ENVÍO DE MENSAJES ================= */
async function sendMsg(){
  const input = $('msgInput');
  const text = input.value.trim();
  if(!text && !pendingAttach) return;
  if(busy){ toast('Espera la respuesta de Gumi...'); return; }
  busy = true; $('sendBtn').disabled = true;

  let promptText = text;
  const m = { role:'user', text, time: new Date().toLocaleString(), user: currentUser, userAvatar: myAvatar() };
  let imgForAI = null;
  if(pendingAttach){
    m.file = pendingAttach.data;
    m.fileName = pendingAttach.name;
    m.fileType = pendingAttach.type;
    if(pendingAttach.type.indexOf('image/') === 0){
      m.image = pendingAttach.data;
      imgForAI = pendingAttach.data;
    }
    promptText = (text ? text + '\n' : '') + '[Archivo adjunto del usuario: ' + pendingAttach.name + ']';
    if(pendingAttach.type.indexOf('image/') === 0) promptText += ' Analiza esta imagen con detalle.';
    else if(pendingAttach.type.indexOf('text/') === 0 || /\.(txt|md|json|csv|js|py|html|css|xml|log)$/i.test(pendingAttach.name)){
      try{
        const base64 = pendingAttach.data.split(',')[1] || '';
        const decoded = atob(base64);
        if(decoded.length < 8000) promptText += '\nContenido del archivo:\n' + decoded.slice(0, 6000);
      }catch(e){}
    }
    pendingAttach = null;
    $('attachList').innerHTML = '';
  }
  history.push(m); persist(); renderMsg(m); scrollDown();
  input.value = '';
  await askGumi(promptText, imgForAI);
  busy = false; $('sendBtn').disabled = false; input.focus();
}

/* ================= IMÁGENES ================= */
function fileToDataURL(f){
  return new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = err;
    r.readAsDataURL(f);
  });
}
function pickImage(){ $('imgPicker').click(); }
function pickFile(){ $('filePicker').click(); }

$('imgPicker').addEventListener('change', async e => {
  const f = e.target.files[0];
  if(!f) return;
  modalImageData = await fileToDataURL(f);
  modalViewOnly = false;
  $('modalRow').style.display = 'flex';
  $('modalImg').src = modalImageData;
  $('modalText').value = '';
  $('imgModal').classList.remove('hidden');
  e.target.value = '';
});
$('filePicker').addEventListener('change', async e => {
  const f = e.target.files[0];
  if(!f) return;
  if(f.size > 4 * 1024 * 1024){ toast('Archivo muy grande (máx 4MB)'); e.target.value = ''; return; }
  pendingAttach = { data: await fileToDataURL(f), name: f.name, type: f.type };
  $('attachList').innerHTML =
    '<span class="filechip" style="font-size:.8rem">📎 ' + escapeHtml(f.name) +
    ' <b style="cursor:pointer" onclick="pendingAttach=null;this.parentElement.remove()">✕</b></span>';
  e.target.value = '';
});

function viewImage(src){
  $('modalImg').src = src;
  $('modalText').value = '';
  modalImageData = null;
  modalViewOnly = true;
  $('modalRow').style.display = 'none';
  $('imgModal').classList.remove('hidden');
}
function closeModal(){
  $('imgModal').classList.add('hidden');
  modalImageData = null; modalViewOnly = false;
  $('modalRow').style.display = 'flex';
}
$('imgModal').addEventListener('click', e => { if(e.target.id === 'imgModal') closeModal(); });

async function sendModalImage(){
  if(modalViewOnly || !modalImageData){ closeModal(); return; }
  if(busy){ toast('Espera la respuesta de Gumi...'); return; }
  busy = true; $('sendBtn').disabled = true;
  const text = $('modalText').value.trim() || '¿Qué ves en esta imagen?';
  const imgData = modalImageData;
  closeModal();
  const m = { role:'user', text, image: imgData, time: new Date().toLocaleString(), user: currentUser, userAvatar: myAvatar() };
  history.push(m); persist(); renderMsg(m); scrollDown();
  await askGumi(text + '\n[El usuario adjuntó una imagen para que la analices.]', imgData);
  busy = false; $('sendBtn').disabled = false;
}

/* ================= UTILIDADES ================= */
function clearChat(){
  if(!currentUser){ toast('Inicia sesión primero'); return; }
  if(!confirm('¿Borrar toda la conversación?')) return;
  history = [{ role:'ai', text:GREETING, time:new Date().toLocaleString() }];
  persist();
  $('chatBox').innerHTML = '';
  renderMsg(history[0]); scrollDown();
}
function downloadChat(){
  if(!history.length){ toast('No hay mensajes aún'); return; }
  const lines = history.map(m =>
    '[' + (m.time || '') + '] ' + (m.role === 'ai' ? '♪ Gumi' : 'Tú') + ': ' + (m.text || '') +
    (m.fileName ? ' [archivo: ' + m.fileName + ']' : ''));
  downloadText('chat_gumi_' + (currentUser || 'invitado') + '_' + Date.now() + '.txt', lines.join('\n\n'));
  toast('Chat descargado ⬇');
}
function downloadText(name, content){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type:'text/plain' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('modelSel').addEventListener('change', e => {
  model = e.target.value;
  $('modelName').textContent = AI_MODELS[model].name;
  toast('IA cambiada a ' + AI_MODELS[model].name + ' ♪');
});

/* ================= ARRANQUE ================= */
(function(){
  $('avatarPreview').src = AVATAR;
  const s = sessionStorage.getItem('gumi_session');
  if(s && getUsers()[s]){ currentUser = s; enterApp(); }
  else{
    renderMsg({ role:'ai', text:GREETING, time:new Date().toLocaleString() });
  }
})();
