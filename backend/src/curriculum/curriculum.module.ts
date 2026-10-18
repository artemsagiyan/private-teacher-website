import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CurriculumRelease,
  CurriculumTask,
  CurriculumTopic,
} from './entities/curriculum.entity';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurriculumRelease,
      CurriculumTopic,
      CurriculumTask,
    ]),
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService, TypeOrmModule],
})
export class CurriculumModule {}
