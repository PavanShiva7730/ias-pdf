'use client';

import { useState } from 'react';

type FileResult = {
  label: string;
  filename: string;
  base64: string;
  cdnUrl?: string;
};

type ApiResponse = {
  files: FileResult[];
};

function downloadUrl(base64: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
}

export default function Home() {
  const [title, setTitle] = useState('IAS Preparation Notes');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<FileResult[]>([]);

  async function generate() {
    setError('');
    setStatus('Generating high-quality PDFs...');
    setFiles([]);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'PDF generation failed');
      setFiles((data as ApiResponse).files);
      setStatus('Done. Download all three PDFs below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('');
    }
  }

  return (
    <main className="main">
      <section className="hero">
        <div className="card">
          <span className="badge">Testbook IAS Prep PDF Tool</span>
          <h1>Generate notes, short notes and mind maps from any IAS content.</h1>
          <p className="lead">
            Paste your LMS page content once. The tool uses OpenAI on the server and creates three polished PDF files with clean spacing, strict padding, readable typography and Ravi Kapoor branding.
          </p>
          <div className="preview">
            <div className="preview-box"><h3>Study Notes by Ravi Kapoor</h3><p>Detailed exam-style notes with sections, examples and key points.</p></div>
            <div className="preview-box"><h3>Short Notes by Ravi Kapoor</h3><p>Revision-focused bullets, formulas, dates and facts.</p></div>
            <div className="preview-box"><h3>Mind Map by Ravi Kapoor</h3><p>Visual branch map for quick recall and LMS embedding.</p></div>
          </div>
        </div>

        <div className="card">
          <div className="panel-title">Create PDFs</div>
          <label>PDF Topic Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Fundamental Rights UPSC Notes" />
          <label>Paste Page Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste your full article, class notes, syllabus content or raw text here..." />
          <div className="row">
            <button disabled={!content.trim() || status.startsWith('Generating')} onClick={generate}>Generate 3 PDFs</button>
            {status && <span className="status">{status}</span>}
          </div>
          {error && <p className="error">{error}</p>}
          {files.length > 0 && (
            <div className="downloads">
              {files.map((file) => {
                const localUrl = downloadUrl(file.base64);
                return (
                  <a className="download" key={file.filename} href={file.cdnUrl || localUrl} download={file.filename} target={file.cdnUrl ? '_blank' : undefined}>
                    {file.label}
                    <span>{file.cdnUrl ? 'CDN link ready' : 'Direct PDF download'}</span>
                  </a>
                );
              })}
            </div>
          )}
          <p className="footer-note">For CDN links, deploy on Vercel and enable Vercel Blob. Without Blob, the PDFs still download directly.</p>
        </div>
      </section>
    </main>
  );
}
