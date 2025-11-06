# chatbot-backend-production

![coverage](https://img.shields.io/badge/coverage-21%25-yellowgreen)

Developer docs

- See TESTING.md for the complete testing guide (Jest + Supertest + mongodb-memory-server), including selective route mounting, helpers, and troubleshooting.
- CI run: `npm run test:ci` (runs Jest with coverage)

## Database indexes

- Create/sync indexes after deploy or schema changes:

	Optional: set MONGODB_URI in .env

	Run:

	```powershell
	npm run db:indexes
	```

- Run explain plans for representative queries (set IDs via env):

	```powershell
	$env:EXPLAIN_CHATBOT_ID="<mongoObjectId>"; $env:EXPLAIN_SESSION_ID="<session-id>"; npm run db:explain
	```

	### Atlas Vector Search (for embeddings)

	This project uses MongoDB Atlas Vector Search for `EmbeddingChunk`.

	1) Ensure your Atlas cluster has Atlas Search enabled.
	2) Run the helper to create/ensure the vector index (edit env if needed):

	```powershell
	# Optional overrides (use your existing Atlas index name if present)
	$env:ATLAS_COLLECTION="embeddingchunks"; $env:ATLAS_VECTOR_INDEX_NAME="embedding_vectorIndex"; $env:ATLAS_VECTOR_DIM="1536"; $env:ATLAS_VECTOR_PATH="embedding"; $env:ATLAS_FILTER_FIELDS="chatbot_id"; npm run db:atlas:vector
	```

	The index definition maps:
	- vector field at `embedding` with cosine similarity and the given numDimensions
	- filter fields (default `chatbot_id`) for efficient post-filtering

	If you see "The maximum number of FTS indexes has been reached":

	```powershell
	# List existing search indexes
	npm run db:atlas:list

	# Drop an unused index by name
	npm run db:atlas:drop -- <indexName>

	# Then re-run to create/update the embedding index
	npm run db:atlas:vector
	```

	Quick smoke test for vector search:

	```powershell
	$env:SMOKE_TEXT="reset password help"; $env:SMOKE_CHATBOT_ID="<your-chatbot-id-string>"; $env:SMOKE_K="5"; npm run db:atlas:smoke
	```