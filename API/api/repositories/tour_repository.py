"""Public catalog filtering."""
from sqlalchemy import select
from api.models import Tour


def list_public_tours(db, *, q: str = "", region: str = "", flash: bool = False, max_price: int | None = None):
    stmt = select(Tour).where(Tour.active.is_(True))
    if region:
        stmt = stmt.where(Tour.region == region)
    if flash:
        stmt = stmt.where(Tour.flash_sale.is_(True))
    if max_price is not None:
        stmt = stmt.where(Tour.price <= max_price)
    if q:
        stmt = stmt.where(Tour.title.ilike("%" + q.replace("%", "\\%").replace("_", "\\_") + "%", escape="\\"))
    return db.scalars(stmt.order_by(Tour.id)).all()
