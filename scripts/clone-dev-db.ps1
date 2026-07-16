# Refreshes the dev database (targetvision_dev) from a fresh snapshot of prod
# (targetvision). Run whenever you want dev data to match prod again — e.g.
# after prod grew new albums, or after destructive testing on dev.
#
# Safe for prod: pg_dump reads the live prod DB without locking it.
# Destructive for dev: targetvision_dev is dropped and recreated.
#
# The dev API holds connections to targetvision_dev — this script terminates
# them and the API's pool reconnects on the next request (no restart needed,
# unless the schema also changed, in which case restart the dev API).

$ErrorActionPreference = 'Stop'
$container = 'targetvision-postgres-1'

Write-Host "Terminating dev DB connections..."
docker exec $container psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'targetvision_dev';" | Out-Null

Write-Host "Dropping and recreating targetvision_dev..."
docker exec $container dropdb -U postgres --if-exists targetvision_dev
docker exec $container createdb -U postgres targetvision_dev

Write-Host "Cloning prod -> dev (pg_dump | pg_restore)..."
docker exec $container sh -c "pg_dump -U postgres -Fc targetvision -f /tmp/tv.dump && pg_restore -U postgres -d targetvision_dev --no-owner /tmp/tv.dump; rc=`$?; rm -f /tmp/tv.dump; exit `$rc"

Write-Host "Verifying..."
docker exec $container psql -U postgres -d targetvision_dev -t -c "SELECT count(*) || ' photos' FROM photos;"
Write-Host "Done. If the dev branch has schema changes beyond prod, re-run its migrations against targetvision_dev."
