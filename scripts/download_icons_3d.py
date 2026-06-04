#!/usr/bin/env python3
"""Microsoft Fluent Emoji 3D PNG → static/icons/3d/"""
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "static" / "icons" / "3d"
BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"

MAP = {
    "feeding": "Baby%20bottle/3D/baby_bottle_3d.png",
    "sleep": "Sleeping%20face/3D/sleeping_face_3d.png",
    "bowel": "Sponge/3D/sponge_3d.png",
    "growth": "Straight%20ruler/3D/straight_ruler_3d.png",
    "home": "House/3D/house_3d.png",
    "record": "Memo/3D/memo_3d.png",
    "memories": "Camera/3D/camera_3d.png",
    "play": "Puzzle%20piece/3D/puzzle_piece_3d.png",
    "finance": "Money%20bag/3D/money_bag_3d.png",
    "vaccine": "Syringe/3D/syringe_3d.png",
    "stats": "Bar%20chart/3D/bar_chart_3d.png",
    "timeline": "Stopwatch/3D/stopwatch_3d.png",
    "heatmap": "Calendar/3D/calendar_3d.png",
    "milestone": "Star/3D/star_3d.png",
    "birthday": "Party%20popper/3D/party_popper_3d.png",
    "family": "People%20hugging/3D/people_hugging_3d.png",
    "chat": "Speech%20balloon/3D/speech_balloon_3d.png",
    "ai": "Artist%20palette/3D/artist_palette_3d.png",
    "diet": "Bowl%20with%20spoon/3D/bowl_with_spoon_3d.png",
    "insurance": "Shield/3D/shield_3d.png",
    "bank": "Bank/3D/bank_3d.png",
    "gift": "Wrapped%20gift/3D/wrapped_gift_3d.png",
    "check": "Check%20mark%20button/3D/check_mark_button_3d.png",
    "warning": "Warning/3D/warning_3d.png",
    "robot": "Robot/3D/robot_3d.png",
    "motor": "Running%20shoe/3D/running_shoe_3d.png",
    "language": "Speaking%20head/3D/speaking_head_3d.png",
    "social": "Smiling%20face%20with%20smiling%20eyes/3D/smiling_face_with_smiling_eyes_3d.png",
    "cognitive": "Brain/3D/brain_3d.png",
    "logo": "Baby%20bottle/3D/baby_bottle_3d.png",
    "chart": "Chart%20increasing/3D/chart_increasing_3d.png",
}

OUT.mkdir(parents=True, exist_ok=True)
for key, path in MAP.items():
    url = f"{BASE}/{path}"
    dest = OUT / f"{key}.png"
    try:
        urllib.request.urlretrieve(url, dest)
        print("OK", key)
    except Exception as e:
        print("FAIL", key, e)
