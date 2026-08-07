import { describe, it, expect } from 'vitest';
import { parseMarkdownToBlocks } from '@/lib/generate-proposal-docx';

// Régression : les options d'un TextRun (.text, .bold, .italics) ne sont pas
// relisibles après construction — l'ancien code les relisait pour re-styler
// les encarts et les listes numérotées, et sortait des blocs VIDES.
// JSON.stringify expose l'arbre interne (w:t = texte, w:b = gras, w:i = italique).

describe('parseMarkdownToBlocks', () => {
  it("conserve le texte des encarts (et les passe en italique)", () => {
    const blocks = parseMarkdownToBlocks(
      "[ENCART]Un point d'attention **important** pour la mission[/ENCART]"
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain("Un point d'attention ");
    expect(json).toContain('important');
    expect(json).toContain('"w:i"');
    expect(json).toContain('"w:b"');
  });

  it('conserve le texte des encarts signature multi-lignes', () => {
    const blocks = parseMarkdownToBlocks(
      '[ENCART_SIGNATURE]\nLine one de signature\nLine two de signature\n[/ENCART_SIGNATURE]'
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain('Line one de signature');
    expect(json).toContain('Line two de signature');
  });

  it('conserve le texte des listes numérotées (et le passe en gras)', () => {
    const blocks = parseMarkdownToBlocks('1. Première étape du plan');
    const json = JSON.stringify(blocks);
    expect(json).toContain('1. ');
    expect(json).toContain('Première étape du plan');
    expect(json).toContain('"w:b"');
  });

  it('conserve le gras/italique inline des paragraphes normaux', () => {
    const blocks = parseMarkdownToBlocks('Texte avec **du gras** et *de l’italique*.');
    const json = JSON.stringify(blocks);
    expect(json).toContain('du gras');
    expect(json).toContain('de l’italique');
  });
});
