# SmugMug OAuth Authorization Instructions

## Step 1: Get Authorization URL

Run this command to get your authorization URL:
```bash
curl -X POST http://localhost:8000/auth/smugmug/request
```

## Step 2: Authorize in Browser

1. Copy the `auth_url` from the response
2. Open it in your browser
3. Log in to SmugMug if needed
4. Click "Authorize" to grant access

## Step 3: Complete OAuth

After authorizing, SmugMug will redirect you to:
`http://localhost:8000/auth/callback?oauth_token=...&oauth_verifier=...`

The page will show "SmugMug authentication successful!"

## Step 4: Verify Authentication

Check if you're authenticated:
```bash
curl http://localhost:8000/auth/status
```

## Step 5: Sync Photos

Once authenticated, sync your photos:
```bash
curl -X POST "http://localhost:8000/photos/sync?limit=10"
```

## Step 6: View Photos

List synced photos:
```bash
curl http://localhost:8000/photos
```