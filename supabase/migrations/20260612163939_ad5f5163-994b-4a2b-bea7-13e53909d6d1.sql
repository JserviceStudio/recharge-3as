
-- ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users subscribe to own notifications topic"
--   ON realtime.messages
--   FOR SELECT
--   TO authenticated
--   USING (
--     realtime.topic() = 'notifications:' || auth.uid()::text
--   );
