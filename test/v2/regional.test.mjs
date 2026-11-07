import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countryCatalog,countryOptions,validateRegional} from '../../src/v2/regional-settings.mjs';
test('Global profiles: country catalog produces formatting suggestions without selecting multi-zone locations',()=>{
 const catalog=countryCatalog();assert.ok(catalog.length>240);
 for(const country of catalog){const options=countryOptions(country.id);assert.equal(options.country,country.id);assert.ok(options.timeZones.length);assert.ok(options.currencies.length);}
 const tr=countryOptions('TR');assert.equal(tr.suggested.currency,'TRY');assert.equal(tr.suggested.timeZone,'Europe/Istanbul');
 const us=countryOptions('US');assert.equal(us.suggested.currency,'USD');assert.equal(us.suggested.timeZone,'');assert.equal(us.requiresTimeZoneSelection,true);
 assert.throws(()=>countryOptions('ZZ'),e=>e.status===422);
});
test('Global profiles: settings enforce dictionary and format controls without accepting compliance claims',()=>{
 assert.deepEqual(validateRegional({country:'JP',locale:'ja-JP',currency:'JPY',timeZone:'Asia/Tokyo'}),{country:'JP',locale:'ja-JP',currency:'JPY',timeZone:'Asia/Tokyo'});
 const valid={country:'TR',locale:'tr-TR',currency:'TRY',timeZone:'Europe/Istanbul'};
 for(const patch of [{country:'ZZ'},{currency:'FAKE'},{timeZone:'Wrong/Zone'},{timeZone:'+03:00'},{locale:'<script>'},{compliant:true},{dataRegion:'eu'}])assert.throws(()=>validateRegional({...valid,...patch}),e=>e.status===422);
});
