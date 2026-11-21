CREATE TABLE "treatment_plan_templates" (
    "id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "treatment_plan_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "treatment_plan_templates_category_sort_order_idx"
ON "treatment_plan_templates"("category", "sort_order");
