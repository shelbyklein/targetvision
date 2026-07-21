# @workspace/mcp-server

MCP server exposing the TargetVision photo library to AI clients, so a model
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
    "targetvision": {
      "command": "pnpm",
      "args": [
        "--dir", "C:/Vibes/Targetvision/Targetvision",
        "--silent", "--filter", "@workspace/mcp-server", "run", "start"
      ]
    }
  }
}
```

**ChatGPT / remote clients**: not wired yet. Needs the streamable-HTTP
transport exposed through the cloudflared tunnel plus an auth story (bearer
token at minimum) before going public — see issue #106. Note that signed
storage URLs point at the local fake-gcs endpoint, so remote clients could
see metadata and inline thumbnails but not fetch full-res files until that's
addressed.
