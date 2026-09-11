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
      },
      required: ['score', 'summary', 'matchedSkills', 'missingSkills'],
    },
  },
});
