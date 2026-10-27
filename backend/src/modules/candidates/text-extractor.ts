import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export interface TextExtractor { extract(filePath: string): Promise<string> }
export class PdfTextExtractor implements TextExtractor {
  async extract(filePath: string): Promise<string> { return (await pdfParse(await fs.readFile(filePath))).text || ''; }
}
export class DocxTextExtractor implements TextExtractor {
  async extract(filePath: string): Promise<string> { return (await mammoth.extractRawText({ path: filePath })).value || ''; }
}
export class ExtractorFactory {
  static create(mime: string): TextExtractor {
    if (mime === 'application/pdf') return new PdfTextExtractor();
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return new DocxTextExtractor();
    throw new Error('Định dạng tệp không được hỗ trợ');
  }
}
