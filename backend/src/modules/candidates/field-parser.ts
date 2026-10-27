import path from 'path';
import { skillNormalizer } from '../skills/skill-dictionary.js';

export interface ParsedFields { fullName: string; email: string | null; phone: string | null; yearsOfExperience: number; skills: string[]; education: string | null }
export class FieldParser {
  parse(text: string, fileName: string): ParsedFields {
    const base = path.parse(path.basename(fileName)).name.replace(/[_-]+/g, ' ').replace(/^(cv|resume|curriculum vitae)\s*/i, '').trim();
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]?.toLowerCase() ?? null;
    const phone = this.extractPhone(text);
    const fullName = base.length >= 3 && base.length <= 80 ? base : this.firstMeaningfulLine(text) || 'Ứng viên chưa rõ tên';
    // Chỉ nhận số 0–30 nằm cùng cụm “kinh nghiệm/experience” trong phạm vi 40 ký tự.
    const expMatch = text.match(/(?:kinh\s+nghiệm|experience)[^\n]{0,40}?(\d{1,2})\s*\+?\s*(?:năm|years?)(?!\w)|(?:\d{1,2})\s*\+?\s*(?:năm|years?)[^\n]{0,40}?(?:kinh\s+nghiệm|experience)/i);
    const years = expMatch ? Number(expMatch[1] ?? expMatch[0].match(/\d{1,2}/)?.[0] ?? 0) : 0;
    return { fullName, email, phone, yearsOfExperience: years <= 30 ? years : 0, skills: skillNormalizer.detect(text), education: null };
  }

  private extractPhone(text: string): string | null {
    const match = text.match(/(?:\+84|0084|0)(?:[ .()-]*)(?:3|5|7|8|9|12|16|18|19)(?:[ .()-]*\d){8}/);
    if (!match) return null;
    const compact = match[0].replace(/[ .()-]/g, '');
    return compact.startsWith('+84') ? `0${compact.slice(3)}` : compact.startsWith('0084') ? `0${compact.slice(4)}` : compact;
  }

  private firstMeaningfulLine(text: string): string | null {
    return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length >= 3 && line.length <= 80 && !line.includes('@') && !/^(curriculum vitae|resume|cv)$/i.test(line)) ?? null;
  }
}
