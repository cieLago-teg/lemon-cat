import re
import sys
import base64
from pathlib import Path

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
data = src.read_text(encoding='utf-8', errors='ignore')
m = re.search(r'"data":"([A-Za-z0-9+/=]+)"', data)
if m:
    b64 = m.group(1)
    dst.write_bytes(base64.b64decode(b64))
    print(f"Saved {dst} ({dst.stat().st_size} bytes)")
else:
    print("No base64 found", file=sys.stderr)