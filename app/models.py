import re
from datetime import datetime, timezone
from typing import Literal

from pydantic import field_validator
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

APELIDO_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
TAG_RE = re.compile(r"^[A-Za-z0-9]{4}$")


#Tabela do banco
class Participante(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    apelido: str = Field(index=True, unique=True)
    apelido_lower: str = Field(index=True)
    tag: str
    x: float
    y: float
    metodo: str
    criado_em: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
class ParticipanteCreate(SQLModel):
    apelido: str = Field(min_length=3, max_length=20)
    tag: str | None = None
    x: float = Field(ge=-10, le=10)
    y: float = Field(ge=-10, le=10)
    metodo: Literal["questionario", "manual"]
    
    
    @field_validator("apelido")
    @classmethod
    def validar_apelido(cls, v: str) -> str:
        v = v.strip()
        if not APELIDO_RE.match(v):
            raise ValueError ("Apelido: 3 a 20 caracteres (letras, números e _)")
        return v
    
    
    @field_validator("tag")
    @classmethod
    def validar_tag(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        
        v = v.strip()
        
        if not TAG_RE.match(v):
            raise ValueError("Tag: exatamente 4 letras ou números")
        
        return v.upper()
    

class ParticipantePublico(SQLModel):
    id: int
    apelido: str
    tag: str
    x: float
    y: float
    metodo: str
    criado_em: datetime