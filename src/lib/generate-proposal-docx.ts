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
  HeadingLevel,
  Header,
  convertInchesToTwip,
  TabStopPosition,
  TabStopType,
} from 'docx';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';

const BRAND_DARK = '91014B';
const BRAND_PINK = 'E91E8C';
const LIGHT_GRAY = 'F9F9F9';
const GRAY_TEXT = '888888';
const BLACK = '000000';
const WHITE = 'FFFFFF';
const BORDER_GRAY = 'CCCCCC';

interface ProposalSection {
  title: string;
  content: string;
}

function parseMarkdownToParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      paragraphs.push(...createTable(tableRows));
      tableRows = [];
    }
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator rows
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cells);
      continue;
    }

    if (inTable) flushTable();

    if (trimmed === '') {
      paragraphs.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    // Subtitle (### or ##)
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      const subtitle = trimmed.replace(/^#{2,3}\s+/, '');
      paragraphs.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: subtitle,
              bold: true,
              size: 24, // 12pt
              font: 'Arial',
              color: BLACK,
            }),
          ],
        })
      );
      continue;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2);
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: parseInlineFormatting(content),
        })
      );
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: parseInlineFormatting(numberedMatch[1]),
        })
      );
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        spacing: { after: 80, line: 312 }, // 1.3 line spacing (240 * 1.3)
        children: parseInlineFormatting(trimmed),
      })
    );
  }

  if (inTable) flushTable();
  return paragraphs;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(
        new TextRun({
          text: text.slice(lastIndex, match.index),
          size: 22, // 11pt
          font: 'Arial',
        })
      );
    }
    runs.push(
      new TextRun({
        text: match[1],
        bold: true,
        size: 22,
        font: 'Arial',
      })
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(lastIndex),
        size: 22,
        font: 'Arial',
      })
    );
  }

  return runs.length > 0
    ? runs
    : [new TextRun({ text, size: 22, font: 'Arial' })];
}

function createTable(rows: string[][]): Paragraph[] {
  if (rows.length === 0) return [];

  const isHeader = (idx: number) => idx === 0;

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, rowIdx) =>
      new TableRow({
        children: cells.map(
          (cellText) =>
            new TableCell({
              shading: {
                type: ShadingType.SOLID,
                color: isHeader(rowIdx) ? BRAND_PINK : rowIdx % 2 === 0 ? WHITE : LIGHT_GRAY,
                fill: isHeader(rowIdx) ? BRAND_PINK : rowIdx % 2 === 0 ? WHITE : LIGHT_GRAY,
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
                left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
                right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
              },
              children: [
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [
                    new TextRun({
                      text: cellText,
                      bold: isHeader(rowIdx),
                      color: isHeader(rowIdx) ? WHITE : BLACK,
                      size: 22,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    ),
  });

  return [
    new Paragraph({ spacing: { before: 100 } }),
    // We need to return the table as a paragraph-level element
    // docx library handles Table at the same level as Paragraph in sections
    table as unknown as Paragraph,
    new Paragraph({ spacing: { after: 100 } }),
  ];
}

function pinkSeparator(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 4, // 2pt
        color: BRAND_PINK,
      },
    },
  });
}

function importantBlock(text: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 100, after: 100 },
      border: {
        left: {
          style: BorderStyle.SINGLE,
          size: 8, // 4pt
          color: BRAND_PINK,
        },
      },
      shading: {
        type: ShadingType.SOLID,
        color: LIGHT_GRAY,
        fill: LIGHT_GRAY,
      },
      indent: { left: convertInchesToTwip(0.2) },
      children: [
        new TextRun({
          text,
          size: 22,
          font: 'Arial',
          italics: true,
        }),
      ],
    }),
  ];
}

export async function generateProposalDocx(
  clientName: string,
  sections: ProposalSection[]
) {
  const now = new Date();
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  const dateStr = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Cover page children
  const coverChildren: Paragraph[] = [
    new Paragraph({ spacing: { before: 4000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'PROPOSITION',
          size: 44, // 22pt
          font: 'Arial',
          color: BRAND_DARK,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Pour ${clientName}`,
          size: 28, // 14pt
          font: 'Arial',
          color: GRAY_TEXT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: dateStr,
          size: 24, // 12pt
          font: 'Arial',
          color: GRAY_TEXT,
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 6000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Nowadays Agency',
          size: 20, // 10pt
          font: 'Arial',
          color: GRAY_TEXT,
        }),
      ],
    }),
  ];

  // Content section children
  const contentChildren: (Paragraph | Table)[] = [];

  sections.forEach((section, idx) => {
    if (idx > 0) {
      // Page break between sections
      contentChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    // Section title
    contentChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: section.title,
            size: 32, // 16pt
            font: 'Arial',
            color: BRAND_DARK,
          }),
        ],
      })
    );

    // Pink separator
    contentChildren.push(pinkSeparator());

    // Section content
    const parsedParagraphs = parseMarkdownToParagraphs(section.content);
    contentChildren.push(...(parsedParagraphs as (Paragraph | Table)[]));
  });

  const footerText = 'Nowadays Agency — nowadaysagency.com/accompagnement-communication';

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
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: footerText + '  —  Page ',
                    size: 16,
                    font: 'Arial',
                    color: GRAY_TEXT,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: 'Arial',
                    color: GRAY_TEXT,
                  }),
                ],
              }),
            ],
          }),
        },
        children: contentChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const sanitizedName = clientName.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '_');
  const dateFile = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  saveAs(blob, `Proposition_Nowadays_${sanitizedName}_${dateFile}.docx`);
}
