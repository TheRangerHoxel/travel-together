"""Prerequisiti dell'officina, dentro il repo: Node e Supabase CLI in tools/.

Uso, dalla radice del repo:   py tools/setup.py

Perche' uno script e non i binari nel repo: supabase.exe pesa piu' di 100 MB,
il limite di GitHub per file, e un binario in git non si rivede. Qui stanno
invece le versioni e i loro SHA256 fissati: ogni macchina scarica gli stessi
byte, e un download che non corrisponde fa fallire lo script prima di estrarre.

Perche' Python: e' l'interprete presente su entrambe le macchine, e un .py non
e' soggetto all'ExecutionPolicy di PowerShell (stessa ragione dell'hook guard).

Solo stdlib. Idempotente: uno strumento gia' presente alla versione giusta non
si riscarica. tools/ e' in .gitignore, tranne questo file.
"""

import hashlib
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
CACHE = TOOLS / ".cache"

# Le versioni sono quelle registrate in PROGRESS.md (25/10/2026). La CLI e' la
# release stabile piu' recente con almeno due settimane di vita a quella data.
STRUMENTI = [
    {
        "nome": "node",
        "versione": "24.22.1",
        "url": "https://nodejs.org/dist/v24.22.1/node-v24.22.1-win-x64.zip",
        "sha256": "d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5",
        # Lo zip di Node ha una cartella radice; quello della CLI no.
        "radice_nello_zip": "node-v24.22.1-win-x64",
    },
    {
        "nome": "supabase",
        "versione": "2.120.0",
        "url": "https://github.com/supabase/cli/releases/download/v2.120.0/"
        "supabase_2.120.0_windows_amd64.zip",
        "sha256": "0db5224fc5d92ae5f15e675ed65dad376967326921122ab8d9a78e790874c92e",
        "radice_nello_zip": None,
    },
]


def sha256(percorso: Path) -> str:
    h = hashlib.sha256()
    with percorso.open("rb") as f:
        for blocco in iter(lambda: f.read(1 << 20), b""):
            h.update(blocco)
    return h.hexdigest()


def installa(s: dict) -> None:
    dest = TOOLS / s["nome"]
    marcatore = dest / ".versione"
    if marcatore.exists() and marcatore.read_text().strip() == s["versione"]:
        print(f"{s['nome']} {s['versione']}: gia' presente")
        return

    CACHE.mkdir(exist_ok=True)
    archivio = CACHE / s["url"].rsplit("/", 1)[1]
    if not archivio.exists() or sha256(archivio) != s["sha256"]:
        print(f"{s['nome']} {s['versione']}: scarico {s['url']}")
        parziale = archivio.with_suffix(".part")
        with urllib.request.urlopen(s["url"]) as r, parziale.open("wb") as f:
            shutil.copyfileobj(r, f)
        parziale.replace(archivio)

    trovato = sha256(archivio)
    if trovato != s["sha256"]:
        archivio.unlink()
        sys.exit(
            f"ERRORE {s['nome']}: SHA256 non corrisponde\n"
            f"  atteso  {s['sha256']}\n  trovato {trovato}\n"
            "Archivio cancellato, niente estratto."
        )

    if dest.exists():
        shutil.rmtree(dest)
    temp = TOOLS / f".{s['nome']}-estrazione"
    if temp.exists():
        shutil.rmtree(temp)
    with zipfile.ZipFile(archivio) as z:
        z.extractall(temp)
    sorgente = temp / s["radice_nello_zip"] if s["radice_nello_zip"] else temp
    sorgente.replace(dest)
    if temp.exists():
        shutil.rmtree(temp)
    marcatore.write_text(s["versione"])
    print(f"{s['nome']} {s['versione']}: installato in {dest} (SHA256 verificato)")


def main() -> None:
    if sys.platform != "win32":
        sys.exit("Questo setup scarica i binari per Windows x64.")
    for s in STRUMENTI:
        installa(s)
    print(
        "\nPer usarli in una shell, metti in testa al PATH:\n"
        f"  {TOOLS / 'node'}\n  {TOOLS / 'supabase'}\n"
        "PowerShell:  $env:Path = \""
        f"{TOOLS / 'node'};{TOOLS / 'supabase'};\" + $env:Path"
    )


if __name__ == "__main__":
    main()
