import { Injectable } from '@nestjs/common';
import { LearningService } from '../learning/learning.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PracticeService {
  constructor(private readonly learning: LearningService) {}

  async forLesson(user: User, lessonId: string, refresh = false) {
    return this.learning.practiceForLesson(user, lessonId, refresh);
  }
}
