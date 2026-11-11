import fs from 'fs/promises';
import mammoth from 'mammoth';

interface PdfTextItem { str: string; transform: number[] }
interface PdfDocument {
  numPages: number;
  getPage(page: number): Promise<{ getTextContent(): Promise<{ items: PdfTextItem[] }> }>;
  destroy(): Promise<void>;
}
interface PdfWorker {
  promise: Promise<void>;
  messageHandler: { send(name: string, data: { verbosity: number }): void };
  destroy(): void;
}
// Use the newer engine already bundled with pdf-parse.
const pdfJs = require('pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js') as {
  PDFWorker: new (options: { verbosity: number }) => PdfWorker;
  getDocument(options: { data: Uint8Array; verbosity: number; worker: PdfWorker }): { promise: Promise<PdfDocument>; destroy(): Promise<void> };
};

export interface TextExtractor { extract(filePath: string): Promise<string> }
export class PdfTextExtractor implements TextExtractor {
  async extract(filePath: string): Promise<string> {
    // PDF.js expects Uint8Array slice semantics; a Node Buffer can corrupt offsets.
    const data = new Uint8Array(await fs.readFile(filePath));
    const worker = new pdfJs.PDFWorker({ verbosity: 0 });
    let task: ReturnType<typeof pdfJs.getDocument> | undefined;
    try {
      await worker.promise;
      // This bundled engine skips configure in its Node worker fallback.
      worker.messageHandler.send('configure', { verbosity: 0 });
      task = pdfJs.getDocument({ data, verbosity: 0, worker });
      const document = await task.promise;
      const pages: string[] = [];
      for (let page = 1; page <= document.numPages; page++) {
        const content = await (await document.getPage(page)).getTextContent();
        let lastY: number | undefined;
        let text = '';
        for (const item of content.items) {
          if (lastY !== undefined && lastY !== item.transform[5]) text += '\n';
          text += item.str;
          lastY = item.transform[5];
        }
        pages.push(text);
      }
      return pages.join('\n\n');
    } finally {
      try { await task?.destroy(); } finally { worker.destroy(); }
    }
  }
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
