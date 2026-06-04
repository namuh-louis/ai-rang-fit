"""한글 이름 → 글자별 한자 후보·선택 (빈도순 전체 목록 + AI 보강)"""

import json
import os
import re
from typing import List, Optional

from services.hanja_syllable_index import get_ranked_hanja_for_syllable

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

COMMON_NAME_HANJA = {
    "김": "金", "이": "李", "박": "朴", "최": "崔", "정": "鄭", "강": "姜", "조": "趙", "윤": "尹",
    "장": "張", "임": "林", "한": "韓", "오": "吳", "서": "徐", "신": "申", "권": "權", "황": "黃",
    "안": "安", "송": "宋", "류": "柳", "홍": "洪", "문": "文", "양": "梁", "손": "孫", "배": "裵",
    "서준": "瑞準", "하준": "河準", "도윤": "道允", "지우": "智優", "예준": "藝準", "민준": "敏準",
    "서연": "瑞妍", "하은": "河恩", "지아": "智雅", "수아": "秀雅", "예린": "藝潾", "지민": "智敏",
    "영희": "英姬", "철수": "哲洙", "길동": "吉東", "영수": "英秀", "미영": "美英", "정호": "正浩",
}


def _split_hangul(name: str) -> List[str]:
    return list((name or "").strip())


def _split_hanja(hanja: str) -> List[str]:
    s = re.sub(r"\s+", "", hanja or "")
    return list(s) if s else []


def _lookup_local_full(name: str) -> Optional[str]:
    name = (name or "").strip()
    if not name:
        return None
    if name in COMMON_NAME_HANJA:
        return COMMON_NAME_HANJA[name]
    if len(name) >= 2:
        surname = name[0]
        given = name[1:]
        s_h = COMMON_NAME_HANJA.get(surname)
        g_h = COMMON_NAME_HANJA.get(given) or (
            COMMON_NAME_HANJA.get(name[1:3]) if len(name) >= 3 else None
        )
        if s_h and g_h:
            return s_h + g_h
    return None


def _options_for_char(ch: str, preferred: Optional[str] = None) -> List[str]:
    return get_ranked_hanja_for_syllable(ch, preferred)


def _build_characters(name: str, saved_hanja: Optional[str] = None) -> List[dict]:
    hangul = _split_hangul(name)
    if not hangul:
        return []
    saved_parts = _split_hanja(saved_hanja) if saved_hanja else []
    full = _lookup_local_full(name)
    full_parts = _split_hanja(full) if full else []

    out = []
    for i, ch in enumerate(hangul):
        pref = None
        if i < len(saved_parts):
            pref = saved_parts[i]
        elif i < len(full_parts):
            pref = full_parts[i]
        opts = _options_for_char(ch, pref)
        selected = pref if pref and pref in opts else (opts[0] if opts else "")
        if selected and selected not in opts:
            opts = [selected] + opts
        out.append({"hangul": ch, "options": opts, "selected": selected})
    return out


def lookup_name_hanja(name: str, saved_hanja: Optional[str] = None) -> dict:
    name = (name or "").strip()
    if not name:
        return {
            "hanja": None,
            "characters": [],
            "source": None,
            "message": "이름을 입력해 주세요",
        }

    chars = _build_characters(name, saved_hanja)
    hanja = "".join(c.get("selected") or "" for c in chars)

    has_ai = bool(OPENAI_API_KEY)
    source = "dictionary+ai" if has_ai else "dictionary"
    msg = (
        "글자마다 한자를 선택하세요 (많이 쓰는 순)."
        if not has_ai
        else "인명용 한자 전체 후보를 빈도순으로 불러왔습니다. 글자마다 선택하세요."
    )

    if not hanja:
        return {
            "hanja": None,
            "characters": chars,
            "source": None,
            "message": "한자 후보가 없습니다.",
        }

    return {
        "hanja": hanja,
        "characters": chars,
        "source": source,
        "message": msg,
    }
