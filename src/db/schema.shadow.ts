import { pgTable, serial, text, timestamp, integer, boolean, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tabela de Usuários (Sincronizada com Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  role: text('role').default('user'), // admin, manager, driver, etc.
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relacionamentos de Usuários
export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
}));

// Tabela de Logs de Auditoria
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE
  entityType: text('entity_type').notNull(), // VEHICLE, TRIP, etc.
  entityId: text('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Veículos (Exemplo de migração para SQL)
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  prefix: text('prefix').notNull().unique(),
  plate: text('plate').notNull().unique(),
  model: text('model'),
  brand: text('brand'),
  year: integer('year'),
  capacity: integer('capacity'),
  status: text('status').default('active'), // active, maintenance, inactive
  currentKm: numeric('current_km').default('0'),
  lastMaintenanceKm: numeric('last_maintenance_km').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
