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
  const now = new Date().toISOString();
  const payload = {
    ...data,
    status: data.status || "pendente",
    created_date: now,
    updated_date: now,
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
 * Implementação: na primeira snapshot envia um "reset" com todos os
 * pedidos; nas snapshots seguintes compara com o estado anterior e
 * emite eventos `create`, `update`, `delete` para cada alteração.
 *
 * @param {(event: {type, id?, data?}) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeOrders(callback) {
  let previous = new Map(); // id -> data
  let firstEmit = true;

  const q = query(
    collection(db, "orders"),
    orderBy("created_date", "desc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const current = new Map();
      snap.docs.forEach((d) => {
        current.set(d.id, normalizeTimestamp({ id: d.id, ...d.data() }));
      });

      if (firstEmit) {
        // Carregamento inicial: emite um "snapshot" com tudo
        callback({ type: "snapshot", data: Array.from(current.values()) });
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
    },
    (err) => console.error("[db] subscribeOrders error:", err)
  );
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
      tagline: null,
      payment_methods: ["mbway", "multibanco", "cartao", "numerario"],
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
