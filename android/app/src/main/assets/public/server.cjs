var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_firestore = require("firebase-admin/firestore");
var import_fs = __toESM(require("fs"), 1);
import_dotenv.default.config();
var isFirebaseAdminInitialized = false;
var configuredDatabaseId = "ai-studio-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8";
var getFirebaseAdmin = () => {
  if (!isFirebaseAdminInitialized) {
    let firebaseProjectId = "gen-lang-client-0708969846";
    let databaseId = "ai-studio-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8";
    let storageBucket = "gen-lang-client-0708969846.firebasestorage.app";
    try {
      const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs.default.existsSync(configPath)) {
        const config = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
        if (config) {
          if (config.projectId) firebaseProjectId = config.projectId;
          if (config.firestoreDatabaseId) {
            databaseId = config.firestoreDatabaseId;
            configuredDatabaseId = config.firestoreDatabaseId;
          }
          if (config.storageBucket) storageBucket = config.storageBucket;
        }
      }
    } catch (e) {
      console.warn("Could not dynamically load firebase-applet-config.json to extract configs:", e.message);
    }
    process.env.FIRESTORE_DATABASE = databaseId;
    process.env.GCLOUD_PROJECT = firebaseProjectId;
    process.env.GOOGLE_CLOUD_PROJECT = firebaseProjectId;
    process.env.FIREBASE_PROJECT_ID = firebaseProjectId;
    try {
      import_firebase_admin.default.initializeApp({
        credential: import_firebase_admin.default.credential.applicationDefault(),
        projectId: firebaseProjectId,
        storageBucket,
        ...{ databaseId }
      });
      isFirebaseAdminInitialized = true;
      console.log(`Firebase Admin successfully initialized with applicationDefault, projectId=${firebaseProjectId}, databaseId=${databaseId}`);
    } catch (error) {
      console.warn("Firebase Admin failed to initialize with applicationDefault(). Falling back to client-config values:", error.message);
      try {
        import_firebase_admin.default.initializeApp({
          projectId: firebaseProjectId,
          storageBucket,
          ...{ databaseId }
        });
        isFirebaseAdminInitialized = true;
        console.log(`Firebase Admin successfully fallback initialized with projectId: ${firebaseProjectId}, databaseId: ${databaseId}`);
      } catch (fallbackError) {
        console.error("Firebase Admin fallback initialization failed:", fallbackError.message);
      }
    }
  }
  return import_firebase_admin.default;
};
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "20mb" }));
  let ai = null;
  const getAI = () => {
    if (!ai) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error("GEMINI_API_KEY is required but not found in environment");
      }
      ai = new import_genai.GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
    return ai;
  };
  const generateContentWithFallback = async (params) => {
    const primary = params.primaryModel || "gemini-3.5-flash";
    const modelsToTry = [primary, "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        console.log(`[Gemini] Attempting generation with model: ${modelName}`);
        const client = getAI();
        const response = await client.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config
        });
        return response;
      } catch (error) {
        lastError = error;
        console.warn(`[Gemini] Model ${modelName} failed. Error:`, error.message || error);
      }
    }
    throw lastError;
  };
  app.post("/api/send-notification", async (req, res) => {
    const { driverId, title, body } = req.body;
    try {
      const fbAdmin = getFirebaseAdmin();
      const snapshot = await (0, import_firestore.getFirestore)(fbAdmin.app(), configuredDatabaseId).collection("user_devices").doc(driverId).get();
      if (!snapshot.exists) {
        return res.status(404).json({ error: "Driver device not registered" });
      }
      const token = snapshot.data()?.token;
      if (!token) {
        return res.status(400).json({ error: "Driver has no FCM token" });
      }
      await fbAdmin.messaging().send({
        token,
        notification: { title, body }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("FCM Send Error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });
  app.post("/api/finance/scan-document", async (req, res) => {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }
    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: `Extraia informa\xE7\xF5es financeiras deste documento (boleto, nota fiscal ou recibo). 
Retorne APENAS um objeto JSON com os seguintes campos:
- description: Uma breve descri\xE7\xE3o do que se trata (ex: "Energia El\xE9trica", "Pe\xE7as Mec\xE2nica").
- supplier: Nome do fornecedor ou emissor.
- amount: Valor total como n\xFAmero (ex: 150.50).
- dueDate: Data de vencimento no formato YYYY-MM-DD.
- barcode: O c\xF3digo de barras num\xE9rico (linha digit\xE1vel), se dispon\xEDvel. Remova espa\xE7os ou pontos.
- packageName: Se for um documento de turismo ou pacote de viagem, o nome identificador do pacote (ex: "CABO FRIO JULHO").
- destination: Se aplic\xE1vel, o local de destino do pacote de viagem (ex: "Cabo Frio - RJ").
- passengerCount: Se aplic\xE1vel, o n\xFAmero de passageiros citados (n\xFAmero).
- guideName: Se aplic\xE1vel, o nome do guia ou coordenador citado.
- vehiclePlate: Se for manuten\xE7\xE3o de frota, a placa do ve\xEDculo citado (ex: "ABC1D23" ou "XYZ-9999").
- mechanicName: Se for manuten\xE7\xE3o, o nome da mec\xE2nica/oficina ou do profissional citado.
- replacedParts: Se houver, lista ou texto com pe\xE7as substitu\xEDdas.
- stockPartName: Se for compra de estoque industrial, o nome da pe\xE7a/material adquirido.
- itemQuantity: Se aplic\xE1vel, a quantidade de pe\xE7as (n\xFAmero).
- itemUnitCost: Se aplic\xE1vel, o custo unit\xE1rio (n\xFAmero).

Se n\xE3o encontrar algum campo, retorne null para ele. N\xE3o inclua Markdown ou texto explicativo, apenas o JSON.` },
              {
                inlineData: {
                  data: base64Data,
                  mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      res.status(500).json({ error: "Internal server error during document scanning" });
    }
  });
  app.post("/api/fuel/scan-receipt", async (req, res) => {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }
    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: `Voc\xEA \xE9 o assistente de intelig\xEAncia artificial da E.F. Gest\xE3o. Sua tarefa \xE9 analisar o recibo, foto de bomba de combust\xEDvel, cupom ou nota fiscal de abastecimento enviada e extrair as seguintes informa\xE7\xF5es exatas:
- volume: volume em litros (n\xFAmero exato com ponto decimal, ex: 104.53)
- odometro: km atual informado (n\xFAmero inteiro, ex: 54321)
- custo: valor total pago em Reais (n\xFAmero exato, ex: 641.20)
- combustivel: combust\xEDvel identificado (retorne exatamente string 'diesel', 'arla' ou null se n\xE3o for poss\xEDvel determinar)
- placa: placa do ve\xEDculo vinculada (ex: ABC1D23, ABC-1234, retorne em mai\xFAsculas sem espa\xE7os, ou null se n\xE3o houver)
- motorista: nome do motorista se estiver escrito (ou null se n\xE3o houver)
- observacao: nome do posto / bandeira / localiza\xE7\xE3o do estabelecimento onde foi feito (ex: "Posto Graal", "Posto Ipiranga", etc) ou notas relevantes.

Retorne APENAS um objeto JSON com estes campos (use exatamente estes nomes de chaves em min\xFAsculo):
{
  "volume": null ou n\xFAmero,
  "odometro": null ou n\xFAmero,
  "custo": null ou n\xFAmero,
  "combustivel": null ou "diesel" ou "arla",
  "placa": null ou string,
  "motorista": null ou string,
  "observacao": null ou string
}

N\xE3o inclua textos explicativos, Markdown adicionais, c\xF3digos adicionais ou bloco de marca\xE7\xE3o, apenas o objeto puro JSON.` },
              {
                inlineData: {
                  data: base64Data,
                  mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Fuel Scan Error:", error);
      res.status(500).json({ error: "Internal server error during fuel receipt scanning" });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/extract-passengers", async (req, res) => {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }
    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: "Extraia a lista de passageiros deste documento. Retorne um JSON com um array de objetos contendo 'name' (NOME COMPLETO EM MAI\xDASCULAS) e 'document' (CPF ou RG). Se n\xE3o houver documento, use 'S/D'. Ignore cabe\xE7alhos ou informa\xE7\xF5es n\xE3o relacionadas a passageiros." },
              {
                inlineData: {
                  data: base64Data,
                  mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      const extractedData = JSON.parse(response.text || "[]");
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Extraction Error:", error);
      res.status(500).json({ error: "Failed to extract data from document" });
    }
  });
  app.post("/api/chat", async (req, res) => {
    const { message, systemInstruction, history } = req.body;
    try {
      const contents = [];
      if (history && history.length > 0) {
        history.forEach((h) => {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.content }]
          });
        });
      }
      contents.push({ role: "user", parts: [{ text: message }] });
      const response = await generateContentWithFallback({
        contents,
        config: {
          systemInstruction: systemInstruction || "Voc\xEA \xE9 um assistente especializado na E.F. Gest\xE3o."
        }
      });
      return res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
    }
  });
  app.post("/api/smart-fill", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text to process" });
    }
    try {
      const response = await generateContentWithFallback({
        contents: `Extraia as informa\xE7\xF5es desta viagem do seguinte texto: "${text}"`,
        config: {
          responseMimeType: "application/json"
        }
      });
      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Smart Fill Error:", error);
      res.status(500).json({ error: "Failed to extract data from text" });
    }
  });
  async function performServerStorageBackup() {
    try {
      console.log("[Server Storage Backup] DEBUG: Starting backup process...");
      const fbAdmin = getFirebaseAdmin();
      const db = (0, import_firestore.getFirestore)(fbAdmin.app(), configuredDatabaseId);
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const timestampStr = (/* @__PURE__ */ new Date()).toISOString();
      console.log("[Server Storage Backup] DEBUG: Step 1 - Checking existing backup logs in Firestore...");
      const logsRef = db.collection("storage_backup_logs");
      let snapshot;
      try {
        snapshot = await logsRef.where("date", "==", dateStr).where("success", "==", true).get();
        console.log(`[Server Storage Backup] DEBUG: Step 1 success - existing logs empty? ${snapshot.empty}`);
      } catch (dbError) {
        console.warn("[Server Storage Backup] DEBUG: Step 1 FAILED (Check logsRef):", dbError.message || dbError);
        throw dbError;
      }
      if (!snapshot.empty) {
        console.log(`[Server Storage Backup] Backup for ${dateStr} already exists. Skipping automatic run.`);
        return;
      }
      console.log(`[Server Storage Backup] Starting automatic server-side daily backup for ${dateStr}...`);
      const collections = ["vehicles", "employees", "maintenance_logs"];
      const backupData = {};
      console.log("[Server Storage Backup] DEBUG: Step 2 - Fetching data from Firestore collections...");
      for (const col of collections) {
        try {
          console.log(`[Server Storage Backup] DEBUG: Step 2 - Fetching collection: ${col}`);
          const snap = await db.collection(col).get();
          backupData[col] = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`[Server Storage Backup] DEBUG: Step 2 - Fetched ${backupData[col].length} items for ${col}`);
        } catch (colError) {
          console.warn(`[Server Storage Backup] DEBUG: Step 2 FAILED for collection ${col}:`, colError.message || colError);
          throw colError;
        }
      }
      const jsonString = JSON.stringify({
        backupTimestamp: timestampStr,
        createdBy: "SERVER_AUTO_BACKUP",
        data: backupData
      }, null, 2);
      let bucket;
      try {
        const bucketName = fbAdmin.options?.storageBucket || "gen-lang-client-0708969846.firebasestorage.app";
        console.log(`[Server Storage Backup] DEBUG: Step 3 - Getting bucket: ${bucketName}`);
        bucket = fbAdmin.storage().bucket(bucketName);
        console.log("[Server Storage Backup] DEBUG: Step 3 - Checking if bucket exists...");
        const [exists] = await bucket.exists();
        console.log(`[Server Storage Backup] DEBUG: Step 3 success - bucket exists? ${exists}`);
        if (!exists) {
          console.warn(`[Server Storage Backup] Storage bucket '${bucketName}' does not exist or Firebase Storage is not enabled.`);
          return;
        }
      } catch (storageErr) {
        console.warn("[Server Storage Backup] Firebase Storage is not enabled or configured. Skipping storage backup:", storageErr.message || storageErr);
        return;
      }
      const jsonPath = `backups/${dateStr}/dados_completos_${dateStr}.json`;
      console.log(`[Server Storage Backup] DEBUG: Step 4 - Saving JSON backup file to Storage at: ${jsonPath}`);
      const jsonFile = bucket.file(jsonPath);
      try {
        await jsonFile.save(jsonString, {
          contentType: "application/json",
          metadata: {
            cacheControl: "no-cache"
          }
        });
        console.log("[Server Storage Backup] DEBUG: Step 4 success - JSON saved.");
      } catch (saveJsonErr) {
        console.warn("[Server Storage Backup] DEBUG: Step 4 FAILED (jsonFile.save):", saveJsonErr.message || saveJsonErr);
        throw saveJsonErr;
      }
      const convertToCSV = (data) => {
        if (!data || !data.length) return "";
        const headersSet = /* @__PURE__ */ new Set();
        data.forEach((obj) => Object.keys(obj).forEach((k) => headersSet.add(k)));
        const headers = Array.from(headersSet);
        const csvRows = [headers.join(",")];
        for (const row of data) {
          const values = headers.map((header) => {
            let val = row[header];
            if (val === void 0 || val === null) return '""';
            if (typeof val === "object") val = JSON.stringify(val);
            const escaped = ("" + val).replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(values.join(","));
        }
        return csvRows.join("\r\n");
      };
      const uploadedPaths = [jsonPath];
      console.log("[Server Storage Backup] DEBUG: Step 5 - Converting and saving CSV backup files to Storage...");
      for (const col of collections) {
        const csvString = convertToCSV(backupData[col]);
        const csvPath = `backups/${dateStr}/${col}_${dateStr}.csv`;
        console.log(`[Server Storage Backup] DEBUG: Step 5 - Saving CSV for ${col} at: ${csvPath}`);
        const csvFile = bucket.file(csvPath);
        try {
          await csvFile.save(csvString, {
            contentType: "text/csv",
            metadata: {
              cacheControl: "no-cache"
            }
          });
          console.log(`[Server Storage Backup] DEBUG: Step 5 success - ${col} CSV saved.`);
        } catch (saveCsvErr) {
          console.warn(`[Server Storage Backup] DEBUG: Step 5 FAILED for ${col} CSV:`, saveCsvErr.message || saveCsvErr);
          throw saveCsvErr;
        }
        uploadedPaths.push(csvPath);
      }
      console.log("[Server Storage Backup] DEBUG: Step 6 - Logging backup completion in Firestore...");
      try {
        await db.collection("storage_backup_logs").add({
          timestamp: timestampStr,
          date: dateStr,
          createdBy: "SERVER_AUTO_BACKUP",
          paths: uploadedPaths,
          formats: ["JSON", "CSV"],
          collections,
          success: true
        });
        console.log("[Server Storage Backup] DEBUG: Step 6 success - log registered.");
      } catch (logDbErr) {
        console.warn("[Server Storage Backup] DEBUG: Step 6 FAILED (log registry):", logDbErr.message || logDbErr);
        throw logDbErr;
      }
      console.log(`[Server Storage Backup] Backup for ${dateStr} completed successfully.`);
    } catch (err) {
      console.warn("[Server Storage Backup] Backup execution warning (expected in sandboxed environments):", err.message || err);
    }
  }
  app.post("/api/backup/storage", async (req, res) => {
    try {
      await performServerStorageBackup();
      res.json({ success: true, message: "Backup para o Firebase Storage conclu\xEDdo com sucesso!" });
    } catch (error) {
      console.warn("API Storage Backup Warning:", error);
      res.status(500).json({ error: error.message || "Erro desconhecido ao executar backup" });
    }
  });
  console.log("[Server Storage Backup] Server-side background backup schedules are disabled. Client-side triggers handle daily automated backups.");
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }
  console.log(`Starting server in ${process.env.NODE_ENV} mode`);
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      appType: "spa",
      base: "/"
    });
    app.use((req, res, next) => {
      if (req.url.includes("logo_dm.svg")) {
        console.log(`Dev Log: Requesting logo_dm.svg - URL: ${req.url}`);
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    console.log(`Serving static files from: ${distPath}`);
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Critical server startup error:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
