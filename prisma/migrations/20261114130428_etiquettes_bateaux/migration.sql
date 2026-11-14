-- AlterTable
ALTER TABLE "Boat" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
