"""
Avvia il server Django e il worker Celery in parallelo.

Uso:
    python main.py [--port PORTA]

Opzioni:
    --port  Porta su cui esporre il server Django (default: 8000)
"""

import argparse
import subprocess
import sys
import os


VENV_PYTHON = os.path.join(os.path.dirname(__file__), ".venv", "Scripts", "python.exe")


def ensure_venv():
    """Se non stiamo girando nel venv, ci ri-eseguiamo con il suo interprete."""
    if os.path.exists(VENV_PYTHON) and os.path.abspath(sys.executable) != os.path.abspath(VENV_PYTHON):
        os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)


def main():
    ensure_venv()

    parser = argparse.ArgumentParser(description="Avvia Django + Celery")
    parser.add_argument("--port", type=int, default=8000, help="Porta del server Django (default: 8000)")
    args = parser.parse_args()

    python = sys.executable
    base = os.path.dirname(__file__)
    manage = os.path.join(base, "manage.py")

    django_cmd = [python, manage, "runserver", f"0.0.0.0:{args.port}"]
    celery_cmd = [python, "-m", "celery", "-A", "docslm", "worker", "--loglevel=info", "--pool=solo"]

    processes = []

    try:
        processes.append(subprocess.Popen(django_cmd, cwd=base))
        processes.append(subprocess.Popen(celery_cmd, cwd=base))

        for p in processes:
            p.wait()
    except KeyboardInterrupt:
        print("\nInterruzione ricevuta, arresto in corso...")
    finally:
        for p in processes:
            if p.poll() is None:
                p.terminate()
        for p in processes:
            p.wait()


if __name__ == "__main__":
    main()
