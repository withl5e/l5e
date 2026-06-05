import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { isAttributeNameSafe, renderJsxToHtmlString } from '../src/core/render';
import { jsxFactory as jsxFactoryAlias } from '../src/core/jsx-runtime';

/**
 * Attribute-key injection tests ported from React's own suite
 * (packages/react-dom/src/__tests__/ReactDOMComponent-test.js — the
 * "should reject attribute key injection attack …" block).
 *
 * React proves the attack is blocked on markup(SSR) / mount / update for both
 * regular DOM and custom elements. L5E is a string-only SSR renderer, so mount
 * and update collapse onto the same `renderJsxToHtmlString` path — we keep all
 * four scenarios (with React's exact payloads) so coverage matches React's.
 *
 * `h(type, props)` is React.createElement's equivalent here: it lets us pass
 * attacker-controlled object keys that cannot be written as JSX attributes.
 */
const h = jsxFactoryAlias;

const PAYLOAD_ATTR = 'blah" onclick="beevil" noise="hi';
const PAYLOAD_TAG = '></div><script>alert("hi")</script>';
const PAYLOAD_TAG_CUSTOM = '></x-foo-component><script>alert("hi")</script>';

describe('attribute key injection attack (ported from React)', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('should reject attribute key injection attack on markup for regular DOM (SSR)', () => {
    for (let i = 0; i < 3; i++) {
      const element1 = h('div', { [PAYLOAD_ATTR]: 'selected' });
      const element2 = h('div', { [PAYLOAD_TAG]: 'selected' });
      const result1 = renderJsxToHtmlString(element1);
      const result2 = renderJsxToHtmlString(element2);
      expect(result1.toLowerCase()).not.toContain('onclick');
      expect(result2.toLowerCase()).not.toContain('script');
      // The malicious attribute is dropped entirely — no attributes emitted.
      expect(result1).toBe('<div></div>');
      expect(result2).toBe('<div></div>');
    }
  });

  it('should reject attribute key injection attack on markup for custom elements (SSR)', () => {
    for (let i = 0; i < 3; i++) {
      const element1 = h('x-foo-component', { [PAYLOAD_ATTR]: 'selected' });
      const element2 = h('x-foo-component', { [PAYLOAD_TAG_CUSTOM]: 'selected' });
      const result1 = renderJsxToHtmlString(element1);
      const result2 = renderJsxToHtmlString(element2);
      expect(result1.toLowerCase()).not.toContain('onclick');
      expect(result2.toLowerCase()).not.toContain('script');
      expect(result1).toBe('<x-foo-component></x-foo-component>');
      expect(result2).toBe('<x-foo-component></x-foo-component>');
    }
  });

  it('should reject attribute key injection attack on mount for regular DOM', () => {
    // No client runtime in L5E — "mount" is the initial string render.
    for (let i = 0; i < 3; i++) {
      const r1 = renderJsxToHtmlString(h('div', { [PAYLOAD_ATTR]: 'selected' }));
      const r2 = renderJsxToHtmlString(h('div', { [PAYLOAD_TAG]: 'selected' }));
      expect(r1).toBe('<div></div>');
      expect(r2).toBe('<div></div>');
    }
  });

  it('should reject attribute key injection attack on mount for custom elements', () => {
    for (let i = 0; i < 3; i++) {
      const r1 = renderJsxToHtmlString(h('x-foo-component', { [PAYLOAD_ATTR]: 'selected' }));
      const r2 = renderJsxToHtmlString(h('x-foo-component', { [PAYLOAD_TAG_CUSTOM]: 'selected' }));
      expect(r1).toBe('<x-foo-component></x-foo-component>');
      expect(r2).toBe('<x-foo-component></x-foo-component>');
    }
  });

  it('should reject attribute key injection attack on update for regular DOM', () => {
    // L5E re-renders produce a fresh string; "update" === render with new props.
    const before = renderJsxToHtmlString(h('div', {}));
    expect(before).toBe('<div></div>');
    const after1 = renderJsxToHtmlString(h('div', { [PAYLOAD_ATTR]: 'selected' }));
    const after2 = renderJsxToHtmlString(h('div', { [PAYLOAD_TAG]: 'selected' }));
    expect(after1).toBe('<div></div>');
    expect(after2).toBe('<div></div>');
  });

  it('should reject attribute key injection attack on update for custom elements', () => {
    const before = renderJsxToHtmlString(h('x-foo-component', {}));
    expect(before).toBe('<x-foo-component></x-foo-component>');
    const after1 = renderJsxToHtmlString(h('x-foo-component', { [PAYLOAD_ATTR]: 'selected' }));
    const after2 = renderJsxToHtmlString(
      h('x-foo-component', { [PAYLOAD_TAG_CUSTOM]: 'selected' }),
    );
    expect(after1).toBe('<x-foo-component></x-foo-component>');
    expect(after2).toBe('<x-foo-component></x-foo-component>');
  });

  it('warns in dev about the invalid attribute name (React parity)', () => {
    // Unique payloads so the module-level name cache (mirrors React's
    // illegalAttributeNameCache) doesn't suppress the one-time warning.
    renderJsxToHtmlString(h('div', { 'evil" onmouseover="x': '1' }));
    expect(errorSpy).toHaveBeenCalledWith('Invalid attribute name: `%s`', 'evil" onmouseover="x');
  });
});

describe('isAttributeNameSafe (React DOMProperty grammar)', () => {
  it('accepts the attribute names L5E legitimately emits', () => {
    for (const name of [
      'class',
      'id',
      'href',
      'onClick',
      'DATA-Test',
      'data-test',
      'data-island-props',
      'aria-label',
      'xlink:href',
      'viewBox',
      'data-x.y',
      'data-1',
    ]) {
      expect(isAttributeNameSafe(name)).toBe(true);
    }
  });

  it('rejects names containing breakout characters', () => {
    for (const name of [
      'foo bar',
      'foo"bar',
      'foo=bar',
      'foo>bar',
      'foo/bar',
      '<foo',
      'blah" onclick="x',
      '></div><script>alert(1)</script>',
      '',
    ]) {
      expect(isAttributeNameSafe(name)).toBe(false);
    }
  });
});

describe('valid spread props still render (no over-blocking)', () => {
  it('emits a safe spread of normal attributes', () => {
    const props = { id: 'card', 'data-role': 'list', title: 'hi & bye' };
    const html = renderJsxToHtmlString(h('div', { ...props }, 'x'));
    expect(html).toBe('<div id="card" data-role="list" title="hi &amp; bye">x</div>');
  });
});
