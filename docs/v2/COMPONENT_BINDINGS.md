# React SDK component bindings — version 1

An opt-in data integration for developer-owned React components. Studio edits
declared primitive props through content JSON; it does not rewrite JSX, infer hooks
or execute customer components in its management preview. The SDK is still a private
workspace/local tarball, not a published npm product.

Add `studio/components.json` to a valid `react-sdk` site:

```json
{"version":1,"components":[{"id":"homeHero","page":"home","section":"hero","sourceFile":"src/Hero.tsx","exportName":"default","props":{"title":"heading"}}]}
```

Page/section/field IDs must exist in the content document and the source file must
exist. Export name is declared metadata, not verified AST/runtime provenance.
The consuming app explicitly connects its own component:

```tsx
import {componentProps} from '@loft-studio/sdk/components';
import content from '../studio/content.json';
import bindings from '../studio/components.json';
import Hero from './Hero';
const props = componentProps(content, bindings, 'homeHero');
export default function App() { return <Hero title={String(props.title)} />; }
```

Supported fields: text, number, boolean, enum, URL and library image. No rich HTML,
callbacks, objects, style, raw HTML/DOM props, children, refs or prototype keys.
Locale resolution uses declared locales/translations. At most 200 declarations and
40 props each. Unknown versions/IDs, unsafe paths/props and missing source files
fail import/write. Deleting a referenced section is rejected until bindings change.
The browser-safe bridge checks primitive types and URL/media rules; the CMS server
remains authoritative for full validation. Render props in their safe context and
never turn plain text into raw HTML.

Edits preserve component bytes and update content through existing permission,
revision and adapter rules. Rebuild/publish the consuming app for changes to bundled
JSON. No live custom-component build service is included. The import report shows
declared component/prop mappings. The registry grants no execution permission.

`visual-components.test.mjs` tests persisted edit/export/reimport and renders a
compiled, trusted first-party React fixture with the changed heading. Packed-package
consumer tests check the `/components` export independently. This is not acceptance
of a live customer project or every framework detected by the discovery report.
