#!/bin/sh
set -eu

# Bootstrap only an empty database. On later starts, apply any pending migration
# without re-importing kong.yml, so changes made in Kong Manager are preserved.
if kong migrations list >/dev/null 2>&1; then
  kong migrations up
  kong migrations finish
else
  kong migrations bootstrap
  kong config db_import /usr/local/kong/declarative/kong.yml
fi
