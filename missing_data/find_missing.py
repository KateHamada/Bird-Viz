#!/usr/bin/env python3
"""Find rows with missing data in every CSV in a folder (default: data/*.csv).

A value counts as missing if it is empty or a placeholder such as NA, N/A, NaN,
null or "-". A row is also flagged if it has the wrong number of fields, or if a
numeric trait column (lat, long, body_mass, ...) holds something that is not a
number. Those are the same columns common.js requires, so a flagged row in the
traits file is a species the map would drop.

Usage:
    python find_missing.py                  # scan data/*.csv
    python find_missing.py --dir other/     # scan a different folder
    python find_missing.py --limit 0        # print only the summaries
    python find_missing.py --out report.csv # choose the report file name

Uses only the Python standard library.
"""
import argparse
import csv
import glob
import math
import os
from collections import Counter

PLACEHOLDERS = {"", "na", "n/a", "nan", "null", "none", "-", "--", "?"}
NUMERIC_COLUMNS = {"lat", "long", "flight_ability", "wing_length", "tarsus_length", "body_mass"}


def is_missing(value):
    return value is None or value.strip().lower() in PLACEHOLDERS


def is_bad_number(value):
    try:
        return not math.isfinite(float(value))
    except ValueError:
        return True


def check_file(path):
    """Return (rows_checked, header, problems). Each problem is a dict."""
    problems = []
    rows_checked = 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if header is None:
            return 0, [], problems
        header = [h.strip() for h in header]
        id_index = header.index("species") if "species" in header else 0

        for row in reader:
            if not row or all(not c.strip() for c in row):
                continue  # blank line
            rows_checked += 1
            issues = []
            if len(row) != len(header):
                issues.append(f"expected {len(header)} fields, found {len(row)}")
                row = (row + [""] * len(header))[: len(header)]
            for col, value in zip(header, row):
                if is_missing(value):
                    issues.append(f"{col} (missing)")
                elif col in NUMERIC_COLUMNS and is_bad_number(value):
                    issues.append(f"{col} (not a number: {value!r})")
            if issues:
                problems.append({
                    "file": os.path.basename(path),
                    "line": reader.line_num,
                    "id": row[id_index].strip() if id_index < len(row) else "",
                    "issues": "; ".join(issues),
                })
    return rows_checked, header, problems


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", default="data", help="folder containing the CSV files (default: data)")
    parser.add_argument("--out", default="missing_report.csv", help="where to write the full report (default: missing_report.csv)")
    parser.add_argument("--limit", type=int, default=25, help="rows to print per file; 0 = summary only (default: 25)")
    args = parser.parse_args()

    paths = sorted(glob.glob(os.path.join(args.dir, "*.csv")))
    if not paths:
        print(f"No CSV files found in {args.dir}/")
        return

    all_problems = []
    for path in paths:
        rows_checked, header, problems = check_file(path)
        all_problems.extend(problems)

        print(f"\n=== {path} ===")
        print(f"{rows_checked} rows checked, {len(problems)} with problems")
        if not problems:
            continue

        per_column = Counter()
        for p in problems:
            for issue in p["issues"].split("; "):
                label = "(wrong field count)" if issue.startswith("expected") else issue.split(" (")[0]
                per_column[label] += 1
        print("Problems per column:")
        for col, n in per_column.most_common():
            print(f"  {col}: {n}")

        if args.limit:
            print(f"First {min(args.limit, len(problems))} rows (line number, id, problems):")
            for p in problems[: args.limit]:
                print(f"  line {p['line']}: {p['id'] or '(no id)'} -> {p['issues']}")
            if len(problems) > args.limit:
                print(f"  ... {len(problems) - args.limit} more in {args.out}")

    if all_problems:
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["file", "line", "id", "issues"])
            writer.writeheader()
            writer.writerows(all_problems)
        print(f"\nFull report ({len(all_problems)} rows) written to {args.out}")
    else:
        print("\nNo missing data found.")


if __name__ == "__main__":
    main()