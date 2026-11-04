-- A verified VNPay callback creates a settled Payment using this method.
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'VNPAY';

-- A provider-confirmed payment that cannot safely settle its invoice needs
-- manual reconciliation rather than being reported as an ordinary failure.
ALTER TYPE "public"."PaymentAttemptStatus" ADD VALUE 'RECONCILIATION_REQUIRED';
