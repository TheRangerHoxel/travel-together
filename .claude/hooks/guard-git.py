#!/usr/bin/env python3
"""PreToolUse guard: blocca i comandi irreversibili ed escala all'umano i dubbi.

Seconda delle tre reti di sicurezza (deny rules -> questo hook -> branch protection su main).

Scritto in Python, non in PowerShell, perche' su questa macchina Python 3.12 e' l'unico interprete
presente e un .py non e' soggetto all'ExecutionPolicy, che su Windows Enterprise gestito puo' essere
imposta via GPO. Il freno deve funzionare proprio quando l'ambiente e' restrittivo.

Solo stdlib. Nessuna dipendenza.

Contratto: legge l'evento PreToolUse come JSON su stdin, scrive la decisione come JSON su stdout.
In caso di errore inatteso -> "ask": nulla di pericoloso passa in silenzio, e l'umano vede il problema.
"""

import json
import re
import sys

# Tool di shell: si ispeziona tool_input["command"].
SHELL_TOOLS = {"Bash", "PowerShell", "BashOutput"}

# Tool di scrittura: si ispeziona tool_input["file_path"].
WRITE_TOOLS = {"Write", "Edit", "NotebookEdit", "MultiEdit"}

# --- Regole sui comandi di shell -------------------------------------------------
# (regex, decisione, motivo). Valutate in ordine: la prima che matcha vince.
# Le regex sono case-insensitive e valutate sul comando con spazi normalizzati.

RULES = [
    # --- Riscrittura di storia gia' pubblicata: irreversibile per chiunque abbia fatto fetch ---
    (
        r"\bgit\s+push\b(?=[^|;&]*(?:--force\b|--force-with-lease\b|--force-if-includes\b|\s-f(?:\s|$)))",
        "deny",
        "git push --force riscrive la storia remota: irreversibile per chiunque abbia gia' fatto fetch. "
        "Vietato in automatico. Se serve davvero, lo esegue l'umano a mano.",
    ),
    (
        r"\bgit\s+(?:filter-branch|filter-repo)\b",
        "deny",
        "Riscrittura massiva della storia: vietata in automatico.",
    ),
    # --- Distruzione di lavoro non committato ---
    (
        r"\bgit\s+reset\b[^|;&]*--hard\b",
        "deny",
        "git reset --hard distrugge il lavoro non committato senza possibilita' di recupero. "
        "Per annullare un commit verde sbagliato si usa 'git revert <sha>'.",
    ),
    (
        r"\bgit\s+clean\b[^|;&]*-[a-z]*f",
        "deny",
        "git clean -f cancella file non tracciati: puo' portarsi via .env, keystore e lavoro in corso.",
    ),
    (
        r"\bgit\s+(?:checkout|restore)\b[^|;&]*(?:--\s|\s\.(?:\s|$)|--staged)",
        "ask",
        "Scarta modifiche non committate: possibile perdita di lavoro. Serve conferma umana.",
    ),
    (
        r"\bgit\s+branch\b[^|;&]*\s-D\b",
        "ask",
        "Cancellazione forzata di un branch non mergiato: serve conferma umana.",
    ),
    (
        r"\bgit\s+(?:rebase|commit\b[^|;&]*--amend)\b",
        "ask",
        "Riscrive commit esistenti. La regola dell'officina e' preferire un commit nuovo. "
        "Serve conferma umana.",
    ),
    (
        r"\bgit\s+reflog\s+expire\b|\bgit\s+gc\b[^|;&]*--prune",
        "deny",
        "Rimuove la rete di recupero di git (reflog): vietato in automatico.",
    ),
    # --- main e' territorio dell'umano ---
    (
        r"\bgit\s+push\b[^|;&]*\b(?:main|master)\b",
        "deny",
        "Push su main vietato in automatico: main lo mergia l'umano. Si lavora su auto/build.",
    ),
    (
        r"\bgit\s+(?:checkout|switch)\b[^|;&]*\b(?:main|master)\b[^|;&]*",
        "ask",
        "Passare su main durante il loop e' sospetto: si lavora su auto/build. Serve conferma umana.",
    ),
    # --- Credenziali ---
    (
        r"\bgit\s+add\b[^|;&]*(?:\.env|\.jks|\.keystore|\.pem|\.p12|service[_-]account|service[_-]role)",
        "deny",
        "Tentativo di mettere in staging un file di credenziali. Segreti e config stanno fuori dal "
        "codice e vengono iniettati a runtime.",
    ),
    (
        r"\bgit\s+add\b[^|;&]*(?:-f\b|--force\b)",
        "deny",
        "git add --force scavalca .gitignore, cioe' esattamente la protezione che tiene i segreti "
        "fuori dal repo.",
    ),
    # --- Non smontare i propri freni ---
    (
        r"\.claude[\\/](?:hooks|settings)",
        "deny",
        "Questo comando toccherebbe l'hook guard o settings.json, cioe' i freni del sistema. "
        "Se un comando serve e l'hook lo blocca, si chiede all'umano: non si rimuove il freno.",
    ),
    (
        r"\bgit\s+config\b[^|;&]*(?:core\.hooksPath|safe\.directory)",
        "deny",
        "Modifica della configurazione che governa gli hook: vietata in automatico.",
    ),
]

# `git push` senza refspec esplicito: dipende dal branch corrente, quindi non e' decidibile qui.
BARE_PUSH = re.compile(r"\bgit\s+push\b", re.IGNORECASE)
EXPLICIT_SAFE_PUSH = re.compile(r"\bgit\s+push\b[^|;&]*\bauto/build\b", re.IGNORECASE)

# --- Regole sui percorsi di scrittura --------------------------------------------

PROTECTED_PATHS = [
    (".claude/hooks/", "l'hook guard: e' il freno del sistema, non si modifica dall'interno del loop"),
    (".claude/settings.json", "le deny rules: sono il primo filtro di sicurezza"),
]

SECRET_FILE = re.compile(
    r"(?:^|/)\.env(?!\.example)|\.jks$|\.keystore$|\.pem$|\.p12$|service[_-]account[^/]*\.json$",
    re.IGNORECASE,
)


def decide(tool_name, tool_input):
    """Ritorna (decisione, motivo) oppure (None, None) se non c'e' nulla da dire."""

    if tool_name in WRITE_TOOLS:
        raw = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        path = str(raw).replace("\\", "/")
        low = path.lower()
        for marker, why in PROTECTED_PATHS:
            if marker in low:
                return "deny", f"Scrittura su {path} bloccata: {why}."
        if SECRET_FILE.search(low):
            return (
                "deny",
                f"Scrittura su {path}: e' un file di credenziali. "
                "I segreti non stanno nel repo e non li scrive l'agente.",
            )
        return None, None

    if tool_name not in SHELL_TOOLS:
        return None, None

    command = str(tool_input.get("command") or "")
    if not command.strip():
        return None, None

    normalized = re.sub(r"\s+", " ", command)

    for pattern, decision, reason in RULES:
        if re.search(pattern, normalized, re.IGNORECASE):
            return decision, reason

    if BARE_PUSH.search(normalized) and not EXPLICIT_SAFE_PUSH.search(normalized):
        return (
            "ask",
            "git push senza branch esplicito: la destinazione dipende dal branch corrente e da qui "
            "non e' verificabile. Usa 'git push origin auto/build', oppure conferma a mano.",
        )

    return None, None


def emit(decision, reason):
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": decision,
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def main():
    try:
        event = json.load(sys.stdin)
    except Exception as exc:  # input illeggibile: si escala, non si lascia passare in silenzio
        emit("ask", f"guard-git: evento PreToolUse illeggibile ({exc}). Verifica a mano il comando.")
        return

    try:
        tool_name = event.get("tool_name") or ""
        tool_input = event.get("tool_input") or {}
        decision, reason = decide(tool_name, tool_input)
    except Exception as exc:
        emit("ask", f"guard-git: errore interno ({exc}). Verifica a mano il comando.")
        return

    if decision:
        emit(decision, reason)
    # Nessuna regola toccata: si esce in silenzio e il flusso dei permessi prosegue normalmente.


if __name__ == "__main__":
    main()
