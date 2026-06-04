"""한글 음절별 인명용 한자 목록 (사용 빈도순) + AI 보강"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "hanja_by_hangul.json"

_INDEX: Optional[Dict[str, List[str]]] = None
_AI_CACHE: Dict[str, List[str]] = {}


def _load_index() -> Dict[str, List[str]]:
    global _INDEX
    if _INDEX is not None:
        return _INDEX
    if _DATA_PATH.exists():
        with _DATA_PATH.open(encoding="utf-8") as f:
            raw = json.load(f)
        _INDEX = {k: list(dict.fromkeys(v)) for k, v in raw.items() if k and isinstance(v, list)}
    else:
        _INDEX = {}
    return _INDEX


def _merge_ranked(primary: List[str], extra: List[str], preferred: Optional[str] = None) -> List[str]:
    seen = set()
    out: List[str] = []
    if preferred:
        preferred = preferred.strip()
        if preferred:
            seen.add(preferred)
            out.append(preferred)
    for group in (primary, extra):
        for c in group:
            c = (c or "").strip()
            if not c or c in seen:
                continue
            seen.add(c)
            out.append(c)
    return out or [""]


def _lookup_openai_syllable(hangul: str) -> List[str]:
    if hangul in _AI_CACHE:
        return _AI_CACHE[hangul]
    if not OPENAI_API_KEY:
        return []
    try:
        import httpx

        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "한국 인명 작명에서 특정 한글 음절에 쓰이는 한자만 JSON으로 답하세요. "
                            '키: options(array of str). '
                            "인명용·상용 한자만 포함하고, 실제 작명에서 쓰이는 빈도가 높은 순으로 40~80개 나열하세요. "
                            "띄어쓰기 없이 한 글자씩."
                        ),
                    },
                    {"role": "user", "content": f"한글 음절: {hangul}"},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            },
            timeout=35.0,
        )
        resp.raise_for_status()
        data = json.loads(resp.json()["choices"][0]["message"]["content"])
        opts = [str(o).strip() for o in (data.get("options") or []) if str(o).strip()]
        _AI_CACHE[hangul] = list(dict.fromkeys(opts))
        return _AI_CACHE[hangul]
    except Exception:
        return []


def get_ranked_hanja_for_syllable(hangul: str, preferred: Optional[str] = None) -> List[str]:
    """음절에 맞는 한자 전체 후보 (많이 쓰는 순)."""
    hangul = (hangul or "").strip()
    if not hangul:
        return [""]

    index = _load_index()
    base = list(index.get(hangul, []))

    # OpenAI 있으면 인명용 한자 전체 후보를 빈도순으로 보강 (캐시)
    ai_opts: List[str] = []
    if OPENAI_API_KEY:
        ai_opts = _lookup_openai_syllable(hangul)

    merged = _merge_ranked(base, ai_opts, preferred)
    if merged == [""] and preferred:
        return [preferred]
    return merged
