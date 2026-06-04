"""
우리 아이 육아앱 — 1년치 데모 데이터 시드 스크립트
아기 생년월일: 2024-06-15 (현재 ~12개월)
수유, 수면, 기저귀, 성장, 예방접종, 마일스톤, 이유식 365일 데이터 생성
"""

import sys, os, sqlite3, uuid, json, random, datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "db.sqlite3"
BABY_ID  = "demo-baby-001"
USER_ID  = "demo-user-001"
BIRTH    = datetime.datetime(2024, 6, 15, 8, 0, 0)  # 아기 생일

random.seed(42)  # 재현 가능하도록

def uid():
    return str(uuid.uuid4())

def rnd(a, b):
    return random.uniform(a, b)

def rnd_i(a, b):
    return random.randint(a, b)

# ────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# 기존 demo 데이터 초기화
for tbl in ['feedings','sleeps','bowels','growths','vaccinations',
            'milestones','diet_records','play_logs','hospital_visits']:
    c.execute(f"DELETE FROM {tbl} WHERE baby_id = ?", (BABY_ID,))
conn.commit()
print("기존 데모 데이터 삭제 완료")

today = datetime.date.today()

# ════════════════════════════════════════════════════════════
# 1. 수유 / 수면 / 기저귀 (일별 365일)
# ════════════════════════════════════════════════════════════
print("수유·수면·기저귀 365일 생성 중...")

feed_rows, sleep_rows, bowel_rows = [], [], []

for day_idx in range(366):
    day  = (BIRTH + datetime.timedelta(days=day_idx)).date()
    if day > today:
        break
    month = day_idx // 30

    # ── 수유 ──────────────────────────────────────────────
    if month < 1:
        n_feed, base_ml, br_prob = rnd_i(8,10),  70, 0.90
    elif month < 3:
        n_feed, base_ml, br_prob = rnd_i(7, 9), 110, 0.80
    elif month < 5:
        n_feed, base_ml, br_prob = rnd_i(6, 8), 140, 0.65
    elif month < 7:
        n_feed, base_ml, br_prob = rnd_i(5, 7), 160, 0.50
    elif month < 10:
        n_feed, base_ml, br_prob = rnd_i(4, 6), 180, 0.30
    else:
        n_feed, base_ml, br_prob = rnd_i(3, 5), 200, 0.15

    hours_pool = list(range(24))
    feed_hours = sorted(random.sample(hours_pool, min(n_feed, 24)))
    for fh in feed_hours:
        ft  = datetime.datetime(day.year, day.month, day.day, fh, rnd_i(0,59))
        ml  = max(round(base_ml + rnd(-25, 35)), 40)
        typ = 'breast' if random.random() < br_prob else 'formula'
        dur = rnd_i(10, 25) if typ == 'breast' else rnd_i(15, 30)
        sd  = random.choice(['left','right']) if typ == 'breast' else None
        et  = ft + datetime.timedelta(minutes=dur)
        feed_rows.append((uid(), BABY_ID, USER_ID, typ, ml, ft.isoformat(),
                          et.isoformat(), dur, sd, ft.isoformat()))

    # ── 수면 ──────────────────────────────────────────────
    if month < 3:   # 낮잠 4회 + 야간
        sessions = [(0,2,110),(8,10,55),(11,13,85),(14,16,55),(20,22,260)]
    elif month < 6:
        sessions = [(0,3,130),(9,11,60),(13,15,90),(20,22,310)]
    elif month < 9:
        sessions = [(0,2,180),(10,12,65),(14,16,65),(19,21,370)]
    else:
        sessions = [(0,1,250),(12,14,95),(19,21,430)]

    for sh, _, base_dur in sessions:
        dur2 = round(base_dur + rnd(-20, 25))
        st   = datetime.datetime(day.year, day.month, day.day, sh, rnd_i(0,30))
        et2  = st + datetime.timedelta(minutes=dur2)
        qual = random.choices(['good','normal','poor'], weights=[50,35,15])[0]
        sleep_rows.append((uid(), BABY_ID, USER_ID, st.isoformat(), et2.isoformat(),
                           dur2, qual, st.isoformat()))

    # ── 기저귀 ─────────────────────────────────────────────
    n_b = rnd_i(5,8) if month < 3 else rnd_i(4,6)
    bhours = sorted(random.sample(range(7,23), min(n_b,16)))
    for bh in bhours:
        bt    = datetime.datetime(day.year, day.month, day.day, bh, rnd_i(0,59))
        btype = random.choices(['normal','loose','constipated'],weights=[75,18,7])[0]
        color = random.choices(['yellow','green','brown'],weights=[60,25,15])[0]
        bowel_rows.append((uid(), BABY_ID, USER_ID, bt.isoformat(), btype, color, bt.isoformat()))

# 배치 삽입
c.executemany("""INSERT INTO feedings
    (id,baby_id,user_id,type,amount_ml,start_time,end_time,duration_min,side,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)""", feed_rows)
c.executemany("""INSERT INTO sleeps
    (id,baby_id,user_id,start_time,end_time,duration_min,quality,created_at)
    VALUES (?,?,?,?,?,?,?,?)""", sleep_rows)
c.executemany("""INSERT INTO bowels
    (id,baby_id,user_id,time,type,color,created_at)
    VALUES (?,?,?,?,?,?,?)""", bowel_rows)
conn.commit()
print(f"  수유 {len(feed_rows)}건 / 수면 {len(sleep_rows)}건 / 기저귀 {len(bowel_rows)}건")

# ════════════════════════════════════════════════════════════
# 2. 성장 기록 (WHO P50 ± 소량 랜덤, 매월 측정)
# ════════════════════════════════════════════════════════════
print("성장 기록 생성 중...")
# WHO Boys P50: (개월, 체중kg, 키cm, 두위cm)
who_p50 = [
    (0,  3.35, 49.9, 34.5),
    (1,  4.47, 54.7, 37.3),
    (2,  5.57, 58.4, 39.1),
    (3,  6.39, 61.4, 40.5),
    (4,  7.00, 63.9, 41.6),
    (5,  7.51, 65.9, 42.6),
    (6,  7.93, 67.6, 43.3),
    (7,  8.30, 69.2, 44.0),
    (8,  8.62, 70.6, 44.7),
    (9,  8.90, 72.0, 45.3),
    (10, 9.15, 73.3, 45.8),
    (11, 9.37, 74.5, 46.3),
    (12, 9.56, 75.7, 46.8),
]
growth_rows = []
for m, w, h, hc in who_p50:
    gdate = BIRTH + datetime.timedelta(days=m*30 + rnd_i(1,4))
    if gdate.date() > today: continue
    growth_rows.append((uid(), BABY_ID, USER_ID, gdate.isoformat(),
                        round(w  + rnd(-0.12,0.12), 2),
                        round(h  + rnd(-0.5, 0.5),  1),
                        round(hc + rnd(-0.3, 0.3),  1),
                        gdate.isoformat()))

c.executemany("""INSERT INTO growths
    (id,baby_id,user_id,date,weight_kg,height_cm,head_circumference_cm,created_at)
    VALUES (?,?,?,?,?,?,?,?)""", growth_rows)
conn.commit()
print(f"  성장 {len(growth_rows)}건")

# ════════════════════════════════════════════════════════════
# 3. 예방접종 (한국 국가 예방접종 스케줄)
# ════════════════════════════════════════════════════════════
print("예방접종 생성 중...")
# (이름, 접종일(출생후 일수), 병원, 다음접종까지 일수)
vax_schedule = [
    ('B형간염 1차',          0,   '서울아산병원', 30),
    ('BCG',                  0,   '서울아산병원', None),
    ('B형간염 2차',          30,  '서울아산병원', 150),
    ('DTaP 1차',             60,  '서울아산병원', 60),
    ('IPV 1차',              60,  '서울아산병원', 60),
    ('Hib 1차',              60,  '서울아산병원', 60),
    ('PCV13 1차',            60,  '서울아산병원', 60),
    ('로타바이러스 1차',     60,  '서울아산병원', 60),
    ('DTaP 2차',             120, '서울아산병원', 60),
    ('IPV 2차',              120, '서울아산병원', 60),
    ('Hib 2차',              120, '서울아산병원', 60),
    ('PCV13 2차',            120, '서울아산병원', 60),
    ('로타바이러스 2차',     120, '서울아산병원', None),
    ('B형간염 3차',          180, '서울아산병원', None),
    ('DTaP 3차',             180, '서울아산병원', 180),
    ('IPV 3차',              180, '서울아산병원', None),
    ('Hib 3차',              180, '서울아산병원', 180),
    ('PCV13 3차',            180, '서울아산병원', 180),
    ('인플루엔자 1차',       180, '서울아산병원', 30),
    ('인플루엔자 2차',       210, '서울아산병원', 365),
    ('A형간염 1차',          365, '서울아산병원', 180),
    ('MMR 1차',              365, '서울아산병원', None),
    ('수두',                 365, '서울아산병원', None),
    ('Hib 4차',              365, '서울아산병원', None),
    ('PCV13 4차',            365, '서울아산병원', None),
    ('일본뇌염 1차',         365, '서울아산병원', 30),
]

vax_rows = []
for name, days, clinic, next_days in vax_schedule:
    sched  = (BIRTH + datetime.timedelta(days=days)).date()
    actual = sched + datetime.timedelta(days=rnd_i(0,5))
    status = 'completed' if actual <= today else 'scheduled'
    next_d = (BIRTH + datetime.timedelta(days=days+next_days)).date().isoformat() if next_days else None
    vax_rows.append((uid(), BABY_ID, USER_ID, name, sched.isoformat(),
                     actual.isoformat() if status=='completed' else None,
                     clinic, next_d, status, sched.isoformat()))

c.executemany("""INSERT INTO vaccinations
    (id,baby_id,user_id,name,scheduled_date,actual_date,clinic,next_due_date,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)""", vax_rows)
conn.commit()
print(f"  예방접종 {len(vax_rows)}건")

# ════════════════════════════════════════════════════════════
# 4. 발달 마일스톤
# ════════════════════════════════════════════════════════════
print("마일스톤 생성 중...")
milestones = [
    (10,  'motor',    '목 가누기 시도'),
    (20,  'social',   '엄마 얼굴 인식'),
    (30,  'motor',    '고개 들기 성공 (45도)'),
    (45,  'social',   '첫 사회적 미소'),
    (55,  'language', '옹알이 시작 (아, 우)'),
    (65,  'motor',    '뒤집기 시도'),
    (75,  'cognitive','움직이는 물체 눈으로 추적'),
    (85,  'motor',    '뒤집기 완성 (앞→뒤)'),
    (100, 'social',   '거울 속 자신 인식'),
    (110, 'motor',    '혼자 앉기 (보조)'),
    (120, 'language', '다음절 옹알이 (마마, 바바)'),
    (135, 'cognitive','까꿍 놀이 반응'),
    (145, 'motor',    '혼자 앉기 완성'),
    (155, 'social',   '낯가림 시작'),
    (165, 'motor',    '배밀이 시작'),
    (175, 'language', '이름에 반응'),
    (185, 'motor',    '기기 시작'),
    (200, 'motor',    '가구 잡고 서기'),
    (215, 'cognitive','물건 집기 (집게 잡기)'),
    (225, 'language', '첫 단어 "맘마"'),
    (240, 'motor',    '가구 잡고 옆으로 이동'),
    (255, 'social',   '박수치기'),
    (270, 'motor',    '혼자 서기 시도'),
    (285, 'language', '"아빠" 말하기'),
    (300, 'cognitive','간단한 지시 이해'),
    (315, 'motor',    '혼자 서기 성공 (수초)'),
    (330, 'social',   '손 흔들어 인사'),
    (345, 'motor',    '첫 걸음 시도'),
    (358, 'motor',    '혼자 걷기 성공'),
]

ms_rows = []
for days, cat, desc in milestones:
    mdate = BIRTH + datetime.timedelta(days=days + rnd_i(-2,3))
    if mdate.date() > today: continue
    ms_rows.append((uid(), BABY_ID, USER_ID, cat, desc,
                    mdate.isoformat(), mdate.isoformat()))

c.executemany("""INSERT INTO milestones
    (id,baby_id,user_id,category,description,achieved_date,created_at)
    VALUES (?,?,?,?,?,?,?)""", ms_rows)
conn.commit()
print(f"  마일스톤 {len(ms_rows)}건")

# ════════════════════════════════════════════════════════════
# 5. 이유식 기록 (6개월~)
# ════════════════════════════════════════════════════════════
print("이유식 기록 생성 중...")
diet_start = BIRTH + datetime.timedelta(days=180)
diet_rows  = []

menus = {
    6:  [('쌀미음',         ['쌀','물'],                    'breakfast')],
    7:  [('애호박미음',     ['쌀','애호박'],                'breakfast'),
         ('고구마미음',     ['쌀','고구마'],                'lunch')],
    8:  [('브로콜리죽',     ['쌀','브로콜리','당근'],        'breakfast'),
         ('사과바나나퓨레', ['사과','바나나'],               'lunch')],
    9:  [('닭고기채소죽',   ['쌀','닭가슴살','시금치','당근'],'breakfast'),
         ('두부감자죽',     ['쌀','두부','감자'],            'lunch'),
         ('과일간식',       ['바나나','사과'],               'snack')],
    10: [('소고기미역죽',   ['쌀','소고기','미역'],          'breakfast'),
         ('두부채소볶음',   ['두부','브로콜리','당근'],      'lunch'),
         ('단호박죽',       ['쌀','단호박'],                 'dinner')],
    11: [('소고기야채진밥', ['쌀','소고기','표고버섯','당근'],'breakfast'),
         ('닭고기두부찜',   ['닭가슴살','두부','애호박'],    'lunch'),
         ('감자채소전',     ['감자','당근','양파'],          'dinner')],
    12: [('소고기미역국밥', ['쌀','소고기','미역','두부'],   'breakfast'),
         ('삼계죽',         ['쌀','닭','대추','인삼'],        'lunch'),
         ('야채볶음밥',     ['쌀','소고기','당근','양파','시금치'],'dinner')],
}

for di in range(200):
    ddate = diet_start + datetime.timedelta(days=di)
    if ddate.date() > today: break
    mo = (ddate - BIRTH).days // 30
    if mo < 6: continue
    mo_key = min(mo, 12)
    day_menus = menus.get(mo_key, menus[12])

    for name, ingr, meal in day_menus:
        amount = random.choices(['full','half','little'], weights=[50,35,15])[0]
        diet_rows.append((uid(), BABY_ID, USER_ID, ddate.isoformat(), meal,
                          json.dumps([{'name':name,'ingredients':ingr}], ensure_ascii=False),
                          '[]', amount, ddate.isoformat()))

c.executemany("""INSERT INTO diet_records
    (id,baby_id,user_id,date,meal_type,recipes,allergies,amount_eaten,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)""", diet_rows)
conn.commit()
print(f"  이유식 {len(diet_rows)}건")

# ════════════════════════════════════════════════════════════
# 6. 병원 방문 기록
# ════════════════════════════════════════════════════════════
print("병원 방문 기록 생성 중...")
hospital_visits = [
    (7,   '서울아산병원', '소아과', '신생아 건강검진', '정상'),
    (30,  '서울아산병원', '소아과', '1개월 영유아 건강검진', '정상 발달'),
    (75,  '서울아산병원', '소아과', '감기 (상기도감염)', '아목시클린 5일'),
    (90,  '서울아산병원', '소아과', '3개월 영유아 건강검진', '체중·신장 정상'),
    (120, '서울아산병원', '소아과', '4개월 영유아 건강검진', '정상 발달'),
    (150, '서울아산병원', '소아과', '장염 (로타바이러스)', '수분보충 처방'),
    (180, '서울아산병원', '소아과', '6개월 영유아 건강검진', '이유식 시작 안내'),
    (200, '서울아산병원', '피부과', '아토피 피부염', '스테로이드 연고'),
    (270, '서울아산병원', '소아과', '9개월 영유아 건강검진', '발달 양호'),
    (300, '서울아산병원', '소아과', '중이염 의심', '항생제 처방'),
    (365, '서울아산병원', '소아과', '12개월 영유아 건강검진', '돌 체크업 완료'),
]

hosp_rows = []
for days, hosp, dept, diag, rx in hospital_visits:
    vdate = (BIRTH + datetime.timedelta(days=days)).date()
    if vdate > today: continue
    hosp_rows.append((uid(), BABY_ID, USER_ID, hosp, dept,
                      vdate.isoformat(), diag, rx, None, None, vdate.isoformat()))

c.executemany("""INSERT INTO hospital_visits
    (id,baby_id,user_id,hospital,department,visit_date,diagnosis,prescription,photo_path,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)""", hosp_rows)
conn.commit()
print(f"  병원방문 {len(hosp_rows)}건")

# 최종 요약
print("\n✅ 데모 데이터 생성 완료!")
totals = {
    '수유': len(feed_rows),
    '수면': len(sleep_rows),
    '기저귀': len(bowel_rows),
    '성장': len(growth_rows),
    '예방접종': len(vax_rows),
    '마일스톤': len(ms_rows),
    '이유식': len(diet_rows),
    '병원방문': len(hosp_rows),
}
for k, v in totals.items():
    print(f"  {k}: {v}건")
print(f"  총 {sum(totals.values())}건")
conn.close()
