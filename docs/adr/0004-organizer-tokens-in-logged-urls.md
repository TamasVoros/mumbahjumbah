# Accept Organizer Link tokens appearing in Workers request logs

**Status:** accepted

Workers observability logs full request URLs, and Organizer Links carry their token in the path (`/o/:token`). Anyone able to read the logs could therefore act as an Organizer. We accept this for now because only the owner has access to the Cloudflare account and its logs.

**Revisit trigger:** before anyone else gets access to the Cloudflare account, or before logs are shipped to a third party. Fix options at that point: move the organizer token out of the URL (e.g. into a cookie), or disable/redact request logging.
