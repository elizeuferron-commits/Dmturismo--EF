"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpirationsAndNotify = exports.onUrgentMaintenanceAlert = exports.onTripScheduled = exports.triggerManualBackup = exports.scheduledFirestoreBackup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
// Initialize Firebase Admin SDK
admin.initializeApp();
/**
 * Scheduled Cloud Function (v2) which runs daily at 03:00 (America/Sao_Paulo).
 * Triggers a full, secure, native Firestore export to the Firebase Storage Bucket.
 */
exports.scheduledFirestoreBackup = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * *", // 03:00 daily
    timeZone: "America/Sao_Paulo",
    memory: "512MiB",
    timeoutSeconds: 300 // 5 minutes
}, async (event) => {
    // Use the Firestore Administration Client from SDK
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT || "gen-lang-client-0708969846";
    // standard bucket specified in firebaseapp.com, we use the storageBucket or a dedicated backups bucket if defined
    const storageBucket = process.env.BACKUP_BUCKET || "gen-lang-client-0708969846.firebasestorage.app";
    const bucketUri = storageBucket.startsWith("gs://") ? storageBucket : `gs://${storageBucket}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const outputUriPrefix = `${bucketUri}/firestore_backups/${dateStr}`;
    const databaseName = client.databasePath(projectId, "(default)");
    console.log(`[Backup] Starting scheduled auto-backup for Firestore.`);
    console.log(`[Backup] Database Path: ${databaseName}`);
    console.log(`[Backup] Target Location: ${outputUriPrefix}`);
    try {
        // Trigger native backup export process (atomic & binary-safe export)
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: outputUriPrefix,
            collectionIds: [] // Back up all collections (wildcard default)
        });
        console.log(`[Backup] Export operation successfully initiated. Operation name: ${operation.name}`);
        // We log the snapshot metadata to `/backups` collection so the platform client remains coordinated
        const db = admin.firestore();
        await db.collection("backups").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: "AUTO_CLOUD_FUNCTION",
            size: -1, // Indication token for native system-wide deep backup
            gcsPath: outputUriPrefix,
            operationName: operation.name || "N/A",
            status: "AUTO_DAILY"
        });
        return {
            success: true,
            operationName: operation.name,
            outputUriPrefix: outputUriPrefix
        };
    }
    catch (error) {
        console.error("[Backup] Execution error on triggering Firestore documents export:", error);
        const db = admin.firestore();
        await db.collection("backups").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: "AUTO_CLOUD_FUNCTION",
            size: 0,
            error: error instanceof Error ? error.message : String(error),
            status: "FAILED"
        });
        throw error;
    }
});
/**
 * HTTPS OnRequest Cloud Function (v2).
 * Triggers a manual Firestore backup/export.
 * Secured by verifying Firebase ID Token and restricts trigger capability to the owner (elizeuferron@gmail.com).
 */
exports.triggerManualBackup = (0, https_1.onRequest)({
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 300
}, async (req, res) => {
    try {
        // Handle preflight OPTIONS request
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        // Check Authorization Header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "No Auth Token provided" });
            return;
        }
        const idToken = authHeader.substring(7);
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        // Verify email matches the system owner
        if (decodedToken.email !== "elizeuferron@gmail.com") {
            res.status(403).json({ error: "Forbidden: Only the owner can request direct exports to Storage" });
            return;
        }
        const client = new admin.firestore.v1.FirestoreAdminClient();
        const projectId = process.env.GCLOUD_PROJECT || "gen-lang-client-0708969846";
        const storageBucket = process.env.BACKUP_BUCKET || "gen-lang-client-0708969846.firebasestorage.app";
        const bucketUri = storageBucket.startsWith("gs://") ? storageBucket : `gs://${storageBucket}`;
        const dateStr = new Date().toISOString().split("T")[0];
        const timeStr = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
        const outputUriPrefix = `${bucketUri}/firestore_backups/manual_${dateStr}_${timeStr}`;
        const databaseName = client.databasePath(projectId, "(default)");
        console.log(`[Manual Backup] Export initiated manually by ${decodedToken.email}. Target: ${outputUriPrefix}`);
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: outputUriPrefix,
            collectionIds: [] // all collections
        });
        const db = admin.firestore();
        await db.collection("backups").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: decodedToken.email,
            size: -1,
            gcsPath: outputUriPrefix,
            operationName: operation.name || "N/A",
            status: "MANUAL_EXPORT"
        });
        res.status(200).json({
            success: true,
            message: "Manual GCS Firestore Export successfully initiated",
            operationName: operation.name,
            gcsPath: outputUriPrefix
        });
    }
    catch (error) {
        console.error("[Manual Backup Error]:", error);
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
});
/**
 * Triggers when a new trip is scheduled.
 * Broadcasts a push notification to all registered user devices.
 */
exports.onTripScheduled = (0, firestore_1.onDocumentCreated)({
    document: "trips/{tripId}",
    region: "us-east1",
    memory: "256MiB"
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log("[FCM Trip] No snapshot available.");
        return;
    }
    const trip = snap.data();
    if (!trip) {
        console.log("[FCM Trip] No trip data found.");
        return;
    }
    // Only notify if trip is scheduled or active
    if (trip.status !== "scheduled" && trip.status !== "active") {
        console.log(`[FCM Trip] Trip status is '${trip.status}', skipping notification.`);
        return;
    }
    const title = "🚀 Nova Viagem Agendada!";
    const body = `Viagem "${trip.title || 'Sem título'}" de ${trip.origin || 'N/A'} para ${trip.destination || 'N/A'} agendada para ${trip.startDate || 'N/A'}.`;
    console.log(`[FCM Trip] Broadcasting scheduled trip alert: "${trip.title}"`);
    // Fetch registered devices
    const db = admin.firestore();
    const devicesSnap = await db.collection("user_devices").get();
    const tokens = devicesSnap.docs.map(doc => doc.data().token).filter(Boolean);
    if (tokens.length === 0) {
        console.log("[FCM Trip] No registered device tokens found.");
        return;
    }
    try {
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title,
                body,
            },
            data: {
                type: "trip_scheduled",
                tripId: event.params.tripId,
            },
            webpush: {
                notification: {
                    icon: "/logo_dm.svg",
                    badge: "/logo_dm.svg",
                },
                fcmOptions: {
                    link: "https://gen-lang-client-0708969846.web.app/#trips"
                }
            }
        });
        console.log(`[FCM Trip] Successfully sent ${response.successCount} notifications. Failed: ${response.failureCount}`);
    }
    catch (error) {
        console.error("[FCM Trip] Error broadcasting push notifications:", error);
    }
});
/**
 * Triggers when a corrective or pending maintenance is registered.
 * Broadcasts an urgent push notification alert to all registered staff/user devices.
 */
exports.onUrgentMaintenanceAlert = (0, firestore_1.onDocumentCreated)({
    document: "maintenance_logs/{logId}",
    region: "us-east1",
    memory: "256MiB"
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log("[FCM Maintenance] No snapshot available.");
        return;
    }
    const log = snap.data();
    if (!log) {
        console.log("[FCM Maintenance] No maintenance data found.");
        return;
    }
    // Urgent if corrective maintenance or specifically flagged/status is pending for corrective
    const isUrgent = log.type === "corrective" && log.status === "pending";
    if (!isUrgent) {
        console.log(`[FCM Maintenance] Maintenance type is ${log.type}, status is ${log.status}. Skipping push alert.`);
        return;
    }
    const title = "⚠️ ALERTA: Manutenção Corretiva Urgente!";
    const body = `Manutenção corretiva registrada: "${log.description || 'Sem descrição'}" para o veículo ID ${log.vehicleId || "N/A"}.`;
    console.log(`[FCM Maintenance] Broadcasting urgent maintenance alert: "${log.description}"`);
    const db = admin.firestore();
    const devicesSnap = await db.collection("user_devices").get();
    const tokens = devicesSnap.docs.map(doc => doc.data().token).filter(Boolean);
    if (tokens.length === 0) {
        console.log("[FCM Maintenance] No registered device tokens found.");
        return;
    }
    try {
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title,
                body,
            },
            data: {
                type: "urgent_maintenance",
                logId: event.params.logId,
                vehicleId: log.vehicleId || "",
            },
            webpush: {
                notification: {
                    icon: "/logo_dm.svg",
                    badge: "/logo_dm.svg",
                },
                fcmOptions: {
                    link: "https://gen-lang-client-0708969846.web.app/#fleet"
                }
            }
        });
        console.log(`[FCM Maintenance] Successfully sent ${response.successCount} notifications. Failed: ${response.failureCount}`);
    }
    catch (error) {
        console.error("[FCM Maintenance] Error broadcasting urgent maintenance push:", error);
    }
});
// Import and export schedule notification function to make it active and deployable
var expirationAlerts_1 = require("./expirationAlerts");
Object.defineProperty(exports, "checkExpirationsAndNotify", { enumerable: true, get: function () { return expirationAlerts_1.checkExpirationsAndNotify; } });
//# sourceMappingURL=index.js.map