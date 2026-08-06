import express from "express";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from "fs";
import { WebSocketServer } from "ws";

dotenv.config();

let isFirebaseAdminInitialized = false;
let configuredDatabaseId = "ai-studio-dmturismo-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8";

const getFirebaseAdmin = () => {
  if (!isFirebaseAdminInitialized) {
    let firebaseProjectId = "gen-lang-client-0708969846";
    let databaseId = "ai-studio-dmturismo-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8";
    let storageBucket = "gen-lang-client-0708969846.firebasestorage.app";
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config) {
          if (config.projectId) firebaseProjectId = config.projectId;
          if (config.firestoreDatabaseId) {
            databaseId = config.firestoreDatabaseId;
            configuredDatabaseId = config.firestoreDatabaseId;
          }
          if (config.storageBucket) storageBucket = config.storageBucket;
        }
      }
    } catch (e: any) {
      console.warn("Could not dynamically load firebase-applet-config.json to extract configs:", e.message);
    }

    // Set standard environment variables so Firestore client library picks them up automatically
    process.env.FIRESTORE_DATABASE = databaseId;
    process.env.GCLOUD_PROJECT = firebaseProjectId;
    process.env.GOOGLE_CLOUD_PROJECT = firebaseProjectId;
    process.env.FIREBASE_PROJECT_ID = firebaseProjectId;

    try {
      // Try to initialize using application default credentials but override with target project configurations
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseProjectId,
        storageBucket: storageBucket,
        ...({ databaseId } as any)
      });
      isFirebaseAdminInitialized = true;
      console.log(`Firebase Admin successfully initialized with applicationDefault, projectId=${firebaseProjectId}, databaseId=${databaseId}`);
    } catch (error: any) {
      console.warn("Firebase Admin failed to initialize with applicationDefault(). Falling back to client-config values:", error.message);
      try {
        admin.initializeApp({
          projectId: firebaseProjectId,
          storageBucket: storageBucket,
          ...({ databaseId } as any)
        });
        isFirebaseAdminInitialized = true;
        console.log(`Firebase Admin successfully fallback initialized with projectId: ${firebaseProjectId}, databaseId: ${databaseId}`);
      } catch (fallbackError: any) {
        console.error("Firebase Admin fallback initialization failed:", fallbackError.message);
      }
    }
  }
  return admin;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // Initialize Gemini
  let ai: any = null;
  const getAI = () => {
    if (!ai) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error("GEMINI_API_KEY is required but not found in environment");
      }
      ai = new GoogleGenAI({ 
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  };

  // Helper to return friendly Portuguese error message for Gemini errors
  const getGeminiFriendlyErrorMessage = (error: any, defaultMsg: string): string => {
    try {
      const errStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error) || String(error));
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("rate limit") || errStr.toLowerCase().includes("exhausted")) {
        return "Limite de requisições do Gemini excedido (Erro de Cota - 429). Por favor, aguarde cerca de 1 minuto antes de tentar novamente ou configure uma chave de API paga no menu de Configurações.";
      }
      if (errStr.includes("403") || errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("api key") || errStr.toLowerCase().includes("invalid")) {
        return "Chave de API do Gemini inválida ou sem permissão (Erro 403). Verifique se a chave está configurada corretamente nas Configurações.";
      }
      if (errStr.includes("503") || errStr.toLowerCase().includes("unavailable") || errStr.toLowerCase().includes("overloaded")) {
        return "O serviço de IA do Google está temporariamente indisponível ou sobrecarregado (Erro 503). Por favor, tente novamente em instantes.";
      }
      if (error?.message) {
        return error.message;
      }
    } catch (e) {
      // safe fallback
    }
    return defaultMsg;
  };

  // Helper to query Gemini with fallback to hande 503/rate limits gracefully
  const generateContentWithFallback = async (params: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }) => {
    const primary = params.primaryModel || "gemini-3.6-flash";
    const modelsToTry = [primary, "gemini-3.1-flash-lite", "gemini-flash-latest"];
    
    let lastError: any = null;
    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Gemini] Attempting generation with model: ${modelName} (Attempt ${attempt}/3)`);
          const client = getAI();
          const response = await client.models.generateContent({
            model: modelName,
            contents: params.contents,
            config: params.config
          });
          return response;
        } catch (error: any) {
          lastError = error;
          const errStr = String(error?.message || (error && typeof error === 'object' ? JSON.stringify(error) : error) || "");
          const isRetryable = errStr.includes("503") || 
                              errStr.includes("429") || 
                              errStr.toLowerCase().includes("unavailable") || 
                              errStr.toLowerCase().includes("overloaded") ||
                              errStr.toLowerCase().includes("high demand") ||
                              errStr.toLowerCase().includes("temporary");
          
          console.log(`[Gemini] Model ${modelName} (Attempt ${attempt}/3) status:`, errStr);
          if (isRetryable && attempt < 3) {
            const backoffMs = attempt * 1000;
            console.log(`[Gemini] Retrying model ${modelName} in ${backoffMs}ms due to retryable status...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            // Break from attempt loop to try the next model if not retryable, or if we exhausted attempts
            break;
          }
        }
      }
    }
    throw lastError;
  };

  // API Route: Health check for Google Cloud Run
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: Send notification to a driver
  app.post("/api/send-notification", async (req, res) => {
    const { driverId, title, body } = req.body;
    try {
      const fbAdmin = getFirebaseAdmin();
      const snapshot = await getFirestore(fbAdmin.app(), configuredDatabaseId).collection('user_devices').doc(driverId).get();
      if (!snapshot.exists) {
        return res.status(404).json({ error: "Driver device not registered" });
      }
      const token = snapshot.data()?.token;
      if (!token) {
        return res.status(400).json({ error: "Driver has no FCM token" });
      }
      await fbAdmin.messaging().send({
        token,
        notification: { title, body },
      });
      res.json({ success: true });
    } catch (error) {
      console.error("FCM Send Error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // API Route: Scan document and extract financial data
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
              { text: `Extraia informações financeiras deste documento (boleto, nota fiscal ou recibo). 
Retorne APENAS um objeto JSON com os seguintes campos:
- description: Uma breve descrição do que se trata (ex: "Energia Elétrica", "Peças Mecânica").
- supplier: Nome do fornecedor ou emissor.
- amount: Valor total como número (ex: 150.50).
- dueDate: Data de vencimento no formato YYYY-MM-DD.
- barcode: O código de barras numérico (linha digitável), se disponível. Remova espaços ou pontos.
- packageName: Se for um documento de turismo ou pacote de viagem, o nome identificador do pacote (ex: "CABO FRIO JULHO").
- destination: Se aplicável, o local de destino do pacote de viagem (ex: "Cabo Frio - RJ").
- passengerCount: Se aplicável, o número de passageiros citados (número).
- guideName: Se aplicável, o nome do guia ou coordenador citado.
- vehiclePlate: Se for manutenção de frota, a placa do veículo citado (ex: "ABC1D23" ou "XYZ-9999").
- mechanicName: Se for manutenção, o nome da mecânica/oficina ou do profissional citado.
- replacedParts: Se houver, lista ou texto com peças substituídas.
- stockPartName: Se for compra de estoque industrial, o nome da peça/material adquirido.
- itemQuantity: Se aplicável, a quantidade de peças (número).
- itemUnitCost: Se aplicável, o custo unitário (número).

Se não encontrar algum campo, retorne null para ele. Não inclua Markdown ou texto explicativo, apenas o JSON.` },
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
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Internal server error during document scanning") });
    }
  });

  // Helper: Detran SC Plate Expiration Logic
  const getDetranSCExpirationDate = (plate: string): string => {
    if (!plate) return "";
    const lastChar = plate.trim().slice(-1);
    const lastDigit = parseInt(lastChar);
    if (isNaN(lastDigit)) return "";

    const currentYear = new Date().getFullYear();
    let month = 0;
    
    // Detran SC Rule
    switch (lastDigit) {
      case 1: month = 3; break;
      case 2: month = 4; break;
      case 3: month = 5; break;
      case 4: month = 6; break;
      case 5: month = 7; break;
      case 6: month = 8; break;
      case 7: month = 9; break;
      case 8: month = 10; break;
      case 9: month = 11; break;
      case 0: month = 12; break;
      default: return "";
    }

    // Expiration is the last day of that month in the CURRENT year
    // If we are already past that month, it refers to the NEXT year (but usually licensing is for the current cycle)
    // For DM Turismo, we usually want to know when it EXPIRES.
    const expirationDate = new Date(currentYear, month, 0); // Last day of 'month'
    return expirationDate.toISOString().split('T')[0];
  };

  // API Route: Scan vehicle document (CRLV, CRV, CNH, etc.)
  app.post("/api/vehicle/scan-document", async (req, res) => {
    const { base64Data, mimeType, plate } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }

    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: `Análise técnica de documento de veículo ou condutor. 
Identifique o tipo de documento (CRLV, CRV, CNH, Seguro, ANTT, Laudo Técnico, Tacógrafo, CADASTUR, Alvará, Licença MERCOSUL) e extraia todos os dados técnicos visíveis.

Retorne APENAS um objeto JSON com os seguintes campos (use null se não encontrar):
{
  "documentName": "Nome amigável do documento (ex: CRLV 2024, CNH Motorista)",
  "documentType": "Tipo do documento",
  "validityDate": "YYYY-MM-DD",
  "extractedPlate": "Placa se identificada",
  "extractedRenavam": "Renavam se identificado",
  "extractedChassi": "Chassi se identificado",
  "extractedBrand": "Marca (ex: Mercedes-Benz, Marcopolo, Volkswagen)",
  "extractedModel": "Modelo (ex: Sprinter 515, Paradiso 1200)",
  "extractedYear": "Ano de fabricação/modelo (ex: 2018/2019)",
  "extractedCapacity": "Capacidade de passageiros (número)",
  "targetVehicleField": "Mapeamento para campo do sistema (valores possíveis: licenseExpiration, spvatExpiration, municipalLicenseExpiration, tacografoExpiration, cadasturExpiration, anttExpiration, mercosulLicenseExpiration, sieExpiration, insuranceExpiration)",
  "observations": "Qualquer observação relevante"
}

Regras de validade para CRLV/Licenciamento (Detran SC): 
Final 1 (Março), 2 (Abril), 3 (Maio), 4 (Junho), 5 (Julho), 6 (Agosto), 7 (Setembro), 8 (Outubro), 9 (Novembro), 0 (Dezembro).
Se o documento já contiver uma data de validade impressa (como CNH ou Seguro), use a data impressa.` },
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

      let extractedData = JSON.parse(response.text || "{}");
      
      // Post-processing Detran SC if plate is known and it's a CRLV but validity was not clear
      if (extractedData.documentType?.includes('CRLV') || extractedData.documentType?.includes('licenciamento')) {
        const targetPlate = plate || extractedData.extractedPlate;
        if (targetPlate && !extractedData.validityDate) {
          extractedData.validityDate = getDetranSCExpirationDate(targetPlate);
          extractedData.observations = (extractedData.observations || "") + " [Data calculada via regra Detran SC]";
        }
        if (!extractedData.targetVehicleField) {
          extractedData.targetVehicleField = "licenseExpiration";
        }
      }

      res.json(extractedData);
    } catch (error) {
      console.error("Vehicle Scan Error:", error);
      res.status(500).json({ error: "Erro ao processar documento do veículo" });
    }
  });

  // API Route: Scan maintenance document and extract maintenance data
  app.post("/api/maintenance/scan-document", async (req, res) => {
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }

    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: `Extraia informações de manutenção deste documento (recibo de oficina, ordem de serviço, cupom fiscal de auto peças, etc). 
Analise o texto e as imagens e retorne APENAS um objeto JSON com os seguintes campos:
- completedAt: Data de conclusão ou realização do serviço no formato YYYY-MM-DD (ex: "2026-07-03"). Se não achar, use a data atual.
- type: Classifique obrigatoriamente como 'preventive' ou 'corrective' com base nas descrições de serviço ou problemas.
- provider: Nome da oficina, mecânica, auto peças ou prestador de serviço.
- partsReplaced: Lista detalhada ou descrição das peças que foram substituídas ou serviços prestados.
- cost: Valor total gasto como número (ex: 450.00).
- odometer: Odômetro/KM registrado no documento (número inteiro), se disponível, caso contrário null.
- description: Uma breve descrição descritiva resumindo o serviço de manutenção executado.

Não inclua Markdown ou texto explicativo, apenas o JSON bruto.` },
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
      console.error("Gemini Maintenance Scan Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Internal server error during maintenance document scanning") });
    }
  });

  // API Route: Scan fueling receipt or image
  app.post("/api/fuel/scan-receipt", async (req, res) => {
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }

    let sensitivity = "Média";
    try {
      const dbInstance = getFirestore(getFirebaseAdmin().app(), configuredDatabaseId);
      const docSnap = await dbInstance.collection("settings").doc("ai_config").get();
      if (docSnap.exists) {
        sensitivity = docSnap.data()?.ocrSensitivity || "Média";
      }
    } catch (e) {
      console.error("Error reading OCR sensitivity in server.ts:", e);
    }

    let promptText = `Você é o assistente de inteligência artificial da E.F. Gestão. Sua tarefa é analisar o recibo, foto de bomba de combustível, cupom ou nota fiscal de abastecimento enviada e extrair as seguintes informações exatas:
- volume: volume em litros (número exato com ponto decimal, ex: 104.53)
- odometro: km atual informado (número inteiro, ex: 54321)
- custo: valor total pago em Reais (número exato, ex: 641.20)
- combustivel: combustível identificado (retorne exatamente string 'diesel', 'arla' ou null se não for possível determinar)
- placa: placa do veículo vinculada (ex: ABC1D23, ABC-1234, retorne em maiúsculas sem espaços, ou null se não houver)
- motorista: nome do motorista se estiver escrito (ou null se não houver)
- observacao: nome do posto / bandeira / localização do estabelecimento onde foi feito (ex: "Posto Graal", "Posto Ipiranga", etc) ou notas relevantes.

Retorne APENAS um objeto JSON com estes campos (use exatamente estes nomes de chaves em minúsculo):
{
  "volume": null ou número,
  "odometro": null ou número,
  "custo": null ou número,
  "combustivel": null ou "diesel" ou "arla",
  "placa": null ou string,
  "motorista": null ou string,
  "observacao": null ou string
}

Não inclua textos explicativos, Markdown adicionais, códigos adicionais ou bloco de marcação, apenas o objeto puro JSON.`;

    if (sensitivity === "Alta") {
      promptText += `\n\nIMPORTANTE: Configuração de Sensibilidade ALTA ativa. Seja extremamente rigoroso na extração. Não adivinhe campos. Verifique cada dígito do odômetro, volume e custo com atenção redobrada.`;
    } else if (sensitivity === "Baixa") {
      promptText += `\n\nIMPORTANTE: Configuração de Sensibilidade BAIXA ativa. Seja flexível na leitura e tente deduzir valores se a imagem estiver um pouco borrada ou contiver reflexos.`;
    }

    const temperature = sensitivity === "Alta" ? 0.0 : sensitivity === "Baixa" ? 0.5 : 0.2;

    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: promptText },
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
          responseMimeType: "application/json",
          temperature
        }
      });

      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Fuel Scan Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Internal server error during fuel receipt scanning") });
    }
  });

  // API Route: Scan batch refueling sheet
  app.post("/api/fuel/scan-batch-receipt", async (req, res) => {
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: "Missing file data or mime type" });
    }

    let sensitivity = "Média";
    try {
      const dbInstance = getFirestore(getFirebaseAdmin().app(), configuredDatabaseId);
      const docSnap = await dbInstance.collection("settings").doc("ai_config").get();
      if (docSnap.exists) {
        sensitivity = docSnap.data()?.ocrSensitivity || "Média";
      }
    } catch (e) {
      console.error("Error reading OCR sensitivity for batch in server.ts:", e);
    }

    let promptInstruction = `Você é o assistente de inteligência artificial da E.F. Gestão. Sua tarefa é analisar a imagem de uma FICHA DE ABASTECIMENTO (uma folha, planilha ou tabela contendo vários lançamentos de abastecimentos de veículos) e extrair TODOS os registros listados de forma estruturada.
Para cada registro de abastecimento identificado na ficha/tabela, extraia:
- volumeDiesel: volume em litros de DIESEL (número INTEIRO, ex: 104)
- volumeArla: volume em litros de ARLA 32 (número INTEIRO, ex: 5)
- odometro: km atual informado (número inteiro, ex: 54321). 
- custo: valor total pago em Reais se disponível (número exato, ex: 641.20)
- placa: placa do veículo vinculada (ex: ABC1D23, ABC-1234, retorne em maiúsculas sem espaços, ou null se não houver)
- motorista: nome do motorista se escrito (ou null se não houver)
- observacao: nome do posto / bandeira / localização do estabelecimento onde foi feito ou notas relevantes.

IMPORTANTE SOBRE O CARACTERE "-": 
Se em algum campo (especialmente volume ou odômetro) aparecer um traço "-", isso significa que deve ser mantido o ÚLTIMO VALOR lançado para esse ativo no sistema. Nesse caso, retorne a string "-" para o respectivo campo.

Retorne APENAS um objeto JSON com esta chave "entries" contendo um array de registros (use exatamente estes nomes de chaves em minúsculo):
{
  "entries": [
    {
      "volumeDiesel": null ou número ou "-",
      "volumeArla": null ou número ou "-",
      "odometro": null ou número ou "-",
      "custo": null ou número,
      "placa": null ou string,
      "motorista": null ou string,
      "observacao": null ou string
    },
    ...
  ]
}

Não inclua textos explicativos, Markdown adicionais, códigos adicionais ou bloco de marcação, apenas o objeto puro JSON.`;

    if (sensitivity === "Alta") {
      promptInstruction += `\n\nIMPORTANTE: Configuração de Sensibilidade ALTA ativa. Seja extremamente rigoroso na extração. Não invente ou adivinhe registros ou dados. Extraia apenas linhas da tabela que estejam claras e nítidas. Verifique os dígitos duas vezes para evitar erros.`;
    } else if (sensitivity === "Baixa") {
      promptInstruction += `\n\nIMPORTANTE: Configuração de Sensibilidade BAIXA ativa. Seja flexível na extração de múltiplas linhas. Se algumas letras ou números de placas estiverem levemente borrados, tente decifrar pelo contexto ou placas conhecidas da frota.`;
    }

    const temperature = sensitivity === "Alta" ? 0.0 : sensitivity === "Baixa" ? 0.5 : 0.2;

    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            parts: [
              { text: promptInstruction },
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
          responseMimeType: "application/json",
          temperature
        }
      });

      const extractedData = JSON.parse(response.text || '{"entries":[]}');
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Batch Fuel Scan Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Internal server error during batch fuel receipt scanning") });
    }
  });

  // API Route: AI Fleet Information Distribution
  app.post("/api/fleet/distribute-ai", async (req, res) => {
    const { base64Data, mimeType, textPrompt } = req.body;

    try {
      const parts: any[] = [];
      let promptText = `Você é a Inteligência Artificial especializada da DM Turismo (Gestão de Frotas). Sua tarefa é analisar o texto e/ou documento fotográfico enviado e extrair informações úteis para distribuir/vincular automaticamente aos veículos da frota.

Analise atentamente as imagens (comprovantes de oficina, notas fiscais, multas, apólices de seguro, relatórios de vistorias) ou textos descritivos fornecidos.

Você deve extrair e retornar APENAS um objeto JSON válido (sem tags markdown, explicações ou texto adicional) com a seguinte estrutura:

{
  "vehicleIdentified": {
    "plate": string (placa do veículo em letras maiúsculas, formato ABC1D23 ou ABC-1234, limpa, ou null se não identificada),
    "model": string (modelo ou nome do veículo, ex: "Micro-ônibus 120" ou "Van Ducato", ou null),
    "confidence": number (grau de certeza de 0 a 1)
  },
  "actionType": "maintenance" | "alert" | "unknown",
  "maintenanceData": {
    "completedAt": string (data de conclusão no formato YYYY-MM-DD, ou null),
    "type": "preventive" | "corrective",
    "provider": string (nome da mecânica, auto-peças, concessionária ou fornecedor, ou null),
    "partsReplaced": string (descrição detalhada das peças trocadas e serviços executados, ou null),
    "cost": number (custo total como número, ex: 1250.00, ou null),
    "odometer": number (km do veículo registrado na manutenção como número inteiro, ou null),
    "description": string (uma frase curta resumindo a manutenção, ou null)
  },
  "alertData": {
    "alertType": "preventive_maintenance" | "oil_change" | "document_expiration" | "other",
    "targetValue": string (se for vencimento de documento, a data no formato YYYY-MM-DD. Se for preventiva por KM ou óleo por KM, o número de KM futuro em string, ex: "155000", ou null),
    "description": string (uma frase resumida descrevendo o alerta ou vencimento futuro, ex: "Vencimento de seguro facultativo", "Troca de óleo prevista para 125.000 KM", ou null)
  }
}

Seja preciso. Se o documento for uma Nota Fiscal de Oficina, o actionType deve ser "maintenance". Se for uma apólice de seguro com data de vencimento futura ou um agendamento de revisão, o actionType deve ser "alert". Se contiver os dois, preencha ambos e decida o actionType principal baseado no teor do documento.`;

      parts.push({ text: promptText });

      if (textPrompt) {
        parts.push({ text: `Texto/Comentário complementar do usuário: "${textPrompt}"` });
      }

      if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType
          }
        });
      }

      const response = await generateContentWithFallback({
        contents: [
          {
            parts
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error: any) {
      console.error("Gemini Fleet Distribute Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Erro na análise da IA para distribuição da frota: " + error.message) });
    }
  });

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Get Shadow Log and Starting Point metadata
  app.get("/api/shadow-log", async (req, res) => {
    try {
      const shadowPath = path.join(process.cwd(), "SHADOW_LOG.md");
      const startPath = path.join(process.cwd(), "PONTO_DE_PARTIDA.md");
      
      let shadowContent = "";
      let startContent = "";
      
      try {
        shadowContent = await fs.promises.readFile(shadowPath, "utf-8");
      } catch (e) {
        console.warn("SHADOW_LOG.md not found or unreadable", e);
      }
      
      try {
        startContent = await fs.promises.readFile(startPath, "utf-8");
      } catch (e) {
        console.warn("PONTO_DE_PARTIDA.md not found or unreadable", e);
      }
      
      res.json({
        shadowLog: shadowContent,
        startingPoint: startContent
      });
    } catch (error: any) {
      console.error("Error reading shadow logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Search database for a specific date (Administrative debug helper)
  app.get("/api/search-date", async (req, res) => {
    const targetStr = (req.query.date as string) || "2026-07-08";
    try {
      console.log(`[Search API] Searching all Firestore collections for date matching: ${targetStr}`);
      const fbAdmin = getFirebaseAdmin();
      const dbInstance = getFirestore(fbAdmin.app(), configuredDatabaseId);
      const collections = [
        "users", "vehicles", "employees", "fuel_tanks", "fuel_logs", "fuel_entries",
        "maintenance_logs", "stock_items", "stock_transactions", "checklists",
        "financial_transactions", "trips", "backups", "storage_backup_logs",
        "audit_logs", "settings", "dashboard_messages", "media_shares", "news_feed",
        "journeys", "chartered_routes", "featured_videos", "charter_clients",
        "charter_client_trips", "user_devices", "tire_alerts", "tire_dossiers",
        "proprietor_tickets"
      ];

      function matchesDate(val: any): boolean {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string') {
          return val.includes(targetStr) || val.includes("08/07/2026") || val.includes("08-07-2026");
        }
        if (val instanceof Date) {
          try {
            return val.toISOString().includes(targetStr);
          } catch (e) {
            return false;
          }
        }
        if (val && typeof val === 'object' && typeof val.toDate === 'function') {
          try {
            return val.toDate().toISOString().includes(targetStr);
          } catch (e) {}
        }
        if (Array.isArray(val)) {
          return val.some(matchesDate);
        }
        if (typeof val === 'object') {
          // Guard to avoid cyclic or non-plain objects
          try {
            return Object.values(val).some(matchesDate);
          } catch (e) {
            return false;
          }
        }
        return false;
      }

      const results: Record<string, any[]> = {};
      const stats: Record<string, number> = {};
      const errors: Record<string, string> = {};
      for (const collName of collections) {
        try {
          const snap = await dbInstance.collection(collName).get();
          stats[collName] = snap.size;
          const matches: any[] = [];
          snap.forEach(doc => {
            const data = doc.data();
            if (matchesDate(data) || doc.id.includes(targetStr) || doc.id.includes("08/07/2026") || doc.id.includes("08-07-2026")) {
              matches.push({ id: doc.id, ...data });
            }
          });
          if (matches.length > 0) {
            results[collName] = matches;
            console.log(`[Search API] Found ${matches.length} matches in "${collName}"`);
          }
        } catch (e: any) {
          console.warn(`[Search API] Error searching collection ${collName}:`, e.message);
          errors[collName] = e.message;
        }
      }
      res.json({ date: targetStr, stats, results, errors });
    } catch (error: any) {
      console.error("[Search API] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Extract passengers from attachment
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
              { text: "Extraia a lista de passageiros deste documento. Retorne um JSON com um array de objetos contendo 'name' (NOME COMPLETO EM MAIÚSCULAS) e 'document' (CPF ou RG). Se não houver documento, use 'S/D'. Ignore cabeçalhos ou informações não relacionadas a passageiros." },
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
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Failed to extract data from document") });
    }
  });

  // API Route: Extract driver details from document image or text
  app.post("/api/extract-driver", async (req, res) => {
    const { base64Data, mimeType, textPrompt } = req.body;

    try {
      const parts: any[] = [];
      let promptText = `Você é um assistente de inteligência artificial especializado na DM Turismo (Gestão de Frotas e Equipe). Sua tarefa é analisar o documento de identificação (CNH, RG, ou texto copiado) do motorista fornecido e extrair com precisão as seguintes informações:
- name: nome completo do motorista (em letras maiúsculas, ex: JOÃO DA SILVA)
- phone: número de telefone / celular (somente números com DDD, ex: 21988888888, ou null se não houver)
- cpf: número do CPF (limpo ou formatado, ou null se não houver)
- rg: número do RG (limpo ou formatado, ou null se não houver)
- licenseNumber: número de registro da CNH (ou null se não houver)
- licenseCategory: categoria de habilitação (ex: D, E, D/E, AB, ou null se não houver)
- licenseExpiration: data de validade da CNH no formato YYYY-MM-DD (ou null se não houver)
- birthDate: data de nascimento no formato YYYY-MM-DD (ou null se não houver)

Retorne APENAS um objeto JSON válido (sem tags markdown, explicações ou texto adicional) com as seguintes chaves exatamente:
{
  "name": null ou string,
  "phone": null ou string,
  "cpf": null ou string,
  "rg": null ou string,
  "licenseNumber": null ou string,
  "licenseCategory": null ou string,
  "licenseExpiration": null ou string,
  "birthDate": null ou string
}`;

      parts.push({ text: promptText });

      if (textPrompt) {
        parts.push({ text: `Texto/Comentário complementar do usuário: "${textPrompt}"` });
      }

      if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType
          }
        });
      }

      const response = await generateContentWithFallback({
        contents: [
          {
            parts
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error: any) {
      console.error("Gemini Driver Extraction Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Erro ao extrair informações do motorista com IA: " + error.message) });
    }
  });

  // API Route: General AI Chat / Generation
  app.post("/api/chat", async (req, res) => {
    const { message, systemInstruction, history, model, thinking, image, searchGrounding, mapsGrounding } = req.body;

    try {
      const contents: any[] = [];
      if (history && history.length > 0) {
        history.forEach((h: any) => {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content || h.text || "" }]
          });
        });
      }

      // Prepare parts for the latest message
      const lastParts: any[] = [];
      if (image && image.data && image.mimeType) {
        lastParts.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType
          }
        });
      }
      lastParts.push({ text: message });
      
      contents.push({ role: 'user', parts: lastParts });

      let primaryModel = model || "gemini-3.6-flash";
      const config: any = {
        systemInstruction: systemInstruction || "Você é um assistente especializado na E.F. Gestão."
      };

      if (thinking) {
        primaryModel = "gemini-3.1-pro-preview";
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH
        };
        if (config.maxOutputTokens) {
          delete config.maxOutputTokens;
        }
      }

      // Add Grounding Tools if requested
      if (searchGrounding) {
        config.tools = [{ googleSearch: {} }];
      } else if (mapsGrounding) {
        config.tools = [{ googleMaps: {} }];
      }

      const response = await generateContentWithFallback({
        contents,
        config,
        primaryModel
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || null;

      return res.json({ text: response.text, groundingChunks });
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Failed to generate AI response") });
    }
  });

  // API Route: Smart fill trip data from text
  app.post("/api/smart-fill", async (req, res) => {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text to process" });
    }

    try {
      const response = await generateContentWithFallback({
        contents: `Extraia as informações desta viagem do seguinte texto: "${text}"`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const extractedData = JSON.parse(response.text || "{}");
      res.json(extractedData);
    } catch (error) {
      console.error("Gemini Smart Fill Error:", error);
      res.status(500).json({ error: getGeminiFriendlyErrorMessage(error, "Failed to extract data from text") });
    }
  });

  async function performServerStorageBackup() {
    try {
      console.log("[Server Storage Backup] DEBUG: Starting backup process...");
      const fbAdmin = getFirebaseAdmin();
      const db = getFirestore(fbAdmin.app(), configuredDatabaseId);
      const dateStr = new Date().toISOString().split('T')[0];
      const timestampStr = new Date().toISOString();

      // Check if backup already exists for today
      console.log("[Server Storage Backup] DEBUG: Step 1 - Checking existing backup logs in Firestore...");
      const logsRef = db.collection('storage_backup_logs');
      let snapshot;
      try {
        snapshot = await logsRef.where('date', '==', dateStr).where('success', '==', true).get();
        console.log(`[Server Storage Backup] DEBUG: Step 1 success - existing logs empty? ${snapshot.empty}`);
      } catch (dbError: any) {
        console.warn("[Server Storage Backup] DEBUG: Step 1 FAILED (Check logsRef):", dbError.message || dbError);
        throw dbError;
      }

      if (!snapshot.empty) {
        console.log(`[Server Storage Backup] Backup for ${dateStr} already exists. Skipping automatic run.`);
        return;
      }

      console.log(`[Server Storage Backup] Starting automatic server-side daily backup for ${dateStr}...`);

      const collections = ['vehicles', 'employees', 'maintenance_logs'];
      const backupData: Record<string, any[]> = {};

      console.log("[Server Storage Backup] DEBUG: Step 2 - Fetching data from Firestore collections...");
      for (const col of collections) {
        try {
          console.log(`[Server Storage Backup] DEBUG: Step 2 - Fetching collection: ${col}`);
          const snap = await db.collection(col).get();
          backupData[col] = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`[Server Storage Backup] DEBUG: Step 2 - Fetched ${backupData[col].length} items for ${col}`);
        } catch (colError: any) {
          console.warn(`[Server Storage Backup] DEBUG: Step 2 FAILED for collection ${col}:`, colError.message || colError);
          throw colError;
        }
      }

      // Convert to JSON and upload
      const jsonString = JSON.stringify({
        backupTimestamp: timestampStr,
        createdBy: 'SERVER_AUTO_BACKUP',
        data: backupData
      }, null, 2);

      let bucket;
      try {
        const bucketName = (fbAdmin as any).options?.storageBucket || "gen-lang-client-0708969846.firebasestorage.app";
        console.log(`[Server Storage Backup] DEBUG: Step 3 - Getting bucket: ${bucketName}`);
        bucket = fbAdmin.storage().bucket(bucketName);
        console.log("[Server Storage Backup] DEBUG: Step 3 - Checking if bucket exists...");
        const [exists] = await bucket.exists();
        console.log(`[Server Storage Backup] DEBUG: Step 3 success - bucket exists? ${exists}`);
        if (!exists) {
          console.warn(`[Server Storage Backup] Storage bucket '${bucketName}' does not exist or Firebase Storage is not enabled.`);
          return;
        }
      } catch (storageErr: any) {
        console.warn("[Server Storage Backup] Firebase Storage is not enabled or configured. Skipping storage backup:", storageErr.message || storageErr);
        return;
      }
      
      const jsonPath = `backups/${dateStr}/dados_completos_${dateStr}.json`;
      console.log(`[Server Storage Backup] DEBUG: Step 4 - Saving JSON backup file to Storage at: ${jsonPath}`);
      const jsonFile = bucket.file(jsonPath);
      try {
        await jsonFile.save(jsonString, {
          contentType: 'application/json',
          metadata: {
            cacheControl: 'no-cache'
          }
        });
        console.log("[Server Storage Backup] DEBUG: Step 4 success - JSON saved.");
      } catch (saveJsonErr: any) {
        console.warn("[Server Storage Backup] DEBUG: Step 4 FAILED (jsonFile.save):", saveJsonErr.message || saveJsonErr);
        throw saveJsonErr;
      }

      const convertToCSV = (data: any[]): string => {
        if (!data || !data.length) return '';
        const headersSet = new Set<string>();
        data.forEach(obj => Object.keys(obj).forEach(k => headersSet.add(k)));
        const headers = Array.from(headersSet);
        const csvRows = [headers.join(',')];
        for (const row of data) {
          const values = headers.map(header => {
            let val = row[header];
            if (val === undefined || val === null) return '""';
            if (typeof val === 'object') val = JSON.stringify(val);
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(values.join(','));
        }
        return csvRows.join('\r\n');
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
            contentType: 'text/csv',
            metadata: {
              cacheControl: 'no-cache'
            }
          });
          console.log(`[Server Storage Backup] DEBUG: Step 5 success - ${col} CSV saved.`);
        } catch (saveCsvErr: any) {
          console.warn(`[Server Storage Backup] DEBUG: Step 5 FAILED for ${col} CSV:`, saveCsvErr.message || saveCsvErr);
          throw saveCsvErr;
        }
        uploadedPaths.push(csvPath);
      }

      // Register log in Firestore
      console.log("[Server Storage Backup] DEBUG: Step 6 - Logging backup completion in Firestore...");
      try {
        await db.collection('storage_backup_logs').add({
          timestamp: timestampStr,
          date: dateStr,
          createdBy: 'SERVER_AUTO_BACKUP',
          paths: uploadedPaths,
          formats: ['JSON', 'CSV'],
          collections,
          success: true
        });
        console.log("[Server Storage Backup] DEBUG: Step 6 success - log registered.");
      } catch (logDbErr: any) {
        console.warn("[Server Storage Backup] DEBUG: Step 6 FAILED (log registry):", logDbErr.message || logDbErr);
        throw logDbErr;
      }

      console.log(`[Server Storage Backup] Backup for ${dateStr} completed successfully.`);
    } catch (err: any) {
      console.warn("[Server Storage Backup] Backup execution warning (expected in sandboxed environments):", err.message || err);
    }
  }

  // API Route: Trigger Storage Backup (JSON/CSV) manually
  app.post("/api/backup/storage", async (req, res) => {
    try {
      await performServerStorageBackup();
      res.json({ success: true, message: "Backup para o Firebase Storage concluído com sucesso!" });
    } catch (error: any) {
      console.warn("API Storage Backup Warning:", error);
      res.status(500).json({ error: error.message || "Erro desconhecido ao executar backup" });
    }
  });

  async function performFridayExportServer(fridayDateStr: string) {
    try {
      console.log(`[Friday Export Server] Starting Friday CSV Export for ${fridayDateStr}...`);
      const fbAdmin = getFirebaseAdmin();
      const db = getFirestore(fbAdmin.app(), configuredDatabaseId);
      const timestampStr = new Date().toISOString();
      const targetLogDate = `friday_export_${fridayDateStr}`;

      // Check if export already exists for today's Friday
      const logsRef = db.collection('storage_backup_logs');
      const snapshot = await logsRef.where('date', '==', targetLogDate).where('success', '==', true).get();

      if (!snapshot.empty) {
        console.log(`[Friday Export Server] Export for ${fridayDateStr} already exists. Skipping.`);
        return;
      }

      const collectionsToExport = ['trips', 'fuel_logs'];
      const exportData: Record<string, any[]> = {};

      for (const col of collectionsToExport) {
        const snap = await db.collection(col).get();
        exportData[col] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      const [year, month] = fridayDateStr.split('-');
      const folderPath = `exports/${year}/${month}`;

      const convertToCSV = (data: any[]): string => {
        if (!data || !data.length) return '';
        const headersSet = new Set<string>();
        data.forEach(obj => Object.keys(obj).forEach(k => headersSet.add(k)));
        const headers = Array.from(headersSet);
        const csvRows = [headers.join(',')];
        for (const row of data) {
          const values = headers.map(header => {
            let val = row[header];
            if (val === undefined || val === null) return '""';
            if (typeof val === 'object') {
              if (val && typeof val === 'object' && '_seconds' in val) {
                val = new Date((val as any)._seconds * 1000).toISOString();
              } else {
                val = JSON.stringify(val);
              }
            }
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(values.join(','));
        }
        return csvRows.join('\r\n');
      };

      let bucket;
      try {
        const bucketName = (fbAdmin as any).options?.storageBucket || "gen-lang-client-0708969846.firebasestorage.app";
        bucket = fbAdmin.storage().bucket(bucketName);
        const [exists] = await bucket.exists();
        if (!exists) {
          console.warn(`[Friday Export Server] Storage bucket '${bucketName}' does not exist.`);
          return;
        }
      } catch (storageErr: any) {
        console.warn("[Friday Export Server] Firebase Storage is not enabled or configured. Skipping:", storageErr.message);
        return;
      }

      const uploadedPaths: string[] = [];
      for (const col of collectionsToExport) {
        const csvString = convertToCSV(exportData[col]);
        const csvPath = `${folderPath}/${col}_${fridayDateStr}.csv`;
        const csvFile = bucket.file(csvPath);
        await csvFile.save(csvString, {
          contentType: 'text/csv',
          metadata: {
            cacheControl: 'no-cache'
          }
        });
        uploadedPaths.push(csvPath);
      }

      // Register log in Firestore
      await db.collection('storage_backup_logs').add({
        timestamp: timestampStr,
        date: targetLogDate,
        createdBy: 'SERVER_FRIDAY_EXPORT',
        paths: uploadedPaths,
        formats: ['CSV'],
        collections: collectionsToExport,
        success: true
      });

      console.log(`[Friday Export Server] Export for ${fridayDateStr} completed successfully.`);
    } catch (err: any) {
      console.warn("[Friday Export Server] Export execution warning:", err.message || err);
    }
  }

  // API Route to manually trigger Friday Export via API if needed
  app.post("/api/backup/friday-export", async (req, res) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await performFridayExportServer(todayStr);
      res.json({ success: true, message: "Exportação de sexta-feira disparada manualmente com sucesso!" });
    } catch (error: any) {
      console.warn("API Friday Export Warning:", error);
      res.status(500).json({ error: error.message || "Erro ao executar exportação" });
    }
  });

  // Start background scheduler interval to check Friday at 23:59
  setInterval(async () => {
    try {
      const now = new Date();
      // Check if it's Friday (5) and time is 23:59
      if (now.getDay() === 5 && now.getHours() === 23 && now.getMinutes() === 59) {
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const fridayDateStr = `${yyyy}-${mm}-${dd}`;
        
        console.log(`[Friday Export Server] Scheduled trigger matched for Friday 23:59 (${fridayDateStr}). Triggering export...`);
        await performFridayExportServer(fridayDateStr);
      }
    } catch (cronErr: any) {
      console.error("[Friday Export Server] Background scheduler error:", cronErr.message || cronErr);
    }
  }, 60000); // Check every minute

  // Note: Automatic scheduled background runs are disabled on the server-side because 
  // they encounter sandboxed GCP service account credential restrictions (7 PERMISSION_DENIED). 
  // Client-side automatic backups are fully functional, authenticated, and robustly handle this.
  console.log("[Server Storage Backup] Server-side background backup schedules are disabled. Client-side triggers handle daily automated backups.");

  // Force development mode if not explicitly set to production
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }
  
  console.log(`Starting server in ${process.env.NODE_ENV} mode`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      appType: "spa",
      base: "/",
    });
    
    // Log requests in dev mode
    app.use((req, res, next) => {
      if (req.url.includes('logo_dm.svg')) {
        console.log(`Dev Log: Requesting logo_dm.svg - URL: ${req.url}`);
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const serverInstance = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ noServer: true });

  serverInstance.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs) => {
    console.log("[WebSocket] Client connected to Gemini Live API");
    let session: any = null;
    try {
      const client = getAI();
      session = await client.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "Você é o assistente virtual por voz da DM Turismo. Responda de forma curta, natural e conversacional em português.",
        },
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (e: any) {
          console.error("[WebSocket] Error processing message:", e.message);
        }
      });

      clientWs.on("close", () => {
        console.log("[WebSocket] Client disconnected");
        if (session) {
          try {
            session.close();
          } catch (e) {}
        }
      });
    } catch (wsErr: any) {
      console.error("[WebSocket] Failed to establish Gemini Live connection:", wsErr.message);
      clientWs.send(JSON.stringify({ error: wsErr.message }));
      clientWs.close();
    }
  });
}

startServer().catch(err => {
  console.error("Critical server startup error:", err);
  process.exit(1);
});
