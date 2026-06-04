#!/usr/bin/env python3
"""
키워드별 쇼핑가이드 가격·리뷰 갱신 (JSON / CSV)

사용법:
  python3 scripts/sync_shopping_prices.py --show-keywords
  python3 scripts/sync_shopping_prices.py --apply-csv data/shopping_prices.csv
  python3 scripts/sync_shopping_prices.py --naver-test "아기 기저귀 1단계"

CSV 컬럼:
  keyword_key,product_key,rank,platform,price,purchase_count,review_count,url,image_url

platform: coupang | naver
"""

import argparse
import csv
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE_PATH = ROOT / "data" / "shopping_guide.json"


def load_guide():
    with open(GUIDE_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_guide(data):
    data["updated_at"] = date.today().isoformat()
    with open(GUIDE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Saved", GUIDE_PATH)


def show_keywords(data):
    for kw in data.get("keywords", []):
        prods = kw.get("products", [])
        items = sum(min(2, len(p.get("items", []))) for p in prods)
        print(f"  {kw['key']:12} {kw['label']:8}  products={len(prods)}  items_shown={items}")


def apply_csv(data, csv_path: Path):
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        updated = 0
        for row in reader:
            kw_key = row.get("keyword_key", "").strip()
            prod_key = row.get("product_key", "").strip()
            rank = int(row.get("rank", 0))
            platform = row.get("platform", "").strip().lower()
            kw = next((k for k in data.get("keywords", []) if k["key"] == kw_key), None)
            if not kw:
                continue
            prod = next((p for p in kw.get("products", []) if p["key"] == prod_key), None)
            if not prod:
                continue
            item = next((i for i in prod.get("items", []) if i.get("rank") == rank), None)
            if not item:
                continue
            if row.get("image_url"):
                item["image_url"] = row["image_url"].strip()
            plat = item.setdefault(platform, {})
            if row.get("price"):
                plat["price"] = int(row["price"])
            if row.get("purchase_count"):
                plat["purchase_count"] = int(row["purchase_count"]) if row["purchase_count"] else None
            if row.get("review_count"):
                plat["review_count"] = int(row["review_count"])
            if row.get("url"):
                plat["url"] = row["url"].strip()
            updated += 1
    print(f"Updated {updated} platform rows")
    save_guide(data)


def naver_test(keyword: str):
    sys.path.insert(0, str(ROOT))
    from services.commerce_sync import search_naver_shopping, apis_configured

    print("API configured:", apis_configured())
    items = search_naver_shopping(keyword, 2)
    for i, it in enumerate(items, 1):
        print(i, it.get("name"), it.get("price"), it.get("url", "")[:60])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-keywords", action="store_true")
    parser.add_argument("--show-months", action="store_true", help="alias for --show-keywords")
    parser.add_argument("--apply-csv", type=str, metavar="PATH")
    parser.add_argument("--naver-test", type=str, metavar="KEYWORD")
    args = parser.parse_args()

    if args.naver_test:
        naver_test(args.naver_test)
        return

    data = load_guide()
    if args.show_keywords or args.show_months:
        show_keywords(data)
        return
    if args.apply_csv:
        apply_csv(data, Path(args.apply_csv))
        return
    parser.print_help()


if __name__ == "__main__":
    main()
