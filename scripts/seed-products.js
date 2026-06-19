// scripts/seed-products.js
// -------------------------------------------------------------
// Script de seed para popular a coleção `products` do Firestore
// com TODOS os produtos extraídos das cartas do B'Live Lounge Bar
// (3 PDFs publicados em bliveloungebar.com):
//   - PDF1: Carta principal (cocktails, vodkas, gins, whiskies,
//           champanhes, espumantes, sangrias, cachaça, licores,
//           shots, refrigerantes, cervejas, cafetaria, aperitivos,
//           vinhos)
//   - PDF2: Carta de Shishas (20 referências)
//   - PDF3: Carta B'Live (comida: burgers, tostas, fritos, doces)
//
// As imagens usadas são placeholders da Unsplash (licença livre)
// que representam visualmente cada produto. Quando houver fotos
// profissionais do bar, basta substituir o campo `image_url`.
//
// Como executar:
//   1. cd /home/z/my-project/bliveQrCode
//   2. npm install
//   3. node scripts/seed-products.js            (adiciona novos)
//   4. node scripts/seed-products.js --reset    (apaga tudo e recriia)
//
// O script é IDEMPOTENTE: não duplica produtos com o mesmo `slug`.
//
// IMPORTANTE: a base de dados Firestore tem de existir no projeto
// Firebase antes de executar. Se ainda não foi criada, ir a
// https://console.firebase.google.com/project/autocell-535c2/firestore
// e clicar em "Create database" (modo produção ou teste).
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { PRODUCTS } from "./catalog.js";

// Configuração Firebase (igual a src/lib/firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyBMqbxgLDtmi1AhF0DC41a7UO39vczy0cs",
  authDomain: "autocell-535c2.firebaseapp.com",
  projectId: "autocell-535c2",
  storageBucket: "autocell-535c2.firebasestorage.app",
  messagingSenderId: "307194938946",
  appId: "1:307194938946:web:9ad571e00c4713e64f4fdb",
  measurementId: "G-1LNK7RKCJW",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Timeout para a operação de seed — se o Firestore não responder
// em 60 segundos (ex.: base de dados inexistente, rede bloqueada),
// o script falha com mensagem clara em vez de ficar pendurado.
const SEED_TIMEOUT_MS = 60_000;

function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    ),
  ]);
}

// -------------------------------------------------------------
// Lógica de seed
// -------------------------------------------------------------
async function resetCollection() {
  console.log("⚠️  A apagar TODOS os documentos da coleção `products`...");
  const snap = await getDocs(collection(db, "products"));
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
    count++;
  }
  console.log(`✅ ${count} documentos apagados.`);
}

async function seed() {
  const doReset = process.argv.includes("--reset");

  console.log(
    `📊 A semear ${PRODUCTS.length} produtos no Firestore (projectId: ${firebaseConfig.projectId})...`
  );
  console.log(
    "ℹ️  Se a base de dados Firestore ainda não foi criada no projeto Firebase,\n" +
      "   ir a https://console.firebase.google.com/project/autocell-535c2/firestore\n" +
      "   e clicar em 'Create database' antes de executar este script."
  );

  try {
    if (doReset) await resetCollection();

    const existingSnap = await withTimeout(
      getDocs(collection(db, "products")),
      SEED_TIMEOUT_MS,
      "Timeout ao ler coleção `products`. A base de dados Firestore existe no projeto Firebase?"
    );

    const existingSlugs = new Set();
    existingSnap.forEach((d) => {
      const data = d.data();
      if (data.slug) existingSlugs.add(data.slug);
    });

    let created = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    const batchBuckets = [];
    let currentBatch = writeBatch(db);
    let currentCount = 0;

    for (const p of PRODUCTS) {
      const slug = slugify(p.name);
      if (existingSlugs.has(slug)) {
        skipped++;
        continue;
      }
      const ref = doc(collection(db, "products"));
      currentBatch.set(ref, {
        ...p,
        slug,
        available: true,
        stock_enabled: false,
        stock: 0,
        created_date: now,
        updated_date: now,
      });
      created++;
      currentCount++;
      if (currentCount === 400) {
        batchBuckets.push(currentBatch);
        currentBatch = writeBatch(db);
        currentCount = 0;
      }
    }
    if (currentCount > 0) batchBuckets.push(currentBatch);

    for (let i = 0; i < batchBuckets.length; i++) {
      console.log(`A commit batch ${i + 1}/${batchBuckets.length}...`);
      await withTimeout(
        batchBuckets[i].commit(),
        SEED_TIMEOUT_MS,
        `Timeout no commit do batch ${i + 1}. Verifica a ligação ao Firestore.`
      );
    }

    console.log(
      `\n✅ Seed concluído: ${created} produtos criados, ${skipped} já existiam (skipped).`
    );
    if (doReset) {
      console.log(
        "(Seed executado em modo --reset: coleção foi limpa antes da inserção.)"
      );
    }
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Erro no seed:", err.message || err);
    console.error(
      "\nDica: confirma que a base de dados Firestore existe em\n" +
        "https://console.firebase.google.com/project/autocell-535c2/firestore\n" +
        "e que as regras de segurança permitem escrita pública."
    );
    process.exit(1);
  }
}

seed();
