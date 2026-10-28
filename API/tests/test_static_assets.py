from pathlib import Path

from scripts.check_static_assets import missing_static_files


def test_official_frontend_has_no_missing_html_css_assets():
    frontend = Path(__file__).resolve().parents[1] / "frontend"
    assert missing_static_files(frontend) == []


def test_missing_font_and_favicon_detected(tmp_path):
    (tmp_path / "assets" / "css").mkdir(parents=True)
    (tmp_path / "index.html").write_text(
        '<link rel="stylesheet" href="/assets/css/main.css">'
        '<link rel="icon" href="/favicon.ico">', encoding="utf-8"
    )
    (tmp_path / "assets" / "css" / "main.css").write_text(
        "@font-face {font-family: Inter;src: url('/assets/fonts/Inter-Regular.woff2') format('woff2')}",
        encoding="utf-8"
    )
    missing = missing_static_files(tmp_path)
    assert len(missing) == 2
    assert {m["reference"] for m in missing} == {
        "/favicon.ico", "/assets/fonts/Inter-Regular.woff2"
    }


def test_existing_and_remote_assets_are_not_reported(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "style.css").write_text(
        '@import url("https://fonts.googleapis.com/css2?family=Inter");'
        'body{background: url("https://example.com/background.jpg");}', encoding="utf-8"
    )
    (tmp_path / "favicon.svg").write_text("<svg></svg>", encoding="utf-8")
    (tmp_path / "index.html").write_text(
        '<link rel="icon" href="/favicon.svg">'
        '<link rel="stylesheet" href="/assets/style.css">'
        '<a href="/api/v1/tours">Tour</a>', encoding="utf-8"
    )
    assert missing_static_files(tmp_path) == []
