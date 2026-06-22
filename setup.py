#!/usr/bin/env python3
"""
HireProof — one-command local setup.

No clicking. Installs dependencies, checks your environment file, then starts the
dev server and prints the localhost link.

Usage:
    python setup.py            # install + check env + start dev server (default)
    python setup.py --no-run   # install + check env only (don't start the server)
    python setup.py --build    # production build + start (npm run build && start)
    python setup.py --migrate  # also push Supabase migrations (needs SUPABASE_DB_PASSWORD)

Works on Windows, macOS, and Linux. Requires Python 3.8+, Node.js 18+, and npm.
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IS_WIN = platform.system() == "Windows"
LOCAL_URL = "http://localhost:3000"

# Core variables the app needs in .env.local. Public ones are safe; the rest are
# secrets you copy from Vercel / Supabase (never paste them into chat).
REQUIRED_ENV = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ISSUER_PRIVATE_KEY_HEX",
    "ISSUER_PUBLIC_KEY_HEX",
]
OPTIONAL_ENV = [
    "GOOGLE_GENERATIVE_AI_API_KEY",      # AI assistant + grader (free Gemini)
    "GOOGLE_GENERATIVE_AI_API_KEY_2",    # extra keys for rotation (optional)
    "GOOGLE_GENERATIVE_AI_API_KEY_3",
    "AI_GATEWAY_API_KEY",                # optional: enables Claude (best code)
]


# ── tiny console helpers (no external deps) ──────────────────────────────────
def _supports_color():
    return sys.stdout.isatty() and not IS_WIN or os.environ.get("FORCE_COLOR")


def paint(msg, code):
    if _supports_color():
        return f"\033[{code}m{msg}\033[0m"
    return msg


def ok(msg):    print(paint("  OK  ", "42;30") + " " + msg)
def warn(msg):  print(paint(" WARN ", "43;30") + " " + msg)
def fail(msg):  print(paint(" FAIL ", "41;37") + " " + msg)
def step(msg):  print("\n" + paint("==> " + msg, "1;36"))


def npm():
    return "npm.cmd" if IS_WIN else "npm"


def which(name):
    return shutil.which(name) or (shutil.which(name + ".cmd") if IS_WIN else None)


def run(cmd, **kw):
    print(paint("    $ " + " ".join(cmd), "90"))
    return subprocess.run(cmd, cwd=str(ROOT), **kw)


# ── steps ────────────────────────────────────────────────────────────────────
def check_prereqs():
    step("1/4  Checking prerequisites")
    node = which("node")
    if not node:
        fail("Node.js not found. Install Node 18+ from https://nodejs.org and re-run.")
        sys.exit(1)
    ver = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
    major = int(ver.lstrip("v").split(".")[0]) if ver else 0
    if major < 18:
        fail(f"Node {ver} is too old. Need 18+.")
        sys.exit(1)
    ok(f"Node {ver}")
    if not which("npm"):
        fail("npm not found (it ships with Node). Reinstall Node.js.")
        sys.exit(1)
    ok("npm found")


def install_deps():
    step("2/4  Installing dependencies (npm install)")
    r = run([npm(), "install"])
    if r.returncode != 0:
        fail("npm install failed. Scroll up for the error.")
        sys.exit(1)
    ok("Dependencies installed")


def parse_env_file(path):
    found = set()
    try:
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key = line.split("=", 1)[0].strip()
            # only count keys that actually have a value
            val = line.split("=", 1)[1].strip()
            if val:
                found.add(key)
    except FileNotFoundError:
        pass
    return found


def check_env():
    step("3/4  Checking environment (.env.local)")
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        warn(".env.local not found.")
        # Offer to pull from Vercel if the CLI is available + linked.
        if which("vercel") and (ROOT / ".vercel" / "project.json").exists():
            print("    Trying to pull it from Vercel (vercel env pull)...")
            r = run([which("vercel") or "vercel", "env", "pull", ".env.local"])
            if r.returncode == 0 and env_path.exists():
                ok("Pulled .env.local from Vercel")
            else:
                _print_env_help()
                return
        else:
            _print_env_help()
            return

    present = parse_env_file(env_path)
    missing = [k for k in REQUIRED_ENV if k not in present]
    if missing:
        warn("Missing required vars in .env.local: " + ", ".join(missing))
        print("    The app will start but features using them will fail until added.")
    else:
        ok("All 5 required variables present")
    opt_present = [k for k in OPTIONAL_ENV if k in present]
    if opt_present:
        ok("Optional present: " + ", ".join(opt_present))
    if "GOOGLE_GENERATIVE_AI_API_KEY" not in present and "AI_GATEWAY_API_KEY" not in present:
        warn("No AI key set — the AI assistant/grader won't respond. Add GOOGLE_GENERATIVE_AI_API_KEY.")


def _print_env_help():
    warn("Create hireproof/.env.local with these keys (values from Vercel/Supabase):")
    for k in REQUIRED_ENV:
        print("      " + k + "=...")
    print("    Optional (AI): " + ", ".join(OPTIONAL_ENV))
    print("    Tip: if linked to Vercel, run  vercel env pull .env.local")


def migrate():
    step("Optional  Pushing Supabase migrations")
    if not os.environ.get("SUPABASE_DB_PASSWORD"):
        warn("SUPABASE_DB_PASSWORD not set in your shell — skipping migrations.")
        print("    To apply:  SUPABASE_DB_PASSWORD=... npx supabase db push --linked")
        return
    run([npm().replace("npm", "npx") if not IS_WIN else "npx.cmd", "supabase", "db", "push", "--linked"])


def start_dev(build=False):
    step("4/4  Starting the app")
    if build:
        print("    Production build...")
        if run([npm(), "run", "build"]).returncode != 0:
            fail("Build failed.")
            sys.exit(1)
        print("\n" + paint("  Build OK. Starting production server...", "32"))
        print(paint("\n  ->  Open:  " + LOCAL_URL + "\n", "1;32"))
        run([npm(), "run", "start"])
    else:
        print(paint("\n  ->  Dev server starting. Open:  " + LOCAL_URL, "1;32"))
        print(paint("     (first compile takes a few seconds; press Ctrl+C to stop)\n", "90"))
        run([npm(), "run", "dev"])


def main():
    ap = argparse.ArgumentParser(description="HireProof one-command local setup")
    ap.add_argument("--no-run", action="store_true", help="install + check only, don't start the server")
    ap.add_argument("--build", action="store_true", help="production build + start instead of dev")
    ap.add_argument("--migrate", action="store_true", help="also push Supabase migrations")
    args = ap.parse_args()

    print(paint("\n  HireProof - local setup\n", "1;35"))
    check_prereqs()
    install_deps()
    check_env()
    if args.migrate:
        migrate()
    if args.no_run:
        step("Done")
        ok("Setup complete. Start it yourself with:  npm run dev   (then open " + LOCAL_URL + ")")
        return
    start_dev(build=args.build)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
