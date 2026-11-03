"""Privileged booking serializer."""
from api.services.booking_service import booking_dict


def admin_booking_record(b):
    record = booking_dict(b)
    record.update({"customerPhone": b.customer_phone, "customerEmail": b.customer_email, "paymentEvidence": b.payment_evidence, "userId": b.user_id})
    return record
