/**
 * Esquema de base de datos de Lavafy (lavaderos físicos).
 *
 * Convenciones:
 *  - Tablas y columnas en snake_case en Postgres; propiedades en camelCase en TS.
 *  - IDs uuid generados por la base (gen_random_uuid).
 *  - Fechas/horas absolutas en `timestamptz` (UTC). Horarios "de reloj" del lavadero
 *    (apertura/cierre) como minutos desde la medianoche (0–1440) en la zona del lavadero.
 *  - Montos en pesos enteros (ARS sin centavos).
 *  - Los turnos guardan un "snapshot" del servicio, precio y vehículo: si mañana el lavadero
 *    cambia precios o borra un servicio, el historial no se rompe.
 *
 * Ver docs/base-de-datos.md para el detalle y las decisiones.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const vehicleTypeEnum = pgEnum("vehicle_type", ["auto", "suv", "pickup", "moto"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "staff"]);
export const businessStatusEnum = pgEnum("business_status", ["draft", "active", "suspended"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending", //       esperando aprobación del lavadero
  "confirmed", //     confirmado, el auto todavía no llegó
  "in_progress", //   el auto está en el lavadero, se está lavando
  "ready", //         listo para retirar
  "completed", //     retirado / finalizado
  "cancelled",
  "no_show", //       el cliente no vino
]);
export const bookingSourceEnum = pgEnum("booking_source", ["online", "manual", "walk_in"]);
export const cancelledByEnum = pgEnum("cancelled_by", ["customer", "business"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ─── Usuarios y autenticación (formato requerido por Auth.js) ──────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  phone: text("phone"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  ...timestamps,
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "oidc" | "email" | "webauthn">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("accounts_user_idx").on(t.userId)],
);

// Las sesiones van en JWT; estas tablas existen porque el adapter de Auth.js las espera.
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ─── Lavaderos (tenants) ──────────────────────────────────────────────────────

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),

    // Contacto
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    instagram: text("instagram"),

    // Ubicación
    address: text("address"),
    city: text("city"),
    province: text("province"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),

    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),

    // Reglas de agenda
    timezone: text("timezone").notNull().default("America/Argentina/Cordoba"),
    /** Autos que se pueden atender en simultáneo. */
    capacity: smallint("capacity").notNull().default(1),
    /** Cada cuántos minutos arranca un turno (15, 20, 30, 60…). */
    slotIntervalMinutes: smallint("slot_interval_minutes").notNull().default(30),
    /** Anticipación mínima para sacar turno online. */
    minLeadMinutes: integer("min_lead_minutes").notNull().default(60),
    /** Hasta cuántos días para adelante se puede reservar. */
    maxDaysAhead: smallint("max_days_ahead").notNull().default(30),
    /** El cliente puede cancelar/reprogramar hasta X minutos antes del turno. */
    cancelWindowMinutes: integer("cancel_window_minutes").notNull().default(60),
    /** Si es true, los turnos online entran como "pending" y el lavadero los aprueba. */
    requiresApproval: boolean("requires_approval").notNull().default(false),

    status: businessStatusEnum("status").notNull().default("draft"),

    // Suscripción (MVP: solo trial; los planes pagos vienen después)
    plan: text("plan").notNull().default("trial"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => [
    index("businesses_status_city_idx").on(t.status, t.city),
    check("businesses_capacity_chk", sql`${t.capacity} between 1 and 50`),
    check("businesses_interval_chk", sql`${t.slotIntervalMinutes} between 5 and 240`),
  ],
);

/** Quién administra cada lavadero. Un usuario puede tener varios lavaderos. */
export const businessMembers = pgTable(
  "business_members",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.userId] }), index("business_members_user_idx").on(t.userId)],
);

/** Galería de fotos del lavadero (se muestra en su página pública). */
export const businessPhotos = pgTable(
  "business_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    width: smallint("width"),
    height: smallint("height"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("business_photos_business_idx").on(t.businessId, t.sortOrder)],
);

// ─── Horarios ─────────────────────────────────────────────────────────────────

/** Horario semanal. Puede haber varios tramos por día (ej. 9–13 y 15–20). */
export const openingHours = pgTable(
  "opening_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** 0 = domingo … 6 = sábado */
    weekday: smallint("weekday").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
  },
  (t) => [
    index("opening_hours_business_idx").on(t.businessId, t.weekday),
    check("opening_hours_weekday_chk", sql`${t.weekday} between 0 and 6`),
    check("opening_hours_range_chk", sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`),
  ],
);

/**
 * Excepciones por fecha (feriados, cierres, horario especial).
 * Si existe al menos una fila para una fecha, REEMPLAZA el horario semanal de ese día:
 *  - fila con start/end null → cerrado todo el día
 *  - filas con start/end → ese día abre solo en esos tramos
 */
export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    startMinute: smallint("start_minute"),
    endMinute: smallint("end_minute"),
    note: text("note"),
  },
  (t) => [
    index("schedule_exceptions_business_date_idx").on(t.businessId, t.date),
    check(
      "schedule_exceptions_range_chk",
      sql`(${t.startMinute} is null and ${t.endMinute} is null) or (${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute})`,
    ),
  ],
);

// ─── Servicios y precios ──────────────────────────────────────────────────────

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("services_business_idx").on(t.businessId, t.sortOrder)],
);

/** Precio y duración de un servicio para cada tipo de vehículo que el lavadero acepta. */
export const servicePrices = pgTable(
  "service_prices",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    price: integer("price").notNull(),
    durationMinutes: smallint("duration_minutes").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.vehicleType] }),
    check("service_prices_price_chk", sql`${t.price} >= 0`),
    check("service_prices_duration_chk", sql`${t.durationMinutes} between 5 and 720`),
  ],
);

// ─── Clientes ─────────────────────────────────────────────────────────────────

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plate: text("plate").notNull(),
    brand: text("brand"),
    model: text("model"),
    type: vehicleTypeEnum("type").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vehicles_user_plate_uq").on(t.userId, t.plate)],
);

// ─── Turnos ───────────────────────────────────────────────────────────────────

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Código corto legible para el cliente (ej. "K7P2QX"). */
    code: text("code").notNull().unique(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Cliente (null en turnos manuales / walk-in sin cuenta)
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),

    // Servicio (snapshot)
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    serviceName: text("service_name").notNull(),
    price: integer("price").notNull(),
    durationMinutes: smallint("duration_minutes").notNull(),

    // Vehículo (snapshot)
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    vehiclePlate: text("vehicle_plate"),
    vehicleBrand: text("vehicle_brand"),
    vehicleModel: text("vehicle_model"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    status: bookingStatusEnum("status").notNull().default("confirmed"),
    source: bookingSourceEnum("source").notNull().default("online"),

    notes: text("notes"), //          lo que escribe el cliente
    internalNotes: text("internal_notes"), // solo lo ve el lavadero

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: cancelledByEnum("cancelled_by"),
    cancelReason: text("cancel_reason"),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => [
    // Agenda del lavadero y cálculo de disponibilidad
    index("bookings_business_starts_idx").on(t.businessId, t.startsAt),
    // "Mis turnos" del cliente
    index("bookings_customer_starts_idx").on(t.customerId, t.startsAt),
    // Recordatorios pendientes
    index("bookings_reminder_idx")
      .on(t.startsAt)
      .where(sql`${t.reminderSentAt} is null and ${t.status} in ('confirmed', 'pending')`),
    check("bookings_range_chk", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

/** Historial de cambios de cada turno (auditoría + futura línea de tiempo). */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // created | status_changed | rescheduled | cancelled | updated
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId, t.createdAt)],
);

// ─── Tipos derivados ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type BusinessPhoto = typeof businessPhotos.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ServicePrice = typeof servicePrices.$inferSelect;
export type OpeningHour = typeof openingHours.$inferSelect;
export type ScheduleException = typeof scheduleExceptions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type VehicleType = (typeof vehicleTypeEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type BookingSource = (typeof bookingSourceEnum.enumValues)[number];

/** Estados que ocupan lugar en la agenda. */
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "in_progress", "ready"] as const satisfies readonly BookingStatus[];
