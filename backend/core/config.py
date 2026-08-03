import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500"
        ).split(",")
        if origin.strip()
    ]

    USE_REAL_LLM = os.getenv("USE_REAL_LLM", "false").strip().lower() in ("1", "true", "yes")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


settings = Settings()
