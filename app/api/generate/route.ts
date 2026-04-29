import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 120;

type NotesData = {
  studyNotes: { heading: string; points: string[] }[];
  shortNotes: string[];
  mindMap: { central: string; branches: { title: string; items: string[] }[] };
};

const BRAND = {
  red: '#8B1E1E',
  saffron: '#C47F1A',
  ink: '#1F2937',
  muted: '#6B7280',
  cream: '#FFF8EA',
  line: '#E7D6BD'
};

const HINDI_QUOTE = '\u092e\u0947\u0939\u0928\u0924 \u0915\u0930\u0924\u0947 \u0930\u0939\u094b, \u0938\u092b\u0932\u0924\u093e \u0906\u092a\u0915\u0947 \u0915\u0926\u092e \u091a\u0942\u092e\u0947\u0917\u0940 - Ravi Kapoor';

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'ias-notes';
}

function cleanText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeJson(text: string): NotesData {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('OpenAI did not return valid JSON. Please try again.');
  return JSON.parse(match[0]) as NotesData;
}

async function buildNotes(title: string, content: string): Promise<NotesData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing. Add it in your deployment environment.');

  const client = new OpenAI({ apiKey });
  const prompt = `Create UPSC/IAS preparation material from the supplied content. Return strict JSON only with this schema:
{
  "studyNotes": [{"heading":"string","points":["string"]}],
  "shortNotes": ["string"],
  "mindMap": {"central":"string", "branches":[{"title":"string","items":["string"]}]}
}
Rules:
- Use simple English for Indian IAS aspirants.
- Keep study notes detailed but concise.
- Short notes must be crisp revision bullets.
- Mind map should have 5 to 8 branches and each branch 2 to 4 short items.
- Do not invent facts outside the supplied content unless it is basic contextual framing.
- Avoid markdown. Avoid citations. JSON only.
Title: ${title}
Content: ${content.slice(0, 45000)}`;

  const response = await client.responses.create({
  model: 'gpt-4o-mini',
    input: prompt,
    temperature: 0.35
  });

  return safeJson(response.output_text || '');
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function pageFrame(doc: PDFKit.PDFDocument, label: string, topic: string) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill('#FFFDF7');
  doc.rect(30, 30, width - 60, height - 60).lineWidth(1).stroke(BRAND.line);
  doc.rect(30, 30, width - 60, 54).fill(BRAND.cream);
  doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(15).text(label, 54, 48, { width: width - 108 });
  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(9).text(topic, 54, 68, { width: width - 108, align: 'right' });
  doc.moveTo(54, height - 56).lineTo(width - 54, height - 56).stroke(BRAND.line);
  doc.fillColor(BRAND.muted).fontSize(9).text('Testbook IAS Preparation | Ravi Kapoor', 54, height - 45, { width: width - 108, align: 'center' });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, label: string, topic: string) {
  if (doc.y + needed > doc.page.height - 82) {
    doc.addPage();
    pageFrame(doc, label, topic);
    doc.y = 108;
  }
}

function writeCover(doc: PDFKit.PDFDocument, heading: string, title: string) {
  pageFrame(doc, heading, title);
  doc.y = 160;
  doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(31).text(heading, 58, doc.y, { width: doc.page.width - 116, align: 'center' });
  doc.moveDown(1.2);
  doc.fillColor(BRAND.ink).fontSize(21).text(title, { align: 'center', width: doc.page.width - 116 });
  doc.moveDown(1.5);
  doc.roundedRect(92, doc.y, doc.page.width - 184, 84, 18).fillAndStroke('#FFFFFF', BRAND.line);
  doc.fillColor(BRAND.saffron).font('Helvetica-Bold').fontSize(16).text('Prepared for focused IAS revision', 112, doc.y + 22, { width: doc.page.width - 224, align: 'center' });
  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(11).text('Clean notes. Quick recall. Better revision.', 112, doc.y + 48, { width: doc.page.width - 224, align: 'center' });
  doc.addPage();
  pageFrame(doc, heading, title);
  doc.y = 108;
}

function endQuote(doc: PDFKit.PDFDocument, label: string, topic: string) {
  ensureSpace(doc, 90, label, topic);
  doc.moveDown(1);
  doc.roundedRect(54, doc.y, doc.page.width - 108, 70, 16).fillAndStroke(BRAND.cream, BRAND.line);
  doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(13).text('All the Best!', 76, doc.y + 16, { width: doc.page.width - 152, align: 'center' });
  doc.fillColor(BRAND.ink).font('Helvetica').fontSize(11).text(HINDI_QUOTE, 76, doc.y + 38, { width: doc.page.width - 152, align: 'center' });
}

async function createStudyPdf(title: string, data: NotesData) {
  const label = 'Study Notes by Ravi Kapoor';
  const doc = new PDFDocument({ size: 'A4', margin: 54, bufferPages: true });
  const promise = collectPdf(doc);
  writeCover(doc, label, title);

  data.studyNotes.forEach((section, idx) => {
    ensureSpace(doc, 70, label, title);
    doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(16).text(`${idx + 1}. ${cleanText(section.heading)}`, { width: doc.page.width - 108 });
    doc.moveDown(0.35);
    section.points.forEach((point) => {
      ensureSpace(doc, 45, label, title);
      doc.fillColor(BRAND.saffron).font('Helvetica-Bold').fontSize(10).text('•', 62, doc.y, { continued: true });
      doc.fillColor(BRAND.ink).font('Helvetica').fontSize(11).text(` ${cleanText(point)}`, { width: doc.page.width - 132, lineGap: 4 });
      doc.moveDown(0.25);
    });
    doc.moveDown(0.7);
  });

  endQuote(doc, label, title);
  doc.end();
  return promise;
}

async function createShortPdf(title: string, data: NotesData) {
  const label = 'Short Notes by Ravi Kapoor';
  const doc = new PDFDocument({ size: 'A4', margin: 54, bufferPages: true });
  const promise = collectPdf(doc);
  writeCover(doc, label, title);

  doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(18).text('Quick Revision Points', { width: doc.page.width - 108 });
  doc.moveDown(0.8);
  data.shortNotes.forEach((point, idx) => {
    ensureSpace(doc, 52, label, title);
    const y = doc.y;
    doc.circle(68, y + 8, 10).fill(BRAND.cream).stroke(BRAND.saffron);
    doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(9).text(String(idx + 1), 62, y + 3, { width: 12, align: 'center' });
    doc.fillColor(BRAND.ink).font('Helvetica').fontSize(11).text(cleanText(point), 90, y, { width: doc.page.width - 144, lineGap: 4 });
    doc.moveDown(0.75);
  });

  endQuote(doc, label, title);
  doc.end();
  return promise;
}

function drawBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, title: string, items: string[]) {
  doc.roundedRect(x, y, w, h, 14).fillAndStroke('#FFFFFF', BRAND.line);
  doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(11).text(cleanText(title), x + 12, y + 12, { width: w - 24 });
  let cursor = y + 34;
  items.slice(0, 4).forEach((item) => {
    doc.fillColor(BRAND.ink).font('Helvetica').fontSize(8.8).text(`- ${cleanText(item)}`, x + 12, cursor, { width: w - 24, height: 24 });
    cursor += 22;
  });
}

async function createMindMapPdf(title: string, data: NotesData) {
  const label = 'Mind Map by Ravi Kapoor';
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  const promise = collectPdf(doc);
  pageFrame(doc, label, title);

  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;
  doc.roundedRect(cx - 105, cy - 42, 210, 84, 20).fillAndStroke(BRAND.cream, BRAND.saffron);
  doc.fillColor(BRAND.red).font('Helvetica-Bold').fontSize(15).text(cleanText(data.mindMap.central || title), cx - 88, cy - 18, { width: 176, align: 'center' });

  const branches = data.mindMap.branches.slice(0, 8);
  const positions = [
    [64, 108], [330, 96], [596, 108], [64, 286], [596, 286], [330, 390], [64, 390], [596, 390]
  ];
  branches.forEach((branch, i) => {
    const [x, y] = positions[i] || positions[positions.length - 1];
    const bw = 205;
    const bh = 116;
    doc.moveTo(cx, cy).lineTo(x + bw / 2, y + bh / 2).lineWidth(1).stroke(BRAND.line);
    drawBox(doc, x, y, bw, bh, branch.title, branch.items);
  });

  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(10).text(HINDI_QUOTE, 72, doc.page.height - 72, { width: doc.page.width - 144, align: 'center' });
  doc.end();
  return promise;
}

async function maybeUpload(filename: string, buffer: Buffer) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;
  const blob = await put(filename, buffer, { access: 'public', contentType: 'application/pdf' });
  return blob.url;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = cleanText(String(body.title || 'IAS Preparation Notes')).slice(0, 120);
    const content = cleanText(String(body.content || ''));
    if (content.length < 100) return NextResponse.json({ error: 'Please paste at least 100 characters of content.' }, { status: 400 });

    const data = await buildNotes(title, content);
    const base = slugify(title);
    const pdfs = [
      { label: 'Study Notes PDF', filename: `${base}-study-notes.pdf`, buffer: await createStudyPdf(title, data) },
      { label: 'Short Notes PDF', filename: `${base}-short-notes.pdf`, buffer: await createShortPdf(title, data) },
      { label: 'Mind Map PDF', filename: `${base}-mind-map.pdf`, buffer: await createMindMapPdf(title, data) }
    ];

    const files = await Promise.all(pdfs.map(async (file) => ({
      label: file.label,
      filename: file.filename,
      base64: file.buffer.toString('base64'),
      cdnUrl: await maybeUpload(`ias-pdfs/${Date.now()}-${file.filename}`, file.buffer)
    })));

    return NextResponse.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
