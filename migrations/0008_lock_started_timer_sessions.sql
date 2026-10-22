-- Pick Timer removal, step 1. Lazy expiry used to lock a Session on lookup once its timer ended; persist that
-- now so Sessions stay locked after the lazy expiry code is deleted. Sessions whose timer is still running are
-- locked too (the feature is going away). Already-locked Sessions and ones that never started a timer are untouched.
UPDATE sessions SET locked_at = timer_ends_at WHERE locked_at IS NULL AND timer_ends_at IS NOT NULL;
