CREATE TABLE "allowances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_address" text NOT NULL,
	"agent_name" text NOT NULL,
	"session_address" text NOT NULL,
	"per_call_cap" bigint NOT NULL,
	"daily_cap" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowances_session_address_unique" UNIQUE("session_address"),
	CONSTRAINT "allowances_status_is_known" CHECK ("allowances"."status" in ('active', 'paused')),
	CONSTRAINT "allowances_per_call_cap_is_positive" CHECK ("allowances"."per_call_cap" > 0),
	CONSTRAINT "allowances_daily_cap_is_positive" CHECK ("allowances"."daily_cap" > 0)
);
--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" text NOT NULL,
	"payer_address" text NOT NULL,
	"allowance_id" uuid,
	"amount" bigint NOT NULL,
	"tx_signature" text NOT NULL,
	"upstream_status" text,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"split_batch_id" uuid,
	CONSTRAINT "payments_tx_signature_unique" UNIQUE("tx_signature"),
	CONSTRAINT "payments_amount_is_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"batch_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"role" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "payouts_batch_id_recipient_role_pk" PRIMARY KEY("batch_id","recipient","role"),
	CONSTRAINT "payouts_role_is_known" CHECK ("payouts"."role" in ('provider', 'integrator', 'platform')),
	CONSTRAINT "payouts_amount_is_positive" CHECK ("payouts"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "split_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_signature" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_valid_block_height" bigint,
	CONSTRAINT "split_batches_tx_signature_unique" UNIQUE("tx_signature"),
	CONSTRAINT "split_batches_status_is_known" CHECK ("split_batches"."status" in ('pending', 'confirmed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_allowance_id_allowances_id_fk" FOREIGN KEY ("allowance_id") REFERENCES "public"."allowances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_split_batch_id_split_batches_id_fk" FOREIGN KEY ("split_batch_id") REFERENCES "public"."split_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_batch_id_split_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."split_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_allowance_id_settled_at_idx" ON "payments" USING btree ("allowance_id","settled_at");--> statement-breakpoint
CREATE INDEX "payments_unbatched_idx" ON "payments" USING btree ("split_batch_id") WHERE "payments"."split_batch_id" is null;