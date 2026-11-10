/**
 * API de etiquetas Envía — Netlify Function + Netlify Blobs
 *
 * Rutas (todas bajo /api):
 *   GET  /api/status       estado del cruce y avance
 *   POST /api/upload       { sci:[...], envia:[...], resetAudit, archivos }  → cruza y guarda
 *   POST /api/etiqueta     { olpn }  → devuelve ZPL + datos (no registra)
 *   POST /api/registrar    { olpn, guia, estacion } → registra en auditoría tras imprimir
 *   GET  /api/pendientes   OLPN sin imprimir
 *   GET  /api/auditoria    registros impresos
 *
 * Seguridad: si la variable de entorno APP_PIN existe, cada petición debe traer
 * el encabezado X-App-Pin con ese valor.
 *
 * Almacenamiento (store "etiquetas"):
 *   meta                       { cruceId, auditId, archivos, cargado_en, total }
 *   c/<cruceId>                filas del cruce (JSON)
 *   a/<auditId>/<olpn>|<guia>|<fecha>|<estacion>   un registro por etiqueta impresa
 *     (los datos van en la llave: un solo list() trae toda la auditoría y no hay
 *      condiciones de carrera entre estaciones porque nadie reescribe un archivo común)
 */
import { getStore } from "@netlify/blobs";

const TZ = "America/Bogota";

// ---------------------------------------------------------------------------
// Utilidades puras (exportadas para pruebas)
// ---------------------------------------------------------------------------
export const txt = (v) =>
  v === null || v === undefined ? "" : String(v).replace(/[\^~]/g, " ").replace(/\s+/g, " ").trim();

export const normKey = (v) => {
  let t = String(v ?? "").trim();
  if (/^\d+\.0+$/.test(t)) t = t.replace(/\.0+$/, "");
  return ["nan", "none", "null", "undefined"].includes(t.toLowerCase()) ? "" : t;
};

export const ahora = () => new Date().toLocaleString("sv-SE", { timeZone: TZ });

const enc = encodeURIComponent;
const dec = decodeURIComponent;

export function cruzar(sci, envia) {
  const porDoc = new Map();
  for (const e of envia) {
    const doc = normKey(e.num_documentos);
    if (!doc) continue;
    const guia = normKey(e.guia).slice(-12).padStart(12, "0");
    if (!porDoc.has(doc)) porDoc.set(doc, []);
    porDoc.get(doc).push({
      guia,
      nom_destinatario: txt(e.nom_destinatario),
      dir_destinatario: txt(e.dir_destinatario),
      ciudest: txt(e.ciudest),
    });
  }

  const filas = [];
  const sinGuia = new Set();
  const todos = new Set();
  for (const r of sci) {
    const doc = normKey(r.num_documentos);
    const olpns = String(r.texto_guia ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x && !["nan", "none"].includes(x.toLowerCase()));
    olpns.forEach((olpn, i) => {
      todos.add(olpn);
      const envs = porDoc.get(doc);
      if (!envs) return sinGuia.add(olpn);
      for (const e of envs) {
        filas.push({
          olpn,
          indiceolpn: i + 1,
          num_documentos: doc,
          telefono_destinatario: normKey(r.telefono_destinatario),
          peso_real_k: txt(r.peso_real_k),
          peso_volumen_k: txt(r.peso_volumen_k),
          valor_declarado: txt(r.valor_declarado),
          num_unidades: txt(r.num_unidades),
          obs: txt(r.obs),
          ...e,
        });
      }
    });
  }
  const cuenta = new Map();
  for (const f of filas) cuenta.set(f.olpn, (cuenta.get(f.olpn) || 0) + 1);
  const duplicados = [...cuenta].filter(([, n]) => n > 1).map(([o]) => o);
  return { filas, sinGuia: [...sinGuia], duplicados, totalOlpn: todos.size };
}

const LOGO_GFA = "^FO600,100^GFA,1232,1232,16,T01FF,S03JF8,R01LF,R0MFC,Q03NF,Q0OF8,P01OFC,P07OFE,P0QF,O01QF8,O03QFC,O07QFC,O0RFE,N01KF800JFEM018,N01JFEI03JFM073,N03JF8I01JFL01EE,N07JFJ01JFL0FF8,N07IFEK0JFK03FF,N0JFCK0JFK0FFE,N0JF8K0JF8I03FF8,N0JF83NF8J0FF,M01JF03NF8I01FC,M01JF03NFJ07F8,M01IFE07NFI03FE,M03IFE07NFI0FFC,M03IFE07NF003FF8,M03IFE07NF00FFE,M03IFE07NF03FFC,M03IFC03MFE0IF,M03IFC03MFE3FFE,M03IFCO01IFC,M03IFCO07IF,M03IFEN01IFE,M03IFEN0JF8,M03IFEM07JF,M03JFL03JFE,M01JF8J03KF8,M01JFEI03LF,M01TFC,N0TF8,N0SFE,N07RFC,N03RF,N01QFC,O0QF,O07OFC,O03OF,O01NF8,P07LFC,P01KFE,Q03IFE,S06,,gK02,003FFC03F07FE3FC007F3F007FF3E,00JF03F9IF3FC00JF81KF,03JF83KF9FE01JFC7KF8,07JF87KFDFE01JF8LF,0KFC7KFDFE03FF7F1LF,1KFE7NF03FE3E3LF,3FF81FE7FF03FEFF07FC7JF83FF,3FE00JFC03FCFF0FFCJFE01FF,7NF803FCFF0FF8JFC00FE,7NF803FCFF1FF0JF800FE,7NF003FC7FBFF0JF001FE,7NF007FC7FBFE1JF001FE,OF007F87IFC1JF001FE,FF80303FE007F83IF81JF003FC,FF00301FE007F83IF81FEFF007FC,7F807C1FE00FF83IF03FEFF00FFC,7JFE3FE00FF03FFE03FCLFC,3KF3FC00FF01FFE03FC7KF8,3KF3FC00FF01FFC03FC3KF8,1JFE3FC00FF01FF803FC3KF8,0JFC3FC00FF01FF003FC1KF8,07IF03FC00FE00FF003F807JF8,00FF8X01FC,^FS";

export function construirZpl(f) {
  const dir = txt(f.dir_destinatario);
  const ciudest = txt(f.ciudest);
  const m = ciudest.match(/^(.*?)-(.*)$/);
  const ciudes = m ? `${m[1]}-${m[2].slice(0, 5)}` : ciudest;
  const guia = txt(f.guia);
  return `^XA
^CI28
${LOGO_GFA}
^BY2,5,80
^FO400,200^BCN,N,N^FD${guia}^FS
^CFF,24
^FO80,310^FDGuia:${guia}^FS
^FO80,340^FDREMITE:^FS
^FO210,340^FDFALABELLACOM SAS IKEA^FS
^FO80,370^FDKM 8.5 AUT. BOG MED BDG800 PQ LOG LA^FS
^FO80,400^FDTENJO-CUNDINAMARCA^FS
^FO80,430^FDTELEFONO: 4842220^FS
^FO60,460^GB690,8,8^FS
^CFF,20
^FO80,480^FDDocs:${txt(f.num_documentos)}^FS
^FO350,480^FDOLPN:${txt(f.olpn)}^FS
^FO60,520^GB690,220,8^FS
^CFF,25
^FO80,540^FDDESTINO:${ciudes}(Reg.Dest:${txt(f.obs)})^FS
^FO80,570^FD${txt(f.nom_destinatario)}^FS
^FO80,600^FD${dir.slice(0, 40)}^FS
^FO80,630^FD${dir.slice(40, 80)}^FS
^FO80,660^FDTELEFONO ${txt(f.telefono_destinatario)}^FS
^CF0,22
^FO80,690^FDPeso Kg: ${txt(f.peso_real_k)}^FS
^FO250,690^FD|^FS
^FO265,690^FDVolumen ${txt(f.peso_volumen_k)}^FS
^FO420,690^FD|^FS
^FO435,690^FDVr.Declarado: $${txt(f.valor_declarado)}^FS
^FO80,710^FD(Caja ${f.indiceolpn} de ${txt(f.num_unidades)})^FS
^XZ
`;
}

const prefijoAudit = (auditId) => `a/${auditId}/`;
const prefijoOlpn = (auditId, olpn, guia) => `${prefijoAudit(auditId)}${enc(olpn)}|${enc(guia)}|`;

export function parsearAudit(keys, auditId) {
  const pre = prefijoAudit(auditId);
  const vistos = new Map();
  for (const k of keys) {
    const [olpn, guia, fecha, estacion] = k.slice(pre.length).split("|").map(dec);
    const id = `${olpn}|${guia}`;
    const prev = vistos.get(id);
    if (!prev || fecha < prev.fecha_hora) vistos.set(id, { olpn, guia, fecha_hora: fecha, estacion });
  }
  return [...vistos.values()].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
}

// ---------------------------------------------------------------------------
// Lógica con almacenamiento
// ---------------------------------------------------------------------------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const fallo = (msg, status = 400) => json({ error: msg }, status);

async function leerMeta(s) {
  return (await s.get("meta", { type: "json" })) || null;
}

async function leerCruce(s, meta) {
  if (!meta) return null;
  return (await s.get(`c/${meta.cruceId}`, { type: "json" })) || null;
}

async function leerAudit(s, meta) {
  const { blobs } = await s.list({ prefix: prefijoAudit(meta.auditId) });
  return parsearAudit(blobs.map((b) => b.key), meta.auditId);
}

function calcularPendientes(filas, audit) {
  const impresos = new Set(audit.map((a) => `${a.olpn}|${a.guia}`));
  const vistos = new Set();
  const out = [];
  for (const f of filas) {
    const id = `${f.olpn}|${f.guia}`;
    if (vistos.has(id) || impresos.has(id)) continue;
    vistos.add(id);
    out.push({ olpn: f.olpn, guia: f.guia, num_documentos: f.num_documentos,
               nom_destinatario: f.nom_destinatario, ciudest: f.ciudest });
  }
  return out;
}

const SCI_NECESARIAS = ["num_documentos", "texto_guia", "telefono_destinatario", "peso_real_k",
  "peso_volumen_k", "valor_declarado", "num_unidades", "obs"];
const ENVIA_NECESARIAS = ["guia", "num_documentos", "nom_destinatario", "dir_destinatario", "ciudest"];

export function crearHandler(obtenerStore) {
  return async (req) => {
    const url = new URL(req.url);
    const ruta = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");

    const pin = process.env.APP_PIN;
    if (pin && req.headers.get("x-app-pin") !== pin) return fallo("PIN incorrecto", 401);

    try {
      const s = obtenerStore();
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

      switch (`${req.method} ${ruta}`) {
        case "GET status": {
          const meta = await leerMeta(s);
          if (!meta) return json({ cargado: false });
          const filas = (await leerCruce(s, meta)) || [];
          const audit = await leerAudit(s, meta);
          const pend = calcularPendientes(filas, audit).length;
          const total = new Set(filas.map((f) => `${f.olpn}|${f.guia}`)).size;
          return json({ cargado: true, archivos: meta.archivos, cargado_en: meta.cargado_en,
                        total, pendientes: pend, impresos: total - pend });
        }

        case "POST upload": {
          const { sci, envia, resetAudit, archivos } = body;
          if (!Array.isArray(sci) || !Array.isArray(envia) || !sci.length || !envia.length)
            return fallo("Faltan los datos de SCI o ENVIA");
          const faltaS = SCI_NECESARIAS.filter((c) => !(c in sci[0]));
          if (faltaS.length) return fallo(`Faltan columnas en SCI: ${faltaS.join(", ")}`);
          const faltaE = ENVIA_NECESARIAS.filter((c) => !(c in envia[0]));
          if (faltaE.length) return fallo(`Faltan columnas en ENVIA: ${faltaE.join(", ")}`);

          const r = cruzar(sci, envia);
          if (!r.filas.length) return fallo("El cruce SCI–ENVIA por num_documentos no produjo registros");

          const anterior = await leerMeta(s);
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const meta = {
            cruceId: id,
            auditId: resetAudit || !anterior ? id : anterior.auditId,
            archivos: archivos || null,
            cargado_en: ahora(),
          };
          await s.setJSON(`c/${id}`, r.filas);
          await s.setJSON("meta", meta);
          if (anterior?.cruceId && anterior.cruceId !== id) await s.delete(`c/${anterior.cruceId}`).catch(() => {});

          return json({
            status: "Archivos cargados y combinados exitosamente",
            filas_sci: sci.length,
            olpns: r.totalOlpn,
            olpns_cruzados: new Set(r.filas.map((f) => f.olpn)).size,
            olpns_sin_guia: r.sinGuia,
            olpns_duplicados: r.duplicados,
            auditoria_reiniciada: meta.auditId === id && !!anterior,
          });
        }

        case "POST etiqueta": {
          const olpn = String(body.olpn || "").trim();
          if (!olpn) return fallo("OLPN requerido");
          const meta = await leerMeta(s);
          const filas = await leerCruce(s, meta);
          if (!filas) return fallo("No se ha cargado ningún archivo Excel");
          const f = filas.find((x) => x.olpn === olpn);
          if (!f) return fallo(`No se encontró el OLPN: ${olpn}`, 404);
          const { blobs } = await s.list({ prefix: prefijoOlpn(meta.auditId, f.olpn, f.guia) });
          return json({
            zpl: construirZpl(f),
            olpn: f.olpn,
            guia: f.guia,
            destinatario: f.nom_destinatario,
            destino: f.ciudest,
            caja: `${f.indiceolpn} de ${f.num_unidades}`,
            reimpresion: blobs.length > 0,
          });
        }

        case "POST registrar": {
          const olpn = String(body.olpn || "").trim();
          const guia = String(body.guia || "").trim();
          const estacion = String(body.estacion || "sin nombre").trim().slice(0, 40);
          if (!olpn || !guia) return fallo("OLPN y guía requeridos");
          const meta = await leerMeta(s);
          if (!meta) return fallo("No se ha cargado ningún archivo Excel");
          const pre = prefijoOlpn(meta.auditId, olpn, guia);
          const { blobs } = await s.list({ prefix: pre });
          if (!blobs.length) await s.set(`${pre}${enc(ahora())}|${enc(estacion)}`, "1");
          return json({ registrado: !blobs.length });
        }

        case "GET pendientes": {
          const meta = await leerMeta(s);
          const filas = await leerCruce(s, meta);
          if (!filas) return fallo("No se ha cargado ningún archivo Excel");
          return json(calcularPendientes(filas, await leerAudit(s, meta)));
        }

        case "GET auditoria": {
          const meta = await leerMeta(s);
          if (!meta) return json([]);
          return json(await leerAudit(s, meta));
        }

        default:
          return fallo("Ruta no encontrada", 404);
      }
    } catch (e) {
      return fallo(`Error interno: ${e.message}`, 500);
    }
  };
}

export default crearHandler(() => getStore({ name: "etiquetas", consistency: "strong" }));

export const config = { path: "/api/*" };
