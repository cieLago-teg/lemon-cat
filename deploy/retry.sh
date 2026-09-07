#!/bin/bash
for i in 1 2 3; do
  echo "=== Attempt $i ==="
  bash '/mnt/c/Users/cuido/.trae/skills/byted-bp-cdn-pagesdeploy/scripts/deploy.sh' \
    --name lemon-cat-demo \
    --dir '/mnt/d/TRAE/柠檬树苗/deploy/lemon-cat-demo' \
    --desc 'Lemon Cat AI Digital Pet Demo' \
    --region global \
    --secrets-file '/mnt/d/TRAE/柠檬树苗/secrets/byteplus.json' \
    && break
  sleep 8
done
echo "--- Final list ---"
bash '/mnt/c/Users/cuido/.trae/skills/byted-bp-cdn-pagesdeploy/scripts/manage.sh' list