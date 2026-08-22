require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');

const CLAVE_IA_PRINCIPAL = process.env.CLAVE_IA_PRINCIPAL;
const CLAVE_IA_RESPALDO = process.env.CLAVE_IA_RESPALDO;
const CLAVE_IA_RESPALDO2 = process.env.CLAVE_IA_RESPALDO2;
const MODELO_PRINCIPAL = 'gemini-3.6-flash';
const MODELO_RESPALDO = 'gemini-3.6-flash';
const MODELO_RESPALDO2 = 'gemini-3.6-flash';
const MODELO_IMAGEN = process.env.MODELO_IMAGEN || 'gemini-3.1-flash-image';
const USAR_AVATAR_IA = process.env.USAR_AVATAR_IA === 'true';
const CODIGO_DUEÑO = '2927760128';
const NOMBRE_BOT = 'Criss Bot';
const CREADOR = 'Albert Oficial';
const VERSION_BOT = '2.03.0';
const TU_NUMERO = '51996399291';
const JID_DUEÑO = `${TU_NUMERO}@s.whatsapp.net`;
const PUERTO = process.env.PORT || 3000;
const LIMITE_DIARIO_ESTIMADO = 1400;
const MAX_TOKENS_RESPUESTA = 1500;

if (!CLAVE_IA_PRINCIPAL) {
  console.log('❌ ALERTA: no se detectó CLAVE_IA_PRINCIPAL en las variables de entorno.');
}
if (!CLAVE_IA_RESPALDO) {
  console.log('⚠️ Aviso: no se detectó CLAVE_IA_RESPALDO (segundo token).');
}
if (!CLAVE_IA_RESPALDO2) {
  console.log('⚠️ Aviso: no se detectó CLAVE_IA_RESPALDO2 (tercer token).');
}

const COMANDOS_RESERVADOS = [
  '/comando', '/porciento', '/shipeo', '/frase', '/ranking', '/asalto',
  '/kick', '/eliminar', '/sacar', '/ban', '/promover', '/degradar',
  '/todos', '/everyone', '/cerrar', '/abrir', '/hablar', '/choro',
  '/meme', '/matrimonio', '/encuesta', '/perfil', '/recordatorio',
  '/info', '/creador', '/reglas', '/reglaspvp', '/recordar', '/olvidarme',
  '/auditoria', '/movimiento'
];

const TEXTO_AYUDA = `📖 *MANUAL DE COMANDOS — ${NOMBRE_BOT}*

━━━━━━━━━━━━━━━━━━
🧠 *INTELIGENCIA ARTIFICIAL*
━━━━━━━━━━━━━━━━━━
▸ /criss <pregunta> — Consulta directa a la IA del bot.
▸ Mencionar al bot — También activa la IA, sin comando.
▸ Citar un mensaje + /criss <pregunta> — La IA lee ese mensaje como contexto.
▸ /recordar — Qué recuerda la IA sobre ti.
▸ /olvidarme — Elimina tu historial guardado.

━━━━━━━━━━━━━━━━━━
🎉 *ENTRETENIMIENTO*
━━━━━━━━━━━━━━━━━━
▸ /porciento <tema> @usuario — Porcentaje aleatorio sobre un tema.
▸ /shipeo @user1 @user2 — Compatibilidad aleatoria entre dos personas.
▸ /matrimonio @user1 @user2 — Certificado de boda grupal, en broma.
▸ /asalto @usuario — Asalto virtual de broma, estilo choro.
▸ /frase — Frase motivacional aleatoria.
▸ /meme — Meme en español.
▸ /perfil @usuario — Actividad del usuario en el grupo.

━━━━━━━━━━━━━━━━━━
🛡️ *MODERACIÓN* (admins)
━━━━━━━━━━━━━━━━━━
▸ /hablar off @usuario — El bot deja de responderle con IA a ese usuario.
▸ /hablar on @usuario — El bot vuelve a responderle con IA.
▸ /choro on — Activa la personalidad choro/callejera en este grupo.
▸ /choro off — Vuelve a la personalidad original.

━━━━━━━━━━━━━━━━━━
👑 *ADMINISTRACIÓN* (admins)
━━━━━━━━━━━━━━━━━━
▸ /kick @usuario — Expulsa a un miembro del grupo.
▸ /promover @usuario — Otorga el rol de administrador.
▸ /degradar @usuario — Retira el rol de administrador.
▸ /todos <mensaje> — Envía un aviso etiquetando a todos.
▸ /cerrar — Solo admins pueden escribir.
▸ /abrir — Todos los miembros pueden escribir.
▸ /encuesta <pregunta>; <opción1>; <opción2> — Crea una encuesta nativa.
▸ /recordatorio <minutos> <mensaje> — Programa un aviso automático.
▸ /ranking — Miembros más activos.
▸ /auditoria <cantidad> — Historial de acciones de admins (alias: /movimiento).

━━━━━━━━━━━━━━━━━━
📋 *INFORMACIÓN*
━━━━━━━━━━━━━━━━━━
▸ /info — Estado y versión actual del bot.
▸ /creador — Quién desarrolló el bot.
▸ /reglas — Reglamento oficial del clan.
▸ /reglaspvp — Reglamento oficial de PvP.

Escribe */comando cris* en cualquier momento para ver este manual de nuevo.`;

const PALABRAS_CRISIS = [
  'quiero morir', 'no quiero vivir', 'suicidar', 'suicidio', 'matarme',
  'quitarme la vida', 'hacerme daño', 'autolesion', 'cortarme'
];
function esMensajeDeCrisis(texto) {
  const t = texto.toLowerCase();
  return PALABRAS_CRISIS.some(p => t.includes(p));
}

const PALABRAS_COMPRA = [
  'cuanto cuesta', 'cuánto cuesta', 'precio', 'precios', 'quiero comprar',
  'tienes stock', 'como pago', 'cómo pago', 'esta disponible', 'está disponible', 'vendes'
];
function esIntencionCompra(texto) {
  const t = texto.toLowerCase();
  return PALABRAS_COMPRA.some(p => t.includes(p));
}

process.on('unhandledRejection', (err) => console.log('⚠️ Promesa no manejada:', err?.message || err));
process.on('uncaughtException', (err) => console.log('⚠️ Excepción no capturada:', err?.message || err));

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
];

const REGLAS_IA_BASE = `
Eres ${NOMBRE_BOT}, y hablas como si fueras ${CREADOR} mismo respondiéndole a sus panas dentro de un GRUPO de WhatsApp. Personalidad cálida y con onda peruana, cercano, con harta jerga limeña, pero medida — choro y confianzudo, no formal ni acartonado.

CONTEXTO: estás respondiendo dentro de un grupo, puede haber varias personas leyendo. Si la persona citó un mensaje anterior, ese mensaje aparecerá en el contexto adicional — tenlo en cuenta al responder.

INFORMACIÓN SOBRE ${CREADOR}:
- Es el creador, propietario y desarrollador de este bot y de aplicaciones
- Ingeniero de sistemas
- Su número de propietario es ${TU_NUMERO}

🙏 REGLA SOBRE TU CREADOR: Cuando hables de ${CREADOR}, hazlo SIEMPRE con respeto.

👑 SOBRE TU PROPIETARIO: si el contexto adicional te indica que quien escribe ES tu propietario, trátalo con respeto absoluto y dale prioridad en tu atención, sin perder tu esencia ni volverte acartonado con él.

🎮 SOBRE FREE FIRE: evita sacar el tema de Free Fire o los productos que vende ${CREADOR} por tu cuenta. Solo lo mencionas si alguien te pregunta directamente sobre eso.

📚 NIVEL DE DETALLE: cuando te pregunten algo, da una respuesta completa y útil, no superficial — explica bien lo que haga falta explicar, pero mantente en 3 a 6 líneas salvo que el tema realmente necesite más espacio, sin perder tu personalidad choro y cercana.

✅ PUEDES: jerga limeña/peruana, garabato suave de vez en cuando (NO en cada respuesta), burla moderada con cariño, emojis con soltura.
❌ NUNCA: sonar robot/formal, insultar de verdad, abusar de groserías, meter ventas sin que pregunten.

🚨 CRISIS REAL: si alguien menciona autolesión o suicidio, corta el choreo, responde con calidez genuina y anímalo a hablar con alguien de confianza o profesional.
`;

const INSTRUCCION_MODO_CHORO = `

🕶️ MODO CHORO ACTIVO EN ESTE GRUPO: sube al máximo la jerga callejera limeña, tono de choro carismático de esquina, picardía y desconfianza juguetona, como un personaje de barrio con mucha labia. Sigue siendo gracioso y sin faltar el respeto de verdad — es un personaje, no maldad real.`;

const MENSAJES_ESPERA = [
  '🤖 Oe, causa... ahorita mi cerebro anda de vacaciones. Dame unos segundos. 😵‍💫',
  '😵 Mano, me agarraste reiniciando las neuronas. Escríbeme otra vez en un ratito.',
  '🛠️ Ya pe, me estoy acomodando por dentro. En un toque seguimos.',
  '💀 Ala... justo me agarraste con mantenimiento. Espérame un toque.'
];
function mensajeEsperaAleatorio() {
  return MENSAJES_ESPERA[Math.floor(Math.random() * MENSAJES_ESPERA.length)];
}
const contadorCuota = { fecha: new Date().toDateString(), usados: 0 };
function registrarUsoIA() {
  const hoy = new Date().toDateString();
  if (contadorCuota.fecha !== hoy) { contadorCuota.fecha = hoy; contadorCuota.usados = 0; }
  contadorCuota.usados++;
}
function cuotaCasiAgotada() { return contadorCuota.usados >= LIMITE_DIARIO_ESTIMADO * 0.9; }

const ARCHIVO_MEMORIA = path.join(__dirname, 'memoria.json');
function cargarMemoria() {
  try { return JSON.parse(fs.readFileSync(ARCHIVO_MEMORIA, 'utf-8')); }
  catch (err) { return {}; }
}
let memoriaPersistente = cargarMemoria();
let guardadoPendiente = null;
function guardarMemoria() {
  if (guardadoPendiente) clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(() => {
    fs.writeFile(ARCHIVO_MEMORIA, JSON.stringify(memoriaPersistente), (err) => {
      if (err) console.log('⚠️ Error guardando memoria:', err.message);
    });
  }, 2000);
}
function agregarAMemoriaCorta(jidUsuario, texto, respuesta) {
  if (!memoriaPersistente[jidUsuario]) memoriaPersistente[jidUsuario] = [];
  memoriaPersistente[jidUsuario].push({ texto, respuesta, fecha: new Date().toISOString() });
  if (memoriaPersistente[jidUsuario].length > 6) memoriaPersistente[jidUsuario].shift();
  guardarMemoria();
}
function obtenerContextoCorto(jidUsuario) {
  const lista = memoriaPersistente[jidUsuario] || [];
  if (lista.length === 0) return '';
  return '\n\nHISTORIAL RECIENTE con esta persona:\n' +
    lista.map(m => `Dijo: "${m.texto}"\nRespondiste: "${m.respuesta}"`).join('\n---\n');
}
function olvidarUsuario(jidUsuario) {
  delete memoriaPersistente[jidUsuario];
  guardarMemoria();
}

const ARCHIVO_AUDITORIA = path.join(__dirname, 'auditoria.json');
function cargarAuditoria() {
  try { return JSON.parse(fs.readFileSync(ARCHIVO_AUDITORIA, 'utf-8')); }
  catch (err) { return []; }
}
let registroAuditoria = cargarAuditoria();
let guardadoAuditoriaPendiente = null;
function guardarAuditoria() {
  if (guardadoAuditoriaPendiente) clearTimeout(guardadoAuditoriaPendiente);
  guardadoAuditoriaPendiente = setTimeout(() => {
    fs.writeFile(ARCHIVO_AUDITORIA, JSON.stringify(registroAuditoria), (err) => {
      if (err) console.log('⚠️ Error guardando auditoría:', err.message);
    });
  }, 2000);
}
function registrarAccionAdmin(jidGrupo, tipo, detalle) {
  registroAuditoria.push({ jidGrupo, tipo, detalle, fecha: new Date().toISOString() });
  if (registroAuditoria.length > 500) registroAuditoria.shift();
  guardarAuditoria();
}

const nombresConocidos = new Map();
function registrarNombreConocido(jid, nombre) {
  if (jid && nombre && nombre !== 'amig@') nombresConocidos.set(jid, nombre);
}
async function resolverIdentidad(sock, jidGrupo, jidCrudo) {
  if (!jidCrudo) return 'alguien';
  let numero = jidCrudo.split('@')[0];
  try {
    const metadata = await sock.groupMetadata(jidGrupo);
    const participante = metadata.participants.find(p => p.id === jidCrudo || p.jid === jidCrudo);
    if (participante?.phoneNumber) numero = participante.phoneNumber.split('@')[0];
  } catch (err) {}
  const nombre = nombresConocidos.get(jidCrudo) || nombresConocidos.get(`${numero}@s.whatsapp.net`);
  return nombre ? `${nombre} (${numero})` : numero;
}

// Usuarios silenciados por grupo: la IA no les responde hasta que un admin use /hablar on
const usuariosSilenciados = new Map();
function estaSilenciado(jidGrupo, jidUsuario) {
  return usuariosSilenciados.get(jidGrupo)?.has(jidUsuario) || false;
}

// Grupos con el modo choro activo
const modoChoroGrupos = new Set();

function esPropietario(jidUsuario) {
  return jidUsuario.split('@')[0] === TU_NUMERO;
}

const contadorMensajesGrupo = new Map();
function registrarMensajeGrupo(jidGrupo, jidUsuario) {
  if (!contadorMensajesGrupo.has(jidGrupo)) contadorMensajesGrupo.set(jidGrupo, new Map());
  const mapa = contadorMensajesGrupo.get(jidGrupo);
  mapa.set(jidUsuario, (mapa.get(jidUsuario) || 0) + 1);
}

const recordatoriosGrupo = [];
function programarRecordatorioGrupo(jidGrupo, minutos, texto) {
  recordatoriosGrupo.push({ jidGrupo, tiempoEjecucion: Date.now() + minutos * 60000, texto });
}

let botActivo = true;
let sockActivo = null;

const modoJefe = new Map();
let estiloGlobalExtra = '';
function esCodigoDueño(texto) {
  return texto.trim() === CODIGO_DUEÑO;
}

function calcularTiempoTecleo(texto) {
  const ms = texto.length * 35;
  return Math.min(Math.max(ms, 800), 4000);
}

async function enviarRespuestaHumanizada(sock, jid, texto, mentions) {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(r => setTimeout(r, calcularTiempoTecleo(texto)));
    await sock.sendMessage(jid, { text: texto, mentions: mentions || [] });
    await sock.sendPresenceUpdate('paused', jid);
  } catch (err) {
    console.log('⚠️ Error en envío humanizado:', err.message);
  }
}

function construirClientesIA() {
  const clientes = [];
  if (CLAVE_IA_PRINCIPAL) clientes.push({ ai: new GoogleGenAI({ apiKey: CLAVE_IA_PRINCIPAL }), modelo: MODELO_PRINCIPAL, nombre: 'principal' });
  if (CLAVE_IA_RESPALDO) clientes.push({ ai: new GoogleGenAI({ apiKey: CLAVE_IA_RESPALDO }), modelo: MODELO_RESPALDO, nombre: 'respaldo' });
  if (CLAVE_IA_RESPALDO2) clientes.push({ ai: new GoogleGenAI({ apiKey: CLAVE_IA_RESPALDO2 }), modelo: MODELO_RESPALDO2, nombre: 'respaldo2' });
  return clientes;
}
const CLIENTES_IA = construirClientesIA();

async function generarRespuestaIA(prompt, notasExtra) {
  let reglasFinales = REGLAS_IA_BASE;
  if (estiloGlobalExtra) {
    reglasFinales += `\n\n🔧 DIRECTIVA GLOBAL ACTIVA (aplica a TODOS los chats, prioridad máxima): ${estiloGlobalExtra}`;
  }
  if (notasExtra) reglasFinales += `\n\nCONTEXTO ADICIONAL: ${notasExtra}`;
  if (cuotaCasiAgotada()) {
    reglasFinales += `\n\n⚠️ Casi al límite del día — sé un poco más breve de lo normal.`;
  }

  const intentar = async (cliente) => {
    const res = await cliente.ai.models.generateContent({
      model: cliente.modelo,
      contents: prompt,
      config: { systemInstruction: reglasFinales, safetySettings: SAFETY_SETTINGS, maxOutputTokens: MAX_TOKENS_RESPUESTA }
    });
    return res.text;
  };

  for (const cliente of CLIENTES_IA) {
    try {
      const r = await intentar(cliente);
      registrarUsoIA();
      return r;
    } catch (err) {
      console.log(`⚠️ Falló IA (${cliente.nombre}):`, err.message);
    }
  }

  if (CLIENTES_IA.length > 0) {
    await new Promise(r => setTimeout(r, 1500));
    const r = await intentar(CLIENTES_IA[0]);
    registrarUsoIA();
    return r;
  }
  throw new Error('No hay ningún token de IA configurado');
}

async function generarAvatarIA(numero) {
  if (!USAR_AVATAR_IA || CLIENTES_IA.length === 0) return null;
  try {
    const res = await CLIENTES_IA[0].ai.models.generateContent({
      model: MODELO_IMAGEN,
      contents: 'Genera un avatar de perfil estilo caricatura/anime, colorido y llamativo, para usar como foto de perfil en un chat. Sin texto ni marcas de agua, fondo simple.',
      config: { responseModalities: ['IMAGE'] }
    });
    const parte = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (parte?.inlineData?.data) {
      return Buffer.from(parte.inlineData.data, 'base64');
    }
    return null;
  } catch (err) {
    console.log('⚠️ No se pudo generar avatar con IA:', err.message);
    return null;
  }
}

function obtenerIdentificadoresBot(sock) {
  const ids = new Set();
  const rawId = sock.user?.id || '';
  const rawLid = sock.user?.lid || '';
  if (rawId) ids.add(rawId.split(':')[0].split('@')[0]);
  if (rawLid) ids.add(rawLid.split(':')[0].split('@')[0]);
  ids.add(TU_NUMERO);
  return [...ids].filter(Boolean);
}

function esMencionAlBot(msg, texto, identificadoresBot) {
  const mencionados = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const numerosMencionados = mencionados.map(j => j.split('@')[0]);
  if (numerosMencionados.some(n => identificadoresBot.includes(n))) return true;
  return identificadoresBot.some(id => texto.includes(`@${id}`));
}

function debeResponderIA(texto, msg, identificadoresBot) {
  if (esMencionAlBot(msg, texto, identificadoresBot)) return true;
  return /^\/criss\b/i.test(texto.trim());
}

function obtenerTextoCitado(msg) {
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  const citado = contextInfo?.quotedMessage;
  if (!citado) return null;
  const texto = citado.conversation
    || citado.extendedTextMessage?.text
    || citado.imageMessage?.caption
    || citado.videoMessage?.caption
    || null;
  return texto ? texto.trim() : null;
}

function normalizarParticipante(participanteRaw) {
  if (typeof participanteRaw === 'string') {
    return { jid: participanteRaw, numero: participanteRaw.split('@')[0] };
  }
  const jid = participanteRaw?.id || participanteRaw?.jid || participanteRaw?.phoneNumber || '';
  const numero = (participanteRaw?.phoneNumber || jid || '').split('@')[0];
  return { jid, numero };
}
function extraerTipoYMencion(partes, mencionados) {
  const tipo = partes.filter(p => !p.startsWith('@')).join(' ').trim();
  return { tipo, mencion: mencionados[0] || null };
}

function comandoPorciento(tipo, mencionJid) {
  const numero = Math.floor(Math.random() * 101);
  const nombre = mencionJid ? `@${mencionJid.split('@')[0]}` : 'esa persona';
  const etiqueta = tipo || 'lo que preguntaste';
  return { texto: `📊 ${nombre} tiene ${numero}% de ${etiqueta} 😂`, mentions: mencionJid ? [mencionJid] : [] };
}

function comandoShipeo(jid1, jid2) {
  const numero = Math.floor(Math.random() * 101);
  let frase = '';
  if (numero < 20) frase = 'mejor queden como panas nomás 💀';
  else if (numero < 50) frase = 'hay su onda pero falta harto 😅';
  else if (numero < 80) frase = '¡se ve bonito esto! 👀🔥';
  else frase = '¡boda ya! 💍😂';
  return { texto: `💘 @${jid1.split('@')[0]} + @${jid2.split('@')[0]} = ${numero}% compatibles\n${frase}`, mentions: [jid1, jid2] };
}

function comandoMatrimonio(mencionados) {
  if (mencionados.length < 2) return { texto: 'Menciona a los dos: /matrimonio @novio @novia', mentions: [] };
  const [a, b] = mencionados;
  const texto = `💍 *CERTIFICADO DE MATRIMONIO* 💍\n\nPor la presente, @${a.split('@')[0]} y @${b.split('@')[0]} quedan unidos en santo matrimonio grupal.\n\n¡Felicidades a los novios! 🎉🥂`;
  return { texto, mentions: [a, b] };
}

const OBJETOS_ASALTO = [
  'su estilo de juego', 'su última recarga', 'su fama de gallo del grupo', 'su wifi',
  'su combo secreto', 'su privacidad en el chat', 'su corona invisible de mejor jugador',
  'su suerte en las rondas', 'su swag', 'su paciencia'
];
const FRASES_ASALTO = [
  '🔫 ¡Esto es un asalto! @NUM, manos arriba y suelta @OBJ 😎',
  '🥷 Entrando en silencio total... @NUM no vio venir que le robarían @OBJ 💨',
  '🎭 Atención al grupo: @NUM acaba de ser "asaltado" y perdió @OBJ 😂',
  '💰 Asalto exitoso: le sacaron @OBJ a @NUM sin que se diera cuenta 🕶️',
  '🚨 Alerta de robo en el clan: @NUM se quedó sin @OBJ 😱😂'
];
function comandoAsalto(mencionJid) {
  if (!mencionJid) return { texto: 'Menciona a tu víctima: /asalto @usuario', mentions: [] };
  const numero = mencionJid.split('@')[0];
  const objeto = OBJETOS_ASALTO[Math.floor(Math.random() * OBJETOS_ASALTO.length)];
  const base = FRASES_ASALTO[Math.floor(Math.random() * FRASES_ASALTO.length)];
  const texto = base.replace('@NUM', `@${numero}`).replace('@OBJ', objeto);
  return { texto, mentions: [mencionJid] };
}

const FRASES_RANDOM = [
  'La constancia le gana al talento cuando el talento no es constante 💪',
  'Causa, hoy es un buen día para no rendirte 🔥',
  'El que no arriesga, no jala pescado 🐟',
  'Mejor solo que mal acompañado, mejor acompañado que aburrido 😂'
];
function comandoFrase() { return FRASES_RANDOM[Math.floor(Math.random() * FRASES_RANDOM.length)]; }

const FRASES_DESPEDIDA = [
  'Se fue @NUM... ni el grupo lo va a extrañar mucho la verdad 💀',
  '@NUM se fugó, seguro fue a buscar personalidad 😂',
  'Uno menos hueveando por acá, chau @NUM 😏',
  '@NUM desapareció más rápido que la plata en quincena 💸😂',
  'Se fue @NUM, ya se extrañaba la paz por acá 😌✌️',
  '@NUM salió disparado, ni Flash corre así 💀🔥',
  'Adiós @NUM, no le avises a nadie que se fue, capaz ni notan la diferencia 😂',
  'Chau @NUM, la puerta queda abierta pero no se ve que la vayas a necesitar de nuevo 👋'
];
function comandoDespedidaAleatoria(numero) {
  const base = FRASES_DESPEDIDA[Math.floor(Math.random() * FRASES_DESPEDIDA.length)];
  return base.replace('@NUM', `@${numero}`);
}

const FRASES_BIENVENIDA = [
  '🎉 ¡@NUM llegó al clan! Se siente hasta la vibra subir, bienvenid@ causa 🔥🙌',
  '✨ ¡Un nuevo crack se une! @NUM, esto se pone bueno con vos aquí 😎🎊',
  '🥳 ¡Aplausos para @NUM que acaba de entrar! Prepárate pa reírte harto por acá 😂🎈',
  '💫 @NUM acaba de aparecer... y el grupo ya se siente más completo 🙏🔥',
  '🎊 ¡Bienvenid@, @NUM! Agarra sitio que aquí la pasamos bien y sin roche 😄👑',
  '🚀 @NUM se unió a la nave... ¡prepárense que llegó con toda la energía! 🎉😆',
  '🌟 Nuevo integrante en la casa: @NUM. ¡Que la pases increíble por acá, causa! 🙌🎈'
];
function comandoBienvenidaAleatoria(numero) {
  const base = FRASES_BIENVENIDA[Math.floor(Math.random() * FRASES_BIENVENIDA.length)];
  return base.replace('@NUM', `@${numero}`);
}

const SUBREDDITS_MEME_ES = ['memesenespanol', 'chistes', 'humor'];
async function comandoMeme(sock, jidGrupo) {
  for (const sub of SUBREDDITS_MEME_ES) {
    try {
      const res = await fetch(`https://meme-api.com/gimme/${sub}`);
      const data = await res.json();
      if (data?.url && !data.nsfw) {
        await sock.sendMessage(jidGrupo, { image: { url: data.url }, caption: data.title || '😂' });
        return;
      }
      console.log(`⚠️ Meme sin url válida en r/${sub}:`, JSON.stringify(data).slice(0, 200));
    } catch (err) {
      console.log(`⚠️ Meme falló en r/${sub}:`, err.message);
    }
  }
  await sock.sendMessage(jidGrupo, { text: 'No pude traer un meme ahorita 😅' });
}

async function comandoEncuesta(sock, jidGrupo, textoCompleto) {
  const partes = textoCompleto.split(';').map(p => p.trim()).filter(Boolean);
  if (partes.length < 3) {
    await sock.sendMessage(jidGrupo, { text: 'Formato: /encuesta pregunta; opción1; opción2' });
    return;
  }
  const [pregunta, ...opciones] = partes;
  try {
    await sock.sendMessage(jidGrupo, { poll: { name: pregunta, values: opciones, selectableCount: 1 } });
  } catch (err) {
    await sock.sendMessage(jidGrupo, { text: 'No pude crear la encuesta, revisa la versión de Baileys.' });
  }
}

async function comandoRanking(sock, jidGrupo) {
  const mapa = contadorMensajesGrupo.get(jidGrupo);
  if (!mapa || mapa.size === 0) return { texto: 'Aún no hay suficiente actividad para armar un ranking 📊', mentions: [] };
  const ordenado = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mentions = ordenado.map(([jid]) => jid);
  const texto = '🏆 *Ranking de más activos:*\n' + ordenado.map(([jid, n], i) => `${i + 1}. @${jid.split('@')[0]} — ${n} msjs`).join('\n');
  return { texto, mentions };
}

async function esAdminGrupo(sock, jidGrupo, jidUsuario) {
  try {
    const metadata = await sock.groupMetadata(jidGrupo);
    const participante = metadata.participants.find(p =>
      p.id === jidUsuario || p.phoneNumber === jidUsuario || p.jid === jidUsuario
    );
    return !!participante && (participante.admin === 'admin' || participante.admin === 'superadmin');
  } catch (err) {
    console.log('⚠️ Error verificando admin:', err.message);
    return false;
  }
}

async function comandoPerfil(sock, jidGrupo, jidUsuario, mencionJid) {
  try {
    const jidObjetivo = mencionJid || jidUsuario;
    const numero = jidObjetivo.split('@')[0];
    const mapa = contadorMensajesGrupo.get(jidGrupo);
    const mensajes = mapa?.get(jidObjetivo) || 0;
    const esAdmin = await esAdminGrupo(sock, jidGrupo, jidObjetivo);
    const texto = `👤 *Perfil de @${numero}*\n📨 Mensajes en el grupo: ${mensajes}\n👑 Admin: ${esAdmin ? 'Sí' : 'No'}`;
    await sock.sendMessage(jidGrupo, { text: texto, mentions: [jidObjetivo] });
  } catch (err) {
    console.log('⚠️ Error en /perfil:', err.message);
    await sock.sendMessage(jidGrupo, { text: 'No pude generar el perfil ahorita, intenta de nuevo 🙏' });
  }
}

async function comandoAuditoria(sock, jidGrupo, jidUsuario, cantidadTexto) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidUsuario))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo los admins pueden ver el registro de movimientos 🚫' });
    return;
  }
  const cantidad = Math.min(Math.max(parseInt(cantidadTexto, 10) || 10, 1), 30);
  const entradas = registroAuditoria.filter(e => e.jidGrupo === jidGrupo).slice(-cantidad).reverse();
  if (!entradas.length) {
    await sock.sendMessage(jidGrupo, { text: '📋 Aún no hay movimientos registrados en este grupo.' });
    return;
  }
  const ICONOS = { kick: '🚫', add: '➕', promote: '⭐', demote: '🔻', cerrar: '🔒', abrir: '🔓' };
  const texto = `📋 *REGISTRO DE AUDITORÍA*\n_Últimos ${entradas.length} movimientos_\n\n` +
    entradas.map(e => {
      const fecha = new Date(e.fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${ICONOS[e.tipo] || '•'} *${fecha}*\n${e.detalle}`;
    }).join('\n\n');
  await sock.sendMessage(jidGrupo, { text: texto });
}

async function comandoHablar(sock, jidGrupo, jidAdmin, accion, mencionJid) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidAdmin))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo los admins pueden silenciar o reactivar a alguien 🚫' });
    return;
  }
  if (!mencionJid) {
    await sock.sendMessage(jidGrupo, { text: 'Uso: /hablar off @usuario (silenciar) o /hablar on @usuario (reactivar)' });
    return;
  }
  if (!usuariosSilenciados.has(jidGrupo)) usuariosSilenciados.set(jidGrupo, new Set());
  const set = usuariosSilenciados.get(jidGrupo);
  const numero = mencionJid.split('@')[0];
  if (accion === 'off') {
    set.add(mencionJid);
    await sock.sendMessage(jidGrupo, { text: `🔇 Listo, ya no le responderé con IA a @${numero}.`, mentions: [mencionJid] });
  } else if (accion === 'on') {
    set.delete(mencionJid);
    await sock.sendMessage(jidGrupo, { text: `🔊 Listo, vuelvo a responderle con IA a @${numero}.`, mentions: [mencionJid] });
  } else {
    await sock.sendMessage(jidGrupo, { text: 'Uso: /hablar off @usuario (silenciar) o /hablar on @usuario (reactivar)' });
  }
}

async function comandoChoro(sock, jidGrupo, jidAdmin, accion) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidAdmin))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo los admins pueden cambiar el modo choro 🚫' });
    return;
  }
  if (accion === 'on') {
    modoChoroGrupos.add(jidGrupo);
    await sock.sendMessage(jidGrupo, { text: '😎 Modo CHORO activado en este grupo. Full jerga callejera de ahora en más.' });
  } else if (accion === 'off') {
    modoChoroGrupos.delete(jidGrupo);
    await sock.sendMessage(jidGrupo, { text: '🙌 Modo CHORO desactivado, vuelvo a mi forma normal.' });
  } else {
    await sock.sendMessage(jidGrupo, { text: 'Uso: /choro on o /choro off' });
  }
}
async function comandoKick(sock, jidGrupo, jidUsuario, mencionados) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidUsuario))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo los admins del grupo pueden usar este comando causa 🚫' });
    return;
  }
  if (!mencionados.length) {
    await sock.sendMessage(jidGrupo, { text: 'Menciona a quién quieres sacar: /kick @usuario' });
    return;
  }
  try {
    await sock.groupParticipantsUpdate(jidGrupo, mencionados, 'remove');
    await sock.sendMessage(jidGrupo, { text: `👋 Listo, saqué a ${mencionados.length} del grupo.` });
  } catch (err) {
    await sock.sendMessage(jidGrupo, { text: 'No pude sacarlo, revisa que el bot sea admin del grupo 🙏' });
  }
}

async function comandoPromoverDegradar(sock, jidGrupo, jidUsuario, mencionados, accion) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidUsuario))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo los admins pueden usar este comando 🚫' });
    return;
  }
  if (!mencionados.length) {
    await sock.sendMessage(jidGrupo, { text: `Menciona a quién: /${accion === 'promote' ? 'promover' : 'degradar'} @usuario` });
    return;
  }
  try {
    await sock.groupParticipantsUpdate(jidGrupo, mencionados, accion);
    await sock.sendMessage(jidGrupo, { text: accion === 'promote' ? '⭐ Listo, ahora es admin.' : '🔻 Listo, ya no es admin.' });
  } catch (err) {
    await sock.sendMessage(jidGrupo, { text: 'No pude hacer el cambio, revisa que el bot sea admin del grupo.' });
  }
}

async function comandoTodos(sock, jidGrupo, jidUsuario, mensajeExtra) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidUsuario))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo los admins pueden usar /todos 🚫' });
    return;
  }
  try {
    const metadata = await sock.groupMetadata(jidGrupo);
    const jids = metadata.participants.map(p => p.id);
    const texto = mensajeExtra ? `📢 ${mensajeExtra}` : '📢 ¡Atención a todos!';
    const menciones = jids.map(j => `@${j.split('@')[0]}`).join(' ');
    await sock.sendMessage(jidGrupo, { text: `${texto}\n\n${menciones}`, mentions: jids });
  } catch (err) {
    await sock.sendMessage(jidGrupo, { text: 'No pude etiquetar a todos, intenta de nuevo.' });
  }
}

async function comandoCerrarGrupo(sock, jidGrupo, jidUsuario, cerrar) {
  if (!(await esAdminGrupo(sock, jidGrupo, jidUsuario))) {
    await sock.sendMessage(jidGrupo, { text: 'Solo admins 🚫' });
    return;
  }
  try {
    await sock.groupSettingUpdate(jidGrupo, cerrar ? 'announcement' : 'not_announcement');
    await sock.sendMessage(jidGrupo, { text: cerrar ? '🔒 Grupo cerrado, solo admins escriben.' : '🔓 Grupo abierto para todos.' });
    const autorMostrar = await resolverIdentidad(sock, jidGrupo, jidUsuario);
    registrarAccionAdmin(jidGrupo, cerrar ? 'cerrar' : 'abrir', `${autorMostrar} ${cerrar ? 'cerró' : 'abrió'} el grupo (cambio de ajustes)`);
  } catch (err) {
    await sock.sendMessage(jidGrupo, { text: 'No pude cambiar la configuración, revisa que el bot sea admin.' });
  }
}

function generarTextoInfo() {
  const uptimeH = ((Date.now() - estado.inicio) / 3600000).toFixed(1);
  return `🤖 *${NOMBRE_BOT}* — v${VERSION_BOT}

👨‍💻 Creado por: *Albert Oficial*, ingeniero de sistemas.
🟢 Estado: ${estado.conectado ? 'Conectado y activo' : 'Desconectado'}
⏱ Tiempo activo: ${uptimeH}h

Escribe /comando cris para ver todo lo que puedo hacer.`;
}

const TEXTO_CREADOR = `👑 Este bot fue creado por *Albert Oficial*, desarrollador de bots de WhatsApp y aplicaciones. 🙌`;

const TEXTO_REGLAS = `╔════════════════════════╗
            🏆 REGLAMENTO OFICIAL
                          DEL CLAN 🏆
╚════════════════════════╝

Bienvenido al clan. [STX] OFICIAL

El objetivo de este reglamento es mantener el orden, el respeto y la competitividad entre todos los integrantes. Al permanecer en el clan, cada miembro acepta cumplir las siguientes normas.

━━━━━━━━━━━━━━━━━━━━━━
🚫 REGLAS NO PERMITIDAS
━━━━━━━━━━━━━━━━━━━━━━

❌ Enviar contenido gore.
❌ Enviar contenido pornográfico (+18).
❌ Insultar o faltar el respeto a cualquier integrante.
❌ Generar discusiones o conflictos dentro del grupo.
❌ Enviar stickers fuera de contexto.
❌ Hacer spam o promocionar otros clanes.

━━━━━━━━━━━━━━━━━━━━━━
✅ OBLIGACIONES DEL MIEMBRO
━━━━━━━━━━━━━━━━━━━━━━

✔ Mantener una participación activa dentro del clan.
✔ Obtener un mínimo de *2,000 placas por semana*.
✔ Participar en guerras de clanes, torneos y partidas amistosas cuando sea convocado.
✔ Mantenerse atento a los anuncios y comunicados oficiales.
✔ Cualquier duda, sugerencia o reclamo deberá dirigirse únicamente a los administradores.
✔ El cambio de iniciales del clan solo podrá realizarse después de un período mínimo de *3 meses*.

━━━━━━━━━━━━━━━━━━━━━━
🎁 RECOMPENSAS OFICIALES
━━━━━━━━━━━━━━━━━━━━━━

💎 *100 Diamantes*
Para el jugador más destacado de la semana.

🔥 *300 Diamantes*
Todo miembro que consiga *25,000 placas durante la semana* recibirá una recompensa de *300 diamantes*, previa verificación por parte de los administradores.

🎫 *Pase Élite*
Se realizará un sorteo de *1 Pase Élite* el día *28 de cada mes*.

⚔ *PVP con premios*
Cada integrante de la escuadra ganadora recibirá *100 diamantes*.

🏆 *Reconocimiento Semanal*
El jugador con mayor cantidad de placas será reconocido como el mejor miembro de la semana.

━━━━━━━━━━━━━━━━━━━━━━
⚠ SISTEMA DE SANCIONES
━━━━━━━━━━━━━━━━━━━━━━

🟡 Primera falta: Advertencia.
🟠 Segunda falta: Suspensión temporal de actividades del clan.
🔴 Tercera falta: Expulsión definitiva del clan, según decisión de la administración.

━━━━━━━━━━━━━━━━━━━━━━
🏆 COMPROMISO DEL CLAN
━━━━━━━━━━━━━━━━━━━━━━

Nuestro objetivo es formar un clan competitivo, organizado y respetuoso, donde cada integrante contribuya al crecimiento del equipo mediante su actividad, disciplina y juego limpio.

El incumplimiento de cualquiera de las normas podrá ser sancionado por la administración.

         ⚔ JUEGA LIMPIO • COMPITE CON HONOR • REPRESENTA AL CLAN ⚔`;

const TEXTO_REGLAS_PVP = `⚔ REGLAMENTO OFICIAL DE PVP ⚔

Los PVP del clan están diseñados para demostrar únicamente la habilidad de cada jugador.

🚫 Queda estrictamente prohibido el uso de cualquier tipo de ventaja ilegal, incluyendo:
• Fake Lag.
• Hologramas.
• Aimbot.
• Cualquier otra ventaja que altere el desarrollo normal de la partida.

━━━━━━━━━━━━━━━━━━━━━━
🧬 HABILIDADES PERMITIDAS
━━━━━━━━━━━━━━━━━━━━━━

✅ Alok.
✅ Kelly.
✅ Ayato.
✅ Maxim.

No se permitirá el uso de ninguna otra habilidad.

━━━━━━━━━━━━━━━━━━━━━━
🔫 ARMAS PERMITIDAS
━━━━━━━━━━━━━━━━━━━━━━

✔ Desert Eagle.
✔ M10.
✔ M1887.

No se permitirá el uso de armas distintas a las mencionadas.

━━━━━━━━━━━━━━━━━━━━━━
📌 REGLAS DEL COMBATE
━━━━━━━━━━━━━━━━━━━━━━

• Está prohibido encerrarse durante el enfrentamiento.
• No está permitido dejar morir al rival por la zona.
• Cada enfrentamiento deberá realizarse respetando el orden establecido.
• Los combates serán *1 vs 1*.
• Ningún integrante podrá intervenir en el duelo de otro compañero.
• Está estrictamente prohibido que dos o más jugadores ataquen a un solo rival.

El incumplimiento de cualquiera de estas reglas ocasionará que el enfrentamiento sea declarado *NO VÁLIDO*.

La escuadra rival será declarada vencedora automáticamente y avanzará a la siguiente ronda.`;

async function procesarComandoJefe(sock, remitente, texto) {
  const t = texto.toLowerCase().trim();

  if (t === 'salir' || t.includes('salir del menu') || t.includes('salir del menú') || t.includes('modo normal')) {
    modoJefe.delete(remitente);
    await sock.sendMessage(remitente, { text: 'Listo jefe, cerré el menú 🙌' });
    return;
  }
  if (t.includes('informe') || t.includes('estado') || t.includes('estadistica') || t.includes('estadística')) {
    const uptimeH = ((Date.now() - estado.inicio) / 3600000).toFixed(1);
    await sock.sendMessage(remitente, {
      text: `📊 *Informe de ${NOMBRE_BOT}*\nConectado: ${estado.conectado ? 'Sí' : 'No'}\nBot activo: ${botActivo ? 'Sí' : 'No'}\nUptime: ${uptimeH}h\nMensajes recibidos: ${estado.mensajesRecibidos}\nMensajes enviados: ${estado.mensajesEnviados}\nCuota IA hoy: ${contadorCuota.usados}/${LIMITE_DIARIO_ESTIMADO}\nReconexiones: ${estado.intentosReconexion}\nTono actual: ${estiloGlobalExtra || 'el original, sin cambios'}`
    });
    return;
  }
  if (t.includes('apaga')) {
    botActivo = false;
    await sock.sendMessage(remitente, { text: '🔴 Bot apagado en todos los grupos.' });
    return;
  }
  if (t.includes('enciende') || t.includes('activa')) {
    botActivo = true;
    await sock.sendMessage(remitente, { text: '🟢 Bot encendido en todos los grupos.' });
    return;
  }
  if (t.includes('restaura') || t.includes('vuelve a la normalidad') || t.includes('como eras antes') || t.includes('forma original')) {
    estiloGlobalExtra = '';
    await sock.sendMessage(remitente, { text: '✅ Listo jefe, volví a mi forma de ser original.' });
    return;
  }

  estiloGlobalExtra = texto.trim();
  await sock.sendMessage(remitente, { text: `✅ Listo jefe, actualicé mi forma de expresarme en TODOS los grupos:\n"${estiloGlobalExtra}"\n\n(escribe "restaura" para volver a mi forma original)` });
}
async function procesarMensajeGrupo(sock, msg, identificadoresBot) {
  const jidGrupo = msg.key.remoteJid;
  const jidUsuario = msg.key.participant || msg.key.remoteJid;
  const nombreContacto = msg.pushName || 'amig@';
  const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
  if (!texto) return;

  registrarMensajeGrupo(jidGrupo, jidUsuario);
  registrarNombreConocido(jidUsuario, nombreContacto);

  if (esIntencionCompra(texto)) {
    try {
      await sock.sendMessage(jidGrupo, { text: 'Dame un toque que le aviso a Alberto para que te atienda directo 🙌', mentions: [jidUsuario] });
      await sock.sendMessage(JID_DUEÑO, { text: `💰 Posible cliente en grupo: ${nombreContacto} (${jidUsuario.split('@')[0]}) preguntó: "${texto}"` });
    } catch (err) { console.log('❌ Error en flujo de compra:', err.message); }
    return;
  }

  const mencionados = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const partesTexto = texto.split(/\s+/);
  const comando = partesTexto[0].toLowerCase();
  const resto = partesTexto.slice(1);
  const { tipo } = extraerTipoYMencion(resto, mencionados);

  try {
    switch (comando) {
      case '/comando': {
        if ((resto[0] || '').toLowerCase() === 'cris') {
          await sock.sendMessage(jidGrupo, { text: TEXTO_AYUDA });
        }
        return;
      }
      case '/porciento': {
        const { texto: t, mentions } = comandoPorciento(tipo, mencionados[0]);
        await sock.sendMessage(jidGrupo, { text: t, mentions });
        return;
      }
      case '/shipeo': {
        if (mencionados.length < 2) { await sock.sendMessage(jidGrupo, { text: 'Menciona a dos personas: /shipeo @user1 @user2' }); return; }
        const { texto: t, mentions } = comandoShipeo(mencionados[0], mencionados[1]);
        await sock.sendMessage(jidGrupo, { text: t, mentions });
        return;
      }
      case '/matrimonio': {
        const { texto: t, mentions } = comandoMatrimonio(mencionados);
        await sock.sendMessage(jidGrupo, { text: t, mentions });
        return;
      }
      case '/asalto': {
        const { texto: t, mentions } = comandoAsalto(mencionados[0]);
        await sock.sendMessage(jidGrupo, { text: t, mentions });
        return;
      }
      case '/frase': await sock.sendMessage(jidGrupo, { text: comandoFrase() }); return;
      case '/meme': await comandoMeme(sock, jidGrupo); return;
      case '/encuesta': await comandoEncuesta(sock, jidGrupo, resto.join(' ')); return;
      case '/perfil': await comandoPerfil(sock, jidGrupo, jidUsuario, mencionados[0]); return;
      case '/ranking': {
        const { texto: t, mentions } = await comandoRanking(sock, jidGrupo);
        await sock.sendMessage(jidGrupo, { text: t, mentions });
        return;
      }
      case '/auditoria': case '/movimiento':
        await comandoAuditoria(sock, jidGrupo, jidUsuario, resto[0]); return;
      case '/hablar':
        await comandoHablar(sock, jidGrupo, jidUsuario, (resto[0] || '').toLowerCase(), mencionados[0]); return;
      case '/choro':
        await comandoChoro(sock, jidGrupo, jidUsuario, (resto[0] || '').toLowerCase()); return;
      case '/kick': case '/eliminar': case '/sacar': case '/ban':
        await comandoKick(sock, jidGrupo, jidUsuario, mencionados); return;
      case '/promover': await comandoPromoverDegradar(sock, jidGrupo, jidUsuario, mencionados, 'promote'); return;
      case '/degradar': await comandoPromoverDegradar(sock, jidGrupo, jidUsuario, mencionados, 'demote'); return;
      case '/todos': case '/everyone': await comandoTodos(sock, jidGrupo, jidUsuario, resto.join(' ')); return;
      case '/cerrar': await comandoCerrarGrupo(sock, jidGrupo, jidUsuario, true); return;
      case '/abrir': await comandoCerrarGrupo(sock, jidGrupo, jidUsuario, false); return;
      case '/recordatorio': {
        if (!(await esAdminGrupo(sock, jidGrupo, jidUsuario))) { await sock.sendMessage(jidGrupo, { text: 'Solo admins pueden programar recordatorios 🚫' }); return; }
        const minutos = parseInt(resto[0], 10);
        const textoRecordatorio = resto.slice(1).join(' ');
        if (!minutos || !textoRecordatorio) { await sock.sendMessage(jidGrupo, { text: 'Uso: /recordatorio 30 avisar la reunión' }); return; }
        programarRecordatorioGrupo(jidGrupo, minutos, textoRecordatorio);
        await sock.sendMessage(jidGrupo, { text: `⏰ Listo, aviso en ${minutos} min: "${textoRecordatorio}"` });
        return;
      }
      case '/info': await sock.sendMessage(jidGrupo, { text: generarTextoInfo() }); return;
      case '/creador': await sock.sendMessage(jidGrupo, { text: TEXTO_CREADOR }); return;
      case '/reglas': await sock.sendMessage(jidGrupo, { text: TEXTO_REGLAS }); return;
      case '/reglaspvp': await sock.sendMessage(jidGrupo, { text: TEXTO_REGLAS_PVP }); return;
      case '/recordar': {
        const lista = memoriaPersistente[jidUsuario] || [];
        if (!lista.length) { await sock.sendMessage(jidGrupo, { text: 'Aún no tengo nada guardado de ti 🤔' }); return; }
        const resumen = lista.map(m => `👤 ${m.texto}\n🤖 ${m.respuesta}`).join('\n\n');
        await sock.sendMessage(jidGrupo, { text: `🧠 Esto recuerdo de ti:\n\n${resumen}` });
        return;
      }
      case '/olvidarme': {
        olvidarUsuario(jidUsuario);
        await sock.sendMessage(jidGrupo, { text: 'Listo, borré todo lo que recordaba de ti 🗑️' });
        return;
      }
    }
  } catch (err) {
    console.log('❌ Error en comando:', err.message);
    return;
  }

  if (estaSilenciado(jidGrupo, jidUsuario)) return;

  if (!debeResponderIA(texto, msg, identificadoresBot)) return;

  if (esMensajeDeCrisis(texto)) {
    try {
      await sock.sendMessage(JID_DUEÑO, { text: `🚨 Alerta: ${nombreContacto} en grupo escribió algo que parece señal de crisis: "${texto}"` });
    } catch (err) {}
  }

  try {
    const consultaLimpia = texto.replace(/@\d+/g, '').replace(/^\/criss\s*/i, '').trim() || texto;
    const textoCitado = obtenerTextoCitado(msg);
    let notas = `Mensaje de ${nombreContacto} dentro de un grupo de WhatsApp, hay más personas leyendo.` + obtenerContextoCorto(jidUsuario);
    if (textoCitado) {
      notas += `\n\nEsta persona citó (respondió a) un mensaje anterior que decía: "${textoCitado}". Ten esto en cuenta al responder, puede ser el tema de su pregunta.`;
    }
    if (esPropietario(jidUsuario)) {
      notas += `\n\nIMPORTANTE: quien te escribe ahora ES tu propietario/creador. Trátalo con máximo respeto y prioridad.`;
    }
    if (modoChoroGrupos.has(jidGrupo)) {
      notas += INSTRUCCION_MODO_CHORO;
    }
    const respuesta = await generarRespuestaIA(consultaLimpia, notas);
    await enviarRespuestaHumanizada(sock, jidGrupo, respuesta, [jidUsuario]);
    agregarAMemoriaCorta(jidUsuario, texto, respuesta);
  } catch (err) {
    console.log('❌ Error IA:', err.message);
    await sock.sendMessage(jidGrupo, { text: mensajeEsperaAleatorio() });
  }
}

function registrarBienvenidasYDespedidas(sock) {
  sock.ev.on('group-participants.update', async (evento) => {
    console.log('📥 Evento de participantes recibido:', evento.action);
    const { id: jidGrupo, participants, action, author } = evento;
    const autorMostrar = author ? await resolverIdentidad(sock, jidGrupo, author) : 'un admin';

    for (const participanteRaw of participants) {
      const { jid: jidParticipante, numero } = normalizarParticipante(participanteRaw);
      if (!jidParticipante) { console.log('⚠️ Participante sin jid válido, se omite:', participanteRaw); continue; }
      try {
        const objetivoMostrar = await resolverIdentidad(sock, jidGrupo, jidParticipante);

        if (action === 'add') {
          let fotoUrl = null;
          try { fotoUrl = await sock.profilePictureUrl(jidParticipante, 'image'); } catch (err) { fotoUrl = null; }

          const texto = comandoBienvenidaAleatoria(numero);

          if (fotoUrl) {
            await sock.sendMessage(jidGrupo, { image: { url: fotoUrl }, caption: texto, mentions: [jidParticipante] });
          } else {
            const fotoGenerada = await generarAvatarIA(numero);
            if (fotoGenerada) {
              await sock.sendMessage(jidGrupo, { image: fotoGenerada, caption: texto, mentions: [jidParticipante] });
            } else {
              const fotoRespaldo = `https://api.dicebear.com/7.x/adventurer/png?seed=${numero}`;
              await sock.sendMessage(jidGrupo, { image: { url: fotoRespaldo }, caption: texto, mentions: [jidParticipante] });
            }
          }
          registrarAccionAdmin(jidGrupo, 'add', `${autorMostrar} agregó a ${objetivoMostrar} al grupo`);
        } else if (action === 'remove') {
          await sock.sendMessage(jidGrupo, { text: comandoDespedidaAleatoria(numero), mentions: [jidParticipante] });
          if (author && author !== jidParticipante) {
            registrarAccionAdmin(jidGrupo, 'kick', `${autorMostrar} sacó a ${objetivoMostrar} del grupo`);
          }
        } else if (action === 'promote') {
          await sock.sendMessage(jidGrupo, { text: `⭐ @${numero} ahora es admin del grupo.`, mentions: [jidParticipante] });
          registrarAccionAdmin(jidGrupo, 'promote', `${autorMostrar} le dio admin a ${objetivoMostrar}`);
        } else if (action === 'demote') {
          await sock.sendMessage(jidGrupo, { text: `🔻 @${numero} ya no es admin.`, mentions: [jidParticipante] });
          registrarAccionAdmin(jidGrupo, 'demote', `${autorMostrar} le quitó admin a ${objetivoMostrar}`);
        }
      } catch (err) {
        console.log('⚠️ Error en bienvenida/despedida:', err.message);
      }
    }
  });
}
const estado = {
  conectado: false, inicio: Date.now(), mensajesRecibidos: 0, mensajesEnviados: 0,
  ultimoQR: null, intentosReconexion: 0, ultimoError: null
};

function calcularEsperaReconexion(intentos) {
  const base = Math.min(3000 * Math.pow(2, intentos), 60000);
  return intentos > 8 ? 90000 : base;
}

const almacenMensajes = new Map();

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state, version, printQRInTerminal: false,
    browser: [NOMBRE_BOT, 'Chrome', '2.0.0'], syncFullHistory: false, markOnlineOnConnect: true,
    getMessage: async (key) => almacenMensajes.get(key.id) || undefined
  });

  sockActivo = sock;
  sock.ev.on('creds.update', saveCreds);
  registrarBienvenidasYDespedidas(sock);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) {
      estado.ultimoQR = await QRCode.toDataURL(qr);
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === 'open') {
      estado.conectado = true; estado.intentosReconexion = 0; estado.ultimoQR = null;
      console.log('\n✅ BOT CONECTADO Y LISTO ✅');
      console.log('🆔 Identificadores del bot detectados:', obtenerIdentificadoresBot(sock));
    }
    if (connection === 'close') {
      estado.conectado = false;
      const motivo = lastDisconnect?.error?.output?.statusCode;
      estado.ultimoError = lastDisconnect?.error?.message || 'Desconocido';
      if (motivo === DisconnectReason.loggedOut || motivo === DisconnectReason.badSession) {
        console.log('❌ Sesión inválida. Borra la carpeta "sesion" y vuelve a escanear.');
        return;
      }
      if (motivo === DisconnectReason.restartRequired) {
        setTimeout(() => iniciarBot(), 1500);
        return;
      }
      estado.intentosReconexion++;
      setTimeout(() => iniciarBot(), calcularEsperaReconexion(estado.intentosReconexion));
    }
  });

  sock.ev.on('messages.upsert', async m => {
    if (m.type !== 'notify') return;
    const msg = m.messages[0];
    if (!msg.message) return;

    const remitente = msg.key.remoteJid;

    if (msg.key.fromMe) return;

    almacenMensajes.set(msg.key.id, msg.message);

    if (!remitente.endsWith('@g.us')) {
      if (remitente.endsWith('@s.whatsapp.net')) {
        const textoPersonal = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        if (esCodigoDueño(textoPersonal)) {
          modoJefe.set(remitente, true);
          await sock.sendMessage(remitente, {
            text: `🔐 Menú principal activado, jefe.\n\nPuedes pedirme:\n• informe — estadísticas del bot\n• apagar / encender — activa o desactiva el bot en los grupos\n• restaura — vuelvo a mi forma de ser original\n• cualquier otra frase — la tomo como tu nueva forma de expresarme en TODOS los grupos (ej: "habla más formal", "sé más chistoso")\n• salir — cierra este menú`
          });
          return;
        }
        if (modoJefe.get(remitente)) {
          await procesarComandoJefe(sock, remitente, textoPersonal);
          return;
        }
      }
      return;
    }

    if (!botActivo) return;

    const tipoMensaje = Object.keys(msg.message)[0];
    const esSoloMedia = ['imageMessage', 'audioMessage', 'videoMessage', 'stickerMessage'].includes(tipoMensaje)
      && !(msg.message.conversation || msg.message.extendedTextMessage?.text);
    if (esSoloMedia) return;

    estado.mensajesRecibidos++;
    try {
      const identificadoresBot = obtenerIdentificadoresBot(sock);
      await procesarMensajeGrupo(sock, msg, identificadoresBot);
      estado.mensajesEnviados++;
    } catch (err) {
      console.log('❌ Error procesando mensaje de grupo:', err.message);
    }
  });
}

setInterval(async () => {
  if (!sockActivo || recordatoriosGrupo.length === 0) return;
  const ahora = Date.now();
  for (let i = recordatoriosGrupo.length - 1; i >= 0; i--) {
    if (recordatoriosGrupo[i].tiempoEjecucion <= ahora) {
      const r = recordatoriosGrupo[i];
      try { await sockActivo.sendMessage(r.jidGrupo, { text: `⏰ Recordatorio: ${r.texto}` }); } catch (err) {}
      recordatoriosGrupo.splice(i, 1);
    }
  }
}, 30 * 1000);
const LISTA_COMANDOS_PANEL = [
  { cat: '🧠 Inteligencia Artificial', items: [
    ['/criss &lt;pregunta&gt;', 'Consulta directa a la IA'],
    ['@bot &lt;pregunta&gt;', 'Mencionar al bot también activa la IA'],
    ['Citar + /criss', 'La IA lee el mensaje citado como contexto'],
    ['/recordar', 'Qué recuerda la IA sobre ti'],
    ['/olvidarme', 'Borra tu historial guardado']
  ]},
  { cat: '🎉 Entretenimiento', items: [
    ['/porciento &lt;tema&gt; @user', 'Porcentaje aleatorio sobre un tema'],
    ['/shipeo @user1 @user2', 'Compatibilidad aleatoria'],
    ['/matrimonio @user1 @user2', 'Certificado de boda grupal'],
    ['/asalto @user', 'Asalto virtual de broma'],
    ['/frase', 'Frase motivacional aleatoria'],
    ['/meme', 'Meme en español'],
    ['/perfil @user', 'Actividad del usuario en el grupo']
  ]},
  { cat: '🛡️ Moderación', items: [
    ['/hablar off @user', 'La IA deja de responderle a ese usuario'],
    ['/hablar on @user', 'La IA vuelve a responderle'],
    ['/choro on', 'Activa personalidad choro en el grupo'],
    ['/choro off', 'Vuelve a la personalidad original']
  ]},
  { cat: '👑 Administración', items: [
    ['/kick @user', 'Expulsa a un miembro'],
    ['/promover @user', 'Otorga rol de admin'],
    ['/degradar @user', 'Retira rol de admin'],
    ['/todos &lt;mensaje&gt;', 'Etiqueta a todos'],
    ['/cerrar · /abrir', 'Controla quién puede escribir'],
    ['/encuesta preg; op1; op2', 'Encuesta nativa'],
    ['/recordatorio &lt;min&gt; &lt;texto&gt;', 'Aviso automático'],
    ['/ranking', 'Miembros más activos'],
    ['/auditoria &lt;cant&gt;', 'Historial de acciones de admins']
  ]},
  { cat: '📋 Información', items: [
    ['/info', 'Estado y versión del bot'],
    ['/creador', 'Quién desarrolló el bot'],
    ['/reglas', 'Reglamento del clan'],
    ['/reglaspvp', 'Reglamento de PvP']
  ]}
];

function generarHtmlComandos() {
  return LISTA_COMANDOS_PANEL.map(grupo => `
    <div class="cat-titulo">${grupo.cat}</div>
    <div class="cmd-grid">
      ${grupo.items.map(([nombre, desc]) => `
        <div class="cmd-card">
          <div class="cmd-nombre">${nombre}</div>
          <div class="cmd-desc">${desc}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

const app = express();
app.use(express.json());

app.get('/status', (req, res) => {
  res.json({
    conectado: estado.conectado, botActivo,
    uptimeSegundos: Math.floor((Date.now() - estado.inicio) / 1000),
    mensajesRecibidos: estado.mensajesRecibidos, mensajesEnviados: estado.mensajesEnviados,
    intentosReconexion: estado.intentosReconexion,
    cuotaUsada: contadorCuota.usados, cuotaLimite: LIMITE_DIARIO_ESTIMADO,
    urlRender: process.env.RENDER_EXTERNAL_URL || null
  });
});

app.post('/panel/toggle', (req, res) => {
  const { clave, activar } = req.body || {};
  if (clave !== CODIGO_DUEÑO) {
    return res.status(401).json({ ok: false, mensaje: 'Código incorrecto' });
  }
  botActivo = !!activar;
  res.json({ ok: true, botActivo });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${NOMBRE_BOT} · Panel</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Space+Mono&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: linear-gradient(160deg, #0a0e1a 0%, #10131f 50%, #0a0e1a 100%);
    color: #e4e8f5; font-family: 'Poppins', sans-serif; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; padding: 48px 20px 70px;
  }
  h1 {
    font-weight: 700; font-size: 34px; letter-spacing: 3px; color: #f4f6ff;
    text-align: center;
  }
  h1 span { color: #d4af37; }
  .sub { color: #7d8bb5; font-size: 12px; letter-spacing: 2px; margin: 6px 0 32px; text-transform: uppercase; }
  .badge {
    padding: 9px 24px; border-radius: 30px; font-weight: 600;
    font-size: 12px; letter-spacing: 1.5px; display: flex; align-items: center; gap: 9px; margin-bottom: 30px;
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; }
  .online { background: rgba(45,212,153,0.08); border: 1px solid #2dd499; color: #2dd499; }
  .online .dot { background: #2dd499; box-shadow: 0 0 8px #2dd499; }
  .offline { background: rgba(255,90,90,0.08); border: 1px solid #ff5a5a; color: #ff5a5a; }
  .offline .dot { background: #ff5a5a; box-shadow: 0 0 8px #ff5a5a; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; width: 100%; max-width: 900px; }
  .card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.18); border-radius: 12px;
    padding: 18px; text-align: center;
  }
  .card .valor { font-size: 22px; color: #f4f6ff; font-weight: 700; }
  .card .etiqueta { font-size: 10px; color: #7d8bb5; margin-top: 6px; text-transform: uppercase; letter-spacing: 1.2px; }

  .seccion { margin-top: 38px; margin-bottom: 12px; font-size: 12px;
    letter-spacing: 2.5px; color: #d4af37; text-transform: uppercase; font-weight: 600; align-self: flex-start;
    max-width: 900px; width: 100%; }

  .barra-fondo { width: 100%; max-width: 900px; height: 14px; background: rgba(255,255,255,0.04);
    border-radius: 10px; overflow: hidden; border: 1px solid rgba(212,175,55,0.15); }
  .barra-relleno { height: 100%; background: linear-gradient(90deg, #d4af37, #f4d675); }

  .cat-titulo { font-size: 13px; letter-spacing: 1.5px; color: #d4af37;
    margin: 22px 0 10px; text-transform: uppercase; font-weight: 600; width: 100%; max-width: 900px; }
  .cmd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px;
    width: 100%; max-width: 900px; }
  .cmd-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;
    padding: 12px 16px; }
  .cmd-nombre { font-size: 12px; color: #f4f6ff; font-weight: 600; font-family: 'Space Mono', monospace; }
  .cmd-desc { font-size: 11px; color: #8891b5; margin-top: 4px; }

  .panel-control { max-width: 900px; width: 100%; background: rgba(255,255,255,0.025);
    border: 1px solid rgba(212,175,55,0.18); border-radius: 12px; padding: 22px; }
  .panel-control p { font-size: 12px; color: #8891b5; margin-bottom: 14px; }
  .panel-control input {
    width: 100%; padding: 11px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(0,0,0,0.25); color: #f4f6ff; font-size: 13px; margin-bottom: 14px;
  }
  .panel-control .botones { display: flex; gap: 12px; }
  .panel-control button {
    flex: 1; padding: 11px; border-radius: 8px; font-weight: 600; font-size: 12px;
    letter-spacing: 1px; cursor: pointer; transition: opacity .2s;
  }
  .panel-control button:hover { opacity: 0.85; }
  .btn-on { border: 1px solid #2dd499; background: rgba(45,212,153,0.1); color: #2dd499; }
  .btn-off { border: 1px solid #ff5a5a; background: rgba(255,90,90,0.1); color: #ff5a5a; }
  #mensajeControl { font-size: 11px; margin-top: 12px; color: #8891b5; }

  .render-link {
    margin-top: 34px; padding: 11px 26px; border-radius: 30px; border: 1px solid #d4af37;
    color: #d4af37; text-decoration: none; font-size: 12px; font-weight: 600;
    letter-spacing: 1px;
  }

  #qr { margin-top: 26px; }
  #qr img { border-radius: 12px; border: 1px solid rgba(212,175,55,0.3); }
</style>
</head>
<body>
  <h1>${NOMBRE_BOT.toUpperCase().replace('BOT', ' <span>BOT</span>')}</h1>
  <div class="sub">Panel de control · ${CREADOR}</div>
  <div id="badge" class="badge offline"><div class="dot"></div>Cargando...</div>

  <div class="seccion">Actividad</div>
  <div class="grid">
    <div class="card"><div class="valor" id="msgIn">0</div><div class="etiqueta">Recibidos</div></div>
    <div class="card"><div class="valor" id="msgOut">0</div><div class="etiqueta">Enviados</div></div>
    <div class="card"><div class="valor" id="uptime">0s</div><div class="etiqueta">Uptime</div></div>
    <div class="card"><div class="valor" id="reint">0</div><div class="etiqueta">Reconexiones</div></div>
  </div>

  <div class="seccion">Cuota de IA hoy (contador interno)</div>
  <div class="grid">
    <div class="card" style="grid-column: 1 / -1">
      <div class="valor" id="cuotaTexto">0 / 0</div>
      <div class="barra-fondo" style="margin-top:12px"><div class="barra-relleno" id="cuotaBarra" style="width:0%"></div></div>
    </div>
  </div>

  <div class="seccion">Control del bot</div>
  <div class="panel-control">
    <p>Ingresa el código de administrador para encender o apagar el bot en todos los grupos.</p>
    <input id="claveControl" type="password" placeholder="Código de administrador">
    <div class="botones">
      <button class="btn-on" onclick="controlarBot(true)">🟢 Encender</button>
      <button class="btn-off" onclick="controlarBot(false)">🔴 Apagar</button>
    </div>
    <p id="mensajeControl"></p>
  </div>

  <div id="linkRenderCont"></div>

  <div class="seccion" style="margin-top:44px">Comandos disponibles</div>
  ${generarHtmlComandos()}

  <div id="qr"></div>

  <script>
    async function actualizar() {
      const r = await fetch('/status');
      const d = await r.json();
      const badge = document.getElementById('badge');
      badge.innerHTML = '<div class="dot"></div>' + (d.conectado ? (d.botActivo ? 'CONECTADO' : 'CONECTADO · BOT APAGADO') : 'DESCONECTADO');
      badge.className = 'badge ' + (d.conectado ? 'online' : 'offline');

      document.getElementById('msgIn').textContent = d.mensajesRecibidos;
      document.getElementById('msgOut').textContent = d.mensajesEnviados;
      document.getElementById('reint').textContent = d.intentosReconexion;

      const h = Math.floor(d.uptimeSegundos / 3600), m = Math.floor((d.uptimeSegundos % 3600) / 60), s = d.uptimeSegundos % 60;
      document.getElementById('uptime').textContent = h + 'h ' + m + 'm ' + s + 's';

      document.getElementById('cuotaTexto').textContent = d.cuotaUsada + ' / ' + d.cuotaLimite;
      const pct = Math.min(100, Math.round((d.cuotaUsada / d.cuotaLimite) * 100));
      document.getElementById('cuotaBarra').style.width = pct + '%';

      const contLink = document.getElementById('linkRenderCont');
      if (d.urlRender && !contLink.dataset.hecho) {
        contLink.innerHTML = '<a class="render-link" href="' + d.urlRender + '" target="_blank">🔗 ' + d.urlRender + '</a>';
        contLink.dataset.hecho = '1';
      }
    }
    async function controlarBot(activar) {
      const clave = document.getElementById('claveControl').value;
      const msgEl = document.getElementById('mensajeControl');
      msgEl.textContent = 'Procesando...';
      try {
        const r = await fetch('/panel/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clave, activar })
        });
        const d = await r.json();
        msgEl.textContent = d.ok ? ('✅ Bot ' + (activar ? 'encendido' : 'apagado') + ' correctamente') : ('❌ ' + d.mensaje);
        if (d.ok) actualizar();
      } catch (err) {
        msgEl.textContent = '❌ Error de conexión con el servidor';
      }
    }
    setInterval(actualizar, 3000);
    actualizar();
  </script>
</body>
</html>`);
});

app.get('/qr', (req, res) => {
  if (!estado.ultimoQR) return res.send('<h2 style="font-family:sans-serif;color:#fff;background:#000;height:100vh;display:flex;align-items:center;justify-content:center">No hay QR pendiente. El bot ya está conectado o aún no se generó uno.</h2>');
  res.send(`<body style="background:#000;display:flex;justify-content:center;align-items:center;height:100vh"><img src="${estado.ultimoQR}" /></body>`);
});

app.listen(PUERTO, () => console.log(`🌐 Panel web activo en el puerto ${PUERTO}`));

const URL_PROPIA = process.env.RENDER_EXTERNAL_URL;
if (URL_PROPIA) {
  setInterval(() => { fetch(URL_PROPIA).catch(() => {}); }, 4 * 60 * 1000);
}

iniciarBot();
