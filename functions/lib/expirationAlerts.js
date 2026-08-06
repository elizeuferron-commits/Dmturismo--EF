"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpirationsAndNotify = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
/**
 * Função utilitária para calcular a diferença em dias entre uma data alvo ("YYYY-MM-DD")
 * e a data atual, utilizando o meio-dia (12:00) para evitar desvios de fuso horário.
 */
function getDaysDifference(targetDateStr) {
    if (!targetDateStr)
        return Infinity;
    const parts = targetDateStr.split("-");
    if (parts.length !== 3)
        return Infinity;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Meses de 0 a 11
    const day = parseInt(parts[2], 10);
    const targetDate = new Date(year, month, day, 12, 0, 0, 0);
    const today = new Date();
    const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
    const diffTime = targetDate.getTime() - currentDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
/**
 * Formata datas do padrão "YYYY-MM-DD" para "DD/MM/YYYY".
 */
function formatDateBR(dateStr) {
    if (!dateStr)
        return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3)
        return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
/**
 * Cloud Function Agendada (v2) que roda diariamente às 08:00 (America/Sao_Paulo).
 * Verifica CNH vencendo/vencida de motoristas ativos e documentações de frota
 * (Licenciamento, IPVA, Seguro APP, ANTT) e dispara notificações push coletivas.
 */
exports.checkExpirationsAndNotify = (0, scheduler_1.onSchedule)({
    schedule: "0 8 * * *", // Roda diariamente às 08:00
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 120
}, async (event) => {
    console.log("[Expiration Audit] Iniciando varredura diária de vencimentos...");
    const db = admin.firestore();
    const alerts = [];
    // --- 1. Varredura de CNH (Employees com role "Motorista" ou que possuem CNH ativada) ---
    try {
        const employeesSnap = await db.collection("employees")
            .where("status", "==", "active")
            .get();
        employeesSnap.forEach((doc) => {
            const emp = doc.data();
            if (emp.licenseExpiration) {
                const daysLeft = getDaysDifference(emp.licenseExpiration);
                if (daysLeft <= 30 && daysLeft >= 0) {
                    alerts.push(`🪪 Motorista "${emp.name}" tem CNH vencendo em ${daysLeft} dias (${formatDateBR(emp.licenseExpiration)}).`);
                }
                else if (daysLeft < 0) {
                    alerts.push(`🚨 ATENÇÃO: Motorista "${emp.name}" está com a CNH VENCIDA desde ${formatDateBR(emp.licenseExpiration)}!`);
                }
            }
        });
    }
    catch (err) {
        console.error("[Expiration Audit] Erro ao ler colección de employees:", err);
    }
    // --- 2. Varredura de Documentações de Veículos (vehicles) ---
    try {
        const vehiclesSnap = await db.collection("vehicles").get();
        vehiclesSnap.forEach((doc) => {
            const veh = doc.data();
            if (veh.status === "inactive")
                return; // Ignora veículos desativados
            const label = veh.plate ? `${veh.model || "Veículo"} (${veh.plate})` : (veh.model || "Veículo");
            // A. Licenciamento Anual (licenseExpiration)
            if (veh.licenseExpiration) {
                const daysLeft = getDaysDifference(veh.licenseExpiration);
                if (daysLeft <= 30 && daysLeft >= 0) {
                    alerts.push(`🚌 Licenciamento do veículo ${label} vence em ${daysLeft} dias (${formatDateBR(veh.licenseExpiration)}).`);
                }
                else if (daysLeft < 0) {
                    alerts.push(`🚨 CRÍTICO: Licenciamento do veículo ${label} está VENCIDO (${formatDateBR(veh.licenseExpiration)})!`);
                }
            }
            // B. Licenciamentos de Turismo / ANTT / Cadastur (tourismLicenseExpiration)
            if (veh.tourismLicenseExpiration) {
                const daysLeft = getDaysDifference(veh.tourismLicenseExpiration);
                if (daysLeft <= 30 && daysLeft >= 0) {
                    alerts.push(`✈️ Certificado de Turismo do veículo ${label} vence em ${daysLeft} dias (${formatDateBR(veh.tourismLicenseExpiration)}).`);
                }
                else if (daysLeft < 0) {
                    alerts.push(`🚨 CRÍTICO: Certificado de Turismo do veículo ${label} está VENCIDO (${formatDateBR(veh.tourismLicenseExpiration)})!`);
                }
            }
            // C. Seguro APP / Responsabilidade Civil (insuranceExpiration)
            if (veh.insuranceExpiration) {
                const daysLeft = getDaysDifference(veh.insuranceExpiration);
                if (daysLeft <= 30 && daysLeft >= 0) {
                    alerts.push(`🔒 Seguro Obrigatório/APP do veículo ${label} vence em ${daysLeft} dias (${formatDateBR(veh.insuranceExpiration)}).`);
                }
                else if (daysLeft < 0) {
                    alerts.push(`🚨 CRÍTICO: Seguro Obrigatório/APP do veículo ${label} está VENCIDO (${formatDateBR(veh.insuranceExpiration)})!`);
                }
            }
        });
    }
    catch (err) {
        console.error("[Expiration Audit] Erro ao ler colección de vehicles:", err);
    }
    // --- 3. Enviar Notificações Push via FCM se houver alertas ---
    if (alerts.length === 0) {
        console.log("[Expiration Audit] Varredura concluída. Nenhum documento próximo do vencimento.");
        return { success: true, message: "Nenhum vencimento detectado para os próximos 30 dias." };
    }
    console.log(`[Expiration Audit] Detectados ${alerts.length} alertas de vencimento. Preparando push...`);
    // Busca os dispositivos registrados
    let tokens = [];
    try {
        const devicesSnap = await db.collection("user_devices").get();
        tokens = devicesSnap.docs.map(doc => doc.data().token).filter(Boolean);
    }
    catch (error) {
        console.error("[Expiration Audit] Erro ao carregar user_devices:", error);
    }
    if (tokens.length === 0) {
        console.log("[Expiration Audit] Sem dispositivos ativos cadastrados (user_devices) para receber push.");
        return {
            success: true,
            message: `Detectados ${alerts.length} alertas, mas nenhum dispositivo FCM registrado.`,
            alerts
        };
    }
    // Limita notificações push concatenadas a um resumo resumido legível no celular
    const title = "⚠️ Alerta de Vencimento de Documentos";
    const body = alerts.length === 1
        ? alerts[0]
        : `${alerts.length} pendências ativas (CNH / Licenciamentos) vencendo nos próximos 30 dias. Acesse o sistema para detalhes.`;
    try {
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title,
                body,
            },
            data: {
                type: "expiration_audit_alert",
                alertsCount: String(alerts.length),
            },
            webpush: {
                notification: {
                    icon: "/logo_dm.svg",
                    badge: "/logo_dm.svg",
                    tag: "expiration_audit",
                    requireInteraction: true,
                },
                fcmOptions: {
                    link: "https://gen-lang-client-0708969846.web.app/#vencimentos"
                }
            }
        });
        console.log(`[Expiration Audit] FCM MultiCast completado. Sucesso: ${response.successCount}, Falha: ${response.failureCount}`);
        // Registrar log oficial em audit_logs para visibilidade administrativa na auditoria
        await db.collection("audit_logs").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: "AUTO_SYSTEM",
            userEmail: "fcm-scheduler@dm-turismo.com",
            action: "DOCUMENT_EXPIRATION_AUDIT",
            entityType: "System",
            entityId: "Scheduler",
            details: `Varredura diária de vencimentos completada. Encontradas ${alerts.length} pendências. Notificação push enviada a ${response.successCount} dispositivos.`
        });
        return {
            success: true,
            sentCount: response.successCount,
            alertsDetected: alerts.length,
            alerts
        };
    }
    catch (error) {
        console.error("[Expiration Audit] Erro no envio multicast FCM:", error);
        throw error;
    }
});
//# sourceMappingURL=expirationAlerts.js.map