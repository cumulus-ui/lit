/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import {assert} from 'chai';
import {LitElement, html} from 'lit';

// A simple element with only reflected properties — hydration should work.
class SimpleGreeting extends LitElement {
  static override properties = {
    name: {reflect: true},
  };
  name = 'World';

  override render() {
    return html`<p>Hello ${this.name}</p>`;
  }
}
customElements.define('simple-greeting', SimpleGreeting);

// An element with a non-reflected array property — hydration can't work
// when items are set before upgrade, because the SSR output has an empty
// list but the client template produces items.
class ListElement extends LitElement {
  static override properties = {
    items: {attribute: false},
  };
  items: string[] = [];

  override render() {
    return html`<ul>
      ${this.items.map((item) => html`<li>${item}</li>`)}
    </ul>`;
  }
}
customElements.define('list-element', ListElement);

// A parent that renders a child in its shadow DOM. Used to test deferred
// children detection.
class ParentElement extends LitElement {
  override render() {
    return html`<div><child-element></child-element></div>`;
  }
}
customElements.define('parent-element', ParentElement);

class ChildElement extends LitElement {
  override render() {
    return html`<span>child</span>`;
  }
}
customElements.define('child-element', ChildElement);

suite('hydration fallback to replace', () => {
  let container: HTMLElement;

  teardown(() => {
    container?.remove();
  });

  test('replaces SSR content when non-reflected property has non-default value', async () => {
    container = document.createElement('div');

    // Simulate SSR-rendered HTML with an empty list (default items=[])
    container.setHTMLUnsafe(`
      <list-element>
        <template shadowroot="open" shadowrootmode="open">
          <!--lit-part om80B80ddXw=--><ul><!--lit-part--><!--/lit-part--></ul><!--/lit-part-->
        </template>
      </list-element>
    `);

    // Set items before connecting to document (simulates inline <script>
    // setting properties before element upgrade)
    const el = container.querySelector('list-element') as ListElement;
    el.items = ['a', 'b', 'c'];

    // Connect — triggers upgrade, connectedCallback, update
    document.body.appendChild(container);
    await el.updateComplete;

    // Should have replaced SSR content with fresh render containing 3 items
    const root = el.shadowRoot!;
    const lis = root.querySelectorAll('li');
    assert.equal(lis.length, 3);
    assert.equal(lis[0].textContent, 'a');
    assert.equal(lis[1].textContent, 'b');
    assert.equal(lis[2].textContent, 'c');
  });

  test('replaces SSR content when shadow root has deferred children', async () => {
    container = document.createElement('div');

    // Parent's shadow DOM contains a child with defer-hydration
    container.setHTMLUnsafe(`
      <parent-element>
        <template shadowroot="open" shadowrootmode="open">
          <!--lit-part Py8qPt9eCuI=--><div><child-element defer-hydration>
            <template shadowroot="open" shadowrootmode="open">
              <!--lit-part OIVJ6d1RcwE=--><span>child</span><!--/lit-part-->
            </template>
          </child-element></div><!--/lit-part-->
        </template>
      </parent-element>
    `);

    document.body.appendChild(container);

    const el = container.querySelector('parent-element') as ParentElement;
    await el.updateComplete;

    // Parent should have replaced (not hydrated) due to deferred child
    const root = el.shadowRoot!;
    assert.equal(root.querySelectorAll('child-element').length, 1);
    assert.equal(root.querySelectorAll('div').length, 1);
  });

  test('hydrates normally when SSR output matches client', async () => {
    container = document.createElement('div');

    // All properties reflected, no deferred children — standard hydration
    container.setHTMLUnsafe(`
      <simple-greeting name="Lit">
        <template shadowroot="open" shadowrootmode="open">
          <!--lit-part gq4z7E/PyHM=--><p>Hello <!--lit-part-->Lit<!--/lit-part--></p><!--/lit-part-->
        </template>
      </simple-greeting>
    `);

    document.body.appendChild(container);

    const el = container.querySelector('simple-greeting') as SimpleGreeting;
    await el.updateComplete;

    // Should have hydrated (adopted existing DOM)
    const root = el.shadowRoot!;
    assert.equal(root.querySelectorAll('p').length, 1);
    assert.equal(root.querySelector('p')!.textContent, 'Hello Lit');
  });
});
