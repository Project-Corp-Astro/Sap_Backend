import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorToAppTable1692800044000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app" 
      ADD COLUMN IF NOT EXISTS "color" character varying(7) DEFAULT '#000000' NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app" 
      DROP COLUMN IF EXISTS "color"
    `);
  }
}
