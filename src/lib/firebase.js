// src/lib/firebase.js
// -------------------------------------------------------------
// Inicialização do Firebase para o projeto bliveQrCode.
//
// Substitui completamente o antigo cliente Base44. Expõe:
//   - app       : instância do Firebase App
//   - db        : instância do Firestore
//
// As regras de segurança do Firestore devem permitir leitura e
// escrita públicas (ou autenticadas) para as coleções usadas:
//   - products  (catálogo de produtos)
//   - orders    (pedidos)
//   - settings  (configuração do bar — documento único, id "bar")
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

export default app;
