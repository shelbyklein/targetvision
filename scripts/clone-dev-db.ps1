# Refreshes the dev database (vispix_dev) from a fresh snapshot of prod
# (vispix). Run whenever you want dev data to match prod again — e.g.
# after prod grew new albums, or after destructive testing on dev.
#
# Safe for prod: pg_dump reads the live prod DB without locking it.
# Destructive for dev: vispix_dev is dropped and recreated.
#
# The dev API holds connections to vispix_dev — this script terminates
# them and the API's pool reconnects on the next request (no restart needed,
# unless the schema also changed, in which case restart the dev API).

$ErrorActionPreference = 'Stop'
$container = 'targetvision-postgres-1'

Write-Host "Terminating dev DB connections..."
docker exec $container psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vispix_dev';" | Out-Null

Write-Host "Dropping and recreating vispix_dev..."
docker exec $container dropdb -U postgres --if-exists vispix_dev
docker exec $container createdb -U postgres vispix_dev

Write-Host "Cloning prod -> dev (pg_dump | pg_restore)..."
docker exec $container sh -c "pg_dump -U postgres -Fc vispix -f /tmp/tv.dump && pg_restore -U postgres -d vispix_dev --no-owner /tmp/tv.dump; rc=`$?; rm -f /tmp/tv.dump; exit `$rc"

Write-Host "Verifying..."
docker exec $container psql -U postgres -d vispix_dev -t -c "SELECT count(*) || ' photos' FROM photos;"
Write-Host "Done. If the dev branch has schema changes beyond prod, re-run its migrations against vispix_dev."
