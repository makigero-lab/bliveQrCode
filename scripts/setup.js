// scripts/setup.js
// -------------------------------------------------------------
// SCRIPT DE SETUP EXPRESSO — para quando JÁ TENS um user criado
// em Firebase Authentication e só precisas de completar as
// coleções do Firestore.
//
// Cenário típico (o do utilizador):
//   - Firebase Console já tem um user em Authentication:
//       email: admin@sistema.pt
//       password: admin123
//   - Firestore já tem as coleções `orders` e `products` (criadas
//     pela app quando fizeste testes), mas falta:
//       • users/{uid}     → perfil com role: "admin"
//       • settings/bar    → configuração do bar
//       • tables/{id}     → mesas para QR codes
//
// Este script:
//   1. Faz login com o email/password que indicas (default:
//      admin@sistema.pt / admin123).
//   2. Cria o perfil do user em `users/{uid}` com role: "admin".
//   3. Cria `settings/bar` com defaults do B'Live.
//   4. Cria 10 mesas com IDs seguros para QR codes.
//   5. NÃO mexe em `products` nem `orders` (já existem).
//
// COMO EXECUTAR (default):
//   node scripts/setup.js
//
// OU com credenciais personalizadas:
//   ADMIN_EMAIL=outro@blive.pt ADMIN_PASSWORD=xxx node scripts/setup.js
//
// IDEMPOTENTE: pode ser corrido várias vezes sem duplicar.
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, writeBatch } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Configuração Firebase (igual ao resto da app)
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
function generateTableId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function askQuestion(prompt) {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

// -------------------------------------------------------------
// Etapa 1: Login + criar perfil em users/{uid}
// -------------------------------------------------------------
async function ensureUserProfile() {
  console.log("\n👤 [1/3] A fazer login e criar perfil de admin...");

  // Credenciais (default: admin@sistema.pt / admin123)
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("\n   Vou precisar das credenciais do teu admin.");
    console.log("   (Pré-preenchido com admin@sistema.pt — prime Enter para aceitar)");
    const typedEmail = await askQuestion("   📧 Email [admin@sistema.pt]: ");
    email = typedEmail || "admin@sistema.pt";
    const typedPass = await askQuestion("   🔒 Password [admin123]: ");
    password = typedPass || "admin123";
  }

  console.log(`   A fazer login como ${email}...`);
  let uid;
  let email2 = email;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    email2 = cred.user.email || email;
    console.log(`   ✅ Login OK (uid: ${uid}).`);
  } catch (err) {
    console.error(`   ❌ Erro no login: ${err.message}`);
    if (err.code === "auth/invalid-credential") {
      console.error("\n   Possíveis causas:");
      console.error("   • Password incorreta.");
      console.error("   • Email/Password não ativado em Firebase Console → Authentication → Sign-in method.");
      console.error("   • User não existe em Authentication.");
    }
    process.exit(1);
  }

  // Verifica se o perfil já existe em users/{uid}
  const userDocRef = doc(db, "users", uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    console.log(`   ✅ Perfil \`users/${uid}\` já existe — mantido.`);
    const existingRole = userDocSnap.data()?.role;
    if (existingRole && existingRole !== "admin") {
      console.log(`   ⚠️  Role atual: "${existingRole}" (não é admin).`);
      console.log("      Vou atualizar para role: \"admin\"...");
      await setDoc(userDocRef, { role: "admin", updated_date: new Date().toISOString() }, { merge: true });
      console.log("   ✅ Role atualizada para admin.");
    }
  } else {
    const now = new Date().toISOString();
    await setDoc(userDocRef, {
      email: email2,
      role: "admin",
      created_date: now,
      updated_date: now,
    });
    console.log(`   ✅ Perfil \`users/${uid}\` criado com role="admin".`);
    console.log(`      (Agora podes fazer login na app em /login com ${email2}.)`);
  }

  // Sign-out para não interferir com etapas seguintes
  try { await signOut(auth); } catch (_) {}

  return { uid, email: email2 };
}

// -------------------------------------------------------------
// Etapa 2: settings/bar
// -------------------------------------------------------------
async function ensureSettings() {
  console.log("\n⚙️  [2/3] A criar coleção `settings`...");
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
}

// -------------------------------------------------------------
// Etapa 3: tables (10 mesas)
// -------------------------------------------------------------
async function ensureTables() {
  console.log("\n🪑 [3/3] A criar coleção `tables` (10 mesas)...");
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
    batch.set(doc(db, "tables", id), {
      table_number: String(i),
      created_date: now,
    });
  }
  await batch.commit();
  console.log(`   ✅ ${TOTAL_TABLES} mesas criadas (Mesa 1 a Mesa ${TOTAL_TABLES}).`);
  console.log("      QR codes disponíveis em: Admin → separador QR.");
}

// -------------------------------------------------------------
// Main
// -------------------------------------------------------------
async function main() {
  console.log("==============================================");
  console.log("  bliveQrCode — Setup Expresso");
  console.log("  (usa admin já existente em Authentication)");
  console.log("==============================================");
  console.log(`  Project ID: ${firebaseConfig.projectId}`);
  console.log("");

  const userInfo = await ensureUserProfile();
  await ensureSettings();
  await ensureTables();

  console.log("\n==============================================");
  console.log("  ✅ SETUP CONCLUÍDO COM SUCESSO!");
  console.log("==============================================");
  console.log("\n📋 O que foi feito:");
  console.log(`   • Perfil admin criado em users/${userInfo.uid}`);
  console.log("   • settings/bar criado (configuração do bar)");
  console.log("   • 10 mesas criadas em tables/ (com IDs seguros)");
  console.log("\n🚀 Próximos passos:");
  console.log(`   1. Faz login em /login com ${userInfo.email}`);
  console.log("   2. Vai a Admin → QR para descarregar os QR codes das mesas.");
  console.log("   3. Imprime os QR codes e coloca-os nas mesas físicas.");
  console.log("   4. Testa: abre /menu?m=<id-da-mesa> num telemóvel.");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Erro no setup:", err);
  process.exit(1);
});
