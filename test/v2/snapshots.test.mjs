import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRegistry,discover} from '../../src/v2/adapters.ts';
import {fixture} from '../../src/v2/fixtures.ts';
import {assertSnapshot,assertRestorable} from '../../src/v2/snapshots.ts';
import {newSection} from '../../shared/v2/model.ts';

const registry=createRegistry();
for(const kind of ['static','react-sdk','wordpress']){
 test('E-10 E-13: '+kind+' historical content passes current rules without stripping site code',()=>{
  const adapter=registry.get(kind),{document,source}=discover(fixture(kind),registry);
  assert.doesNotThrow(()=>assertSnapshot(adapter,document,source));
  const original=structuredClone(source),bad=structuredClone(document);
  bad.pages[0].sections[0].fields[0].value='<script>alert(1)</script>';
  assert.throws(()=>assertSnapshot(adapter,bad,source),e=>e.status===422&&Array.isArray(e.details));
  assert.deepEqual(source,original);
  const future={...document,schemaVersion:99};assert.throws(()=>assertRestorable(adapter,document,future,source),e=>e.status===422);
 });
}
test('E-10: changed field policies report incompatibility instead of restoring old rules',()=>{
 const adapter=registry.get('static'),{document,source}=discover(fixture('static'),registry),current=structuredClone(document);
 current.pages[0].sections[0].fields[0].maxLength=200;
 assert.throws(()=>assertRestorable(adapter,current,document,source),e=>e.status===422&&e.details.some(i=>i.path==='/pages'));
});
test('E-10 E-13: mismatched source state and stale fingerprints cannot be rendered or exported',()=>{
 const adapter=registry.get('static'),{document,source}=discover(fixture('static'),registry),stale=structuredClone(source);
 stale.files['index.html']+='<!-- changed outside Studio -->';assert.throws(()=>assertSnapshot(adapter,document,stale),e=>e.status===409);
 const mismatched=structuredClone(document);mismatched.pages[0].title='Different from source';
 assert.throws(()=>assertSnapshot(adapter,mismatched,source),e=>e.status===422);
 const traversal=structuredClone(source);traversal.files['../outside.txt']='bad';assert.throws(()=>assertSnapshot(adapter,document,traversal),e=>e.status===422);
});
test('E-10: inactive dictionary values remain readable in existing snapshots',()=>{
 const adapter=registry.get('react-sdk'),{document,source}=discover(fixture('react-sdk'),registry),withGadget=structuredClone(document);
 withGadget.pages[0].sections.push(newSection('gadget','existingGadget'));
 const first=adapter.write(document,withGadget,source),inactive=structuredClone(withGadget);
 inactive.dictionaries[0].entries[0].active=false;inactive.dictionaries[0].version++;
 const second=adapter.write(withGadget,inactive,first);
 assert.doesNotThrow(()=>assertSnapshot(adapter,inactive,second));
 assert.throws(()=>assertRestorable(adapter,inactive,withGadget,first),e=>e.status===422);
});
