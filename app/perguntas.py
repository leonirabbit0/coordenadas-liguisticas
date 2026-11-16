import json
from pathlib import Path

CAMINHO = Path(__file__).parent / "perguntas.json"

PERGUNTAS = json.loads(CAMINHO.read_text(encoding="utf-8"))
IDS_PERGUNTAS = {p["id"] for p in PERGUNTAS}

def calcular_posicao(respostas:dict[int, int]) -> tuple[float, float]:
    """Recebe {id_da_pergunta: valor de 1 a 5} e devolve (x, y) entre -10 e 10."""
    
    pontos = {"x": 0, "y": 0}
    maximo = {"x": 0, "y": 0}
    
    for p in PERGUNTAS:
        valor = respostas[p["id"]] - 3
        pontos[p["eixo"]] += valor * p["sentido"]
        maximo[p["eixo"]] += 2
        
    x = round(pontos["x"] / maximo["x"] * 10, 2)
    y = round(pontos["y"] / maximo["y"] * 10, 2)    
    
    return x, y