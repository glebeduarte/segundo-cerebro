#!/usr/bin/env python3
"""
Envia ao Segundo cérebro o tempo de uso por app do ActivityWatch, agregado por hora.
Uso:  SC_TOKEN=seu_token python3 activitywatch-sync.py [horas]
Rode a cada hora (cron no Mac/Linux ou Agendador de Tarefas no Windows). Reenviar a mesma hora só atualiza.
"""
import json, os, socket, sys, urllib.request
from datetime import datetime, timedelta, timezone

AW = os.environ.get("AW_URL", "http://localhost:5600/api/0")
DESTINO = os.environ.get("SC_URL", "https://segundo-cerebro-black.vercel.app/api/uso")
TOKEN = os.environ.get("SC_TOKEN")
HORAS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
MIN_SEG = 60  # ignora apps com menos de 1 minuto na hora

def req(url, dados=None, cab=None):
    r = urllib.request.Request(url, data=json.dumps(dados).encode() if dados is not None else None,
                               headers={"Content-Type": "application/json", **(cab or {})}, method="POST" if dados is not None else "GET")
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read() or "null")

def main():
    if not TOKEN:
        sys.exit("Defina SC_TOKEN com o token do Segundo cérebro.")
    agora = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    periodos = [(agora - timedelta(hours=h), agora - timedelta(hours=h - 1)) for h in range(HORAS, -1, -1)]
    consulta = [
        "janelas = flood(query_bucket(find_bucket('aw-watcher-window_')));",
        "ativo = flood(query_bucket(find_bucket('aw-watcher-afk_')));",
        "ativo = filter_keyvals(ativo, 'status', ['not-afk']);",
        "janelas = filter_period_intersect(janelas, ativo);",
        "RETURN = merge_events_by_keys(janelas, ['app']);",
    ]
    res = req(f"{AW}/query/", {"timeperiods": [f"{a.isoformat()}/{b.isoformat()}" for a, b in periodos], "query": consulta})
    registros = []
    for (ini, _), eventos in zip(periodos, res):
        for ev in eventos or []:
            seg = int(ev.get("duration", 0))
            app = ev.get("data", {}).get("app")
            if app and seg >= MIN_SEG:
                registros.append({"dispositivo": f"computador:{socket.gethostname()}", "app": app, "inicio": ini.isoformat(), "duracao_seg": seg})
    if not registros:
        print("Nada a enviar."); return
    r = req(DESTINO, registros, {"Authorization": f"Bearer {TOKEN}"})
    print(f"Enviados {len(registros)} registros, gravados {r.get('gravados')}.")

if __name__ == "__main__":
    main()
