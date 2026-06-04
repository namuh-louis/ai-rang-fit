"""
쿠팡 파트너스·네이버 쇼핑 API 연동 (Phase 2)
API 키 없으면 no-op. 스크래핑은 사용하지 않습니다.
"""

import os
from typing import Any, Dict, List, Optional

COUPANG_ACCESS_KEY = os.environ.get("COUPANG_ACCESS_KEY", "")
COUPANG_SECRET_KEY = os.environ.get("COUPANG_SECRET_KEY", "")
NAVER_CLIENT_ID = os.environ.get("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.environ.get("NAVER_CLIENT_SECRET", "")


def apis_configured() -> Dict[str, bool]:
    return {
        "coupang": bool(COUPANG_ACCESS_KEY and COUPANG_SECRET_KEY),
        "naver": bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET),
    }


def search_coupang(keyword: str, limit: int = 3) -> List[Dict[str, Any]]:
    """쿠팡 파트너스 Open API — 키 설정 시 구현 확장."""
    if not COUPANG_ACCESS_KEY:
        return []
    # TODO: HMAC 서명 + /v2/providers/affiliate_open_api/apis/openapi/products/search
    return []


def search_naver_shopping(keyword: str, limit: int = 3) -> List[Dict[str, Any]]:
    """네이버 쇼핑 검색 API."""
    if not NAVER_CLIENT_ID:
        return []
    try:
        import httpx

        resp = httpx.get(
            "https://openapi.naver.com/v1/search/shop.json",
            params={"query": keyword, "display": limit, "sort": "sim"},
            headers={
                "X-Naver-Client-Id": NAVER_CLIENT_ID,
                "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        items = []
        for it in resp.json().get("items", [])[:limit]:
            items.append({
                "name": it.get("title", "").replace("<b>", "").replace("</b>", ""),
                "price": int(it.get("lprice", 0) or 0),
                "url": it.get("link", ""),
                "review_count": None,
                "purchase_count": None,
            })
        return items
    except Exception:
        return []


def sync_category_top3(keyword: str) -> Dict[str, Any]:
    """카테고리 키워드로 쿠팡·네이버 Top3 조회 (Phase 2)."""
    return {
        "keyword": keyword,
        "coupang": search_coupang(keyword, 3),
        "naver": search_naver_shopping(keyword, 3),
        "configured": apis_configured(),
    }
