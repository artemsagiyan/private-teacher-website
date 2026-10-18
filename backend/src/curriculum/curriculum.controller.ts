import {
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CurriculumService } from './curriculum.service';
import { ExamTrack } from './entities/curriculum.entity';

@Controller('curriculum')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('releases')
  @Roles(UserRole.ADMIN)
  releases() {
    return this.curriculum.listReleases();
  }

  @Get('releases/:id/topics')
  @Roles(UserRole.ADMIN)
  topics(@Param('id') id: string) {
    return this.curriculum.listTopics(id);
  }

  @Get('active/:track/topics')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async activeTopics(@Param('track') track: ExamTrack) {
    const release = await this.curriculum.getActiveRelease(track);
    return {
      release: {
        id: release.id,
        examTrack: release.examTrack,
        year: release.year,
        version: release.version,
        title: release.title,
        sourceKind: release.sourceKind,
        metadata: release.metadata,
      },
      topics: [...(release.topics ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
    };
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  import(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    const payload = this.curriculum.parseFile(file.buffer, file.originalname);
    return this.curriculum.importPayload(payload, dryRun === 'true');
  }

  @Post('demo')
  @Roles(UserRole.ADMIN)
  demo(@Query('activate') activate?: string) {
    return this.curriculum.importDemo(activate !== 'false');
  }

  @Patch('releases/:id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id') id: string) {
    return this.curriculum.activate(id);
  }
}
