CREATE TABLE "onramps" (
	"signature" text PRIMARY KEY NOT NULL,
	"owner_address" text NOT NULL,
	"session_address" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onramps_amount_is_positive" CHECK ("onramps"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "owner_sessions" (
	"owner_address" text PRIMARY KEY NOT NULL,
	"valid_after" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "onramps_owner_address_created_at_idx" ON "onramps" USING btree ("owner_address","created_at");--> statement-breakpoint
CREATE INDEX "onramps_session_address_created_at_idx" ON "onramps" USING btree ("session_address","created_at");