import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageBreak,
  Footer,
  PageNumber,
  NumberFormat,
  ShadingType,
  Header,
  convertInchesToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';

const BRAND_DARK = '91014B';      // pourpre
const BRAND_PINK = 'FB3D80';      // rose vif
const BRAND_PINK_SOFT = 'FCE4EC'; // rose pâle (header de tableau)
const BG_GRAY = 'FAFAFA';         // fond encart
const BORDER_GRAY = 'E0E0E0';
const RULE_GRAY = 'BDBDBD';
const GRAY_TEXT = '888888';
const BLACK = '1A1A1A';
const WHITE = 'FFFFFF';

interface ProposalSection {
  title: string;
  content: string;
}

// ============ INLINE FORMATTING (bold + italic) ============

function parseInlineFormatting(text: string): TextRun[] {
  // Tokenize **bold** and *italic*
  const runs: TextRun[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 22, font: 'Arial', color: BLACK }));
    }
    if (match[2] !== undefined) {
      runs.push(new TextRun({ text: match[2], bold: true, size: 22, font: 'Arial', color: BLACK }));
    } else if (match[3] !== undefined) {
      runs.push(new TextRun({ text: match[3], italics: true, size: 22, font: 'Arial', color: BLACK }));
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 22, font: 'Arial', color: BLACK }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text, size: 22, font: 'Arial', color: BLACK })];
}

// ============ ENCART (bordure gauche pourpre + fond gris + italique) ============

function createEncartParagraphs(content: string, opts?: { signature?: boolean }): Paragraph[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const fillColor = opts?.signature ? 'FFF5F8' : BG_GRAY;
  const borderColor = BRAND_DARK;

  return lines.map((line, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === lines.length - 1;
    return new Paragraph({
      spacing: { before: isFirst ? 200 : 0, after: isLast ? 200 : 60 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: borderColor },
        top: isFirst ? { style: BorderStyle.SINGLE, size: 4, color: fillColor } : undefined,
        bottom: isLast ? { style: BorderStyle.SINGLE, size: 4, color: fillColor } : undefined,
      },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: fillColor },
      indent: { left: convertInchesToTwip(0.25), right: convertInchesToTwip(0.25) },
      children: parseInlineFormatting(line).map(
        (r) =>
          new TextRun({
            text: (r as unknown as { text: string }).text ?? '',
            italics: true,
            bold: (r as unknown as { bold?: boolean }).bold,
            size: 22,
            font: 'Arial',
            color: BLACK,
          })
      ),
    });
  });
}

// ============ MARKDOWN PARSING ============

function parseMarkdownToBlocks(text: string): (Paragraph | Table)[] {
  const lines = text.split('\n');
  const blocks: (Paragraph | Table)[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let inEncart = false;
  let encartType: 'normal' | 'signature' = 'normal';
  let encartLines: string[] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const tbl = createTable(tableRows);
      if (tbl) blocks.push(tbl);
      tableRows = [];
    }
    inTable = false;
  };

  const flushEncart = () => {
    if (encartLines.length > 0) {
      blocks.push(...createEncartParagraphs(encartLines.join('\n'), { signature: encartType === 'signature' }));
      encartLines = [];
    }
    inEncart = false;
    encartType = 'normal';
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (inEncart) {
      const closeTag = encartType === 'signature' ? '[/ENCART_SIGNATURE]' : '[/ENCART]';
      if (trimmed.includes(closeTag)) {
        encartLines.push(trimmed.replace(closeTag, '').trim());
        flushEncart();
      } else {
        encartLines.push(trimmed);
      }
      continue;
    }

    if (trimmed.startsWith('[ENCART_SIGNATURE]')) {
      if (inTable) flushTable();
      const inline = trimmed.replace('[ENCART_SIGNATURE]', '');
      if (inline.includes('[/ENCART_SIGNATURE]')) {
        blocks.push(...createEncartParagraphs(inline.replace('[/ENCART_SIGNATURE]', '').trim(), { signature: true }));
      } else {
        inEncart = true;
        encartType = 'signature';
        encartLines = [inline.trim()].filter(Boolean);
      }
      continue;
    }

    if (trimmed.startsWith('[ENCART]')) {
      if (inTable) flushTable();
      const inline = trimmed.replace('[ENCART]', '');
      if (inline.includes('[/ENCART]')) {
        blocks.push(...createEncartParagraphs(inline.replace('[/ENCART]', '').trim()));
      } else {
        inEncart = true;
        encartType = 'normal';
        encartLines = [inline.trim()].filter(Boolean);
      }
      continue;
    }

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      inTable = true;
      tableRows.push(trimmed.slice(1, -1).split('|').map((c) => c.trim()));
      continue;
    }
    if (inTable) flushTable();

    if (trimmed === '') {
      blocks.push(new Paragraph({ spacing: { after: 80 } }));
      continue;
    }

    // Subtitle
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      const subtitle = trimmed.replace(/^#{2,3}\s+/, '');
      blocks.push(
        new Paragraph({
          spacing: { before: 240, after: 100 },
          children: [new TextRun({ text: subtitle, bold: true, size: 24, font: 'Arial', color: BLACK })],
        })
      );
      continue;
    }

    // ✓ list
    if (trimmed.startsWith('✓ ')) {
      blocks.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.2) },
          children: [
            new TextRun({ text: '✓  ', bold: true, size: 22, font: 'Arial', color: BRAND_DARK }),
            ...parseInlineFormatting(trimmed.slice(2)),
          ],
        })
      );
      continue;
    }

    // bullet
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const content = trimmed.replace(/^[-*•]\s+/, '');
      blocks.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.2) },
          children: [
            new TextRun({ text: '•  ', size: 22, font: 'Arial', color: BLACK }),
            ...parseInlineFormatting(content),
          ],
        })
      );
      continue;
    }

    // Numbered list — keep numbering visible
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      blocks.push(
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `${numberedMatch[1]}. `, bold: true, size: 22, font: 'Arial', color: BRAND_DARK }),
            ...parseInlineFormatting(numberedMatch[2]).map(
              (r) =>
                new TextRun({
                  text: (r as unknown as { text: string }).text ?? '',
                  bold: true,
                  italics: (r as unknown as { italics?: boolean }).italics,
                  size: 22,
                  font: 'Arial',
                  color: BLACK,
                })
            ),
          ],
        })
      );
      continue;
    }

    // paragraph
    blocks.push(
      new Paragraph({
        spacing: { after: 120, line: 312 },
        alignment: AlignmentType.LEFT,
        children: parseInlineFormatting(trimmed),
      })
    );
  }

  if (inEncart) flushEncart();
  if (inTable) flushTable();
  return blocks;
}

// ============ TABLES ============

function createTable(rows: string[][]): Table | null {
  if (rows.length === 0) return null;

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
    left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
    right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, rowIdx) => {
      const isHeader = rowIdx === 0;
      return new TableRow({
        children: cells.map(
          (cellText) =>
            new TableCell({
              shading: {
                type: ShadingType.CLEAR,
                color: 'auto',
                fill: isHeader ? BRAND_PINK_SOFT : WHITE,
              },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { before: 40, after: 40 },
                  children: [
                    new TextRun({
                      text: cellText.replace(/\*\*/g, ''),
                      bold: isHeader,
                      color: BLACK,
                      size: 22,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            })
        ),
      });
    }),
  });
}

// ============ COVER PAGE ============

function buildCoverChildren(clientName: string, dateStr: string, baseline?: string): Paragraph[] {
  const c: Paragraph[] = [];

  // Logo top-left + ligne pourpre
  c.push(
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({ text: 'NOWADAYS AGENCY', bold: true, size: 24, font: 'Arial', color: BRAND_DARK }),
      ],
    })
  );
  c.push(
    new Paragraph({
      spacing: { after: 1200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_DARK } },
    })
  );

  // Titre principal
  c.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "Proposition d'accompagnement", bold: true, size: 56, font: 'Arial', color: BLACK }),
      ],
    })
  );

  // Prénom client en rose
  c.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: clientName, bold: true, size: 56, font: 'Arial', color: BRAND_PINK }),
      ],
    })
  );

  // Baseline italique
  if (baseline && baseline.trim()) {
    c.push(
      new Paragraph({
        spacing: { after: 600 },
        children: [
          new TextRun({ text: baseline.trim(), italics: true, size: 26, font: 'Arial', color: GRAY_TEXT }),
        ],
      })
    );
  } else {
    c.push(new Paragraph({ spacing: { after: 600 } }));
  }

  // Date
  c.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: dateStr, size: 24, font: 'Arial', color: GRAY_TEXT })],
    })
  );

  // Spacer
  c.push(new Paragraph({ spacing: { before: 4000 } }));

  // Signature
  c.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: 'Laetitia Mattioli', bold: true, size: 22, font: 'Arial', color: BLACK })],
    })
  );
  c.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: 'laetitia@nowadaysagency.com', size: 20, font: 'Arial', color: BRAND_DARK })],
    })
  );
  c.push(
    new Paragraph({
      children: [new TextRun({ text: 'nowadaysagency.com', size: 20, font: 'Arial', color: GRAY_TEXT })],
    })
  );

  return c;
}

// ============ MAIN ============

export async function generateProposalDocx(
  clientName: string,
  sections: ProposalSection[],
  baseline?: string
) {
  const now = new Date();
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  const dateStr = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const coverChildren = buildCoverChildren(clientName, dateStr, baseline);

  // Content
  const contentChildren: (Paragraph | Table)[] = [];
  sections.forEach((section, idx) => {
    if (idx > 0) {
      contentChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
    // Section title (noir gras, gauche)
    contentChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({ text: section.title, bold: true, size: 36, font: 'Arial', color: BLACK }),
        ],
      })
    );
    // Ligne grise fine
    contentChildren.push(
      new Paragraph({
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_GRAY } },
      })
    );
    contentChildren.push(...parseMarkdownToBlocks(section.content));
  });

  // Header running text
  const runningHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `Nowadays Agency × ${clientName}`,
            size: 16,
            font: 'Arial',
            color: GRAY_TEXT,
            italics: true,
          }),
        ],
      }),
    ],
  });

  const runningFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Page ', size: 16, font: 'Arial', color: GRAY_TEXT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: GRAY_TEXT }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
          },
        },
        children: coverChildren,
      },
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: { default: runningHeader },
        footers: { default: runningFooter },
        children: contentChildren as Paragraph[],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const sanitizedName = clientName.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '_');
  const dateFile = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  saveAs(blob, `Proposition_Nowadays_${sanitizedName}_${dateFile}.docx`);
}
