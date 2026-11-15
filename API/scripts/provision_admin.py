"""Secure offline provisioner for Delta Travel administrator accounts.

Run only from a trusted operator terminal with a PostgreSQL DATABASE_URL.
Never run this script through HTTP; never commit or share generated passwords.
This is NOT a first-login endpoint, automatic seed or browser account list.
"""
from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
import uuid
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))


def main():
    parser = argparse.ArgumentParser(description="Provision one administrator with an operator-verified identity")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--phone", required=True)
    parser.add_argument("--reset-existing", action="store_true",
                        help="Explicitly rotate the password of an existing account")
    args = parser.parse_args()
    if os.environ.get("DELTA_ADMIN_PROVISION_ACK") != "I_CONTROL_THIS_DATABASE":
        raise SystemExit("REFUSED: set DELTA_ADMIN_PROVISION_ACK=I_CONTROL_THIS_DATABASE")
    url = os.environ.get("DATABASE_URL", "")
    if not url.startswith(("postgresql://", "postgresql+psycopg://", "postgres://")):
        raise SystemExit("REFUSED: administrator provisioning requires durable PostgreSQL")
    email = args.email.strip().lower()
    phone = args.phone.strip()
    name = args.name.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise SystemExit("REFUSED: invalid email")
    if not re.fullmatch(r"0[35789][0-9]{8}", phone):
        raise SystemExit("REFUSED: valid Vietnamese phone required, never invent a number")
    if len(name) < 2:
        raise SystemExit("REFUSED: full name is required")

    print("Role: ADMIN; database: existing managed PostgreSQL; user:", email)
    confirmation = input("Type PROVISION to approve this exact person: ").strip()
    if confirmation != "PROVISION":
        raise SystemExit("Cancelled.")
    password = getpass.getpass("Choose a NEW private password (minimum 16 chars): ")
    password2 = getpass.getpass("Retype new private password: ")
    if password != password2 or len(password) < 16 or len(password) > 128:
        raise SystemExit("REFUSED: password mismatch or length < 16 / > 128")
    if any(term in password.lower() for term in ("password", "123456", "deltatravel", email.split("@")[0])):
        raise SystemExit("REFUSED: obvious/reused password. Choose a random passphrase.")
    from sqlalchemy import select
    from api.models import SessionLocal, User
    from api.core.security import hash_password

    # One transaction; fail closed on phone/email conflicts, no destructive schema operations.
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == email).with_for_update())
        owner = db.scalar(select(User).where(User.phone == phone))
        if owner is not None and (user is None or owner.id != user.id):
            raise SystemExit("REFUSED: phone belongs to another account")
        if user is not None and not args.reset_existing:
            raise SystemExit("REFUSED: account exists. Pass --reset-existing to rotate and promote.")
        if user is None:
            user = User(
                id=str(uuid.uuid4()), full_name=name, email=email, phone=phone,
                password_hash=hash_password(password), role="ADMIN", active=True
            )
            db.add(user)
        else:
            user.full_name = name
            user.phone = phone
            user.password_hash = hash_password(password)
            user.role = "ADMIN"
            user.active = True
        # Revoke all old login sessions for this account.
        from api.models import SessionToken
        for session in db.scalars(select(SessionToken).where(SessionToken.user_id == user.id)).all():
            db.delete(session)
    print("SUCCESS: administrator provisioned with hashed password and revoked old sessions")
    print("Share the secret only with that administrator by a separate private channel.")


if __name__ == "__main__":
    main()
