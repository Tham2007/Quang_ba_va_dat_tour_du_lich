"""One-time trusted local operator action; never expose as a public endpoint."""
import sys
from sqlalchemy import select
from api.models import SessionLocal, User
if len(sys.argv)!=2:
    raise SystemExit('Usage: python -m scripts.promote_admin person@example.com')
email=sys.argv[1].strip().lower()
with SessionLocal.begin() as db:
    u=db.scalar(select(User).where(User.email==email))
    if not u: raise SystemExit('Account not found')
    if input(f'Type PROMOTE to grant ADMIN to {email}: ')!='PROMOTE':
        raise SystemExit('Cancelled')
    u.role='ADMIN'
print('Promoted. Re-login before admin operations.')
