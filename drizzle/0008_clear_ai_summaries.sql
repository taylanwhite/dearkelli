-- Drop AI-invented titles/summaries/captions. Contributors write optional notes instead.
UPDATE media
SET
  title = NULL,
  summary = NULL,
  caption = NULL;
