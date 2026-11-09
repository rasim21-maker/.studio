// Shared by import, historical output validation and encrypted backup handling.
export const isRuntimeSecretName = name =>
 ['studio-key','integration-key','studio-vault.json'].includes(name.normalize('NFC').toLowerCase()) ||
 /^\.env(?:\.|$)/i.test(name);
