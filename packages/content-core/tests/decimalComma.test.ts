import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { decimalCommas, digitCommas, renderKatex } from '../src/decimalComma.ts';

const unchanged = (tex: string) => assert.equal(decimalCommas(tex), tex, tex);

describe('decimalCommas', () => {
  it('renders a comma between two digits as a decimal', () => {
    assert.equal(decimalCommas('54,0\\,\\mathrm{g}'), '54{,}0\\,\\mathrm{g}');
    assert.equal(decimalCommas('2,70\\,\\mathrm{g\\,cm^{-3}}'), '2{,}70\\,\\mathrm{g\\,cm^{-3}}');
    assert.equal(decimalCommas('x = -0,238'), 'x = -0{,}238');
  });

  it('treats a plain brace group as part of the number, not a bracket', () => {
    assert.equal(decimalCommas('\\frac{15}{63,01} = 0,238'), '\\frac{15}{63{,}01} = 0{,}238');
    assert.equal(decimalCommas('\\mathrm{0,5}'), '\\mathrm{0{,}5}');
  });

  it('keeps lists of three or more items, signs and \\dots included', () => {
    unchanged('(3,1,-1)');
    unchanged('m_l=-1,0,1');
    unchanged('k=0,1,2,3');
    unchanged('\\{0,1,2,\\dots\\}');
    unchanged('\\{0,1,\\dots\\}');
    unchanged('a_n \\in \\{-1,0,1\\}');
    unchanged('(3,4,0)');
    unchanged('(-12,-16,0)');
  });

  it('keeps two numbers that fill a pair of brackets of any kind', () => {
    unchanged('[0,1]');
    unchanged('(0,1)');
    unchanged('\\{0,1\\}');
    unchanged('\\langle 1,2\\rangle');
    unchanged('\\vec{a}=(1,2)');
    unchanged('\\vec v=(2,2)\\,\\mathrm{m/s}');
  });

  it('keeps mixed and reversed interval brackets, with or without sizing', () => {
    unchanged('[0,1)');
    unchanged('(0,1]');
    unchanged(']0,1[');
    unchanged('\\lbrack -1,1)');
    unchanged('\\rbrack 0,1\\lbrack');
    unchanged('\\left(1,2\\right)');
    unchanged('\\left\\lbrack 0,1 \\right\\rbrack');
    unchanged('\\bigl[0,1\\bigr)');
  });

  it('reads a sign as part of the first number of a pair', () => {
    unchanged('(-3,4)');
    unchanged('(-12,0)\\,\\mathrm{m/s^2}');
    assert.equal(decimalCommas('(2,0-1,0)'), '(2{,}0-1{,}0)');
  });

  it('keeps an interval whose endpoints are expressions', () => {
    unchanged('\\lbrack 0,2\\pi\\lbrack');
    unchanged('\\rbrack 1,1+e^2\\lbrack');
    unchanged('\\lbrack x_0,1\\rbrack');
    unchanged('(-\\sqrt2,0)');
    unchanged('\\lbrack \\frac12,1)');
    unchanged('(6-2,8)\\,\\mathrm{N}');
  });

  it('reads brackets holding a number with a unit or a space as a decimal', () => {
    assert.equal(decimalCommas('(2,0\\,\\mathrm{kg})'), '(2{,}0\\,\\mathrm{kg})');
    assert.equal(decimalCommas('(2,0\\text{ kg})'), '(2{,}0\\text{ kg})');
    assert.equal(decimalCommas('(1,2 x)'), '(1{,}2 x)');
  });

  it('reads brackets as one decimal after a one-argument function, a leading zero or a power of ten', () => {
    assert.equal(decimalCommas('\\log(2,5)'), '\\log(2{,}5)');
    assert.equal(decimalCommas('\\log\\left(2,5\\right)'), '\\log\\left(2{,}5\\right)');
    assert.equal(decimalCommas('(1,00)(0,08206)'), '(1{,}00)(0{,}08206)');
    assert.equal(decimalCommas('(6,67\\cdot10^{-11})'), '(6{,}67\\cdot10^{-11})');
    unchanged('U(1,2)');
  });

  it('keeps indices in a subscript or superscript group, but not a signed exponent', () => {
    unchanged('x_{1,2}');
    unchanged('\\lambda_{1,2}=\\pm\\sqrt{2}i');
    unchanged('a^{1,2}');
    assert.equal(decimalCommas('10^{-9,52}'), '10^{-9{,}52}');
  });

  it('keeps a signed pair of subscript indices: only an exponent can be a signed decimal', () => {
    unchanged('a_{-1,2}');
    unchanged('a_{+1,2}');
    assert.equal(decimalCommas('10^{-9,52}'), '10^{-9{,}52}');
  });

  it('keeps lists of three or more whose items are expressions', () => {
    unchanged('(1,2,\\pi)');
    unchanged('(1,2^2,3)');
    unchanged('\\vec u=(1,2,\\sqrt{3})');
    unchanged('(1,2,f(3))');
    unchanged('x=1,2,\\pi');
  });

  it('still reads decimal arithmetic inside one bracket as decimals', () => {
    assert.equal(decimalCommas('(0,5\\cdot 2,0)'), '(0{,}5\\cdot 2{,}0)');
    assert.equal(decimalCommas('(2,0\\,\\mathrm{kg})(9,8\\,\\mathrm{m\\,s^{-2}})'), '(2{,}0\\,\\mathrm{kg})(9{,}8\\,\\mathrm{m\\,s^{-2}})');
    assert.equal(decimalCommas('\\frac{(1,0-2,0)\\cdot 4,0}{3,0}'), '\\frac{(1{,}0-2{,}0)\\cdot 4{,}0}{3{,}0}');
    assert.equal(decimalCommas('\\arctan(4,0/3,0)'), '\\arctan(4{,}0/3{,}0)');
  });

  it('never reads a comma after a one-character script as a decimal', () => {
    unchanged('x^2,5');
    unchanged('a_1,2');
  });

  it('reads an escaped underscore as a character, not a subscript', () => {
    assert.equal(decimalCommas('\\_1,2'), '\\_1{,}2');
    assert.equal(decimalCommas('x\\_{1,5}'), 'x\\_{1{,}5}');
  });

  it('leaves commas next to a space alone: a space always means a list', () => {
    unchanged('1, 2');
    unchanged('54, 0');
    unchanged('1 ,2');
    assert.equal(decimalCommas('3,58, \\qquad 14,00'), '3{,}58, \\qquad 14{,}00');
  });

  it('keeps {,} as written, and leaves the other commas of that formula alone', () => {
    unchanged('54{,}0');
    unchanged('(1,1{,}20)\\,\\mathrm{m/s}');
    assert.deepEqual(digitCommas('(0,0{,}40)').map((c) => c.kind), ['marked']);
  });

  it('does not touch text-mode arguments, \\verb or dimensions', () => {
    unchanged('\\text{1,5}');
    unchanged('x\\ \\text{(a 1,5 m)}');
    unchanged('\\textbf{2,5}');
    unchanged('\\verb|1,5|');
    unchanged('\\hspace{1,5em}');
    unchanged('\\kern1,5em');
    assert.equal(decimalCommas('\\text{a}\\,2,5'), '\\text{a}\\,2{,}5');
  });

  it('leaves formulas without digit-comma-digit unchanged', () => {
    unchanged('(1,+\\infty)');
    unchanged('\\lbrack 0,\\pi\\rbrack');
    unchanged('f(x,y)');
  });

  it('never turns a formula KaTeX accepts into one it rejects', () => {
    const samples = [
      '54,0\\,\\mathrm{g}', '\\frac{15}{63,01}', '\\sqrt[3,5]{x}', 'x^1,2', 'x_1,5', '\\frac12,5',
      '\\begin{pmatrix}1,5 & 2\\end{pmatrix}', '\\overset{1,5}{=}', '\\color{red}{1,5}',
    ];
    for (const tex of samples) {
      assert.doesNotThrow(() => katex.renderToString(decimalCommas(tex), { throwOnError: true }), tex);
    }
  });
});

describe('renderKatex', () => {
  const spacedComma = /mpunct">,<\/span><span class="mspace"/;

  it('renders a decimal comma without the space and a pair with it', () => {
    assert.doesNotMatch(renderKatex('54,0', false), spacedComma);
    assert.match(renderKatex('(3,4)', false), spacedComma);
  });

  it('renders display math too', () => {
    assert.match(renderKatex('0,238', true), /katex-display/);
    assert.doesNotMatch(renderKatex('0,238', true), spacedComma);
  });
});
