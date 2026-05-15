import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
    DB_NAME = os.getenv('DB_NAME', 'Smart-Car-Management-System') 
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

settings = Settings()
