from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://coop_user:coop_pass@localhost:5432/coop_db"
    openai_api_key: str = ""
    upload_dir: str = "./uploads"
    # Optional: Google Custom Search (free tier: 100 requests/day)
    google_api_key: str = ""
    google_cx: str = ""
    # Frontend URL for CORS (set on Railway to the frontend service URL)
    frontend_url: str = "http://localhost:5173"

    model_config = {"env_file": ".env"}


settings = Settings()
