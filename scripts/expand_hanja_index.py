#!/usr/bin/env python3
"""data/hanja_by_hangul.json 음절별 한자 목록 확장 (빈도순 유지)"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "hanja_by_hangul.json"

# 자주 쓰이는 음절 — 인명용 한자 추가 (앞쪽이 더 흔함)
EXTRA: dict[str, str] = {
    "김": "金,錦,琴,禽,今,禁,襟,衿,旲,檎,擒,衾,噤,矜,衿,釒",
    "이": "李,異,理,里,二,利,梨,璃,伊,怡,以,倚,爾,耳,貽,里,悧,厓,莉,荲,邐,理,利,犁,狸",
    "민": "敏,玟,珉,民,旻,愍,閔,皿,苠,鰵,忞,旻,旼,珉,玟,閔,民,慜,苠,敃",
    "준": "俊,準,峻,浚,駿,晙,畯,濬,隽,埈,鈞,均,菌,竣,儁,郡,焌,葰,寯,駿,珺,峻,浚,晙,畯,濬,隽,埈",
    "서": "徐,瑞,西,書,序,署,恕,緖,胥,舒,薯,璲,嶰,序,緖,瑞,西,書,恕,胥,舒,敍,庶,緖,緒,璲",
    "지": "智,志,知,芝,祉,地,之,持,指,池,遲,治,緻,祉,枳,志,知,智,芝,祉,止,址,趾,沚,紙,旨",
    "윤": "尹,允,潤,胤,昀,筠,薀,玧,贇,鈗,閏,潤,胤,允,尹,昀,筠,蕓,耘,運,韻,均,鈗",
    "현": "賢,炫,玄,現,嫻,鉉,縣,憲,玹,晛,暎,昰,賢,炫,玄,嫻,鉉,縣,憲,玹,晛,暎,炫,玄,嫿,賢",
    "수": "洙,秀,守,壽,水,樹,修,首,收,綬,綉,繡,琇,岫,鏽,陗,洙,秀,守,壽,水,樹,修,首,收,綬",
    "영": "英,永,榮,映,瑩,泳,迎,影,瑛,盈,穎,潁,暎,煐,瑛,英,永,榮,映,瑩,泳,迎,影,瑛,盈,穎",
    "준": "俊,準,峻,浚,駿,晙,畯,濬,隽,埈,鈞,均,菌,竣,儁,郡,焌,葰,寯,珺,畯,濬,隽,埈,駿",
    "호": "浩,昊,皓,豪,好,虎,湖,護,號,灝,皞,暤,淏,浩,昊,皓,豪,好,虎,湖,護,號,灝,皞,暤",
    "우": "宇,雨,優,佑,友,右,于,禹,羽,遇,愚,虞,寓,裕,猷,宇,雨,優,佑,友,右,于,禹,羽,遇",
    "성": "成,盛,星,聖,性,城,誠,晟,省,姓,惺,笙,琞,成,盛,星,聖,性,城,誠,晟,省,姓,惺",
    "철": "哲,鐵,徹,喆,澈,轍,悊,哲,鐵,徹,喆,澈,轍,悊,喆,哲,徹,澈",
    "은": "恩,銀,隱,垠,殷,慇,誾,昕,恩,銀,隱,垠,殷,慇,誾,昕,垠,恩,銀",
    "연": "妍,延,蓮,娟,然,緣,淵,演,鉛,燕,姸,娫,淵,延,妍,蓮,娟,然,緣,演,燕,鉛",
    "아": "雅,娥,兒,芽,亞,峨,莪,訝,啞,丫,雅,娥,兒,芽,亞,峨,莪,訝,啞,丫,婭,疋",
    "린": "潾,麟,霖,隣,遴,燐,璘,嶙,磷,粼,潾,麟,霖,隣,遴,燐,璘,嶙,磷,粼,遴,燐",
}


def merge_lists(existing: list, extra_csv: str) -> list:
    ordered: list[str] = []
    seen: set[str] = set()
    for c in extra_csv.split(","):
        c = c.strip()
        if c and c not in seen:
            seen.add(c)
            ordered.append(c)
    for c in existing:
        if c and c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    for k, csv in EXTRA.items():
        data[k] = merge_lists(data.get(k, []), csv)
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")
    print("updated", len(EXTRA), "keys; sample 김", len(data["김"]))


if __name__ == "__main__":
    main()
