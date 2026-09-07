#!/bin/bash
echo "=== Reading AK/SK ==="
AK=$(python3 -c "import json; print(json.load(open('/mnt/d/TRAE/柠檬树苗/secrets/byteplus.json'))['access_key'])")
SK=$(python3 -c "import json; print(json.load(open('/mnt/d/TRAE/柠檬树苗/secrets/byteplus.json'))['secret_key'])")
echo "AK: ${AK:0:8}...${AK: -4}"
echo "SK: ${SK:0:4}...${SK: -4}"
echo ""
echo "=== Running onboard.sh subscribe-cdn ==="
bash '/mnt/c/Users/cuido/.trae/skills/byted-bp-cdn-pagesdeploy/scripts/onboard.sh' subscribe-cdn "$AK" "$SK"