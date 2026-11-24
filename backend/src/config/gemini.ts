import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from './env.js';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const geminiModel = genAI.getGenerativeModel({
  model: env.GEMINI_MODEL,
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2,
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        score: {
          type: SchemaType.INTEGER,
          description: 'Điểm số phù hợp từ 0 đến 100',
        },
        summary: {
          type: SchemaType.STRING,
          description: 'Tóm tắt nhận xét đánh giá ưu nhược điểm bằng tiếng Việt',
        },
        matchedSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Danh sách các kỹ năng ứng viên đáp ứng đúng yêu cầu của JD',
        },
        missingSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Danh sách các kỹ năng quan trọng JD yêu cầu mà CV còn thiếu',
        },
        matchLevel: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: ['strong_match', 'good_match', 'partial_match', 'low_match'],
        },
        scoreBreakdown: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              category: { type: SchemaType.STRING, format: 'enum', enum: ['skill_matching', 'experience_relevance', 'project_achievement', 'soft_skills', 'education_certification', 'cv_quality'] },
              score: { type: SchemaType.INTEGER },
              maxScore: { type: SchemaType.INTEGER },
              reason: { type: SchemaType.STRING },
              evidence: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { source: { type: SchemaType.STRING, format: 'enum', enum: ['CV', 'JD'] }, section: { type: SchemaType.STRING }, text: { type: SchemaType.STRING } }, required: ['source', 'section', 'text'] } },
              gaps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              status: { type: SchemaType.STRING, format: 'enum', enum: ['not_found', 'insufficient_evidence', 'partially_matched', 'matched', 'strongly_matched'] },
              confidence: { type: SchemaType.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
            },
            required: ['category', 'score', 'maxScore', 'reason', 'evidence', 'gaps', 'status', 'confidence'],
          },
        },
        strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        gapsAndConcerns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        requirementsAnalysis: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              requirement: { type: SchemaType.STRING },
              priority: { type: SchemaType.STRING, format: 'enum', enum: ['required', 'preferred'] },
              status: { type: SchemaType.STRING, format: 'enum', enum: ['not_found', 'insufficient_evidence', 'partially_matched', 'matched', 'strongly_matched'] },
              evidence: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    source: { type: SchemaType.STRING, format: 'enum', enum: ['CV', 'JD'] },
                    section: { type: SchemaType.STRING },
                    text: { type: SchemaType.STRING },
                  },
                  required: ['source', 'section', 'text'],
                },
              },
              gap: { type: SchemaType.STRING },
            },
            required: ['requirement', 'priority', 'status', 'evidence'],
          },
        },
        interviewQuestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        careerPotential: { type: SchemaType.OBJECT, properties: { assessment: { type: SchemaType.STRING, format: 'enum', enum: ['positive_evidence', 'insufficient_evidence', 'mixed_evidence'] }, reason: { type: SchemaType.STRING } }, required: ['assessment', 'reason'] },
        confidence: { type: SchemaType.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
        limitations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ['score', 'summary', 'matchedSkills', 'missingSkills', 'scoreBreakdown', 'strengths', 'gapsAndConcerns', 'requirementsAnalysis', 'interviewQuestions', 'careerPotential', 'confidence', 'limitations'],
    },
  },
});
