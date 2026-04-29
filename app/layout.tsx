import './styles.css';

export const metadata = {
  title: 'IAS PDF Generator',
  description: 'Generate Study Notes, Short Notes and Mind Map PDFs for IAS preparation.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
