import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

/**
 * Cloud Function Agendada (v2) que roda semanalmente aos domingos às 04:00 (America/Sao_Paulo).
 * Realiza a limpeza de registros de auditoria (audit_logs) mais antigos que 90 dias,
 * mantendo a coleção enxuta e otimizando os custos de leitura/índice no Firestore.
 */
export const scheduledAuditLogsCleanup = onSchedule(
  {
    schedule: "0 4 * * 0", // Semanalmente, Domingo às 04:00
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 300
  },
  async (event) => {
    console.log("[Auto Cleanup] Iniciando rotina de expurgo de logs de auditoria antigos...");
    const db = admin.firestore();

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
      // Consulta registros de auditoria criados há mais de 90 dias
      const snapshot = await db.collection("audit_logs")
        .where("timestamp", "<", admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
        .limit(500)
        .get();

      if (snapshot.empty) {
        console.log("[Auto Cleanup] Nenhum log de auditoria antigo encontrado para remoção.");
        return { success: true, deletedCount: 0 };
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`[Auto Cleanup] ${snapshot.size} logs de auditoria antigos foram removidos com sucesso.`);

      // Grava log da própria ação de manutenção para rastreabilidade
      await db.collection("audit_logs").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: "AUTO_SYSTEM",
        userEmail: "cleanup-scheduler@dm-turismo.com",
        action: "AUTOMATIC_AUDIT_LOG_PURGE",
        entityType: "System",
        entityId: "CleanupScheduler",
        details: `Limpeza automática executada: ${snapshot.size} registros com mais de 90 dias foram removidos.`
      });

      return { success: true, deletedCount: snapshot.size };
    } catch (error) {
      console.error("[Auto Cleanup] Erro na rotina de expurgo de audit_logs:", error);
      throw error;
    }
  }
);

/**
 * Cloud Function Agendada (v2) que roda semanalmente aos domingos às 04:30 (America/Sao_Paulo).
 * Remove tokens de dispositivos inativos (user_devices) sem uso há mais de 60 dias.
 */
export const scheduledDatabaseCleanup = onSchedule(
  {
    schedule: "30 4 * * 0", // Semanalmente, Domingo às 04:30
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 180
  },
  async (event) => {
    console.log("[Auto Cleanup] Iniciando limpeza de dados obsoletos da base de dados...");
    const db = admin.firestore();

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    try {
      const devicesSnap = await db.collection("user_devices")
        .where("updatedAt", "<", admin.firestore.Timestamp.fromDate(sixtyDaysAgo))
        .limit(300)
        .get();

      if (devicesSnap.empty) {
        console.log("[Auto Cleanup] Nenhum dispositivo inativo encontrado para expurgo.");
        return { success: true, deletedCount: 0 };
      }

      const batch = db.batch();
      devicesSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`[Auto Cleanup] ${devicesSnap.size} tokens de dispositivos obsoletos foram removidos.`);

      return { success: true, deletedCount: devicesSnap.size };
    } catch (error) {
      console.error("[Auto Cleanup] Erro na limpeza de dispositivos inativos:", error);
      throw error;
    }
  }
);
