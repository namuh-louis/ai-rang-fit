"""Vercel serverless entry — FastAPI (ASGI via Mangum)"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mangum import Mangum
from app import app as fastapi_app

handler = Mangum(fastapi_app, lifespan="off")
