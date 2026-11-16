import os

from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # produção (Postgres). Alguns provedores usam "postgres://", que o SQLAlchemy não aceita
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # em serverless, não vale manter um pool de conexões aberto
    engine = create_engine(DATABASE_URL, poolclass=NullPool)
else:
    # local (sem DATABASE_URL)
    engine = create_engine(
        "sqlite:///./mapa.db",
        connect_args={"check_same_thread": False},
    )


def criar_tabelas():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session