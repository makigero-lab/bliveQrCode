// scripts/bootstrap.js
// -------------------------------------------------------------
// SCRIPT DE BOOTSTRAP — prepara TODA a base de dados Firestore
// do projeto bliveQrCode numa só execução.
//
// O que faz (em ordem):
//   1. Cria a coleção `settings` com o documento `bar`
//      (configurações padrão do B'Live Lounge Bar).
//   2. Cria a coleção `users` com o primeiro admin (email/password
//      que escolheres). Também cria a conta Firebase Auth.
//   3. Cria a coleção `tables` com N mesas (default: 10).
//      Cada mesa recebe um ID seguro de 8 chars para QR codes.
//   4. Popula a coleção `products` com os 150 produtos do catálogo
//      B'Live (extraídos dos 3 PDFs).
//
// PRÉ-REQUISITOS:
//   1. Ter Node.js 18+ instalado.
//   2. `npm install` na raiz do projeto.
//   3. A base de dados Firestore tem de existir no projeto Firebase.
//      Se não existir, ir a:
//      https://console.firebase.google.com/project/autocell-535c2/firestore
//      → clicar "Create database" → modo "Test" (regras abertas).
//   4. Email/Password tem de estar ativo em:
//      https://console.firebase.google.com/project/autocell-535c2/authentication/sign-in-method
//      → Email/Password → Enable.
//
// COMO EXECUTAR:
//   node scripts/bootstrap.js
//   (vai pedir interativamente o email/password do primeiro admin)
//
// OU com variáveis de ambiente:
//   ADMIN_EMAIL=admin@blive.pt ADMIN_PASSWORD=senha123 node scripts/bootstrap.js
//
// IDEMPOTENTE: pode ser corrido várias vezes sem duplicar.
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Reutiliza o catálogo de produtos (150 produtos)
import { PRODUCTS } from "../src/data/catalog.js";

// -------------------------------------------------------------
// Configuração Firebase
// -------------------------------------------------------------
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
const auth = getAuth(app);

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

function generateTableId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function askQuestion(prompt) {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------
// Etapa 1: settings
// -------------------------------------------------------------
async function ensureSettings() {
  console.log("\n📋 [1/4] A criar coleção `settings`...");
  const ref = doc(db, "settings", "bar");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    console.log("   ✅ Documento `settings/bar` já existe — mantido.");
    return;
  }

  const defaultSettings = {
    bar_name: "B'Live Lounge Bar",
    primary_color: "#E91E8C",
    logo_url: null,
    tagline: "Cocktails • Shishas • Comida",
  };

  await setDoc(ref, defaultSettings, { merge: true });
  console.log("   ✅ Coleção `settings` criada com documento `bar`.");
  console.log(`      bar_name = "${defaultSettings.bar_name}"`);
  console.log(`      primary_color = "${defaultSettings.primary_color}"`);
}

// -------------------------------------------------------------
// Etapa 2: primeiro admin
// -------------------------------------------------------------
async function ensureAdminUser() {
  console.log("\n👤 [2/4] A criar o primeiro admin...");

  // Verifica se já existe algum user em `users/`
  const usersSnap = await getDocs(collection(db, "users"));
  if (!usersSnap.empty) {
    const count = usersSnap.size;
    console.log(`   ✅ Coleção \`users\` já tem ${count} documento(s) — a saltar criação de admin.`);
    console.log("      (Se precisares de mais admins, cria-os via painel Admin → Utilizadores.)");
    return;
  }

  // Pede credenciais
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("\n   Vou precisar das credenciais do primeiro admin:");
    email = (await askQuestion("   📧 Email (ex: admin@blive.pt): ")).trim();
    password = (await askQuestion("   🔒 Password (mín. 6 caracteres): ")).trim();
  }

  if (!email || !password) {
    throw new Error("Email e password são obrigatórios para criar o admin.");
  }
  if (password.length < 6) {
    throw new Error("Password tem de ter pelo menos 6 caracteres.");
  }

  // Cria conta Firebase Auth
  console.log(`   A criar conta Firebase Auth para ${email}...`);
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log(`   ✅ Conta Auth criada (uid: ${uid}).`);
  } catch (err) {
    if (err?.code === "auth/email-already-in-use") {
      console.log("   ℹ️  Email já tem conta Auth. Vou tentar fazer login para obter o uid.");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
      console.log(`   ✅ Login OK (uid: ${uid}).`);
    } else {
      throw err;
    }
  }

  // Cria perfil no Firestore
  const now = new Date().toISOString();
  await setDoc(doc(db, "users", uid), {
    email,
    role: "admin",
    created_date: now,
    updated_date: now,
  });
  console.log(`   ✅ Perfil \`users/${uid}\` criado com role="admin".`);

  // Sign-out para não interferir com etapas seguintes
  try {
    await signOut(auth);
  } catch (_) {}

  // Guarda para mostrar no fim
  bootstrapAdmin = { uid, email };
}

let bootstrapAdmin = null;

// -------------------------------------------------------------
// Etapa 3: mesas (tables)
// -------------------------------------------------------------
async function ensureTables() {
  console.log("\n🪑 [3/4] A criar coleção `tables`...");

  const existingSnap = await getDocs(collection(db, "tables"));
  if (!existingSnap.empty) {
    console.log(`   ✅ Coleção \`tables\` já tem ${existingSnap.size} mesa(s) — mantidas.`);
    return;
  }

  const TOTAL_TABLES = 10;
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  for (let i = 1; i <= TOTAL_TABLES; i++) {
    const id = generateTableId();
    const tableNumber = String(i);
    batch.set(doc(db, "tables", id), {
      table_number: tableNumber,
      created_date: now,
    });
  }

  await batch.commit();
  console.log(`   ✅ ${TOTAL_TABLES} mesas criadas (Mesa 1 a Mesa ${TOTAL_TABLES}).`);
  console.log("      QR codes disponíveis em: Admin → separador QR.");
}

// -------------------------------------------------------------
// Etapa 4: catálogo de produtos
// -------------------------------------------------------------
async function ensureProducts() {
  console.log("\n🍺 [4/4] A popular coleção `products`...");

  const existingSnap = await getDocs(collection(db, "products"));
  const existingSlugs = new Set();
  existingSnap.forEach((d) => {
    const data = d.data();
    if (data.slug) existingSlugs.add(data.slug);
  });

  if (existingSnap.size > 0) {
    console.log(`   ℹ️  Coleção \`products\` já tem ${existingSnap.size} produto(s).`);
    if (existingSlugs.size >= PRODUCTS.length) {
      console.log("   ✅ Catálogo já está completo — a saltar.");
      return;
    }
    console.log(`   A adicionar ${PRODUCTS.length - existingSlugs.size} produto(s) em falta...`);
  }

  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  const BATCH_SIZE = 400;
  let currentBatch = writeBatch(db);
  let currentCount = 0;
  const batches = [];

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
    if (currentCount === BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      currentCount = 0;
    }
  }
  if (currentCount > 0) batches.push(currentBatch);

  for (let i = 0; i < batches.length; i++) {
    console.log(`   A commit batch ${i + 1}/${batches.length}...`);
    await batches[i].commit();
  }

  console.log(`   ✅ ${created} produtos criados, ${skipped} já existiam.`);
}

// -------------------------------------------------------------
// Main
// -------------------------------------------------------------
async function main() {
  console.log("==============================================");
  console.log("  bliveQrCode — Bootstrap do Firestore");
  console.log("==============================================");
  console.log(`  Project ID: ${firebaseConfig.projectId}`);
  console.log(`  Firestore:  https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`);
  console.log("");

  // Verifica ligação ao Firestore
  console.log("🔌 A testar ligação ao Firestore...");
  try {
    // Tenta listar a coleção `settings` (mesmo vazia, se a BD
    // existir e as regras permitirem leitura, não lança erro).
    await getDocs(collection(db, "settings"));
    console.log("   ✅ Ligação OK.");
  } catch (err) {
    console.error("   ❌ Erro de ligação ao Firestore:", err.message);
    console.error("\n   Possíveis causas:");
    console.error("   1. A base de dados Firestore não foi criada no projeto Firebase.");
    console.error("      → https://console.firebase.google.com/project/autocell-535c2/firestore");
    console.error("      → Clica em 'Create database' (modo Test).");
    console.error("   2. Sem ligação à internet.");
    console.error("   3. Regras de segurança bloqueiam leitura.");
    process.exit(1);
  }

  // Etapas
  await ensureSettings();
  await ensureAdminUser();
  await ensureTables();
  await ensureProducts();

  // Resumo final
  console.log("\n==============================================");
  console.log("  ✅ BOOTSTRAP CONCLUÍDO COM SUCESSO!");
  console.log("==============================================");
  console.log("\n📋 O que foi criado:");
  console.log("   • Coleção `settings`  (1 documento: bar)");
  console.log("   • Coleção `users`     (1 admin inicial)");
  console.log("   • Coleção `tables`    (10 mesas com IDs seguros)");
  console.log("   • Coleção `products`  (150 produtos do catálogo B'Live)");

  if (bootstrapAdmin) {
    console.log("\n👤 Admin criado:");
    console.log(`   Email: ${bootstrapAdmin.email}`);
    console.log(`   UID:   ${bootstrapAdmin.uid}`);
  }

  console.log("\n🚀 Próximos passos:");
  console.log("   1. Faz deploy da app na Vercel (ou corre `npm run dev`).");
  console.log("   2. Abre /admin e faz login com as credenciais do admin.");
  console.log("   3. Vai a Admin → QR para descarregar os QR codes das mesas.");
  console.log("   4. Imprime os QR codes e coloca-os nas mesas físicas.");
  console.log("   5. Testa: abre /menu?m=<id-de-uma-mesa> e faz um pedido.");
  console.log("   6. Verifica em /staff que o pedido aparece em tempo real.");

  console.log("\n🔐 Regras de segurança recomendadas (Firebase Console → Firestore → Rules):");
  console.log(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tables/{id} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /users/{uid} {
      allow read: if request.auth != null &&
        (request.auth.uid == uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin");
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /orders/{id} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
    match /settings/{id} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Erro no bootstrap:", err);
  console.error("\nDica: lê a mensagem acima. Se for erro de permissões,");
  console.error("verifica as regras de segurança do Firestore em");
  console.error("https://console.firebase.google.com/project/autocell-535c2/firestore/rules");
  process.exit(1);
});
