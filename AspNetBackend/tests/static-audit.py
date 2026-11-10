"""Only static source checks, not a replacement for dotnet build or database E2E."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
code = (root / 'Program.cs').read_text(encoding='utf-8')
web = (root / 'wwwroot' / 'index.html').read_text(encoding='utf-8')
ET.parse(root / 'DeltaTravel.AspNet.csproj')
required_tables = ('NGUOIDUNG', 'DANHMUC', 'TOUR', 'HINHANH_TOUR', 'LICH_TRINH_DETAIL',
                   'CHUYENKHOIHANH', 'DATTOUR', 'CHITIET_HANHKHACH', 'THANHTOAN', 'DANHGIA',
                   'BAIVIET_QUANGBA', 'AUDITLOG')
assert all(t in code for t in required_tables)
assert not re.search(r'\b(?:DROP|ALTER|TRUNCATE)\s+(?:TABLE|DATABASE)\b', code, re.I)
assert 'IsolationLevel.Serializable' in code
assert 'UPDLOCK, HOLDLOCK' in code
assert 'X-CSRF-Token' in code
assert 'b.MaKhachHang=@user' in code
assert 'server-error' in code and 'text/event-stream' in code
assert 'localStorage' not in web
assert 'new EventSource(' in web
print('STATIC_AUDIT_PASS (does not prove compiled / tested runtime)')

class InlineScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.capture = False
        self.content = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and 'src' not in dict(attrs):
            self.capture = True

    def handle_data(self, data):
        if self.capture:
            self.content.append(data)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.capture = False

p = InlineScripts()
p.feed(web)
with tempfile.TemporaryDirectory() as d:
    script = Path(d) / 'frontend.js'
    script.write_text('\n'.join(p.content), encoding='utf-8')
    subprocess.run(['node', '--check', str(script)], check=True)
print('FRONTEND_JS_SYNTAX_PASS')