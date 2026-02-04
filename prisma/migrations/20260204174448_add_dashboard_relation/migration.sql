-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
