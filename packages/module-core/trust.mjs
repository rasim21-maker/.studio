// Deployment policy, not a self-attested package permission or sandbox.
export function assertPackageTrust(id,version,policy={mode:'trusted-local'}) {
  if(policy.mode==='trusted-local')return;
  if(policy.mode!=='reviewed-only')throw Error('Unsupported module execution policy; isolated execution is not implemented.');
  if(!policy.packages||policy.packages[id]!==version)throw Error('Package is not approved by the deployment policy: '+id);
}
/** Gate a trusted loader BEFORE import evaluation; validate identity afterwards. */
export async function loadReviewedPackage({id,version,load},policy) {
  if(policy?.mode!=='reviewed-only')throw Error('Reviewed loading requires an explicit reviewed-only policy.');
  assertPackageTrust(id,version,policy);
  if(typeof load!=='function')throw Error('A deployment-owned loader is required.');
  const definition=await load(),identity=definition?.manifest||definition;
  if(identity?.id!==id||identity?.version!==version)throw Error('Loaded package identity does not match the approved deployment.');
  return definition;
}
