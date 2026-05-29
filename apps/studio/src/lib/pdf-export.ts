export async function exportTextAsPdf(options: {
  text: string;
  filename: string;
  title?: string;
}) {
  const { text, filename, title } = options;
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const marginX = 48;
  const marginTop = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;

  let cursorY = marginTop;

  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(title, contentWidth);
    doc.text(titleLines, marginX, cursorY);
    cursorY += titleLines.length * 18 + 10;
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, contentWidth);

  for (const line of lines as string[]) {
    if (cursorY > pageHeight - 42) {
      doc.addPage();
      cursorY = marginTop;
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
    }
    doc.text(line, marginX, cursorY);
    cursorY += 12;
  }

  doc.save(filename);
}
