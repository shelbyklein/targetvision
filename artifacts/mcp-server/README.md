# @workspace/mcp-server

MCP server exposing the Vispix photo library to AI clients, so a model
given marketing copy can pull candidate photos that fit each described concept
and judge them visually (results include inline thumbnails).

It talks to the database and object storage directly, reusing the api-server's
own libs (Vertex text embedding, the iterative HNSW vector ranking, GCS URL
signing) — ranking behaviour is identical to the app's semantic search. It
reads the same root `.env` as the api-server; whichever `DATABASE_URL` /
`GCS_ENDPOINT` that file points at is the library it serves.

## Tools

| Tool | What it does |
| --- | --- |
| `search_photos(query, count, exclude?, minRating?, rightsTag?, includeImages?)` | Semantic ranking with optional rating / usage-rights filters; inline thumbnails for the top results |
| `get_photo(id)` | Full metadata, thumbnail, and a ~1h signed URL for the full-resolution file |
| `list_albums` | Albums with photo counts |
| `list_usage_rights` | Attribution / usage-rights tags with cleared-photo counts |
| `list_assets(kind?, project?)` | Asset library: brand assets (logos to embed) and reference works (past output to match); project filter includes global assets |
| `get_asset(id)` | One asset's metadata, an inline preview for raster images, and a download link for the original file |

## Running

```sh
pnpm --filter @workspace/mcp-server run start
```

stdio transport — stdout is the protocol channel. The entry point silences the
api-server libs' pino logging before they load; keep it that way.

## Client setup

**Claude Code**: the repo's `.mcp.json` registers the server automatically for
sessions in this checkout.

**Claude Desktop** (`claude_desktop_config.json`) — same launcher, run from a
checkout (`--dir` keeps it cwd-independent; swap in the dev worktree path to
serve the dev database instead):

```json
{
  "mcpServers": {
    "vispix": {
      "command": "pnpm",
      "args": [
        "--dir", "C:/Vibes/Targetvision/Targetvision",
        "--silent", "--filter", "@workspace/mcp-server", "run", "start"
      ]
    }
  }
}
```

## Remote access (off-machine clients)

`start:http` runs the same tools over streamable HTTP (port `MCP_HTTP_PORT`,
default 8086), exposed publicly via the cloudflared tunnel:

```sh
pnpm run mcp:http   # from the repo root; the prod launcher also starts it
```

Requires `MCP_AUTH_TOKEN` in `.env` (>= 24 chars; `openssl rand -hex 32`) —
the server refuses to start without it, since the tunnel makes it public.
Auth is accepted two ways:

- `Authorization: Bearer <token>` header — e.g. Claude Code on another machine:
  `claude mcp add --scope user --transport http vispix
  https://vispixmcp.shelbyklein.com/mcp --header "Authorization: Bearer <token>"`
- Token as the first URL path segment — for clients whose connector UI only
  accepts a URL (claude.ai custom connectors):
  `https://vispixmcp.shelbyklein.com/<token>/mcp`.
  The URL is the secret; treat it like a password.
- ChatGPT / OpenAI: same token-in-URL form — in ChatGPT go to Settings →
  Apps & Connectors → Create, paste
  `https://vispixmcp.shelbyklein.com/<token>/mcp` as the MCP server URL,
  and pick authentication "None" (the token rides in the URL; ChatGPT's
  connector UI has no custom-header option).

Signed storage URLs only resolve on the local network, so in HTTP mode
`get_photo` instead returns download links through the gateway's own
authenticated `GET /photo/:id/original` route, built from `MCP_PUBLIC_URL`.
`GET /healthz` is the only unauthenticated route.

Tunnel side: a Cloudflare Zero Trust public hostname must map
`vispixmcp.shelbyklein.com` → `http://<host>:8086` (the tunnel is
remotely managed, so this lives in the dashboard, not a local config).
