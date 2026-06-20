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
  limit,
  startAfter,
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
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("createOrder: items[] vazio ou inválido.");
  }

  // `table` é o novo campo normalizado (String). Mantemos `table_number`
  // por retrocompatibilidade com Admin.jsx / OrderCard.jsx / pedidos antigos.
  const tableStr = String(data.table || data.table_number || "1");

  // === Regra do Novo Talão (Ticket) vs Merge ===
  //
  // Quando um cliente (ou staff) submete um pedido para uma mesa:
  //
  //   1. Procura o pedido MAIS RECENTE dessa mesa com tab_status="open".
  //   2. Se esse pedido tem status="recebido" → MERGE (junta os novos
  //      itens ao documento existente, pois o barman ainda não preparou).
  //   3. Se esse pedido tem status="pronto" ou "entregue" → NÃO faz merge.
  //      Cria um NOVO documento com tab_status="open" + status="recebido"
  //      (novo talão para o barman preparar, mas mesma conta de faturação).
  //
  // Quando o staff fecha a conta (tab_status → "closed"), a mesa fica
  // "limpa" e o próximo pedido cria obrigatoriamente um novo documento.
  const mergeResult = await tryMergeWithOpenOrder(tableStr, data.items, data.notes);

  if (mergeResult.merged) {
    return mergeResult.order;
  }

  // Não fez merge — cria pedido novo
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
      // Timestamp de quando este item foi adicionado ao pedido.
      // Itens do pedido original têm added_at = created_date.
      // Itens adicionados via merge têm added_at = timestamp do merge.
      // O barman usa isto para distinguir "novo" de "original".
      added_at: isoNow,
    })),
    total_amount: Number(data.total_amount) || 0,
    // Estado da conta (open = mesa aberta; closed = mesa fechada/paga)
    tab_status: data.tab_status || "open",
    // Estado individual do pedido (linha de montagem):
    //   recebido → pronto → entregue
    // Permite que Barman, Empregado de Mesa e Caixa trabalhem em funções
    // separadas. Default: "recebido" (acaba de entrar no sistema).
    status: data.status || "recebido",
    // Campos opcionais
    notes: data.notes || null,
    // Auditoria: quem criou o pedido. Se vier do /menu (cliente),
    // estes campos ficam null. Se vier do POS (staff), ficam
    // preenchidos com o uid e email do staff.
    created_by_uid: data.created_by_uid || null,
    created_by_email: data.created_by_email || null,
    // source: "menu" (cliente via QR) ou "pos" (staff via POS Modal)
    source: data.source || "menu",
    // Timestamps
    created_date: isoNow,
    updated_date: isoNow,
    closed_at: null,
    _server_created_at: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "orders"), payload);
  return { id: ref.id, ...payload };
}

/**
 * Procura o pedido MAIS RECENTE aberto (tab_status=open) e "recebido"
 * (ainda não foi tratado pelo barman) da mesa indicada. Se existir,
 * faz merge dos novos itens a esse documento.
 *
 * Regra do Novo Talão vs Merge:
 *   - Se o último pedido da mesa ainda está "recebido" → MERGE
 *     (o barman ainda não começou a preparar, faz sentido juntar).
 *   - Se o último pedido já está "pronto" ou "entregue" → NÃO faz
 *     merge. O createOrder cria um NOVO documento com status="recebido"
 *     (novo talão para o barman preparar).
 *
 * Usa orderBy("created_date", "desc") + limit(1) para garantir que
 * faz merge apenas com o pedido MAIS RECENTE (não com um antigo
 * que ainda esteja "recebido" por engano).
 *
 * @param {string} tableStr
 * @param {Array} newItems
 * @param {string|null} newNotes
 * @returns {Promise<{merged: boolean, id?: string, order?: object}>}
 */
async function tryMergeWithOpenOrder(tableStr, newItems, newNotes) {
  try {
    // Procura o pedido MAIS RECENTE aberto e "recebido" da mesa
    const q = query(
      collection(db, "orders"),
      where("tab_status", "==", "open"),
      where("table", "==", tableStr),
      where("status", "==", "recebido"),
      orderBy("created_date", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      // Fallback: pedidos legacy sem `table` (usam table_number)
      const q2 = query(
        collection(db, "orders"),
        where("tab_status", "==", "open"),
        where("table_number", "==", tableStr),
        where("status", "==", "recebido"),
        orderBy("created_date", "desc"),
        limit(1)
      );
      const snap2 = await getDocs(q2);
      if (snap2.empty) return { merged: false };
      return _doMerge(snap2.docs[0], newItems, newNotes);
    }

    // Faz merge com o pedido "recebido" mais recente
    return _doMerge(snap.docs[0], newItems, newNotes);
  } catch (err) {
    return { merged: false };
  }
}

async function _doMerge(orderDoc, newItems, newNotes) {
  const existing = normalizeTimestamp({
    id: orderDoc.id,
    ...orderDoc.data(),
  });
  const existingItems = Array.isArray(existing.items) ? existing.items : [];
  const mergeTs = new Date().toISOString();

  // Faz merge dos itens: soma quantidades se product_id já existe
  const mergedItems = [...existingItems];
  for (const newItem of newItems) {
    const idx = mergedItems.findIndex(
      (i) => i.product_id === newItem.product_id
    );
    if (idx >= 0) {
      // Item já existe → soma quantidade e marca quanto foi adicionado
      const addedQty = Number(newItem.quantity) || 0;
      mergedItems[idx] = {
        ...mergedItems[idx],
        quantity: (Number(mergedItems[idx].quantity) || 0) + addedQty,
        total:
          (Number(mergedItems[idx].total) || 0) + (Number(newItem.total) || 0),
        // Marca quantas unidades foram adicionadas neste merge.
        // O barman vê "+2" ao lado da quantidade total.
        last_merge_qty: addedQty,
        last_merge_at: mergeTs,
      };
    } else {
      // Item novo (não existia no pedido original) → marca como "novo"
      mergedItems.push({
        product_id: String(newItem.product_id || ""),
        product_name: String(newItem.product_name || ""),
        quantity: Number(newItem.quantity) || 1,
        unit_price: Number(newItem.unit_price) || 0,
        total: Number(newItem.total) || 0,
        // Timestamp do merge → o barman vê badge "novo" neste item
        added_at: mergeTs,
      });
    }
  }

  // Soma total
  const newTotalAmount =
    (Number(existing.total_amount) || 0) +
    newItems.reduce((s, i) => s + (Number(i.total) || 0), 0);

  // Concatena notes (se ambas existirem)
  let mergedNotes = existing.notes || null;
  if (newNotes) {
    mergedNotes = mergedNotes
      ? `${mergedNotes} | ${newNotes}`
      : newNotes;
  }

  const patch = {
    items: mergedItems,
    total_amount: newTotalAmount,
    notes: mergedNotes,
    updated_date: mergeTs,
    // Registra quantos merges foram feitos (auditoria)
    merge_count: (Number(existing.merge_count) || 0) + 1,
    last_merge_at: mergeTs,
  };

  await updateDoc(orderDoc.ref, patch);

  return {
    merged: true,
    id: orderDoc.id,
    order: { ...existing, ...patch },
  };
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
 * Anula (estorna) um item individual de um pedido.
 *
 * Em vez de apagar o item do array, MOVE-o para `canceled_items`
 * (registo de auditoria) e ajusta o `total_amount` do pedido.
 *
 * Se todos os itens forem anulados, o pedido fica com
 * `status: "cancelado"` (desaparece da vista do barman mas
 * mantém-se na base de dados para auditoria).
 *
 * @param {string} orderId — id do documento na coleção orders
 * @param {number} itemIndex — índice do item no array `items`
 * @param {object} staffUser — { uid, email } do staff que anulou
 * @returns {Promise<{orderId, canceledItem, newTotal, orderStatus}>}
 */
export async function cancelOrderItem(orderId, itemIndex, staffUser) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Pedido não encontrado.");

  const order = normalizeTimestamp({ id: snap.id, ...snap.data() });
  const items = Array.isArray(order.items) ? order.items : [];
  const canceledItems = Array.isArray(order.canceled_items) ? order.canceled_items : [];

  // BLOQUEIA cancelamento se o pedido já foi entregue.
  // Não faz sentido anular itens que já estão na mesa do cliente.
  const currentStatus = order.status || "recebido";
  if (currentStatus === "entregue") {
    throw new Error("Não é possível anular itens de um pedido já entregue.");
  }

  if (itemIndex < 0 || itemIndex >= items.length) {
    throw new Error("Índice de item inválido.");
  }

  const itemToCancel = items[itemIndex];
  const itemTotal = Number(itemToCancel.total) || 0;
  const now = new Date().toISOString();

  // Move o item para canceled_items com auditoria
  canceledItems.push({
    ...itemToCancel,
    canceled_at: now,
    canceled_by_uid: staffUser?.uid || null,
    canceled_by_email: staffUser?.email || null,
  });

  // Remove do array de items ativos
  items.splice(itemIndex, 1);

  // Recalcula total
  const newTotal = items.reduce(
    (s, i) => s + (Number(i.total) || 0),
    0
  );

  // Se não há mais itens ativos, marca o pedido como cancelado
  const newStatus = items.length === 0 ? "cancelado" : order.status || "recebido";

  const patch = {
    items,
    canceled_items: canceledItems,
    total_amount: newTotal,
    status: newStatus,
    updated_date: now,
  };

  await updateDoc(ref, patch);

  return {
    orderId,
    canceledItem: itemToCancel,
    newTotal,
    orderStatus: newStatus,
  };
}

/**
 * Lista todos os pedidos com itens cancelados para a vista de
 * Auditoria do Admin. Procura por documentos que tenham o campo
 * `canceled_items` não vazio.
 *
 * @param {number} [limitCount=200]
 * @returns {Promise<Array>}
 */
export async function listCancellations(limitCount = 200) {
  try {
    const q = query(
      collection(db, "orders"),
      where("canceled_items", "!=", null),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const items = snap.docs
      .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
      .filter((o) => Array.isArray(o.canceled_items) && o.canceled_items.length > 0)
      .sort((a, b) => {
        // Ordena pelo canceled_at mais recente
        const aLast = a.canceled_items?.[a.canceled_items.length - 1]?.canceled_at;
        const bLast = b.canceled_items?.[b.canceled_items.length - 1]?.canceled_at;
        const aT = aLast ? new Date(aLast).getTime() : 0;
        const bT = bLast ? new Date(bLast).getTime() : 0;
        return bT - aT;
      });
    return items;
  } catch (err) {
    // Fallback: sem o where (pode falhar se não houver índice)
    try {
      const snap2 = await getDocs(collection(db, "orders"));
      return snap2.docs
        .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
        .filter((o) => Array.isArray(o.canceled_items) && o.canceled_items.length > 0)
        .sort((a, b) => {
          const aLast = a.canceled_items?.[a.canceled_items.length - 1]?.canceled_at;
          const bLast = b.canceled_items?.[b.canceled_items.length - 1]?.canceled_at;
          const aT = aLast ? new Date(aLast).getTime() : 0;
          const bT = bLast ? new Date(bLast).getTime() : 0;
          return bT - aT;
        })
        .slice(0, limitCount);
    } catch {
      return [];
    }
  }
}

/**
 * Lista todos os pedidos abertos (tab_status="open") de uma mesa
 * específica. Usado pelo ecrã "A Minha Conta" no Menu do cliente.
 *
 * @param {string} tableStr — número da mesa
 * @returns {Promise<Array>}
 */
export async function listOpenOrdersByTable(tableStr) {
  const table = String(tableStr);
  try {
    const q = query(
      collection(db, "orders"),
      where("tab_status", "==", "open"),
      where("table", "==", table)
    );
    const snap = await getDocs(q);
    const items = snap.docs
      .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aT = a.created_date ? new Date(a.created_date).getTime() : 0;
        const bT = b.created_date ? new Date(b.created_date).getTime() : 0;
        return aT - bT; // asc — mais antigo primeiro (ordem de pedido)
      });
    return items;
  } catch (err) {
    // Fallback: pedidos legacy sem `table`
    try {
      const q2 = query(
        collection(db, "orders"),
        where("tab_status", "==", "open"),
        where("table_number", "==", table)
      );
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aT = a.created_date ? new Date(a.created_date).getTime() : 0;
          const bT = b.created_date ? new Date(b.created_date).getTime() : 0;
          return aT - bT;
        });
    } catch {
      return [];
    }
  }
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
    // Se a query com orderBy falhar, tenta a query simples (sem orderBy)
    if (isPrimary) {
      try {
        unsub = onSnapshot(
          collection(db, "orders"),
          handleSnap,
          (err2) => handleError(err2, false)
        );
      } catch (e) {
        // fallback também falhou — não há mais nada a fazer
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
 * Carrega UMA PÁGINA de pedidos com `tab_status == 'closed'`
 * (histórico) — usado pelo Staff.jsx para paginação sob demanda.
 *
 * Em vez de carregar todos os pedidos fechados de uma vez (que
 * esgota as reads gratuitas do Firestore), carrega 20 de cada
 * vez. O Staff.jsx chama esta função quando o utilizador clica
 * em "Carregar Mais".
 *
 * Ordenação: por `closed_at` desc (mais recente primeiro).
 * Fallback: se a query com orderBy falhar, usa `created_date` desc.
 *
 * @param {object} [cursor] — cursor da última página (objeto do
 *   último documento carregado). Se null/undefined, carrega a
 *   primeira página.
 * @param {number} [pageSize=20] — tamanho da página.
 * @returns {Promise<{items: Array, nextCursor: object|null, hasMore: boolean}>}
 *   `nextCursor` é o último doc da página (para passar na próxima
 *   chamada). `hasMore=false` se esta página tiver menos de
 *   `pageSize` itens (não há mais dados).
 */
export async function loadClosedOrdersPage(cursor, pageSize = 20) {
  try {
    let q = query(
      collection(db, "orders"),
      where("tab_status", "==", "closed"),
      orderBy("closed_at", "desc"),
      limit(pageSize)
    );

    if (cursor) {
      q = query(q, startAfter(cursor));
    }

    const snap = await getDocs(q);

    if (snap.empty) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const items = snap.docs.map((d) =>
      normalizeTimestamp({ id: d.id, ...d.data() })
    );

    // Se veio menos que pageSize, não há mais dados
    const hasMore = snap.docs.length === pageSize;
    const nextCursor = hasMore ? snap.docs[snap.docs.length - 1] : null;

    return { items, nextCursor, hasMore };
  } catch (err) {

    // Fallback: sem orderBy (legacy) — ordena no cliente
    try {
      let q = query(
        collection(db, "orders"),
        where("tab_status", "==", "closed"),
        limit(pageSize)
      );

      if (cursor) {
        q = query(q, startAfter(cursor));
      }

      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => normalizeTimestamp({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aT = a.closed_at
            ? new Date(a.closed_at).getTime()
            : a.created_date
            ? new Date(a.created_date).getTime()
            : 0;
          const bT = b.closed_at
            ? new Date(b.closed_at).getTime()
            : b.created_date
            ? new Date(b.created_date).getTime()
            : 0;
          return bT - aT;
        });

      const hasMore = snap.docs.length === pageSize;
      const nextCursor = hasMore ? snap.docs[snap.docs.length - 1] : null;

      return { items, nextCursor, hasMore };
    } catch (fallbackErr) {
      return { items: [], nextCursor: null, hasMore: false };
    }
  }
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
    if (isPrimary) {
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
        // fallback também falhou
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
 *
 * Define também:
 *   - `closed_at` com a data atual (ISO string).
 *   - `closed_by_uid` com o uid do Firebase Auth do staff que fechou.
 *   - `closed_by_email` com o email do staff que fechou.
 *
 * Estes campos de auditoria são usados pelo histórico do /staff e
 * pelo CSV exportado pelo painel de Vendas.
 *
 * @param {string} table — número/identificador da mesa
 * @param {object} [staffUser] — utilizador autenticado que fecha a mesa
 * @param {string} [staffUser.uid]
 * @param {string} [staffUser.email]
 * @returns {Promise<{closed: number}>}
 */
export async function closeTableOrders(table, staffUser) {
  const tableStr = String(table);
  const now = new Date().toISOString();
  const closedByUid = staffUser?.uid || null;
  const closedByEmail = staffUser?.email || null;

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
    return _batchClose(snap2.docs, now, closedByUid, closedByEmail);
  }

  return _batchClose(snap.docs, now, closedByUid, closedByEmail);
}

async function _batchClose(docs, isoNow, closedByUid, closedByEmail) {
  const BATCH_SIZE = 400;
  let closed = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    slice.forEach((d) => {
      batch.update(d.ref, {
        tab_status: "closed",
        closed_at: isoNow,
        closed_by_uid: closedByUid,
        closed_by_email: closedByEmail,
        updated_date: isoNow,
      });
    });
    await batch.commit();
    closed += slice.length;
  }

  return { closed };
}

/**
 * Reabre uma mesa que estava fechada: atualiza TODOS os pedidos com
 * `tab_status == 'closed'` da mesa indicada para `tab_status == 'open'`.
 *
 * É o inverso de `closeTableOrders`. Usado pelo botão "Reabrir Mesa"
 * no histórico do /staff.
 *
 * Há duas estratégias consoante o modo:
 *
 * 1. Modo "session" (default): só reabre os pedidos que foram fechados
 *    no mesmo `closed_at` (i.e. a mesma sessão/conta). Isto evita
 *    reabrir pedidos antigos se a mesa foi fechada várias vezes.
 *
 * 2. Modo "all": reabre TODOS os pedidos fechados dessa mesa.
 *    Útil se a mesa só foi fechada uma vez.
 *
 * @param {string} table — identificador da mesa
 * @param {object} [options]
 * @param {string} [options.closedAt] — timestamp ISO da sessão a reabrir (modo session)
 * @param {"session"|"all"} [options.mode="session"]
 * @returns {Promise<{reopened: number}>}
 */
export async function reopenTableOrders(table, options = {}) {
  const tableStr = String(table);
  const { closedAt, mode = "session" } = options;
  const now = new Date().toISOString();

  // Constrói a query base: tab_status="closed" + mesa
  let q = query(
    collection(db, "orders"),
    where("tab_status", "==", "closed"),
    where("table", "==", tableStr)
  );
  let snap = await getDocs(q);

  if (snap.empty) {
    // Fallback: pedidos legacy sem `table` mas com `table_number`
    q = query(
      collection(db, "orders"),
      where("tab_status", "==", "closed"),
      where("table_number", "==", tableStr)
    );
    snap = await getDocs(q);
  }

  if (snap.empty) return { reopened: 0 };

  // Filtra no cliente conforme o modo
  let docsToReopen = snap.docs;
  if (mode === "session" && closedAt) {
    docsToReopen = snap.docs.filter((d) => {
      const data = d.data();
      // Compara o closed_at por string ISO (já que gravamos como ISO string)
      // ou por updated_date (fallback).
      return (data.closed_at || data.updated_date) === closedAt;
    });
  }

  if (docsToReopen.length === 0) return { reopened: 0 };

  // Batch update: tab_status → "open", limpa closed_at
  const BATCH_SIZE = 400;
  let reopened = 0;
  for (let i = 0; i < docsToReopen.length; i += BATCH_SIZE) {
    const slice = docsToReopen.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    slice.forEach((d) => {
      batch.update(d.ref, {
        tab_status: "open",
        closed_at: null,
        updated_date: now,
        reopened_at: now,
      });
    });
    await batch.commit();
    reopened += slice.length;
  }

  return { reopened };
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
 * @param {{email: string, role: "admin"|"staff", active?: boolean}} data
 */
export async function setUserProfile(uid, data) {
  const now = new Date().toISOString();
  const payload = {
    email: String(data.email || ""),
    role: data.role === "admin" ? "admin" : "staff",
    // `active` default true — se for false, login é rejeitado pelo
    // AuthContext (mesmo que a conta Auth exista). Isto permite
    // "desativar" um utilizador sem precisar de o apagar do Auth.
    active: data.active !== false,
    created_date: now,
    updated_date: now,
  };
  await setDoc(doc(db, USERS_COL, String(uid)), payload, { merge: true });
  return { uid, ...payload };
}

/**
 * Ativa ou desativa o perfil de um utilizador.
 * Quando `active=false`, o login é rejeitado no AuthContext
 * (mesmo que a conta Firebase Auth continue a existir).
 *
 * @param {string} uid
 * @param {boolean} active
 */
export async function setUserActive(uid, active) {
  const ref = doc(db, USERS_COL, String(uid));
  await setDoc(
    ref,
    {
      active: Boolean(active),
      updated_date: new Date().toISOString(),
    },
    { merge: true }
  );
  return { uid, active: Boolean(active) };
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
