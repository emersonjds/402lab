CREATE TABLE "reconciliation_cursor" (
	"account" text PRIMARY KEY NOT NULL,
	"last_signature" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
