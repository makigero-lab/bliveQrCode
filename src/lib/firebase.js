// src/lib/firebase.js
// -------------------------------------------------------------
// Inicialização do Firebase para o projeto bliveQrCode.
//
// Expõe:
//   - app  : instância do Firebase App
//   - db   : instância do Firestore
//   - auth : instância do Firebase Auth
//
// As regras de segurança do Firestore devem permitir:
//   - products: leitura pública; escrita só para admins
//   - orders  : leitura/escrita pública (clientes não autenticados
//               enviam pedidos; staff/admin lêem e fecham)
//   - settings: leitura pública; escrita só para admins
//   - tables  : leitura pública; escrita só para admins
//   - users   : leitura/escrita só para admins
//
// Recomenda-se ativar Email/Password no Firebase Console →
// Authentication → Sign-in method.
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBMqbxgLDtmi1AhF0DC41a7UO39vczy0cs",
  authDomain: "autocell-535c2.firebaseapp.com",
  projectId: "autocell-535c2",
  storageBucket: "autocell-535c2.firebasestorage.app",
  messagingSenderId: "307194938946",
  appId: "1:307194938946:web:9ad571e00c4713e64f4fdb",
  measurementId: "G-1LNK7RKCJW",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
