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
  if (!data.table_number) {
    console.warn("[db] createOrder chamado sem table_number — usando '1'.");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("createOrder: items[] vazio ou inválido.");
  }

  const payload = {
    // Campos obrigatórios do modelo
    table_number: String(data.table_number || "1"),
    items: data.items.map((i) => ({
      product_id: String(i.product_id || ""),
      product_name: String(i.product_name || ""),
      quantity: Number(i.quantity) || 1,
      unit_price: Number(i.unit_price) || 0,
      total: Number(i.total) || 0,
    })),
    total_amount: Number(data.total_amount) || 0,
    status: data.status || "pendente",
    // Campos opcionais
    notes: data.notes || null,
    // Timestamps — usa Date nativo (serializado como ISO string) para
    // ordenação lexicográfica estável em `orderBy("created_date","desc")`.
    // NOTA: não usamos serverTimestamp() porque queremos consistência
    // entre created_date (escrita) e o que chega ao onSnapshot (leitura).
    created_date: isoNow,
    updated_date: isoNow,
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
