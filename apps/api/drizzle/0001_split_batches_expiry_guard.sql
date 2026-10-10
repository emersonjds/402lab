ALTER TABLE "split_batches" ALTER COLUMN "tx_signature" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "split_batches" ALTER COLUMN "last_valid_block_height" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "split_batches" ADD COLUMN "expired_unknown_seen_at" timestamp with time zone;