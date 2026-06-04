"""
우리 아이 올인원 육아 파트너 — 메인 애플리케이션
7대 모듈 구현: 기록, 앨범, 가족, 커머스, AI이미지, 발달, 금융
"""

import os
import sys
import json
import math
import uuid
import hashlib
import secrets
import datetime
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

from fastapi import FastAPI, Request, Depends, HTTPException, Form, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON, func as sql_func
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import StaticPool
import sqlite3

# ---------------------------------------------------------------------------
# 경로 설정 (Vercel: /tmp 에만 쓰기 가능 → DB·업로드는 /tmp)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
_IS_VERCEL = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))

# 읽기 전용 JSON 가이드는 항상 번들 경로 (Vercel에서 DATA_DIR=/tmp 와 분리)
GUIDE_DATA_DIR = BASE_DIR / "data"

if _IS_VERCEL:
    DATA_DIR = Path("/tmp/airangfit-data")
else:
    DATA_DIR = GUIDE_DATA_DIR

UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "db.sqlite3"

for d in [DATA_DIR, UPLOAD_DIR, DATA_DIR / "photos", DATA_DIR / "albums", DATA_DIR / "images"]:
    d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 데이터베이스
# ---------------------------------------------------------------------------
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ---------------------------------------------------------------------------
# SQLAlchemy 모델 — 모든 모듈의 테이블 정의
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True)
    phone = Column(String(20), unique=True, nullable=False)
    name = Column(String(50), nullable=False)
    password_hash = Column(String(128), nullable=False)
    salt = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)
    subscription = Column(String(20), default="free")  # free, pro, family
    pro_expires = Column(DateTime, nullable=True)
    baby_birthdate = Column(DateTime, nullable=True)
    profile_photo = Column(String(255), nullable=True)


class Baby(Base):
    __tablename__ = "babies"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(50), nullable=False)
    birthdate = Column(DateTime, nullable=False)
    gender = Column(String(10), default="male")
    profile_photo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Feeding(Base):
    """M1: 수유 기록"""
    __tablename__ = "feedings"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    type = Column(String(20), nullable=False)  # breast, formula
    amount_ml = Column(Float, default=0)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_min = Column(Float, nullable=True)
    side = Column(String(10), nullable=True)  # left, right
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Sleep(Base):
    """M1: 수면 기록"""
    __tablename__ = "sleeps"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_min = Column(Float, nullable=True)
    quality = Column(String(20), default="normal")  # good, normal, poor
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Bowel(Base):
    """M1: 대변 기록"""
    __tablename__ = "bowels"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    time = Column(DateTime, nullable=False)
    type = Column(String(20), default="normal")  # normal, loose, constipated, blood
    color = Column(String(20), default="yellow")  # yellow, green, brown, white
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Growth(Base):
    """M1: 성장 기록"""
    __tablename__ = "growths"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    date = Column(DateTime, nullable=False)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    head_circumference_cm = Column(Float, nullable=True)
    breast_milk_ml = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Vaccination(Base):
    """M1: 예방접종"""
    __tablename__ = "vaccinations"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    name = Column(String(100), nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    actual_date = Column(DateTime, nullable=True)
    clinic = Column(String(100), nullable=True)
    lot_number = Column(String(50), nullable=True)
    next_due_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="scheduled")  # scheduled, completed, missed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class HospitalVisit(Base):
    """M1: 병원 방문"""
    __tablename__ = "hospital_visits"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    hospital = Column(String(100), nullable=False)
    department = Column(String(50), nullable=True)
    visit_date = Column(DateTime, nullable=False)
    diagnosis = Column(Text, nullable=True)
    prescription = Column(Text, nullable=True)
    photo_path = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Milestone(Base):
    """M1: 발달 마일스톤"""
    __tablename__ = "milestones"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    category = Column(String(50), nullable=False)  # motor, language, social, cognitive
    description = Column(String(200), nullable=False)
    achieved_date = Column(DateTime, default=datetime.datetime.now)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class PhotoAlbum(Base):
    """M2: 사진 앨범"""
    __tablename__ = "photo_albums"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cover_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)
    is_special = Column(Boolean, default=False)  # 100일, 돌 등
    special_date = Column(DateTime, nullable=True)


class Photo(Base):
    """M2: 개별 사진"""
    __tablename__ = "photos"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    album_id = Column(String(36), ForeignKey("photo_albums.id"), nullable=True)
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    file_path = Column(String(255), nullable=False)
    thumbnail_path = Column(String(255), nullable=True)
    caption = Column(Text, nullable=True)
    month_age = Column(Integer, nullable=True)  # 계산된 개월수
    date = Column(DateTime, nullable=False)
    tags = Column(Text, nullable=True)  # JSON 배열
    liked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.now)


class FamilyMember(Base):
    """M3: 가족 구성원"""
    __tablename__ = "family_members"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    family_code = Column(String(10), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    name = Column(String(50), nullable=False)
    relationship = Column(String(30), default="parent")  # parent, grandparent, relative, caregiver
    role = Column(String(30), default="viewer")  # owner, co-parent, viewer, guest
    can_edit_feeding = Column(Boolean, default=False)
    can_edit_sleep = Column(Boolean, default=False)
    can_edit_photos = Column(Boolean, default=False)
    invited_at = Column(DateTime, default=datetime.datetime.now)
    joined_at = Column(DateTime, nullable=True)


class FamilyActivity(Base):
    """M3: 가족 활동 피드"""
    __tablename__ = "family_activities"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    family_code = Column(String(10), nullable=False)
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=False)
    activity_type = Column(String(30), default="photo")  # photo, feeding, sleep, bowel, message
    content = Column(Text, nullable=True)
    photo_path = Column(String(255), nullable=True)
    comments = Column(JSON, default=list)
    likes = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Product(Base):
    """M4: 커머스 상품"""
    __tablename__ = "products"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)  # diapers, formula, clothing, toys, etc.
    suitable_months = Column(JSON, default=list)  # [0,1,2,3]
    image_path = Column(String(255), nullable=True)
    brand = Column(String(100), nullable=True)
    rating = Column(Float, default=0)
    review_count = Column(Integer, default=0)
    is_joint_purchase = Column(Boolean, default=False)
    joint_purchase_price = Column(Integer, nullable=True)
    stock = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.now)


class CartItem(Base):
    """M4: 장바구니"""
    __tablename__ = "cart_items"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    product_id = Column(String(36), nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Order(Base):
    """M4: 주문"""
    __tablename__ = "orders"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    items = Column(JSON, nullable=False)
    total_price = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")  # pending, paid, shipped, delivered
    shipping_address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Wishlist(Base):
    """M4: 위시리스트"""
    __tablename__ = "wishes"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    product_id = Column(String(36), nullable=False)
    price_alert = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.now)


class AIImage(Base):
    """M5: AI 생성 이미지"""
    __tablename__ = "ai_images"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    prompt = Column(Text, nullable=False)
    style = Column(String(50), default="cartoon")  # cartoon, chibi, ghibli, pixar, hanbok
    template = Column(String(50), nullable=True)  # birthday, 100days, one-year, etc.
    output_path = Column(String(255), nullable=True)
    credit_cost = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.datetime.now)


class UserCredits(Base):
    """M5: 크레딧"""
    __tablename__ = "user_credits"
    user_id = Column(String(36), primary_key=True)
    total_credits = Column(Integer, default=5)  # free users get 5/month
    used_this_month = Column(Integer, default=0)
    last_reset = Column(DateTime, default=datetime.datetime.now)


class PlayGuide(Base):
    """M6: 발달 놀이 가이드"""
    __tablename__ = "play_guides"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    suitable_months = Column(JSON, default=list)
    category = Column(String(30), default="motor")  # motor, language, social, cognitive, sensory
    difficulty = Column(Integer, default=1)
    material_needed = Column(Text, nullable=True)
    duration_min = Column(Integer, default=15)
    video_url = Column(String(255), nullable=True)
    image_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class PlayLog(Base):
    """M6: 놀이 기록"""
    __tablename__ = "play_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    guide_id = Column(String(36), nullable=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)
    photo_path = Column(String(255), nullable=True)
    baby_reaction = Column(String(30), default="😊")
    duration_min = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.now)


class DietRecord(Base):
    """M6: 이유식 기록"""
    __tablename__ = "diet_records"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    baby_id = Column(String(36), ForeignKey("babies.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    date = Column(DateTime, nullable=False)
    meal_type = Column(String(20), default="breakfast")  # breakfast, lunch, dinner, snack
    recipes = Column(JSON, default=list)
    allergies = Column(JSON, default=list)
    amount_eaten = Column(String(20), default="full")  # full, half, little, none
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Insurance(Base):
    """M7: 보험"""
    __tablename__ = "insurances"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    company = Column(String(100), nullable=False)
    plan_name = Column(String(100), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    monthly_premium = Column(Integer, nullable=False)
    coverage = Column(JSON, default=dict)
    beneficiary = Column(String(100), nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.datetime.now)


class BabyBankAccount(Base):
    """M7: 아이 통장"""
    __tablename__ = "baby_bank_accounts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    bank_name = Column(String(50), nullable=False)
    account_number = Column(String(30), nullable=True)
    balance = Column(Integer, default=0)
    interest_rate = Column(Float, default=0.01)
    savings_goal = Column(Integer, nullable=True)
    monthly_target = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class BankTransaction(Base):
    """M7: 거래 내역"""
    __tablename__ = "bank_transactions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id = Column(String(36), ForeignKey("baby_bank_accounts.id"), nullable=False)
    user_id = Column(String(36), nullable=False)
    amount = Column(Integer, nullable=False)
    type = Column(String(20), default="deposit")  # deposit, withdrawal
    category = Column(String(50), default="gift")  # gift, savings, investment, expense
    memo = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Investment(Base):
    """M7: 투자"""
    __tablename__ = "investments"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    account_type = Column(String(30), default="junior_securities")
    total_invested = Column(Integer, default=0)
    current_value = Column(Integer, default=0)
    target_amount = Column(Integer, nullable=True)
    auto_invest = Column(Boolean, default=False)
    auto_invest_monthly = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class GiftPlan(Base):
    """M7: 증여 계획"""
    __tablename__ = "gift_plans"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    baby_id = Column(String(36), nullable=True)
    total_amount = Column(Integer, default=20000000)  # 2천만원
    annual_limit = Column(Integer, default=20000000)
    years_planned = Column(Integer, default=10)
    yearly_amount = Column(Integer, default=2000000)
    completed_years = Column(Integer, default=0)
    last_gift_date = Column(DateTime, nullable=True)
    tax_status = Column(String(20), default="none")
    created_at = Column(DateTime, default=datetime.datetime.now)


class GiftTimeline(Base):
    """M7: 증여 타임라인"""
    __tablename__ = "gift_timeline"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id = Column(String(36), ForeignKey("gift_plans.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    amount = Column(Integer, nullable=False)
    receipt_no = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class ParentProfile(Base):
    """M5: 출산택일·작명 — 부모 사주 입력"""
    __tablename__ = "parent_profiles"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)  # father, mother
    name = Column(String(50), nullable=False)
    name_hanja = Column(String(80), nullable=True)  # 사주·작명용 한자
    birth_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    birth_time = Column(String(10), nullable=True)  # HH:MM or unknown
    calendar_type = Column(String(10), default="solar")  # solar, lunar
    birth_place = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.now)


class FortuneReport(Base):
    """M5: 택일·작명 AI 결과"""
    __tablename__ = "fortune_reports"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    report_type = Column(String(20), nullable=False)  # birthday, naming
    input_json = Column(JSON, nullable=False)
    result_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)


class ShoppingOffer(Base):
    """M4: 월령별 쇼핑가이드 — 플랫폼별 오퍼"""
    __tablename__ = "shopping_offers"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    month_key = Column(String(20), nullable=False)  # prenatal, 0, 1, ...
    category_key = Column(String(50), nullable=False)
    category_label = Column(String(100), nullable=False)
    rank_in_category = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    image_url = Column(String(500), nullable=True)
    coupang_price = Column(Integer, nullable=True)
    coupang_url = Column(String(500), nullable=True)
    coupang_purchase_count = Column(Integer, nullable=True)
    coupang_review_count = Column(Integer, nullable=True)
    naver_price = Column(Integer, nullable=True)
    naver_url = Column(String(500), nullable=True)
    naver_purchase_count = Column(Integer, nullable=True)
    naver_review_count = Column(Integer, nullable=True)
    price_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


# ---------------------------------------------------------------------------
# 테이블 생성
# ---------------------------------------------------------------------------
Base.metadata.create_all(engine)


def _migrate_sqlite_columns():
    """기존 DB에 신규 컬럼 추가 (SQLite)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(parent_profiles)")
        cols = {row[1] for row in cur.fetchall()}
        if cols and "name_hanja" not in cols:
            cur.execute("ALTER TABLE parent_profiles ADD COLUMN name_hanja VARCHAR(80)")
        conn.commit()
        conn.close()
    except Exception:
        pass


_migrate_sqlite_columns()


# ---------------------------------------------------------------------------
# Pydantic 스키마
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    phone: str
    name: str
    password: str


class BabyInfo(BaseModel):
    name: str
    birthdate: str  # YYYY-MM-DD
    gender: str = "male"


class FeedingCreate(BaseModel):
    baby_id: str
    type: str = "breast"
    amount_ml: float = 0
    side: str = None
    notes: str = None


class SleepCreate(BaseModel):
    baby_id: str
    quality: str = "normal"
    notes: str = None


class GrowthCreate(BaseModel):
    baby_id: str
    weight_kg: float = None
    height_cm: float = None
    head_circumference_cm: float = None
    breast_milk_ml: float = None
    notes: str = None


class VaccinationCreate(BaseModel):
    baby_id: str
    name: str
    scheduled_date: str
    clinic: str = None
    next_due_date: str = None


class ProductCreate(BaseModel):
    name: str
    description: str = None
    price: int
    category: str
    suitable_months: list = None
    brand: str = None


class OrderCreate(BaseModel):
    baby_id: str = None
    shipping_address: str = None
    items: list
    total_price: int = 0


class AIImageCreate(BaseModel):
    baby_id: str = None
    prompt: str
    style: str = "cartoon"
    template: str = None


class PlayGuideCreate(BaseModel):
    title: str
    description: str
    suitable_months: list = None
    category: str = "motor"
    difficulty: int = 1
    material_needed: str = None
    duration_min: int = 15


class InsuranceCreate(BaseModel):
    baby_id: str = None
    company: str
    plan_name: str
    start_date: str
    monthly_premium: int
    coverage: dict = None


class BankAccountCreate(BaseModel):
    baby_id: str = None
    bank_name: str
    savings_goal: int = None
    monthly_target: int = None


class TransactionCreate(BaseModel):
    account_id: str
    amount: int
    type: str = "deposit"
    category: str = "gift"
    memo: str = None


class UserLogin(BaseModel):
    phone: str
    password: str


class FamilyInvite(BaseModel):
    name: str
    relationship: str = "parent"
    role: str = "viewer"


class ParentProfileIn(BaseModel):
    role: str
    name: str
    name_hanja: Optional[str] = None
    birth_date: str
    birth_time: Optional[str] = None  # 12시진(자시~해시) 또는 HH:MM
    calendar_type: str = "solar"
    birth_place: Optional[str] = None


class FortuneBirthdayIn(BaseModel):
    due_date: str  # 예정 출산일 YYYY-MM-DD
    baby_gender: str = "male"


class FortuneNamingIn(BaseModel):
    surname: str
    baby_gender: str = "male"
    stroke_preference: Optional[str] = None
    avoid_characters: Optional[str] = None
    include_grandfather_surname: bool = False
    dolimja: Optional[str] = None  # 돌림자 (한글 또는 한자)
    dolimja_position: Optional[str] = None  # first | second | last
    sibling_names: Optional[str] = None  # 형제·자매 이름
    meaning_preference: Optional[str] = None  # 희망 뜻·느낌
    five_element_need: Optional[str] = None  # wood|fire|earth|metal|water|none
    syllable_count: Optional[str] = None  # 2 | 3 | any
    end_sound: Optional[str] = None  # batchim | no_batchim | any
    pronunciation_notes: Optional[str] = None
    use_legal_hanja_only: bool = True  # 인명용 한자 위주


class ParentProfilesUpdate(BaseModel):
    parents: list[ParentProfileIn]


# ---------------------------------------------------------------------------
# 유틸리티
# ---------------------------------------------------------------------------

SHOPPING_GUIDE_PATH = GUIDE_DATA_DIR / "shopping_guide.json"
FINANCE_GUIDE_PATH = GUIDE_DATA_DIR / "finance_guide.json"
FORTUNE_DAILY_LIMIT = 3


def _load_shopping_guide() -> dict:
    if not SHOPPING_GUIDE_PATH.exists():
        return {"months": [], "disclaimer": "", "updated_at": None}
    with open(SHOPPING_GUIDE_PATH, encoding="utf-8") as f:
        return json.load(f)


def _fortune_reports_today(db: Session, user_id: str) -> int:
    today = datetime.datetime.now().date()
    rows = db.query(FortuneReport).filter(FortuneReport.user_id == user_id).all()
    return sum(1 for r in rows if r.created_at and r.created_at.date() == today)


def _parent_profiles_dict(db: Session, user_id: str) -> list:
    rows = db.query(ParentProfile).filter(ParentProfile.user_id == user_id).all()
    return [
        {
            "role": p.role,
            "name": p.name,
            "name_hanja": getattr(p, "name_hanja", None),
            "birth_date": p.birth_date,
            "birth_time": p.birth_time,
            "calendar_type": p.calendar_type,
            "birth_place": p.birth_place,
        }
        for p in rows
    ]


def _validate_fortune_parents(parents: list) -> None:
    if len(parents) < 2:
        raise HTTPException(
            status_code=400,
            detail="아빠·엄마 부모 사주(이름·한자·생년월일·시진)를 모두 저장해 주세요",
        )
    for p in parents:
        if not p.get("name") or not p.get("birth_date"):
            raise HTTPException(
                status_code=400,
                detail="부모 이름(한글)과 생년월일은 필수입니다",
            )

def hash_password(password: str, salt: str = None) -> tuple:
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((password + salt).encode()).hexdigest()
    return h, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    h, _ = hash_password(password, salt)
    return h == stored_hash


def calc_age(birthdate: datetime.datetime) -> dict:
    now = datetime.datetime.now()
    days = (now - birthdate).days
    months = days // 30
    years = months // 12
    remain_months = months % 12
    remain_days = days % 30
    return {
        "years": years,
        "months": remain_months,
        "days": remain_days,
        "total_months": months,
        "total_days": days,
        "weeks": days // 7,
        "phase": "0세" if years == 0 else ("1~2세" if years < 3 else "3~5세"),
    }


def get_current_db() -> Session:
    db = SessionLocal()
    return db


# ---------------------------------------------------------------------------
# 앱 생성
# ---------------------------------------------------------------------------
app = FastAPI(title="우리 아이 올인원 육아 파트너", version="1.0.0")

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")


def _baby_photo_url(profile_photo: Optional[str]) -> Optional[str]:
    """아기 프로필 사진 URL (data/ 하위 경로)"""
    if not profile_photo:
        return None
    p = Path(profile_photo)
    if not p.is_absolute():
        p = DATA_DIR / profile_photo
    if not p.exists():
        return None
    try:
        rel = p.relative_to(DATA_DIR)
        return f"/media/{rel.as_posix()}"
    except ValueError:
        return None

# 시크릿 키
SECRET_KEY = secrets.token_hex(32)


# ---------------------------------------------------------------------------
# 미들웨어 — 인증
# ---------------------------------------------------------------------------
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    db = get_current_db()
    user = db.query(User).filter(User.id == token).first()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    return user


# ---------------------------------------------------------------------------
# 초기 데이터 (데모용)
# ---------------------------------------------------------------------------
def init_demo_data():
    """데모 데이터 생성"""
    db = get_current_db()

    # 데모 사용자
    if not db.query(User).first():
        pw, salt = hash_password("1234")
        user = User(
            id="demo-user-001",
            phone="010-0000-0000",
            name="김육아",
            password_hash=pw,
            salt=salt,
            subscription="pro",
            baby_birthdate=datetime.datetime(2024, 6, 15),
        )
        db.add(user)
        db.flush()

        # 데모 아기
        baby = Baby(
            id="demo-baby-001",
            user_id="demo-user-001",
            name="우리아이",
            birthdate=datetime.datetime(2024, 6, 15),
            gender="male",
        )
        db.add(baby)
        db.flush()

        # 데모 수유 기록
        for i in range(8):
            feeding = Feeding(
                baby_id="demo-baby-001",
                user_id="demo-user-001",
                type="breast" if i % 2 == 0 else "formula",
                amount_ml=120 if i % 2 == 0 else 90,
                start_time=datetime.datetime.now() - datetime.timedelta(hours=i * 3),
                duration_min=15 + i,
                side="left" if i % 2 == 0 else "right",
                notes="분유 잘 먹었어요" if i % 3 == 0 else None,
            )
            db.add(feeding)

        # 데모 수면 기록
        for i in range(5):
            sleep = Sleep(
                baby_id="demo-baby-001",
                user_id="demo-user-001",
                start_time=datetime.datetime.now() - datetime.timedelta(days=i, hours=2),
                end_time=datetime.datetime.now() - datetime.timedelta(days=i, hours=-1),
                duration_min=90 + i * 15,
                quality="good" if i % 2 == 0 else "normal",
            )
            db.add(sleep)

        # 데모 성장 기록
        for i in range(6):
            growth = Growth(
                baby_id="demo-baby-001",
                user_id="demo-user-001",
                date=datetime.datetime(2024, 6 + i, 15),
                weight_kg=3.2 + i * 0.6,
                height_cm=50 + i * 2.5,
                head_circumference_cm=34 + i * 0.8,
            )
            db.add(growth)

        # 데모 예방접종
        vaccines = [
            ("B型肝炎 1차", "2024-06-18", "서울아산병원", "2024-07-18"),
            ("B型肝炎 2차", "2024-07-16", "서울아산병원", "2024-08-16"),
            ("B型肝炎 3차", "2024-08-20", "서울아산병원", None),
            ("BCG", "2024-07-01", "서울아산병원", None),
            ("IPV 1차", "2024-08-19", "서울아산병원", "2024-09-19"),
            ("DTaP 1차", "2024-08-19", "서울아산병원", "2024-09-19"),
            ("Hib 1차", "2024-08-19", "서울아산병원", "2024-09-19"),
            ("PCV 1차", "2024-08-19", "서울아산병원", "2024-09-19"),
        ]
        for name, sch, clinic, nxt in vaccines:
            vac = Vaccination(
                baby_id="demo-baby-001",
                user_id="demo-user-001",
                name=name,
                scheduled_date=datetime.datetime.strptime(sch, "%Y-%m-%d"),
                clinic=clinic,
                next_due_date=datetime.datetime.strptime(nxt, "%Y-%m-%d") if nxt else None,
                status="completed" if sch < "2024-07-01" else "scheduled",
            )
            db.add(vac)

        # 데모 마일스톤
        milestones = [
            ("motor", "고개 들기"),
            ("motor", "배밀이 시도"),
            ("social", "사람 인식"),
            ("social", "웃음"),
            ("language", "옹알이 시작"),
        ]
        for cat, desc in milestones:
            ms = Milestone(
                baby_id="demo-baby-001",
                user_id="demo-user-001",
                category=cat,
                description=desc,
                achieved_date=datetime.datetime.now() - datetime.timedelta(days=30),
            )
            db.add(ms)

        # 데모 가족
        fam = FamilyMember(
            family_code="BABY01",
            user_id="demo-user-001",
            baby_id="demo-baby-001",
            name="김육아",
            relationship="parent",
            role="owner",
            can_edit_feeding=True,
            can_edit_sleep=True,
            can_edit_photos=True,
            joined_at=datetime.datetime.now(),
        )
        db.add(fam)
        fam2 = FamilyMember(
            family_code="BABY01",
            user_id="demo-user-001",
            baby_id="demo-baby-001",
            name="할머니",
            relationship="grandparent",
            role="viewer",
            joined_at=datetime.datetime.now(),
        )
        db.add(fam2)

        # 데모 상품
        products = [
            ("에어비클래식 아기 침대", "안전인증 완료, 통기성 매트", 289000, "baby_furniture", [0, 1, 2, 3]),
            ("한영 젬 Baby 1호 분유", "태아~6개월, 700g", 28900, "formula", [0, 1, 2]),
            ("Pampers 프리미엄 보호 기저귀 1호", "3~5kg, 108매", 32000, "diapers", [0]),
            ("반디반디 모기향 42매", "유아용 무향", 15000, "health", [0, 1, 2, 3, 4, 5]),
            ("베이비클론 첫돌 한복", "남아용, 고급 견", 189000, "clothing", [11]),
            ("메르스 비테라 베르디 1단계 이유식", "채소+과일 12종", 12000, "food", [5, 6, 7, 8]),
            ("키즈아일랜드 스마트 장난감", "-month별 학습", 45000, "toys", [3, 4, 5, 6, 7]),
            ("삼성 전자유모차", "원터치 접이식, 경량", 159000, "stroller", [0, 1]),
            ("네이버 페이 아기 용돈 카드", "선불 전자지갑", 5000, "finance", [36, 48, 60]),
            ("어린이 건강보험 안내", "태아~만6세", 0, "insurance", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
        ]
        for name, desc, price, cat, months in products:
            p = Product(
                name=name,
                description=desc,
                price=price,
                category=cat,
                suitable_months=months,
                rating=4.0 + (len(name) % 10) * 0.05,
                review_count=10 + len(name),
            )
            db.add(p)

        # 데모 놀이 가이드
        guides = [
            ("소근육 발달 — 블록 쌓기", "색깔 블록 5개를 쌓아보세요. 아이의 손끝 운동과 집중력 발달에 좋아요.", [3, 4, 5], "motor", 1, "블록 5개, 안정된 바닥", 10),
            ("언어 발달 — 그림책 읽기", "표정이 풍부한 그림책을 들려주세요. '이건 뭐예요?' 라고 질문해보세요.", [4, 5, 6], "language", 1, "그림책 1권", 15),
            ("대근육 발달 — 기어다니기", "장난감을 멀리 두고 기어다니도록 유도하세요. 균형감 발달에 좋아요.", [5, 6, 7], "motor", 2, "선호 장난감 1개", 20),
            ("사회성 발달 — 거울 놀이", "거울 앞에 아이를 세워놓고 함께 웃어보세요. 자아 인식 발달에 좋아요.", [6, 7, 8], "social", 1, "안전 거울", 10),
            ("감각 발달 — 물놀이", "미지근한 물에 발을 담가보도록 해요. 촉감 자극에 좋아요.", [4, 5, 6], "sensory", 1, "물그릇, 수건", 15),
        ]
        for title, desc, months, cat, diff, mat, dur in guides:
            pg = PlayGuide(
                title=title,
                description=desc,
                suitable_months=months,
                category=cat,
                difficulty=diff,
                material_needed=mat,
                duration_min=dur,
            )
            db.add(pg)

        # 데모 보험
        ins = Insurance(
            user_id="demo-user-001",
            baby_id="demo-baby-001",
            company="삼성생명",
            plan_name="어린이 종합보험",
            start_date=datetime.datetime(2024, 6, 15),
            monthly_premium=35000,
            coverage={"질병": 50000000, "상해": 30000000, "입원": 100000, "수술": 5000000},
            beneficiary="김육아",
        )
        db.add(ins)

        # 데모 아이 통장
        bank = BabyBankAccount(
            user_id="demo-user-001",
            baby_id="demo-baby-001",
            bank_name="토스뱅크",
            balance=500000,
            interest_rate=0.01,
            savings_goal=10000000,
            monthly_target=500000,
        )
        db.add(bank)
        db.flush()

        # 거래 내역
        txns = [
            (str(bank.id), 100000, "deposit", "gift", "성함축하금"),
            (str(bank.id), 50000, "deposit", "gift", "돌상금"),
            (str(bank.id), 300000, "deposit", "savings", "월 저축"),
        ]
        for acc, amt, typ, cat, memo in txns:
            tx = BankTransaction(
                account_id=acc,
                user_id="demo-user-001",
                amount=amt,
                type=typ,
                category=cat,
                memo=memo,
            )
            db.add(tx)

        # 데모 증여 계획
        gp = GiftPlan(
            user_id="demo-user-001",
            baby_id="demo-baby-001",
            total_amount=20000000,
            annual_limit=20000000,
            years_planned=10,
            yearly_amount=2000000,
        )
        db.add(gp)

        db.commit()
        db.close()


# 데모 데이터 초기화
init_demo_data()


# ---------------------------------------------------------------------------
# 라우터 — 인증 (M1 기반)
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html", {})


@app.get("/sw.js")
async def service_worker():
    """PWA 서비스 워커 — 루트 경로에서 서빙해야 전체 앱에 scope 적용"""
    from fastapi.responses import FileResponse
    return FileResponse(str(BASE_DIR / "static" / "sw.js"), media_type="application/javascript")




@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/api/auth/register")
async def register(data: UserRegister):
    db = get_current_db()
    if db.query(User).filter(User.phone == data.phone).first():
        db.close()
        return JSONResponse({"error": "이미 가입된 번호입니다"}, status_code=400)
    pw, salt = hash_password(data.password)
    user = User(
        id=str(uuid.uuid4()),
        phone=data.phone,
        name=data.name,
        password_hash=pw,
        salt=salt,
    )
    db.add(user)
    db.commit()
    db.close()
    return JSONResponse({"message": "가입완료", "user_id": user.id})


@app.post("/api/auth/login")
async def login(data: UserLogin):
    db = get_current_db()
    user = db.query(User).filter(User.phone == data.phone).first()
    if not user or not verify_password(data.password, user.password_hash, user.salt):
        db.close()
        return JSONResponse({"error": "아이디 또는 비밀번호가 잘못되었습니다"}, status_code=401)
    db.close()
    return JSONResponse({"message": "로그인완료", "user_id": user.id, "subscription": user.subscription})


@app.get("/api/auth/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "subscription": user.subscription,
        "baby_birthdate": user.baby_birthdate.isoformat() if user.baby_birthdate else None,
    }


# ---------------------------------------------------------------------------
# 라우터 — 아기 관리 (M1)
# ---------------------------------------------------------------------------

@app.get("/api/babies")
async def get_babies(user: User = Depends(get_current_user)):
    db = get_current_db()
    babies = db.query(Baby).filter(Baby.user_id == user.id).all()
    db.close()
    return [{"id": b.id, "name": b.name, "birthdate": b.birthdate.isoformat(),
             "gender": b.gender, "age": calc_age(b.birthdate)} for b in babies]


@app.post("/api/babies")
async def create_baby(data: BabyInfo, user: User = Depends(get_current_user)):
    db = get_current_db()
    baby = Baby(
        user_id=user.id,
        name=data.name,
        birthdate=datetime.datetime.strptime(data.birthdate, "%Y-%m-%d"),
        gender=data.gender,
    )
    db.add(baby)
    user.baby_birthdate = baby.birthdate
    db.commit()
    db.close()
    return {"id": baby.id, "name": baby.name}


@app.get("/api/babies/{baby_id}/age")
async def get_baby_age(baby_id: str):
    db = get_current_db()
    baby = db.query(Baby).filter(Baby.id == baby_id).first()
    db.close()
    if not baby:
        return JSONResponse({"error": "아기를 찾을 수 없습니다"}, status_code=404)
    return calc_age(baby.birthdate)


# ---------------------------------------------------------------------------
# 라우터 — 수유 기록 (M1)
# ---------------------------------------------------------------------------

@app.get("/api/feedings")
async def get_feedings(baby_id: str = None, days: int = 7, user: User = Depends(get_current_user)):
    db = get_current_db()
    q = db.query(Feeding).filter(Feeding.user_id == user.id)
    if baby_id:
        q = q.filter(Feeding.baby_id == baby_id)
    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
    q = q.filter(Feeding.start_time >= cutoff)
    q = q.order_by(Feeding.start_time.desc())
    items = q.all()
    db.close()
    return [{
        "id": f.id, "type": f.type, "amount_ml": f.amount_ml,
        "start_time": f.start_time.isoformat(), "duration_min": f.duration_min,
        "side": f.side, "notes": f.notes
    } for f in items]


@app.post("/api/feedings")
async def create_feeding(data: FeedingCreate, user: User = Depends(get_current_user)):
    now = datetime.datetime.now()
    db = get_current_db()
    feeding = Feeding(
        baby_id=data.baby_id,
        user_id=user.id,
        type=data.type,
        amount_ml=data.amount_ml,
        start_time=now,
        duration_min=15,
        side=data.side,
        notes=data.notes,
    )
    db.add(feeding)
    db.commit()
    db.close()
    return {"id": feeding.id, "message": "수유 기록 완료"}


@app.post("/api/feedings/timer/start")
async def start_feeding_timer(data: FeedingCreate, user: User = Depends(get_current_user)):
    now = datetime.datetime.now()
    db = get_current_db()
    feeding = Feeding(
        baby_id=data.baby_id,
        user_id=user.id,
        type=data.type,
        amount_ml=data.amount_ml,
        start_time=now,
        side=data.side,
    )
    db.add(feeding)
    db.commit()
    db.close()
    return {"id": feeding.id, "message": "타이머 시작", "start_time": now.isoformat()}


@app.post("/api/feedings/timer/{feeding_id}/end")
async def end_feeding_timer(feeding_id: str, amount_ml: float = 0, user: User = Depends(get_current_user)):
    db = get_current_db()
    f = db.query(Feeding).filter(Feeding.id == feeding_id, Feeding.user_id == user.id).first()
    if not f:
        db.close()
        return JSONResponse({"error": "기록을 찾을 수 없습니다"}, status_code=404)
    f.end_time = datetime.datetime.now()
    f.duration_min = (f.end_time - f.start_time).total_seconds() / 60
    f.amount_ml = amount_ml
    db.commit()
    db.close()
    return {"message": "타이머 종료", "duration_min": f.duration_min}


# ---------------------------------------------------------------------------
# 라우터 — 수면 기록 (M1)
# ---------------------------------------------------------------------------

@app.get("/api/sleeps")
async def get_sleeps(baby_id: str = None, days: int = 7, user: User = Depends(get_current_user)):
    db = get_current_db()
    q = db.query(Sleep).filter(Sleep.user_id == user.id)
    if baby_id:
        q = q.filter(Sleep.baby_id == baby_id)
    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
    q = q.filter(Sleep.start_time >= cutoff)
    q = q.order_by(Sleep.start_time.desc())
    items = q.all()
    db.close()
    return [{
        "id": s.id, "start_time": s.start_time.isoformat(),
        "end_time": s.end_time.isoformat() if s.end_time else None,
        "duration_min": s.duration_min, "quality": s.quality
    } for s in items]


@app.post("/api/sleeps")
async def create_sleep(data: SleepCreate, user: User = Depends(get_current_user)):
    now = datetime.datetime.now()
    db = get_current_db()
    sleep = Sleep(
        baby_id=data.baby_id,
        user_id=user.id,
        start_time=now,
        quality=data.quality,
        notes=data.notes,
    )
    db.add(sleep)
    db.commit()
    db.close()
    return {"id": sleep.id, "message": "수면 기록 완료"}


# ---------------------------------------------------------------------------
# 라우터 — 대변 기록 (M1)
# ---------------------------------------------------------------------------

@app.post("/api/bowels")
async def create_bowel(data: dict, user: User = Depends(get_current_user)):
    db = get_current_db()
    bowel = Bowel(
        baby_id=data["baby_id"],
        user_id=user.id,
        time=datetime.datetime.now(),
        type=data.get("type", "normal"),
        color=data.get("color", "yellow"),
        notes=data.get("notes"),
    )
    db.add(bowel)
    db.commit()
    db.close()
    return {"id": bowel.id, "message": "대변 기록 완료"}


# ---------------------------------------------------------------------------
# 라우터 — 성장 기록 (M1)
# ---------------------------------------------------------------------------

@app.get("/api/growths")
async def getgrowths(baby_id: str = None, user: User = Depends(get_current_user)):
    db = get_current_db()
    q = db.query(Growth).filter(Growth.user_id == user.id)
    if baby_id:
        q = q.filter(Growth.baby_id == baby_id)
    q = q.order_by(Growth.date.desc())
    items = q.all()
    db.close()
    return [{"id": g.id, "date": g.date.isoformat(), "weight_kg": g.weight_kg,
             "height_cm": g.height_cm, "head_circumference_cm": g.head_circumference_cm}
            for g in items]


@app.post("/api/growths")
async def create_growth(data: GrowthCreate, user: User = Depends(get_current_user)):
    db = get_current_db()
    g = Growth(
        baby_id=data.baby_id,
        user_id=user.id,
        date=datetime.datetime.now(),
        weight_kg=data.weight_kg,
        height_cm=data.height_cm,
        head_circumference_cm=data.head_circumference_cm,
        breast_milk_ml=data.breast_milk_ml,
        notes=data.notes,
    )
    db.add(g)
    db.commit()
    db.close()
    return {"id": g.id, "message": "성장 기록 완료"}


# ---------------------------------------------------------------------------
# 라우터 — 예방접종 (M1)
# ---------------------------------------------------------------------------

@app.get("/api/vaccinations")
async def get_vaccinations(baby_id: str = None, user: User = Depends(get_current_user)):
    db = get_current_db()
    q = db.query(Vaccination).filter(Vaccination.user_id == user.id)
    if baby_id:
        q = q.filter(Vaccination.baby_id == baby_id)
    q = q.order_by(Vaccination.scheduled_date.desc())
    items = q.all()
    db.close()
    return [{"id": v.id, "name": v.name, "scheduled_date": v.scheduled_date.isoformat(),
             "actual_date": v.actual_date.isoformat() if v.actual_date else None,
             "clinic": v.clinic, "status": v.status} for v in items]


@app.post("/api/vaccinations")
async def create_vaccination(data: VaccinationCreate, user: User = Depends(get_current_user)):
    db = get_current_db()
    v = Vaccination(
        baby_id=data.baby_id,
        user_id=user.id,
        name=data.name,
        scheduled_date=datetime.datetime.strptime(data.scheduled_date, "%Y-%m-%d"),
        clinic=data.clinic,
        next_due_date=datetime.datetime.strptime(data.next_due_date, "%Y-%m-%d") if data.next_due_date else None,
    )
    db.add(v)
    db.commit()
    db.close()
    return {"id": v.id, "message": "예방접종 등록 완료"}


@app.post("/api/vaccinations/{vac_id}/complete")
async def complete_vaccination(vac_id: str, user: User = Depends(get_current_user)):
    db = get_current_db()
    v = db.query(Vaccination).filter(Vaccination.id == vac_id, Vaccination.user_id == user.id).first()
    if not v:
        db.close()
        return JSONResponse({"error": "예방접종을 찾을 수 없습니다"}, status_code=404)
    v.actual_date = datetime.datetime.now()
    v.status = "completed"
    db.commit()
    db.close()
    return {"message": "접종 완료"}


# ---------------------------------------------------------------------------
# 라우터 — 마일스톤 (M1)
# ---------------------------------------------------------------------------

@app.get("/api/milestones")
async def get_milestones(baby_id: str = None, user: User = Depends(get_current_user)):
    db = get_current_db()
    q = db.query(Milestone).filter(Milestone.user_id == user.id)
    if baby_id:
        q = q.filter(Milestone.baby_id == baby_id)
    q = q.order_by(Milestone.achieved_date.desc())
    items = q.all()
    db.close()
    return [{"id": m.id, "category": m.category, "description": m.description,
             "achieved_date": m.achieved_date.isoformat()} for m in items]


@app.post("/api/milestones")
async def create_milestone(data: dict, user: User = Depends(get_current_user)):
    db = get_current_db()
    m = Milestone(
        baby_id=data["baby_id"],
        user_id=user.id,
        category=data["category"],
        description=data["description"],
    )
    db.add(m)
    db.commit()
    db.close()
    return {"id": m.id, "message": "마일스톤 기록 완료"}


# ---------------------------------------------------------------------------
# WHO 성장 백분위 전체 테이블 (출처: WHO Child Growth Standards, 0~24개월)
# ---------------------------------------------------------------------------

# 남아 체중 kg (0~24개월, P3/P15/P50/P85/P97)
WHO_BOYS_WEIGHT = {
    "p3":  [2.5,3.4,4.3,5.0,5.6,6.0,6.4,6.7,6.9,7.1,7.4,7.6,7.7,8.0,8.2,8.4,8.6,8.7,8.9,9.1,9.2,9.4,9.5,9.7,9.8],
    "p15": [2.9,3.9,4.9,5.7,6.2,6.7,7.1,7.4,7.7,7.9,8.2,8.4,8.6,8.8,9.0,9.2,9.4,9.6,9.8,9.9,10.1,10.3,10.4,10.6,10.8],
    "p50": [3.35,4.47,5.57,6.39,7.00,7.51,7.93,8.30,8.62,8.90,9.15,9.37,9.56,9.74,9.90,10.06,10.21,10.35,10.50,10.63,10.77,10.90,11.03,11.16,11.29],
    "p85": [3.9,5.1,6.3,7.2,7.8,8.4,8.8,9.2,9.6,9.9,10.2,10.5,10.7,10.9,11.2,11.4,11.6,11.8,12.0,12.2,12.4,12.6,12.8,12.9,13.1],
    "p97": [4.4,5.8,7.1,8.0,8.7,9.3,9.8,10.3,10.7,11.0,11.4,11.7,11.9,12.2,12.5,12.7,13.0,13.2,13.5,13.7,13.9,14.2,14.4,14.6,14.9],
}

# 남아 신장 cm (0~24개월, P3/P15/P50/P85/P97)
WHO_BOYS_HEIGHT = {
    "p3":  [46.1,51.1,54.7,57.6,60.0,61.9,63.6,65.1,66.5,67.7,69.0,70.2,71.3,72.3,73.4,74.4,75.4,76.3,77.2,78.1,79.0,79.9,80.7,81.5,82.3],
    "p15": [47.8,52.9,56.6,59.5,62.0,64.0,65.7,67.2,68.7,70.0,71.3,72.5,73.7,74.7,75.8,76.8,77.8,78.7,79.7,80.5,81.4,82.3,83.1,84.0,84.8],
    "p50": [49.9,54.7,58.4,61.4,63.9,65.9,67.6,69.2,70.6,72.0,73.3,74.5,75.7,76.9,78.0,79.1,80.2,81.2,82.3,83.2,84.2,85.1,86.0,86.9,87.8],
    "p85": [52.0,56.5,60.2,63.2,65.7,67.7,69.5,71.1,72.6,74.0,75.3,76.6,77.8,79.0,80.2,81.3,82.4,83.5,84.5,85.5,86.5,87.5,88.4,89.3,90.3],
    "p97": [53.4,58.1,62.0,65.1,67.7,69.9,71.6,73.2,74.7,76.2,77.5,78.9,80.2,81.4,82.6,83.7,84.9,86.0,87.1,88.1,89.2,90.2,91.2,92.1,93.1],
}

# 남아 두위 cm (0~24개월, P3/P50/P97)
WHO_BOYS_HEAD = {
    "p3":  [31.9,34.9,36.8,38.3,39.5,40.5,41.3,42.1,42.8,43.4,44.0,44.5,45.0,45.3,45.7,46.0,46.3,46.6,46.8,47.1,47.3,47.5,47.7,47.9,48.1],
    "p50": [34.5,37.3,39.1,40.5,41.6,42.6,43.3,44.0,44.7,45.3,45.8,46.3,46.8,47.2,47.6,47.9,48.3,48.6,48.9,49.2,49.4,49.7,49.9,50.2,50.4],
    "p97": [36.9,39.5,41.3,42.7,43.9,44.8,45.6,46.4,47.0,47.7,48.2,48.7,49.2,49.6,50.0,50.4,50.7,51.1,51.4,51.7,52.0,52.2,52.5,52.8,53.0],
}

# 여아 체중 kg (0~24개월, P3/P15/P50/P85/P97)
WHO_GIRLS_WEIGHT = {
    "p3":  [2.4,3.2,4.0,4.7,5.2,5.6,5.9,6.2,6.5,6.7,6.9,7.2,7.3,7.6,7.8,8.0,8.2,8.4,8.5,8.7,8.9,9.0,9.2,9.4,9.5],
    "p15": [2.8,3.7,4.5,5.2,5.7,6.1,6.5,6.8,7.0,7.3,7.5,7.7,7.9,8.1,8.4,8.6,8.7,8.9,9.1,9.3,9.5,9.6,9.8,10.0,10.1],
    "p50": [3.23,4.19,5.12,5.85,6.42,6.90,7.30,7.64,7.95,8.22,8.48,8.71,8.93,9.14,9.34,9.53,9.72,9.90,10.07,10.25,10.42,10.59,10.76,10.93,11.09],
    "p85": [3.7,4.8,5.8,6.6,7.3,7.8,8.2,8.6,9.0,9.3,9.6,9.9,10.1,10.4,10.6,10.9,11.1,11.3,11.6,11.8,12.0,12.2,12.4,12.6,12.8],
    "p97": [4.2,5.5,6.6,7.5,8.2,8.8,9.3,9.8,10.2,10.5,10.9,11.2,11.5,11.8,12.1,12.4,12.6,12.9,13.1,13.4,13.6,13.9,14.1,14.3,14.6],
}

# 여아 신장 cm (0~24개월, P3/P15/P50/P85/P97)
WHO_GIRLS_HEIGHT = {
    "p3":  [45.6,50.0,53.2,55.8,58.0,59.9,61.5,62.9,64.3,65.6,66.8,68.0,69.1,70.2,71.2,72.2,73.1,74.0,74.9,75.8,76.7,77.5,78.4,79.2,80.0],
    "p15": [47.2,51.7,55.0,57.6,59.9,61.8,63.5,65.0,66.4,67.7,68.9,70.2,71.3,72.4,73.4,74.4,75.4,76.4,77.3,78.2,79.1,80.0,80.9,81.8,82.6],
    "p50": [49.1,53.7,57.1,59.8,62.1,64.0,65.7,67.3,68.7,70.1,71.5,72.8,74.0,75.2,76.4,77.5,78.6,79.7,80.7,81.7,82.7,83.7,84.6,85.5,86.4],
    "p85": [51.0,55.6,59.2,62.0,64.3,66.2,67.9,69.5,71.0,72.4,73.8,75.1,76.3,77.6,78.8,79.9,81.1,82.2,83.3,84.3,85.3,86.3,87.3,88.3,89.2],
    "p97": [52.9,57.6,61.1,63.9,66.2,68.2,69.9,71.6,73.0,74.5,75.9,77.2,78.5,79.7,80.9,82.1,83.2,84.3,85.4,86.5,87.5,88.5,89.6,90.5,91.5],
}

# 여아 두위 cm (0~24개월, P3/P50/P97)
WHO_GIRLS_HEAD = {
    "p3":  [31.5,34.3,36.0,37.4,38.5,39.5,40.3,41.0,41.7,42.3,42.8,43.3,43.7,44.1,44.5,44.9,45.2,45.5,45.8,46.1,46.3,46.6,46.8,47.1,47.3],
    "p50": [33.9,36.6,38.3,39.5,40.6,41.5,42.2,42.9,43.5,44.1,44.6,45.1,45.5,46.0,46.3,46.7,47.0,47.3,47.6,47.9,48.1,48.4,48.6,48.9,49.1],
    "p97": [36.1,38.8,40.6,41.9,42.9,43.8,44.6,45.4,46.0,46.7,47.2,47.7,48.2,48.6,49.0,49.4,49.7,50.1,50.4,50.7,51.0,51.2,51.5,51.8,52.0],
}


def _calc_percentile_rank(value: float, month: int, table: dict) -> float:
    """P3~P97 사이 보간으로 백분위 추정"""
    m = min(month, len(table["p50"]) - 1)
    p3  = table["p3"][m]
    p15 = table["p15"][m]
    p50 = table["p50"][m]
    p85 = table["p85"][m]
    p97 = table["p97"][m]
    if value <= p3:  return 3.0
    if value <= p15: return 3.0  + (value - p3)  / (p15 - p3)  * 12.0
    if value <= p50: return 15.0 + (value - p15) / (p50 - p15) * 35.0
    if value <= p85: return 50.0 + (value - p50) / (p85 - p50) * 35.0
    if value <= p97: return 85.0 + (value - p85) / (p97 - p85) * 12.0
    return 97.0


def _growth_comment(metric: str, pct: float, month: int) -> dict:
    """백분위 기반 코멘트 생성"""
    if metric == "weight":
        if pct < 3:
            return {"level":"warning","icon":"⚠️","text":f"체중이 또래 하위 3% 미만입니다. 소아과 전문의 상담을 권장합니다."}
        elif pct < 15:
            return {"level":"caution","icon":"💛","text":f"체중이 또래 하위 {pct:.0f}% 수준으로 다소 가볍습니다. 수유량과 이유식 섭취량을 체크하세요."}
        elif pct <= 85:
            return {"level":"good","icon":"✅","text":f"체중이 또래 {pct:.0f}% 수준으로 정상 범위입니다. 잘 자라고 있어요! 🎉"}
        elif pct <= 97:
            return {"level":"caution","icon":"💛","text":f"체중이 또래 상위 {100-pct:.0f}% 수준으로 약간 높습니다. 수유량과 활동량을 확인하세요."}
        else:
            return {"level":"warning","icon":"⚠️","text":f"체중이 또래 상위 3% 이상입니다. 소아과 전문의와 상담하세요."}
    elif metric == "height":
        if pct < 3:
            return {"level":"warning","icon":"⚠️","text":f"키가 또래 하위 3% 미만입니다. 성장 지연 여부를 소아과에서 확인하세요."}
        elif pct < 15:
            return {"level":"caution","icon":"💛","text":f"키가 또래 하위 {pct:.0f}% 수준입니다. 영양 섭취와 수면이 충분한지 확인하세요."}
        elif pct <= 85:
            return {"level":"good","icon":"✅","text":f"키가 또래 {pct:.0f}% 수준으로 정상 범위입니다. 쑥쑥 자라고 있어요! 🌱"}
        else:
            return {"level":"good","icon":"✅","text":f"키가 또래 상위 {100-pct:.0f}% 수준으로 크게 자라고 있습니다."}
    else:
        if pct < 3 or pct > 97:
            return {"level":"caution","icon":"💛","text":f"두위가 정상 범위를 벗어났습니다. 소아과 검진을 권장합니다."}
        return {"level":"good","icon":"✅","text":f"두위가 정상 범위({pct:.0f}%)입니다."}


@app.get("/api/growth/who-boys")
async def get_who_boys_data():
    """WHO 남자아기 성장 기준치 (P3/P15/P50/P85/P97, 0~24개월)"""
    return {
        "weight": WHO_BOYS_WEIGHT,
        "height": WHO_BOYS_HEIGHT,
        "head": WHO_BOYS_HEAD,
    }


@app.get("/api/growth/who-girls")
async def get_who_girls_data():
    """WHO 여자아기 성장 기준치 (P3/P15/P50/P85/P97, 0~24개월)"""
    return {
        "weight": WHO_GIRLS_WEIGHT,
        "height": WHO_GIRLS_HEIGHT,
        "head": WHO_GIRLS_HEAD,
    }


@app.get("/api/growth/compare/{baby_id}")
async def get_growth_compare(baby_id: str, user: User = Depends(get_current_user)):
    """아이 성장 기록 + WHO 백분위 비교 + 코멘트"""
    db = get_current_db()
    baby = db.query(Baby).filter(Baby.id == baby_id).first()
    if not baby:
        db.close()
        return JSONResponse({"error": "아기를 찾을 수 없습니다"}, status_code=404)

    growths = db.query(Growth).filter(Growth.baby_id == baby_id).order_by(Growth.date.asc()).all()
    db.close()

    gender = getattr(baby, 'gender', 'male')
    w_table = WHO_BOYS_WEIGHT  if gender == 'male' else WHO_GIRLS_WEIGHT
    h_table = WHO_BOYS_HEIGHT  if gender == 'male' else WHO_GIRLS_HEIGHT
    hc_table = WHO_BOYS_HEAD   if gender == 'male' else WHO_GIRLS_HEAD

    age_now = calc_age(baby.birthdate)
    total_months = age_now["total_months"]

    records = []
    latest_weight_pct = None
    latest_height_pct = None
    latest_head_pct   = None

    for g in growths:
        m = min(int((g.date - baby.birthdate).days / 30), 24)
        w_pct  = _calc_percentile_rank(g.weight_kg,              m, w_table)  if g.weight_kg else None
        h_pct  = _calc_percentile_rank(g.height_cm,              m, h_table)  if g.height_cm else None
        hc_pct = _calc_percentile_rank(g.head_circumference_cm,  m, {"p3":hc_table["p3"],"p15":hc_table["p3"],"p50":hc_table["p50"],"p85":hc_table["p97"],"p97":hc_table["p97"]}) if g.head_circumference_cm else None

        records.append({
            "month": m,
            "date":  g.date.isoformat(),
            "weight_kg": g.weight_kg,
            "height_cm": g.height_cm,
            "head_cm":   g.head_circumference_cm,
            "weight_pct": round(w_pct, 1)  if w_pct  else None,
            "height_pct": round(h_pct, 1)  if h_pct  else None,
            "head_pct":   round(hc_pct, 1) if hc_pct else None,
        })
        latest_weight_pct = w_pct  if w_pct  else latest_weight_pct
        latest_height_pct = h_pct  if h_pct  else latest_height_pct
        latest_head_pct   = hc_pct if hc_pct else latest_head_pct

    # 코멘트
    comments = []
    if latest_weight_pct is not None:
        comments.append(_growth_comment("weight", latest_weight_pct, total_months))
    if latest_height_pct is not None:
        comments.append(_growth_comment("height", latest_height_pct, total_months))
    if latest_head_pct is not None:
        comments.append(_growth_comment("head", latest_head_pct, total_months))

    # 개월수별 WHO 참고값 반환 (차트용)
    who_months = list(range(min(total_months + 3, 25)))
    who_ref = {
        "weight": {k: [WHO_BOYS_WEIGHT[k][m] if gender=='male' else WHO_GIRLS_WEIGHT[k][m] for m in who_months] for k in ["p3","p15","p50","p85","p97"]},
        "height": {k: [WHO_BOYS_HEIGHT[k][m] if gender=='male' else WHO_GIRLS_HEIGHT[k][m] for m in who_months] for k in ["p3","p15","p50","p85","p97"]},
    }

    return {
        "baby": {"name": baby.name, "gender": gender, "age_months": total_months},
        "records": records,
        "who_ref": who_ref,
        "who_months": who_months,
        "comments": comments,
        "latest": {
            "weight_pct": round(latest_weight_pct, 1) if latest_weight_pct else None,
            "height_pct": round(latest_height_pct, 1) if latest_height_pct else None,
        },
    }


@app.get("/api/growth/percentile")
async def calc_percentile(baby_id: str, weight_kg: float = None, height_cm: float = None, age_months: int = None):
    """백분위 계산"""
    if not baby_id or not age_months:
        return JSONResponse({"error": "baby_id와 age_months 필요"}, status_code=400)
    # 간략화된 백분위 계산 (실제로는 WHO 표준 차트 테이블 필요)
    # 남자아기 p50 기준: 0개월=3.3kg, 매달 +0.7kg
    p50_w = 3.3 + age_months * 0.7
    p3_w = p50_w * 0.75
    p97_w = p50_w * 1.3
    if weight_kg:
        if weight_kg < p3_w: percentile_w = "<3"
        elif weight_kg < p50_w: percentile_w = "3~50"
        elif weight_kg < p97_w: percentile_w = "50~97"
        else: percentile_w = ">97"
    else:
        percentile_w = None

    return {
        "age_months": age_months,
        "weight": {"value": weight_kg, "percentile": percentile_w, "p50": p50_w},
    }


# ---------------------------------------------------------------------------
# 라우터 — 사진 앨범 (M2)
# ---------------------------------------------------------------------------

@app.get("/api/albums")
async def get_albums(baby_id: str = None, user: User = Depends(get_current_user)):
    db = get_current_db()
    q = db.query(PhotoAlbum).filter(PhotoAlbum.user_id == user.id)
    if baby_id:
        q = q.filter(PhotoAlbum.baby_id == baby_id)
    q = q.order_by(PhotoAlbum.created_at.desc())
    items = q.all()
    db.close()
    return [{"id": a.id, "title": a.title, "cover_path": a.cover_path,
             "created_at": a.created_at.isoformat(), "is_special": a.is_special}
            for a in items]


@app.post("/api/albums")
async def create_album(data: dict, user: User = Depends(get_current_user)):
    db = get_current_db()
    a = PhotoAlbum(
        baby_id=data.get("baby_id"),
        user_id=user.id,
        title=data["title"],
        description=data.get("description"),
        is_special=data.get("is_special", False),
        special_date=datetime.datetime.strptime(data["special_date"], "%Y-%m-%d") if data.get("special_date") else None,
    )
    db.add(a)
    db.commit()
    db.close()
    return {"id": a.id, "message": "앨범 생성 완료"}


@app.post("/api/photos/upload")
async def upload_photo(
    album_id: str = Form(None),
    baby_id: str = Form(...),
    caption: str = Form(""),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
):
    ext = Path(file.filename).suffix if file.filename else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / "photos" / filename
    content = await file.read()
    path.write_bytes(content)
    thumb_path = UPLOAD_DIR / "photos" / f"{uuid.uuid4().hex}_thumb{ext}"
    #썸네일 생성 (간단하게 복사)
    thumb_path.write_bytes(content[:min(10000, len(content))])

    db = get_current_db()
    baby = db.query(Baby).filter(Baby.id == baby_id).first()
    age = calc_age(baby.birthdate) if baby else {"total_months": 0}
    p = Photo(
        album_id=album_id,
        baby_id=baby_id,
        user_id=user.id,
        file_path=str(path),
        thumbnail_path=str(thumb_path),
        caption=caption,
        month_age=age.get("total_months", 0),
        date=datetime.datetime.now(),
        tags=json.dumps(["baby", "photo"]),
    )
    db.add(p)
    db.commit()
    db.close()
    return {"id": p.id, "path": str(path), "message": "사진 업로드 완료"}


@app.get("/api/photos/{baby_id}")
async def get_photos(baby_id: str, user: User = Depends(get_current_user)):
    db = get_current_db()
    photos = db.query(Photo).filter(Photo.baby_id == baby_id, Photo.user_id == user.id).order_by(Photo.date.desc()).all()
    db.close()
    return [{"id": p.id, "thumbnail_path": p.thumbnail_path, "caption": p.caption,
             "date": p.date.isoformat(), "month_age": p.month_age} for p in photos]


@app.post("/api/photos/{photo_id}/like")
async def like_photo(photo_id: str, user: User = Depends(get_current_user)):
    db = get_current_db()
    p = db.query(Photo).filter(Photo.id == photo_id).first()
    if p:
        p.liked = not p.liked
        db.commit()
    db.close()
    return {"liked": p.liked if p else False}


# ---------------------------------------------------------------------------
# 라우터 — 가족 공유 (M3)
# ---------------------------------------------------------------------------

@app.post("/api/family/invite")
async def invite_family(data: FamilyInvite, baby_id: str, user: User = Depends(get_current_user)):
    db = get_current_db()
    code = secrets.token_hex(5).upper()[:6]
    # 기존 family_code 확인
    existing = db.query(FamilyMember).filter(FamilyMember.family_code == code).first()
    if existing:
        code = secrets.token_hex(5).upper()[:6]
    fam = FamilyMember(
        family_code=code,
        user_id=user.id,
        baby_id=baby_id,
        name=data.name,
        relationship=data.relationship,
        role=data.role,
    )
    db.add(fam)
    db.commit()
    db.close()
    return {"family_code": code, "message": "초대장 전송 완료"}


@app.get("/api/family/{family_code}/members")
async def get_family_members(family_code: str):
    db = get_current_db()
    members = db.query(FamilyMember).filter(FamilyMember.family_code == family_code).all()
    db.close()
    return [{"id": m.id, "name": m.name, "relationship": m.relationship,
             "role": m.role, "joined_at": m.joined_at.isoformat()} for m in members]


@app.get("/api/family/{family_code}/activity")
async def get_family_activity(family_code: str, days: int = 7):
    db = get_current_db()
    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
    activities = db.query(FamilyActivity).filter(
        FamilyActivity.family_code == family_code,
        FamilyActivity.created_at >= cutoff,
    ).order_by(FamilyActivity.created_at.desc()).all()
    db.close()
    return [{"id": a.id, "activity_type": a.activity_type, "content": a.content,
             "photo_path": a.photo_path, "comments": a.comments, "likes": a.likes,
             "created_at": a.created_at.isoformat()} for a in activities]


@app.post("/api/family/{family_code}/activity")
async def post_activity(data: dict, family_code: str, user: User = Depends(get_current_user)):
    db = get_current_db()
    a = FamilyActivity(
        family_code=family_code,
        user_id=user.id,
        baby_id=data.get("baby_id", ""),
        activity_type=data.get("type", "photo"),
        content=data.get("content"),
        comments=[],
        likes=[],
    )
    db.add(a)
    db.commit()
    db.close()
    return {"id": a.id, "message": "활동 기록 완료"}


# ---------------------------------------------------------------------------
# 라우터 — 커머스 · 쇼핑가이드 (M4)
# ---------------------------------------------------------------------------

def _shopping_top2_products(products: list) -> list:
    """상품군별 1·2위만 반환"""
    out = []
    for prod in products:
        items = sorted(prod.get("items", []), key=lambda x: x.get("rank", 99))[:2]
        out.append({
            "key": prod.get("key"),
            "label": prod.get("label"),
            "items": items,
        })
    return out


@app.get("/api/shopping-guide/keywords")
async def shopping_guide_keywords(user: User = Depends(get_current_user)):
    """키워드(기본템·수유·모로반사 등) 목록"""
    guide = _load_shopping_guide()
    return {
        "keywords": [{"key": k["key"], "label": k["label"]} for k in guide.get("keywords", [])],
        "updated_at": guide.get("updated_at"),
        "disclaimer": guide.get("disclaimer"),
    }


@app.get("/api/shopping-guide/months")
async def shopping_guide_months(user: User = Depends(get_current_user)):
    """하위 호환 — keywords와 동일"""
    return await shopping_guide_keywords(user)


def _load_finance_guide() -> dict:
    if not FINANCE_GUIDE_PATH.exists():
        return {}
    with open(FINANCE_GUIDE_PATH, encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/finance-guide")
async def finance_guide(user: User = Depends(get_current_user)):
    """금융 가이드 — 보험·증권·은행 TOP3 + 증여신고 안내"""
    guide = _load_finance_guide()
    if not guide:
        raise HTTPException(status_code=404, detail="금융 가이드 데이터가 없습니다")
    return guide


@app.get("/api/shopping-guide")
async def shopping_guide(keyword: str = "basic", month: str = None, user: User = Depends(get_current_user)):
    """키워드별 상품 안내 (상품군당 1·2위)"""
    guide = _load_shopping_guide()
    key = keyword
    if month and not guide.get("keywords"):
        key = month
    kw_data = next((k for k in guide.get("keywords", []) if k["key"] == key), None)
    if not kw_data:
        raise HTTPException(status_code=404, detail="해당 키워드 데이터가 없습니다")
    return {
        "keyword": kw_data["key"],
        "label": kw_data["label"],
        "products": _shopping_top2_products(kw_data.get("products", [])),
        "updated_at": guide.get("updated_at"),
        "disclaimer": guide.get("disclaimer"),
    }


@app.get("/api/products")
async def list_products(
    category: str = None,
    month: int = None,
    user: User = Depends(get_current_user),
):
    """기존 Product 테이블 목록"""
    db = get_current_db()
    q = db.query(Product)
    if category:
        q = q.filter(Product.category == category)
    products = q.limit(50).all()
    out = []
    for p in products:
        if month is not None and p.suitable_months and month not in p.suitable_months:
            continue
        out.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "category": p.category,
            "suitable_months": p.suitable_months,
            "rating": p.rating,
            "review_count": p.review_count,
        })
    db.close()
    return out


@app.post("/api/admin/commerce/sync")
async def admin_commerce_sync(
    keyword: str,
    user: User = Depends(get_current_user),
):
    """Phase 2: 쿠팡·네이버 API 조회 (키 설정 시)"""
    from services.commerce_sync import sync_category_top3

    return sync_category_top3(keyword)


# ---------------------------------------------------------------------------
# 라우터 — 출산택일 · 작명 (M5)
# ---------------------------------------------------------------------------

@app.get("/api/fortune/parents")
async def get_fortune_parents(user: User = Depends(get_current_user)):
    db = get_current_db()
    parents = _parent_profiles_dict(db, user.id)
    db.close()
    return {"parents": parents}


@app.put("/api/fortune/parents")
async def save_fortune_parents(
    body: ParentProfilesUpdate,
    user: User = Depends(get_current_user),
):
    db = get_current_db()
    db.query(ParentProfile).filter(ParentProfile.user_id == user.id).delete()
    for p in body.parents:
        if not p.name or not p.birth_date:
            continue
        db.add(ParentProfile(
            user_id=user.id,
            role=p.role,
            name=p.name,
            name_hanja=(p.name_hanja or "").strip() or None,
            birth_date=p.birth_date,
            birth_time=p.birth_time,
            calendar_type=p.calendar_type,
            birth_place=p.birth_place,
        ))
    db.commit()
    db.close()
    return {"message": "저장되었습니다"}


@app.get("/api/fortune/shi-chen")
async def fortune_shi_chen(user: User = Depends(get_current_user)):
    from services.fortune_constants import SHI_CHEN
    return {"items": SHI_CHEN}


@app.get("/api/fortune/hanja-lookup")
async def fortune_hanja_lookup(
    name: str,
    saved_hanja: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    from services.hanja_lookup import lookup_name_hanja
    return lookup_name_hanja(name, saved_hanja=saved_hanja or None)


@app.post("/api/fortune/birthday")
async def fortune_birthday(
    body: FortuneBirthdayIn,
    user: User = Depends(get_current_user),
):
    db = get_current_db()
    if _fortune_reports_today(db, user.id) >= FORTUNE_DAILY_LIMIT:
        db.close()
        raise HTTPException(status_code=429, detail="오늘 분석 횟수(3회)를 초과했습니다")
    parents = _parent_profiles_dict(db, user.id)
    try:
        _validate_fortune_parents(parents)
    except HTTPException:
        db.close()
        raise
    from services.fortune_llm import analyze_birthday

    payload = body.model_dump()
    result = analyze_birthday(parents, payload)
    rec = FortuneReport(
        user_id=user.id,
        report_type="birthday",
        input_json={"parents": parents, "request": payload},
        result_json=result,
    )
    db.add(rec)
    db.commit()
    report_id = rec.id
    db.close()
    return {"id": report_id, "result": result}


@app.post("/api/fortune/naming")
async def fortune_naming(
    body: FortuneNamingIn,
    user: User = Depends(get_current_user),
):
    db = get_current_db()
    if _fortune_reports_today(db, user.id) >= FORTUNE_DAILY_LIMIT:
        db.close()
        raise HTTPException(status_code=429, detail="오늘 분석 횟수(3회)를 초과했습니다")
    parents = _parent_profiles_dict(db, user.id)
    try:
        _validate_fortune_parents(parents)
    except HTTPException:
        db.close()
        raise
    from services.fortune_llm import analyze_naming

    payload = body.model_dump()
    result = analyze_naming(parents, payload)
    rec = FortuneReport(
        user_id=user.id,
        report_type="naming",
        input_json={"parents": parents, "request": payload},
        result_json=result,
    )
    db.add(rec)
    db.commit()
    report_id = rec.id
    db.close()
    return {"id": report_id, "result": result}


@app.get("/api/fortune/reports")
async def fortune_reports(
    report_type: str = None,
    limit: int = 10,
    user: User = Depends(get_current_user),
):
    db = get_current_db()
    q = db.query(FortuneReport).filter(FortuneReport.user_id == user.id)
    if report_type:
        q = q.filter(FortuneReport.report_type == report_type)
    rows = q.order_by(FortuneReport.created_at.desc()).limit(limit).all()
    out = [
        {
            "id": r.id,
            "report_type": r.report_type,
            "result": r.result_json,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    db.close()
    return out


# ---------------------------------------------------------------------------
# 라우터 — AI 이미지 생성 (M5)
# ---------------------------------------------------------------------------

@app.get("/ai-images/generate")
async def generate_ai_image(
    prompt: str,
    style: str = "cartoon",
    template: str = None,
    user: User = Depends(get_current_user),
    baby_id: str = None,
):
    """AI 이미지 생성 (데모: 랜덤 색상 캔버스)"""
    # 실제 구현에서는 DALL-E, Stable Diffusion, 또는 국내 AI API 연동
    styles = {
        "cartoon": "🎨",
        "chibi": "🧸",
        "ghibli": "🌿",
        "pixar": "🎬",
        "hanbok": "👘",
    }
    style_emoji = styles.get(style, "🎨")

    # 크레딧 차감 확인
    db = get_current_db()
    credits = db.query(UserCredits).filter(UserCredits.user_id == user.id).first()
    if not credits:
        credits = UserCredits(user_id=user.id, total_credits=5)
        db.add(credits)
    if credits.total_credits - credits.used_this_month <= 0 and user.subscription != "pro":
        db.close()
        return JSONResponse({"error": "크레딧이 부족합니다. Pro 구독으로 업그레이드하세요"}, status_code=402)

    output_path = str(UPLOAD_DIR / "images" / f"{uuid.uuid4().hex}.png")

    # 데모: 색상 캔버스 생성
    import io
    from PIL import Image, ImageDraw, ImageFont
    try:
        img = Image.new("RGB", (512, 512), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        # 배경 그라데이션
        for y in range(512):
            r = int(255 * y / 512)
            g = int(200 + 55 * (1 - y / 512))
            b = int(150 - 50 * y / 512)
            draw.line([(0, y), (512, y)], fill=(r, g, b))
        # 텍스트
        draw.text((100, 200), f"{style_emoji} {template or 'AI 이미지'}", fill=(255, 255, 255))
        draw.text((100, 260), prompt[:40], fill=(0, 0, 0))
        img.save(output_path)
    except Exception:
        # PIL 없으면 빈 파일
        Path(output_path).touch()

    img_rec = AIImage(
        user_id=user.id,
        baby_id=baby_id,
        prompt=prompt,
        style=style,
        template=template,
        output_path=output_path,
        credit_cost=3,
    )
    db.add(img_rec)
    credits.used_this_month += 1
    db.commit()
    db.close()

    return {
        "id": img_rec.id,
        "output_path": output_path,
        "prompt": prompt,
        "style": style,
        "message": "AI 이미지 생성 완료",
    }


@app.get("/api/credits")
async def get_credits(user: User = Depends(get_current_user)):
    db = get_current_db()
    credits = db.query(UserCredits).filter(UserCredits.user_id == user.id).first()
    if not credits:
        credits = UserCredits(user_id=user.id, total_credits=5 if user.subscription == "free" else 50)
        db.add(credits)
        db.commit()
    db.close()
    return {
        "total": credits.total_credits,
        "used": credits.used_this_month,
        "remaining": credits.total_credits - credits.used_this_month,
    }



# ---------------------------------------------------------------------------
# 라우터 — 발달 가이드 (M6)
# ---------------------------------------------------------------------------

@app.get("/api/playguides")
async def get_playguides(month: int = None, category: str = None):
    db = get_current_db()
    q = db.query(PlayGuide)
    if month is not None:
        q = q.filter(PlayGuide.suitable_months.contains(month))
    if category:
        q = q.filter(PlayGuide.category == category)
    items = q.all()
    db.close()
    return [{"id": pg.id, "title": pg.title, "description": pg.description,
             "suitable_months": pg.suitable_months, "category": pg.category,
             "difficulty": pg.difficulty, "material_needed": pg.material_needed,
             "duration_min": pg.duration_min} for pg in items]


@app.post("/api/playguides")
async def create_playguide(data: PlayGuideCreate):
    db = get_current_db()
    pg = PlayGuide(
        title=data.title,
        description=data.description,
        suitable_months=data.suitable_months or [],
        category=data.category,
        difficulty=data.difficulty,
        material_needed=data.material_needed,
        duration_min=data.duration_min,
    )
    db.add(pg)
    db.commit()
    db.close()
    return {"id": pg.id, "message": "놀이 가이드 등록 완료"}


@app.post("/api/playlogs")
async def create_playlog(data: dict, user: User = Depends(get_current_user)):
    db = get_current_db()
    log = PlayLog(
        baby_id=data["baby_id"],
        user_id=user.id,
        guide_id=data.get("guide_id"),
        title=data["title"],
        content=data.get("content"),
        baby_reaction=data.get("baby_reaction", "😊"),
        duration_min=data.get("duration_min", 0),
    )
    db.add(log)
    db.commit()
    db.close()
    return {"id": log.id, "message": "놀이 기록 완료"}


@app.get("/api/diet-guides")
async def get_diet_guides(month: int = None):
    """이유식 가이드"""
    db = get_current_db()
    if month is None or month < 5:
        db.close()
        return {"message": "이유식은 만 5개월부터 시작하세요", "recipes": []}
    db.close()

    recipes_by_month = {
        5: [{"name": "미음 1단계", "ingredients": ["쌀 1스푼", "물 5스푼"], "steps": "끓이는 물에 쌀 넣여 30분 익힘"}],
        6: [{"name": "채소 미음", "ingredients": ["미음 3스푼", "고구마 1스푼"], "steps": "고구마 삶아 으깨어 미음에 섞기"}],
        7: [{"name": "과일 죽", "ingredients": ["죽 3스푼", "바나나 1/4개"], "steps": "바나나 으깨어 죽에 섞기"}],
        8: [{"name": "두부 찌개", "ingredients": ["순두부 1스푼", "당근 1스푼", "물"], "steps": "당근 잘게 다져 물에 끓여 두부 추가"}],
        9: [{"name": "계란 노른자 죽", "ingredients": ["죽 3스푼", "계란 노른자 1개"], "steps": "계란 삶아 노른자 으깨어 죽에 섞기"}],
        10: [{"name": "닭고기 죽", "ingredients": ["죽 3스푼", "닭가슴살 1스푼", "당근 1스푼"], "steps": "닭고기 삶아 찢어 죽에 섞기"}],
    }
    recipes = recipes_by_month.get(month, recipes_by_month.get(6, []))
    return {"month": month, "recipes": recipes, "tip": f"만 {month}개월: 알레르기 테스트 후 진행하세요"}


# ---------------------------------------------------------------------------
# 라우터 — 금융 허브 (M7)
# ---------------------------------------------------------------------------

@app.get("/api/insurances")
async def get_insurances(user: User = Depends(get_current_user)):
    db = get_current_db()
    items = db.query(Insurance).filter(Insurance.user_id == user.id).all()
    db.close()
    return [{"id": i.id, "company": i.company, "plan_name": i.plan_name,
             "monthly_premium": i.monthly_premium, "status": i.status,
             "coverage": i.coverage} for i in items]


@app.post("/api/insurances")
async def create_insurance(data: InsuranceCreate, user: User = Depends(get_current_user)):
    db = get_current_db()
    ins = Insurance(
        user_id=user.id,
        baby_id=data.baby_id,
        company=data.company,
        plan_name=data.plan_name,
        start_date=datetime.datetime.strptime(data.start_date, "%Y-%m-%d"),
        monthly_premium=data.monthly_premium,
        coverage=data.coverage or {},
    )
    db.add(ins)
    db.commit()
    db.close()
    return {"id": ins.id, "message": "보험 등록 완료"}


@app.get("/api/bank-accounts")
async def get_bank_accounts(user: User = Depends(get_current_user)):
    db = get_current_db()
    items = db.query(BabyBankAccount).filter(BabyBankAccount.user_id == user.id).all()
    db.close()
    return [{"id": b.id, "bank_name": b.bank_name, "balance": b.balance,
             "savings_goal": b.savings_goal, "monthly_target": b.monthly_target,
             "progress": (b.balance / b.savings_goal * 100) if b.savings_goal else 0}
            for b in items]


@app.post("/api/bank-accounts")
async def create_bank_account(data: BankAccountCreate, user: User = Depends(get_current_user)):
    db = get_current_db()
    b = BabyBankAccount(
        user_id=user.id,
        baby_id=data.baby_id,
        bank_name=data.bank_name,
        savings_goal=data.savings_goal,
        monthly_target=data.monthly_target,
    )
    db.add(b)
    db.commit()
    db.close()
    return {"id": b.id, "message": "아이 통장 개설 완료"}


@app.post("/api/transactions")
async def create_transaction(data: TransactionCreate, user: User = Depends(get_current_user)):
    db = get_current_db()
    tx = BankTransaction(
        account_id=data.account_id,
        user_id=user.id,
        amount=data.amount,
        type=data.type,
        category=data.category,
        memo=data.memo,
    )
    db.add(tx)

    # 잔액 업데이트
    acc = db.query(BabyBankAccount).filter(BabyBankAccount.id == data.account_id).first()
    if acc:
        if data.type == "deposit":
            acc.balance += data.amount
        else:
            acc.balance -= data.amount
    db.commit()
    db.close()
    return {"id": tx.id, "message": "거래 기록 완료", "new_balance": acc.balance if acc else 0}


@app.get("/api/transactions/{account_id}")
async def get_transactions(account_id: str):
    db = get_current_db()
    txs = db.query(BankTransaction).filter(BankTransaction.account_id == account_id).order_by(
        BankTransaction.created_at.desc()
    ).all()
    db.close()
    return [{"id": t.id, "amount": t.amount, "type": t.type, "category": t.category,
             "memo": t.memo, "created_at": t.created_at.isoformat()} for t in txs]


@app.get("/api/gift-plan")
async def get_gift_plan(user: User = Depends(get_current_user)):
    db = get_current_db()
    plan = db.query(GiftPlan).filter(GiftPlan.user_id == user.id).first()
    if not plan:
        plan = GiftPlan(user_id=user.id)
        db.add(plan)
        db.commit()
    timeline = db.query(GiftTimeline).filter(GiftTimeline.plan_id == plan.id).order_by(
        GiftTimeline.date.desc()
    ).all()
    result = {
        "plan": {"total_amount": plan.total_amount, "yearly_amount": plan.yearly_amount,
                 "years_planned": plan.years_planned, "completed_years": plan.completed_years},
        "timeline": [{"date": t.date.isoformat(), "amount": t.amount} for t in timeline],
    }
    db.close()
    return result


@app.post("/api/gift-plan/record")
async def record_gift(data: dict, user: User = Depends(get_current_user)):
    db = get_current_db()
    plan = db.query(GiftPlan).filter(GiftPlan.user_id == user.id).first()
    if not plan:
        plan = GiftPlan(user_id=user.id)
        db.add(plan)
        db.commit()
    gt = GiftTimeline(
        plan_id=plan.id,
        date=datetime.datetime.strptime(data["date"], "%Y-%m-%d"),
        amount=data["amount"],
    )
    db.add(gt)
    db.commit()
    db.close()
    return {"message": "증여 기록 완료"}


# ---------------------------------------------------------------------------
# 홈 대시보드 v2 — 집계 헬퍼
# ---------------------------------------------------------------------------

def _pct_range_status(pct: Optional[float]) -> str:
    if pct is None:
        return "unknown"
    if pct < 3 or pct > 97:
        return "warning"
    if pct < 15 or pct > 85:
        return "caution"
    return "good"


def _growth_birth_value(baby, growths, attr: str, ref_table: dict) -> float:
    """출생 시점 키/몸무게 — 당일 기록 우선, 없으면 WHO P50(0개월)"""
    birth_date = baby.birthdate.date()
    for g in growths:
        if g.date.date() == birth_date:
            v = getattr(g, attr)
            if v is not None:
                return round(v, 1 if attr == "height_cm" else 2)
    return round(ref_table["p50"][0], 1 if attr == "height_cm" else 2)


def _growth_spark_series(baby, growths, attr: str, ref_table: dict) -> list:
    """차트 첫 점 = 출생, 이후 성장 기록 (최대 8점)"""
    birth_v = _growth_birth_value(baby, growths, attr, ref_table)
    series = [birth_v]
    eps = 0.05 if attr == "weight_kg" else 0.2
    for g in growths:
        v = getattr(g, attr)
        if v is None:
            continue
        v = round(v, 1 if attr == "height_cm" else 2)
        if abs(series[-1] - v) > eps:
            series.append(v)
    if len(series) == 1 and growths:
        last_g = growths[-1]
        v = getattr(last_g, attr)
        if v is not None:
            v = round(v, 1 if attr == "height_cm" else 2)
            if abs(series[0] - v) > eps:
                series.append(v)
    return series[-8:]


def _who_daily_refs(months: int) -> dict:
    if months < 1:
        f_ref = {"min": 400, "max": 600, "avg": 500}
    elif months < 2:
        f_ref = {"min": 500, "max": 750, "avg": 620}
    elif months < 4:
        f_ref = {"min": 600, "max": 900, "avg": 750}
    elif months < 6:
        f_ref = {"min": 700, "max": 1000, "avg": 850}
    elif months < 9:
        f_ref = {"min": 500, "max": 800, "avg": 650}
    elif months < 12:
        f_ref = {"min": 350, "max": 600, "avg": 480}
    else:
        f_ref = {"min": 300, "max": 500, "avg": 400}

    if months < 4:
        s_ref = {"min": 14.0, "max": 17.0, "avg": 15.5}
    elif months < 12:
        s_ref = {"min": 12.0, "max": 16.0, "avg": 14.0}
    else:
        s_ref = {"min": 11.0, "max": 14.0, "avg": 12.5}
    return {"feeding": f_ref, "sleep": s_ref}


def _who_daily_comment(metric: str, val: float, ref: dict) -> dict:
    mn, mx = ref["min"], ref["max"]
    if metric == "feeding":
        if val < mn * 0.8:
            return {"level": "warning", "icon": "⚠️", "text": f"수유량이 권장({mn}~{mx}ml)보다 많이 부족합니다."}
        if val < mn:
            return {"level": "caution", "icon": "💛", "text": f"수유량({val}ml)이 권장 최솟값보다 적습니다."}
        if val <= mx:
            return {"level": "good", "icon": "✅", "text": f"수유량이 권장 범위({mn}~{mx}ml) 내입니다."}
        return {"level": "caution", "icon": "💛", "text": f"수유량({val}ml)이 권장 최댓값을 초과합니다."}
    if val < mn:
        return {"level": "caution", "icon": "💛", "text": f"수면({val:.1f}h)이 권장 최솟값({mn}h)보다 적습니다."}
    if val <= mx:
        return {"level": "good", "icon": "✅", "text": f"수면({val:.1f}h)이 권장 범위 내입니다."}
    return {"level": "good", "icon": "✅", "text": f"수면({val:.1f}h)이 충분합니다."}


def _build_home_extras(db: Session, baby: Baby, user_id: str) -> dict:
    """홈 v2용: 오늘 라이브·성장 리포트·이슈·코칭·마일스톤 미리보기"""
    now = datetime.datetime.now()
    today = datetime.date.today()
    age = calc_age(baby.birthdate)
    months = age["total_months"]

    feedings_today = db.query(Feeding).filter(
        Feeding.baby_id == baby.id,
        sql_func.date(Feeding.start_time) == today,
    ).order_by(Feeding.start_time.desc()).all()
    sleeps_today = db.query(Sleep).filter(
        Sleep.baby_id == baby.id,
        sql_func.date(Sleep.start_time) == today,
    ).all()
    bowels_today = db.query(Bowel).filter(
        Bowel.baby_id == baby.id,
        sql_func.date(Bowel.time) == today,
    ).all()

    last_feeding = db.query(Feeding).filter(Feeding.baby_id == baby.id).order_by(
        Feeding.start_time.desc()
    ).first()
    last_sleep = db.query(Sleep).filter(Sleep.baby_id == baby.id).order_by(
        Sleep.start_time.desc()
    ).first()
    last_bowel = db.query(Bowel).filter(Bowel.baby_id == baby.id).order_by(
        Bowel.time.desc()
    ).first()

    last_feeding_min = None
    if last_feeding:
        last_feeding_min = int((now - last_feeding.start_time).total_seconds() / 60)

    last_sleep_min = None
    if last_sleep and last_sleep.end_time:
        last_sleep_min = int((now - last_sleep.end_time).total_seconds() / 60)

    last_bowel_min = None
    if last_bowel:
        last_bowel_min = int((now - last_bowel.time).total_seconds() / 60)

    diaper_count, stool_count = _diaper_stool_counts(bowels_today)

    today_live = {
        "feeding_count": len(feedings_today),
        "feeding_total_ml": round(sum(f.amount_ml or 0 for f in feedings_today), 1),
        "sleep_count": len(sleeps_today),
        "sleep_total_min": round(sum(s.duration_min or 0 for s in sleeps_today), 1),
        "bowel_count": len(bowels_today),
        "diaper_count": diaper_count,
        "stool_count": stool_count,
        "last_feeding_min": last_feeding_min,
        "last_sleep_min": last_sleep_min,
        "last_bowel_min": last_bowel_min,
    }

    gender = baby.gender or "male"
    w_table = WHO_BOYS_WEIGHT if gender == "male" else WHO_GIRLS_WEIGHT
    h_table = WHO_BOYS_HEIGHT if gender == "male" else WHO_GIRLS_HEIGHT
    hc_table = WHO_BOYS_HEAD if gender == "male" else WHO_GIRLS_HEAD

    growths = db.query(Growth).filter(Growth.baby_id == baby.id).order_by(Growth.date.asc()).all()
    latest_weight_pct = latest_height_pct = latest_head_pct = None
    last_g = growths[-1] if growths else None

    for g in growths:
        m = min(int((g.date - baby.birthdate).days / 30), 24)
        if g.weight_kg:
            latest_weight_pct = _calc_percentile_rank(g.weight_kg, m, w_table)
        if g.height_cm:
            latest_height_pct = _calc_percentile_rank(g.height_cm, m, h_table)
        if g.head_circumference_cm:
            hc_tbl = {"p3": hc_table["p3"], "p15": hc_table["p3"], "p50": hc_table["p50"],
                      "p85": hc_table["p97"], "p97": hc_table["p97"]}
            latest_head_pct = _calc_percentile_rank(g.head_circumference_cm, m, hc_tbl)

    spark_height = _growth_spark_series(baby, growths, "height_cm", h_table)
    spark_weight = _growth_spark_series(baby, growths, "weight_kg", w_table)
    birth_height_cm = spark_height[0] if spark_height else None
    birth_weight_kg = spark_weight[0] if spark_weight else None

    growth_report = {
        "date": last_g.date.isoformat() if last_g else None,
        "weight_kg": last_g.weight_kg if last_g else None,
        "height_cm": last_g.height_cm if last_g else None,
        "head_cm": last_g.head_circumference_cm if last_g else None,
        "birth_height_cm": birth_height_cm,
        "birth_weight_kg": birth_weight_kg,
        "weight_pct": round(latest_weight_pct, 1) if latest_weight_pct is not None else None,
        "height_pct": round(latest_height_pct, 1) if latest_height_pct is not None else None,
        "head_pct": round(latest_head_pct, 1) if latest_head_pct is not None else None,
        "weight_status": _pct_range_status(latest_weight_pct),
        "height_status": _pct_range_status(latest_height_pct),
        "spark_height": spark_height,
        "spark_weight": spark_weight,
    }

    issues = []
    next_vacc = db.query(Vaccination).filter(
        Vaccination.baby_id == baby.id,
        Vaccination.status == "scheduled",
    ).order_by(Vaccination.scheduled_date.asc()).first()

    if next_vacc:
        days_until = (next_vacc.scheduled_date.date() - today).days
        if days_until < 0:
            issues.append({
                "level": "warning", "icon": "💉", "text": f"예방접종 지연: {next_vacc.name}",
                "page": "vaccination",
            })
        elif days_until <= 7:
            label = "오늘" if days_until == 0 else f"D-{days_until}"
            issues.append({
                "level": "caution" if days_until > 0 else "warning",
                "icon": "💉",
                "text": f"{label} {next_vacc.name} 접종 예정",
                "page": "vaccination",
            })

    if months < 12 and last_feeding_min is not None and last_feeding_min >= 240:
        issues.append({
            "level": "caution", "icon": "🍼",
            "text": f"마지막 수유 후 {last_feeding_min // 60}시간 이상 경과",
            "page": "feeding",
        })

    refs = _who_daily_refs(months)
    week_f, week_s = [], []
    for i in range(7):
        day = today - datetime.timedelta(days=i)
        week_f.append(sum(f.amount_ml or 0 for f in db.query(Feeding).filter(
            Feeding.baby_id == baby.id, sql_func.date(Feeding.start_time) == day).all()))
        week_s.append(sum(s.duration_min or 0 for s in db.query(Sleep).filter(
            Sleep.baby_id == baby.id, sql_func.date(Sleep.start_time) == day).all()) / 60)
    avg_f = round(sum(week_f) / 7, 1)
    avg_s = round(sum(week_s) / 7, 2)
    f_cmt = _who_daily_comment("feeding", avg_f, refs["feeding"])
    s_cmt = _who_daily_comment("sleep", avg_s, refs["sleep"])
    for cmt, page in ((f_cmt, "record-stats"), (s_cmt, "record-stats")):
        if cmt["level"] in ("warning", "caution"):
            issues.append({"level": cmt["level"], "icon": cmt["icon"], "text": cmt["text"], "page": page})

    if latest_weight_pct is not None:
        wc = _growth_comment("weight", latest_weight_pct, months)
        if wc["level"] in ("warning", "caution"):
            issues.append({"level": wc["level"], "icon": wc["icon"], "text": wc["text"], "page": "growth"})
    if latest_height_pct is not None:
        hc = _growth_comment("height", latest_height_pct, months)
        if hc["level"] in ("warning", "caution"):
            issues.append({"level": hc["level"], "icon": hc["icon"], "text": hc["text"], "page": "growth"})

    issues = issues[:3]

    if issues:
        coaching = {
            "tone": issues[0]["level"],
            "message": issues[0]["text"] + " 자세한 내용을 확인해 보세요.",
            "cta": "확인하기",
            "cta_page": issues[0]["page"],
        }
    elif growth_report["height_status"] == "good" or growth_report["weight_status"] == "good":
        coaching = {
            "tone": "good",
            "message": f"{baby.name}이(가) 평균보다 잘 크고 있어요! 터치하면 더 자세한 발달 팁을 확인하세요.",
            "cta": "더 알아보기",
            "cta_page": "playguides",
        }
    else:
        coaching = {
            "tone": "good",
            "message": f"{baby.name}이의 오늘도 함께 기록해요. 꾸준한 기록이 성장 인사이트를 만들어요.",
            "cta": "기록하기",
            "cta_page": "record-stats",
        }

    milestones = db.query(Milestone).filter(
        Milestone.baby_id == baby.id
    ).order_by(Milestone.achieved_date.desc()).limit(3).all()
    milestones_preview = [
        {"category": m.category, "description": m.description,
         "achieved_date": m.achieved_date.isoformat()}
        for m in milestones
    ]

    return {
        "greeting": f"{baby.name}이의 성장을 응원해요!",
        "today_live": today_live,
        "growth_report": growth_report,
        "issues": issues,
        "coaching": coaching,
        "milestones_preview": milestones_preview,
    }


# ---------------------------------------------------------------------------
# 라우터 — 대시보드 (전체 통합)
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
async def dashboard(user: User = Depends(get_current_user), baby_id: str = None):
    """전체 대시보드 데이터"""
    db = get_current_db()

    if baby_id:
        baby = db.query(Baby).filter(Baby.id == baby_id).first()
    else:
        baby = db.query(Baby).filter(Baby.user_id == user.id).first()

    if not baby:
        db.close()
        return {"message": "등록된 아기가 없습니다"}

    age = calc_age(baby.birthdate)

    # 오늘의 기록 요약
    today = datetime.date.today()
    today_feedings = db.query(Feeding).filter(
        Feeding.baby_id == baby.id,
        sql_func.date(Feeding.start_time) == today,
    ).all()
    today_sleeps = db.query(Sleep).filter(
        Sleep.baby_id == baby.id,
        sql_func.date(Sleep.start_time) == today,
    ).all()
    today_bowels = db.query(Bowel).filter(
        Bowel.baby_id == baby.id,
        sql_func.date(Bowel.time) == today,
    ).all()

    # 성장 최근 기록
    last_growth = db.query(Growth).filter(Growth.baby_id == baby.id).order_by(
        Growth.date.desc()
    ).first()

    # 다음 예방접종
    next_vacc = db.query(Vaccination).filter(
        Vaccination.baby_id == baby.id,
        Vaccination.status == "scheduled",
    ).order_by(Vaccination.scheduled_date.asc()).first()

    # 가족 활동
    family_code = db.query(FamilyMember).filter(
        FamilyMember.user_id == user.id
    ).first()
    fam_code = family_code.family_code if family_code else None

    home_extras = _build_home_extras(db, baby, user.id)

    db.close()

    return {
        "baby": {
            "name": baby.name,
            "gender": baby.gender,
            "age": age,
            "profile_photo": _baby_photo_url(baby.profile_photo),
        },
        "today": {
            "feedings": len(today_feedings),
            "sleeps": len(today_sleeps),
            "bowels": len(today_bowels),
        },
        "last_growth": {
            "date": last_growth.date.isoformat() if last_growth else None,
            "weight": last_growth.weight_kg if last_growth else None,
            "height": last_growth.height_cm if last_growth else None,
            "head": last_growth.head_circumference_cm if last_growth else None,
        },
        "next_vaccination": {
            "name": next_vacc.name if next_vacc else None,
            "date": next_vacc.scheduled_date.isoformat() if next_vacc else None,
        },
        "family_code": fam_code,
        "cart_total": 0,
        **home_extras,
    }


# ---------------------------------------------------------------------------
# 베이비타임 벤치마크 — 통계·시각화 API
# ---------------------------------------------------------------------------

def _is_diaper_record(bowel) -> bool:
    """빠른 기저귀 기록(보통·노란색·메모 없음) = 기저귀, 그 외 = 대변"""
    return (
        bowel.type == "normal"
        and (bowel.color or "yellow") == "yellow"
        and not (bowel.notes or "").strip()
    )


def _diaper_stool_counts(bowels) -> tuple:
    diaper = sum(1 for b in bowels if _is_diaper_record(b))
    return diaper, len(bowels) - diaper


@app.get("/api/stats/today/{baby_id}")
async def stats_today(baby_id: str, user: User = Depends(get_current_user)):
    """오늘 하루 요약 통계 (수유 횟수·총량, 수면 총시간, 기저귀 횟수, 마지막 기록 경과)"""
    db = get_current_db()
    today = datetime.date.today()
    now = datetime.datetime.now()

    feedings = db.query(Feeding).filter(
        Feeding.baby_id == baby_id,
        sql_func.date(Feeding.start_time) == today,
    ).order_by(Feeding.start_time.desc()).all()

    sleeps = db.query(Sleep).filter(
        Sleep.baby_id == baby_id,
        sql_func.date(Sleep.start_time) == today,
    ).all()

    bowels = db.query(Bowel).filter(
        Bowel.baby_id == baby_id,
        sql_func.date(Bowel.time) == today,
    ).all()

    # 마지막 수유 경과 시간
    last_feeding_min = None
    if feedings:
        delta = now - feedings[0].start_time
        last_feeding_min = int(delta.total_seconds() / 60)

    # 마지막 수면 경과
    last_sleep = db.query(Sleep).filter(Sleep.baby_id == baby_id).order_by(Sleep.start_time.desc()).first()
    last_sleep_min = None
    if last_sleep and last_sleep.end_time:
        delta = now - last_sleep.end_time
        last_sleep_min = int(delta.total_seconds() / 60)

    # 총 수면 시간 (분)
    total_sleep_min = sum((s.duration_min or 0) for s in sleeps)
    # 총 수유량
    total_feeding_ml = sum((f.amount_ml or 0) for f in feedings)

    diaper_count, stool_count = _diaper_stool_counts(bowels)

    db.close()
    return {
        "feeding_count": len(feedings),
        "feeding_total_ml": total_feeding_ml,
        "sleep_count": len(sleeps),
        "sleep_total_min": total_sleep_min,
        "bowel_count": len(bowels),
        "diaper_count": diaper_count,
        "stool_count": stool_count,
        "last_feeding_min": last_feeding_min,
        "last_sleep_min": last_sleep_min,
    }


@app.get("/api/stats/timeline/{baby_id}")
async def stats_timeline(baby_id: str, date: str = None, user: User = Depends(get_current_user)):
    """특정 날짜의 24시간 타임라인 이벤트 목록"""
    db = get_current_db()
    if date:
        target = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target = datetime.date.today()

    events = []

    feedings = db.query(Feeding).filter(
        Feeding.baby_id == baby_id,
        sql_func.date(Feeding.start_time) == target,
    ).all()
    for f in feedings:
        events.append({
            "type": "feeding",
            "subtype": f.type,
            "start": f.start_time.isoformat(),
            "end": f.end_time.isoformat() if f.end_time else None,
            "label": f"{'모유' if f.type=='breast' else '분유'} {f.amount_ml:.0f}ml",
            "hour": f.start_time.hour,
            "minute": f.start_time.minute,
            "duration_min": f.duration_min or 15,
            "color": "#FF6B9D",
        })

    sleeps = db.query(Sleep).filter(
        Sleep.baby_id == baby_id,
        sql_func.date(Sleep.start_time) == target,
    ).all()
    for s in sleeps:
        events.append({
            "type": "sleep",
            "start": s.start_time.isoformat(),
            "end": s.end_time.isoformat() if s.end_time else None,
            "label": f"수면 {(s.duration_min or 0):.0f}분",
            "hour": s.start_time.hour,
            "minute": s.start_time.minute,
            "duration_min": s.duration_min or 60,
            "color": "#A78BFA",
        })

    bowels = db.query(Bowel).filter(
        Bowel.baby_id == baby_id,
        sql_func.date(Bowel.time) == target,
    ).all()
    for b in bowels:
        is_diaper = _is_diaper_record(b)
        label_parts = []
        if b.type:
            label_parts.append(b.type)
        if b.color:
            label_parts.append(b.color)
        notes = (b.notes or "").strip()
        if notes:
            label_parts.append(notes[:24])
        label = " · ".join(label_parts) if label_parts else ("기저귀" if is_diaper else "대변")
        events.append({
            "type": "diaper" if is_diaper else "stool",
            "start": b.time.isoformat(),
            "end": None,
            "label": label,
            "hour": b.time.hour,
            "minute": b.time.minute,
            "duration_min": 5,
            "color": "#38BDF8" if is_diaper else "#A16207",
        })

    events.sort(key=lambda x: x["start"])
    db.close()
    return {"date": target.isoformat(), "events": events}


@app.get("/api/stats/weekly/{baby_id}")
async def stats_weekly(baby_id: str, user: User = Depends(get_current_user)):
    """최근 7일 일별 통계 (수유량, 수면시간, 기저귀 횟수)"""
    db = get_current_db()
    result = []
    for i in range(6, -1, -1):
        day = datetime.date.today() - datetime.timedelta(days=i)
        feedings = db.query(Feeding).filter(
            Feeding.baby_id == baby_id,
            sql_func.date(Feeding.start_time) == day,
        ).all()
        sleeps = db.query(Sleep).filter(
            Sleep.baby_id == baby_id,
            sql_func.date(Sleep.start_time) == day,
        ).all()
        bowels = db.query(Bowel).filter(
            Bowel.baby_id == baby_id,
            sql_func.date(Bowel.time) == day,
        ).all()
        diaper_count, stool_count = _diaper_stool_counts(bowels)
        result.append({
            "date": day.isoformat(),
            "day_label": ["월","화","수","목","금","토","일"][day.weekday()],
            "feeding_ml": sum((f.amount_ml or 0) for f in feedings),
            "feeding_count": len(feedings),
            "sleep_min": sum((s.duration_min or 0) for s in sleeps),
            "bowel_count": len(bowels),
            "diaper_count": diaper_count,
            "stool_count": stool_count,
        })
    db.close()
    return result


@app.get("/api/stats/heatmap/{baby_id}")
async def stats_heatmap(baby_id: str, type: str = "feeding", days: int = 28, user: User = Depends(get_current_user)):
    """요일×시간대 히트맵 데이터 (0-6 요일, 0-23 시간대별 빈도)"""
    db = get_current_db()
    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)

    # 7×24 격자 초기화
    grid = [[0] * 24 for _ in range(7)]

    if type == "feeding":
        rows = db.query(Feeding).filter(
            Feeding.baby_id == baby_id,
            Feeding.start_time >= cutoff,
        ).all()
        for r in rows:
            grid[r.start_time.weekday()][r.start_time.hour] += 1

    elif type == "sleep":
        rows = db.query(Sleep).filter(
            Sleep.baby_id == baby_id,
            Sleep.start_time >= cutoff,
        ).all()
        for r in rows:
            grid[r.start_time.weekday()][r.start_time.hour] += 1

    elif type == "bowel":
        rows = db.query(Bowel).filter(
            Bowel.baby_id == baby_id,
            Bowel.time >= cutoff,
        ).all()
        for r in rows:
            grid[r.time.weekday()][r.time.hour] += 1

    db.close()
    return {
        "type": type,
        "days": days,
        "grid": grid,  # grid[요일 0~6][시간 0~23]
        "day_labels": ["월","화","수","목","금","토","일"],
    }


@app.get("/api/stats/pattern/{baby_id}")
async def stats_pattern(baby_id: str, user: User = Depends(get_current_user)):
    """패턴 분석: 평균 수유 간격, 평균 수유량, 평균 수면 시간, 야간 수유 횟수"""
    db = get_current_db()
    cutoff = datetime.datetime.now() - datetime.timedelta(days=7)

    feedings = db.query(Feeding).filter(
        Feeding.baby_id == baby_id,
        Feeding.start_time >= cutoff,
    ).order_by(Feeding.start_time.asc()).all()

    sleeps = db.query(Sleep).filter(
        Sleep.baby_id == baby_id,
        Sleep.start_time >= cutoff,
    ).all()

    # 평균 수유 간격 계산
    avg_interval_min = None
    if len(feedings) >= 2:
        intervals = []
        for i in range(1, len(feedings)):
            diff = (feedings[i].start_time - feedings[i-1].start_time).total_seconds() / 60
            if 30 < diff < 480:  # 30분~8시간 사이만 유효
                intervals.append(diff)
        if intervals:
            avg_interval_min = round(sum(intervals) / len(intervals))

    # 평균 수유량
    amounts = [f.amount_ml for f in feedings if f.amount_ml and f.amount_ml > 0]
    avg_amount_ml = round(sum(amounts) / len(amounts)) if amounts else 0

    # 야간 수유 (22시~06시)
    night_feedings = [f for f in feedings if f.start_time.hour >= 22 or f.start_time.hour < 6]
    night_per_day = round(len(night_feedings) / 7, 1)

    # 평균 수면 시간
    sleep_mins = [s.duration_min for s in sleeps if s.duration_min]
    avg_sleep_min = round(sum(sleep_mins) / len(sleep_mins)) if sleep_mins else 0

    # 총 일일 수면
    total_sleep_per_day = round(sum(sleep_mins) / 7) if sleep_mins else 0

    db.close()
    return {
        "avg_feeding_interval_min": avg_interval_min,
        "avg_feeding_amount_ml": avg_amount_ml,
        "avg_sleep_min": avg_sleep_min,
        "total_sleep_per_day_min": total_sleep_per_day,
        "night_feedings_per_day": night_per_day,
        "feeding_count_7days": len(feedings),
        "sleep_count_7days": len(sleeps),
    }


@app.post("/api/bowels/quick")
async def quick_bowel(baby_id: str, type: str = "normal", color: str = "yellow", user: User = Depends(get_current_user)):
    """원터치 기저귀 기록"""
    db = get_current_db()
    bowel = Bowel(
        baby_id=baby_id,
        user_id=user.id,
        time=datetime.datetime.now(),
        type=type,
        color=color,
    )
    db.add(bowel)
    db.commit()
    db.close()
    return {"id": bowel.id, "message": "기저귀 기록 완료", "time": bowel.time.isoformat()}


# ---------------------------------------------------------------------------
# 월간 통계 + WHO 유아 기준 API
# ---------------------------------------------------------------------------

@app.get("/api/stats/monthly/{baby_id}")
async def stats_monthly(baby_id: str, user: User = Depends(get_current_user)):
    """최근 30일 일별 통계 (수유량/수면/기저귀)"""
    db = get_current_db()
    today = datetime.date.today()
    result = []
    for i in range(29, -1, -1):
        day = today - datetime.timedelta(days=i)
        feedings = db.query(Feeding).filter(
            Feeding.baby_id == baby_id,
            sql_func.date(Feeding.start_time) == day).all()
        sleeps = db.query(Sleep).filter(
            Sleep.baby_id == baby_id,
            sql_func.date(Sleep.start_time) == day).all()
        bowels = db.query(Bowel).filter(
            Bowel.baby_id == baby_id,
            sql_func.date(Bowel.time) == day).all()
        diaper_count, stool_count = _diaper_stool_counts(bowels)
        result.append({
            "date": day.isoformat(),
            "day_label": f"{day.month}/{day.day}",
            "weekday": ["월","화","수","목","금","토","일"][day.weekday()],
            "feeding_ml": round(sum(f.amount_ml or 0 for f in feedings), 1),
            "feeding_count": len(feedings),
            "sleep_min": round(sum(s.duration_min or 0 for s in sleeps), 1),
            "sleep_hours": round(sum(s.duration_min or 0 for s in sleeps) / 60, 2),
            "bowel_count": len(bowels),
            "diaper_count": diaper_count,
            "stool_count": stool_count,
        })
    db.close()
    return result


@app.get("/api/stats/who-infant/{baby_id}")
async def stats_who_infant(baby_id: str, user: User = Depends(get_current_user)):
    """아기 개월수 기반 WHO·AAP·국내 기준 수유·수면 권장 범위"""
    db = get_current_db()
    baby = db.query(Baby).filter(Baby.id == baby_id).first()
    db.close()
    if not baby:
        return JSONResponse({"error": "아기를 찾을 수 없습니다"}, status_code=404)

    age = calc_age(baby.birthdate)
    m = age["total_months"]

    # ─ WHO/대한소아과학회 권장 일일 수유량 (ml/day) ─────────────────
    # 출처: WHO Infant Feeding, 대한소아과학회 영유아 검진 가이드라인
    if m < 1:
        f_ref = {"min": 400, "max": 600, "avg": 500,
                 "label": "출생~1개월", "source": "대한소아과학회"}
    elif m < 2:
        f_ref = {"min": 500, "max": 750, "avg": 620,
                 "label": "1개월", "source": "대한소아과학회"}
    elif m < 4:
        f_ref = {"min": 600, "max": 900, "avg": 750,
                 "label": "2~3개월", "source": "WHO/대한소아과학회"}
    elif m < 6:
        f_ref = {"min": 700, "max": 1000, "avg": 850,
                 "label": "4~5개월", "source": "WHO/대한소아과학회"}
    elif m < 9:
        f_ref = {"min": 500, "max": 800, "avg": 650,
                 "label": "6~8개월 (수유+이유식)", "source": "WHO"}
    elif m < 12:
        f_ref = {"min": 350, "max": 600, "avg": 480,
                 "label": "9~11개월 (수유+이유식)", "source": "WHO"}
    else:
        f_ref = {"min": 300, "max": 500, "avg": 400,
                 "label": "12개월 이상", "source": "WHO/UNICEF"}

    # ─ WHO·NSF 권장 수면 시간 (시간/day) ──────────────────────────
    # 출처: WHO 2019 Sleep Guidelines, National Sleep Foundation
    if m < 4:
        s_ref = {"min": 14.0, "max": 17.0, "avg": 15.5,
                 "label": "0~3개월 권장 수면", "source": "WHO/NSF 2019"}
    elif m < 12:
        s_ref = {"min": 12.0, "max": 16.0, "avg": 14.0,
                 "label": "4~11개월 권장 수면", "source": "WHO/NSF 2019"}
    else:
        s_ref = {"min": 11.0, "max": 14.0, "avg": 12.5,
                 "label": "12~24개월 권장 수면", "source": "WHO/NSF 2019"}

    # ─ 기저귀 참고 (횟수/day) ─────────────────────────────────────
    if m < 2:
        b_ref = {"min": 6, "max": 10, "avg": 8, "label": "신생아 기저귀", "source": "대한소아과학회"}
    elif m < 6:
        b_ref = {"min": 4, "max": 8,  "avg": 6, "label": "2~5개월 기저귀", "source": "대한소아과학회"}
    else:
        b_ref = {"min": 3, "max": 6,  "avg": 5, "label": "6개월+ 기저귀",  "source": "대한소아과학회"}

    if m < 2:
        stool_ref = {"min": 2, "max": 6, "avg": 4, "label": "신생아 대변 참고", "source": "육아 참고"}
    elif m < 6:
        stool_ref = {"min": 1, "max": 4, "avg": 2, "label": "영아 대변 참고", "source": "육아 참고"}
    else:
        stool_ref = {"min": 0.5, "max": 3, "avg": 1.5, "label": "대변 빈도 참고", "source": "육아 참고"}

    # ─ 최근 7일 평균 계산 ─────────────────────────────────────────
    db2 = get_current_db()
    today = datetime.date.today()
    week_f, week_s, week_diaper, week_stool = [], [], [], []
    for i in range(7):
        day = today - datetime.timedelta(days=i)
        week_f.append(sum(f.amount_ml or 0 for f in db2.query(Feeding).filter(
            Feeding.baby_id == baby_id, sql_func.date(Feeding.start_time) == day).all()))
        week_s.append(sum(s.duration_min or 0 for s in db2.query(Sleep).filter(
            Sleep.baby_id == baby_id, sql_func.date(Sleep.start_time) == day).all()) / 60)
        day_bowels = db2.query(Bowel).filter(
            Bowel.baby_id == baby_id, sql_func.date(Bowel.time) == day).all()
        d_cnt, s_cnt = _diaper_stool_counts(day_bowels)
        week_diaper.append(d_cnt)
        week_stool.append(s_cnt)
    db2.close()

    avg_f = round(sum(week_f) / 7, 1)
    avg_s = round(sum(week_s) / 7, 2)
    avg_diaper = round(sum(week_diaper) / 7, 1)
    avg_stool = round(sum(week_stool) / 7, 1)
    avg_b = avg_diaper

    def _pct(val, ref_min, ref_avg, ref_max):
        """권장 범위 내 백분위 추정 (0-100)"""
        if val <= ref_min:   return max(0, round((val / ref_min) * 15, 1))
        if val <= ref_avg:   return round(15 + (val - ref_min) / (ref_avg - ref_min) * 35, 1)
        if val <= ref_max:   return round(50 + (val - ref_avg) / (ref_max - ref_avg) * 35, 1)
        return min(99, round(85 + (val - ref_max) / ref_max * 14, 1))

    def _comment(metric, val, ref):
        mn, avg, mx = ref["min"], ref["avg"], ref["max"]
        if metric == "feeding":
            unit = "ml"
            if val < mn * 0.8:
                return {"level":"warning","icon":"⚠️","text":f"수유량이 권장 기준({mn}~{mx}ml)보다 많이 부족합니다. 소아과 상담을 권장합니다."}
            if val < mn:
                return {"level":"caution","icon":"💛","text":f"수유량({val}ml)이 권장 최솟값({mn}ml)보다 적습니다. 수유 횟수를 늘려보세요."}
            if val <= mx:
                return {"level":"good","icon":"✅","text":f"수유량({val}ml)이 권장 범위({mn}~{mx}ml) 내 정상입니다."}
            return {"level":"caution","icon":"💛","text":f"수유량({val}ml)이 권장 최댓값({mx}ml)을 초과합니다. 과수유 여부를 확인하세요."}
        elif metric == "sleep":
            if val < mn:
                return {"level":"caution","icon":"💛","text":f"수면({val:.1f}h)이 권장 최솟값({mn}h)보다 적습니다. 수면 환경을 점검해보세요."}
            if val <= mx:
                return {"level":"good","icon":"✅","text":f"수면({val:.1f}h)이 권장 범위({mn}~{mx}h) 내 정상입니다. 잘 자고 있어요! 😴"}
            return {"level":"good","icon":"✅","text":f"수면({val:.1f}h)이 충분합니다. 권장 범위({mn}~{mx}h) 이상입니다."}
        elif metric == "stool":
            if val < 0.5:
                return {"level":"caution","icon":"💛","text":f"대변 빈도({val:.1f}회/일)가 적습니다. 수분·섬유 섭취를 확인하세요."}
            if val <= mx:
                return {"level":"good","icon":"✅","text":f"대변 빈도({val:.1f}회/일)가 참고 범위 내입니다."}
            return {"level":"caution","icon":"💛","text":f"대변({val:.1f}회/일)이 잦습니다. 상태를 관찰해 주세요."}
        else:
            if val < mn:
                return {"level":"caution","icon":"💛","text":f"기저귀 횟수({val:.1f}회)가 권장({mn}~{mx}회)보다 적습니다. 수분 섭취를 확인하세요."}
            if val <= mx:
                return {"level":"good","icon":"✅","text":f"기저귀 교환 횟수({val:.1f}회)가 정상 범위({mn}~{mx}회)입니다."}
            return {"level":"caution","icon":"💛","text":f"기저귀 횟수({val:.1f}회)가 많습니다. 설사 여부를 확인하세요."}

    return {
        "age_months": m,
        "baby_name": baby.name,
        "feeding": {
            "ref": f_ref,
            "avg_7d": avg_f,
            "percentile": _pct(avg_f, f_ref["min"], f_ref["avg"], f_ref["max"]),
            "comment": _comment("feeding", avg_f, f_ref),
        },
        "sleep": {
            "ref": s_ref,
            "avg_7d": avg_s,
            "percentile": _pct(avg_s, s_ref["min"], s_ref["avg"], s_ref["max"]),
            "comment": _comment("sleep", avg_s, s_ref),
        },
        "bowel": {
            "ref": b_ref,
            "avg_7d": avg_diaper,
            "percentile": _pct(avg_diaper, b_ref["min"], b_ref["avg"], b_ref["max"]),
            "comment": _comment("bowel", avg_diaper, b_ref),
        },
        "diaper": {
            "ref": b_ref,
            "avg_7d": avg_diaper,
            "percentile": _pct(avg_diaper, b_ref["min"], b_ref["avg"], b_ref["max"]),
            "comment": _comment("bowel", avg_diaper, b_ref),
        },
        "stool": {
            "ref": stool_ref,
            "avg_7d": avg_stool,
            "percentile": _pct(avg_stool, stool_ref["min"], stool_ref["avg"], stool_ref["max"]),
            "comment": _comment("stool", avg_stool, stool_ref),
        },
    }


# ---------------------------------------------------------------------------
# 정적 템플릿 라우트 (모든 하위 페이지)
# ---------------------------------------------------------------------------

@app.get("/{path:path}", response_class=HTMLResponse)
async def catch_all(request: Request, path: str):
    """모든 경로를 앱 뷰로 라우팅"""
    return templates.TemplateResponse(request, "app.html", {
        "path": path,
    })


# ---------------------------------------------------------------------------
# 메인 실행
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
