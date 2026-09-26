"""Render commit-friendly SVG charts from Locust CSV output.

Default input is perf/results/run2_*.csv (the 2026-09-07 fork re-run).
No third-party plotting library — stdlib csv only.

Usage (cwd = backend/):
    python perf/render_charts.py
    python perf/render_charts.py perf/results/run2
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_PREFIX = ROOT / "results" / "run2"


def _xml(text: object) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _read_endpoint_rows(stats_csv: Path) -> list[dict[str, str]]:
    with stats_csv.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    return [row for row in rows if row.get("Name") and row["Name"] != "Aggregated"]


def _read_history(history_csv: Path) -> list[dict[str, str]]:
    with history_csv.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    return [row for row in rows if (row.get("Name") or "") == "Aggregated"]


def _short_name(name: str) -> str:
    return name.replace(" [POST]", "").replace("/auth/", "/").replace("/kyc/me", "/kyc")


def _bar_chart(rows: list[dict[str, str]]) -> str:
    labels = [_short_name(row["Name"]) for row in rows]
    medians = [float(row["Median Response Time"]) for row in rows]
    p95s = [float(row["95%"]) for row in rows]
    ymax = max(medians + p95s) * 1.15 if rows else 1
    width, height = 900, 420
    left, right, top, bottom = 70, 24, 48, 88
    plot_w = width - left - right
    plot_h = height - top - bottom
    n = max(len(rows), 1)
    group_w = plot_w / n
    bar_w = group_w * 0.32

    def y_of(value: float) -> float:
        return top + plot_h * (1 - value / ymax)

    ticks = 5
    grid = []
    for i in range(ticks + 1):
        value = ymax * i / ticks
        y = y_of(value)
        grid.append(
            f'<line x1="{left}" y1="{y:.1f}" x2="{width - right}" y2="{y:.1f}" '
            f'stroke="#e2e8f0" />'
            f'<text x="{left - 8}" y="{y + 4:.1f}" text-anchor="end" '
            f'font-size="11" fill="#475569">{value:.0f}</text>'
        )

    bars = []
    xlabels = []
    for i, (label, median, p95) in enumerate(zip(labels, medians, p95s)):
        x0 = left + i * group_w + group_w * 0.18
        h_med = plot_h * (median / ymax)
        h_p95 = plot_h * (p95 / ymax)
        bars.append(
            f'<rect x="{x0:.1f}" y="{top + plot_h - h_med:.1f}" width="{bar_w:.1f}" '
            f'height="{h_med:.1f}" fill="#1d4ed8" rx="2" />'
            f'<rect x="{x0 + bar_w + 4:.1f}" y="{top + plot_h - h_p95:.1f}" '
            f'width="{bar_w:.1f}" height="{h_p95:.1f}" fill="#f59e0b" rx="2" />'
        )
        xlabels.append(
            f'<text x="{left + (i + 0.5) * group_w:.1f}" y="{height - 36}" '
            f'text-anchor="middle" font-size="11" fill="#0f172a">{_xml(label)}</text>'
        )

    legend = (
        f'<rect x="{width - 210}" y="14" width="12" height="12" fill="#1d4ed8" rx="1" />'
        f'<text x="{width - 194}" y="24" font-size="12" fill="#0f172a">Median</text>'
        f'<rect x="{width - 130}" y="14" width="12" height="12" fill="#f59e0b" rx="1" />'
        f'<text x="{width - 114}" y="24" font-size="12" fill="#0f172a">p95</text>'
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="Response time by endpoint">
  <rect width="{width}" height="{height}" fill="#ffffff"/>
  <text x="{left}" y="28" font-size="16" font-weight="600" fill="#0f172a">Response time by endpoint (ms)</text>
  {legend}
  {''.join(grid)}
  <line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_h}" stroke="#64748b"/>
  <line x1="{left}" y1="{top + plot_h}" x2="{width - right}" y2="{top + plot_h}" stroke="#64748b"/>
  {''.join(bars)}
  {''.join(xlabels)}
  <text x="{width / 2}" y="{height - 12}" text-anchor="middle" font-size="11" fill="#64748b">Endpoint (Locust name)</text>
  <text x="16" y="{top + plot_h / 2}" text-anchor="middle" font-size="11" fill="#64748b" transform="rotate(-90 16 {top + plot_h / 2})">Milliseconds</text>
</svg>
"""


def _line_chart(history: list[dict[str, str]]) -> str:
    if not history:
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 360" width="900" height="360"><text x="20" y="40">No history rows</text></svg>'

    t0 = int(history[0]["Timestamp"])
    xs = [int(row["Timestamp"]) - t0 for row in history]
    rps = [float(row["Requests/s"]) for row in history]
    users = [int(row["User Count"] or 0) for row in history]
    xmax = max(xs) if max(xs) > 0 else 1
    rps_max = max(rps) * 1.15 if max(rps) > 0 else 1
    user_max = max(users) * 1.15 if max(users) > 0 else 1

    width, height = 900, 380
    left, right, top, bottom = 56, 56, 48, 56
    plot_w = width - left - right
    plot_h = height - top - bottom

    def x_of(sec: int) -> float:
        return left + plot_w * (sec / xmax)

    def y_rps(value: float) -> float:
        return top + plot_h * (1 - value / rps_max)

    def y_users(value: float) -> float:
        return top + plot_h * (1 - value / user_max)

    grid = []
    ticks = 5
    for i in range(ticks + 1):
        value = rps_max * i / ticks
        y = y_rps(value)
        grid.append(
            f'<line x1="{left}" y1="{y:.1f}" x2="{width - right}" y2="{y:.1f}" stroke="#e2e8f0"/>'
            f'<text x="{left - 8}" y="{y + 4:.1f}" text-anchor="end" font-size="11" fill="#1d4ed8">{value:.0f}</text>'
        )
        uvalue = user_max * i / ticks
        grid.append(
            f'<text x="{width - right + 8}" y="{y_users(uvalue) + 4:.1f}" font-size="11" fill="#0f766e">{uvalue:.0f}</text>'
        )

    rps_pts = " ".join(f"{x_of(x):.1f},{y_rps(y):.1f}" for x, y in zip(xs, rps))
    user_pts = " ".join(f"{x_of(x):.1f},{y_users(u):.1f}" for x, u in zip(xs, users))

    xticks = []
    for sec in range(0, xmax + 1, 10):
        xticks.append(
            f'<text x="{x_of(sec):.1f}" y="{top + plot_h + 20}" text-anchor="middle" '
            f'font-size="11" fill="#475569">{sec}</text>'
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="Requests per second during the run">
  <rect width="{width}" height="{height}" fill="#ffffff"/>
  <text x="{left}" y="28" font-size="16" font-weight="600" fill="#0f172a">Throughput over the 60s run</text>
  <rect x="{width - 250}" y="14" width="18" height="3" fill="#1d4ed8"/>
  <text x="{width - 226}" y="20" font-size="12" fill="#0f172a">req/s</text>
  <rect x="{width - 160}" y="14" width="18" height="3" fill="#0f766e"/>
  <text x="{width - 136}" y="20" font-size="12" fill="#0f172a">users</text>
  {''.join(grid)}
  <line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_h}" stroke="#64748b"/>
  <line x1="{width - right}" y1="{top}" x2="{width - right}" y2="{top + plot_h}" stroke="#64748b"/>
  <line x1="{left}" y1="{top + plot_h}" x2="{width - right}" y2="{top + plot_h}" stroke="#64748b"/>
  <polyline fill="none" stroke="#0f766e" stroke-width="2" stroke-dasharray="5 4" points="{user_pts}"/>
  <polyline fill="none" stroke="#1d4ed8" stroke-width="2.5" points="{rps_pts}"/>
  {''.join(xticks)}
  <text x="{width / 2}" y="{height - 12}" text-anchor="middle" font-size="11" fill="#64748b">Elapsed seconds</text>
  <text x="16" y="{top + plot_h / 2}" text-anchor="middle" font-size="11" fill="#1d4ed8" transform="rotate(-90 16 {top + plot_h / 2})">Requests / second</text>
  <text x="{width - 16}" y="{top + plot_h / 2}" text-anchor="middle" font-size="11" fill="#0f766e" transform="rotate(90 {width - 16} {top + plot_h / 2})">Concurrent users</text>
</svg>
"""


def render(prefix: Path) -> None:
    stats_csv = Path(str(prefix) + "_stats.csv")
    history_csv = Path(str(prefix) + "_stats_history.csv")
    out_dir = prefix.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = _read_endpoint_rows(stats_csv)
    history = _read_history(history_csv)
    bars = _bar_chart(rows)
    line = _line_chart(history)

    (out_dir / "response_times.svg").write_text(bars, encoding="utf-8")
    (out_dir / "rps_history.svg").write_text(line, encoding="utf-8")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>FX remittance platform — Locust charts</title>
  <style>
    body {{ font-family: "Segoe UI", system-ui, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }}
    main {{ max-width: 940px; margin: 0 auto; background: #fff; padding: 24px 28px 36px; border-radius: 12px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }}
    h1 {{ font-size: 1.35rem; margin: 0 0 8px; }}
    p {{ color: #475569; line-height: 1.5; }}
    figure {{ margin: 28px 0 8px; }}
    figcaption {{ font-size: 0.9rem; color: #64748b; margin-top: 8px; }}
    svg {{ max-width: 100%; height: auto; }}
  </style>
</head>
<body>
  <main>
    <h1>Performance charts (Locust, this fork)</h1>
    <p>Generated from <code>{_xml(stats_csv.name)}</code> and <code>{_xml(history_csv.name)}</code>.
    50 concurrent users, 60s, single-process uvicorn + SQLite. Login is the tall bar on purpose (bcrypt).</p>
    <figure>
      {bars}
      <figcaption>Figure 1. Median and 95th-percentile response time by endpoint.</figcaption>
    </figure>
    <figure>
      {line}
      <figcaption>Figure 2. Aggregate requests/second and concurrent users over the run (spawn at 10 users/s, then steady ~37 req/s).</figcaption>
    </figure>
  </main>
</body>
</html>
"""
    (out_dir / "charts.html").write_text(html, encoding="utf-8")
    print(f"Wrote {out_dir / 'response_times.svg'}")
    print(f"Wrote {out_dir / 'rps_history.svg'}")
    print(f"Wrote {out_dir / 'charts.html'}")


if __name__ == "__main__":
    prefix = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PREFIX
    render(prefix)
