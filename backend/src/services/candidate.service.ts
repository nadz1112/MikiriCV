import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database.js';
import { CandidateFilterQuery } from '../types/index.js';
import { extractTextFromFile, parseCandidateInfo } from '../utils/textParser.js';

export class CandidateService {
  async processAndSaveUploadedFile(file: Express.Multer.File) {
    const rawText = await extractTextFromFile(file.path, file.originalname);
    const parsed = parseCandidateInfo(rawText, file.originalname);

    const relativeUrl = `/uploads/${path.basename(file.path)}`;

    return prisma.candidate.create({
      data: {
        fullName: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone,
        yearsOfExperience: parsed.yearsOfExperience,
        skills: parsed.skills.map((s) => s.toLowerCase()),
        education: parsed.education,
        rawText: parsed.rawText,
        fileName: file.originalname,
        fileUrl: relativeUrl,
      },
    });
  }

  async getFilteredCandidates(filters: CandidateFilterQuery) {
    const { search, skills, minExp, page, limit } = filters;

    // Chuẩn bị điều kiện truy vấn Prisma
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (minExp) {
      const expNumber = parseInt(minExp, 10);
      if (!isNaN(expNumber)) {
        where.yearsOfExperience = { gte: expNumber };
      }
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      where.OR = [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { rawText: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (skills && skills.trim() !== '') {
      const skillList = skills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      if (skillList.length > 0) {
        where.skills = {
          hasSome: skillList,
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryOptions: any = {
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        matchResults: {
          select: {
            jobDescriptionId: true,
            score: true,
          },
        },
      },
    };

    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    if (pageNum && limitNum && pageNum > 0 && limitNum > 0) {
      queryOptions.skip = (pageNum - 1) * limitNum;
      queryOptions.take = limitNum;
    }

    return prisma.candidate.findMany(queryOptions);
  }

  async getCandidateById(id: string) {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        matchResults: {
          include: {
            jobDescription: true,
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!candidate) {
      throw new Error(`Không tìm thấy ứng viên với ID: ${id}`);
    }

    return candidate;
  }

  async deleteCandidate(id: string) {
    const candidate = await this.getCandidateById(id);

    // Xóa file vật lý nếu tồn tại
    try {
      const filePath = path.resolve(process.cwd(), candidate.fileUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('Không thể xóa tệp vật lý của ứng viên:', err);
    }

    return prisma.candidate.delete({
      where: { id },
    });
  }
}

export const candidateService = new CandidateService();
