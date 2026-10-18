import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { LearningModule } from '../learning/learning.module';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { StudentLearningProfile } from '../learning/entities/learning.entity';
import { MockExam } from './entities/mock-exam.entity';
import { MockExamsController } from './mock-exams.controller';
import { MockExamsService } from './mock-exams.service';

@Module({ imports: [TypeOrmModule.forFeature([MockExam, Student, Teacher, StudentLearningProfile]), CurriculumModule, LearningModule], controllers: [MockExamsController], providers: [MockExamsService] })
export class MockExamsModule {}
