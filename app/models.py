import re
from datetime import datetime, timezone

from pydantic import field_validator
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from .perguntas import IDS_PERGUNTAS

APELIDO_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
TAG_RE = re.compile(r"^[A-Za-z0-9]{4}$")
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def agora() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Tabela do banco ----------
class Participante(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("apelido_lower", "tag"),)

    id: int | None = Field(default=None, primary_key=True)
    apelido: str
    apelido_lower: str = Field(index=True)
    tag: str
    x: float
    y: float
    cor: str
    token_hash: str
    criado_em: datetime = Field(default_factory=agora)
    atualizado_em: datetime = Field(default_factory=agora)


# ---------- Entrada da API ----------
class RespostaItem(SQLModel):
    pergunta: int
    valor: int = Field(ge=1, le=5)


class DadosQuestionario(SQLModel):
    cor: str = "#4682b4"
    respostas: list[RespostaItem]

    @field_validator("cor")
    @classmethod
    def validar_cor(cls, v: str) -> str:
        if not HEX_RE.match(v):
            raise ValueError("Cor deve estar no formato #RRGGBB")
        return v.lower()

    @field_validator("respostas")
    @classmethod
    def validar_respostas(cls, v: list[RespostaItem]) -> list[RespostaItem]:
        ids = [r.pergunta for r in v]
        if len(ids) != len(set(ids)) or set(ids) != IDS_PERGUNTAS:
            raise ValueError("Responda todas as perguntas, uma vez cada")
        return v


class ParticipanteCreate(DadosQuestionario):
    apelido: str
    tag: str | None = None

    @field_validator("apelido")
    @classmethod
    def validar_apelido(cls, v: str) -> str:
        v = v.strip()
        if not APELIDO_RE.match(v):
            raise ValueError("Apelido: 3 a 20 caracteres (letras, números e _)")
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


class ParticipanteUpdate(DadosQuestionario):
    pass


# ---------- Saída da API ----------
class ParticipantePublico(SQLModel):
    id: int
    apelido: str
    tag: str
    x: float
    y: float
    cor: str
    criado_em: datetime


class ParticipanteCriado(ParticipantePublico):
    token: str   # só é devolvido uma vez, na criação