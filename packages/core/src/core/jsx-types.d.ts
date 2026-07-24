// JSX typings for classic runtime using l5e
// Custom JSX runtime (not React) - uses HTML standard attributes
import type { JSXChild, RenderedNode } from './jsx-runtime';

// Override React types if present
declare global {
  namespace JSX {
    // The return type of JSX expressions - override React.Element
    type Element = JSXChild | RenderedNode;

    // Base HTML attributes (HTML standard, not React)
    interface HTMLAttributes {
      // Standard HTML attributes
      id?: string;
      /**
       * HTML class attribute (string only, not boolean like React className)
       * Use classList prop for conditional classes with object/array syntax
       */
      class?: string;
      /**
       * HTML style attribute (string only, not object like React)
       * Format: "property: value; property2: value2;"
       */
      style?: string;
      title?: string;
      lang?: string;
      dir?: 'ltr' | 'rtl' | 'auto';
      hidden?: boolean | string;
      tabindex?: number | string;
      role?: string;
      'aria-label'?: string;
      'aria-labelledby'?: string;
      'aria-describedby'?: string;
      'aria-hidden'?: boolean | string;
      'aria-checked'?: boolean | string;
      'data-*'?: string;
      [key: `data-${string}`]: string | undefined;
      [key: `aria-${string}`]: string | boolean | undefined;
      // Microdata attributes (HTML standard)
      itemscope?: boolean | string;
      itemtype?: string;
      itemprop?: string;
      // JSX-specific (for key prop in loops, not HTML standard but needed for JSX)
      key?: string | number;
      // l5e framework special props
      /**
       * Set HTML content directly without escaping (use with caution)
       * This prop is filtered out during rendering and used to set innerHTML
       */
      setHtml?: string | number | unknown;
      /**
       * Set text content with HTML escaping
       * This prop is filtered out during rendering and used to set textContent
       */
      setText?: string | number | unknown;
      /**
       * Set class names from array, object, or string
       * - Array: ['class1', 'class2'] -> 'class1 class2'
       * - Object: { class1: true, class2: false } -> 'class1'
       * - String: 'class1 class2' -> 'class1 class2'
       * This prop is filtered out during rendering and merged with 'class' prop
       */
      classList?: string | string[] | Record<string, boolean>;
      /**
       * Add cache tag for cache invalidation
       * Can be string, array of strings, or object with boolean values
       * This prop is filtered out during rendering and used for cache management
       */
      cacheTag?: string | string[] | Record<string, boolean>;
    }

    // Microdata attributes interface (HTML standard)
    interface MicrodataAttributes {
      itemscope?: boolean | string;
      itemtype?: string;
      itemprop?: string;
    }

    // Extended HTML attributes with microdata
    interface HTMLAttributesWithMicrodata extends HTMLAttributes, MicrodataAttributes {}

    // Form attributes
    interface FormAttributes extends HTMLAttributes {
      for?: string; // HTML standard, not htmlFor
      name?: string;
      value?: string | number;
      disabled?: boolean | string;
      readonly?: boolean | string;
      required?: boolean | string;
      checked?: boolean | string;
      selected?: boolean | string;
      multiple?: boolean | string;
      autofocus?: boolean | string;
      autocomplete?: string;
      placeholder?: string;
      pattern?: string;
      min?: string | number;
      max?: string | number;
      step?: string | number;
      minlength?: string;
      maxlength?: string;
      size?: number;
      accept?: string;
      capture?: string;
    }

    // Media attributes
    interface MediaAttributes extends HTMLAttributes {
      src?: string;
      alt?: string;
      width?: number | string;
      height?: number | string;
      poster?: string;
      controls?: boolean | string;
      autoplay?: boolean | string;
      loop?: boolean | string;
      muted?: boolean | string;
      preload?: string;
      playsinline?: boolean | string;
    }

    // Link attributes
    interface AnchorAttributes extends HTMLAttributes, MicrodataAttributes {
      href?: string;
      target?: string;
      rel?: string;
      download?: string;
      hreflang?: string;
      type?: string;
      ping?: string;
    }

    // Table attributes
    interface TableCellAttributes extends HTMLAttributes {
      colspan?: number; // HTML standard, not colSpan
      rowspan?: number; // HTML standard, not rowSpan
      headers?: string;
      scope?: 'col' | 'row' | 'colgroup' | 'rowgroup';
      abbr?: string;
    }

    // List attributes
    interface ListAttributes extends HTMLAttributes {
      type?: string;
      start?: number;
      reversed?: boolean | string;
    }

    // Input attributes
    interface InputAttributes extends FormAttributes {
      type?: string;
      inputmode?: string;
    }

    // Textarea attributes
    interface TextareaAttributes extends FormAttributes {
      rows?: string;
      cols?: string;
      wrap?: string;
    }

    // Select attributes
    interface SelectAttributes extends FormAttributes {
      size?: number;
    }

    // Option attributes
    interface OptionAttributes extends HTMLAttributes {
      value?: string | number;
      selected?: boolean | string;
      disabled?: boolean | string;
      label?: string;
    }

    // SVG attributes (HTML standard, not React)
    interface SVGAttributes extends HTMLAttributes {
      // Common SVG attributes
      viewBox?: string;
      width?: number | string;
      height?: number | string;
      x?: number | string;
      y?: number | string;
      preserveAspectRatio?: string;
      xmlns?: string;
      version?: string;
      baseProfile?: string;
      contentScriptType?: string;
      contentStyleType?: string;

      // Presentation attributes
      fill?: string;
      'fill-opacity'?: number | string;
      'fill-rule'?: 'nonzero' | 'evenodd' | 'inherit';
      stroke?: string;
      'stroke-width'?: number | string;
      'stroke-linecap'?: 'butt' | 'round' | 'square' | 'inherit';
      'stroke-linejoin'?: 'miter' | 'round' | 'bevel' | 'inherit';
      'stroke-miterlimit'?: number | string;
      'stroke-dasharray'?: string;
      'stroke-dashoffset'?: number | string;
      'stroke-opacity'?: number | string;
      opacity?: number | string;
      transform?: string;
      'transform-origin'?: string;

      // Path-specific attributes
      d?: string;
      pathLength?: number | string;

      // Circle-specific attributes
      cx?: number | string;
      cy?: number | string;
      r?: number | string;

      // Ellipse-specific attributes
      rx?: number | string;
      ry?: number | string;

      // Rectangle-specific attributes
      x1?: number | string;
      y1?: number | string;
      x2?: number | string;
      y2?: number | string;

      // Line-specific attributes
      points?: string;

      // Text-specific attributes
      dx?: number | string;
      dy?: number | string;
      'text-anchor'?: 'start' | 'middle' | 'end' | 'inherit';
      'dominant-baseline'?: string;
      'alignment-baseline'?: string;
      'font-family'?: string;
      'font-size'?: number | string;
      'font-weight'?: number | string | 'normal' | 'bold' | 'bolder' | 'lighter';
      'font-style'?: 'normal' | 'italic' | 'oblique' | 'inherit';
      'text-decoration'?: string;
      'letter-spacing'?: number | string;
      'word-spacing'?: number | string;
      'text-transform'?: string;

      // Gradient attributes
      offset?: number | string;
      'stop-color'?: string;
      'stop-opacity'?: number | string;
      x1?: number | string;
      y1?: number | string;
      x2?: number | string;
      y2?: number | string;
      gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
      gradientTransform?: string;
      spreadMethod?: 'pad' | 'reflect' | 'repeat';
      fx?: number | string;
      fy?: number | string;
      fr?: number | string;
      cx?: number | string;
      cy?: number | string;
      r?: number | string;

      // Pattern attributes
      patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
      patternContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
      patternTransform?: string;

      // Clip and mask attributes
      clipPath?: string;
      'clip-rule'?: 'nonzero' | 'evenodd' | 'inherit';
      mask?: string;
      'mask-type'?: 'luminance' | 'alpha';

      // Filter attributes
      filter?: string;
      'flood-color'?: string;
      'flood-opacity'?: number | string;
      'lighting-color'?: string;

      // Marker attributes
      markerStart?: string;
      markerMid?: string;
      markerEnd?: string;
      'marker-units'?: 'strokeWidth' | 'userSpaceOnUse';
      'marker-width'?: number | string;
      'marker-height'?: number | string;
      orient?: string | 'auto' | 'auto-start-reverse';

      // Use element attributes
      href?: string;
      'xlink:href'?: string;

      // Image element attributes
      src?: string;
      'xlink:href'?: string;
      preserveAspectRatio?: string;

      // Animation attributes
      attributeName?: string;
      attributeType?: 'CSS' | 'XML' | 'auto';
      begin?: string;
      dur?: string;
      end?: string;
      repeatCount?: number | string | 'indefinite';
      repeatDur?: string | 'indefinite';
      restart?: 'always' | 'whenNotActive' | 'never';
      fill?: 'remove' | 'freeze';
      calcMode?: 'discrete' | 'linear' | 'paced' | 'spline';
      values?: string;
      keyTimes?: string;
      keySplines?: string;
      from?: string | number;
      to?: string | number;
      by?: string | number;
      type?: string;
      additive?: 'replace' | 'sum';
      accumulate?: 'none' | 'sum';

      // Foreign object attributes
      requiredExtensions?: string;
      requiredFeatures?: string;
      systemLanguage?: string;

      // Allow any SVG-specific attributes
      [key: string]: any;
    }

    // Intrinsic elements with proper HTML attributes
    interface IntrinsicElements {
      // Text content
      div: HTMLAttributes;
      span: HTMLAttributesWithMicrodata;
      p: HTMLAttributes;
      h1: HTMLAttributes;
      h2: HTMLAttributes;
      h3: HTMLAttributes;
      h4: HTMLAttributes;
      h5: HTMLAttributes;
      h6: HTMLAttributes;
      strong: HTMLAttributes;
      em: HTMLAttributes;
      b: HTMLAttributes;
      i: HTMLAttributes;
      u: HTMLAttributes;
      s: HTMLAttributes;
      small: HTMLAttributes;
      sub: HTMLAttributes;
      sup: HTMLAttributes;
      code: HTMLAttributes;
      pre: HTMLAttributes;
      blockquote: HTMLAttributes;
      q: HTMLAttributes;
      cite: HTMLAttributes;
      abbr: HTMLAttributes;
      mark: HTMLAttributes;
      del: HTMLAttributes;
      ins: HTMLAttributes;
      kbd: HTMLAttributes;
      samp: HTMLAttributes;
      var: HTMLAttributes;
      time: HTMLAttributes & { datetime?: string };
      address: HTMLAttributes;

      // Lists
      ul: ListAttributes;
      ol: ListAttributes & MicrodataAttributes;
      li: HTMLAttributesWithMicrodata & { value?: string | number }; // li can have value attribute
      dl: HTMLAttributes;
      dt: HTMLAttributes;
      dd: HTMLAttributes;

      // Links
      a: AnchorAttributes;

      // Images and media
      img: MediaAttributes & {
        loading?: 'lazy' | 'eager';
        decoding?: 'async' | 'sync' | 'auto';
        key?: string | number;
      };
      video: MediaAttributes;
      audio: MediaAttributes;
      source: HTMLAttributes & {
        src?: string;
        type?: string;
        srcset?: string;
        media?: string;
        key?: string | number;
      };
      track: HTMLAttributes & {
        kind?: string;
        src?: string;
        srclang?: string;
        label?: string;
        default?: boolean | string;
      };
      picture: HTMLAttributes;
      canvas: HTMLAttributes & { width?: number | string; height?: number | string };

      // Tables
      table: HTMLAttributes;
      caption: HTMLAttributes;
      thead: HTMLAttributes;
      tbody: HTMLAttributes;
      tfoot: HTMLAttributes;
      tr: HTMLAttributes;
      th: TableCellAttributes;
      td: TableCellAttributes;
      colgroup: HTMLAttributes;
      col: HTMLAttributes & { span?: number };

      // Forms
      form: HTMLAttributes & {
        action?: string;
        method?: string;
        enctype?: string;
        novalidate?: boolean | string;
      };
      input: InputAttributes;
      textarea: TextareaAttributes;
      button: FormAttributes & { type?: 'button' | 'submit' | 'reset' };
      select: SelectAttributes;
      option: OptionAttributes;
      optgroup: HTMLAttributes & { label?: string; disabled?: boolean | string };
      label: FormAttributes;
      fieldset: HTMLAttributes & { disabled?: boolean | string; form?: string; name?: string };
      legend: HTMLAttributes;
      datalist: HTMLAttributes;
      output: HTMLAttributes & { for?: string; form?: string; name?: string };

      // Interactive
      details: HTMLAttributes & { open?: boolean | string };
      summary: HTMLAttributes;
      dialog: HTMLAttributes & { open?: boolean | string };

      // Semantic
      header: HTMLAttributes;
      footer: HTMLAttributes;
      nav: HTMLAttributes;
      main: HTMLAttributes;
      article: HTMLAttributes;
      section: HTMLAttributes;
      aside: HTMLAttributes;
      figure: HTMLAttributes;
      figcaption: HTMLAttributes;

      // Other
      hr: HTMLAttributes;
      br: HTMLAttributes;
      wbr: HTMLAttributes;
      meta: HTMLAttributes & {
        name?: string;
        content?: string;
        charset?: string;
        'http-equiv'?: string;
        property?: string;
      };
      link: HTMLAttributes & {
        rel?: string;
        href?: string;
        type?: string;
        media?: string;
        sizes?: string;
        crossorigin?: string;
        hreflang?: string;
      };
      style: HTMLAttributes & { type?: string; media?: string };
      script: HTMLAttributes & {
        src?: string;
        type?: string;
        async?: boolean | string;
        defer?: boolean | string;
        crossorigin?: string;
        integrity?: string;
      };
      noscript: HTMLAttributes;
      iframe: HTMLAttributes & {
        src?: string;
        srcdoc?: string;
        name?: string;
        sandbox?: string;
        allow?: string;
        allowfullscreen?: boolean | string;
        width?: number | string;
        height?: number | string;
      };
      embed: HTMLAttributes & {
        src?: string;
        type?: string;
        width?: number | string;
        height?: number | string;
      };
      object: HTMLAttributes & {
        data?: string;
        type?: string;
        width?: number | string;
        height?: number | string;
        form?: string;
        name?: string;
      };
      param: HTMLAttributes & { name?: string; value?: string };
      area: HTMLAttributes & {
        alt?: string;
        coords?: string;
        shape?: string;
        href?: string;
        target?: string;
        rel?: string;
        download?: string;
      };
      map: HTMLAttributes & { name?: string };
      svg: SVGAttributes;
      path: SVGAttributes;
      circle: SVGAttributes;
      rect: SVGAttributes;
      line: SVGAttributes;
      polyline: SVGAttributes;
      polygon: SVGAttributes;
      ellipse: SVGAttributes;
      g: SVGAttributes;
      defs: SVGAttributes;
      use: SVGAttributes;
      symbol: SVGAttributes;
      mask: SVGAttributes;
      clipPath: SVGAttributes;
      pattern: SVGAttributes;
      marker: SVGAttributes;
      linearGradient: SVGAttributes;
      radialGradient: SVGAttributes;
      stop: SVGAttributes;
      text: SVGAttributes;
      tspan: SVGAttributes;
      textPath: SVGAttributes;
      tref: SVGAttributes;
      foreignObject: SVGAttributes;
      image: SVGAttributes;
      switch: SVGAttributes;
      view: SVGAttributes;
      animate: SVGAttributes;
      animateTransform: SVGAttributes;
      animateMotion: SVGAttributes;
      mpath: SVGAttributes;
      set: SVGAttributes;

      // Allow any other element with HTML attributes
      [elemName: string]: HTMLAttributes | any;
    }
  }
}

export {};
