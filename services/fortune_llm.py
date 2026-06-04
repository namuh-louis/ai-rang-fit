"""출산택일·작명 LLM 연동 (명리학·사주 기반) + 데모 폴백"""

import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


def _format_parents_for_prompt(parents: List[dict]) -> List[dict]:
    out = []
    for p in parents:
        role = "아버지" if p.get("role") == "father" else "어머니"
        cal = "양력" if p.get("calendar_type") != "lunar" else "음력"
        out.append({
            "역할": role,
            "이름_한글": p.get("name"),
            "이름_한자": p.get("name_hanja") or "(미입력)",
            "생년월일": p.get("birth_date"),
            "시진": p.get("birth_time") or "모름",
            "력": cal,
            "출생지": p.get("birth_place") or "(미입력)",
        })
    return out


def _demo_birthday_result(payload: dict, parents: List[dict]) -> dict:
    due = payload.get("due_date", "2026-07-10")
    gender = "남" if payload.get("baby_gender") == "male" else "여"
    try:
        base = datetime.strptime(due, "%Y-%m-%d")
    except ValueError:
        base = datetime(2026, 7, 10)
    offsets = [-5, -2, 0, 2, 4]
    reasons = [
        "부모 사주의 일간·오행과 조화되어 목·화 기운이 상생하는 날로 해석됩니다.",
        "대운 흐름상 안정적인 토·금 기운이 강해 건강·성장 기반에 유리합니다.",
        "부모 년주와 충·형이 적어 가족 기운이 크게 상충하지 않습니다.",
        "수·목 기운이 완화되어 차분한 성향과 회복력을 기대할 수 있습니다.",
        "전체적으로 무난하나 예정일 전후 병원 일정·건강 상태를 함께 확인하세요.",
    ]
    recs = []
    for i, off in enumerate(offsets):
        d = (base + timedelta(days=off)).strftime("%Y-%m-%d")
        recs.append({
            "rank": i + 1,
            "date": d,
            "score": 95 - i * 3,
            "reason": reasons[i],
        })
    parent_note = "·".join([p.get("name", "") for p in parents if p.get("name")]) or "부모"
    return {
        "summary": (
            f"{parent_note} 사주(명리)를 바탕으로, 예정 출산일({due}) 전후 {gender}아 "
            f"출생에 유리한 날짜 5건을 우선순위별로 정리했습니다."
        ),
        "recommendations": recs,
        "cautions": [
            "본 결과는 명리 참고용 AI 분석이며 의료·분만 시기 결정을 대체하지 않습니다.",
            "응급·합병증·의료진 권고가 최우선입니다.",
            "부모 생시를 모를 경우 시주 해석 정밀도가 낮아질 수 있습니다.",
        ],
        "demo": True,
    }


def _demo_naming_result(payload: dict, parents: List[dict]) -> dict:
    surname = payload.get("surname", "김")
    gender = payload.get("baby_gender", "male")
    names = (
        [
            {"name": surname + "서준", "hanja": "瑞準", "meaning": "상서로움과 준비·시작", "five_elements": "金·水", "score": 91, "reason": "부모 사주의 금·수 기운을 보완하는 목·화 상생 구조입니다."},
            {"name": surname + "도윤", "hanja": "道允", "meaning": "바른 길과 허락·진실", "five_elements": "土·金", "score": 89, "reason": "토·금 오행이 안정되어 성장·인내에 유리합니다."},
            {"name": surname + "하린", "hanja": "河潾", "meaning": "맑은 강물 같은 유연함", "five_elements": "水·木", "score": 88, "reason": "수·목 기운이 부모 일간과 조화를 이룹니다."},
            {"name": surname + "이안", "hanja": "理安", "meaning": "이치와 평안", "five_elements": "火·土", "score": 87, "reason": "화·토로 따뜻한 기운을 보완합니다."},
            {"name": surname + "지우", "hanja": "智優", "meaning": "지혜와 뛰어남", "five_elements": "火·土", "score": 86, "reason": "지혜·우수함의 한자 획수가 무난합니다."},
        ]
        if gender == "male"
        else [
            {"name": surname + "서아", "hanja": "瑞雅", "meaning": "상서로움과 우아함", "five_elements": "金·木", "score": 91, "reason": "금·목 상생으로 부모 사주와 조화됩니다."},
            {"name": surname + "하은", "hanja": "河恩", "meaning": "넓은 은혜", "five_elements": "水·土", "score": 90, "reason": "수·토 기운이 안정과 포용을 돕습니다."},
            {"name": surname + "지아", "hanja": "智雅", "meaning": "지혜와 품격", "five_elements": "火·木", "score": 88, "reason": "화·목으로 활력과 품격을 보완합니다."},
            {"name": surname + "수아", "hanja": "秀雅", "meaning": "빛나는 우아함", "five_elements": "金·水", "score": 87, "reason": "금·수 조합이 맑고 단정한 인상을 줍니다."},
            {"name": surname + "예린", "hanja": "藝潾", "meaning": "예술적 맑음", "five_elements": "火·水", "score": 85, "reason": "예·潾 한자가 부드러운 기운을 더합니다."},
        ]
    )
    dolimja = payload.get("dolimja")
    dolimja_note = f" 돌림자「{dolimja}」반영." if dolimja else ""
    return {
        "summary": (
            f"부모 사주·오행을 고려한 {surname}씨 성 '{gender}' 아기 작명안입니다.{dolimja_note} "
            "한자 획수·음양·오행·돌림자·형제 이름 조화를 명리 관점에서 참고하세요."
        ),
        "names": names[:10],
        "cautions": [
            "동일 발음·한자 중복 여부는 가족과 상의하세요.",
            "출생 후 사주(시진 확정)로 재확인을 권장합니다.",
        ],
        "demo": True,
    }


def _call_openai(system: str, user: str) -> Optional[dict]:
    if not OPENAI_API_KEY:
        return None
    try:
        import httpx

        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.5,
            },
            timeout=90.0,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception:
        return None


def _normalize_birthday_result(result: dict) -> dict:
    recs = result.get("recommendations") or []
    normalized = []
    for i, r in enumerate(recs[:5]):
        normalized.append({
            "rank": r.get("rank", i + 1),
            "date": r.get("date") or (r.get("datetime") or "")[:10],
            "score": r.get("score", 80 - i * 2),
            "reason": r.get("reason", ""),
        })
    while len(normalized) < 5:
        normalized.append({
            "rank": len(normalized) + 1,
            "date": "",
            "score": 70,
            "reason": "추가 분석이 필요합니다.",
        })
    result["recommendations"] = normalized[:5]
    return result


def analyze_birthday(parents: List[dict], payload: dict) -> dict:
    system = (
        "당신은 한국 전통 명리학(사주·오행·십신·일진)에 근거하는 출산택일 전문 보조 AI입니다. "
        "부모의 이름(한글·한자), 생년월일, 시진(12시진), 양음력, 출생지를 사주로 해석해 "
        "아기의 예정 출산일·성별에 맞는 길일을 날짜 단위로 추천합니다. "
        "반드시 JSON만 출력하세요. 키: summary(str), recommendations(array), cautions(array). "
        "recommendations는 정확히 5개, rank는 1(최우선)~5, 각 항목: date(YYYY-MM-DD), score(0-100), "
        "reason(str, 명리학 근거를 구체적으로: 오행 상생·충·합, 부모 사주와의 조화 등). "
        "의료·수술 시기 최종 결정은 하지 말고 참고 의견만 제시하세요."
    )
    user = json.dumps(
        {"부모_사주": _format_parents_for_prompt(parents), "택일_조건": payload},
        ensure_ascii=False,
    )
    result = _call_openai(system, user)
    if result and "recommendations" in result:
        result = _normalize_birthday_result(result)
        result["demo"] = False
        return result
    return _demo_birthday_result(payload, parents)


def analyze_naming(parents: List[dict], payload: dict) -> dict:
    system = (
        "당신은 한국 전통 명리학에 근거하는 작명 전문 보조 AI입니다. "
        "부모 사주(이름 한자·생년월일·시진)와 작명 조건을 반영해 이름 후보를 제안합니다. "
        "작명 조건에 돌림자(dolimja)·돌림자 위치, 형제자매 이름, 희망 뜻, 보완 오행, 글자 수, "
        "받침 선호, 획수·기피 한자, 인명용 한자만 여부 등이 있으면 반드시 준수·반영하세요. "
        "반드시 JSON만 출력하세요. 키: summary(str), names(array), cautions(array). "
        "names는 5~10개, 각 항목: name(한글 전체 이름), hanja(한자, 필수), meaning(str), "
        "five_elements(str, 예: 木·火), score(0-100), reason(str, 명리·오행·돌림자·형제 이름 조화 근거). "
        "한자는 상용 작명 한자로, 부모 사주와 상생·보완 관계를 설명하세요."
    )
    user = json.dumps(
        {"부모_사주": _format_parents_for_prompt(parents), "작명_조건": payload},
        ensure_ascii=False,
    )
    result = _call_openai(system, user)
    if result and "names" in result:
        for n in result.get("names", []):
            if not n.get("hanja") and n.get("name"):
                from services.hanja_lookup import lookup_name_hanja
                lk = lookup_name_hanja(n["name"])
                if lk.get("hanja"):
                    n["hanja"] = lk["hanja"]
        result["demo"] = False
        return result
    return _demo_naming_result(payload, parents)
