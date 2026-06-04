"""명리·사주 입력용 상수 (12시진 등)"""

# 12시진 (자시~해시)
SHI_CHEN = [
    {"value": "자시", "label": "자시 (23:00~01:00)", "branch": "子"},
    {"value": "축시", "label": "축시 (01:00~03:00)", "branch": "丑"},
    {"value": "인시", "label": "인시 (03:00~05:00)", "branch": "寅"},
    {"value": "묘시", "label": "묘시 (05:00~07:00)", "branch": "卯"},
    {"value": "진시", "label": "진시 (07:00~09:00)", "branch": "辰"},
    {"value": "사시", "label": "사시 (09:00~11:00)", "branch": "巳"},
    {"value": "오시", "label": "오시 (11:00~13:00)", "branch": "午"},
    {"value": "미시", "label": "미시 (13:00~15:00)", "branch": "未"},
    {"value": "신시", "label": "신시 (15:00~17:00)", "branch": "申"},
    {"value": "유시", "label": "유시 (17:00~19:00)", "branch": "酉"},
    {"value": "술시", "label": "술시 (19:00~21:00)", "branch": "戌"},
    {"value": "해시", "label": "해시 (21:00~23:00)", "branch": "亥"},
]

SHI_CHEN_VALUES = {s["value"] for s in SHI_CHEN}
