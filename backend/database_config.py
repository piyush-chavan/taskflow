from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker,DeclarativeBase
from dotenv import load_dotenv
import os

load_dotenv()  # Load environment variables from .env file

engine = create_engine(os.getenv("ENCODED_DB_URL"))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass


