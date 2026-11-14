-- CreateEnum
CREATE TYPE "OutingDirection" AS ENUM ('GENEVA', 'LAUSANNE');

-- AlterTable
ALTER TABLE "Outing" ADD COLUMN     "direction" "OutingDirection";
