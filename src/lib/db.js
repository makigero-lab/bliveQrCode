// src/lib/db.js
// -------------------------------------------------------------
// Camada de acesso a dados (Firestore) para o bliveQrCode.
//
// Centraliza todas as operações CRUD e de tempo real sobre as
// coleções `products`, `orders` e `settings` para que os
// componentes não tenham de importar diretamente `firebase/firestore`.
//
// Convenções:
//   - Cada documento de `products` tem um `id` próprio (doc.id) que
//     é adicionado ao objeto devolvido para compatibilidade com o
//     código que vinha da Base44 (espera `product.id`).
//   - O mesmo se aplica a `orders`.
//   - `settings` é uma coleção com um único documento de id "bar".
// -------------------------------------------------------------

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

// Adiciona o `id` do documento ao objeto devolvido pelo Firestore
function withId(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

// Converte Timestamp do Firestore para ISO string (compatível com
// o que a Base44 devolvia em `created_date`).
function normalizeTimestamp(data) {
  if (!data) return data;
  const out = { ...data };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (v && typeof v.toDate === "function") {
      out[key] = v.toDate().toISOString();
    }
  }
  return out;
}

// -------------------------------------------------------------
// Produtos — coleção "products"
// -------------------------------------------------------------
const PRODUCTS_COL = "products";

export async function listProducts() {
  const snap = await getDocs(collection(db, PRODUCTS_COL));
  return snap.docs
    .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      // ordena por created_date desc (se existir)
      const aT = a.created_date ? new Date(a.created_date).getTime() : 0;
      const bT = b.created_date ? new Date(b.created_date).getTime() : 0;
      return bT - aT;
    });
}

export async function listAvailableProducts() {
  const q = query(
    collection(db, PRODUCTS_COL),
    where("available", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    normalizeTimestamp({ id: d.id, ...d.data() })
  );
}

export async function createProduct(data) {
  const now = new Date().toISOString();
  const payload = { ...data, created_date: now, updated_date: now };
  const ref = await addDoc(collection(db, PRODUCTS_COL), payload);
  return { id: ref.id, ...payload };
}

export async function updateProduct(id, patch) {
  const ref = doc(db, PRODUCTS_COL, id);
  const payload = { ...patch, updated_date: new Date().toISOString() };
  await updateDoc(ref, payload);
  return { id, ...payload };
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, PRODUCTS_COL, id));
  return { id };
}

// Subscrição em tempo real a todos os produtos
export function subscribeProducts(callback) {
  const q = collection(db, PRODUCTS_COL);
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) =>
        normalizeTimestamp({ id: d.id, ...d.data() })
      );
      // Emite um "evento" único para compatibilidade com a interface
      // antiga (que esperava eventos create/update/delete).
      callback({ type: "snapshot", data: items });
    },
    (err) => console.error("[db] subscribeProducts error:", err)
  );
}

// -------------------------------------------------------------
// Pedidos — coleção "orders"
// -------------------------------------------------------------

/**
 * Lista pedidos ordenados por created_date desc.
 * @param {number} [limit=500]
 * @returns {Promise<Array>}
 */
export async function listOrders(limit = 500) {
  const q = query(
    collection(db, "orders"),
    orderBy("created_date", "desc")
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) =>
    normalizeTimestamp({ id: d.id, ...d.data() })
  );
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export async function createOrder(data) {
  // Normaliza o payload para garantir consistência entre todos os
  // pedidos (evita que o `subscribeOrders` falhe silenciosamente
  // por causa de campos em falta).
  const now = new Date();
  const isoNow = now.toISOString();

  // Validação mínima dos campos obrigatórios
  if (!data.table_number && !data.table) {
    console.warn("[db] createOrder chamado sem table/table_number — usando '1'.");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("createOrder: items[] vazio ou inválido.");
  }

  // `table` é o novo campo normalizado (String). Mantemos `table_number`
  // por retrocompatibilidade com Admin.jsx / OrderCard.jsx / pedidos antigos.
  const tableStr = String(data.table || data.table_number || "1");

  const payload = {
    // Campos obrigatórios do modelo
    table: tableStr,
    table_number: tableStr, // legacy
    items: data.items.map((i) => ({
      product_id: String(i.product_id || ""),
      product_name: String(i.product_name || ""),
      quantity: Number(i.quantity) || 1,
      unit_price: Number(i.unit_price) || 0,
      total: Number(i.total) || 0,
    })),
    total_amount: Number(data.total_amount) || 0,
    status: data.status || "pendente",
    // Estado da conta (open = mesa aberta; closed = mesa fechada/paga)
    tab_status: data.tab_status || "open",
    // Campos opcionais
    notes: data.notes || null,
    // Timestamps — usa Date nativo (serializado como ISO string) para
    // ordenação lexicográfica estável em `orderBy("created_date","desc")`.
    // NOTA: não usamos serverTimestamp() porque queremos consistência
    // entre created_date (escrita) e o que chega ao onSnapshot (leitura).
    created_date: isoNow,
    updated_date: isoNow,
    closed_at: null, // preenchido quando tab_status muda para "closed"
    // serverTimestamp em paralelo para auditoria no Firebase Console
    _server_created_at: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "orders"), payload);
  return { id: ref.id, ...payload };
}

export async function updateOrder(id, patch) {
  const ref = doc(db, "orders", id);
  const payload = { ...patch, updated_date: new Date().toISOString() };
  await updateDoc(ref, payload);
  return { id, ...payload };
}

export async function deleteOrder(id) {
  await deleteDoc(doc(db, "orders", id));
  return { id };
}

/**
 * Subscreve pedidos em tempo real, ordenados por created_date desc.
 * Emite eventos individuais { type, id, data } para compatibilidade
 * com os componentes Admin.jsx e Staff.jsx que vieram da Base44.
 *
 * Implementação:
 *   1. Tenta usar `query(collection, orderBy("created_date","desc"))`.
 *   2. Se essa query falhar (ex.: documentos antigos sem o campo
 *      `created_date`, o que faz o Firestore devolver um erro de
 *      "permission-denied" ou "failed-precondition"), recorre
 *      automaticamente a uma query SEM orderBy e ordena no cliente.
 *   3. Em ambas as situações, a primeira snapshot emite
 *      `{type:"snapshot", data:[...]}`. As subsequentes fazem diff
 *      e emitem `{type:"create"|"update"|"delete", id, data}`.
 *
 * Isto torna o `onSnapshot` resiliente a dados legacy e garante
 * que novos pedidos chegam sempre ao /staff e /admin.
 *
 * @param {(event: {type, id?, data?}) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeOrders(callback) {
  let previous = new Map(); // id -> data
  let firstEmit = true;
  let unsub = null;

  // Ordena no cliente por created_date desc (fallback robusto)
  const sortByCreatedDesc = (a, b) => {
    const aT = a.created_date
      ? new Date(a.created_date).getTime()
      : 0;
    const bT = b.created_date
      ? new Date(b.created_date).getTime()
      : 0;
    return bT - aT;
  };

  const handleSnap = (snap) => {
    const current = new Map();
    snap.docs.forEach((d) => {
      current.set(
        d.id,
        normalizeTimestamp({ id: d.id, ...d.data() })
      );
    });

    if (firstEmit) {
      const sorted = Array.from(current.values()).sort(sortByCreatedDesc);
      callback({ type: "snapshot", data: sorted });
      firstEmit = false;
    } else {
      // Diff: descobre creates, updates e deletes
      for (const [id, data] of current.entries()) {
        if (!previous.has(id)) {
          callback({ type: "create", id, data });
        } else if (
          JSON.stringify(previous.get(id)) !== JSON.stringify(data)
        ) {
          callback({ type: "update", id, data });
        }
      }
      for (const id of previous.keys()) {
        if (!current.has(id)) {
          callback({ type: "delete", id });
        }
      }
    }

    previous = current;
  };

  const handleError = (err, isPrimary) => {
    console.error(
      `[db] subscribeOrders ${isPrimary ? "primary" : "fallback"} error:`,
      err
    );

    // Se a query com orderBy falhar, tenta a query simples (sem orderBy)
    if (isPrimary) {
      console.warn(
        "[db] subscribeOrders: a tentar query sem orderBy (fallback)..."
      );
      try {
        unsub = onSnapshot(
          collection(db, "orders"),
          handleSnap,
          (err2) => handleError(err2, false)
        );
      } catch (e) {
        console.error("[db] subscribeOrders fallback falhou:", e);
      }
    }
  };

  // Tentativa primária: com orderBy
  try {
    const q = query(
      collection(db, "orders"),
      orderBy("created_date", "desc")
    );
    unsub = onSnapshot(q, handleSnap, (err) => handleError(err, true));
  } catch (e) {
    // Se a própria construção da query lançar (raro), vai direto ao fallback
    handleError(e, true);
  }

  // Retorna função de unsubscribe que funciona seja qual for o ramo
  // ativo (primary ou fallback).
  return () => {
    if (typeof unsub === "function") unsub();
  };
}

// -------------------------------------------------------------
// Subscrições por tab_status (open / closed)
// -------------------------------------------------------------
//
// Usados pelo Staff.jsx (Mesas Abertas + Histórico).
// A query filtra no servidor por `tab_status`, mas mantém o padrão
// de eventos {type, id, data} para compatibilidade com o resto do código.
// Fallback: se a query com orderBy falhar (legacy), recorre a query
// sem orderBy + ordenação no cliente (igual ao `subscribeOrders`).
// -------------------------------------------------------------

/**
 * Subscreve pedidos com `tab_status == 'open'` (mesas abertas).
 * @param {(event: {type, id?, data?}) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeOpenOrders(callback) {
  return subscribeByTabStatus("open", callback);
}

/**
 * Subscreve pedidos com `tab_status == 'closed'` (histórico).
 * @param {(event: {type, id?, data?}) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeClosedOrders(callback) {
  return subscribeByTabStatus("closed", callback);
}

function subscribeByTabStatus(tabStatus, callback) {
  let previous = new Map();
  let firstEmit = true;
  let unsub = null;

  const sortByCreatedDesc = (a, b) => {
    const aT = a.created_date ? new Date(a.created_date).getTime() : 0;
    const bT = b.created_date ? new Date(b.created_date).getTime() : 0;
    return bT - aT;
  };

  const handleSnap = (snap) => {
    const current = new Map();
    snap.docs.forEach((d) => {
      current.set(
        d.id,
        normalizeTimestamp({ id: d.id, ...d.data() })
      );
    });

    if (firstEmit) {
      const sorted = Array.from(current.values()).sort(sortByCreatedDesc);
      callback({ type: "snapshot", data: sorted });
      firstEmit = false;
    } else {
      for (const [id, data] of current.entries()) {
        if (!previous.has(id)) {
          callback({ type: "create", id, data });
        } else if (
          JSON.stringify(previous.get(id)) !== JSON.stringify(data)
        ) {
          callback({ type: "update", id, data });
        }
      }
      for (const id of previous.keys()) {
        if (!current.has(id)) {
          callback({ type: "delete", id });
        }
      }
    }

    previous = current;
  };

  const handleError = (err, isPrimary) => {
    console.error(
      `[db] subscribeByTabStatus(${tabStatus}) ${isPrimary ? "primary" : "fallback"} error:`,
      err
    );

    if (isPrimary) {
      console.warn(
        `[db] subscribeByTabStatus(${tabStatus}): a tentar query sem orderBy (fallback)...`
      );
      try {
        unsub = onSnapshot(
          query(
            collection(db, "orders"),
            where("tab_status", "==", tabStatus)
          ),
          handleSnap,
          (err2) => handleError(err2, false)
        );
      } catch (e) {
        console.error(`[db] subscribeByTabStatus(${tabStatus}) fallback falhou:`, e);
      }
    }
  };

  try {
    const q = query(
      collection(db, "orders"),
      where("tab_status", "==", tabStatus),
      orderBy("created_date", "desc")
    );
    unsub = onSnapshot(q, handleSnap, (err) => handleError(err, true));
  } catch (e) {
    handleError(e, true);
  }

  return () => {
    if (typeof unsub === "function") unsub();
  };
}

/**
 * Fecha uma mesa: atualiza TODOS os pedidos com `tab_status == 'open'`
 * da mesa indicada para `tab_status == 'closed'`, em batch (400 em 400).
 * Define também `closed_at` com a data atual.
 *
 * @param {string} table — número/identificador da mesa
 * @returns {Promise<{closed: number}>}
 */
export async function closeTableOrders(table) {
  const tableStr = String(table);
  const now = new Date().toISOString();

  const q = query(
    collection(db, "orders"),
    where("tab_status", "==", "open"),
    where("table", "==", tableStr)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    // Fallback: pedidos legacy sem `table` mas com `table_number`
    const q2 = query(
      collection(db, "orders"),
      where("tab_status", "==", "open"),
      where("table_number", "==", tableStr)
    );
    const snap2 = await getDocs(q2);
    return _batchClose(snap2.docs, now);
  }

  return _batchClose(snap.docs, now);
}

async function _batchClose(docs, isoNow) {
  const BATCH_SIZE = 400;
  let closed = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    slice.forEach((d) => {
      batch.update(d.ref, {
        tab_status: "closed",
        closed_at: isoNow,
        updated_date: isoNow,
      });
    });
    await batch.commit();
    closed += slice.length;
  }

  return { closed };
}

// -------------------------------------------------------------
// BarSettings — documento único "bar" na coleção "settings"
// -------------------------------------------------------------
const SETTINGS_COL = "settings";
const SETTINGS_DOC_ID = "bar";

export async function getBarSettings() {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Devolve defaults se ainda não existir
    return {
      id: SETTINGS_DOC_ID,
      bar_name: "B'Live Lounge Bar",
      primary_color: "#E91E8C",
      logo_url: null,
      tagline: "Cocktails • Shishas • Comida",
    };
  }
  return { id: snap.id, ...snap.data() };
}

export async function saveBarSettings(data) {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
  await setDoc(ref, data, { merge: true });
  return { id: SETTINGS_DOC_ID, ...data };
}

/**
 * Subscreve alterações ao documento de configuração do bar.
 * @param {(settings: object) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeBarSettings(callback) {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      }
    },
    (err) => console.error("[db] subscribeBarSettings error:", err)
  );
}

// -------------------------------------------------------------
// Upload de imagens — usa FileReader para data URL (sem Storage)
//
// Mantém a interface antiga `base44.integrations.Core.UploadFile`
// para que SettingsPanel.jsx continue a funcionar sem alterações.
// -------------------------------------------------------------
export async function uploadFile({ file }) {
  if (!file) throw new Error("Nenhum ficheiro fornecido a uploadFile.");
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { file_url: dataUrl, file_name: file.name };
}

// -------------------------------------------------------------
// Mesas (coleção `tables`) — IDs seguros para QR Codes
// -------------------------------------------------------------
//
// Cada mesa tem um documento com:
//   - id: hash aleatório de 8 chars (gerado por `generateTableId`)
//   - table_number: String com o número amigável da mesa (ex: "3")
//   - created_date: ISO string
//
// O QR code aponta para `/menu?m=<id>` em vez de `/menu?mesa=3`.
// O /menu valida o `?m=` consultando esta coleção. Se o ID não
// existir, a app bloqueia com "Mesa Inválida" — assim clientes
// não podem falsificar o número da mesa no URL.
//
// Coleção: `tables`
// -------------------------------------------------------------

const TABLES_COL = "tables";

/**
 * Gera um ID aleatório de 8 chars [A-Za-z0-9].
 * Suficiente para evitar adivinhação (62^8 ≈ 218 triliões).
 */
export function generateTableId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * Cria uma nova mesa na coleção `tables`.
 * @param {string} tableNumber — número amigável (ex: "3")
 * @returns {Promise<{id, table_number, created_date}>}
 */
export async function createTable(tableNumber) {
  const id = generateTableId();
  const now = new Date().toISOString();
  const payload = {
    table_number: String(tableNumber),
    created_date: now,
  };
  // Usa setDoc com id próprio (não addDoc) para garantir o id
  // gerado client-side.
  await setDoc(doc(db, TABLES_COL, id), payload);
  return { id, ...payload };
}

/**
 * Lê uma mesa pelo ID (usado pelo /menu para validar ?m=).
 * @param {string} mid — ID da mesa (8 chars)
 * @returns {Promise<{id, table_number, created_date} | null>}
 */
export async function getTableByMid(mid) {
  if (!mid) return null;
  const ref = doc(db, TABLES_COL, String(mid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeTimestamp({ id: snap.id, ...snap.data() });
}

/**
 * Lista todas as mesas ordenadas por table_number asc.
 * @returns {Promise<Array>}
 */
export async function listTables() {
  const snap = await getDocs(collection(db, TABLES_COL));
  const items = snap.docs.map((d) =>
    normalizeTimestamp({ id: d.id, ...d.data() })
  );
  // Ordena por table_number (numérico quando possível)
  return items.sort((a, b) => {
    const aN = parseInt(a.table_number) || 0;
    const bN = parseInt(b.table_number) || 0;
    return aN - bN;
  });
}

/**
 * Apaga uma mesa pelo ID.
 * @param {string} mid — ID da mesa
 */
export async function deleteTable(mid) {
  await deleteDoc(doc(db, TABLES_COL, String(mid)));
  return { id: mid };
}

/**
 * Subscreve a lista de mesas em tempo real (para o painel Admin).
 * @param {(tables: Array) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeTables(callback) {
  const q = collection(db, TABLES_COL);
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aN = parseInt(a.table_number) || 0;
          const bN = parseInt(b.table_number) || 0;
          return aN - bN;
        });
      callback(items);
    },
    (err) => console.error("[db] subscribeTables error:", err)
  );
}

// -------------------------------------------------------------
// Utilizadores (coleção `users`) — gestão de roles
// -------------------------------------------------------------
//
// Cada utilizador tem um documento na coleção `users` com:
//   - id: uid do Firebase Auth (igual ao `user.uid`)
//   - email: String
//   - role: "admin" | "staff"
//   - created_date: ISO string
//
// As regras de segurança do Firestore devem permitir:
//   - Leitura de `users/{uid}` pelo próprio utilizador
//     (para carregar a sua role após login).
//   - Leitura/escrita de todos os `users/*` só para admins.
//
// Coleção: `users`
// -------------------------------------------------------------

const USERS_COL = "users";

/**
 * Lê o perfil (role) de um utilizador pelo uid do Firebase Auth.
 * Usado pelo AuthContext após onAuthStateChanged para carregar a role.
 *
 * @param {string} uid
 * @returns {Promise<{uid, email, role, created_date} | null>}
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const ref = doc(db, USERS_COL, String(uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeTimestamp({ uid: snap.id, ...snap.data() });
}

/**
 * Cria (ou substitui) o perfil de um utilizador.
 * Usado pelo UsersPanel quando o admin cria um novo utilizador.
 *
 * @param {string} uid — uid do Firebase Auth (criado via createUserWithEmailAndPassword)
 * @param {{email: string, role: "admin"|"staff"}} data
 */
export async function setUserProfile(uid, data) {
  const now = new Date().toISOString();
  const payload = {
    email: String(data.email || ""),
    role: data.role === "admin" ? "admin" : "staff",
    created_date: now,
    updated_date: now,
  };
  await setDoc(doc(db, USERS_COL, String(uid)), payload, { merge: true });
  return { uid, ...payload };
}

/**
 * Lista todos os utilizadores (admins + staff).
 * @returns {Promise<Array>}
 */
export async function listUsers() {
  const snap = await getDocs(collection(db, USERS_COL));
  const items = snap.docs.map((d) =>
    normalizeTimestamp({ uid: d.id, ...d.data() })
  );
  // admins primeiro, depois por email
  return items.sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return String(a.email).localeCompare(String(b.email));
  });
}

/**
 * Subscreve a lista de utilizadores em tempo real.
 * @param {(users: Array) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeUsers(callback) {
  const q = collection(db, USERS_COL);
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) =>
          normalizeTimestamp({ uid: d.id, ...d.data() })
        )
        .sort((a, b) => {
          if (a.role === "admin" && b.role !== "admin") return -1;
          if (a.role !== "admin" && b.role === "admin") return 1;
          return String(a.email).localeCompare(String(b.email));
        });
      callback(items);
    },
    (err) => console.error("[db] subscribeUsers error:", err)
  );
}

/**
 * Apaga o perfil de um utilizador (não apaga a conta Firebase Auth —
 * para isso seria necessário Firebase Admin SDK no backend).
 *
 * Como workaround, o UsersPanel apaga o perfil do Firestore. A conta
 * Auth continua a existir mas sem perfil → login falha com
 * "utilizador não tem perfil".
 *
 * @param {string} uid
 */
export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, USERS_COL, String(uid)));
  return { uid };
}
